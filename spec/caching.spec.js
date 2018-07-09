/*
 * Integration tests for caching
 */

/* eslint-env jest */
'use strict';

var path = require('path');
var webpack = require('webpack');
var rimraf = require('rimraf');
var WebpackRecompilationSimulator = require('webpack-recompilation-simulator');
var HtmlWebpackPlugin = require('../index.js');
var webpackMajorVersion = require('webpack/package.json').version.split('.')[0];

var OUTPUT_DIR = path.join(__dirname, '../dist/caching-spec');

jest.setTimeout(30000);
process.on('unhandledRejection', r => console.log(r));

function setUpCompiler (htmlWebpackPlugin) {
  jest.spyOn(htmlWebpackPlugin, 'evaluateCompilationResult');
  var webpackConfig = {
    entry: path.join(__dirname, 'fixtures/index.js'),
    output: {
      path: OUTPUT_DIR,
      filename: 'index_bundle.js'
    },
    plugins: [htmlWebpackPlugin]
  };
  if (Number(webpackMajorVersion) >= 4) {
    webpackConfig.mode = 'development';
  }
  var compiler = new WebpackRecompilationSimulator(webpack(webpackConfig));
  return compiler;
}

function getCompiledModuleCount (statsJson) {
  return statsJson.modules.filter(function (webpackModule) {
    return webpackModule.built;
  }).length + statsJson.children.reduce(function (sum, childCompilationStats) {
    return sum + getCompiledModuleCount(childCompilationStats);
  }, 0);
}

describe('HtmlWebpackPluginCaching', function () {
  beforeEach(function (done) {
    rimraf(OUTPUT_DIR, done);
  });

  it('should compile nothing if no file was changed', function (done) {
    var template = path.join(__dirname, 'fixtures/plain.html');
    var htmlWebpackPlugin = new HtmlWebpackPlugin({
      template: template
    });
    var childCompilerHash;
    var compiler = setUpCompiler(htmlWebpackPlugin);
    compiler.run()
      // Change the template file and compile again
      .then(function () {
        childCompilerHash = htmlWebpackPlugin.childCompilerHash;
        return compiler.run();
      })
      .then(function (stats) {
        // Verify that no file was built
        expect(getCompiledModuleCount(stats.toJson()))
          .toBe(0);
        // Verify that the html was processed only during the inital build
        expect(htmlWebpackPlugin.evaluateCompilationResult.mock.calls.length)
          .toBe(1);
        // Verify that the child compilation was executed twice
        expect(htmlWebpackPlugin.childCompilerHash)
          .toBe(childCompilerHash);
      })
      .then(done);
  });

  it('should not compile the webpack html file if only a javascript file was changed', function (done) {
    var htmlWebpackPlugin = new HtmlWebpackPlugin();
    var compiler = setUpCompiler(htmlWebpackPlugin);
    var childCompilerHash;
    compiler.run()
      // Change a js file and compile again
      .then(function () {
        childCompilerHash = htmlWebpackPlugin.childCompilerHash;
        compiler.simulateFileChange(path.join(__dirname, 'fixtures/index.js'), {footer: '//1'});
        return compiler.run();
      })
      .then(function (stats) {
        // Verify that only one file was built
        expect(getCompiledModuleCount(stats.toJson()))
          .toBe(1);
        // Verify that the html was processed only during the inital build
        expect(htmlWebpackPlugin.evaluateCompilationResult.mock.calls.length)
          .toBe(1);
        // Verify that the child compilation was executed only once
        expect(htmlWebpackPlugin.childCompilerHash)
          .toBe(childCompilerHash);
      })
      .then(done);
  });

  it('should compile the webpack html file even if only a javascript file was changed if caching is disabled', function (done) {
    var htmlWebpackPlugin = new HtmlWebpackPlugin({
      cache: false
    });
    var childCompilerHash;
    var compiler = setUpCompiler(htmlWebpackPlugin);
    compiler.run()
      // Change a js file and compile again
      .then(function () {
        childCompilerHash = htmlWebpackPlugin.childCompilerHash;
        compiler.simulateFileChange(path.join(__dirname, 'fixtures/index.js'), {footer: '//1'});
        return compiler.run();
      })
      .then(function (stats) {
        // Verify that only one file was built
        expect(getCompiledModuleCount(stats.toJson()))
          .toBe(1);
        // Verify that the html was processed on every run
        expect(htmlWebpackPlugin.evaluateCompilationResult.mock.calls.length)
          .toBe(2);
        // Verify that the child compilation was executed only once
        expect(htmlWebpackPlugin.childCompilerHash)
          .toBe(childCompilerHash);
      })
      .then(done);
  });

  it('should compile the webpack html if the template file was changed', function (done) {
    var template = path.join(__dirname, 'fixtures/plain.html');
    var htmlWebpackPlugin = new HtmlWebpackPlugin({
      template: template
    });
    var childCompilerHash;
    var compiler = setUpCompiler(htmlWebpackPlugin);
    compiler.run()
      // Change the template file and compile again
      .then(function () {
        childCompilerHash = htmlWebpackPlugin.childCompilerHash;
        compiler.simulateFileChange(template, {footer: '<!-- 1 -->'});
        return compiler.run();
      })
      .then(function (stats) {
        // Verify that only one file was built
        expect(getCompiledModuleCount(stats.toJson()))
          .toBe(1);
        // Verify that the html was processed twice
        expect(htmlWebpackPlugin.evaluateCompilationResult.mock.calls.length)
          .toBe(2);
        // Verify that the child compilation was executed twice
        expect(htmlWebpackPlugin.childCompilerHash)
          .not.toBe(childCompilerHash);
      })
      .then(done);
  });
});
