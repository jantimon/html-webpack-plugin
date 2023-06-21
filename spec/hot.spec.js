/*
 * Integration tests for caching
 */

/* eslint-env jest */
'use strict';

const path = require('path');
const fs = require('fs');
const webpack = require('webpack');
const rimraf = require('rimraf');
const WebpackRecompilationSimulator = require('webpack-recompilation-simulator');
const HtmlWebpackPlugin = require('../index.js');

const OUTPUT_DIR = path.join(__dirname, '../dist/caching-spec');

// The WebpackRecompilationSimulator uses a loader to redirect the file writes to a temp directory.
// As this would disable the default loader behaviour by design it has to be run in force mode
const DEFAULT_LOADER = require.resolve('../lib/loader.js') + '?force';
const DEFAULT_TEMPLATE = DEFAULT_LOADER + '!' + require.resolve('../default_index.ejs');

jest.setTimeout(30000);

process.on('unhandledRejection', r => console.log(r));

describe('HtmlWebpackPluginHMR', () => {
  beforeEach(done => {
    rimraf(OUTPUT_DIR, done);
  });

  it('should not cause errors for the main compilation if hot-reload is active', () => {
    const config = {
      mode: 'development',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR
      },
      plugins: [
        new webpack.HotModuleReplacementPlugin(),
        new HtmlWebpackPlugin({ template: DEFAULT_TEMPLATE })
      ]
    };
    const compiler = new WebpackRecompilationSimulator(webpack(config));
    const jsFileTempPath = compiler.addTestFile(path.join(__dirname, 'fixtures/index.js'));
    fs.writeFileSync(jsFileTempPath, 'module.exports = function calc(a, b){ return a + b };');
    return compiler.startWatching()
      // Change the template file and compile again
      .then(() => {
        fs.writeFileSync(jsFileTempPath, 'module.exports = function calc(a, b){ return a - b };');
        return compiler.waitForWatchRunComplete();
      })
      .then(stats => {
        expect(stats.compilation.errors).toEqual([]);
      })
      .then(() => compiler.stopWatching());
  });

  it('should not cause missing hot-reloaded code of the main compilation', () => {
    const config = {
      mode: 'development',
      entry: path.join(__dirname, 'fixtures/index.js'),
      target: 'node',
      output: {
        path: OUTPUT_DIR
      },
      plugins: [
        new webpack.HotModuleReplacementPlugin(),
        new HtmlWebpackPlugin({ template: DEFAULT_TEMPLATE })
      ]
    };
    const compiler = new WebpackRecompilationSimulator(webpack(config));
    const jsFileTempPath = compiler.addTestFile(path.join(__dirname, 'fixtures/index.js'));
    fs.writeFileSync(jsFileTempPath, 'global = 1; module.hot.accept();');
    return compiler.startWatching()
      // Change the template file and compile again
      .then(() => {
        fs.writeFileSync(jsFileTempPath, 'global = 2; module.hot.accept();');
        return compiler.waitForWatchRunComplete();
      })
      .then(stats => {
        const hotUpdateJsFileNames = Object.keys(stats.compilation.assets).filter((fileName) => /\.hot-update\.js$/.test(fileName));
        expect(hotUpdateJsFileNames).not.toEqual([]);
        expect(hotUpdateJsFileNames.length).toEqual(1);
        const hotUpdateFileSize = stats.compilation.assets[hotUpdateJsFileNames[0]].size();
        expect(hotUpdateFileSize).not.toEqual(0);
      })
      .then(() => compiler.stopWatching());
  });

  it('should re-emit favicon and assets from a loader if watch is active', () => {
    const template = path.join(__dirname, "./fixtures/html-template-with-image.html");
    const config = {
      mode: 'development',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        assetModuleFilename: '[name][ext]',
        path: OUTPUT_DIR
      },
      module: {
        rules: [
          {
            test: /\.html$/,
            loader: 'html-loader'
          }
        ]
      },
      plugins: [
        new HtmlWebpackPlugin({
          favicon: path.join(__dirname, "./fixtures/favicon.ico"),
          template
        })
      ]
    };

    const templateContent = fs.readFileSync(template, 'utf-8');
    const compiler = new WebpackRecompilationSimulator(webpack(config));
    const jsFileTempPath = compiler.addTestFile(path.join(__dirname, 'fixtures/index.js'));

    return compiler.startWatching()
      // Change the template file and compile again
      .then((stats) => {
        expect(Object.keys(stats.compilation.assets)).toEqual([
          "logo.png",
          "main.js",
          // Special file for testing
          "spec_fixtures_async_js.js",
          "favicon.ico",
          "index.html",
        ]);
        expect(stats.compilation.errors).toEqual([]);
        expect(stats.compilation.warnings).toEqual([]);

        fs.writeFileSync(jsFileTempPath, 'module.exports = function calc(a, b){ return a - b };');

        return compiler.waitForWatchRunComplete();
      })
      .then(stats => {
        expect(Object.keys(stats.compilation.assets)).toEqual([
             "main.js",
             "logo.png",
             "favicon.ico",
             "index.html",
        ]);
        expect(stats.compilation.errors).toEqual([]);
        expect(stats.compilation.warnings).toEqual([]);

        fs.writeFileSync(template, templateContent.replace(/Some unique text/, 'Some other unique text'));

        return compiler.waitForWatchRunComplete();
      })
      .then((stats) => {
        expect(Object.keys(stats.compilation.assets)).toEqual([
          "logo.png",
          "main.js",
          "favicon.ico",
          "index.html",
        ]);
        expect(stats.compilation.errors).toEqual([]);
        expect(stats.compilation.warnings).toEqual([]);

        fs.writeFileSync(template, templateContent);
      })
      .then(() => compiler.stopWatching());
  });
});
