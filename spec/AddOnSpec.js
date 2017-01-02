/*
 * Integration and unit tests for add-on plugin functionality
 */

/* eslint-env jasmine */
'use strict';

// Workaround for css-loader issue
// https://github.com/webpack/css-loader/issues/144
if (!global.Promise) {
  require('es6-promise').polyfill();
}

const path = require('path');
const fs = require('fs');
const webpack = require('webpack');
const rimraf = require('rimraf');
const HtmlWebpackPlugin = require('../index.js');

const OUTPUT_DIR = path.join(__dirname, '../dist');

jasmine.getEnv().defaultTimeoutInterval = 30000;

function testHtmlPlugin (webpackConfig, expectedResult, done) {
  const outputFile = path.join(OUTPUT_DIR, 'index.html');
  webpack(webpackConfig, function (err, stats) {
    expect(err).toBeFalsy();
    expect(stats.compilation.errors.length).toEqual(0);
    expect(stats.compilation.warnings.length).toEqual(0);
    const outputFileExists = fs.existsSync(outputFile);
    expect(outputFileExists).toBe(true);
    if (outputFileExists) {
      const htmlContent = fs.readFileSync(outputFile).toString();
      expect(htmlContent).toMatch(expectedResult);
    }
    done();
  });
}

function createTestPlugin (addOnEvent, testFn) {
  return {
    apply: function (compiler) {
      compiler.plugin('compilation', compilation => {
        compilation.plugin(addOnEvent, testFn);
      });
    }
  };
}

describe('HtmlWebpackPlugin AddOn Plugins', function () {
  beforeEach(function (done) {
    rimraf(OUTPUT_DIR, done);
  });

  it('can add a no-value attribute to an HTML element', function (done) {
    const testFn = (pluginArgs, callback) => {
      pluginArgs.body = pluginArgs.body.map(tag => {
        if (tag.tagName === 'script') {
          Object.defineProperty(tag.attributes, 'async', {enumerable: true});
        }
        return tag;
      });
      callback(null, pluginArgs);
    };
    const webpackConfig = {
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin(),
        createTestPlugin('html-webpack-plugin-alter-asset-tags', testFn)
      ]
    };
    const expectedResult = /<body>[\s]*<script type="text\/javascript" src="index_bundle.js" async><\/script>[\s]*<\/body>/;
    testHtmlPlugin(webpackConfig, expectedResult, done);
  });
});
