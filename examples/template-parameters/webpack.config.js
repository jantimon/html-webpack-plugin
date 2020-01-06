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
      // NOTE if you pass plain object it will be passed as is. no default values there, so be aware!
      // for implementation detail, please see index.js and search for "userOptions" variable
      templateParameters: (compilation, assets, assetTags, options) => {
        return {
          compilation,
          webpackConfig: compilation.options,
          htmlWebpackPlugin: {
            tags: assetTags,
            files: assets,
            options
          },
          'foo': 'bar'
        };
      },
      template: 'index.ejs'
    })
  ]
};
