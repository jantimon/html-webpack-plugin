var path = require('path');
var fs = require('fs');
var webpack = require('webpack');
var rm_rf = require('rimraf');
var HtmlWebpackPlugin = require('../index.js');

var OUTPUT_DIR = path.join(__dirname, '..', 'dist');

function testHtmlPlugin(webpackConfig, expectedResults, done) {
  var outputHtmlFile = path.join(OUTPUT_DIR, 'index.html');
  webpack(webpackConfig, function(err, stats) {
    expect(err).toBeFalsy();
    expect(stats.hasErrors()).toBe(false);
    var htmlContent = fs.readFileSync(outputHtmlFile).toString();
    for (var i = 0; i < expectedResults.length; i++) {
      expect(htmlContent).toContain(expectedResults[i]);
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
      entry: path.join(__dirname, 'fixtures', 'index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin()]
    }, ['<script src="index_bundle.js"'], done);

  });

  it('generates a default index.html file with multiple entry points', function(done) {
    testHtmlPlugin({
      entry: {
        util: path.join(__dirname, 'fixtures', 'util.js'),
        app: path.join(__dirname, 'fixtures', 'index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin()]
    }, ['<script src="util_bundle.js"', '<script src="app_bundle.js"'], done);
  });

  it('allows you to specify your own HTML template', function(done) {
    testHtmlPlugin({
      entry: {
        app: path.join(__dirname, 'fixtures', 'index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({template: path.join(__dirname, 'fixtures', 'test.html')})]
    },
    ['<script src="app_bundle.js"', 'Some unique text'], done);
  });

  it('works with source maps', function(done) {
    testHtmlPlugin({
      devtool: 'sourcemap',
      entry: path.join(__dirname, 'fixtures', 'index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin()]
    }, ['<script src="index_bundle.js"'], done);
  });

});
