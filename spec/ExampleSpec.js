/*
 * These integration tests compile all cases from the example folder
 * and matches them against their dist folder
 */

 /* eslint-env jasmine */
'use strict';

// Workaround for css-loader issue
// https://github.com/webpack/css-loader/issues/144
if (!global.Promise) {
  require('es6-promise').polyfill();
}

var path = require('path');
var webpack = require('webpack');
var rm_rf = require('rimraf');
var fs = require('fs');
var webpackMajorVersion = require('webpack/package.json').version.split('.')[0];

var OUTPUT_DIR = path.join(__dirname, '../dist');

jasmine.getEnv().defaultTimeoutInterval = 5000;

function runExample (exampleName, done) {
  var examplePath = path.resolve(__dirname, '..', 'examples', exampleName);
  var exampleOutput = path.join(OUTPUT_DIR, exampleName);
  var fixturePath = path.join(examplePath, 'dist', 'webpack-' + webpackMajorVersion);
  // Clear old results
  rm_rf(exampleOutput, function () {
    var options = require(path.join(examplePath, 'webpack.config.js'));
    options.context = examplePath;
    options.output.path = exampleOutput;
    webpack(options, function (err) {
      var dircompare = require('dir-compare');
      var res = dircompare.compareSync(fixturePath, exampleOutput, {compareSize: true});

      res.diffSet.filter(function (diff) {
        return diff.state === 'distinct';
      }).forEach(function (diff) {
        expect(fs.readFileSync(path.join(diff.path1, diff.name1)).toString())
          .toBe(fs.readFileSync(path.join(diff.path2, diff.name2)).toString());
      });

      expect(err).toBeFalsy();
      expect(res.same).toBe(true);
      done();
    });
  });
}

describe('HtmlWebpackPlugin Examples', function () {
  it('appcache example', function (done) {
    runExample('appcache', done);
  });

  it('custom-template example', function (done) {
    runExample('custom-template', done);
  });

  it('default example', function (done) {
    runExample('default', done);
  });

  it('favicon example', function (done) {
    runExample('favicon', done);
  });

  it('html-loader example', function (done) {
    runExample('html-loader', done);
  });

  it('jade-loader example', function (done) {
    runExample('jade-loader', done);
  });

  it('javascript example', function (done) {
    runExample('javascript', done);
  });

  it('javascript-advanced example', function (done) {
    runExample('javascript-advanced', done);
  });
});
