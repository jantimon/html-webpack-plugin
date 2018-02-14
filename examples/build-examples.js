/**
 * This file is just a helper to compile all examples.
 *
 * You could do the same by going into each example and execute
 * `webpack`
 */
var webpackMajorVersion = require('webpack/package.json').version.split('.')[0];

var fs = require('fs');
var path = require('path');
var rimraf = require('rimraf');
var webpack = require('webpack');
var ExtractTextPlugin = require('extract-text-webpack-plugin');

if (Number(webpackMajorVersion) > 1) {
  var extractOriginal = ExtractTextPlugin.extract;
  ExtractTextPlugin.extract = function (fallback, use) {
    return extractOriginal({
      fallback: fallback,
      use: use
    });
  };
}

var examples = fs.readdirSync(__dirname).filter(function (file) {
  return fs.statSync(path.join(__dirname, file)).isDirectory();
});

examples.forEach(function (exampleName) {
  var examplePath = path.join(__dirname, exampleName);
  var configFile = path.join(examplePath, 'webpack.config.js');

  var config = require(configFile);
  if (webpackMajorVersion === '4') {
    config.plugins.unshift(new webpack.LoaderOptionsPlugin({
      options: {
        context: process.cwd() // or the same value as `context`
      }
    }));
    config.mode = 'production';
    config.optimization = { minimizer: [] };
    if (config.module && config.module.loaders) {
      config.module.rules = config.module.loaders;
      delete config.module.loaders;
    }
  }

  rimraf.sync(path.join(examplePath, 'dist', 'webpack-' + webpackMajorVersion));
  webpack(config, function (err, stats) {
    if (err) {
      console.error(err.stack || err);
      if (err.details) {
        console.error(err.details);
      }
      return;
    }

    const info = stats.toJson();

    if (stats.hasErrors()) {
      console.error(info.errors);
    }

    if (stats.hasWarnings()) {
      console.warn(info.warnings);
    }
  });
});
