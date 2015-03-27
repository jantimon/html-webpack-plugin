'use strict';
var path = require('path');
var fs = require('fs');
var webpack = require('webpack');
var rm_rf = require('rimraf');
var CommonsChunkPlugin = require("webpack/lib/optimize/CommonsChunkPlugin");
var HtmlWebpackPlugin = require('../index.js');

var OUTPUT_DIR = path.join(__dirname, '../dist');

function testHtmlPlugin(webpackConfig, expectedResults, outputFile, done) {
  outputFile = outputFile || 'index.html';
  webpack(webpackConfig, function(err, stats) {
    expect(err).toBeFalsy();
    expect(stats.hasErrors()).toBe(false);
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
    }, ['<script src="index_bundle.js"'], null, done);

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

  it('allows you to specify your own HTML template string', function(done) {
    testHtmlPlugin({
      entry: {app: path.join(__dirname, 'fixtures/index.js')},
      output: {
        path: OUTPUT_DIR,
        filename: 'app_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({
        templateContent: fs.readFileSync(path.join(__dirname, 'fixtures/test.html'), 'utf8')
      })]
    },
    ['<script src="app_bundle.js'], null, done);
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

  it('allows you to inject the assets into a html string', function (done) {
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
        inject: ['util', 'app'],
        templateContent: fs.readFileSync(path.join(__dirname, 'fixtures/plain.html'), 'utf8')
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
        inject: ['app'],
        template: path.join(__dirname, 'fixtures/plain.html')
      })]
    }, ['<script src="app_bundle.js"'], null, done);
  });

  it('allows you to use the deprecated assets object', function (done) {
    testHtmlPlugin({
        entry: {
          app: path.join(__dirname, 'fixtures/index.js')
        },
        output: {
          path: OUTPUT_DIR,
          filename: '[name]_bundle.js'
        },
        plugins: [new HtmlWebpackPlugin({template: path.join(__dirname, 'fixtures/legacy.html')})]
      },
      ['<script src="app_bundle.js', 'Some unique text'], null, done);
  });

  it('allows you to use the deprecated default_index file', function (done) {
    testHtmlPlugin({
        entry: {
          app: path.join(__dirname, 'fixtures/index.js')
        },
        output: {
          path: OUTPUT_DIR,
          filename: '[name]_bundle.js'
        },
        plugins: [new HtmlWebpackPlugin({template: path.join(__dirname, 'fixtures/legacy_default_index.html')})]
      },
      ['<script src="app_bundle.js'], null, done);
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

  it('registers a webpack error both template and template content are specified', function(done) {
    webpack({
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({
        template: path.join(__dirname, 'fixtures/test.html'),
        templateContent: 'whatever'
      })]
    }, function(err, stats) {
      expect(stats.hasErrors()).toBe(true);
      expect(stats.toJson().errors[0]).toContain('HtmlWebpackPlugin');
      done();
    });
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

  it('allows you to configure the output filename with a path', function(done) {
    testHtmlPlugin({
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({filename: 'assets/test.html'})]
    }, ['<script src="index_bundle.js"'], 'assets/test.html', done);
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

  it('registers a webpack error if the template cannot be opened', function(done) {
    webpack({
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({template: 'fixtures/does_not_exist.html'})]
    }, function(err, stats) {
      expect(stats.hasErrors()).toBe(true);
      expect(stats.toJson().errors[0]).toContain('HtmlWebpackPlugin');
      done();
    });
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

});
