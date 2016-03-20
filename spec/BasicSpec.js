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
var rm_rf = require('rimraf');
var CommonsChunkPlugin = require('webpack/lib/optimize/CommonsChunkPlugin');
var HtmlWebpackPlugin = require('../index.js');

var OUTPUT_DIR = path.join(__dirname, '../dist');

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

describe('HtmlWebpackPlugin', function () {
  beforeEach(function (done) {
    rm_rf(OUTPUT_DIR, done);
  });

  it('generates a default index.html file for a single entry point', function (done) {
    testHtmlPlugin({
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin()]
    }, [/<body>[\s]*<script src="index_bundle.js"><\/script>[\s]*<\/body>/], null, done);
  });

  it('generates a default index.html file with multiple entry points', function (done) {
    testHtmlPlugin({
      entry: {
        util: path.join(__dirname, 'fixtures/util.js'),
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin()]
    }, ['<script src="util_bundle.js"', '<script src="app_bundle.js"'], null, done);
  });

  it('allows you to specify a custom loader', function (done) {
    testHtmlPlugin({
      entry: {
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({
        inject: false,
        template: 'underscore-template-loader!' + path.join(__dirname, 'fixtures/test.html')
      })]
    },
    ['<script src="app_bundle.js', 'Some unique text'], null, done);
  });

  it('should pass through loader errors', function (done) {
    testHtmlPlugin({
      entry: {
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({
        inject: false,
        template: path.join(__dirname, 'fixtures/invalid.html')
      })]
    },
    ['ReferenceError: foo is not defined'], null, done, true);
  });

  it('uses a custom loader from webpacks config', function (done) {
    testHtmlPlugin({
      entry: {
        app: path.join(__dirname, 'fixtures/index.js')
      },
      module: {
        loaders: [
          {test: /\.html$/, loader: 'underscore-template-loader'}
        ]
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({
        inject: false,
        template: path.join(__dirname, 'fixtures/test.html')
      })]
    },
    ['<script src="app_bundle.js', 'Some unique text'], null, done);
  });

  it('works when using html-loader', function (done) {
    testHtmlPlugin({
      entry: {
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({
        inject: true,
        template: 'html-loader!' + path.join(__dirname, 'fixtures/plain.html')
      })]
    },
    ['<script src="app_bundle.js"'], null, done);
  });

  it('allows you to specify your own HTML template file', function (done) {
    testHtmlPlugin({
      entry: {
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({
        template: path.join(__dirname, 'fixtures/test.html'),
        inject: false
      })]
    },
    ['<script src="app_bundle.js', 'Some unique text'], null, done);
  });

  it('allows you to inject the assets into a given html file', function (done) {
    testHtmlPlugin({
      entry: {
        util: path.join(__dirname, 'fixtures/util.js'),
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({
        inject: true,
        template: path.join(__dirname, 'fixtures/plain.html')
      })]
    }, ['<script src="util_bundle.js"', '<script src="app_bundle.js"'], null, done);
  });

  it('allows you to inject the assets into the body of the given template', function (done) {
    testHtmlPlugin({
      entry: {
        util: path.join(__dirname, 'fixtures/util.js'),
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({
        inject: 'body',
        template: path.join(__dirname, 'fixtures/plain.html')
      })]
    }, ['<script src="util_bundle.js"', '<script src="app_bundle.js"'], null, done);
  });

  it('allows you to inject the assets into the head of the given template', function (done) {
    testHtmlPlugin({
      entry: {
        util: path.join(__dirname, 'fixtures/util.js'),
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({
        inject: 'head',
        template: path.join(__dirname, 'fixtures/plain.html')
      })]
    }, ['<script src="util_bundle.js"', '<script src="app_bundle.js"'], null, done);
  });

  it('allows you to inject a specified asset into a given html file', function (done) {
    testHtmlPlugin({
      entry: {
        util: path.join(__dirname, 'fixtures/util.js'),
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({
        inject: true,
        chunks: ['app'],
        template: path.join(__dirname, 'fixtures/plain.html')
      })]
    }, ['<script src="app_bundle.js"'], null, done);
  });

  it('allows you to inject a specified asset into a given html file', function (done) {
    testHtmlPlugin({
      entry: {
        util: path.join(__dirname, 'fixtures/util.js'),
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({
        inject: true,
        excludeChunks: ['util'],
        template: path.join(__dirname, 'fixtures/plain.html')
      })]
    }, ['<script src="app_bundle.js"'], null, done);
  });

  it('allows you to use chunkhash with asset into a given html file', function (done) {
    testHtmlPlugin({
      entry: {
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({
        inject: false,
        template: path.join(__dirname, 'fixtures/webpackconfig.html')
      })]
    }, [{
      type: 'chunkhash',
      chunkName: 'app',
      containStr: '<script src="app_bundle.js?%chunkhash%"'
    }], null, done);
  });

  it('allows you to disable injection', function (done) {
    testHtmlPlugin({
      entry: {
        util: path.join(__dirname, 'fixtures/util.js'),
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({
        inject: false,
        template: path.join(__dirname, 'fixtures/plain.html')
      })]
    }, ['<body>\n</body>'], null, done);
  });

  it('allows you to specify your own HTML template function', function (done) {
    testHtmlPlugin({
      entry: {app: path.join(__dirname, 'fixtures/index.js')},
      output: {
        path: OUTPUT_DIR,
        filename: 'app_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({
        templateContent: function () {
          return fs.readFileSync(path.join(__dirname, 'fixtures/plain.html'), 'utf8');
        }
      })]
    },
    ['<script src="app_bundle.js"'], null, done);
  });

  it('works with source maps', function (done) {
    testHtmlPlugin({
      devtool: 'sourcemap',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin()]
    }, ['<script src="index_bundle.js"'], null, done);
  });

  it('handles hashes in bundle filenames', function (done) {
    testHtmlPlugin({
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle_[hash].js'
      },
      plugins: [new HtmlWebpackPlugin()]
    }, [/<script src="index_bundle_[0-9a-f]+\.js"*/], null, done);
  });

  it('handles hashes in the directory which has the bundle file', function (done) {
    testHtmlPlugin({
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: path.join(__dirname, '../dist'),
        publicPath: '/dist/[hash]/',
        filename: 'index_bundle_[hash].js'
      },
      plugins: [new HtmlWebpackPlugin()]
    }, [/<script src="\/dist\/[0-9a-f]+\/index_bundle_[0-9a-f]+\.js"*/], null, done);
  });

  it('allows to append hashes to the assets', function (done) {
    testHtmlPlugin({
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({hash: true})]
    }, ['<script src="index_bundle.js?%hash%"'], null, done);
  });

  it('allows to append hashes to the assets', function (done) {
    testHtmlPlugin({
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({hash: true, inject: true})]
    }, ['<script src="index_bundle.js?%hash%"'], null, done);
  });

  it('should work with the css extract plugin', function (done) {
    var ExtractTextPlugin = require('extract-text-webpack-plugin');
    testHtmlPlugin({
      entry: path.join(__dirname, 'fixtures/theme.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      module: {
        loaders: [
          { test: /\.css$/, loader: ExtractTextPlugin.extract('style-loader', 'css-loader') }
        ]
      },
      plugins: [
        new HtmlWebpackPlugin(),
        new ExtractTextPlugin('styles.css')
      ]
    }, ['<link href="styles.css" rel="stylesheet">'], null, done);
  });

  it('should work with the css extract plugin on windows and protocol relative urls support (#205)', function (done) {
    var ExtractTextPlugin = require('extract-text-webpack-plugin');
    testHtmlPlugin({
      entry: path.join(__dirname, 'fixtures/theme.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js',
        publicPath: '//localhost:8080/'
      },
      module: {
        loaders: [
          { test: /\.css$/, loader: ExtractTextPlugin.extract('style-loader', 'css-loader') }
        ]
      },
      plugins: [
        new HtmlWebpackPlugin(),
        new ExtractTextPlugin('styles.css')
      ]
    }, ['<link href="//localhost:8080/styles.css"'], null, done);
  });

  it('should allow to add cache hashes to with the css assets', function (done) {
    var ExtractTextPlugin = require('extract-text-webpack-plugin');
    testHtmlPlugin({
      entry: path.join(__dirname, 'fixtures/theme.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      module: {
        loaders: [
          { test: /\.css$/, loader: ExtractTextPlugin.extract('style-loader', 'css-loader') }
        ]
      },
      plugins: [
        new HtmlWebpackPlugin({hash: true}),
        new ExtractTextPlugin('styles.css')
      ]
    }, ['<link href="styles.css?%hash%"'], null, done);
  });

  it('should inject css files when using the extract text plugin', function (done) {
    var ExtractTextPlugin = require('extract-text-webpack-plugin');
    testHtmlPlugin({
      entry: path.join(__dirname, 'fixtures/theme.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      module: {
        loaders: [
          { test: /\.css$/, loader: ExtractTextPlugin.extract('style-loader', 'css-loader') }
        ]
      },
      plugins: [
        new HtmlWebpackPlugin({inject: true}),
        new ExtractTextPlugin('styles.css')
      ]
    }, ['<link href="styles.css"'], null, done);
  });

  it('should allow to add cache hashes to with injected css assets', function (done) {
    var ExtractTextPlugin = require('extract-text-webpack-plugin');
    testHtmlPlugin({
      entry: path.join(__dirname, 'fixtures/theme.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      module: {
        loaders: [
          { test: /\.css$/, loader: ExtractTextPlugin.extract('style-loader', 'css-loader') }
        ]
      },
      plugins: [
        new HtmlWebpackPlugin({hash: true, inject: true}),
        new ExtractTextPlugin('styles.css')
      ]
    }, ['<link href="styles.css?%hash%"'], null, done);
  });

  it('should output xhtml link stylesheet tag', function (done) {
    var ExtractTextPlugin = require('extract-text-webpack-plugin');
    testHtmlPlugin({
      entry: path.join(__dirname, 'fixtures/theme.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      module: {
        loaders: [
          { test: /\.css$/, loader: ExtractTextPlugin.extract('style-loader', 'css-loader') }
        ]
      },
      plugins: [
        new HtmlWebpackPlugin({xhtml: true}),
        new ExtractTextPlugin('styles.css')
      ]
    }, ['<link href="styles.css" rel="stylesheet"/>'], null, done);
  });

  it('prepends the webpack public path to script src', function (done) {
    testHtmlPlugin({
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js',
        publicPath: 'http://cdn.example.com/assets/'
      },
      plugins: [new HtmlWebpackPlugin()]
    }, ['<script src="http://cdn.example.com/assets/index_bundle.js"'], null, done);
  });

  it('handles subdirectories in the webpack output bundles', function (done) {
    testHtmlPlugin({
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'assets/index_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin()]
    }, ['<script src="assets/index_bundle.js"'], null, done);
  });

  it('handles subdirectories in the webpack output bundles along with a public path', function (done) {
    testHtmlPlugin({
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'assets/index_bundle.js',
        publicPath: 'http://cdn.example.com/'
      },
      plugins: [new HtmlWebpackPlugin()]
    }, ['<script src="http://cdn.example.com/assets/index_bundle.js"'], null, done);
  });

  it('allows you to configure the title of the generated HTML page', function (done) {
    testHtmlPlugin({
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({title: 'My Cool App'})]
    }, ['<title>My Cool App</title>'], null, done);
  });

  it('allows you to configure the output filename', function (done) {
    testHtmlPlugin({
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({filename: 'test.html'})]
    }, ['<script src="index_bundle.js"'], 'test.html', done);
  });

  it('will try to use a relative name if the filename is in a subdirectory', function (done) {
    testHtmlPlugin({
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({filename: 'assets/test.html'})]
    }, ['<script src="../index_bundle.js"'], 'assets/test.html', done);
  });

  it('will try to use a relative name if the filename and the script are in a subdirectory', function (done) {
    testHtmlPlugin({
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'assets/index_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({filename: 'assets/demo/test.html'})]
    }, ['<script src="../../assets/index_bundle.js"'], 'assets/demo/test.html', done);
  });

  it('allows you write multiple HTML files', function (done) {
    testHtmlPlugin({
      entry: {
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin(),
        new HtmlWebpackPlugin({
          filename: 'second-file.html',
          template: path.join(__dirname, 'fixtures/test.html')
        }),
        new HtmlWebpackPlugin({
          filename: 'third-file.html',
          template: path.join(__dirname, 'fixtures/test.html')
        })
      ]
    }, ['<script src="index_bundle.js"'], null, function () {
      expect(fs.existsSync(path.join(OUTPUT_DIR, 'second-file.html'))).toBe(true);
      expect(fs.existsSync(path.join(OUTPUT_DIR, 'third-file.html'))).toBe(true);
      done();
    });
  });

  it('should inject js css files even if the html file is incomplete', function (done) {
    var ExtractTextPlugin = require('extract-text-webpack-plugin');
    testHtmlPlugin({
      entry: path.join(__dirname, 'fixtures/theme.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      module: {
        loaders: [
          { test: /\.css$/, loader: ExtractTextPlugin.extract('style-loader', 'css-loader') }
        ]
      },
      plugins: [
        new HtmlWebpackPlugin({template: path.join(__dirname, 'fixtures/empty_html.html')}),
        new ExtractTextPlugin('styles.css')
      ]
    }, ['<link href="styles.css"', '<script src="index_bundle.js"'], null, done);
  });

  it('exposes the webpack configuration to templates', function (done) {
    testHtmlPlugin({
      entry: {
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        publicPath: 'https://cdn.com',
        filename: '[name]_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({template: path.join(__dirname, 'fixtures/webpackconfig.html')})]
    },
    ['Public path is https://cdn.com'], null, done);
  });

  it('fires the html-webpack-plugin-before-html-processing event', function (done) {
    var eventFired = false;
    var examplePlugin = {
      apply: function (compiler) {
        compiler.plugin('compilation', function (compilation) {
          compilation.plugin('html-webpack-plugin-before-html-processing', function (object, callback) {
            eventFired = true;
            callback();
          });
        });
      }
    };
    testHtmlPlugin({
      entry: {
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin(),
        examplePlugin
      ]
    }, [], null, function () {
      expect(eventFired).toBe(true);
      done();
    });
  });

  it('fires the html-webpack-plugin-after-html-processing event', function (done) {
    var eventFired = false;
    var examplePlugin = {
      apply: function (compiler) {
        compiler.plugin('compilation', function (compilation) {
          compilation.plugin('html-webpack-plugin-after-html-processing', function (object, callback) {
            eventFired = true;
            callback();
          });
        });
      }
    };
    testHtmlPlugin({
      entry: {
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin(),
        examplePlugin
      ]
    }, [], null, function () {
      expect(eventFired).toBe(true);
      done();
    });
  });

  it('fires the html-webpack-plugin-after-emit event', function (done) {
    var eventFired = false;
    var examplePlugin = {
      apply: function (compiler) {
        compiler.plugin('compilation', function (compilation) {
          compilation.plugin('html-webpack-plugin-after-emit', function (object, callback) {
            eventFired = true;
            callback();
          });
        });
      }
    };
    testHtmlPlugin({
      entry: {
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin(),
        examplePlugin
      ]
    }, [], null, function () {
      expect(eventFired).toBe(true);
      done();
    });
  });

  it('allows to modify the html during html-webpack-plugin-after-html-processing event', function (done) {
    var eventFired = false;
    var examplePlugin = {
      apply: function (compiler) {
        compiler.plugin('compilation', function (compilation) {
          compilation.plugin('html-webpack-plugin-after-html-processing', function (object, callback) {
            eventFired = true;
            object.html += 'Injected by plugin';
            callback();
          });
        });
      }
    };
    testHtmlPlugin({
      entry: {
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin(),
        examplePlugin
      ]
    }, ['Injected by plugin'], null, function () {
      expect(eventFired).toBe(true);
      done();
    });
  });

  it('allows to modify the html during html-webpack-plugin-before-html-processing event', function (done) {
    var eventFired = false;
    var examplePlugin = {
      apply: function (compiler) {
        compiler.plugin('compilation', function (compilation) {
          compilation.plugin('html-webpack-plugin-before-html-processing', function (object, callback) {
            eventFired = true;
            object.assets.js.push('funky-script.js');
            object.html += 'Injected by plugin';
            callback();
          });
        });
      }
    };
    testHtmlPlugin({
      entry: {
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin(),
        examplePlugin
      ]
    }, ['Injected by plugin', '<script src="funky-script.js"'], null, function () {
      expect(eventFired).toBe(true);
      done();
    });
  });

  it('allows to modify the html during html-webpack-plugin-before-html-generation event', function (done) {
    var eventFired = false;
    var examplePlugin = {
      apply: function (compiler) {
        compiler.plugin('compilation', function (compilation) {
          compilation.plugin('html-webpack-plugin-before-html-generation', function (object, callback) {
            eventFired = true;
            object.assets.js.push('funky-script.js');
            callback();
          });
        });
      }
    };
    testHtmlPlugin({
      entry: {
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin({
          inject: false,
          template: 'underscore-template-loader!' + path.join(__dirname, 'fixtures/custom_file.html')
        }),
        examplePlugin
      ]
    }, ['<script src="funky-script.js"'], null, function () {
      expect(eventFired).toBe(true);
      done();
    });
  });

  it('works with commons chunk plugin', function (done) {
    testHtmlPlugin({
      debug: true,
      verbose: true,
      entry: {
        util: path.join(__dirname, 'fixtures/util.js'),
        index: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [
        new CommonsChunkPlugin({
          name: 'common',
          filename: 'common_bundle.js'
        }),
        new HtmlWebpackPlugin()
      ]
    }, [
      /<script src="common_bundle.js">[\s\S]*<script src="util_bundle.js">/,
      /<script src="common_bundle.js"[\s\S]*<script src="index_bundle.js">/], null, done);
  });

  it('adds a favicon', function (done) {
    testHtmlPlugin({
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin({
          favicon: path.join(__dirname, 'fixtures/favicon.ico')
        })
      ]
    }, [/<link rel="shortcut icon" href="[^"]+\.ico">/], null, done);
  });

  it('adds a favicon with publicPath set to /some/', function (done) {
    testHtmlPlugin({
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        publicPath: '/some/',
        filename: 'index_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin({
          favicon: path.join(__dirname, 'fixtures/favicon.ico')
        })
      ]
    }, [/<link rel="shortcut icon" href="\/some\/+[^"]+\.ico">/], null, done);
  });

  it('adds a favicon with publicPath set to /some', function (done) {
    testHtmlPlugin({
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        publicPath: '/some',
        filename: 'index_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin({
          favicon: path.join(__dirname, 'fixtures/favicon.ico')
        })
      ]
    }, [/<link rel="shortcut icon" href="\/some\/+[^"]+\.ico">/], null, done);
  });

  it('adds a favicon with inject enabled', function (done) {
    testHtmlPlugin({
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin({
          inject: true,
          favicon: path.join(__dirname, 'fixtures/favicon.ico')
        })
      ]
    }, [/<link rel="shortcut icon" href="[^"]+\.ico">/], null, done);
  });

  it('adds a favicon with xhtml enabled', function (done) {
    testHtmlPlugin({
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin({
          inject: true,
          xhtml: true,
          favicon: path.join(__dirname, 'fixtures/favicon.ico')
        })
      ]
    }, [/<link rel="shortcut icon" href="[^"]+\.ico"\/>/], null, done);
  });

  it('shows an error if the favicon could not be load', function (done) {
    testHtmlPlugin({
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin({
          inject: true,
          favicon: path.join(__dirname, 'fixtures/does_not_exist.ico')
        })
      ]
    }, ['Error: HtmlWebpackPlugin: could not load file'], null, done, true);
  });

  it('adds a manifest', function (done) {
    var AppCachePlugin = require('appcache-webpack-plugin');
    testHtmlPlugin({
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [
        new AppCachePlugin({settings: ['prefer-online']}),
        new HtmlWebpackPlugin()
      ]
    }, ['<html manifest="manifest.appcache">'], null, done);
  });

  it('does not add a manifest if already present', function (done) {
    var AppCachePlugin = require('appcache-webpack-plugin');
    testHtmlPlugin({
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [
        new AppCachePlugin({settings: ['prefer-online']}),
        new HtmlWebpackPlugin({
          template: path.join(__dirname, 'fixtures/plain.html')
        })
      ]
    }, ['<html lang="en" manifest="foo.appcache">'], null, done);
  });

  it('works with webpack bannerplugin', function (done) {
    testHtmlPlugin({
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [
        new webpack.BannerPlugin('Copyright and such.'),
        new HtmlWebpackPlugin()
      ]
    }, ['<html'], null, done);
  });

  it('shows an error when a template fails to load', function (done) {
    testHtmlPlugin({
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin({
          template: path.join(__dirname, 'fixtures/non-existing-template.html')
        })
      ]
    }, ["Child compilation failed:\n  Entry module not found: Error: Cannot resolve 'file' or 'directory'"], null, done, true);
  });

  it('should sort the chunks', function (done) {
    testHtmlPlugin({
      entry: {
        util: path.join(__dirname, 'fixtures/util.js'),
        index: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [
        new CommonsChunkPlugin({
          name: 'common',
          filename: 'common_bundle.js'
        }),
        new HtmlWebpackPlugin({
          chunksSortMode: 'auto'
        })
      ]
    }, [
      /<script src="common_bundle.js">.+<script src="util_bundle.js">.+<script src="index_bundle.js">/], null, done);
  });

  it('should sort the chunks in custom (reverse alphabetical) order', function (done) {
    testHtmlPlugin({
      entry: {
        b: path.join(__dirname, 'fixtures/index.js'),
        c: path.join(__dirname, 'fixtures/util.js'),
        a: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin({
          chunksSortMode: function (a, b) {
            if (a.names[0] < b.names[0]) {
              return 1;
            }
            if (a.names[0] > b.names[0]) {
              return -1;
            }
            return 0;
          }
        })
      ]
    }, [/<script src="c_bundle.js">.+<script src="b_bundle.js">.+<script src="a_bundle.js">/], null, done);
  });

  it('should sort the chunks by chunk dependencies', function (done) {
    testHtmlPlugin({
      entry: {
        util: path.join(__dirname, 'fixtures/util.js'),
        aTheme: path.join(__dirname, 'fixtures/theme.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      module: {
        loaders: [
          { test: /\.css$/, loader: 'css-loader' }
        ]
      },
      plugins: [
        new CommonsChunkPlugin({
          name: 'common',
          filename: 'common_bundle.js'
        }),
        new HtmlWebpackPlugin({
          chunksSortMode: 'dependency'
        })
      ]
    }, [
      /<script src="common_bundle.js">.+<script src="aTheme_bundle.js">.+<script src="util_bundle.js">/], null, done);
  });

  it('should add the webpack compilation object as a property of the templateParam object', function (done) {
    testHtmlPlugin({
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin({
          template: path.join(__dirname, 'fixtures/templateParam.js'),
          inject: false
        })
      ]
    }, ['templateParams.compilation exists: true'], null, done);
  });
});
