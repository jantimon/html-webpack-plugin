# The template option

## History

The version 2.x which was introduced 2015 changed the way the template is processed.
Instead of forcing all users to use the [blueimp](https://github.com/blueimp/JavaScript-Templates) template engine it allowed to use any webpack loader:

* [pug](https://github.com/pugjs/pug-loader)
* [ejs](https://github.com/okonet/ejs-loader)
* [underscore](https://github.com/emaphp/underscore-template-loader)
* [handlebars](https://github.com/pcardune/handlebars-loader)
* [html-loader](https://github.com/webpack/html-loader)
* ...

Under the hood it is using a webpack child compilation which inherits all loaders from
your main configuration.

There are three ways to set the loader:

## 1) Don't set any loader

By default (if you don't specify any loader in any way) a [fallback ejs loader](https://github.com/jantimon/html-webpack-plugin/blob/master/lib/loader.js) kicks in.
Please note that this loader does not support the full ejs syntax as it is based on [lodash template](https://lodash.com/docs/#template).

```js
{
  plugins: [
    new HtmlWebpackPlugin({
      template: 'src/index.html'
    })
  ]
}
```

Be aware, using `.html` as your template extention may unexpectedly trigger another loader.

## 2) Setting a loader directly for the template

```js
new HtmlWebpackPlugin({
  // For details on `!!` see https://webpack.js.org/concepts/loaders/#inline
  template: '!!handlebars-loader!src/index.hbs'
})
```

## 3) Setting a loader using the `module.loaders` syntax

```js
{
  module: {
    loaders: [
      {
        test: /\.hbs$/,
        loader: 'handlebars-loader'
      },
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: 'src/index.hbs'
    })
  ]
}
```

However this also means that in the following example webpack will use the [html loader for your template](https://webpack.js.org/loaders/html-loader/).
This will **cause html minification** and it will also **disable the ejs/lodash fallback** loader.

```js
{
  module: {
    loaders: [
      {
        test: /\.html$/,
        loader: 'html-loader'
      }],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: 'src/index.html'
    })
  ]
}
```
