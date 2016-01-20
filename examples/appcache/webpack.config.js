var AppCachePlugin = require('appcache-webpack-plugin');
var HtmlWebpackPlugin = require('../..');
var ExtractTextPlugin = require('extract-text-webpack-plugin');
module.exports = {
  entry: './example.js',
  output: {
    path: __dirname + '/dist',
    publicPath: '',
    filename: 'bundle.js'
  },
  module: {
    loaders: [
      { test: /\.css$/, loader: ExtractTextPlugin.extract('style-loader', 'css-loader') },
      { test: /\.png$/, loader: 'file-loader' },
      { test: /\.html$/, loader: 'html-loader?-removeOptionalTags' }
    ]
  },
  plugins: [
    new AppCachePlugin(),
    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: 'template.html',
      minify: {
        removeComments: true,
        collapseWhitespace: true
      }
    }),
    new ExtractTextPlugin('styles.css')
  ]
};

