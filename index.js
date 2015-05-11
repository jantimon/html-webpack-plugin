'use strict';
var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var tmpl = require('blueimp-tmpl').tmpl;

function HtmlWebpackPlugin(options) {
  this.options = options || {};
}

HtmlWebpackPlugin.prototype.apply = function(compiler) {
  var self = this;
  compiler.plugin('emit', function(compilation, callback) {
    var webpackStatsJson = compilation.getStats().toJson();
    var templateParams = {};
    templateParams.webpack = webpackStatsJson;
    templateParams.htmlWebpackPlugin = {};
    templateParams.htmlWebpackPlugin.assets = self.htmlWebpackPluginLegacyAssets(compilation, webpackStatsJson);
    templateParams.htmlWebpackPlugin.files = self.htmlWebpackPluginAssets(compilation, webpackStatsJson, self.options.chunks, self.options.excludeChunks);
    templateParams.htmlWebpackPlugin.options = self.options;
    templateParams.webpackConfig = compilation.options;

    var outputFilename = self.options.filename || 'index.html';

    if (self.options.templateContent && self.options.template) {
      compilation.errors.push(new Error('HtmlWebpackPlugin: cannot specify both template and templateContent options'));
      callback();
    } else if (self.options.templateContent) {
      var templateContent = typeof self.options.templateContent === 'function' ? self.options.templateContent(templateParams, compiler) : self.options.templateContent;
      self.emitHtml(compilation, templateContent, templateParams, outputFilename);
      callback();
    } else {
      var templateFile = self.options.template;
      if (!templateFile) {
        // Use a special index file to prevent double script / style injection if the `inject` option is truthy
        templateFile = path.join(__dirname, self.options.inject ? 'default_inject_index.html' : 'default_index.html');
      }
      compilation.fileDependencies.push(templateFile);

      fs.readFile(templateFile, 'utf8', function(err, htmlTemplateContent) {
        if (err) {
          compilation.errors.push(new Error('HtmlWebpackPlugin: Unable to read HTML template "' + templateFile + '"'));
        } else {
          self.emitHtml(compilation, htmlTemplateContent, templateParams, outputFilename);
        }
        callback();
      });
    }
  });
};

HtmlWebpackPlugin.prototype.emitHtml = function(compilation, htmlTemplateContent, templateParams, outputFilename) {
  var html;
  try {
   html = tmpl(htmlTemplateContent, templateParams);
  } catch(e) {
    compilation.errors.push(new Error('HtmlWebpackPlugin: template error ' + e));
  }
  // Inject link and script elements into an existing html file
  if (this.options.inject) {
    html = this.injectAssetsIntoHtml(html, templateParams);
  }
  compilation.assets[outputFilename] = {
    source: function() {
      return html;
    },
    size: function() {
      return html.length;
    }
  };
};

HtmlWebpackPlugin.prototype.getAssetPathFromModuleName = function(publicPath, modules) {
  var filenameRegexp = [/^favicon\.ico($|\?)/, /^apple-touch-icon\.png($|\?)/];

  return _.chain(modules)
    .filter(function (module) {
      // If the module failed to load, skip it to properly propagate the error
      if (module.failed) {
        return false;
      }

      var basename = path.basename(module.name);
      return _.some(filenameRegexp, function(regexp) {
        return regexp.test(basename);
      });
    })
    .map(function (module) {
      // If the assets is not base64-encoded
      if (module.assets.length) {
        return [path.parse(module.name).name, publicPath + module.assets[0]];
      }

      return [path.parse(module.name).name, module.source.substring(18, module.source.length - 1)];
    })
    .zipObject()
    .value();
};

