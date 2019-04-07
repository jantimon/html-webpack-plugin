// @ts-check
// Import types
/** @typedef {import("./typings").HtmlTagObject} HtmlTagObject */
/** @typedef {import("./typings").Options} HtmlWebpackOptions */
/** @typedef {import("./typings").ProcessedOptions} ProcessedHtmlWebpackOptions */
/** @typedef {import("./typings").TemplateParameter} TemplateParameter */
/** @typedef {import("webpack/lib/Compiler.js")} WebpackCompiler */
/** @typedef {import("webpack/lib/Compilation.js")} WebpackCompilation */
'use strict';

// use Polyfill for util.promisify in node versions < v8
const promisify = require('util.promisify');

const vm = require('vm');
const fs = require('fs');
const _ = require('lodash');
const log = require('webpack-log');
const path = require('path');

const { createHtmlTagObject, htmlTagObjectToString } = require('./lib/html-tags');

const childCompiler = require('./lib/compiler.js');
const { MultiHtmlWebpackPlugin } = require('./lib/multiHtmlWebpackPlugin.js');
const prettyError = require('./lib/errors.js');
const chunkSorter = require('./lib/chunksorter.js');
const getHtmlWebpackPluginHooks = require('./lib/hooks.js').getHtmlWebpackPluginHooks;
const { defaultOptions, setFileNameOption, setMinifyOption, setTemplateOption } = require('./lib/optionsHelper.js');

