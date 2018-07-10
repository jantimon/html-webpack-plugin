var path = require('path');
var HtmlWebpackPlugin = require('../..');
var ExtractTextPlugin = require('extract-text-webpack-plugin');
var webpackMajorVersion = require('webpack/package.json').version.split('.')[0];

module.exports = {
  context: __dirname,
  entry: './example.js',
  output: {
    path: path.join(__dirname, 'dist/webpack-' + webpackMajorVersion),
    publicPath: '',
    filename: 'bundle.js'
  },
  module: {
    rules: [
      { test: /\.css$/, loader: ExtractTextPlugin.extract({ fallback: 'style-loader', use: 'css-loader' }) },
      { test: /\.pug$/, loader: 'pug-loader' }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      inject: false,
      cache: false,
      template: 'template.pug',
      filename: 'index.html',
      favicon: 'favicon.ico',
      title: 'pug demo'
    }),
    new ExtractTextPlugin('styles.css')
  ]
};
