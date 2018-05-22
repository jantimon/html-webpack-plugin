// @ts-check
'use strict';

// use Polyfill for util.promisify in node versions < v8
const promisify = require('util.promisify');

// Import types
/* eslint-disable */
/// <reference path="./typings.d.ts" />
/* eslint-enable */
/** @typedef {import("webpack/lib/Compiler.js")} WebpackCompiler */
/** @typedef {import("webpack/lib/Compilation.js")} WebpackCompilation */

const vm = require('vm');
const fs = require('fs');
const _ = require('lodash');
const path = require('path');

const htmlTagObjectToString = require('./lib/html-tags').htmlTagObjectToString;

const childCompiler = require('./lib/compiler.js');
const prettyError = require('./lib/errors.js');
const chunkSorter = require('./lib/chunksorter.js');
const getHtmlWebpackPluginHooks = require('./lib/hooks.js').getHtmlWebpackPluginHooks;
const getHtmlWebpackPluginHook = require('./lib/hooks.js').getHtmlWebpackPluginHook;

const fsStatAsync = promisify(fs.stat);
const fsReadFileAsync = promisify(fs.readFile);

class HtmlWebpackPlugin {
  /**
   * @param {Partial<HtmlWebpackPluginOptions>} options
   */
  constructor (options) {
    // Default options
    /**
     * @type {HtmlWebpackPluginOptions}
     */
    this.options = Object.assign({
      template: path.join(__dirname, 'default_index.ejs'),
      templateContent: false,
      templateParameters: templateParametersGenerator,
      filename: 'index.html',
      hash: false,
      inject: true,
      compile: true,
      favicon: false,
      minify: false,
      cache: true,
      showErrors: true,
      chunks: 'all',
      excludeChunks: [],
      chunksSortMode: 'auto',
      meta: {},
      title: 'Webpack App',
      xhtml: false
    }, options);
    // Instance variables to keep caching information
    // for multiple builds
    this.childCompilerHash = undefined;
    this.childCompilationOutputName = undefined;
    this.assetJson = undefined;
    this.hash = undefined;
    /**
     * The major version number of this plugin
     */
    this.version = 4;
  }

