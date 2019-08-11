---
name: Bug report
about: Create a report to help us improve

---

## Expected behaviour

Tell us what you would expect the html-webpack-plugin should.

## Current behaviour

Tell us what the html-webpack-plugin does instead.

## Environment

Tell us which operating system you are using, as well as which versions of Node.js, npm, webpack, and html-webpack-plugin. Run the following to get it quickly:

```
node -e "var os=require('os');console.log('Node.js ' + process.version + '\n' + os.platform() + ' ' + os.release())"
npm --version
npm ls webpack
npm ls html-webpack-plugin
```

### Config

Copy the minimal `webpack.config.js` to produce this issue:


```js
module.exports = {
  entry: 'app.js',
  output: {
    path: 'dist',
    filename: 'index_bundle.js'
  },
  module: {
    rules: [
      ...
    ]
  }
  plugins: [
    new HtmlWebpackPlugin(),
    ...
  ]
}
```

Copy your template file if it is part of this issue:

```html
<!DOCTYPE html>
<html>
    <head>
        <title>My App</title>
    </head>
    <body>
    </body>
</html>
```

## Relevant Links

- If your project is public, link to the repo so we can investigate directly.
- **BONUS POINTS:** Create a [minimal reproduction](http://stackoverflow.com/help/mcve) and upload it to GitHub. This will get you the fastest support.

## Additional context

Add any other context about the problem here.
