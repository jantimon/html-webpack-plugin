// @ts-check
/** @typedef {import("webpack/lib/Compilation.js")} WebpackCompilation */
/** @typedef {import("webpack/lib/Compiler.js")} WebpackCompiler */
/** @typedef {import("webpack/lib/Chunk.js")} WebpackChunk */
'use strict';
/**
 * @file
 * This file uses webpack to compile a template with a child compiler.
 *
 * [TEMPLATE] -> [JAVASCRIPT]
 *
 */
'use strict';
const NodeTemplatePlugin = require('webpack/lib/node/NodeTemplatePlugin');
const NodeTargetPlugin = require('webpack/lib/node/NodeTargetPlugin');
const LoaderTargetPlugin = require('webpack/lib/LoaderTargetPlugin');
const LibraryTemplatePlugin = require('webpack/lib/LibraryTemplatePlugin');
const SingleEntryPlugin = require('webpack/lib/SingleEntryPlugin');

/**
 * The HtmlWebpackChildCompiler is a helper to allow resusing one childCompiler
 * for multile HtmlWebpackPlugin instances to improve the compilation performance.
 */
class HtmlWebpackChildCompiler {
  constructor () {
    /**
     * @type {string[]} templateIds
     * The template array will allow us to keep track which input generated which output
     */
    this.templates = [];
    /**
     * @type {Promise<{[templatePath: string]: { content: string, hash: string, entry: WebpackChunk }}>}
     */
    this.compilationPromise;
    /**
     * @type {Date}
     */
    this.compilationStarted;
    /**
     * All file dependencies of the child compiler
     * @type {string[]}
     */
    this.fileDependencies = [];
  }

  /**
   * Add a templatePath to the child compiler
   * The given template will be compiled by `compileTemplates`
   * @param {string} template - The webpack path to the template e.g. `'!!html-loader!index.html'`
   */
  addTemplate (template) {
    const templateId = this.templates.indexOf(template);
    // Don't add the template to the compiler if a similar template was already added
    if (templateId !== -1) {
      return templateId;
    }
    // A child compiler can compile only once
    // throw an error if a new template is added after the compilation started
    if (this.compilationPromise) {
      throw new Error('New templates can only be added before `compileTemplates` was called.');
    }
    // Add the template to the childCompiler
    const newTemplateId = this.templates.length;
    this.templates.push(template);
    return newTemplateId;
  }

  /**
   * This function will start the template compilation
   * once it is started no more templates can be added
   *
   * @param {WebpackCompilation} mainCompilation
   * @returns {Promise<{[templatePath: string]: { content: string, hash: string, entry: WebpackChunk }}>}
   */
  compileTemplates (mainCompilation) {
    // To prevent multiple compilations for the same template
    // the compilation is cached in a promise.
    // If it already exists return
    if (this.compilationPromise) {
      return this.compilationPromise;
    }

    // The entry file is just an empty helper as the dynamic template
    // require is added in "loader.js"
    const outputOptions = {
      filename: '__child-[name]',
      publicPath: mainCompilation.outputOptions.publicPath
    };
    const compilerName = 'HtmlWebpackCompiler';
    // Create an additional child compiler which takes the template
    // and turns it into an Node.JS html factory.
    // This allows us to use loaders during the compilation
    const childCompiler = mainCompilation.createChildCompiler(compilerName, outputOptions);
    // The file path context which webpack uses to resolve all relative files to
    childCompiler.context = mainCompilation.compiler.context;
    // Compile the template to nodejs javascript
    new NodeTemplatePlugin(outputOptions).apply(childCompiler);
    new NodeTargetPlugin().apply(childCompiler);
    new LibraryTemplatePlugin('HTML_WEBPACK_PLUGIN_RESULT', 'var').apply(childCompiler);
    new LoaderTargetPlugin('node').apply(childCompiler);

    // Fix for "Uncaught TypeError: __webpack_require__(...) is not a function"
    // Hot module replacement requires that every child compiler has its own
    // cache. @see https://github.com/ampedandwired/html-webpack-plugin/pull/179
    childCompiler.hooks.compilation.tap('HtmlWebpackPlugin', compilation => {
      if (compilation.cache) {
        if (!compilation.cache[compilerName]) {
          compilation.cache[compilerName] = {};
        }
        compilation.cache = compilation.cache[compilerName];
      }
    });

    // Add all templates
    this.templates.forEach((template, index) => {
      new SingleEntryPlugin(childCompiler.context, template, `HtmlWebpackPlugin_${index}`).apply(childCompiler);
    });

    this.compilationStarted = new Date();
    this.compilationPromise = new Promise((resolve, reject) => {
      childCompiler.runAsChild((err, entries, childCompilation) => {
        // Extract templates
        const compiledTemplates = entries
          ? extractHelperFilesFromCompilation(mainCompilation, childCompilation, outputOptions.filename, entries)
          : [];
        // Extract file dependencies
        if (entries) {
          this.fileDependencies = extractFileDependenciesFilesFromCompilation(entries);
        }
        // Reject the promise if the childCompilation contains error
        if (childCompilation && childCompilation.errors && childCompilation.errors.length) {
          const errorDetails = childCompilation.errors.map(error => error.message + (error.error ? ':\n' + error.error : '')).join('\n');
          reject(new Error('Child compilation failed:\n' + errorDetails));
          return;
        }
        // Reject if the error object contains errors
        if (err) {
          reject(err);
          return;
        }
        /**
         * @type {{[templatePath: string]: { content: string, hash: string, entry: WebpackChunk }}}
         */
        const result = {};
        compiledTemplates.forEach((templateSource, entryIndex) => {
          // The compiledTemplates are generated from the entries added in
          // the addTemplate function.
          // Therefore the array index of this.templates should be the as entryIndex.
          result[this.templates[entryIndex]] = {
            content: templateSource,
            hash: childCompilation.hash,
            entry: entries[entryIndex]
          };
        });
        resolve(result);
      });
    });

    return this.compilationPromise;
  }
}