  /**
   * apply is called by the webpack main compiler during the start phase
   * @param {WebpackCompiler} compiler
   */
  apply (compiler) {
    const self = this;
    let isCompilationCached = false;
    let compilationPromise;

    this.options.template = this.getFullTemplatePath(this.options.template, compiler.context);

    // convert absolute filename into relative so that webpack can
    // generate it at correct location
    const filename = this.options.filename;
    if (path.resolve(filename) === path.normalize(filename)) {
      this.options.filename = path.relative(compiler.options.output.path, filename);
    }

    // setup hooks for third party plugins
    compiler.hooks.compilation.tap('HtmlWebpackPluginHooks', getHtmlWebpackPluginHooks);

    compiler.hooks.make.tapAsync('HtmlWebpackPlugin', (compilation, callback) => {
      // Compile the template (queued)
      compilationPromise = childCompiler.compileTemplate(self.options.template, compiler.context, self.options.filename, compilation)
        .catch(err => {
          compilation.errors.push(prettyError(err, compiler.context).toString());
          return {
            content: self.options.showErrors ? prettyError(err, compiler.context).toJsonHtml() : 'ERROR',
            outputName: self.options.filename
          };
        })
        .then(compilationResult => {
          // If the compilation change didnt change the cache is valid
          isCompilationCached = compilationResult.hash && self.childCompilerHash === compilationResult.hash;
          self.childCompilerHash = compilationResult.hash;
          self.childCompilationOutputName = compilationResult.outputName;
          callback();
          return compilationResult.content;
        });
    });

    compiler.hooks.emit.tapAsync('HtmlWebpackPlugin',
    /**
     * Hook into the webpack emit phase
     * @param {WebpackCompilation} compilation
     * @param {() => void} callback
    */
      (compilation, callback) => {
        // Get all entry point names for this html file
        const entryNames = Array.from(compilation.entrypoints.keys());
        const filteredEntryNames = self.filterChunks(entryNames, self.options.chunks, self.options.excludeChunks);
        const sortedEntryNames = self.sortEntryChunks(filteredEntryNames, this.options.chunksSortMode, compilation);
        // Turn the entry point names into file paths
        const assets = self.htmlWebpackPluginAssets(compilation, sortedEntryNames);

        // If this is a hot update compilation, move on!
        // This solves a problem where an `index.html` file is generated for hot-update js files
        // It only happens in Webpack 2, where hot updates are emitted separately before the full bundle
        if (self.isHotUpdateCompilation(assets)) {
          return callback();
        }

        // If the template and the assets did not change we don't have to emit the html
        const assetJson = JSON.stringify(self.getAssetFiles(assets));
        if (isCompilationCached && self.options.cache && assetJson === self.assetJson) {
          return callback();
        } else {
          self.assetJson = assetJson;
        }

        Promise.resolve()
        // Favicon
          .then(() => {
            if (self.options.favicon) {
              return self.addFileToAssets(self.options.favicon, compilation)
                .then(faviconBasename => {
                  let publicPath = compilation.mainTemplate.getPublicPath({hash: compilation.hash}) || '';
                  if (publicPath && publicPath.substr(-1) !== '/') {
                    publicPath += '/';
                  }
                  assets.favicon = publicPath + faviconBasename;
                });
            }
          })
        // Wait for the compilation to finish
          .then(() => compilationPromise)
          .then(compiledTemplate => {
          // Allow to use a custom function / string instead
            if (self.options.templateContent !== false) {
              return self.options.templateContent;
            }
            // Once everything is compiled evaluate the html factory
            // and replace it with its content
            return self.evaluateCompilationResult(compilation, compiledTemplate);
          })
        // Allow plugins to make changes to the assets before invoking the template
        // This only makes sense to use if `inject` is `false`
          .then(compilationResult => getHtmlWebpackPluginHook(compilation, 'htmlWebpackPluginBeforeHtmlGeneration').promise({
            assets: assets,
            outputName: self.childCompilationOutputName,
            plugin: self
          })
            .then(() => compilationResult))
        // Execute the template
          .then(compilationResult => typeof compilationResult !== 'function'
            ? compilationResult
            : self.executeTemplate(compilationResult, assets, compilation))
        // Allow plugins to change the html before assets are injected
          .then(html => {
            const pluginArgs = {html: html, assets: assets, plugin: self, outputName: self.childCompilationOutputName};
            return getHtmlWebpackPluginHook(compilation, 'htmlWebpackPluginBeforeHtmlProcessing').promise(pluginArgs);
          })
          .then(result => {
            const html = result.html;
            const assets = result.assets;
            // Prepare script and link tags
            const assetTags = self.generateHtmlTagObjects(assets);
            const pluginArgs = {head: assetTags.head, body: assetTags.body, plugin: self, outputName: self.childCompilationOutputName};
            // Allow plugins to change the assetTag definitions
            return getHtmlWebpackPluginHook(compilation, 'htmlWebpackPluginAlterAssetTags').promise(pluginArgs)
              .then(result => self.postProcessHtml(html, assets, { body: result.body, head: result.head })
                .then(html => _.extend(result, {html: html, assets: assets})));
          })
        // Allow plugins to change the html after assets are injected
          .then(result => {
            const html = result.html;
            const assets = result.assets;
            const pluginArgs = {html: html, assets: assets, plugin: self, outputName: self.childCompilationOutputName};
            return getHtmlWebpackPluginHook(compilation, 'htmlWebpackPluginAfterHtmlProcessing').promise(pluginArgs)
              .then(result => result.html);
          })
          .catch(err => {
          // In case anything went wrong the promise is resolved
          // with the error message and an error is logged
            compilation.errors.push(prettyError(err, compiler.context).toString());
            // Prevent caching
            self.hash = null;
            return self.options.showErrors ? prettyError(err, compiler.context).toHtml() : 'ERROR';
          })
          .then(html => {
          // Replace the compilation result with the evaluated html code
            compilation.assets[self.childCompilationOutputName] = {
              source: () => html,
              size: () => html.length
            };
          })
          .then(() => getHtmlWebpackPluginHook(compilation, 'htmlWebpackPluginAfterEmit').promise({
            html: compilation.assets[self.childCompilationOutputName],
            outputName: self.childCompilationOutputName,
            plugin: self
          }).catch(err => {
            console.error(err);
            return null;
          }).then(() => null))
        // Let webpack continue with it
          .then(() => {
            callback();
          });
      });
  }

