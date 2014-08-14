var fs = require('fs');
var path = require('path');
var tmpl = require('blueimp-tmpl').tmpl;

function HtmlWebpackPlugin(options) {
  this.options = options || {};
}

HtmlWebpackPlugin.prototype.apply = function(compiler) {
  var self = this;
  compiler.plugin('emit', function(compiler, callback) {
    var webpackStatsJson = compiler.getStats().toJson();
    var templateParams = {};
    templateParams.webpack = webpackStatsJson;
    templateParams.htmlWebpackPlugin = {};
    templateParams.htmlWebpackPlugin.assets = self.htmlWebpackPluginAssets(compiler, webpackStatsJson);
    templateParams.htmlWebpackPlugin.options = self.options;

    var outputFilename = self.options.filename || 'index.html';

    if (self.options.templateContent && self.options.template) {
      compiler.errors.push(new Error('HtmlWebpackPlugin: cannot specify both template and templateContent options'));
      callback();
    } else if (self.options.templateContent) {
      self.emitHtml(compiler, self.options.templateContent, templateParams, outputFilename);
      callback();
    } else {
      var templateFile = self.options.template;
      if (!templateFile) {
        templateFile = path.join(__dirname, 'default_index.html');
      }

      fs.readFile(templateFile, 'utf8', function(err, htmlTemplateContent) {
        if (err) {
          compiler.errors.push(new Error('HtmlWebpackPlugin: Unable to read HTML template "' + templateFile + '"'));
        } else {
          self.emitHtml(compiler, htmlTemplateContent, templateParams, outputFilename);
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

HtmlWebpackPlugin.prototype.htmlWebpackPluginAssets = function(compiler, webpackStatsJson) {
  var assets = {};
  for (var chunk in webpackStatsJson.assetsByChunkName) {
    var chunkValue = webpackStatsJson.assetsByChunkName[chunk];

    // Webpack outputs an array for each chunk when using sourcemaps
    if (chunkValue instanceof Array) {
      // Is the main bundle always the first element?
      chunkValue = chunkValue[0];
    }

    if (compiler.options.output.publicPath) {
      chunkValue = compiler.options.output.publicPath + chunkValue;
    }
    assets[chunk] = chunkValue;
  }

  return assets;
};

module.exports = HtmlWebpackPlugin;
