// Webpack require:
var partial = require("./partial.html").default;
var universal = require("./universal.js");

// Export a function / promise / or a string:
module.exports = universal() + new Date().toISOString() + partial;
