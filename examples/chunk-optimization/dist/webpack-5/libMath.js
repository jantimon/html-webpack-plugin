(self["webpackChunk"] = self["webpackChunk"] || []).push([[288],{

/***/ 540:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var sum = __webpack_require__(636);
module.exports = function multiply(a, b) {
  var m = 0;
  for (var i = 0; i < a; i = sum(i, 1)) {
    m = sum(m, b);
  }
  return m;
};


/***/ }),

/***/ 636:
/***/ ((module) => {

module.exports = function sum(a, b) {
  return a + b;
};


/***/ })

}]);