'use strict';
var fs = require('fs');
var path = require('path');
 var urlModule = require('url');
var _ = require('lodash');
var tmpl = require('blueimp-tmpl').tmpl;
var Promise = require('bluebird');
Promise.promisifyAll(fs);

function HtmlWebpackPlugin(options) {
  this.options = options || {};
}

HtmlWebpackPlugin.prototype.apply = function(compiler) {
  var self = this;
  compiler.plugin('emit', function(compilation, compileCallback) {
    var webpackStatsJson = compilation.getStats().toJson();
    var outputFilename = self.options.filename || 'index.html';
    Promise.resolve()
      // Add the favicon
      .then(function(callback) {
        if (self.options.favicon) {
          return self.addFileToAssets(compilation, self.options.favicon, callback);
        }
      })
      // Generate the html
      .then(function() {
        var templateParams = {
          webpack: webpackStatsJson,
          webpackConfig: compilation.options,
          htmlWebpackPlugin: {
            files: self.htmlWebpackPluginAssets(compilation, webpackStatsJson, self.options.chunks, self.options.excludeChunks),
            options: self.options,
          }
        };
        // Deprecate templateParams.htmlWebpackPlugin.assets
        var assets = self.htmlWebpackPluginLegacyAssets(compilation, webpackStatsJson);
        Object.defineProperty(templateParams.htmlWebpackPlugin, 'assets', {
          get: function() {
            compilation.warnings.push(new Error('HtmlWebPackPlugin: htmlWebpackPlugin.assets is deprecated - please use inject or htmlWebpackPlugin.files instead' +
              '\nsee: https://github.com/ampedandwired/html-webpack-plugin/issues/52'));
            return assets;
          }
        });

        // Get/generate html
        return self.getTemplateContent(compilation, templateParams)
          .then(function(htmlTemplateContent) {
            // Compile and add html to compilation
            return self.emitHtml(compilation, htmlTemplateContent, templateParams, outputFilename);
        });
      })
      // In case anything went wrong let the user know
      .catch(function(err) {
        compilation.errors.push(err);
        compilation.assets[outputFilename] = {
          source: function() {
            return err.toString();
          },
          size: function() {
            return err.toString().length;
          }
        };
      })
      // Tell the compiler to proceed
      .finally(compileCallback);
  });
};

/**
 * Retrieves the html source depending on `this.options`.
 * Supports:
 * + options.fileContent as string
 * + options.fileContent as sync function
 * + options.fileContent as async function
 * + options.template as template path
 * Returns a Promise
 */
HtmlWebpackPlugin.prototype.getTemplateContent = function(compilation, templateParams) {
  var self = this;
  // If config is invalid
  if (self.options.templateContent && self.options.template) {
    return Promise.reject(new Error('HtmlWebpackPlugin: cannot specify both template and templateContent options'));
  }
  // If a function is passed
  if (typeof self.options.templateContent === 'function') {
    return Promise.fromNode(function(callback) {
      // allow to specify a sync or an async function to generate the template content
      var result = self.options.templateContent(templateParams, compilation, callback);
      // if it returns a result expect it to be sync
      if (result !== undefined) {
        callback(null, result);
      }
    });
  }
  // If a string is passed
  if (self.options.templateContent) {
    return Promise.resolve(self.options.templateContent);
  }
  // If templateContent is empty use the template option
  var templateFile = self.options.template;
  if (!templateFile) {
    // Use a special index file to prevent double script / style injection if the `inject` option is truthy
    templateFile = path.join(__dirname, self.options.inject ? 'default_inject_index.html' : 'default_index.html');
  } else {
    templateFile = path.normalize(templateFile);
  }
  compilation.fileDependencies.push(templateFile);
  return fs.readFileAsync(templateFile, 'utf8')
    // If the file could not be read log a error
    .catch(function() {
      return Promise.reject(new Error('HtmlWebpackPlugin: Unable to read HTML template "' + templateFile + '"'));
    });
};

/*
 * Compile the html template and push the result to the compilation assets
 */
