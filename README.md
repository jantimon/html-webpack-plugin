HTML Webpack Plugin
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
bundles in the body.

For example, this webpack config...
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

generates a file `dist/index.html` containing the following:
```html
<!DOCTYPE html>
<html>
  <head>
    <meta http-equiv="Content-type" content="text/html; charset=utf-8"/>
    <title>Webpack App</title>
  </head>
  <body>
    <script src="index_bundle.js"></script>
  </body>
</html>
```

If you have multiple webpack entry points, they will all be included with `script`
tags in the generated HTML.


Configuration
-------------
You can pass a hash of configuration options to `HtmlWebpackPlugin`.
Allowed values are as follows:

- `title`: The title to use for the generated HTML document.

Here's an example webpack config illustrating how to use these options:
```javascript
{
  entry: 'index.js',
  output: {
    path: 'dist',
    filename: 'index_bundle.js'
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: 'My App'
    })
  ]
}
```

Writing Your Own Templates
--------------------------
TODO
