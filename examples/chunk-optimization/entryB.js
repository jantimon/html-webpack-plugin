require('./main.css');
var multiply = require('./lib-multiply.js');
var h1 = document.createElement('h1');
h1.innerHTML = 'Hello world from Entry ' + multiply(1, 2);
document.body.appendChild(h1);
