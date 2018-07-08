// @ts-check
/* eslint-disable */
/// <reference path="../typings.d.ts" />
/* eslint-enable */
'use strict';
/**
 * This file provides access to all public htmlWebpackPlugin hooks
 */

/** @typedef {import("webpack/lib/Compilation.js")} WebpackCompilation */
/** @typedef {import("../index.js")} HtmlWebpackPlugin */

const AsyncSeriesWaterfallHook = require('tapable').AsyncSeriesWaterfallHook;

// The following typedef holds the API definition for all available hooks
// to allow easier access when using ts-check or typescript inside plugins
/** @typedef {{
  htmlWebpackPluginBeforeHtmlGeneration:
    AsyncSeriesWaterfallHook<{
      assets: {
        publicPath: string,
        js: Array<{entryName: string, path: string}>,
        css: Array<{entryName: string, path: string}>,
      },
      outputName: string,
      plugin: HtmlWebpackPlugin
    }>,
  htmlWebpackPluginBeforeHtmlProcessing:
    AsyncSeriesWaterfallHook<{
      html: string,
      assets: {
        publicPath: string,
        js: Array<{entryName: string, path: string}>,
        css: Array<{entryName: string, path: string}>,
      },
      outputName: string,
      plugin: HtmlWebpackPlugin,
    }>,
  htmlWebpackPluginAfterHtmlProcessing:
    AsyncSeriesWaterfallHook<{
      html: string,
      assets: {
        publicPath: string,
        js: Array<{entryName: string, path: string}>,
        css: Array<{entryName: string, path: string}>,
      },
      outputName: string,
      plugin: HtmlWebpackPlugin,
    }>,
  htmlWebpackPluginAlterAssetTags:
    AsyncSeriesWaterfallHook<{
      head: Array<HtmlTagObject>,
      body: Array<HtmlTagObject>,
      outputName: string,
      plugin: HtmlWebpackPlugin
    }>,
  htmlWebpackPluginAfterEmit:
    AsyncSeriesWaterfallHook<{
      html: string,
      outputName: string,
      plugin: HtmlWebpackPlugin
    }>,
  }} HtmlWebpackPluginHooks
  */

/**
 * @type {WeakMap<WebpackCompilation, HtmlWebpackPluginHooks>}}
 */
const htmlWebpackPluginHooksMap = new WeakMap();

/**
 * Returns all public hooks of the html webpack plugin for the given compilation
 *
 * @param {WebpackCompilation} compilation
 * @returns {HtmlWebpackPluginHooks}
 */
function getHtmlWebpackPluginHooks (compilation) {
  let hooks = htmlWebpackPluginHooksMap.get(compilation);
  // Setup the hooks only once
  if (hooks === undefined) {
    hooks = createHtmlWebpackPluginHooks();
    htmlWebpackPluginHooksMap.set(compilation, hooks);
  }
  return {
    htmlWebpackPluginBeforeHtmlGeneration: hooks.htmlWebpackPluginBeforeHtmlGeneration,
    htmlWebpackPluginBeforeHtmlProcessing: hooks.htmlWebpackPluginBeforeHtmlProcessing,
    htmlWebpackPluginAlterAssetTags: hooks.htmlWebpackPluginAlterAssetTags,
    htmlWebpackPluginAfterHtmlProcessing: hooks.htmlWebpackPluginAfterHtmlProcessing,
    htmlWebpackPluginAfterEmit: hooks.htmlWebpackPluginAfterEmit
  };
}

/**
 * Add hooks to the webpack compilation object to allow foreign plugins to
 * extend the HtmlWebpackPlugin
 *
 * @returns {HtmlWebpackPluginHooks}
 */
function createHtmlWebpackPluginHooks () {
  return {
    htmlWebpackPluginBeforeHtmlGeneration: new AsyncSeriesWaterfallHook(['pluginArgs']),
    htmlWebpackPluginBeforeHtmlProcessing: new AsyncSeriesWaterfallHook(['pluginArgs']),
    htmlWebpackPluginAlterAssetTags: new AsyncSeriesWaterfallHook(['pluginArgs']),
    htmlWebpackPluginAfterHtmlProcessing: new AsyncSeriesWaterfallHook(['pluginArgs']),
    htmlWebpackPluginAfterEmit: new AsyncSeriesWaterfallHook(['pluginArgs'])
  };
}

module.exports = {
  getHtmlWebpackPluginHooks
};
