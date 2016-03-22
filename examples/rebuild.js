/**
 * This file is just a helper to compile all examples.
 *
 * You could do the same by going into each example and execute
 * `webpack`
 */

var webpackMajorVersion = require('webpack/package.json').version.split('.')[0];

var fs = require('fs');
var path = require('path');
var execSync = require('child_process').execSync;
var rm_rf = require('rimraf');
var webpackBin = path.resolve(__dirname, '..', 'node_modules', '.bin', 'webpack');

var examples = fs.readdirSync(__dirname).filter(function (file) {
  return fs.statSync(path.join(__dirname, file)).isDirectory();
});

examples.forEach(function (exampleName) {
  var examplePath = path.join(__dirname, exampleName);
  var configFile = path.join(examplePath, 'webpack.config.js');
  rm_rf.sync(path.join(examplePath, 'dist', 'webpack-' + webpackMajorVersion));
  execSync(webpackBin + ' --context "' + examplePath + '" --config "' + configFile + '"');
});
