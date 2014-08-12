var fs = require('fs');
var path = require('path');
var tmpl = require('blueimp-tmpl').tmpl;

function HtmlWebpackPlugin() {
}

HtmlWebpackPlugin.prototype.htmlWebpackPluginJson = function(webpackStatsJson) {
  json = {};
  json.assets = {};
  for (var chunk in webpackStatsJson.assetsByChunkName) {
    json.assets[chunk] = webpackStatsJson.assetsByChunkName[chunk];
  }
  return json;
};

HtmlWebpackPlugin.prototype.apply = function(compiler) {
  var self = this;
  compiler.plugin('done', function(stats) {
    var webpackStatsJson = stats.toJson();
    var templateParams = {};
    templateParams.webpack = webpackStatsJson;
    templateParams.htmlWebpackPlugin = self.htmlWebpackPluginJson(webpackStatsJson);

    var htmlTemplate = fs.readFileSync(path.join(__dirname, 'default_index.html'), 'utf8');
    fs.writeFileSync(path.join(compiler.options.output.path, 'index.html'), tmpl(htmlTemplate, templateParams));
  });
};

module.exports = HtmlWebpackPlugin;
