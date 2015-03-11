/*jshint -W083 */
var fs = require('fs');
var path = require('path');
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
    templateParams.hash = webpackStatsJson.hash;
    templateParams.htmlWebpackPlugin = {};
    templateParams.htmlWebpackPlugin.assets = self.htmlWebpackPluginAssets(compilation, webpackStatsJson);
    templateParams.htmlWebpackPlugin.options = self.options;

    var outputFilename = self.options.filename || 'index.html';

    if (self.options.templateContent && self.options.template) {
      compilation.errors.push(new Error('HtmlWebpackPlugin: cannot specify both template and templateContent options'));
      callback();
    } else if (self.options.templateContent) {
      self.emitHtml(compilation, self.options.templateContent, templateParams, outputFilename);
      callback();
    } else {
      var templateFile = self.options.template;
      if (!templateFile) {
        templateFile = path.join(__dirname, 'default_index.html');
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
  compilation.assets[outputFilename] = {
    source: function() {
      return html;
    },
    size: function() {
      return html.length;
    }
  };
};


HtmlWebpackPlugin.prototype.htmlWebpackPluginAssets = function(compilation, webpackStatsJson) {
  var assets = {
    // Will contain all js & css files by chunk
    chunks: [],
    // Will contain all js files
    js: [],
    // Will contain all css files
    css: [],
    // Will contain the html5 appcache manifest files if it exists
    manifest: Object.keys(compilation.assets).filter(function(assetFile){
      return path.extname(assetFile) === '.appcache';
    })[0]
  };
  var publicPath = compilation.options.output.publicPath || '';

  for (var chunk in webpackStatsJson.assetsByChunkName) {
    assets.chunks[chunk] = {};

    // Prepend the public path to all chunk files
    var chunkFiles = [].concat(webpackStatsJson.assetsByChunkName[chunk]).map(function(chunkFile) {
      return publicPath + chunkFile;
    });

    // Webpack outputs an array for each chunk when using sourcemaps
    // But we need only the entry file
    var entry = chunkFiles[0];
    assets.chunks[chunk].entry = entry;
    assets.js.push(entry);

    // Gather all css files
    var css = chunkFiles.filter(function(chunkFile){
      return path.extname(chunkFile) === '.css';
    });
    assets.chunks[chunk].css = css;
    assets.css = assets.css.concat(css);
  }

  return assets;
};

module.exports = HtmlWebpackPlugin;
