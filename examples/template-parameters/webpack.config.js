var path = require('path');
var HtmlWebpackPlugin = require('../..');
var webpackMajorVersion = require('webpack/package.json').version.split('.')[0];
module.exports = {
  context: __dirname,
  entry: './example.js',
  output: {
    path: path.join(__dirname, 'dist/webpack-' + webpackMajorVersion),
    publicPath: '',
    filename: 'bundle.js'
  },
  plugins: [
    new HtmlWebpackPlugin({
      templateParameters: {
        'foo': 'bar'
      },
      template: 'index.ejs'
    })
  ]
};
