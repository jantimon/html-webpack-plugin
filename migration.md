# Migrating from 1.x to 2.x

## Default config

https://github.com/ampedandwired/html-webpack-plugin/tree/master/examples/default

As of 2.x the `inject` options is set to true by default which means that all your javascript, css files and manifest files are injected automatically. See https://github.com/ampedandwired/html-webpack-plugin#configuration

The default template has changed according to the inject option - but should behave like the previous version did.


```js
var HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    // ...
    plugins: [
        new HtmlWebpackPlugin()
    ]
};
```

## Custom template

This inject feature aims to simpify your custom templates:
https://github.com/ampedandwired/html-webpack-plugin/tree/master/examples/custom-template

```js
var HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    // ...
    plugins: [
        new HtmlWebpackPlugin({
          template: 'template.html'
        })
    ]
};
```

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Webpack App</title>
</head>
<body>
</body>
</html>
```

Although we did not specify any script tags or link tags they will be injected automatically and the result will be:
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Webpack App</title>
  <link href="styles.css" rel="stylesheet">
</head>
<body>
<script src="bundle.js"></script>
</body>
</html>
```

## Templating and variables

As of 2.x blueimp was replaced by lodash/underscore/ejs templates as they are more common.
This also removes the `o` in template variables. ` <body class="{%= o.htmlWebpackPlugin.options.environment %}">` becomes `<body class="<%= htmlWebpackPlugin.options.environment %>">` it also allows to escape variables by using `<%-` instead of `<%=` to prevent unexpected behaviours: `<body class="<%- htmlWebpackPlugin.options.environment %>">` 

# Loaders in templates
Loaders may now be used inside the template the same way as you would expect in your javascript files.

```html
<link rel="apple-touch-icon" href="<%- require('../images/favicons/apple-icon-60x60.png') %>">
<%= require('partial.html') %>
```

For the above example you would have to configure a [html](https://github.com/webpack/html-loader) and url/[file-loader](https://github.com/webpack/file-loader):

```js
module: {
  loaders: [
    {test: /\.png$/, loader: "file-loader"},
    {
      test: /\.html$/,
      exclude: /index\.html$/, // you need to exclude your base template (unless you do not want this plugin own templating feature)
      loader: "html"
    }
  ]
}
```

This configuration allows you to require partial html from your main `index.html` without being itself parsed by the html-loader instead of this html-webpack-plugin.


## Custom template engines

Maybe you prefer jade or blueimp over underscore - or your project is using jade for the front end part.
With 2.x you can use the webpack loaders either once only for the template as in the following example
where we use jade (requires the [jade-loader](https://github.com/webpack/jade-loader)):

```js
var HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    // ...
    plugins: [
        new HtmlWebpackPlugin({
          template: 'jade!template.jade'
        })
    ]
};
```

or by configuring webpack to handle all `.jade` files:

```js
module.exports = {
  // ...
  module: {
    loaders: [
      { test: /\.jade$/, loader: 'jade' }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: 'template.jade'
    })
  ]
};
```

Please note that if you specify the loader and use 'jade!template.jade' webpack will try to apply the jade loader twice and fail.

## Isomorph apps

As of the loader changes in 2.x the `templateContent` was removed.
However you can still use custom javascript functions to generate a template:

```js
module.exports = {
  // ...
  plugins: [
    new HtmlWebpackPlugin({
      template: 'template.js'
    })
  ]
};
```
Simple template.js
```js
module.exports = '<html>...</html>';
```
More advanced template.js
```js
  module.exports = function(templateParams) {
      return '<html>..</html>';
  };
```
Using loaders inside a template.js
```js
  // This function has to return a string or promised string:
  module.exports = function(templateParams) {
      // Play around with the arguments and then use the webpack jade loader to load the jade:
      return require('./template.jade')({assets: templateParams.htmlWebpackPlugin.files});
  };
```

Unfortunately `__dirname` does not work correctly.
If someone knows why I would love to merge a pull request.
A good starting point might be here: https://github.com/webpack/webpack/issues/135
