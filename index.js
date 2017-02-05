'use strict';
const vm = require('vm');
const fs = require('fs');
const _ = require('lodash');
const Promise = require('bluebird');
const path = require('path');
const childCompiler = require('./lib/compiler.js');
const prettyError = require('./lib/errors.js');
const chunkSorter = require('./lib/chunksorter.js');
const htmlTag = require('./lib/html-tags.js');
Promise.promisifyAll(fs);

module.exports = class HtmlWebpackPlugin {

  constructor (options) {
    // Default options
    this.options = _.extend({
      template: path.join(__dirname, 'default_index.ejs'),
      filename: 'index.html',
      hash: false,
      inject: true,
      compile: true,
      favicon: false,
      cache: true,
      showErrors: true,
      chunks: 'all',
      excludeChunks: [],
      title: 'Webpack App',
      xhtml: false
    }, options);
  }

  /**
   * The main function which is called by webpack to initialize the plugin
   */
  apply (compiler) {
    let isCompilationCached = false;
    let compilationPromise;

    this.options.template = this.getFullTemplatePath(this.options.template, compiler.context);

    // convert absolute filename into relative so that webpack can
    // generate it at correct location
    const filename = this.options.filename;
    if (path.resolve(filename) === path.normalize(filename)) {
      this.options.filename = path.relative(compiler.options.output.path, filename);
    }

    compiler.plugin('make', (compilation, callback) => {
      // Compile the template (queued)
      compilationPromise = childCompiler.compileTemplate(this.options.template, compiler.context, this.options.filename, compilation)
        .catch(err => {
          compilation.errors.push(prettyError(err, compiler.context).toString());
          return {
            content: this.options.showErrors ? prettyError(err, compiler.context).toJsonHtml() : 'ERROR',
            outputName: this.options.filename
          };
        })
        .then(compilationResult => {
          // If the compilation change didnt change the cache is valid
          isCompilationCached = compilationResult.hash && this.childCompilerHash === compilationResult.hash;
          this.childCompilerHash = compilationResult.hash;
          this.childCompilationOutputName = compilationResult.outputName;
          callback();
          return compilationResult.content;
        });
    });

    compiler.plugin('emit', (compilation, callback) => {
      const applyPluginsAsyncWaterfall = this.applyPluginsAsyncWaterfall(compilation);
      // Get all chunks
      const allChunks = compilation.getStats().toJson().chunks;
      // Filter chunks (options.chunks and options.excludeCHunks)
      var chunks = this.filterChunks(allChunks, this.options.chunks, this.options.excludeChunks);
      // Sort chunks
      chunks = this.sortChunks(chunks, this.options.chunksSortMode);
      // Let plugins alter the chunks and the chunk sorting
      chunks = compilation.applyPluginsWaterfall('html-webpack-plugin-alter-chunks', chunks, { plugin: this });
      // Get assets
      const assets = this.htmlWebpackPluginAssets(compilation, chunks);
      // If this is a hot update compilation, move on!
      // This solves a problem where an `index.html` file is generated for hot-update js files
      // It only happens in Webpack 2, where hot updates are emitted separately before the full bundle
      if (this.isHotUpdateCompilation(assets)) {
        return callback();
      }

      // If the template and the assets did not change we don't have to emit the html
      const assetJson = JSON.stringify(this.getAssetFiles(assets));
      if (isCompilationCached && this.options.cache && assetJson === this.assetJson) {
        return callback();
      } else {
        this.assetJson = assetJson;
      }

      Promise.resolve()
        // Favicon
        .then(() => {
          if (this.options.favicon) {
            return this.addFileToAssets(this.options.favicon, compilation)
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
          if (this.options.templateContent !== undefined) {
            return this.options.templateContent;
          }
          // Once everything is compiled evaluate the html factory
          // and replace it with its content
          return this.evaluateCompilationResult(compilation, compiledTemplate);
        })
        // Allow plugins to make changes to the assets before invoking the template
        // This only makes sense to use if `inject` is `false`
        .then(compilationResult => applyPluginsAsyncWaterfall('html-webpack-plugin-before-html-generation', false, {
          assets: assets,
          outputName: this.childCompilationOutputName,
          plugin: this
        })
        .then(() => compilationResult))
        // Execute the template
        .then(compilationResult => {
          // If the loader result is a function execute it to retrieve the html
          // otherwise use the returned html
          return typeof compilationResult !== 'function'
            ? compilationResult
            : this.executeTemplate(compilationResult, chunks, assets, compilation);
        })
          // Allow plugins to change the html before assets are injected
          .then(html => {
            const pluginArgs = {html: html, assets: assets, plugin: this, outputName: this.childCompilationOutputName};
            return applyPluginsAsyncWaterfall('html-webpack-plugin-before-html-processing', true, pluginArgs);
          })
          .then(result => {
            const html = result.html;
            const assets = result.assets;
            // Prepare script and link tags
            const assetTags = this.generateAssetTags(assets);
            const pluginArgs = {
              head: assetTags.head,
              body: assetTags.body,
              plugin: this,
              chunks: chunks,
              outputName: this.childCompilationOutputName
            };
            // Allow plugins to change the assetTag definitions
            return applyPluginsAsyncWaterfall('html-webpack-plugin-alter-asset-tags', true, pluginArgs)
              // Add the stylesheets, scripts and so on to the resulting html
              .then(result => this.postProcessHtml(html, assets, { body: result.body, head: result.head })
              .then(html => _.extend(result, {html: html, assets: assets})));
          })
        // Allow plugins to change the html after assets are injected
        .then(result => {
          const html = result.html;
          const assets = result.assets;
          const pluginArgs = {
            html: html,
            assets: assets,
            plugin: this,
            outputName: this.childCompilationOutputName
          };
          return applyPluginsAsyncWaterfall('html-webpack-plugin-after-html-processing', true, pluginArgs)
            .then(result => result.html);
        })
        .catch(err => {
          // In case anything went wrong the promise is resolved
          // with the error message and an error is logged
          compilation.errors.push(prettyError(err, compiler.context).toString());
          // Invalidate the cache by resetting the cache key
          this.hash = null;
          return this.options.showErrors ? prettyError(err, compiler.context).toHtml() : 'ERROR';
        })
      .then(html => {
        // Replace the compilation result with the evaluated html code
        compilation.assets[this.childCompilationOutputName] = {
          source: function () {
            return html;
          },
          size: function () {
            return html.length;
          }
        };
      })
      // Let other plugins know that we are done by sending an emit event
        .then(() =>
          applyPluginsAsyncWaterfall('html-webpack-plugin-after-emit', false, {
            html: compilation.assets[this.childCompilationOutputName],
            outputName: this.childCompilationOutputName,
            plugin: this
          }).catch(err => {
            console.error(err);
            return null;
          }).then(() => null))
        // Let webpack continue with it
      .finally(() => {
        callback();
          // Tell blue bird that we don't want to wait for callback.
          // Fixes "Warning: a promise was created in a handler but none were returned from it"
          // https://github.com/petkaantonov/bluebird/blob/master/docs/docs/warning-explanations.md#warning-a-promise-was-created-in-a-handler-but-none-were-returned-from-it
        return null;
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
      : Promise.reject(`The loader "${this.options.template}" didn't return html.`);
  }

/**
 * Html post processing
 *
 * Returns a promise
 */
  executeTemplate (templateFunction, chunks, assets, compilation) {
    return Promise.resolve()
      // Template processing
      .then(() => {
        const templateParams = {
          compilation: compilation,
          webpack: compilation.getStats().toJson(),
          webpackConfig: compilation.options,
          htmlWebpackPlugin: {
            files: assets,
            options: this.options
          }
        };
        let html = '';
        try {
          html = templateFunction(templateParams);
        } catch (e) {
          compilation.errors.push(new Error(`Template execution failed: ${e}`));
          return Promise.reject(e);
        }
        return html;
      });
  }

  /**
   * Html post processing
   *
   * Returns a promise
   */
  postProcessHtml (html, assets, assetTags) {
    if (typeof html !== 'string') {
      return Promise.reject(`Expected html to be a string but got ${JSON.stringify(html)}`);
    }
    return Promise.resolve()
      // Inject
      .then(() => {
        if (this.options.inject) {
          return this.injectAssetsIntoHtml(html, assets, assetTags);
        } else {
          return html;
        }
      });
  }

  /**
   * Pushes the content of the given filename to the compilation assets
   */
  addFileToAssets (filename, compilation) {
    filename = path.resolve(compilation.compiler.context, filename);
    return Promise.props({
      size: fs.statAsync(filename),
      source: fs.readFileAsync(filename)
    })
      .catch(() => Promise.reject(new Error(`HtmlWebpackPlugin: could not load file ${filename}`)))
      .then(results => {
        const basename = path.basename(filename);
        compilation.fileDependencies.push(filename);
        compilation.assets[basename] = {
          source: function () {
            return results.source;
          },
          size: function () {
            return results.size.size;
          }
        };
        return basename;
      });
  }

  /**
   * Helper to sort chunks
   */
  sortChunks (chunks, sortMode) {
    // Sort mode auto by default:
    if (typeof sortMode === 'undefined') {
      sortMode = 'auto';
    }
    // Custom function
    if (typeof sortMode === 'function') {
      return chunks.sort(sortMode);
    }
    // Disabled sorting:
    if (sortMode === 'none') {
      return chunkSorter.none(chunks);
    }
    // Check if the given sort mode is a valid chunkSorter sort mode
    if (typeof chunkSorter[sortMode] !== 'undefined') {
      return chunkSorter[sortMode](chunks);
    }
    throw new Error(`"${sortMode}" is not a valid chunk sort mode`);
  }

  /**
   * Return all chunks from the compilation result which match the exclude and include filters
   */
  filterChunks (chunks, includedChunks, excludedChunks) {
    return chunks.filter(chunk => {
      const chunkName = chunk.names[0];
      // This chunk doesn't have a name. This script can't handled it.
      if (chunkName === undefined) {
        return false;
      }
      // Skip if the chunk should be lazy loaded
      if (!chunk.initial) {
        return false;
      }
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
   * Returns true if this asset is part of a hot update
   */
  isHotUpdateCompilation (assets) {
    return assets.js.length && assets.js.every(name => /\.hot-update\.js$/.test(name));
  }

  /**
   * Returns all assets from the current compilation
   */
  htmlWebpackPluginAssets (compilation, chunks) {
    const webpackStatsJson = compilation.getStats().toJson();

    // Use the configured public path or build a relative path
    let publicPath = typeof compilation.options.output.publicPath !== 'undefined'
      // If a hard coded public path exists use it
      ? compilation.mainTemplate.getPublicPath({hash: webpackStatsJson.hash})
      // If no public path was set get a relative url path
      : path.relative(path.resolve(compilation.options.output.path, path.dirname(this.childCompilationOutputName)), compilation.options.output.path)
      .split(path.sep).join('/');

    if (publicPath.length && publicPath.substr(-1, 1) !== '/') {
      publicPath += '/';
    }

    const assets = {
      // The public path
      publicPath: publicPath,
      // Will contain all js & css files by chunk
      chunks: {},
      // Will contain all js files
      js: [],
      // Will contain all css files
      css: [],
      // Will contain the html5 appcache manifest files if it exists
      manifest: Object.keys(compilation.assets).filter(assetFile => path.extname(assetFile) === '.appcache')[0]
    };

    // Append a hash for cache busting
    if (this.options.hash) {
      assets.manifest = this.appendHash(assets.manifest, webpackStatsJson.hash);
      assets.favicon = this.appendHash(assets.favicon, webpackStatsJson.hash);
    }

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkName = chunk.names[0];

      assets.chunks[chunkName] = {};

      // Prepend the public path to all chunk files
      let chunkFiles = [].concat(chunk.files).map(chunkFile => publicPath + chunkFile);

      // Append a hash for cache busting
      if (this.options.hash) {
        chunkFiles = chunkFiles.map(chunkFile => this.appendHash(chunkFile, webpackStatsJson.hash));
      }

      // Webpack outputs an array for each chunk when using sourcemaps
      // But we need only the entry file
      const entry = chunkFiles[0];
      assets.chunks[chunkName].size = chunk.size;
      assets.chunks[chunkName].entry = entry;
      assets.chunks[chunkName].hash = chunk.hash;
      assets.js.push(entry);

      // Gather all css files
      var css = chunkFiles.filter(chunkFile =>
        // Some chunks may contain content hash in their names, for ex. 'main.css?1e7cac4e4d8b52fd5ccd2541146ef03f'.
        // We must proper handle such cases, so we use regexp testing here
        /.css($|\?)/.test(chunkFile)
      );
      assets.chunks[chunkName].css = css;
      assets.css = assets.css.concat(css);
    }

    // Duplicate css assets can occur on occasion if more than one chunk
    // requires the same css.
    assets.css = _.uniq(assets.css);

    return assets;
  }

  inferMediaFromCSSFilename (filename) {
    const matches = filename.match(/\bmedia_([A-Z0-9=]*)/i);

    if (matches) {
      // Node 5.10+
      if (typeof Buffer.from === 'function') {
        return Buffer.from(matches[1], 'base64');
      }

      // older Node versions
      return new Buffer(matches[1], 'base64');
    }

    return false;
  }

  /**
   * Injects the assets into the given html string
   */
  generateAssetTags (assets) {
    // Turn script files into script tags
    const scripts = assets.js.map(scriptPath => htmlTag.createHtmlTagObject('script', {
      src: scriptPath
    }));
    // Turn css files into link tags
    const styles = assets.css.map(stylePath => htmlTag.createHtmlTagObject('link', {
      href: stylePath,
      rel: 'stylesheet',
      media: this.inferMediaFromCSSFilename(stylePath)
    }));
    // Injection targets
    let head = [];
    let body = [];

    // If there is a favicon present, add it to the head
    if (assets.favicon) {
      head.push(htmlTag.createHtmlTagObject('link', {
        rel: 'shortcut icon',
        href: assets.favicon
      }));
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
   */
  injectAssetsIntoHtml (html, assets, assetTags) {
    const htmlRegExp = /(<html[^>]*>)/i;
    const headRegExp = /(<\/head>)/i;
    const bodyRegExp = /(<\/body>)/i;
    // Create the html strings for head
    const head = assetTags.head.map(
      (htmlTagObject) => htmlTag.htmlTagObjectToString(htmlTagObject, this.options.xhtml)
    );
    // Create the html strings for body
    const body = assetTags.body.map(
      (htmlTagObject) => htmlTag.htmlTagObjectToString(htmlTagObject, this.options.xhtml)
    );

    if (body.length) {
      if (bodyRegExp.test(html)) {
        // Append assets to body element
        html = html.replace(bodyRegExp, (match) => body.join('') + match);
      } else {
        // Append scripts to the end of the file if no <body> element exists:
        html += body.join('');
      }
    }

    if (head.length) {
      // Create a head tag if none exists
      if (!headRegExp.test(html)) {
        if (!htmlRegExp.test(html)) {
          html = `<head></head>${html}`;
        } else {
          html = html.replace(htmlRegExp, (match) => `${match}<head></head>`);
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
        return `${start} manifest="${assets.manifest}"${end}`;
      });
    }
    return html;
  }

  /**
   * Appends a cache busting hash
   */
  appendHash (url, hash) {
    if (!url) {
      return url;
    }
    return url + (url.indexOf('?') === -1 ? '?' : '&') + hash;
  }

  /**
   * Helper to return the absolute template path with a fallback loader
   */
  getFullTemplatePath (template, context) {
    // If the template doesn't use a loader use the lodash template loader
    if (template.indexOf('!') === -1) {
      template = `html-webpack-plugin/lib/loader.js!${path.resolve(context, template)}`;
    }
    // Resolve template path
    return template.replace(
      /([!])([^/\\][^!?]+|[^/\\!?])($|\?[^!?\n]+$)/,
      (match, prefix, filepath, postfix) => prefix + path.resolve(filepath) + postfix
    );
  }

  /**
   * Helper to return a sorted unique array of all asset files out of the
   * asset object
   */
  getAssetFiles (assets) {
    const files = Object.keys(assets)
      .filter(assetType => assetType !== 'chunks' && assets[assetType])
      .reduce((files, assetType) => files.concat(assets[assetType]), []);
    const uniqFiles = _.uniq(files);
    uniqFiles.sort();
    return uniqFiles;
  }

  /**
   * Helper to promisify compilation.applyPluginsAsyncWaterfall that returns
   * a function that helps to merge given plugin arguments with processed ones
   */
  applyPluginsAsyncWaterfall (compilation) {
    const promisedApplyPluginsAsyncWaterfall = Promise.promisify(compilation.applyPluginsAsyncWaterfall, {context: compilation});
    return function (eventName, requiresResult, pluginArgs) {
      return promisedApplyPluginsAsyncWaterfall(eventName, pluginArgs)
      .then(result => {
        if (requiresResult && !result) {
          compilation.warnings.push(new Error(`Using ${eventName} without returning a result is deprecated.`));
        }
        return _.extend(pluginArgs, result);
      });
    };
  }
};
