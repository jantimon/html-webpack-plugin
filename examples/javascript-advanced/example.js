require("./main.css");

var universal = require("./universal.js");
var h1 = document.createElement("h1");
h1.innerHTML = universal();

document.body.appendChild(h1);
