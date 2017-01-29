/**
 * This file helps to work with html tags as objects which are easy to modify
 * and turn into a string
 */

/**
 * Turn a tag definition into a html string
 */
function htmlTagObjectToString (tagDefinition, xhtml) {
  var attributes = Object.keys(tagDefinition.attributes || {})
    .filter(function (attributeName) {
      return tagDefinition.attributes[attributeName] !== false;
    })
    .map(function (attributeName) {
      if (tagDefinition.attributes[attributeName] === true) {
        return xhtml ? attributeName + '="' + attributeName + '"' : attributeName;
      }
      return attributeName + '="' + tagDefinition.attributes[attributeName] + '"';
    });
  return '<' + [tagDefinition.tagName].concat(attributes).join(' ') + (tagDefinition.voidTag && xhtml ? '/' : '') + '>' +
    (tagDefinition.innerHTML || '') +
    (tagDefinition.voidTag ? '' : '</' + tagDefinition.tagName + '>');
}

/**
 * Static helper to create a tag object to be get injected into the dom
 *
 * @param {String} tagName         - the name of the tage e.g. 'div'
 * @param {Object} attributes      - tag attributes e.g. `{ 'class': 'example', disabled: true }`
 */
function createHtmlTagObject (tagName, attributes) {
  // https://www.w3.org/TR/html5/syntax.html#void-elements
  var voidTags = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'keygen', 'link', 'meta', 'param', 'source', 'track', 'wbr'];
  return {
    tagName: tagName,
    voidTag: voidTags.indexOf(tagName) !== -1,
    attributes: attributes
  };
}

module.exports = {
  createHtmlTagObject: createHtmlTagObject,
  htmlTagObjectToString: htmlTagObjectToString
};
