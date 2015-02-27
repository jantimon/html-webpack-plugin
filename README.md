HTML Webpack Plugin
===================

![build status](http://img.shields.io/travis/ampedandwired/html-webpack-plugin/master.svg?style=flat)
![coverage](http://img.shields.io/coveralls/ampedandwired/html-webpack-plugin/master.svg?style=flat)
![license](http://img.shields.io/npm/l/html-webpack-plugin.svg?style=flat)
![version](http://img.shields.io/npm/v/html-webpack-plugin.svg?style=flat)
![downloads](http://img.shields.io/npm/dm/html-webpack-plugin.svg?style=flat)

This is a [webpack](http://webpack.github.io/) plugin that simplifies creation of HTML files to serve your webpack bundles. This is especially useful for webpack bundles that include a hash in the filename which changes every compilation. You can either let the plugin generate an HTML file for you or supply your own template (using [lodash templates](https://lodash.com/docs#template)).

Installation
------------
Install the plugin with npm:
```shell
$ npm install html-webpack-plugin --save-dev
```


Basic Usage
-----------

The plugin will generate an HTML5 file for you that includes all your webpack bundles in the body using `script` tags. Just add the plugin to your webpack config as follows:

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
    <meta http-equiv="Content-type" content="text/html; charset=utf-8"/>
    <title>Webpack App</title>
  </head>
  <body>
    <script src="index_bundle.js"></script>
  </body>
</html>
```

If you have multiple webpack entry points, they will all be included with `script` tags in the generated HTML.


Configuration
-------------
You can pass a hash of configuration options to `HtmlWebpackPlugin`.Allowed values are as follows:

- `title`: The title to use for the generated HTML document.
- `filename`: The file to write the HTML to. Defaults to `index.html`. You can specify a subdirectory here too (eg: `assets/admin.html`).

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
      title: 'My App',
      filename 'assets/admin.html'
    })
  ]
}
```

Generating Multiple HTML Files
------------------------------
To generate more than one HTML file, declare the plugin more than once in your plugins array:
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
      template: fs.readFileSync('src/assets/test.html')
    })
  ]
}
```

Writing Your Own Templates
--------------------------
If the default generated HTML doesn't meet your needs you can supply your own [lodash template](https://lodash.com/docs#template). The [default template](https://github.com/ampedandwired/html-webpack-plugin/blob/master/default_index.html)
is a good starting point for writing your own.

Let's say for example you wanted to put a webpack bundle into the head of your HTML as well as the body. Your template might look like this:
```html
<!DOCTYPE html>
<html>
  <head>
    <meta http-equiv="Content-type" content="text/html; charset=utf-8"/>
    <title>My App</title>
    <script src="{%=o.htmlWebpackPlugin.assets.head%}"></script>
  </head>
  <body>
    <script src="{%=o.htmlWebpackPlugin.assets.main%}"></script>
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
      template: fs.readFileSync('src/assets/my_template.html')
    })
  ]
}
```

Alternatively, if you already have your template's content in a string, you can pass it to the plugin using the `template` option:
```javascript
plugins: [
  new HtmlWebpackPlugin({
    template: '<html>...</html>'
  })
]
```
