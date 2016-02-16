/* This module returns a function constructor. It is necessary to maintain
   backward compatibility with Webpack 1 while supporting Webpack 2.
   Webpack 2 does not allow with() statements, which lodash templates use to unwrap
   the parameters passed to the compiled template inside the scope. We therefore
   need to unwrap them ourselves here. This is essentially what lodash does internally
   (see lodash/template).

   See issue#213 for more information.
*/
'use strict';

module.exports = function (template) {
  /* eslint-disable no-new-func */
  return Function('attr',
    'var webpack = attr.webpack;' +
    'var webpackConfig = attr.webpackConfig;' +
    'var htmlWebpackPlugin = attr.htmlWebpackPlugin;' +
    'return ' + template.source + '();'
  );
  /* eslint-enable no-new-func */
};
