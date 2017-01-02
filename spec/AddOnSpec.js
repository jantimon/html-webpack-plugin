/*
 * Integration and unit tests for all features but caching
 */

/* eslint-env jasmine */
'use strict';

// Workaround for css-loader issue
// https://github.com/webpack/css-loader/issues/144
if (!global.Promise) {
  require('es6-promise').polyfill();
}

var path = require('path');
var fs = require('fs');
var webpack = require('webpack');
var rimraf = require('rimraf');
var HtmlWebpackPlugin = require('../index.js');

var OUTPUT_DIR = path.join(__dirname, '../dist');

jasmine.getEnv().defaultTimeoutInterval = 30000;

function testHtmlPlugin (webpackConfig, expectedResults, outputFile, done, expectErrors, expectWarnings) {
  outputFile = outputFile || 'index.html';
  webpack(webpackConfig, function (err, stats) {
    expect(err).toBeFalsy();
    var compilationErrors = (stats.compilation.errors || []).join('\n');
    if (expectErrors) {
      expect(compilationErrors).not.toBe('');
    } else {
      expect(compilationErrors).toBe('');
    }
    var compilationWarnings = (stats.compilation.warnings || []).join('\n');
    if (expectWarnings) {
      expect(compilationWarnings).not.toBe('');
    } else {
      expect(compilationWarnings).toBe('');
    }
    if (outputFile instanceof RegExp) {
      var matches = Object.keys(stats.compilation.assets).filter(function (item) {
        return outputFile.test(item);
      });
      expect(matches.length).toBe(1);
      outputFile = matches[0];
    }
    expect(outputFile.indexOf('[hash]') === -1).toBe(true);
    var outputFileExists = fs.existsSync(path.join(OUTPUT_DIR, outputFile));
    expect(outputFileExists).toBe(true);
    if (!outputFileExists) {
      return done();
    }
    var htmlContent = fs.readFileSync(path.join(OUTPUT_DIR, outputFile)).toString();
    var chunksInfo;
    for (var i = 0; i < expectedResults.length; i++) {
      var expectedResult = expectedResults[i];
      if (expectedResult instanceof RegExp) {
        expect(htmlContent).toMatch(expectedResult);
      } else if (typeof expectedResult === 'object') {
        if (expectedResult.type === 'chunkhash') {
          if (!chunksInfo) {
            chunksInfo = getChunksInfoFromStats(stats);
          }
          var chunkhash = chunksInfo[expectedResult.chunkName].hash;
          expect(htmlContent).toContain(expectedResult.containStr.replace('%chunkhash%', chunkhash));
        }
      } else {
        expect(htmlContent).toContain(expectedResult.replace('%hash%', stats.hash));
      }
    }
    done();
  });
}

function getChunksInfoFromStats (stats) {
  var chunks = stats.compilation.getStats().toJson().chunks;
  var chunksInfo = {};
  for (var i = 0; i < chunks.length; i++) {
    var chunk = chunks[i];
    var chunkName = chunk.names[0];
    if (chunkName) {
      chunksInfo[chunkName] = chunk;
    }
  }
  return chunksInfo;
}

describe('HtmlWebpackPlugin AddOn Plugins', function () {
  beforeEach(function (done) {
    rimraf(OUTPUT_DIR, done);
  });

  it('can add a no-value attribute to an HTML element', function (done) {
    const addOnPlugin = {
      apply: function (compiler) {
        compiler.plugin('compilation', compilation => {
          compilation.plugin('html-webpack-plugin-alter-asset-tags', (pluginArgs, callback) => {
            pluginArgs.body = pluginArgs.body.map(tag => {
              if (tag.tagName === 'script') {
                Object.defineProperty(tag.attributes, 'async', {enumerable: true});
              }
              return tag;
            });
            callback(null, pluginArgs);
          });
        });
      }
    };
    testHtmlPlugin(
      {
        entry: path.join(__dirname, 'fixtures/index.js'),
        output: {
          path: OUTPUT_DIR,
          filename: 'index_bundle.js'
        },
        plugins: [new HtmlWebpackPlugin(), addOnPlugin]
      },
      [/<body>[\s]*<script type="text\/javascript" src="index_bundle.js" async><\/script>[\s]*<\/body>/],
      null,
      done
    );
  });
});
