var component = require('./component');

module.exports = function () {
  // this could be a React`s renderToString
  const content = component();

  return [
    '<!DOCTYPE html>',
    '<html>',
    '  <head>',
    '    <meta charset="UTF-8">',
    '  </head>',
    '  <body>',
    content,
    '  </body>',
    '</html>'
  ].join('\n');
};
