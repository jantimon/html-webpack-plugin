(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[2],[
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

var sum = __webpack_require__(4);
module.exports = function multiply (a, b) {
  var m = 0;
  for (var i = 0; i < a; i = sum(i, 1)) {
    m = sum(m, b);
  }
  return m;
};


/***/ }),
/* 1 */,
/* 2 */,
/* 3 */,
/* 4 */
/***/ (function(module, exports) {

module.exports = function sum (a, b) {
  return a + b;
};


/***/ })
]]);