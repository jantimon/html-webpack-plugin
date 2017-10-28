var path = require('path');
var HtmlWebpackPlugin = require('../..');
var ExtractTextPlugin = require('extract-text-webpack-plugin');
var CommonsChunkPlugin = require('webpack').optimize.CommonsChunkPlugin;
var webpackMajorVersion = require('webpack/package.json').version.split('.')[0];

module.exports = {
  context: __dirname,
  entry: {
    a: './a.js',
    b: './b.js'
  },
  output: {
    path: path.join(__dirname, 'dist/webpack-' + webpackMajorVersion),
    publicPath: '',
    filename: '[name].js'
  },
  module: {
    loaders: [
      { test: /\.css$/, loader: ExtractTextPlugin.extract({ fallback: 'style-loader', use: 'css-loader' }) },
      { test: /\.png$/, loader: 'file-loader' },
      { test: /\.html$/, loader: 'html-loader' }
    ]
  },
  plugins: [
    new CommonsChunkPlugin({
      name: 'common'
    }),
    new HtmlWebpackPlugin({
      inject: true,
      filename: 'first-file.html',
      template: 'template.html',
      chunks: ['a', 'common']
    }),
    new HtmlWebpackPlugin({
      inject: true,
      filename: 'second-file.html',
      template: 'template.html',
      chunks: ['b', 'common']
    }),
    new ExtractTextPlugin('styles.css')
  ]
};