/**
 * The webpack child compilation will create files as a side effect.
 * This function will extract them and clean them up so they won't be written to disk.
 *
 * Returns the source code of the compiled templates as string
 *
 * @returns Array<string>
 */
function extractHelperFilesFromCompilation (mainCompilation, childCompilation, filename, childEntryChunks) {
  const helperAssetNames = childEntryChunks.map((entryChunk, index) => {
    return mainCompilation.mainTemplate.hooks.assetPath.call(filename, {
      hash: childCompilation.hash,
      chunk: entryChunk,
      name: `HtmlWebpackPlugin_${index}`
    });
  });

  helperAssetNames.forEach((helperFileName) => {
    delete mainCompilation.assets[helperFileName];
  });

  const helperContents = helperAssetNames.map((helperFileName) => {
    return childCompilation.assets[helperFileName].source();
  });

  return helperContents;
}

/**
 * Return all file dependencies from the given set of entries.
 * @param {WebpackChunk[]} entries
 * @returns {string[]}
 */
function extractFileDependenciesFilesFromCompilation (entries) {
  const fileDependencies = new Map();
  entries.forEach((entry) => {
    entry.entryModule.buildInfo.fileDependencies.forEach((fileDependency) => {
      fileDependencies.set(fileDependency, true);
    });
  });
  return Array.from(fileDependencies.keys());
}

/**
 * @type {WeakMap<WebpackCompiler, HtmlWebpackChildCompiler>}}
 */
const childCompilerCache = new WeakMap();

/**
 * Get child compiler from cache or a new child compiler for the given mainCompilation
 *
 * @param {WebpackCompiler} mainCompiler
 */
function getChildCompiler (mainCompiler) {
  if (!childCompilerCache[mainCompiler]) {
    childCompilerCache[mainCompiler] = new HtmlWebpackChildCompiler();
  }
  return childCompilerCache[mainCompiler];
}

/**
 * Remove the childCompiler from the cache
 *
 * @param {WebpackCompiler} mainCompiler
 */
function clearCache (mainCompiler) {
  delete (childCompilerCache[mainCompiler]);
}

/**
 * Register a template for the current main compiler
 * @param {WebpackCompiler} mainCompiler
 * @param {string} templatePath
 */
function addTemplateToCompiler (mainCompiler, templatePath) {
  getChildCompiler(mainCompiler).addTemplate(templatePath);
}

/**
 * Starts the compilation for all templates.
 * This has to be called once all templates where added.
 *
 * If this function is called multiple times it will use a cache inside
 * the childCompiler
 *
 * @param {string} templatePath
 * @param {string} outputFilename
 * @param {WebpackCompilation} mainCompilation
 */
function compileTemplate (templatePath, outputFilename, mainCompilation) {
  const childCompiler = getChildCompiler(mainCompilation.compiler);
  return childCompiler.compileTemplates(mainCompilation).then((compiledTemplates) => {
    const compiledTemplate = compiledTemplates[templatePath];
    // Replace [hash] placeholders in filename
    const outputName = mainCompilation.mainTemplate.hooks.assetPath.call(outputFilename, {
      hash: compiledTemplate.hash,
      chunk: compiledTemplate.entry
    });
    return {
      // Hash of the template entry point
      hash: compiledTemplate.hash,
      // Output name
      outputName: outputName,
      // Compiled code
      content: compiledTemplate.content
    };
  });
}

module.exports = {
  addTemplateToCompiler,
  compileTemplate,
  clearCache
};
