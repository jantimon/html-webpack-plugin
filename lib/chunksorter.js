// @ts-check
/** @typedef {import("webpack/lib/Compilation.js")} WebpackCompilation */
'use strict';

/**
 * @type {{[sortmode: string] : (chunkNames: Array<string>, compilation, htmlWebpackPluginOptions) => Array<string> }}
 * This file contains different sort methods for the entry chunks names
 */
module.exports = {};

/**
 * Performs identity mapping (no-sort).
 * @param  {Array} chunks the chunks to sort
 * @return {Array} The sorted chunks
 */
module.exports.none = chunks => chunks;

/**
 * Sort manually by the chunks
 * @param  {string[]} chunkNames the chunks to sort
 * @param  {WebpackCompilation} compilation the webpack compilation
 * @param  htmlWebpackPluginOptions the plugin options
 * @return {string[]} The sorted chunks
 */
module.exports.manual = (chunkNames, compilation, htmlWebpackPluginOptions) => {
  const chunks = htmlWebpackPluginOptions.chunks;
  if (!Array.isArray(chunks)) {
    return chunkNames;
  }
  // Remove none existing entries from
  // htmlWebpackPluginOptions.chunks
  return chunks.filter((chunkName) => {
    return compilation.namedChunks.has(chunkName);
  });
};

/**
 * Defines the default sorter.
 */
module.exports.auto = module.exports.none;
