var path = require('path');
var HtmlWebpackPlugin = require('../..');
var MiniCssExtractPlugin = require('mini-css-extract-plugin');
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
      { test: /\.css$/, use: [MiniCssExtractPlugin.loader, 'css-loader'] },
      { test: /\.png$/, type: 'asset/resource' }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: 'HtmlWebpackPlugin example',
      favicon: 'favicon.ico',
      filename: 'favicon.html'
    }),
    new MiniCssExtractPlugin({ filename: 'styles.css' })
  ]
};
