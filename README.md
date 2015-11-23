HTML Webpack Plugin
=================== 
[![npm version](https://badge.fury.io/js/html-webpack-plugin.svg)](http://badge.fury.io/js/html-webpack-plugin) [![Dependency Status](https://david-dm.org/ampedandwired/html-webpack-plugin.svg)](https://david-dm.org/ampedandwired/html-webpack-plugin) [![bitHound Score](https://www.bithound.io/github/ampedandwired/html-webpack-plugin/badges/score.svg)](https://www.bithound.io/github/ampedandwired/html-webpack-plugin) [![Build status](https://travis-ci.org/ampedandwired/html-webpack-plugin.svg)](https://travis-ci.org/ampedandwired/html-webpack-plugin)

This is a [webpack](http://webpack.github.io/) plugin that simplifies creation of HTML files to serve your
webpack bundles. This is especially useful for webpack bundles that include
a hash in the filename which changes every compilation. You can either let the plugin generate an HTML file for you or supply
your own template (using [blueimp templates](https://github.com/blueimp/JavaScript-Templates)).

Installation
------------
Install the plugin with npm:
```shell
$ npm install html-webpack-plugin --save-dev
```

There is also a [2.0 beta branch](https://github.com/ampedandwired/html-webpack-plugin/tree/feature/loaders) which allows using loaders for templates.
For further information on 2.0 see the according [pull-request](https://github.com/ampedandwired/html-webpack-plugin/pull/41) 
```shell
$ npm install html-webpack-plugin@2 --save-dev
```


Basic Usage
-----------

The plugin will generate an HTML5 file for you that includes all your webpack
bundles in the body using `script` tags. Just add the plugin to your webpack
config as follows:

```javascript
var HtmlWebpackPlugin = require('html-webpack-plugin')
var webpackConfig = {
  entry: 'index.js',
  output: {
    path: 'dist',
    filename: 'index_bundle.js'
  },
  plugins: [new HtmlWebpackPlugin()]
}
```

This will generate a file `dist/index.html` containing the following:
```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>Webpack App</title>
  </head>
  <body>
    <script src="index_bundle.js"></script>
  </body>
</html>
```

If you have multiple webpack entry points, they will all be included with `script`
tags in the generated HTML.

If you have any css assets in webpack's output (for example, css extracted
with the [ExtractTextPlugin](https://github.com/webpack/extract-text-webpack-plugin))
then these will be included with `<link>` tags in the HTML head.

Configuration
-------------
You can pass a hash of configuration options to `HtmlWebpackPlugin`.
Allowed values are as follows:

- `title`: The title to use for the generated HTML document.
- `filename`: The file to write the HTML to. Defaults to `index.html`.
   You can specify a subdirectory here too (eg: `assets/admin.html`).
- `template`: A html template (supports [blueimp templates](https://github.com/blueimp/JavaScript-Templates)).
- `templateContent`: A html string or a function returning the html  (supports [blueimp templates](https://github.com/blueimp/JavaScript-Templates)).  
- `inject`: `true | 'head' | 'body' | false` Inject all assets into the given `template` or `templateContent` - When passing `true` or `'body'` all javascript resources will be placed at the bottom of the body element. `'head'` will place the scripts in the head element.
- `favicon`: Adds the given favicon path to the output html.
- `minify`: `{...} | false` Pass a [html-minifier](https://github.com/kangax/html-minifier#options-quick-reference) options object to minify the output.
- `hash`: `true | false` if `true` then append a unique webpack compilation hash to all
  included scripts and css files. This is useful for cache busting.
- `chunks`: Allows you to add only some chunks (e.g. only the unit-test chunk)
- `excludeChunks`: Allows you to skip some chunks (e.g. don't add the unit-test chunk) 
- `chunksSortMode`: Allows to controll how chunks should be sorted before they are included to the html. Allowed values: 'none' | 'default' | {function} - default: 'auto'

Here's an example webpack config illustrating how to use these options:
```javascript
{
  entry: 'index.js',
  output: {
    path: 'dist',
    filename: 'index_bundle.js',
    hash: true
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: 'My App',
      filename: 'assets/admin.html'
    })
  ]
}
```

Generating Multiple HTML Files
------------------------------
To generate more than one HTML file, declare the plugin more than
once in your plugins array:
```javascript
{
  entry: 'index.js',
  output: {
    path: 'dist',
    filename: 'index_bundle.js'
  },
  plugins: [
    new HtmlWebpackPlugin(), // Generates default index.html
    new HtmlWebpackPlugin({  // Also generate a test.html
      filename: 'test.html',
      template: 'src/assets/test.html'
    })
  ]
}
```

Writing Your Own Templates
--------------------------
If the default generated HTML doesn't meet your needs you can supply
your own template. The easiest way is to use the `inject` option and pass a custom html file.
The html-webpack-plugin will automatically inject all necessary css, js, manifest
and favicon files into the markup.

```javascript
plugins: [
  new HtmlWebpackPlugin({
    title: 'Custom template', 
    template: 'my-index.html', // Load a custom template
    inject: 'body' // Inject all scripts into the body
  })
]
```

`my-index.html`:

```html
<!DOCTYPE html>
<html>
  <head>
    <meta http-equiv="Content-type" content="text/html; charset=utf-8"/>
    <title>{%= o.htmlWebpackPlugin.options.title %}</title>
  </head>
  <body>
  </body>
</html>
```

Alternatively, if you already have your template's content in a String, you
can pass it to the plugin using the `templateContent` option:
```javascript
plugins: [
  new HtmlWebpackPlugin({
    inject: true,
    templateContent: templateContentString
  })
]
```

You can use the [blueimp template](https://github.com/blueimp/JavaScript-Templates) syntax out of the box.
If the `inject` feature doesn't fit your needs and you want full control over the asset placement use the [default template](https://github.com/ampedandwired/html-webpack-plugin/blob/master/default_index.html)
as a starting point for writing your own.

The `templateContent` option can also be a function to use another template language like jade:
```javascript
plugins: [
  new HtmlWebpackPlugin({
    templateContent: function(templateParams, compilation) {
      // Return your template content synchronously here
      return '..';
    }
  })
]
```
Or the async version:
```javascript
plugins: [
  new HtmlWebpackPlugin({
    templateContent: function(templateParams, compilation, callback) {
      // Return your template content asynchronously here
      callback(null, '..');
    }
  })
]
```

Note the plugin will throw an error if you specify both `template` _and_
`templateContent`.

The `o` variable in the template is the data that is passed in when the
template is rendered. This variable has the following attributes:
- `htmlWebpackPlugin`: data specific to this plugin
  - `htmlWebpackPlugin.files`: a massaged representation of the
    `assetsByChunkName` attribute of webpack's [stats](https://github.com/webpack/docs/wiki/node.js-api#stats)
    object. It contains a mapping from entry point name to the bundle filename, eg:
    ```json
    "htmlWebpackPlugin": {
      "files": {
        "css": [ "main.css" ],
        "js": [ "assets/head_bundle.js", "assets/main_bundle.js"],
        "chunks": {
          "head": {
            "entry": "assets/head_bundle.js",
            "css": [ "main.css" ]
          },
          "main": {
            "entry": "assets/main_bundle.js",
            "css": []
          },
        }
      }
    }
    ```
    If you've set a publicPath in your webpack config this will be reflected
    correctly in this assets hash.

  - `htmlWebpackPlugin.options`: the options hash that was passed to
     the plugin. In addition to the options actually used by this plugin,
     you can use this hash to pass arbitrary data through to your template.

- `webpack`: the webpack [stats](https://github.com/webpack/docs/wiki/node.js-api#stats)
  object. Note that this is the stats object as it was at the time the HTML template
  was emitted and as such may not have the full set of stats that are available
  after the wepback run is complete.

- `webpackConfig`: the webpack configuration that was used for this compilation. This
  can be used, for example, to get the `publicPath` (`webpackConfig.output.publicPath`).


Filtering chunks
----------------

To include only certain chunks you can limit the chunks being used:

```javascript
plugins: [
  new HtmlWebpackPlugin({
    chunks: ['app']
  })
]
```

It is also possible to exclude certain chunks by setting the `excludeChunks` option:

```javascript
plugins: [
  new HtmlWebpackPlugin({
    excludeChunks: ['dev-helper']
  })
]
```

