'use strict';

module.exports = function() {
  if (this.cacheable) {
    this.cacheable();
  }
  var template = JSON.parse(decodeURIComponent(this.query.substr(1)));
	return "module.exports = require('" + template + "');";
};