  /**
   * Evaluates the child compilation result
   * Returns a promise
   */
  evaluateCompilationResult (compilation, source) {
    if (!source) {
      return Promise.reject('The child compilation didn\'t provide a result');
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
      : Promise.reject('The loader "' + this.options.template + '" didn\'t return html.');
  }

  /**
   * Generate the template parameters for the template function
   * @param {WebpackCompilation} compilation
   *
   */
  getTemplateParameters (compilation, assets) {
    if (typeof this.options.templateParameters === 'function') {
      return this.options.templateParameters(compilation, assets, this.options);
    }
    if (typeof this.options.templateParameters === 'object') {
      return this.options.templateParameters;
    }
    return {};
  }

  /**
   * Html post processing
   *
   * @returns Promise<string>
   */
  executeTemplate (templateFunction, assets, compilation) {
    // Template processing
    const templateParams = this.getTemplateParameters(compilation, assets);
    let html = '';
    try {
      html = templateFunction(templateParams);
    } catch (e) {
      compilation.errors.push(new Error('Template execution failed: ' + e));
      return Promise.reject(e);
    }
    // If html is a promise return the promise
    // If html is a string turn it into a promise
    return Promise.resolve().then(() => html);
  }

  /**
   * Html post processing
   *
   * Returns a promise
   */
  postProcessHtml (html, assets, assetTags) {
    if (typeof html !== 'string') {
      return Promise.reject('Expected html to be a string but got ' + JSON.stringify(html));
    }
    return Promise.resolve()
      // Inject
      .then(() => {
        if (this.options.inject) {
          return this.injectAssetsIntoHtml(html, assets, assetTags);
        } else {
          return html;
        }
      })
      // Minify
      .then(html => {
        if (this.options.minify) {
          const minify = require('html-minifier').minify;
          return minify(html, this.options.minify === true ? {} : this.options.minify);
        }
        return html;
      });
  }

  /*
   * Pushes the content of the given filename to the compilation assets
   * @param {string} filename
   * @param {WebpackCompilation} compilation
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

  isHotUpdateCompilation (assets) {
    return assets.js.length && assets.js.every(name => /\.hot-update\.js$/.test(name));
  }

  /**
   * The htmlWebpackPluginAssets extracts the asset information of a webpack compilation
   * for all given entry names
   * @param {WebpackCompilation} compilation
   * @param {string[]} entryNames
   * @returns {{
      publicPath: string,
      js: Array<{entryName: string, path: string}>,
      css: Array<{entryName: string, path: string}>,
      manifest?: string,
      favicon?: string
    }}
   */
  htmlWebpackPluginAssets (compilation, entryNames) {
    const compilationHash = compilation.hash;

    /**
     * @type {string} the configured public path to the asset root
     * if a publicPath is set in the current webpack config use it otherwise
     * fallback to a realtive path
     */
    let publicPath = typeof compilation.options.output.publicPath !== 'undefined'
      // If a hard coded public path exists use it
      ? compilation.mainTemplate.getPublicPath({hash: compilationHash})
      // If no public path was set get a relative url path
      : path.relative(path.resolve(compilation.options.output.path, path.dirname(this.childCompilationOutputName)), compilation.options.output.path)
        .split(path.sep).join('/');

    if (publicPath.length && publicPath.substr(-1, 1) !== '/') {
      publicPath += '/';
    }

    /**
     * @type {{
        publicPath: string,
        js: Array<{entryName: string, path: string}>,
        css: Array<{entryName: string, path: string}>,
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

      entryPointPublicPaths.forEach((entryPointPublicPaths) => {
        const extMatch = extensionRegexp.exec(entryPointPublicPaths);
        // Skip if the public path is not a .css or .js file
        if (!extMatch) {
          return;
        }
        // ext will contain .js or .css
        const ext = extMatch[1];
        assets[ext].push({
          entryName: entryName,
          path: entryPointPublicPaths
        });
      });
    }
    return assets;
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
    const metaTagAttributeObjects = Object.keys(metaOptions).map((metaName) => {
      const metaTagContent = metaOptions[metaName];
      return (typeof metaTagContent === 'string') ? {
        name: metaName,
        content: metaTagContent
      } : metaTagContent;
    });
    // Turn [{ name:"viewport" content:"width=500, initial-scale=1" }] into
    // the html-webpack-plugin tag structure
    return metaTagAttributeObjects.map((metaTagAttributes) => {
      return {
        tagName: 'meta',
        voidTag: true,
        attributes: metaTagAttributes
      };
    });
  }

  /**
   * Turns the given asset information into tag object representations
   * which is seperated into head and body
   *
   * @param {{
      js: {entryName: string, path: string}[],
      css: {entryName: string, path: string}[],
      favicon?: string
    }} assets
   *
   * @returns {{
       head: HtmlTagObject[],
       body: HtmlTagObject[]
     }}
   */
  generateHtmlTagObjects (assets) {
    // Turn script files into script tags
    const scripts = assets.js.map(scriptAsset => ({
      tagName: 'script',
      voidTag: false,
      attributes: {
        src: scriptAsset.path
      }
    }));
    // Turn css files into link tags
    const styles = assets.css.map(styleAsset => ({
      tagName: 'link',
      voidTag: true,
      attributes: {
        href: styleAsset.path,
        rel: 'stylesheet'
      }
    }));
    // Injection targets
    let head = this.getMetaTags();
    let body = [];

    // If there is a favicon present, add it to the head
    if (assets.favicon) {
      head.push({
        tagName: 'link',
        voidTag: true,
        attributes: {
          rel: 'shortcut icon',
          href: assets.favicon
        }
      });
    }
    // Add styles to the head
    head = head.concat(styles);
    // Add scripts to body or head
    if (this.options.inject === 'head') {
      head = head.concat(scripts);
    } else {
      body = body.concat(scripts);
    }
    return {head: head, body: body};
  }

  /**
   * Injects the assets into the given html string
   *
   * @param {string} html
   * @param {any} assets
   * The input html
   * @param {{
       head: HtmlTagObject[],
       body: HtmlTagObject[]
     }} assetTags
   * The asset tags to inject
   *
   * @returns {string}
   */
  injectAssetsIntoHtml (html, assets, assetTags) {
    const htmlRegExp = /(<html[^>]*>)/i;
    const headRegExp = /(<\/head\s*>)/i;
    const bodyRegExp = /(<\/body\s*>)/i;
    const body = assetTags.body.map((assetTagObject) => htmlTagObjectToString(assetTagObject, this.options.xhtml));
    const head = assetTags.head.map((assetTagObject) => htmlTagObjectToString(assetTagObject, this.options.xhtml));

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
   * The path to the tempalate e.g. './index.html'
   * @param {string} context
   * The webpack base resolution path for relative paths e.g. process.cwd()
   */
  getFullTemplatePath (template, context) {
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

/**
 * The default for options.templateParameter
 * Generate the template parameters
 */
function templateParametersGenerator (compilation, assets, options) {
  return {
    compilation: compilation,
    webpackConfig: compilation.options,
    htmlWebpackPlugin: {
      files: assets,
      options: options
    }
  };
}
module.exports = HtmlWebpackPlugin;