HtmlWebpackPlugin.prototype.emitHtml = function(compilation, htmlTemplateContent, templateParams, outputFilename) {
  var html;
  // blueimp-tmpl processing
  try {
    html = tmpl(htmlTemplateContent, templateParams);
  } catch(e) {
    return Promise.reject(new Error('HtmlWebpackPlugin: template error ' + e));
  }

  // Inject link and script elements into an existing html file
  if (this.options.inject) {
    html = this.injectAssetsIntoHtml(html, templateParams);
  }

  // Minify the html output
  if (this.options.minify) {
    var minify = require('html-minifier').minify;
    html = minify(html, this.options.minify);
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
HtmlWebpackPlugin.prototype.addFileToAssets = function(compilation, filename) {
  return Promise.props({
    size: fs.statAsync(filename),
    source: fs.readFileAsync(filename)
  })
  .catch(function() {
    return Promise.reject(new Error('HtmlWebpackPlugin: could not load file ' + filename));
  })
  .then(function(results) {
    compilation.fileDependencies.push(filename);
    compilation.assets[path.basename(filename)] = {
      source: function() {
        return results.source;
      },
      size: function() {
        return results.size;
      }
    };
  });
};

/**
 * Helper to sort chunks
 */
HtmlWebpackPlugin.prototype.sortChunks = function(chunks, sortMode) {
  // Sort mode auto by default: 
  if (typeof sortMode === 'undefined' || sortMode === 'auto') {
    return chunks.sort(function orderEntryLast(a, b) {
      if (a.entry !== b.entry) {
        return b.entry ? 1 : -1;
      } else {
        return b.id - a.id;
      }
    });
  }
  // Disabled sorting:
  if (sortMode === 'none') {
    return chunks;
  }
  // Custom function
  if (typeof sortMode === 'function') {
    return chunks.sort(sortMode);
  }
  // Invalid sort mode
  throw new Error('"' + sortMode + '" is not a valid chunk sort mode');
};

HtmlWebpackPlugin.prototype.htmlWebpackPluginAssets = function(compilation, webpackStatsJson, includedChunks, excludedChunks) {
  var self = this;

  // Use the configured public path or build a relative path
  var publicPath = typeof compilation.options.output.publicPath !== 'undefined' ?
      compilation.mainTemplate.getPublicPath({hash: webpackStatsJson.hash}) :
      path.relative(path.dirname(self.options.filename), '.');

  if (publicPath.length && publicPath.substr(-1, 1) !== '/') {
    publicPath = path.join(urlModule.resolve(publicPath + '/', '.'), '/');
  }

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

  // Get sorted chunks
  var chunks = HtmlWebpackPlugin.prototype.sortChunks(webpackStatsJson.chunks, this.options.chunksSortMode);

  for (var i = 0; i < chunks.length; i++) {
    var chunk = chunks[i];
    var chunkName = chunk.names[0];

    // This chunk doesn't have a name. This script can't handled it.
    if(chunkName === undefined) {
      continue;
    }

    // Skip not initial chunks
    if (!chunk.initial) {
      continue;
    }

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
    assets.chunks[chunkName].size = chunk.size;
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
  // Injections
  var head = [];
  var body = [];

  // If there is a favicon present, add it to the head
  if (assets.favicon) {
    head.push('<link rel="shortcut icon" href="' + assets.favicon + '">');
  }
  // Add styles to the head
  head = head.concat(styles);
  // Add scripts to body or head
  if (this.options.inject === 'head') {
    head = head.concat(scripts);
  } else {
    body = body.concat(scripts);
  }
  // Append assets to head element
  html = html.replace(/(<\/head>)/i, function (match) {
    return head.join('') + match;
  });
  // Append assets to body element
    html = html.replace(/(<\/body>)/i, function (match) {
      return body.join('') + match;
    });
  // Inject manifest into the opening html tag
  if (assets.manifest) {
    html = html.replace(/(<html[^>]*)(>)/i, function (match, start, end) {
      // Append the manifest only if no manifest was specified
      if (/\smanifest\s*=/.test(match)) {
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