const fsStatAsync = promisify(fs.stat);
const fsReadFileAsync = promisify(fs.readFile);

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

    this.isCompilationCached = false;
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

  /**
   * updates options with data from compiler
   * @param {WebpackCompiler} compiler
   */
  updateOptions (compiler) {
    this.options.template = setTemplateOption(this.options.template, compiler.context);
    this.options.filename = setFileNameOption(this.options, compiler);
    this.options.minify = setMinifyOption(this.options, compiler);
  }

  /**
   * @param {WebpackCompiler} compiler
   * @param {WebpackCompilation} compilation
   */
  updateChildCompiler (compiler, compilation) {
    // Clear the cache if the child compiler is outdated
    if (childCompiler.hasOutDatedTemplateCache(compilation)) {
      childCompiler.clearCache(compiler);
    }

    // Add all templates to the child compiler
    childCompiler.addTemplateToCompiler(compiler, this.options.template);
  }

  /**
   * @param {WebpackCompiler} compiler
   * @param {WebpackCompilation} compilation
   */
  addFileDependencies (compiler, compilation) {
    const childCompilerDependencies = childCompiler.getFileDependencies(compiler);
    childCompilerDependencies.forEach(fileDependency => {
      compilation.compilationDependencies.add(fileDependency);
    });
  }

  compileTemplate (compiler, compilation) {
    return childCompiler.compileTemplate(this.options.template, this.options.filename, compilation)
      .catch(err => {
        compilation.errors.push(prettyError(err, compiler.context).toString());
        return {
          content: this.options.showErrors ? prettyError(err, compiler.context).toJsonHtml() : 'ERROR',
          outputName: this.options.filename,
          hash: ''
        };
      })
      .then(compilationResult => {
        // If the compilation change didnt change the cache is valid
        this.isCompilationCached = Boolean(compilationResult.hash) && this.childCompilerHash === compilationResult.hash;
        this.childCompilerHash = compilationResult.hash;
        this.childCompilationOutputName = compilationResult.outputName;
        return compilationResult.content;
      });
  }

  /**
   * Evaluates the child compilation result
   * @param {WebpackCompilation} compilation
   * @param {string} source
   * @returns {Promise<string | (() => string | Promise<string>)>}
   */
  evaluateCompilationResult (compilation, source) {
    if (!source) {
      return Promise.reject(new Error('The child compilation didn\'t provide a result'));
    }
    // The LibraryTemplatePlugin stores the template result in a local variable.
    // To extract the result during the evaluation this part has to be removed.
    source = source.replace('var HTML_WEBPACK_PLUGIN_RESULT =', '');
    const template = this.options.template.replace(/^.+!/, '').replace(/\?.+$/, '');
    const vmContext = vm.createContext(_.extend({HTML_WEBPACK_PLUGIN: true, require: require}, global));
    const vmScript = new vm.Script(source, {filename: template});
    // Evaluate code and cast to string
    let newSource;
    try {
      newSource = vmScript.runInContext(vmContext);
    } catch (e) {
      return Promise.reject(e);
    }
    if (typeof newSource === 'object' && newSource.__esModule && newSource.default) {
      newSource = newSource.default;
    }
    return typeof newSource === 'string' || typeof newSource === 'function'
      ? Promise.resolve(newSource)
      : Promise.reject(new Error('The loader "' + this.options.template + '" didn\'t return html.'));
  }

  /**
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
   * @returns {Promise<{[key: any]: any}>}
   */
  getTemplateParameters (compilation, assets, assetTags) {
    const templateParameters = this.options.templateParameters;
    if (templateParameters === false) {
      return Promise.resolve({});
    }
    if (typeof templateParameters === 'function') {
      return Promise
        .resolve()
        .then(() => templateParameters(compilation, assets, assetTags, this.options));
    }
    if (typeof templateParameters === 'object') {
      return Promise.resolve(templateParameters);
    }
    throw new Error('templateParameters has to be either a function or an object');
  }

  /**
   * This function renders the actual html by executing the template function
   *
   * @param {(templateParameters) => string | Promise<string>} templateFunction
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
   * @param {WebpackCompilation} compilation
   *
   * @returns Promise<string>
   */
  executeTemplate (templateFunction, assets, assetTags, compilation) {
    // Template processing
    const templateParamsPromise = this.getTemplateParameters(compilation, assets, assetTags);
    return templateParamsPromise.then((templateParams) => {
      try {
        // If html is a promise return the promise
        // If html is a string turn it into a promise
        return templateFunction(templateParams);
      } catch (e) {
        compilation.errors.push(new Error('Template execution failed: ' + e));
        return Promise.reject(e);
      }
    });
  }

  /**
   * Html Post processing
   *
   * @param {any} html
   * The input html
   * @param {any} assets
   * @param {{
       headTags: HtmlTagObject[],
       bodyTags: HtmlTagObject[]
     }} assetTags
   * The asset tags to inject
   *
   * @returns {Promise<string>}
   */
  postProcessHtml (html, assets, assetTags) {
    if (typeof html !== 'string') {
      return Promise.reject(new Error('Expected html to be a string but got ' + JSON.stringify(html)));
    }
    const htmlAfterInjection = this.options.inject
      ? this.injectAssetsIntoHtml(html, assets, assetTags)
      : html;
    const htmlAfterMinification = typeof this.options.minify === 'object'
      ? require('html-minifier').minify(htmlAfterInjection, this.options.minify)
      : htmlAfterInjection;
    return Promise.resolve(htmlAfterMinification);
  }

  /*
   * Pushes the content of the given filename to the compilation assets
   * @param {string} filename
   * @param {WebpackCompilation} compilation
   *
   * @returns {string} file basename
   */
  addFileToAssets (filename, compilation) {
    filename = path.resolve(compilation.compiler.context, filename);
    return Promise.all([
      fsStatAsync(filename),
      fsReadFileAsync(filename)
    ])
      .then(([size, source]) => {
        return {
          size,
          source
        };
      })
      .catch(() => Promise.reject(new Error('HtmlWebpackPlugin: could not load file ' + filename)))
      .then(results => {
        const basename = path.basename(filename);
        compilation.fileDependencies.add(filename);
        compilation.assets[basename] = {
          source: () => results.source,
          size: () => results.size.size
        };
        return basename;
      });
  }

  /**
   * Helper to sort chunks
   * @param {string[]} entryNames
   * @param {string|((entryNameA: string, entryNameB: string) => number)} sortMode
   * @param {WebpackCompilation} compilation
   */
  sortEntryChunks (entryNames, sortMode, compilation) {
    // Custom function
    if (typeof sortMode === 'function') {
      return entryNames.sort(sortMode);
    }
    // Check if the given sort mode is a valid chunkSorter sort mode
    if (typeof chunkSorter[sortMode] !== 'undefined') {
      return chunkSorter[sortMode](entryNames, compilation, this.options);
    }
    throw new Error('"' + sortMode + '" is not a valid chunk sort mode');
  }

  /**
   * Return all chunks from the compilation result which match the exclude and include filters
   * @param {any} chunks
   * @param {string[]|'all'} includedChunks
   * @param {string[]} excludedChunks
   */
  filterChunks (chunks, includedChunks, excludedChunks) {
    return chunks.filter(chunkName => {
      // Skip if the chunks should be filtered and the given chunk was not added explicity
      if (Array.isArray(includedChunks) && includedChunks.indexOf(chunkName) === -1) {
        return false;
      }
      // Skip if the chunks should be filtered and the given chunk was excluded explicity
      if (Array.isArray(excludedChunks) && excludedChunks.indexOf(chunkName) !== -1) {
        return false;
      }
      // Add otherwise
      return true;
    });
  }

  /**
   * Check if the given asset object consists only of hot-update.js files
   *
   * @param {{
      publicPath: string,
      js: Array<string>,
      css: Array<string>,
      manifest?: string,
      favicon?: string
    }} assets
   */
  isHotUpdateCompilation (assets) {
    return assets.js.length && assets.js.every((assetPath) => /\.hot-update\.js$/.test(assetPath));
  }

  /**
   * The htmlWebpackPluginAssets extracts the asset information of a webpack compilation
   * for all given entry names
   * @param {WebpackCompilation} compilation
   * @param {string[]} entryNames
   * @returns {{
      publicPath: string,
      js: Array<string>,
      css: Array<string>,
      manifest?: string,
      favicon?: string
    }}
   */
  htmlWebpackPluginAssets (compilation, childCompilationOutputName, entryNames) {
    const compilationHash = compilation.hash;

    /**
     * @type {string} the configured public path to the asset root
     * if a path publicPath is set in the current webpack config use it otherwise
     * fallback to a realtive path
     */
    const webpackPublicPath = compilation.mainTemplate.getPublicPath({hash: compilationHash});
    const isPublicPathDefined = webpackPublicPath.trim() !== '';
    let publicPath = isPublicPathDefined
      // If a hard coded public path exists use it
      ? webpackPublicPath
      // If no public path was set get a relative url path
      : path.relative(path.resolve(compilation.options.output.path, path.dirname(childCompilationOutputName)), compilation.options.output.path)
        .split(path.sep).join('/');

    if (publicPath.length && publicPath.substr(-1, 1) !== '/') {
      publicPath += '/';
    }

    /**
     * @type {{
        publicPath: string,
        js: Array<string>,
        css: Array<string>,
        manifest?: string,
        favicon?: string
      }}
     */
    const assets = {
      // The public path
      publicPath: publicPath,
      // Will contain all js files
      js: [],
      // Will contain all css files
      css: [],
      // Will contain the html5 appcache manifest files if it exists
      manifest: Object.keys(compilation.assets).find(assetFile => path.extname(assetFile) === '.appcache'),
      // Favicon
      favicon: undefined
    };

    // Append a hash for cache busting
    if (this.options.hash && assets.manifest) {
      assets.manifest = this.appendHash(assets.manifest, compilationHash);
    }

    // Extract paths to .js and .css files from the current compilation
    const entryPointPublicPathMap = {};
    const extensionRegexp = /\.(css|js)(\?|$)/;
    for (let i = 0; i < entryNames.length; i++) {
      const entryName = entryNames[i];
      const entryPointFiles = compilation.entrypoints.get(entryName).getFiles();
      // Prepend the publicPath and append the hash depending on the
      // webpack.output.publicPath and hashOptions
      // E.g. bundle.js -> /bundle.js?hash
      const entryPointPublicPaths = entryPointFiles
        .map(chunkFile => {
          const entryPointPublicPath = publicPath + chunkFile;
          return this.options.hash
            ? this.appendHash(entryPointPublicPath, compilationHash)
            : entryPointPublicPath;
        });

      entryPointPublicPaths.forEach((entryPointPublicPath) => {
        const extMatch = extensionRegexp.exec(entryPointPublicPath);
        // Skip if the public path is not a .css or .js file
        if (!extMatch) {
          return;
        }
        // Skip if this file is already known
        // (e.g. because of common chunk optimizations)
        if (entryPointPublicPathMap[entryPointPublicPath]) {
          return;
        }
        entryPointPublicPathMap[entryPointPublicPath] = true;
        // ext will contain .js or .css
        const ext = extMatch[1];
        assets[ext].push(entryPointPublicPath);
      });
    }
    return assets;
  }

  /**
   * Converts a favicon file from disk to a webpack ressource
   * and returns the url to the ressource
   *
   * @param {string|false} faviconFilePath
   * @param {WebpackCompilation} compilation
   * @param {string} publicPath
   * @returns {Promise<string|undefined>}
   */
  getFaviconPublicPath (faviconFilePath, compilation, publicPath) {
    if (!faviconFilePath) {
      return Promise.resolve(undefined);
    }
    return this.addFileToAssets(faviconFilePath, compilation)
      .then((faviconName) => {
        const faviconPath = publicPath + faviconName;
        if (this.options.hash) {
          return this.appendHash(faviconPath, compilation.hash);
        }
        return faviconPath;
      });
  }

  /**
   * Generate meta tags
   * @returns {HtmlTagObject[]}
   */
  getMetaTags () {
    const metaOptions = this.options.meta;
    if (metaOptions === false) {
      return [];
    }
    // Make tags self-closing in case of xhtml
    // Turn { "viewport" : "width=500, initial-scale=1" } into
    // [{ name:"viewport" content:"width=500, initial-scale=1" }]
    const metaTagAttributeObjects = Object.keys(metaOptions)
      .map((metaName) => {
        const metaTagContent = metaOptions[metaName];
        return (typeof metaTagContent === 'string') ? {
          name: metaName,
          content: metaTagContent
        } : metaTagContent;
      })
      .filter((attribute) => attribute !== false);
    // Turn [{ name:"viewport" content:"width=500, initial-scale=1" }] into
    // the html-webpack-plugin tag structure
    return metaTagAttributeObjects.map((metaTagAttributes) => {
      if (metaTagAttributes === false) {
        throw new Error('Invalid meta tag');
      }
      return {
        tagName: 'meta',
        voidTag: true,
        attributes: metaTagAttributes
      };
    });
  }

  /**
   * Generate all tags script for the given file paths
   * @param {Array<string>} jsAssets
   * @returns {Array<HtmlTagObject>}
   */
  generatedScriptTags (jsAssets) {
    return jsAssets.map(scriptAsset => ({
      tagName: 'script',
      voidTag: false,
      attributes: {
        src: scriptAsset
      }
    }));
  }

  /**
   * Generate all style tags for the given file paths
   * @param {Array<string>} cssAssets
   * @returns {Array<HtmlTagObject>}
   */
  generateStyleTags (cssAssets) {
    return cssAssets.map(styleAsset => ({
      tagName: 'link',
      voidTag: true,
      attributes: {
        href: styleAsset,
        rel: 'stylesheet'
      }
    }));
  }

  /**
   * Generate an optional base tag
   * @param { false
            | string
            | {[attributeName: string]: string} // attributes e.g. { href:"http://example.com/page.html" target:"_blank" }
            } baseOption
  * @returns {Array<HtmlTagObject>}
  */
  generateBaseTag (baseOption) {
    if (baseOption === false) {
      return [];
    } else {
      return [{
        tagName: 'base',
        voidTag: true,
        attributes: (typeof baseOption === 'string') ? {
          href: baseOption
        } : baseOption
      }];
    }
  }

  /**
   * Generate all meta tags for the given meta configuration
   * @param {false | {
            [name: string]:
              false // disabled
              | string // name content pair e.g. {viewport: 'width=device-width, initial-scale=1, shrink-to-fit=no'}`
              | {[attributeName: string]: string|boolean} // custom properties e.g. { name:"viewport" content:"width=500, initial-scale=1" }
        }} metaOptions
  * @returns {Array<HtmlTagObject>}
  */
  generatedMetaTags (metaOptions) {
    if (metaOptions === false) {
      return [];
    }
    // Make tags self-closing in case of xhtml
    // Turn { "viewport" : "width=500, initial-scale=1" } into
    // [{ name:"viewport" content:"width=500, initial-scale=1" }]
    const metaTagAttributeObjects = Object.keys(metaOptions)
      .map((metaName) => {
        const metaTagContent = metaOptions[metaName];
        return (typeof metaTagContent === 'string') ? {
          name: metaName,
          content: metaTagContent
        } : metaTagContent;
      })
      .filter((attribute) => attribute !== false);
      // Turn [{ name:"viewport" content:"width=500, initial-scale=1" }] into
      // the html-webpack-plugin tag structure
    return metaTagAttributeObjects.map((metaTagAttributes) => {
      if (metaTagAttributes === false) {
        throw new Error('Invalid meta tag');
      }
      return {
        tagName: 'meta',
        voidTag: true,
        attributes: metaTagAttributes
      };
    });
  }

  /**
   * Generate a favicon tag for the given file path
   * @param {string| undefined} faviconPath
   * @returns {Array<HtmlTagObject>}
   */
  generateFaviconTags (faviconPath) {
    if (!faviconPath) {
      return [];
    }
    return [{
      tagName: 'link',
      voidTag: true,
      attributes: {
        rel: 'shortcut icon',
        href: faviconPath
      }
    }];
  }

  /**
   * Group assets to head and bottom tags
   *
   * @param {{
      scripts: Array<HtmlTagObject>;
      styles: Array<HtmlTagObject>;
      meta: Array<HtmlTagObject>;
    }} assetTags
  * @param {"body" | "head"} scriptTarget
  * @returns {{
      headTags: Array<HtmlTagObject>;
      bodyTags: Array<HtmlTagObject>;
    }}
  */
  generateAssetGroups (assetTags, scriptTarget) {
    /** @type {{ headTags: Array<HtmlTagObject>; bodyTags: Array<HtmlTagObject>; }} */
    const result = {
      headTags: [
        ...assetTags.meta,
        ...assetTags.styles
      ],
      bodyTags: []
    };
    // Add script tags to head or body depending on
    // the htmlPluginOptions
    if (scriptTarget === 'body') {
      result.bodyTags.push(...assetTags.scripts);
    } else {
      result.headTags.push(...assetTags.scripts);
    }
    return result;
  }

  /**
   * Injects the assets into the given html string
   *
   * @param {string} html
   * The input html
   * @param {any} assets
   * @param {{
       headTags: HtmlTagObject[],
       bodyTags: HtmlTagObject[]
     }} assetTags
   * The asset tags to inject
   *
   * @returns {string}
   */
  injectAssetsIntoHtml (html, assets, assetTags) {
    const htmlRegExp = /(<html[^>]*>)/i;
    const headRegExp = /(<\/head\s*>)/i;
    const bodyRegExp = /(<\/body\s*>)/i;
    const body = assetTags.bodyTags.map((assetTagObject) => htmlTagObjectToString(assetTagObject, this.options.xhtml));
    const head = assetTags.headTags.map((assetTagObject) => htmlTagObjectToString(assetTagObject, this.options.xhtml));

    if (body.length) {
      if (bodyRegExp.test(html)) {
        // Append assets to body element
        html = html.replace(bodyRegExp, match => body.join('') + match);
      } else {
        // Append scripts to the end of the file if no <body> element exists:
        html += body.join('');
      }
    }

    if (head.length) {
      // Create a head tag if none exists
      if (!headRegExp.test(html)) {
        if (!htmlRegExp.test(html)) {
          html = '<head></head>' + html;
        } else {
          html = html.replace(htmlRegExp, match => match + '<head></head>');
        }
      }

      // Append assets to head element
      html = html.replace(headRegExp, match => head.join('') + match);
    }

    // Inject manifest into the opening html tag
    if (assets.manifest) {
      html = html.replace(/(<html[^>]*)(>)/i, (match, start, end) => {
        // Append the manifest only if no manifest was specified
        if (/\smanifest\s*=/.test(match)) {
          return match;
        }
        return start + ' manifest="' + assets.manifest + '"' + end;
      });
    }
    return html;
  }

  /**
   * Appends a cache busting hash to the query string of the url
   * E.g. http://localhost:8080/ -> http://localhost:8080/?50c9096ba6183fd728eeb065a26ec175
   * @param {string} url
   * @param {string} hash
   */
  appendHash (url, hash) {
    if (!url) {
      return url;
    }
    return url + (url.indexOf('?') === -1 ? '?' : '&') + hash;
  }

  /**
   * Helper to return the absolute template path with a fallback loader
   * @param {string} template
   * The path to the template e.g. './index.html'
   * @param {string} context
   * The webpack base resolution path for relative paths e.g. process.cwd()
   */
  getFullTemplatePath (template, context) {
    if (template === 'auto') {
      template = path.resolve(context, 'src/index.ejs');
      if (!fs.existsSync(template)) {
        template = path.join(__dirname, 'default_index.ejs');
      }
    }
    // If the template doesn't use a loader use the lodash template loader
    if (template.indexOf('!') === -1) {
      template = require.resolve('./lib/loader.js') + '!' + path.resolve(context, template);
    }
    // Resolve template path
    return template.replace(
      /([!])([^/\\][^!?]+|[^/\\!?])($|\?[^!?\n]+$)/,
      (match, prefix, filepath, postfix) => prefix + path.resolve(filepath) + postfix);
  }

  /**
   * Helper to return a sorted unique array of all asset files out of the
   * asset object
   */
  getAssetFiles (assets) {
    const files = _.uniq(Object.keys(assets).filter(assetType => assetType !== 'chunks' && assets[assetType]).reduce((files, assetType) => files.concat(assets[assetType]), []));
    files.sort();
    return files;
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
