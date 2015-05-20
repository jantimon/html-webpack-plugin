var HtmlWebpackPlugin = require('..');
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
      { test: /\.png$/, loader: 'file-loader' }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin(),
    new HtmlWebpackPlugin({
      filename: 'html-loader.html',
      template: 'html!./template.html'
    }),
    new HtmlWebpackPlugin({
      filename: 'no-loader.html',
      template: 'template.html'
    }),
    new HtmlWebpackPlugin({
      title: 'HtmlWebpackPlugin example',
      favicon: 'favicon.ico',
      filename: 'index.min.html',
      minify: {
        removeComments: true,
        collapseWhitespace: true,
        conservativeCollapse: false,
        minifyJS: true,
        minifyCSS: true
      }
    }),
    new ExtractTextPlugin('styles.css')
  ]
};