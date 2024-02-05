var path = require("path");
var HtmlWebpackPlugin = require("../..");
var MiniCssExtractPlugin = require("mini-css-extract-plugin");
var webpackMajorVersion = require("webpack/package.json").version.split(".")[0];

module.exports = {
  context: __dirname,
  entry: "./example.js",
  output: {
    path: path.join(__dirname, "dist/webpack-" + webpackMajorVersion),
    publicPath: "",
    filename: "bundle.js",
  },
  module: {
    rules: [
      { test: /\.css$/, use: [MiniCssExtractPlugin.loader, "css-loader"] },
      { test: /\.png$/, type: "asset/resource" },
      { test: /\.html$/, loader: "html-loader" },
    ],
  },
  devtool: "eval",
  plugins: [
    new HtmlWebpackPlugin({
      template: "template.js",
    }),
    new MiniCssExtractPlugin({ filename: "styles.css" }),
  ],
};
