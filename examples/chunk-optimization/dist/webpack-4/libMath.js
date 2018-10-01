(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[0],{

/***/ 1:
/***/ (function(module, exports, __webpack_require__) {

var sum = __webpack_require__(6);
module.exports = function multiply (a, b) {
  var m = 0;
  for (var i = 0; i < a; i = sum(i, 1)) {
    m = sum(m, b);
  }
  return m;
};


/***/ }),

/***/ 6:
/***/ (function(module, exports) {

module.exports = function sum (a, b) {
  return a + b;
};


/***/ })

}]);