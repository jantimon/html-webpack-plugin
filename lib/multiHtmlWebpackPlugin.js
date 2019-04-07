/** @typedef {import("../index")} HtmlWebpackPlugin */
/** @typedef {import("../typings").HtmlTagObject} HtmlTagObject */
/** @typedef {import("webpack/lib/Compilation.js")} WebpackCompilation */
/** @typedef {import("webpack/lib/Compiler.js")} WebpackCompiler */

const loaderUtils = require('loader-utils');
const log = require('webpack-log');

const prettyError = require('./errors.js');
const {getHtmlWebpackPluginHooks} = require('./hooks.js');

class MultiHtmlWebpackPlugin {
  /**
   * @param {[HtmlWebpackPlugin]} htmlWebpackPlugins
   * @param {WebpackCompiler} compiler
   */
  constructor (htmlWebpackPlugins, compiler) {
    /**
     * @type {[HtmlWebpackPlugin]}
     */
    this.htmlWebpackPlugins = htmlWebpackPlugins;

    this.logger = log({name: 'MultiHtmlWebpackPlugin'});

    this.apply(compiler);
  }

  /**
   * @param {WebpackCompiler} compiler
   */
  apply (compiler) {
    this.logger.debug('Apply has been called');

    let childCompilerPromises;

    this.htmlWebpackPlugins.forEach((htmlWebpackPlugin) => htmlWebpackPlugin.updateOptions(compiler));

    // Register all HtmlWebpackPlugins instances at the child compiler
    compiler.hooks.thisCompilation.tap('HtmlWebpackPlugin', (compilation) => {
      this.logger.debug('hook thisCompilation has been called');

      this.htmlWebpackPlugins.forEach((htmlWebpackPlugin) => htmlWebpackPlugin.updateChildCompiler(compiler, compilation));

      // Add file dependencies of child compiler to parent compiler
      // to keep them watched even if we get the result from the cache
      compilation.hooks.additionalChunkAssets.tap('HtmlWebpackPlugin', () => {
        this.logger.debug('hook add additionalChunkAssets started');

        this.htmlWebpackPlugins.forEach((htmlWebpackPlugin) => htmlWebpackPlugin.addFileDependencies(compiler, compilation));
      });
    });

    compiler.hooks.make.tapPromise('HtmlWebpackPlugin', (compilation) => {
      this.logger.debug('hooks.make.tapPromise has been called');

      childCompilerPromises = this.htmlWebpackPlugins.map((htmlWebpackPlugin) => htmlWebpackPlugin.compileTemplate(compiler, compilation));

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
          const filteredEntryNames = plugin.filterChunks(entryNames, plugin.options.chunks, plugin.options.excludeChunks);
          const sortedEntryNames = plugin.sortEntryChunks(filteredEntryNames, plugin.options.chunksSortMode, compilation);
          const childCompilationOutputName = plugin.childCompilationOutputName;

          if (childCompilationOutputName === undefined) {
            throw new Error('Did not receive child compilation result');
          }

          // Turn the entry point names into file paths
          const assets = plugin.htmlWebpackPluginAssets(compilation, childCompilationOutputName, sortedEntryNames);

          // If this is a hot update compilation, move on!
          // This solves a problem where an `index.html` file is generated for hot-update js files
          // It only happens in Webpack 2, where hot updates are emitted separately before the full bundle
          if (plugin.isHotUpdateCompilation(assets)) {
            return;
          }

          // If the template and the assets did not change we don't have to emit the html
          const assetJson = JSON.stringify(plugin.getAssetFiles(assets));
          if (plugin.isCompilationCached && plugin.options.cache && assetJson === plugin.assetJson) {
            return;
          } else {
            plugin.assetJson = assetJson;
          }

          // The html-webpack plugin uses a object representation for the html-tags which will be injected
          // to allow altering them more easily
          // Just before they are converted a third-party-plugin author might change the order and content
          const assetsPromise = plugin.getFaviconPublicPath(plugin.options.favicon, compilation, assets.publicPath)
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
            .then(({assets}) => getHtmlWebpackPluginHooks(compilation).alterAssetTags.promise({
              assetTags: {
                scripts: plugin.generatedScriptTags(assets.js),
                styles: plugin.generateStyleTags(assets.css),
                meta: [
                  ...plugin.generateBaseTag(plugin.options.base),
                  ...plugin.generatedMetaTags(plugin.options.meta),
                  ...plugin.generateFaviconTags(assets.favicon)
                ]
              },
              outputName: childCompilationOutputName,
              plugin: plugin
            }))
            .then(({assetTags}) => {
              // Inject scripts to body unless it set explictly to head
              const scriptTarget = plugin.options.inject === 'head' ? 'head' : 'body';
              // Group assets to `head` and `body` tag arrays
              const assetGroups = plugin.generateAssetGroups(assetTags, scriptTarget);
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

              return plugin.evaluateCompilationResult(compilation, compiledTemplate[index]);
            });

          const templateExectutionPromise = Promise.all([assetsPromise, assetTagGroupsPromise, templateEvaluationPromise])
            // Execute the template
            .then(([assetsHookResult, assetTags, compilationResult]) => {
              return typeof compilationResult !== 'function'
                ? compilationResult
                : plugin.executeTemplate(compilationResult, assetsHookResult.assets, {headTags: assetTags.headTags, bodyTags: assetTags.bodyTags}, compilation);
            }
            );

          const injectedHtmlPromise = Promise.all([assetTagGroupsPromise, templateExectutionPromise])
            // Allow plugins to change the html before assets are injected
            .then(([assetTags, html]) => {
              const pluginArgs = {html, headTags: assetTags.headTags, bodyTags: assetTags.bodyTags, plugin: plugin, outputName: childCompilationOutputName};
              return getHtmlWebpackPluginHooks(compilation).afterTemplateExecution.promise(pluginArgs);
            })
            .then(({html, headTags, bodyTags}) => {
              return plugin.postProcessHtml(html, assets, {headTags, bodyTags});
            });

          const emitHtmlPromise = injectedHtmlPromise
            // Allow plugins to change the html after assets are injected
            .then((html) => {
              const pluginArgs = {html, plugin: plugin, outputName: childCompilationOutputName};
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
        });

        // Once all files are added to the webpack compilation
        // let the webpack compiler continue
        Promise.all(emitHtmlPromises)
          .then(() => {
            this.logger.log('hook emit finished');
            callback();
          });
      });
  }
}

module.exports = {
  MultiHtmlWebpackPlugin
};
