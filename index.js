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

    var templateFile = self.options.template;
    if (!templateFile) {
      templateFile = path.join(__dirname, 'default_index.html');
    }

    var htmlTemplateContent = fs.readFileSync(templateFile, 'utf8');
    var html = tmpl(htmlTemplateContent, templateParams);
    var outputPath = path.join(compiler.options.output.path, 'index.html');
    compiler.assets['index.html'] = {
      source: function() {
        return html;
      },
      size: function() {
        return html.length;
      }
    };
    callback();
  });
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
