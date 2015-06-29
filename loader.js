var _ = require('lodash');
var loaderUtils = require('loader-utils');

module.exports = function (source) {
  'use strict';
  var allLoadersButThisOne = this.loaders.filter(function(loader) {
    return loader.module !== module.exports;
  });
  // This loader shouldn't kick in if there is any other loader
  if (allLoadersButThisOne.length > 0) {
    return source;
  }
  // Use underscore for a minimalistic loader
  if (this.cacheable) {
    this.cacheable();
  }
  var options = loaderUtils.parseQuery(this.query);
  var template = _.template(source, options);
  return 'module.exports = ' + template;
};