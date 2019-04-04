/** @typedef {import("webpack/lib/Compilation.js")} WebpackCompilation */
/** @typedef {import("webpack/lib/Compiler.js")} WebpackCompiler */

const promisify = require('util.promisify');

const vm = require('vm');
const fs = require('fs');
const _ = require('lodash');
const path = require('path');
const loaderUtils = require('loader-utils');
const log = require('webpack-log');

const { htmlTagObjectToString } = require('./html-tags');

const childCompiler = require('./compiler.js');
const prettyError = require('./errors.js');
const chunkSorter = require('./chunksorter.js');
const { getHtmlWebpackPluginHooks } = require('./hooks.js');
const { setFileNameOption, setMinifyOption, setTemplateOption } = require('./optionsHelper.js');
const fsStatAsync = promisify(fs.stat);
const fsReadFileAsync = promisify(fs.readFile);

class MultiHtmlWebpackPlugin {
    constructor(htmlWebpackPlugins, compiler) {
        this.htmlWebpackPlugins = htmlWebpackPlugins;

        this.logger = log({ name: 'MultiHtmlWebpackPlugin' })

        this.apply(compiler);
    }

    apply(compiler) {
        this.logger.info('Apply has been called')
        let isCompilationCached = false;

        let childCompilerPromises;

        this.updateOptions(compiler);

        // Register all HtmlWebpackPlugins instances at the child compiler
        compiler.hooks.thisCompilation.tap('HtmlWebpackPlugin', (compilation) => {
            this.logger.info('hook thisCompilation has been called')
            // Clear the cache if the child compiler is outdated
            if (childCompiler.hasOutDatedTemplateCache(compilation)) {
                childCompiler.clearCache(compiler);
            }
            // Add all templates to the child compiler
            this.htmlWebpackPlugins.forEach((plugin) => {
                childCompiler.addTemplateToCompiler(compiler, plugin.options.template);
            });
            // Add file dependencies of child compiler to parent compiler
            // to keep them watched even if we get the result from the cache
            compilation.hooks.additionalChunkAssets.tap('HtmlWebpackPlugin', () => {
                this.logger.info('hook add additionalChunkAssets started')
                const childCompilerDependencies = childCompiler.getFileDependencies(compiler);
                childCompilerDependencies.forEach(fileDependency => {
                    compilation.compilationDependencies.add(fileDependency);
                });
            });
        });

        compiler.hooks.make.tapPromise('HtmlWebpackPlugin', (compilation) => {
            this.logger.info('hooks.make.tapPromise has been called')

            childCompilerPromises = this.htmlWebpackPlugins.map((plugin) => {
                return childCompiler.compileTemplate(plugin.options.template, plugin.options.filename, compilation)
                    .catch(err => {
                        compilation.errors.push(prettyError(err, compiler.context).toString());
                        return {
                            content: plugin.options.showErrors ? prettyError(err, compiler.context).toJsonHtml() : 'ERROR',
                            outputName: plugin.options.filename,
                            hash: ''
                        };
                    })
                    .then(compilationResult => {
                        // If the compilation change didnt change the cache is valid
                        isCompilationCached = Boolean(compilationResult.hash) && plugin.childCompilerHash === compilationResult.hash;
                        plugin.childCompilerHash = compilationResult.hash;
                        plugin.childCompilationOutputName = compilationResult.outputName;
                        return compilationResult.content;
                    });
            });

            return Promise.all(childCompilerPromises);
        });

        compiler.hooks.emit.tapAsync('HtmlWebpackPlugin',
            /**
             * Hook into the webpack emit phase
             * @param {WebpackCompilation} compilation
             * @param {() => void} callback
            */
            (compilation, callback) => {
                this.logger.log('hook emit called');
                let emitHtmlPromises = [];

                this.htmlWebpackPlugins.forEach((plugin, index) => {
                    // Get all entry point names for this html file
                    const entryNames = Array.from(compilation.entrypoints.keys());
                    const filteredEntryNames = this.filterChunks(entryNames, plugin.options.chunks, plugin.options.excludeChunks);
                    const sortedEntryNames = this.sortEntryChunks(filteredEntryNames, plugin.options.chunksSortMode, compilation, plugin);
                    const childCompilationOutputName = plugin.childCompilationOutputName;

                    if (childCompilationOutputName === undefined) {
                        throw new Error('Did not receive child compilation result');
                    }

                    // Turn the entry point names into file paths
                    const assets = this.htmlWebpackPluginAssets(compilation, childCompilationOutputName, sortedEntryNames, plugin);

                    // If this is a hot update compilation, move on!
                    // This solves a problem where an `index.html` file is generated for hot-update js files
                    // It only happens in Webpack 2, where hot updates are emitted separately before the full bundle
                    if (this.isHotUpdateCompilation(assets)) {
                        return callback();
                    }

                    // If the template and the assets did not change we don't have to emit the html
                    const assetJson = JSON.stringify(this.getAssetFiles(assets));
                    if (isCompilationCached && plugin.options.cache && assetJson === plugin.assetJson) {
                        return callback();
                    } else {
                        plugin.assetJson = assetJson;
                    }

                    // The html-webpack plugin uses a object representation for the html-tags which will be injected
                    // to allow altering them more easily
                    // Just before they are converted a third-party-plugin author might change the order and content
                    const assetsPromise = this.getFaviconPublicPath(plugin.options.favicon, compilation, assets.publicPath, plugin)
                        .then((faviconPath) => {
                            assets.favicon = faviconPath;
                            return getHtmlWebpackPluginHooks(compilation).beforeAssetTagGeneration.promise({
                                assets: assets,
                                outputName: childCompilationOutputName,
                                plugin: plugin
                            });
                        });

                    // Turn the js and css paths into grouped HtmlTagObjects
                    const assetTagGroupsPromise = assetsPromise
                        // And allow third-party-plugin authors to reorder and change the assetTags before they are grouped
                        .then(({ assets }) => getHtmlWebpackPluginHooks(compilation).alterAssetTags.promise({
                            assetTags: {
                                scripts: this.generatedScriptTags(assets.js),
                                styles: this.generateStyleTags(assets.css),
                                meta: [
                                    ...this.generateBaseTag(plugin.options.base),
                                    ...this.generatedMetaTags(plugin.options.meta),
                                    ...this.generateFaviconTags(assets.favicon)
                                ]
                            },
                            outputName: childCompilationOutputName,
                            plugin: plugin
                        }))
                        .then(({ assetTags }) => {
                            // Inject scripts to body unless it set explictly to head
                            const scriptTarget = plugin.options.inject === 'head' ? 'head' : 'body';
                            // Group assets to `head` and `body` tag arrays
                            const assetGroups = this.generateAssetGroups(assetTags, scriptTarget);
                            // Allow third-party-plugin authors to reorder and change the assetTags once they are grouped
                            return getHtmlWebpackPluginHooks(compilation).alterAssetTagGroups.promise({
                                headTags: assetGroups.headTags,
                                bodyTags: assetGroups.bodyTags,
                                outputName: childCompilationOutputName,
                                plugin: plugin
                            });
                        });

                    // Turn the compiled tempalte into a nodejs function or into a nodejs string
                    const templateEvaluationPromise = Promise.all(childCompilerPromises)
                        .then(compiledTemplate => {
                            // Allow to use a custom function / string instead
                            if (plugin.options.templateContent !== false) {
                                return plugin.options.templateContent;
                            }
                            // Once everything is compiled evaluate the html factory
                            // and replace it with its content

                            return this.evaluateCompilationResult(compilation, compiledTemplate[index], plugin)
                        });

                    const templateExectutionPromise = Promise.all([assetsPromise, assetTagGroupsPromise, templateEvaluationPromise])
                        // Execute the template
                        .then(([assetsHookResult, assetTags, compilationResult]) => {
                            return typeof compilationResult !== 'function'
                                ? compilationResult
                                : this.executeTemplate(compilationResult, assetsHookResult.assets, { headTags: assetTags.headTags, bodyTags: assetTags.bodyTags }, compilation, plugin)
                        }
                        )

                    const injectedHtmlPromise = Promise.all([assetTagGroupsPromise, templateExectutionPromise])
                        // Allow plugins to change the html before assets are injected
                        .then(([assetTags, html]) => {
                            const pluginArgs = { html, headTags: assetTags.headTags, bodyTags: assetTags.bodyTags, plugin: plugin, outputName: childCompilationOutputName };
                            return getHtmlWebpackPluginHooks(compilation).afterTemplateExecution.promise(pluginArgs);
                        })
                        .then(({ html, headTags, bodyTags }) => {
                            return this.postProcessHtml(html, assets, { headTags, bodyTags }, plugin);
                        });

                    const emitHtmlPromise = injectedHtmlPromise
                        // Allow plugins to change the html after assets are injected
                        .then((html) => {
                            const pluginArgs = { html, plugin: plugin, outputName: childCompilationOutputName };
                            return getHtmlWebpackPluginHooks(compilation).beforeEmit.promise(pluginArgs)
                                .then(result => result.html);
                        })
                        .catch(err => {
                            // In case anything went wrong the promise is resolved
                            // with the error message and an error is logged
                            compilation.errors.push(prettyError(err, compiler.context).toString());
                            // Prevent caching
                            plugin.hash = null;
                            return plugin.options.showErrors ? prettyError(err, compiler.context).toHtml() : 'ERROR';
                        })
                        .then(html => {
                            // Allow to use [templatehash] as placeholder for the html-webpack-plugin name
                            // See also https://survivejs.com/webpack/optimizing/adding-hashes-to-filenames/
                            // From https://github.com/webpack-contrib/extract-text-webpack-plugin/blob/8de6558e33487e7606e7cd7cb2adc2cccafef272/src/index.js#L212-L214
                            const finalOutputName = childCompilationOutputName.replace(/\[(?:(\w+):)?templatehash(?::([a-z]+\d*))?(?::(\d+))?\]/ig, (_, hashType, digestType, maxLength) => {
                                return loaderUtils.getHashDigest(Buffer.from(html, 'utf8'), hashType, digestType, parseInt(maxLength, 10));
                            });
                            // Add the evaluated html code to the webpack assets
                            compilation.assets[finalOutputName] = {
                                source: () => html,
                                size: () => html.length
                            };
                            return finalOutputName;
                        })
                        .then((finalOutputName) => getHtmlWebpackPluginHooks(compilation).afterEmit.promise({
                            outputName: finalOutputName,
                            plugin: plugin
                        }).catch(err => {
                            this.logger.error(err);
                            return null;
                        }).then(() => null));

                    emitHtmlPromises.push(emitHtmlPromise);
                })

                // Once all files are added to the webpack compilation
                // let the webpack compiler continue
                Promise.all(emitHtmlPromises)
                    .then(() => {
                        this.logger.log('hook emit finished')
                        callback();
                    });
            });
    }

