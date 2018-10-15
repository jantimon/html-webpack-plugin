require('./main.css');
var multiply = require('./lib-multiply.js');
var concat = require('./lib-concat.js');
var h1 = document.createElement('h1');
h1.innerHTML = concat('Hello world from Entry ', multiply(1, 1));
document.body.appendChild(h1);
