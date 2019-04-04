const path = require('path');
const fs = require('fs');
const { templateParametersGenerator } = require("./templateParametersGenerator");

/** @typedef {import("../typings").ProcessedOptions} ProcessedHtmlWebpackOptions */
/** @typedef {import("../typings").MinifyOptions} MinifyOptions */

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

/**
 * 
 * @param {ProcessedHtmlWebpackOptions} options 
 * @param {*} compiler 
 * @returns {'auto' | boolean | MinifyOptions}
 */
function setMinifyOption(options, compiler) {
    // Check if webpack is running in production mode
    // @see https://github.com/webpack/webpack/blob/3366421f1784c449f415cda5930a8e445086f688/lib/WebpackOptionsDefaulter.js#L12-L14
    const isProductionLikeMode = compiler.options.mode === 'production' || !compiler.options.mode;

    let minify = options.minify;
    if (minify === true || (minify === 'auto' && isProductionLikeMode)) {
        minify = {
            // https://github.com/kangax/html-minifier#options-quick-reference
            collapseWhitespace: true,
            removeComments: true,
            removeRedundantAttributes: true,
            removeScriptTypeAttributes: true,
            removeStyleLinkTypeAttributes: true,
            useShortDoctype: true
        };
    }

    return minify;
}

/**
 * convert absolute filename into relative so that webpack can generate it at correct location
 * @param {ProcessedHtmlWebpackOptions} options 
 * @param {*} compiler
 * @return {string}
 */
function setFileNameOption(options, compiler) {
    const filename = options.filename;
    if (path.resolve(filename) === path.normalize(filename)) {
        options.filename = path.relative(compiler.options.output.path, filename);
    }

    // `contenthash` is introduced in webpack v4.3
    // which conflicts with the htmlWebpackPlugin's existing `contenthash` method,
    // hence it is renamed to `templatehash` to avoid conflicts
    return options.filename.replace(/\[(?:(\w+):)?contenthash(?::([a-z]+\d*))?(?::(\d+))?\]/ig, (match) => {
        return match.replace('contenthash', 'templatehash');
    });
}

/**
 * Helper to return the absolute template path with a fallback loader
 * @param {string} template
 * The path to the template e.g. './index.html'
 * @param {string} context
 * The webpack base resolution path for relative paths e.g. process.cwd()
 */
function setTemplateOption(template, context) {
    if (template === 'auto') {
        template = path.resolve(context, 'src/index.ejs');
        if (!fs.existsSync(template)) {
            template = path.join(__dirname, '../default_index.ejs');
        }
    }
    // If the template doesn't use a loader use the lodash template loader
    if (template.indexOf('!') === -1) {
        template = require.resolve('./loader.js') + '!' + path.resolve(context, template);
    }
    // Resolve template path
    return template.replace(
        /([!])([^/\\][^!?]+|[^/\\!?])($|\?[^!?\n]+$)/,
        (match, prefix, filepath, postfix) => prefix + path.resolve(filepath) + postfix);
}

module.exports = {
    defaultOptions,
    setMinifyOption,
    setFileNameOption,
    setTemplateOption
}