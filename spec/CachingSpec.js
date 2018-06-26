/*
 * Integration tests for caching
 */

/* eslint-env jasmine */
'use strict';

var path = require('path');
var webpack = require('webpack');
var rimraf = require('rimraf');
var WebpackRecompilationSimulator = require('webpack-recompilation-simulator');
var HtmlWebpackPlugin = require('../index.js');
var webpackMajorVersion = require('webpack/package.json').version.split('.')[0];

var OUTPUT_DIR = path.join(__dirname, '../dist');

jasmine.getEnv().defaultTimeoutInterval = 30000;

/* TEMPORARY SAMPLE
 * This is a sample of how WebpackRecompilationSimulator could be modified
 * to work properly with the filestamp based cache check
 * ==================== SNIP ==================== */
const tempfs = require('temp-fs');
const fs = require('fs');

class TempWebpackRecompilationSimulator extends WebpackRecompilationSimulator {
  /**
   * Creates a temporary file with the content of a base file
   * @param {string} baseFile
   * returns path to temporary file
   */
  static createTempFile (baseFile) {
    baseFile = path.resolve(baseFile);
    /* NOTE: the temporary file must have the same relative path to dependencies
     * as the base file or the tests fail due to resolve problems.
     * Alternatively, we may be able to set the 'context' attribute in webpackConfig
     * and put the temp files back in '/tmp'.
     * Ex.
     * baseFile = '/path/to/html-webpack-plugin/spec/fixtures/plain.html
     * tempFile = '/path/to/html-webpack-plugin/spec/tmp-10098cILzFzZxr4W0/plain.html
     */
    const tempDir = tempfs.mkdirSync({
      dir: path.dirname(baseFile) + '/..',
      track: true,
      recursive: true
    });
    const tempFile = path.join(tempDir.path, path.basename(baseFile));
    const content = fs.readFileSync(baseFile).toString();
    fs.writeFileSync(tempFile, content);
    return tempFile;
  }
  simulateFileChange (file, options) {
    // This is largely the same, except addMapping() is not called
    file = path.resolve(file);
    const originalFileContent = fs.readFileSync(file).toString();
    const banner = options.banner || '';
    const footer = options.footer || '';
    let content = options.content;
    if (content === undefined) {
      content = banner + originalFileContent + footer;
    }
    if (content === originalFileContent) {
      throw new Error('File was not changed');
    }
    fs.writeFileSync(file, content);
  }
}
/* ==================== /SNIP =================== */

