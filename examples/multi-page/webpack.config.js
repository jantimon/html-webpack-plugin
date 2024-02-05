var path = require("path");
var HtmlWebpackPlugin = require("../..");
var webpackMajorVersion = require("webpack/package.json").version.split(".")[0];

module.exports = {
  context: __dirname,
  entry: {
    first: "./first.js",
    second: "./second.js",
  },
  output: {
    path: path.join(__dirname, "dist/webpack-" + webpackMajorVersion),
    publicPath: "",
    filename: "[name].js",
  },
  module: {
    rules: [
      { test: /\.css$/, use: ["style-loader", "css-loader"] },
      { test: /\.png$/, type: "asset/resource" },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      filename: "[name].html",
    }),
  ],
};
