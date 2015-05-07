HTML Webpack Plugin [![bitHound Score](https://www.bithound.io/github/ampedandwired/html-webpack-plugin/badges/score.svg)](https://www.bithound.io/github/ampedandwired/html-webpack-plugin) [![Dependency Status](https://david-dm.org/ampedandwired/html-webpack-plugin.svg)](https://david-dm.org/ampedandwired/html-webpack-plugin)
===================

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

Icons - Favicon & Apple Touch Icon
----------------------------------

The plugin will automatically pick up if there is a file named `favicon.ico`
or `apple-touch-icon.png` included in the build, and automatically add them
to the HTML.

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>Webpack App</title>
    <link rel="shortcut icon" href="0a31c912c8b55c756f7a969982b1ff91.ico">
    <link rel="apple-touch-icon" href="2805113e07a3cf668e68442009c97e93.png">
  </head>
  <body>
    <script src="index_bundle.js"></script>
  </body>
</html>
```

Configuration
-------------
You can pass a hash of configuration options to `HtmlWebpackPlugin`.
Allowed values are as follows:

- `title`: The title to use for the generated HTML document.
- `filename`: The file to write the HTML to. Defaults to `index.html`.
   You can specify a subdirectory here too (eg: `assets/admin.html`).
- `template`: A html template (supports [blueimp templates](https://github.com/blueimp/JavaScript-Templates)).
- `templateContent`: A html string or a function returning the html  (supports [blueimp templates](https://github.com/blueimp/JavaScript-Templates)).  
- `inject`: Inject all assets into the given `template` or `templateContent`. 
- `minify`: Set to true or pass a [html-minifier](https://github.com/kangax/html-minifier#options-quick-reference) options object to minify the output.
- `hash`: if `true` then append a unique webpack compilation hash to all
  included scripts and css files. This is useful for cache busting.

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
your own [blueimp template](https://github.com/blueimp/JavaScript-Templates).
The [default template](https://github.com/ampedandwired/html-webpack-plugin/blob/master/default_index.html)
is a good starting point for writing your own.

Let's say for example you wanted to put a webpack bundle into the head of your
HTML as well as the body. Your template might look like this:
```html
<!DOCTYPE html>
<html>
  <head>
    <meta http-equiv="Content-type" content="text/html; charset=utf-8"/>
    <title>My App</title>
    <script src="{%=o.htmlWebpackPlugin.files.chunks.head.entry%}"></script>
  </head>
  <body>
    <script src="{%=o.htmlWebpackPlugin.files.chunks.main.entry%}"></script>
  </body>
</html>
```

To use this template, configure the plugin like this:
```javascript
{
  entry: 'index.js',
  output: {
    path: 'dist',
    filename: 'index_bundle.js'
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: 'src/assets/my_template.html'
    })
  ]
}
```

Alternatively, if you already have your template's content in a String, you
can pass it to the plugin using the `templateContent` option:
```javascript
plugins: [
  new HtmlWebpackPlugin({
    templateContent: templateContentString
  })
]
```

The `templateContent` option can also be a function to use another template language like jade:
```javascript
plugins: [
  new HtmlWebpackPlugin({
    templateContent: function(templateParams, webpackCompiler) {
      // Return your template content synchronously here
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

