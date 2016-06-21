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
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};

/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

/******/ 		// Flag the module as loaded
/******/ 		module.l = true;

/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}


/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;

/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;

/******/ 	// identity function for calling harmory imports with the correct context
/******/ 	__webpack_require__.i = function(value) { return value; };

/******/ 	// define getter function for harmory exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		Object.defineProperty(exports, name, {
/******/ 			configurable: false,
/******/ 			enumerable: true,
/******/ 			get: getter
/******/ 		});
/******/ 	};

/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };

/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";

/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 2);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports) {

	eval("// removed by extract-text-webpack-plugin\n\n//////////////////\n// WEBPACK FOOTER\n// ./main-component-one.css\n// module id = 0\n// module chunks = 0 1\n\n//# sourceURL=webpack:///./main-component-one.css?");

/***/ },
/* 1 */,
/* 2 */
/***/ function(module, exports, __webpack_require__) {

	eval("__webpack_require__(0);\r\n\r\nvar template = (document.currentScript || document._currentScript).ownerDocument.querySelector('template');\r\n\r\nvar proto = Object.create(HTMLElement.prototype);\r\n\r\nproto.createdCallback = function() {\r\n  this.el = this.createShadowRoot();\r\n  var clone = document.importNode(template.content, true);\r\n  this.el.appendChild(clone);\r\n  this.mountEl = this.el.getElementById('mountTarget');\r\n  this.mountEl.innerHTML = 'another component';\r\n};\r\n\r\ndocument.registerElement('another-example', {prototype: proto});\r\n\n\n//////////////////\n// WEBPACK FOOTER\n// ./example-component-two.js\n// module id = 2\n// module chunks = 0\n\n//# sourceURL=webpack:///./example-component-two.js?");

/***/ }
/******/ ]);