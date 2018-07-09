/*
 * These integration tests compile all cases from the example folder
 * and matches them against their dist folder
 */

/* eslint-env jest */
'use strict';

var path = require('path');
var webpack = require('webpack');
var rimraf = require('rimraf');
var fs = require('fs');
var webpackMajorVersion = require('webpack/package.json').version.split('.')[0];

var OUTPUT_DIR = path.resolve(__dirname, '../dist');

jest.setTimeout(30000);

function runExample (exampleName, done) {
  var examplePath = path.resolve(__dirname, '..', 'examples', exampleName);
  var exampleOutput = path.join(OUTPUT_DIR, exampleName);
  var fixturePath = path.resolve(examplePath, 'dist', 'webpack-' + webpackMajorVersion);
  // Clear old results
  rimraf(exampleOutput, function () {
    var options = require(path.join(examplePath, 'webpack.config.js'));
    options.context = examplePath;
    options.output.path = exampleOutput + path.sep;
    if (Number(webpackMajorVersion) >= 4) {
      options.plugins.unshift(new webpack.LoaderOptionsPlugin({
        options: {
          context: process.cwd() // or the same value as `context`
        }
      }));
      if (options.module && options.module.loaders) {
        options.module.rules = options.module.loaders;
        delete options.module.loaders;
      }
      options.mode = 'production';
      options.optimization = { minimizer: [] };
    }

    webpack(options, function (err, stats) {
      expect(err).toBeFalsy();
      expect(stats.compilation.errors).toEqual([]);

      var dircompare = require('dir-compare');
      var res = dircompare.compareSync(fixturePath, exampleOutput, {compareSize: true});

      res.diffSet.filter(function (diff) {
        return diff.state === 'distinct';
      }).forEach(function (diff) {
        var file1Contents = fs.readFileSync(path.join(diff.path1, diff.name1)).toString();
        var file2Contents = fs.readFileSync(path.join(diff.path2, diff.name2)).toString();
        expect(file1Contents).toEqual(file2Contents);
      });

      expect(res.same).toBe(true);
      rimraf(exampleOutput, done);
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

  it('inline example', function (done) {
    runExample('inline', done);
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

  it('sort manually example', function (done) {
    runExample('sort-manually', done);
  });

  it('template-parameters example', function (done) {
    runExample('template-parameters', done);
  });
});
