html-webpack-plugin
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
{
  entry: {
    util: 'util.js',
    app: 'index.js'
  },
  output: {
    path: 'dist',
    filename: '[name]_bundle.js'
  },
  plugins: [new HtmlWebpackPlugin()]
}
```

... generates a file `dist/index.html` containing the following:
```html
<!DOCTYPE html>
<html>
  <head>
    <meta http-equiv="Content-type" content="text/html; charset=utf-8"/>
    <title>Webpack App</title>
  </head>
  <body>
    <script src="util_bundle.js"></script>
    <script src="app_bundle.js"></script>
  </body>
</html>
```
