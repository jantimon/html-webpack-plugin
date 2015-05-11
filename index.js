'use strict';
var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var async = require('async');
var tmpl = require('blueimp-tmpl').tmpl;

function HtmlWebpackPlugin(options) {
  this.options = options || {};
}

HtmlWebpackPlugin.prototype.apply = function(compiler) {
  var self = this;
  compiler.plugin('emit', function(compilation, compileCallback) {
    var webpackStatsJson = compilation.getStats().toJson();

    async.waterfall([
      // Add the favicon
      function(callback) {
        if (self.options.favicon) {
          self.addFileToAssets(compilation, self.options.favicon, callback);
        } else {
          callback(null);
        }
      },
      // Generate the html
      function(callback) {
        var templateParams = {};
        templateParams.webpack = webpackStatsJson;
        templateParams.htmlWebpackPlugin = {};
        templateParams.htmlWebpackPlugin.assets = self.htmlWebpackPluginLegacyAssets(compilation, webpackStatsJson);
        templateParams.htmlWebpackPlugin.files = self.htmlWebpackPluginAssets(compilation, webpackStatsJson, self.options.chunks, self.options.excludeChunks);
        templateParams.htmlWebpackPlugin.options = self.options;
        templateParams.webpackConfig = compilation.options;
        var outputFilename = self.options.filename || 'index.html';
        self.getTemplateContent(compilation, templateParams, function(err, htmlTemplateContent) {
          if (!err) {
            self.emitHtml(compilation, htmlTemplateContent, templateParams, outputFilename);
          }
          callback();
        });
      }
    ], compileCallback);

  });
};

/**
 * Retrieves the html source depending on `this.options`.
 * Supports:
 * + options.fileContent as string
 * + options.fileContent as sync function
 * + options.fileContent as async function
 * + options.template as template path
 * Calls the callback with (`err`, `htmlTemplateContent`).
 */
HtmlWebpackPlugin.prototype.getTemplateContent = function(compilation, templateParams, callback) {
  var self = this;
  if (self.options.templateContent && self.options.template) {
    var err = new Error('HtmlWebpackPlugin: cannot specify both template and templateContent options');
    compilation.errors.push(err);
    callback(err);
  } else if (typeof self.options.templateContent === 'function') {
    // allow to specify a sync or an async function to generate the template content
    var result = self.options.templateContent(templateParams, compilation, callback);
    // if it return a result expect it to be sync
    if (result !== undefined) {
      callback(null, result);
    }
  } else if (self.options.templateContent) {
    // Use template content as string
    callback(null, self.options.templateContent);
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
      }
      callback(err, htmlTemplateContent);
    });
  }
};

/*
 * Compile the html template and push the result to the compilation assets
 */
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

/*
 * Pushes the content of the given filename to the compilation assets
 */
HtmlWebpackPlugin.prototype.addFileToAssets = function(compilation, filename, callback) {
  async.parallel({
    size: function(callback) {
      fs.stat(filename, function(err, stats){
        callback(err, err ? undefined : stats.size);
      });
    },
    source: function(callback) {
      fs.readFile(filename, function(err, data) {
        callback(err, data);
      });
    }
  }, function(err, results) {
    if (err) {
      err = new Error('HtmlWebpackPlugin: could not load file ' + filename);
      compilation.errors.push(err);
      callback(err);
    } else {
      compilation.assets[path.basename(filename)] = {
        source: function() {
          return results.source;
        },
        size: function() {
          return results.size;
        }
      };
      callback(null);
    }
  });
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
    // Will contain the path to the favicon if it exists
    favicon: self.options.favicon ? publicPath + path.basename(self.options.favicon): undefined,
    // Will contain the html5 appcache manifest files if it exists
    manifest: Object.keys(compilation.assets).filter(function(assetFile){
      return path.extname(assetFile) === '.appcache';
    })[0]
  };

  // Append a hash for cache busting
  if (this.options.hash) {
    assets.manifest = self.appendHash(assets.manifest, webpackStatsJson.hash);
    assets.favicon = self.appendHash(assets.favicon, webpackStatsJson.hash);
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
