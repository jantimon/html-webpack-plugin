// Webpack require:
var partial = require('./partial.html');

// Export a function / promise / or a string:
module.exports = '<html><head></head><body>' + new Date() + partial + '</body></html>';
