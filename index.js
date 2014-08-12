var fs = require('fs');
var path = require('path');
var tmpl = require('blueimp-tmpl').tmpl;

function HtmlWebpackPlugin(options) {
  this.options = options || {};
}

HtmlWebpackPlugin.prototype.apply = function(compiler) {
  var self = this;
  compiler.plugin('done', function(stats) {
    var webpackStatsJson = stats.toJson();
    var templateParams = {};
    templateParams.webpack = webpackStatsJson;
    templateParams.htmlWebpackPlugin = self.htmlWebpackPluginJson(webpackStatsJson);

    var templateFile = self.options.template;
    if (!templateFile) {
      templateFile = path.join(__dirname, 'default_index.html');
    }
    var htmlTemplateContent = fs.readFileSync(templateFile, 'utf8');
    fs.writeFileSync(path.join(compiler.options.output.path, 'index.html'), tmpl(htmlTemplateContent, templateParams));
  });
};

HtmlWebpackPlugin.prototype.htmlWebpackPluginJson = function(webpackStatsJson) {
  var json = {};
  json.assets = {};
  for (var chunk in webpackStatsJson.assetsByChunkName) {
    json.assets[chunk] = webpackStatsJson.assetsByChunkName[chunk];
  }

  return json;
};

module.exports = HtmlWebpackPlugin;
