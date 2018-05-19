// @ts-check
/** @typedef {import("webpack/lib/Compilation.js")} WebpackCompilation */
'use strict';

// Import webpack types using commonjs
// As we use only the type we have to prevent warnings about unused varaibles
/* eslint-disable */
const WebpackCompilation = require('webpack/lib/Compilation');
/* eslint-enable */

/**
 * @type {{[sortmode: string] : (entryPointNames: Array<string>, compilation, htmlWebpackPluginOptions) => Array<string> }}
 * This file contains different sort methods for the entry chunks names
 */
const sortFunctions = {};
module.exports = sortFunctions;

/**
 * Performs identity mapping (no-sort).
 * @param  {Array} chunks the chunks to sort
 * @return {Array} The sorted chunks
 */
sortFunctions.none = chunks => chunks;

/**
 * Sort manually by the chunks
 * @param  {string[]} entryPointNames the chunks to sort
 * @param  {WebpackCompilation} compilation the webpack compilation
 * @param  htmlWebpackPluginOptions the plugin options
 * @return {string[]} The sorted chunks
 */
sortFunctions.manual = (entryPointNames, compilation, htmlWebpackPluginOptions) => {
  const chunks = htmlWebpackPluginOptions.chunks;
  if (!Array.isArray(chunks)) {
    return entryPointNames;
  }
  // Remove none existing entries from
  // htmlWebpackPluginOptions.chunks
  return chunks.filter((entryPointName) => {
    return compilation.entrypoints.has(entryPointName);
  });
};

/**
 * Defines the default sorter.
 */
sortFunctions.auto = module.exports.none;
