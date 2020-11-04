// @ts-check
// Import types
/** @typedef {import("webpack/lib/Compilation.js").PathData} WebpackPathData */
/** @typedef {import("webpack/lib/Compilation.js").AssetInfo} WebpackAssetInfo */
/** @typedef {import("webpack/lib/Compilation.js")} WebpackCompilation */
/** @typedef {import("webpack/lib/Compiler.js")} WebpackCompiler */
'use strict';

const { resolveWebpack } = require('webpack-import-plugins');

/**
 * getAssetPath polyfill for webpack@4 and webpack@5
 * Known issues: https://github.com/webpack/webpack/issues/10707
 * Webpack 5
 * https://github.com/webpack/webpack/blob/923be31fba88468b70499428e1f2b83aad49af84/lib/Compilation.js#L3288
 * Webpack 4
 * https://github.com/webpack/webpack/blob/c572c15a413ef7d086b52ccc78d9512a192954d7/lib/MainTemplate.js#L520
 * @param {WebpackCompilation} compilation
 * @param {string | function(WebpackPathData, WebpackAssetInfo=): string} filename used to get asset path with hash
 * @param {WebpackPathData} data context data
 * @returns {string} interpolated path
 */
const getAssetPath = (compilation, filename, data) => compilation.getAssetPath
  ? compilation.getAssetPath(filename, data)
  : compilation.mainTemplate.getAssetPath(filename, data);

/**
 * getPublicPath polyfill for webpack@4 and webpack@5
 * Known issues: https://github.com/jantimon/html-webpack-plugin/issues/1408
 * Webpack 4
 * https://github.com/webpack/webpack/blob/c572c15a413ef7d086b52ccc78d9512a192954d7/lib/MainTemplate.js#L513
 * @param {WebpackCompilation} compilation
 * @param {object} options get public path options
 * @returns {string} hook call
 */
const getPublicPath = (compilation, options) => compilation.getAssetPath
  ? compilation.getAssetPath(compilation.outputOptions.publicPath, options)
  : compilation.mainTemplate.getPublicPath(options);

const isWebpack4 = () => Number(require(resolveWebpack('package.json')).version.split('.')[0]) === 4;

module.exports = {
  getAssetPath,
  getPublicPath,
  isWebpack4
};
