// @ts-check
// Import types
/** @typedef {import("./typings").HtmlTagObject} HtmlTagObject */
/** @typedef {import("./typings").Options} HtmlWebpackOptions */
/** @typedef {import("./typings").ProcessedOptions} ProcessedHtmlWebpackOptions */
/** @typedef {import("webpack/lib/Compiler.js")} WebpackCompiler */
'use strict';

const log = require('webpack-log');

const {createHtmlTagObject} = require('./lib/html-tags');
const {MultiHtmlWebpackPlugin} = require('./lib/MultiHtmlWebpackPlugin.js');
const {defaultOptions} = require('./lib/optionsHelper');
const {getHtmlWebpackPluginHooks} = require('./lib/hooks.js');

class HtmlWebpackPlugin {
  /**
   * @param {HtmlWebpackOptions} [options]
   */
  constructor (options) {
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
  apply (compiler) {
    // @ts-ignore
    const addedMultiHtmlWebpackPlugin = compiler.options.plugins[0] instanceof MultiHtmlWebpackPlugin;

    if (addedMultiHtmlWebpackPlugin) {
      return;
    }

    const logger = log({name: 'HtmlWebpackPlugin'});

    const htmlWebpackPlugins = this.getAllHtmlWebpackPlugins(compiler);
    compiler.options.plugins = this.getAllOtherPlugins(compiler);

    logger.debug('all HtmlWebpackPlugins have been removed and injected into multiHtmlWebpackPlugin');

    // inject multiHtmlWebpackPlugin into webpack config.plugins
    compiler.options.plugins.unshift(new MultiHtmlWebpackPlugin(htmlWebpackPlugins, compiler));
  }

  /**
   * @param {WebpackCompiler} compiler
   * returns all instances of HtmlWebpackPlugin from webpack config.plugins
   * @private
   */
  getAllHtmlWebpackPlugins (compiler) {
    // @ts-ignore
    return compiler.options.plugins.filter((plugin) => plugin instanceof HtmlWebpackPlugin);
  }

  /**
   * @param {WebpackCompiler} compiler
   * return all instances of all other plugins other then HtmlWebpackPlugin
   * @private
   */
  getAllOtherPlugins (compiler) {
    // @ts-ignore
    return compiler.options.plugins.filter((plugin) => !(plugin instanceof HtmlWebpackPlugin));
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
