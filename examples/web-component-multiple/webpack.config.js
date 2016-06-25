var HtmlWebpackPlugin = require('../..');
var ExtractTextPlugin = require('extract-text-webpack-plugin');
var webpackMajorVersion = require('webpack/package.json').version.split('.')[0];
module.exports = {
  entry: {
    'one-example': './example-component-one.js',
    'another-example': './example-component-two.js'
  },
  output: {
    path: __dirname + '/dist/webpack-' + webpackMajorVersion,
    publicPath: '',
    filename: '[name]-bundle.js'
  },
  module: {
    loaders: [
      { test: /\.css$/, loader: ExtractTextPlugin.extract('style-loader', 'css-loader') }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      chunks: ['one-example'],
      filename: 'one-example.html',
      inject: false,
      template: 'template.ejs'
    }),
    new HtmlWebpackPlugin({
      chunks: ['another-example'],
      filename: 'another-example.html',
      inject: false,
      template: 'template.ejs'
    }),
    new ExtractTextPlugin('[name]-styles.css')
  ],
  devtool: 'eval'
};
