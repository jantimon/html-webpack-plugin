/** @typedef {import("../typings").TemplateParameter} TemplateParameter */
/** @typedef {import("../typings").ProcessedOptions} ProcessedHtmlWebpackOptions */
/** @typedef {import("../typings").HtmlTagObject} HtmlTagObject */
/** @typedef {import("webpack/lib/Compilation.js")} WebpackCompilation */

const {htmlTagObjectToString} = require('./html-tags');

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
function templateParametersGenerator (compilation, assets, assetTags, options) {
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

module.exports = {
  templateParametersGenerator
};
