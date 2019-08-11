/*
 * Integration tests for caching
 */

/* eslint-env jest */
'use strict';

const path = require('path');
const webpack = require('webpack');
const rimraf = require('rimraf');
const WebpackRecompilationSimulator = require('webpack-recompilation-simulator');
const HtmlWebpackPlugin = require('../index.js');

const OUTPUT_DIR = path.join(__dirname, '../dist/caching-spec');

jest.setTimeout(30000);
process.on('unhandledRejection', r => console.log(r));
process.traceDeprecation = true;

function setUpCompiler (htmlWebpackPlugin) {
  jest.spyOn(htmlWebpackPlugin, 'evaluateCompilationResult');
  const webpackConfig = {
    stats: { all: true },
    // Caching works only in development
    mode: 'development',
    entry: path.join(__dirname, 'fixtures/index.js'),
    module: {
      rules: [
        {
          test: /\.html$/,
          loader: require.resolve('../lib/loader.js'),
          options: {
            force: true
          }
        }
      ]
    },
    output: {
      path: OUTPUT_DIR,
      filename: 'index_bundle.js'
    },
    plugins: Array.from(arguments)
  };
  const compiler = new WebpackRecompilationSimulator(webpack(webpackConfig));
  return compiler;
}

function getCompiledModules (statsJson) {
  const builtModules = statsJson.modules.filter(webpackModule => webpackModule.built).map((webpackModule) => {
    return module.userRequest;
  });
  statsJson.children.forEach((childCompilationStats) => {
    const builtChildModules = getCompiledModules(childCompilationStats);
    Array.prototype.push.apply(builtModules, builtChildModules);
  });
  return builtModules;
}

function getCompiledModuleCount (statsJson) {
  return getCompiledModules(statsJson).length;
}

function expectNoErrors (stats) {
  const errors = {
    main: stats.compilation.errors,
    childCompilation: []
  };
  stats.compilation.children.forEach((child) => {
    Array.prototype.push.apply(errors.childCompilation, child.errors);
  });
  if (errors.main.length) {
    errors.main.forEach((error) => {
      console.log('Error => ', error);
    });
    console.dir(stats.toJson({ errorDetails: true, moduleTrace: true }), { depth: 5 });
  }
  expect(errors.main).toEqual([]);
  expect(errors.childCompilation).toEqual([]);
}

