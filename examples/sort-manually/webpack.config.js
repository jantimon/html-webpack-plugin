var path = require('path');
var HtmlWebpackPlugin = require('../..');
var ExtractTextPlugin = require('extract-text-webpack-plugin');
var webpackMajorVersion = require('webpack/package.json').version.split('.')[0];
module.exports = {
  context: __dirname,
  entry: {
    b: './b.js',
    d: './d.js',
    a: './a.js',
    c: './c.js',
    e: './e.js'
  },
  output: {
    path: path.join(__dirname, 'dist/webpack-' + webpackMajorVersion),
    publicPath: '',
    filename: '[name].js'
  },
  module: {
    loaders: [
      { test: /\.css$/, loader: ExtractTextPlugin.extract('style-loader', 'css-loader') },
      { test: /\.png$/, loader: 'file-loader' },
      { test: /\.html$/, loader: 'html-loader' }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      inject: true,
      filename: 'first-file.html',
      template: 'template.html',
      chunksSortMode: 'manual',
      chunks: ['a', 'b', 'c']
    }),
    new HtmlWebpackPlugin({
      inject: true,
      filename: 'second-file.html',
      template: 'template.html',
      chunksSortMode: 'manual',
      chunks: ['a', 'b', 'd']
    }),
    new ExtractTextPlugin('styles.css')
  ]
};
