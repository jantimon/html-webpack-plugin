// @ts-check
/* eslint-disable */
/// <reference path="../typings.d.ts" />
/* eslint-enable */
'use strict';
/**
 * This file provides access to all public htmlWebpackPlugin hooks
 *
 * Usage:
 * ```js
 *  const getHtmlWebpackPluginHooks = require('html-webpack-plugin/lib/hooks').getHtmlWebpackPluginHooks;
 *
 *  compiler.hooks.compilation.tap('YOUR_PLUGIN_NAME', (compilation) => {
 *   const htmlWebpackPluginHooks = getHtmlWebpackPluginHooks(compilation);
 *   htmlWebpackPluginHooks.htmlWebpackPluginAfterEmit.tap('YOUR_PLUGIN_NAME', (pluginArgs) => {
 *     // your code
 *   });
 *  });
 * ```
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
 * Returns all public hooks of the html webpack plugin for the given compilation
 *
 * @param {WebpackCompilation} compilation
 * @returns {HtmlWebpackPluginHooks}
 */
function getHtmlWebpackPluginHooks (compilation) {
  /** @type {HtmlWebpackPluginHooks} */
  const hooks = compilation.hooks;
  // Setup the hooks only once
  if (!hooks.htmlWebpackPluginAfterEmit) {
    attachHooksToCompilation(compilation);
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
 * @param {WebpackCompilation} compilation
 */
function attachHooksToCompilation (compilation) {
  /** @type {HtmlWebpackPluginHooks} */
  const hooks = compilation.hooks;
  hooks.htmlWebpackPluginBeforeHtmlGeneration = new AsyncSeriesWaterfallHook(['pluginArgs']);
  hooks.htmlWebpackPluginBeforeHtmlProcessing = new AsyncSeriesWaterfallHook(['pluginArgs']);
  hooks.htmlWebpackPluginAlterAssetTags = new AsyncSeriesWaterfallHook(['pluginArgs']);
  hooks.htmlWebpackPluginAfterHtmlProcessing = new AsyncSeriesWaterfallHook(['pluginArgs']);
  hooks.htmlWebpackPluginAfterEmit = new AsyncSeriesWaterfallHook(['pluginArgs']);
}

/**
 * Small workaround helper to work around https://github.com/Microsoft/TypeScript/issues/1178
 * Returns the hook of the given name
 *
 * @type {
    <T extends keyof HtmlWebpackPluginHooks>(compilation: WebpackCompilation, hookName: T) => HtmlWebpackPluginHooks[T]
   }
 */
const getHtmlWebpackPluginHook = (compilation, hookName) => {
  const hooks = getHtmlWebpackPluginHooks(compilation);
  return /** @type {any} */hooks[hookName];
};

module.exports = {
  getHtmlWebpackPluginHooks,
  getHtmlWebpackPluginHook
};