function setUpCompiler (htmlWebpackPlugin) {
  spyOn(htmlWebpackPlugin, 'evaluateCompilationResult').and.callThrough();
  var webpackConfig = {
    // Caching works only in development
    mode: 'development',
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
  let compiler = new TempWebpackRecompilationSimulator(webpack(webpackConfig));
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
    const template = path.join(__dirname, 'fixtures/plain.html');
    const tempTemplate = TempWebpackRecompilationSimulator.createTempFile(template);
    var htmlWebpackPlugin = new HtmlWebpackPlugin({
      template: tempTemplate
    });
    var childCompilerHash;
    var compiler = setUpCompiler(htmlWebpackPlugin);
    // compiler.addMapping(template, tempTemplate);
    compiler.addTestFile(path.join(__dirname, 'fixtures/index.js'));
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
        expect(htmlWebpackPlugin.evaluateCompilationResult.calls.count())
          .toBe(1);
        // Verify that the child compilation was executed twice
        expect(htmlWebpackPlugin.childCompilerHash)
          .toBe(childCompilerHash);
      })
      .then(done);
  });

  it('should not compile the webpack html file if only a javascript file was changed', function (done) {
    const jsFile = path.join(__dirname, 'fixtures/index.js');
    const tempJsFile = TempWebpackRecompilationSimulator.createTempFile(jsFile);
    var htmlWebpackPlugin = new HtmlWebpackPlugin();
    var compiler = setUpCompiler(htmlWebpackPlugin);
    compiler.addMapping(jsFile, tempJsFile);
    var childCompilerHash;
    compiler.addTestFile(path.join(__dirname, 'fixtures/index.js'));
    compiler.run()
      // Change a js file and compile again
      .then(function () {
        childCompilerHash = htmlWebpackPlugin.childCompilerHash;
        compiler.simulateFileChange(tempJsFile, {footer: '// 1'});
        return compiler.run();
      })
      .then(function (stats) {
        // Verify that only one file was built
        expect(getCompiledModuleCount(stats.toJson()))
          .toBe(1);
        // Verify that the html was processed only during the inital build
        expect(htmlWebpackPlugin.evaluateCompilationResult.calls.count())
          .toBe(1);
        // Verify that the child compilation was executed only once
        expect(htmlWebpackPlugin.childCompilerHash)
          .toBe(childCompilerHash);
      })
      .then(done);
  });

  it('should compile the webpack html file even if only a javascript file was changed if caching is disabled', function (done) {
    const jsFile = path.join(__dirname, 'fixtures/index.js');
    const tempJsFile = TempWebpackRecompilationSimulator.createTempFile(jsFile);
    var htmlWebpackPlugin = new HtmlWebpackPlugin({
      cache: false
    });
    var childCompilerHash;
    var compiler = setUpCompiler(htmlWebpackPlugin);
    // compiler.addMapping(jsFile, tempJsFile);
    compiler.addTestFile(path.join(__dirname, 'fixtures/index.js'));
    compiler.run()
      // Change a js file and compile again
      .then(function () {
        childCompilerHash = htmlWebpackPlugin.childCompilerHash;
        compiler.simulateFileChange(tempJsFile, {footer: '// 1'});
        return compiler.run();
      })
      .then(function (stats) {
        // Verify that only one file was built
        expect(getCompiledModuleCount(stats.toJson()))
          .toBe(1);
        // Verify that the html was processed on every run
        expect(htmlWebpackPlugin.evaluateCompilationResult.calls.count())
          .toBe(2);
        // Verify that the child compilation was executed only once
        expect(htmlWebpackPlugin.childCompilerHash)
          .toBe(childCompilerHash);
      })
      .then(done);
  });

  it('should compile the webpack html if the template file was changed', function (done) {
    const template = path.join(__dirname, 'fixtures/plain.html');
    const tempTemplate = TempWebpackRecompilationSimulator.createTempFile(template);
    var htmlWebpackPlugin = new HtmlWebpackPlugin({
      template: tempTemplate
    });
    var childCompilerHash;
    var compiler = setUpCompiler(htmlWebpackPlugin);
    // compiler.addMapping(template, tempTemplate);
    // compiler.simulateFileChange(tempTemplate, {footer: '<!-- 0 -->'});
    compiler.addTestFile(template);
    compiler.run()
      // Change the template file and compile again
      .then(function () {
        childCompilerHash = htmlWebpackPlugin.childCompilerHash;
        compiler.simulateFileChange(tempTemplate, {footer: '<!-- 1 -->'});
        return compiler.run();
      })
      .then(function (stats) {
        // Verify that only one file was built
        expect(getCompiledModuleCount(stats.toJson()))
          .toBe(1);
        // Verify that the html was processed twice
        expect(htmlWebpackPlugin.evaluateCompilationResult.calls.count())
          .toBe(2);
        // Verify that the child compilation was executed twice
        expect(htmlWebpackPlugin.childCompilerHash)
          .not.toBe(childCompilerHash);
      })
      .then(done);
  });

  it('should keep watching the webpack html if only a js file was changed', function (done) {
      /*
    const template = path.join(__dirname, 'fixtures/plain.html');
    const jsFile = path.join(__dirname, 'fixtures/index.js');
    const tempTemplate = TempWebpackRecompilationSimulator.createTempFile(template);
    const tempJsFile = TempWebpackRecompilationSimulator.createTempFile(jsFile);
    var htmlWebpackPlugin = new HtmlWebpackPlugin({
      template: tempTemplate
    });
    var compiler = setUpCompiler(htmlWebpackPlugin);
    compiler.simulateFileChange(tempTemplate, {footer: ' '});
    compiler.simulateFileChange(tempJsFile, {footer: ' '});
    */
    var template = path.join(__dirname, 'fixtures/plain.html');
    const jsFile = path.join(__dirname, 'fixtures/index.js');
    var htmlWebpackPlugin = new HtmlWebpackPlugin({
      template: template
    });
    var compiler = setUpCompiler(htmlWebpackPlugin);
    compiler.addTestFile(template);
    compiler.addTestFile(jsFile);
    // Build the template file for the first time
    compiler.run()
      // Change the template file (second build)
      .then(() => {
        // compiler.simulateFileChange(tempTemplate, {footer: '<!-- 1 -->'});
        compiler.simulateFileChange(template, {footer: '<!-- 1 -->'});
        return compiler.run();
      })
      // Change js
      .then(() => {
        // compiler.simulateFileChange(tempJsFile, {footer: '// 1'});
        compiler.simulateFileChange(jsFile, {footer: '// 1'});
        return compiler.run();
      })
      // Change js
      .then(() => {
        // compiler.simulateFileChange(tempJsFile, {footer: '// 2'});
        compiler.simulateFileChange(jsFile, {footer: '// 2'});
        return compiler.run();
      })
      // Change js
      .then(() => {
        // compiler.simulateFileChange(tempJsFile, {footer: '// 3'});
        compiler.simulateFileChange(jsFile, {footer: '// 3'});
        return compiler.run();
      })
      // Change the template file (third build)
      .then(() => {
        // compiler.simulateFileChange(tempTemplate, {footer: '<!-- 2 -->'});
        compiler.simulateFileChange(template, {footer: '<!-- 2 -->'});
        return compiler.run();
      })
      .then(() => {
        // Verify that the html was processed trice
        expect(htmlWebpackPlugin.evaluateCompilationResult.calls.count())
          .toBe(3);
      })
      .then(done);
  });
});