    /**
     * updates all HtmlWebpackPLugin options
     * @param {WebpackCompiler} compiler
     */
    updateOptions(compiler) {
        this.logger.log('plugin options have been updated')

        this.htmlWebpackPlugins.forEach((htmlWebpackPlugin) => {
            htmlWebpackPlugin.options.template = setTemplateOption(htmlWebpackPlugin.options.template, compiler.context);

            htmlWebpackPlugin.options.filename = setFileNameOption(htmlWebpackPlugin.options, compiler);

            htmlWebpackPlugin.options.minify = setMinifyOption(htmlWebpackPlugin.options, compiler);
        })
    }

    /**
   * Evaluates the child compilation result
   * @param {WebpackCompilation} compilation
   * @param {string} source
   * @returns {Promise<string | (() => string | Promise<string>)>}
   */
    evaluateCompilationResult(compilation, source, plugin) {
        if (!source) {
            return Promise.reject(new Error('The child compilation didn\'t provide a result'));
        }
        // The LibraryTemplatePlugin stores the template result in a local variable.
        // To extract the result during the evaluation this part has to be removed.
        source = source.replace('var HTML_WEBPACK_PLUGIN_RESULT =', '');
        const template = plugin.options.template.replace(/^.+!/, '').replace(/\?.+$/, '');
        const vmContext = vm.createContext(_.extend({ HTML_WEBPACK_PLUGIN: true, require: require }, global));
        const vmScript = new vm.Script(source, { filename: template });
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
            : Promise.reject(new Error('The loader "' + plugin.options.template + '" didn\'t return html.'));
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
    getTemplateParameters(compilation, assets, assetTags, plugin) {
        const templateParameters = plugin.options.templateParameters;
        if (templateParameters === false) {
            return Promise.resolve({});
        }
        if (typeof templateParameters === 'function') {
            return Promise
                .resolve()
                .then(() => templateParameters(compilation, assets, assetTags, plugin.options));
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
    executeTemplate(templateFunction, assets, assetTags, compilation, plugin) {
        // Template processing
        const templateParamsPromise = this.getTemplateParameters(compilation, assets, assetTags, plugin);
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
    postProcessHtml(html, assets, assetTags, plugin) {
        if (typeof html !== 'string') {
            return Promise.reject(new Error('Expected html to be a string but got ' + JSON.stringify(html)));
        }
        const htmlAfterInjection = plugin.options.inject
            ? this.injectAssetsIntoHtml(html, assets, assetTags, plugin)
            : html;
        const htmlAfterMinification = typeof plugin.options.minify === 'object'
            ? require('html-minifier').minify(htmlAfterInjection, plugin.options.minify)
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
    addFileToAssets(filename, compilation) {
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
    sortEntryChunks(entryNames, sortMode, compilation, plugin) {
        // Custom function
        if (typeof sortMode === 'function') {
            return entryNames.sort(sortMode);
        }
        // Check if the given sort mode is a valid chunkSorter sort mode
        if (typeof chunkSorter[sortMode] !== 'undefined') {
            return chunkSorter[sortMode](entryNames, compilation, plugin.options);
        }
        throw new Error('"' + sortMode + '" is not a valid chunk sort mode');
    }

    /**
     * Return all chunks from the compilation result which match the exclude and include filters
     * @param {any} chunks
     * @param {string[]|'all'} includedChunks
     * @param {string[]} excludedChunks
     */
    filterChunks(chunks, includedChunks, excludedChunks) {
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
    isHotUpdateCompilation(assets) {
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
    htmlWebpackPluginAssets(compilation, childCompilationOutputName, entryNames, plugin) {
        const compilationHash = compilation.hash;

        /**
         * @type {string} the configured public path to the asset root
         * if a path publicPath is set in the current webpack config use it otherwise
         * fallback to a realtive path
         */
        const webpackPublicPath = compilation.mainTemplate.getPublicPath({ hash: compilationHash });
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
        if (plugin.options.hash && assets.manifest) {
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
                    return plugin.options.hash
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
    getFaviconPublicPath(faviconFilePath, compilation, publicPath, plugin) {
        if (!faviconFilePath) {
            return Promise.resolve(undefined);
        }
        return this.addFileToAssets(faviconFilePath, compilation)
            .then((faviconName) => {
                const faviconPath = publicPath + faviconName;
                if (plugin.options.hash) {
                    return this.appendHash(faviconPath, compilation.hash);
                }
                return faviconPath;
            });
    }

    /**
     * Generate meta tags
     * @returns {HtmlTagObject[]}
     */
    getMetaTags(plugin) {
        const metaOptions = plugin.options.meta;
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
    generatedScriptTags(jsAssets) {
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
    generateStyleTags(cssAssets) {
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
    generateBaseTag(baseOption) {
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
    generatedMetaTags(metaOptions) {
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
    generateFaviconTags(faviconPath) {
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
    generateAssetGroups(assetTags, scriptTarget) {
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
    injectAssetsIntoHtml(html, assets, assetTags, plugin) {
        const htmlRegExp = /(<html[^>]*>)/i;
        const headRegExp = /(<\/head\s*>)/i;
        const bodyRegExp = /(<\/body\s*>)/i;
        const body = assetTags.bodyTags.map((assetTagObject) => htmlTagObjectToString(assetTagObject, plugin.options.xhtml));
        const head = assetTags.headTags.map((assetTagObject) => htmlTagObjectToString(assetTagObject, plugin.options.xhtml));

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
    appendHash(url, hash) {
        if (!url) {
            return url;
        }
        return url + (url.indexOf('?') === -1 ? '?' : '&') + hash;
    }

    /**
     * Helper to return a sorted unique array of all asset files out of the
     * asset object
     */
    getAssetFiles(assets) {
        const files = _.uniq(Object.keys(assets).filter(assetType => assetType !== 'chunks' && assets[assetType]).reduce((files, assetType) => files.concat(assets[assetType]), []));
        files.sort();
        return files;
    }
}

module.exports = {
    MultiHtmlWebpackPlugin
};
