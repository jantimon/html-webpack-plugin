'use strict';

var _assign = require('lodash/assign');

(function () {

  function createLookupObjectFor(array, reducer) {
    return array.reduce(reducer, {});
  }

  function identity (value) {
    return value;
  }

  function getNameForChunk (chunk) {
    return chunk.names[0];
  }

  function toLookupObjectBy (keyPropertyExtractor, accumulator, currentValue, currentIndex) {
    var currentValueKey = keyPropertyExtractor(currentValue, currentIndex);
    var currentArrayItemObject = {};
    currentArrayItemObject[currentValueKey] = currentValue;
    return _assign(accumulator, currentArrayItemObject);
  }

  var arrayByValue = toLookupObjectBy.bind(null, identity);
  var chunkByName = toLookupObjectBy.bind(null, getNameForChunk);

  module.exports.createLookupObjectFor = createLookupObjectFor;
  module.exports.getNameForChunk = getNameForChunk;
  module.exports.identity = identity;
  module.exports.arrayByValue = arrayByValue;
  module.exports.chunkByName = chunkByName;
})();
