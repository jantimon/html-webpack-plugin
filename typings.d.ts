
/**
 * The plugin options
 */
interface HtmlWebpackPluginOptions {
    /**
     * The title to use for the generated HTML document
     */
    title: string,
    /**
     * The `webpack` require path to the template.
     * @see https://github.com/jantimon/html-webpack-plugin/blob/master/docs/template-option.md
     */
    template: string,
    /**
     * Allow to use a html string instead of reading from a file
     */
    templateContent:
      false // Use the template option instead to load a file
      | string
      | Promise<string>,
    /**
     * Allows to overwrite the parameters used in the template
     */
    templateParameters:
      false // Pass an empty object to the template function
      | ((compilation: any, assets, assetTags: { headTags: Array<HtmlTagObject>, bodyTags: Array<HtmlTagObject> }, options: HtmlWebpackPluginOptions) => {[option: string]: any})
      | ((compilation: any, assets, assetTags: { headTags: Array<HtmlTagObject>, bodyTags: Array<HtmlTagObject> }, options: HtmlWebpackPluginOptions) => Promise<{[option: string]: any}>)
      | {[option: string]: any}
    /**
     * The file to write the HTML to.
     * Defaults to `index.html`.
     * Supports subdirectories eg: `assets/admin.html`
     */
    filename: string,
    /**
     * If `true` then append a unique `webpack` compilation hash to all included scripts and CSS files.
     * This is useful for cache busting
     */
    hash: boolean,
    /**
     * Inject all assets into the given `template` or `templateContent`.
     */
    inject: false // Don't inject scripts
    | true    // Inject scripts into body
    | 'body'  // Inject scripts into body
    | 'head'  // Inject scripts into head
    /**
     * Path to the favicon icon
     */
    favicon: false | string,
    /**
     * HTML Minification options
     * @https://github.com/kangax/html-minifier#options-quick-reference
     */
    minify?: boolean | {},
    cache: boolean,
    /**
     * Render errors into the HTML page
     */
    showErrors: boolean,
    /**
     * List all entries which should be injected
     */
    chunks: 'all' | string[],
    /**
     * List all entries which should not be injeccted
     */
    excludeChunks: string[],
    chunksSortMode: 'auto' | 'manual' | (((entryNameA: string, entryNameB: string) => number)),
    /**
     * Inject meta tags
     */
    meta: false // Disable injection
      | {
          [name: string]: string|false // name content pair e.g. {viewport: 'width=device-width, initial-scale=1, shrink-to-fit=no'}`
          | {[attributeName: string]: string|boolean} // custom properties e.g. { name:"viewport" content:"width=500, initial-scale=1" }
      },
    /**
     * Enforce self closing tags e.g. <link />
     */
    xhtml: boolean

    /**
     * In addition to the options actually used by this plugin, you can use this hash to pass arbitrary data through
     * to your template.
     */
    [option: string]: any;
}

/**
 * A tag element according to the htmlWebpackPlugin object notation
 */
interface HtmlTagObject {
  /**
   * Attributes of the html tag
   * E.g. `{'disabled': true, 'value': 'demo'}`
   */
  attributes: {
    [attributeName: string]: string|boolean
  },
  /**
   * Wether this html must not contain innerHTML
   * @see https://www.w3.org/TR/html5/syntax.html#void-elements
   */
  voidTag: boolean,
  /**
   * The tag name e.g. `'div'`
   */
  tagName: string,
  /**
   * Inner HTML The
   */
  innerHTML?: string
}

/**
 * The values which are available during template execution
 *
 * Please keep in mind that the `templateParameter` options allows to change them
 */
interface HtmlWebpackPluginTemplateParameter {
  compilation: any,
  webpackConfig: any
  htmlWebpackPlugin: {
    tags: {
      headTags: HtmlTagObject[],
      bodyTags: HtmlTagObject[]
    },
    files: {
      publicPath: string,
      js: Array<string>,
      css: Array<string>,
      manifest?: string,
      favicon?: string
    },
    options: HtmlWebpackPluginOptions
  }
}
