'use strict';

var allCss = [];

exports.add = function (css) {
  allCss.push(css);
};

exports.get = function () {
  return allCss;
};
