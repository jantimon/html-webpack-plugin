/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};

/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {

/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;

/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};

/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;

/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}


/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;

/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;

/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";

/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 2);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports) {

	eval("// This file is used for frontend and backend\n'use strict';\n\n// If compiled by the html-webpack-plugin\n// HTML_WEBPACK_PLUGIN is set to true:\nvar backend = typeof HTML_WEBPACK_PLUGIN !== 'undefined';\n\nmodule.exports = function () {\n  return 'Hello World from ' + (backend ? 'backend' : 'frontend');\n};\n\n\n/*****************\n ** WEBPACK FOOTER\n ** ./universial.js\n ** module id = 0\n ** module chunks = 0\n **/\n\n//# sourceURL=webpack:///./universial.js?");

/***/ },
/* 1 */
/***/ function(module, exports) {

	eval("// removed by extract-text-webpack-plugin\n\n/*****************\n ** WEBPACK FOOTER\n ** ./main.css\n ** module id = 1\n ** module chunks = 0\n **/\n\n//# sourceURL=webpack:///./main.css?");

/***/ },
/* 2 */
/***/ function(module, exports, __webpack_require__) {

	eval("__webpack_require__(1);\n\nvar universal = __webpack_require__(0);\nvar h1 = document.createElement('h1');\nh1.innerHTML = universal();\n\ndocument.body.appendChild(h1);\n\n\n/*****************\n ** WEBPACK FOOTER\n ** ./example.js\n ** module id = 2\n ** module chunks = 0\n **/\n\n//# sourceURL=webpack:///./example.js?");

/***/ }
/******/ ]);