HtmlWebpackPlugin.prototype.htmlWebpackPluginAssets = function(compilation, webpackStatsJson, includedChunks, excludedChunks) {
  var self = this;
  var publicPath = compilation.options.output.publicPath || '';

  var assets = {
    // Will contain all js & css files by chunk
    chunks: {},
    // Will contain all js files
    js: [],
    // Will contain all css files
    css: [],
    // Will contain the html5 appcache manifest files if it exists
    manifest: Object.keys(compilation.assets).filter(function(assetFile){
      return path.extname(assetFile) === '.appcache';
    })[0]
  };

  // Append a hash for cache busting
  if (this.options.hash) {
    assets.manifest = self.appendHash(assets.manifest, webpackStatsJson.hash);
  }

  var chunks = webpackStatsJson.chunks.sort(function orderEntryLast(a, b) {
    if (a.entry !== b.entry) {
      return b.entry ? 1 : -1;
    } else {
      return b.id - a.id;
    }
  });

  for (var i = 0; i < chunks.length; i++) {
    var chunk = chunks[i];
    var chunkName = chunk.names[0];

    // Skip if the chunks should be filtered and the given chunk was not added explicity
    if (Array.isArray(includedChunks) && includedChunks.indexOf(chunkName) === -1) {
      continue;
    }
    // Skip if the chunks should be filtered and the given chunk was excluded explicity
    if (Array.isArray(excludedChunks) && excludedChunks.indexOf(chunkName) !== -1) {
      continue;
    }

    assets.chunks[chunkName] = {};

    // Prepend the public path to all chunk files
    var chunkFiles = [].concat(chunk.files).map(function(chunkFile) {
      return publicPath + chunkFile;
    });

    // Append a hash for cache busting
    if (this.options.hash) {
      chunkFiles = chunkFiles.map(function(chunkFile) {
        return self.appendHash(chunkFile, webpackStatsJson.hash);
      });
    }

    // Webpack outputs an array for each chunk when using sourcemaps
    // But we need only the entry file
    var entry = chunkFiles[0];
    assets.chunks[chunkName].entry = entry;
    assets.js.push(entry);

    // Gather all css files
    var css = chunkFiles.filter(function(chunkFile){
      // Some chunks may contain content hash in their names, for ex. 'main.css?1e7cac4e4d8b52fd5ccd2541146ef03f'.
      // We must proper handle such cases, so we use regexp testing here
      return /^.css($|\?)/.test(path.extname(chunkFile));
    });
    assets.chunks[chunkName].css = css;
    assets.css = assets.css.concat(css);
  }

  // Duplicate css assets can occur on occasion if more than one chunk
  // requires the same css.
  assets.css = _.uniq(assets.css);

  assets.extraFiles = self.getAssetPathFromModuleName(publicPath, webpackStatsJson.modules);

  assets.favicon = assets.extraFiles.favicon;
  assets.appleTouchIcon = assets.extraFiles['apple-touch-icon'];

  return assets;
};

/**
 * Injects the assets into the given html string
 */
HtmlWebpackPlugin.prototype.injectAssetsIntoHtml = function(html, templateParams) {
  var assets = templateParams.htmlWebpackPlugin.files;
  var chunks = Object.keys(assets.chunks);

  // Gather all css and script files
  var styles = [];
  var scripts = [];
  chunks.forEach(function(chunkName) {
    styles = styles.concat(assets.chunks[chunkName].css);
    scripts.push(assets.chunks[chunkName].entry);
  });
  // Turn script files into script tags
  scripts = scripts.map(function(scriptPath) {
    return '<script src="' + scriptPath + '"></script>';
  });
  // Turn css files into link tags
  styles = styles.map(function(stylePath) {
    return '<link href="' + stylePath + '" rel="stylesheet">';
  });
  // If there is an apple touch icon present, add it above any link-tags
  if (assets.appleTouchIcon) {
    styles.unshift('<link rel="apple-touch-icon" href="' + assets.appleTouchIcon + '">');
  }
  // If there is a favicon present, add it above any link-tags
  if (assets.favicon) {
    styles.unshift('<link rel="shortcut icon" href="' + assets.favicon + '">');
  }
  // Append scripts to body element
  html = html.replace(/(<\/body>)/i, function (match) {
    return scripts.join('') + match;
  });
  // Append styles to head element
  html = html.replace(/(<\/head>)/i, function (match) {
    return styles.join('') + match;
  });
  // Inject manifest into the opening html tag
  if (assets.manifest) {
    html = html.replace(/(<html.*)(>)/i, function (match, start, end) {
      // Append the manifest only if no manifest was specified
      if (match.test(/\smanifest\s*=/)) {
        return match;
      }
      return start + ' manifest="' + assets.manifest + '"' + end;
    });
  }
  return html;
};

/**
 * A helper to support the templates written for html-webpack-plugin <= 1.1.0
 */
HtmlWebpackPlugin.prototype.htmlWebpackPluginLegacyAssets = function(compilation, webpackStatsJson) {
  var assets = this.htmlWebpackPluginAssets(compilation, webpackStatsJson);
  var legacyAssets = {};
  Object.keys(assets.chunks).forEach(function(chunkName){
    legacyAssets[chunkName] = assets.chunks[chunkName].entry;
  });
  return legacyAssets;
};

/**
 * Appends a cache busting hash
 */
HtmlWebpackPlugin.prototype.appendHash = function (url, hash) {
  if (!url) {
    return url;
  }
  return url + (url.indexOf('?') === -1 ? '?' : '&') + hash;
};


module.exports = HtmlWebpackPlugin;
