'use strict';
require('./main.css');
// Use the same template for the frontend code
var template = require('./time.pug');

setInterval(function () {
  var div = document.getElementById('main');
  div.innerHTML = template({ time: new Date() });
  div.style.color = 'navy';
}, 1000);
