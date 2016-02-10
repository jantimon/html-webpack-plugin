/* This loader renders the template with underscore if no other loader was found */
'use strict';

var _ = require('lodash');
var loaderUtils = require('loader-utils');

module.exports = function (source) {
  if (this.cacheable) {
    this.cacheable();
  }
  var allLoadersButThisOne = this.loaders.filter(function (loader) {
    // Loader API changed from `loader.module` to `loader.normal` in Webpack 2.
    return (loader.module || loader.normal) !== module.exports;
  });
  // This loader shouldn't kick in if there is any other loader
  if (allLoadersButThisOne.length > 0) {
    return source;
  }
  // Skip .js files
  if (/\.js$/.test(this.request)) {
    return source;
  }
  // Use underscore for a minimalistic loader
  var options = loaderUtils.parseQuery(this.query);
  var template = _.template(source, options);
  return 'var _ = require(' + loaderUtils.stringifyRequest(this, require.resolve('lodash')) + ');module.exports = ' + template;
};
