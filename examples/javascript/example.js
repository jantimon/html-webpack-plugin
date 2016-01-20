require('./main.css');

var universal = require('./universial.js');
var h1 = document.createElement('h1');
h1.innerHTML = universal();

document.body.appendChild(h1);