describe('HtmlWebpackPluginCaching', () => {
  beforeEach(done => {
    rimraf(OUTPUT_DIR, done);
  });

  it('should compile nothing if no file was changed', done => {
    const template = path.join(__dirname, 'fixtures/plain.html');
    const htmlWebpackPlugin = new HtmlWebpackPlugin({
      template: template
    });
    let childCompilerHash;
    const compiler = setUpCompiler(htmlWebpackPlugin);
    compiler.addTestFile(path.join(__dirname, 'fixtures/index.js'));
    compiler.run()
      // Change the template file and compile again
      .then(() => {
        childCompilerHash = htmlWebpackPlugin.childCompilerHash;
        return compiler.run();
      })
      .then(stats => {
        // Expect no errors:
        expectNoErrors(stats);
        // Verify that no file was built
        expect(getCompiledModules(stats.toJson()))
          .toEqual([]);
        // Verify that the html was processed only during the inital build
        expect(htmlWebpackPlugin.evaluateCompilationResult.mock.calls.length)
          .toBe(1);
        // Verify that the child compilation was executed twice
        expect(htmlWebpackPlugin.childCompilerHash)
          .toBe(childCompilerHash);
      })
      .then(done);
  });

  it('should not compile the webpack html file if only a javascript file was changed', done => {
    const htmlWebpackPlugin = new HtmlWebpackPlugin();
    const compiler = setUpCompiler(htmlWebpackPlugin);
    let childCompilerHash;
    compiler.addTestFile(path.join(__dirname, 'fixtures/index.js'));
    compiler.run()
      // Change a js file and compile again
      .then(() => {
        childCompilerHash = htmlWebpackPlugin.childCompilerHash;
        compiler.simulateFileChange(path.join(__dirname, 'fixtures/index.js'), { footer: '//1' });
        return compiler.run();
      })
      .then(stats => {
        // Expect no errors:
        expectNoErrors(stats);
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

  it('should compile the webpack html file even if only a javascript file was changed if caching is disabled', done => {
    const htmlWebpackPlugin = new HtmlWebpackPlugin({
      cache: false
    });
    let childCompilerHash;
    const compiler = setUpCompiler(htmlWebpackPlugin);
    compiler.addTestFile(path.join(__dirname, 'fixtures/index.js'));
    compiler.run()
      // Change a js file and compile again
      .then(() => {
        childCompilerHash = htmlWebpackPlugin.childCompilerHash;
        compiler.simulateFileChange(path.join(__dirname, 'fixtures/index.js'), { footer: '//1' });
        return compiler.run();
      })
      .then(stats => {
        // Expect no errors:
        expectNoErrors(stats);
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

  it('should compile the webpack html if the template file was changed', done => {
    const template = path.join(__dirname, 'fixtures/plain.html');
    const htmlWebpackPlugin = new HtmlWebpackPlugin({
      template: template
    });
    let childCompilerHash;
    const compiler = setUpCompiler(htmlWebpackPlugin);
    compiler.addTestFile(template);
    compiler.run()
      // Change the template file and compile again
      .then(() => {
        childCompilerHash = htmlWebpackPlugin.childCompilerHash;
        compiler.simulateFileChange(template, { footer: '<!-- 1 -->' });
        return compiler.run();
      })
      .then(stats => {
        // Expect no errors:
        expectNoErrors(stats);
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

  it('should not slow down linear (10 plugins should not take twice as much time as a 1 plugin)', done => {
    const template = path.join(__dirname, 'fixtures/plain.html');
    const createHtmlWebpackPlugin = () => new HtmlWebpackPlugin({
      template: template
    });
    let singlePluginCompileStart;
    let singleCompileRunDuration;
    let multiPluginComileStart;
    let multiCompileRunDuration;

    let singleCompiler = setUpCompiler(createHtmlWebpackPlugin());
    let multiCompiler = setUpCompiler.apply(null, Array(10).fill(0).map(() => createHtmlWebpackPlugin()));

    Promise.resolve()
      .then(function singleCompileRun () {
        singlePluginCompileStart = process.hrtime();
        return singleCompiler.run()
          // Change the template file and compile again
          .then(() => {
            singleCompileRunDuration = process.hrtime(singlePluginCompileStart);
          });
      })
      .then(function multiCompileRun () {
        multiPluginComileStart = process.hrtime();
        return multiCompiler.run()
          // Change the template file and compile again
          .then(() => {
            multiCompileRunDuration = process.hrtime(multiPluginComileStart);
          });
      }).then(function meassureTime () {
        const singleCompileRunDurationInNs = singleCompileRunDuration[0] * 1e9 + singleCompileRunDuration[1];
        const multiCompileRunDurationInNs = multiCompileRunDuration[0] * 1e9 + multiCompileRunDuration[1];
        const speedComarision = multiCompileRunDurationInNs / singleCompileRunDurationInNs * 100;

        expect(speedComarision).toBeLessThan(200);
        done();
      });
  });

  it('should keep watching the webpack html if only a js file was changed', done => {
    const template = path.join(__dirname, 'fixtures/plain.html');
    const jsFile = path.join(__dirname, 'fixtures/index.js');
    const htmlWebpackPlugin = new HtmlWebpackPlugin({
      template: template
    });
    const compiler = setUpCompiler(htmlWebpackPlugin);
    compiler.addTestFile(template);
    compiler.addTestFile(jsFile);
    // Build the template file for the first time
    compiler.startWatching()
      // Change the template file (second build)
      .then(() => {
        compiler.simulateFileChange(template, { footer: '<!-- 1 -->' });
        return compiler.waitForWatchRunComplete();
      })
      // Change js
      .then(() => {
        compiler.simulateFileChange(jsFile, { footer: '// 1' });
        return compiler.waitForWatchRunComplete();
      })
      // Change js
      .then(() => {
        compiler.simulateFileChange(jsFile, { footer: '// 2' });
        return compiler.waitForWatchRunComplete();
      })
      // Change js
      .then(() => {
        compiler.simulateFileChange(jsFile, { footer: '// 3' });
        return compiler.waitForWatchRunComplete();
      })
      // Change the template file (third build)
      .then(() => {
        compiler.simulateFileChange(template, { footer: '<!-- 2 -->' });
        return compiler.waitForWatchRunComplete();
      })
      .then(() => {
        // Verify that the html was processed trice
        expect(htmlWebpackPlugin.evaluateCompilationResult.mock.calls.length)
          .toBe(3);
      })
      .then(() => compiler.stopWatching())
      .then(done);
  });
});
