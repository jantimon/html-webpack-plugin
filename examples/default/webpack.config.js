var HtmlWebpackPlugin = require('../..');
var webpackMajorVersion = require('webpack/package.json').version.split('.')[0];
module.exports = {
  entry: './example.js',
  output: {
    path: __dirname + '/dist/webpack-' + webpackMajorVersion,
    publicPath: '',
    filename: 'bundle.js'
  },
  module: {
    loaders: [
      { test: /\.css$/, loader: 'style-loader!css-loader' },
      { test: /\.png$/, loader: 'file-loader' }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin()
  ]
};
