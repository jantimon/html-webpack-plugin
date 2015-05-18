var HtmlWebpackPlugin = require('..');
module.exports = {
  entry: './example.js',
  output: {
    path: __dirname + "/dist",
    publicPath: '/',
    filename: "bundle.js"
  },
  plugins: [
    new HtmlWebpackPlugin({
      favicon: 'favicon.ico',
      minify: {
        removeComments: true,
        collapseWhitespace: true,
        conservativeCollapse: false,
        minifyJS: true,
        minifyCSS: true
      }
    })
  ]
};