'use strict';
var path = require('path');
var fs = require('fs');
var webpack = require('webpack');
var rm_rf = require('rimraf');
var CommonsChunkPlugin = require("webpack/lib/optimize/CommonsChunkPlugin");
var HtmlWebpackPlugin = require('../index.js');

var OUTPUT_DIR = path.join(__dirname, '../dist');

function testHtmlPlugin(webpackConfig, expectedResults, outputFile, done, expectErrors, expectWarnings) {
  outputFile = outputFile || 'index.html';
  webpack(webpackConfig, function(err, stats) {
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
    if(!outputFileExists) {
      return done();
    }
    var htmlContent = fs.readFileSync(path.join(OUTPUT_DIR, outputFile)).toString();

    for (var i = 0; i < expectedResults.length; i++) {
      var expectedResult = expectedResults[i];
      if (expectedResult instanceof RegExp) {
        expect(htmlContent).toMatch(expectedResult);
      } else {
        expect(htmlContent).toContain(expectedResult.replace('%hash%', stats.hash));
      }
    }
    done();
  });
}

describe('HtmlWebpackPlugin', function() {
  beforeEach(function(done) {
    rm_rf(OUTPUT_DIR, done);
  });

  it('generates a default index.html file for a single entry point', function(done) {
    testHtmlPlugin({
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin()]
    }, [/<body>[\s]*<script src="index_bundle.js"><\/script>[\s]*<\/body>/], null, done);

  });

  it('generates a default index.html file with multiple entry points', function(done) {
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

  it('allows you to specify a custom loader', function(done) {
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
        template: 'underscore-template-loader!' + path.join(__dirname, 'fixtures/underscore.html')
      })]
    },
    ['<script src="app_bundle.js', 'Some unique text'], null, done);
  });

  it('uses a custom loader from webpacks config', function(done) {
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
        template: path.join(__dirname, 'fixtures/underscore.html')
      })]
    },
    ['<script src="app_bundle.js', 'Some unique text'], null, done);
  });

  it('works when using html-loader', function(done) {
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

  it('allows you to specify your own HTML template file', function(done) {
    testHtmlPlugin({
      entry: {
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({template: path.join(__dirname, 'fixtures/test.html')})]
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

  it('allows you to specify your own HTML template function', function(done) {
    testHtmlPlugin({
      entry: {app: path.join(__dirname, 'fixtures/index.js')},
      output: {
        path: OUTPUT_DIR,
        filename: 'app_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({
        templateContent: function() {
          return fs.readFileSync(path.join(__dirname, 'fixtures/test.html'), 'utf8');
        }
      })]
    },
    ['<script src="app_bundle.js"'], null, done);
  });

  it('works with source maps', function(done) {
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

  it('handles hashes in bundle filenames', function(done) {
    testHtmlPlugin({
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle_[hash].js'
      },
      plugins: [new HtmlWebpackPlugin()]
    }, [/<script src="index_bundle_[0-9a-f]+\.js/], null, done);
  });

  it('allows to append hashes to the assets', function(done) {
    testHtmlPlugin({
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({hash: true})]
    }, ['<script src="index_bundle.js?%hash%"'], null, done);
  });

  it('allows to append hashes to the assets', function(done) {
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
    var ExtractTextPlugin = require("extract-text-webpack-plugin");
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
        new ExtractTextPlugin("styles.css")
      ]
    }, ['<link href="styles.css"'], null, done);
  });

  it('should allow to add cache hashes to with the css assets', function (done) {
    var ExtractTextPlugin = require("extract-text-webpack-plugin");
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
        new ExtractTextPlugin("styles.css")
      ]
    }, ['<link href="styles.css?%hash%"'], null, done);
  });

  it('should inject css files when using the extract text plugin', function (done) {
    var ExtractTextPlugin = require("extract-text-webpack-plugin");
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
        new ExtractTextPlugin("styles.css")
      ]
    }, ['<link href="styles.css"'], null, done);
  });

  it('should allow to add cache hashes to with injected css assets', function (done) {
    var ExtractTextPlugin = require("extract-text-webpack-plugin");
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
        new ExtractTextPlugin("styles.css")
      ]
    }, ['<link href="styles.css?%hash%"'], null, done);
  });

  it('prepends the webpack public path to script src', function(done) {
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

  it('handles subdirectories in the webpack output bundles', function(done) {
    testHtmlPlugin({
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'assets/index_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin()]
    }, ['<script src="assets/index_bundle.js"'], null, done);
  });

  it('handles subdirectories in the webpack output bundles along with a public path', function(done) {
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

  it('allows you to configure the title of the generated HTML page', function(done) {
    testHtmlPlugin({
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({title: 'My Cool App'})]
    }, ['<title>My Cool App</title>'], null, done);
  });

  it('allows you to configure the output filename', function(done) {
    testHtmlPlugin({
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({filename: 'test.html'})]
    }, ['<script src="index_bundle.js"'], 'test.html', done);
  });

  it('will try to use a relative name if the filename is in a subdirectory', function(done) {
    testHtmlPlugin({
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({filename: 'assets/test.html'})]
    }, ['<script src="../index_bundle.js"'], 'assets/test.html', done);
  });

  it('will try to use a relative name if the filename and the script are in a subdirectory', function(done) {
    testHtmlPlugin({
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'assets/index_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({filename: 'assets/demo/test.html'})]
    }, ['<script src="../../assets/index_bundle.js"'], 'assets/demo/test.html', done);
  });

  it('allows you write multiple HTML files', function(done) {
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
          filename: 'test.html',
          template: path.join(__dirname, 'fixtures/test.html')
        })
      ]
    }, ['<script src="index_bundle.js"'], null, done);

    expect(fs.existsSync(path.join(__dirname, 'fixtures/test.html'))).toBe(true);
  });

  it('exposes the webpack configuration to templates', function(done) {
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

  it('works with commons chunk plugin', function(done) {
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
          filename: "common_bundle.js",
        }),
        new HtmlWebpackPlugin()
      ]
    }, [
      /<script src="common_bundle.js">[\s\S]*<script src="util_bundle.js">/,
      /<script src="common_bundle.js"[\s\S]*<script src="index_bundle.js">/], null, done);
  });

  it('adds a favicon', function(done) {
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

  it('adds a favicon with inject enabled', function(done) {
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

  it('shows an error if the favicon could not be load', function(done) {
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

  it('adds a manifest', function(done) {
    testHtmlPlugin({
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin({
          manifest: path.join(__dirname, 'fixtures/manifest.json')
        })
      ]
    }, ['<html manifest="manifest.json">'], null, done);
  });

  it('does not add a manifest if already present', function(done) {
    testHtmlPlugin({
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin({
          template: path.join(__dirname, 'fixtures/plain.html'),
          manifest: path.join(__dirname, 'fixtures/manifest.json')
        })
      ]
    }, ['<html lang="en" manifest="foo.appcache">'], null, done);
  });

  it('shows an error when a template fails to load', function(done) {
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
    }, ["HtmlWebpackPlugin Error: Child compilation failed:\nEntry module not found: Error: Cannot resolve 'file' or 'directory'"], null, done, true);
  });

});
