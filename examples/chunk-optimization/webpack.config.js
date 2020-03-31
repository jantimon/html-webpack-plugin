var path = require('path');
var HtmlWebpackPlugin = require('../..');
var webpackMajorVersion = require('webpack/package.json').version.split('.')[0];

module.exports = {
  context: __dirname,
  entry: {
    entryA: './entryA.js',
    entryB: './entryB.js'
  },
  output: {
    path: path.join(__dirname, 'dist/webpack-' + webpackMajorVersion),
    publicPath: '',
    filename: '[name].js'
  },
  module: {
    rules: [
      { test: /\.css$/, use: ['style-loader', 'css-loader'] },
      { test: /\.png$/, loader: 'file-loader' }
    ]
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
      minSize: 0,
      maxAsyncRequests: 9,
      maxInitialRequests: 9,
      name: false,
      cacheGroups: {
        libMath: {
          test: /lib-(multiply|sum)/,
          name: 'libMath',
          chunks: 'all'
        },
        libText: {
          test: /lib-concat/,
          name: 'libText',
          chunks: 'all'
        }
      }
    }
  },
  plugins: [
    new HtmlWebpackPlugin({
      filename: 'entryA.html',
      chunks: ['entryA']
    }),
    new HtmlWebpackPlugin({
      filename: 'entryB.html',
      chunks: ['entryB']
    }),
    new HtmlWebpackPlugin({
      filename: 'entryC.html'
    })
  ]
};
