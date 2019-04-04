// @ts-check
// Import types
/** @typedef {import("./typings").HtmlTagObject} HtmlTagObject */
/** @typedef {import("./typings").Options} HtmlWebpackOptions */
/** @typedef {import("./typings").ProcessedOptions} ProcessedHtmlWebpackOptions */
/** @typedef {import("webpack/lib/Compiler.js")} WebpackCompiler */
/** @typedef {import("webpack/lib/Compilation.js")} WebpackCompilation */
'use strict';

const log = require('webpack-log');

const { createHtmlTagObject } = require('./lib/html-tags');
const { multiHtmlWebpackPlugin } = require('./lib/multiHtmlWebpackPlugin.js');
const { defaultOptions } = require('./lib/optionsHelper');
const getHtmlWebpackPluginHooks = require('./lib/hooks.js').getHtmlWebpackPluginHooks;

class HtmlWebpackPlugin {
  /**
   * @param {HtmlWebpackOptions} [options]
   */
  constructor(options) {
    /** @type {HtmlWebpackOptions} */
    const userOptions = options || {};

    /** @type {ProcessedHtmlWebpackOptions} */
    this.options = Object.assign({}, defaultOptions, userOptions);

    // Default metaOptions if no template is provided
    if (!userOptions.template && this.options.templateContent === false && this.options.meta) {
      const defaultMeta = {
        // From https://developer.mozilla.org/en-US/docs/Mozilla/Mobile/Viewport_meta_tag
        viewport: 'width=device-width, initial-scale=1'
      };
      this.options.meta = Object.assign({}, this.options.meta, defaultMeta, userOptions.meta);
    }

    // Instance variables to keep caching information
    // for multiple builds
    this.childCompilerHash = undefined;
    /**
     * @type {string | undefined}
     */
    this.childCompilationOutputName = undefined;
    this.assetJson = undefined;
    this.hash = undefined;
    this.version = HtmlWebpackPlugin.version;
  }

  /**
   * apply is called by the webpack main compiler during the start phase
   * @param {WebpackCompiler} compiler
   */
  apply(compiler) {
    const addedUpdatedplugin = compiler.options.plugins[0] instanceof multiHtmlWebpackPlugin;

    if (addedUpdatedplugin) {
      return;
    }

    const htmlWebpackPlugins = compiler.options.plugins.filter((plugin) => plugin instanceof HtmlWebpackPlugin)
    compiler.options.plugins = compiler.options.plugins.filter((plugin) => !(plugin instanceof HtmlWebpackPlugin))
    compiler.options.plugins.unshift(new multiHtmlWebpackPlugin(htmlWebpackPlugins, compiler));

    const logger = log({ name: 'HtmlWebpackPlugin' })
    logger.info('all HtmlWebpackPlugins have been removed and injected into multiHtmlWebpackPlugin')
  }
}

// Statics:
/**
 * The major version number of this plugin
 */
HtmlWebpackPlugin.version = 4;

/**
 * A static helper to get the hooks for this plugin
 *
 * Usage: HtmlWebpackPlugin.getHooks(compilation).HOOK_NAME.tapAsync('YourPluginName', () => { ... });
 */
HtmlWebpackPlugin.getHooks = getHtmlWebpackPluginHooks;
HtmlWebpackPlugin.createHtmlTagObject = createHtmlTagObject;

module.exports = HtmlWebpackPlugin;
