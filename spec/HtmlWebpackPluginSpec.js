var path = require('path');
var fs = require('fs');
var webpack = require('webpack');

var HtmlWebpackPlugin = require('../index.js');

describe('HtmlWebpackPlugin', function() {
  it('generates a default index.html file for a single entry point', function(done) {
    var outputDir = path.join(__dirname, '..', 'dist');
    var outputHtmlFile = path.join(outputDir, 'index.html');

    webpack({
      entry: path.join(__dirname, 'fixtures', 'index.js'),
      output: {
        path: outputDir,
        filename: 'index_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin()]
    }, function(err, stats) {
      expect(err).toBeFalsy();
      expect(stats.hasErrors()).toBe(false);
      expect(fs.readFileSync(outputHtmlFile).toString()).toContain('<script src="index_bundle.js"');
      done();
    });
  });
});
