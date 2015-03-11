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

HtmlWebpackPlugin.prototype.emitHtml = function(compiler, htmlTemplateContent, templateParams, outputFilename) {
  var html = tmpl(htmlTemplateContent, templateParams);
  compiler.assets[outputFilename] = {
    source: function() {
      return html;
    },
    size: function() {
      return html.length;
    }
  };
};


HtmlWebpackPlugin.prototype.htmlWebpackPluginAssets = function(compilation, webpackStatsJson) {
  var assets = {};
  for (var chunk in webpackStatsJson.assetsByChunkName) {
    var chunkValue = webpackStatsJson.assetsByChunkName[chunk];

    // Webpack outputs an array for each chunk when using sourcemaps
    if (chunkValue instanceof Array) {
      // Is the main bundle always the first element?
      chunkValue = chunkValue[0];
    }

    if (compilation.options.output.publicPath) {
      chunkValue = compilation.options.output.publicPath + chunkValue;
    }
    assets[chunk] = chunkValue;
  }

  return assets;
};

module.exports = HtmlWebpackPlugin;
