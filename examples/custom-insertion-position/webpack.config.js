var path = require('path');
var HtmlWebpackPlugin = require('../..');
var webpackMajorVersion = require('webpack/package.json').version.split('.')[0];
module.exports = {
  context: __dirname,
  entry: './example.js',
  output: {
    path: path.join(__dirname, 'dist/webpack-' + webpackMajorVersion),
    publicPath: '',
    filename: 'bundle.js'
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: 'index.ejs',
      inject: false,
      // The following settings are optional and only used for
      // demo purposes:
      meta: {
        charset: { charset: 'utf-8' },
        viewport: 'width=device-width, initial-scale=1'
      },
      minify: false
    })
  ]
};
