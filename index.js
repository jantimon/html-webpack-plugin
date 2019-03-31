// @ts-check
// Import types
/** @typedef {import("./typings").HtmlTagObject} HtmlTagObject */
/** @typedef {import("./typings").Options} HtmlWebpackOptions */
/** @typedef {import("./typings").ProcessedOptions} ProcessedHtmlWebpackOptions */
/** @typedef {import("./typings").TemplateParameter} TemplateParameter */
/** @typedef {import("webpack/lib/Compiler.js")} WebpackCompiler */
/** @typedef {import("webpack/lib/Compilation.js")} WebpackCompilation */
'use strict';
const { createHtmlTagObject, htmlTagObjectToString } = require('./lib/html-tags');
const masterCompiler = require('./masterCompiler.js');
const getHtmlWebpackPluginHooks = require('./lib/hooks.js').getHtmlWebpackPluginHooks;

class HtmlWebpackPlugin {
  /**
   * @param {HtmlWebpackOptions} [options]
   */
  constructor(options) {
    /** @type {HtmlWebpackOptions} */
    const userOptions = options || {};

    // Default options
    /** @type {ProcessedHtmlWebpackOptions} */
    const defaultOptions = {
      template: 'auto',
      templateContent: false,
      templateParameters: templateParametersGenerator,
      filename: 'index.html',
      hash: false,
      inject: true,
      compile: true,
      favicon: false,
      minify: 'auto',
      cache: true,
      showErrors: true,
      chunks: 'all',
      excludeChunks: [],
      chunksSortMode: 'auto',
      meta: {},
      base: false,
      title: 'Webpack App',
      xhtml: false
    };

    /** @type {ProcessedHtmlWebpackOptions} */
    this.options = Object.assign(defaultOptions, userOptions);

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
    const addedUpdatedplugin = compiler.options.plugins[0].constructor.name === 'HtmlWebpackPluginUpdated';

    if (addedUpdatedplugin) {
      return;
    }

    console.info('apply has been called')
    const htmlWebpackPlugins = compiler.options.plugins.filter((plugin) => plugin.constructor.name === 'HtmlWebpackPlugin')
    compiler.options.plugins = compiler.options.plugins.filter((plugin) => plugin.constructor.name !== 'HtmlWebpackPlugin')
    compiler.options.plugins.unshift(new masterCompiler(htmlWebpackPlugins, compiler));

    debugger;
    return;
  }
}

/**
 * The default for options.templateParameter
 * Generate the template parameters
 *
 * Generate the template parameters for the template function
 * @param {WebpackCompilation} compilation
 * @param {{
   publicPath: string,
   js: Array<string>,
   css: Array<string>,
   manifest?: string,
   favicon?: string
 }} assets
 * @param {{
     headTags: HtmlTagObject[],
     bodyTags: HtmlTagObject[]
   }} assetTags
 * @param {ProcessedHtmlWebpackOptions} options
 * @returns {TemplateParameter}
 */
function templateParametersGenerator(compilation, assets, assetTags, options) {
  const xhtml = options.xhtml;
  assetTags.headTags.toString = function () {
    return this.map((assetTagObject) => htmlTagObjectToString(assetTagObject, xhtml)).join('');
  };
  assetTags.bodyTags.toString = function () {
    return this.map((assetTagObject) => htmlTagObjectToString(assetTagObject, xhtml)).join('');
  };
  return {
    compilation: compilation,
    webpackConfig: compilation.options,
    htmlWebpackPlugin: {
      tags: assetTags,
      files: assets,
      options: options
    }
  };
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
