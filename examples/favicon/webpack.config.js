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
    loaders: [
      { test: /\.css$/, loader: ExtractTextPlugin.extract('style-loader', 'css-loader') },
      { test: /\.png$/, loader: 'file-loader' }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: 'HtmlWebpackPlugin example',
      favicon: 'favicon.ico',
      filename: 'favicon1.html'
    }),
    new HtmlWebpackPlugin({
      title: 'HtmlWebpackPlugin example',
      favicon: 'http://placehold.it/160x160?text=favicon.ico',
      filename: 'favicon2.html'
    }),
    new HtmlWebpackPlugin({
      title: 'HtmlWebpackPlugin example',
      favicon: 'https://placehold.it/160x160?text=favicon.ico',
      filename: 'favicon3.html'
    }),
    new HtmlWebpackPlugin({
      title: 'HtmlWebpackPlugin example',
      favicon: 'data:image/x-icon;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQEAYAAABPYyMiAAAABmJLR0T///////8JWPfcAAAACXBIWXMAAABIAAAASABGyWs+AAAAF0lEQVRIx2NgGAWjYBSMglEwCkbBSAcACBAAAeaR9cIAAAAASUVORK5CYII=',
      filename: 'favicon4.html'
    }),
    new ExtractTextPlugin('styles.css')
  ]
};
