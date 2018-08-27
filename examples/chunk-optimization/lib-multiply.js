var sum = require('./lib-sum.js');
module.exports = function multiply (a, b) {
  var m = 0;
  for (var i = 0; i < a; i = sum(i, 1)) {
    m = sum(m, b);
  }
  return m;
};
