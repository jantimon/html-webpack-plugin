'use strict';

var cssStore = require('./inlineCssStore.js');

module.exports = function (content) {
  cssStore.add(content);
  return '/* removed by html-webpack-plugin */';
};
