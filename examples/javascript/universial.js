// This file is used for frontend and backend
'use strict';

// If compiled by the html-webpack-plugin
// HTML_WEBPACK_PLUGIN is set to true:
var backend = typeof HTML_WEBPACK_PLUGIN !== 'undefined';

module.exports = function () {
  return 'Hello World from ' + (backend ? 'backend' : 'frontend');
};
