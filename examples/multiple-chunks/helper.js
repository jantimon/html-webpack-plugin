module.exports = {
  appendHeading: function (html) {
    var h1 = document.createElement('h1');
    h1.innerHTML = html;
    document.body.appendChild(h1);
  }
};
