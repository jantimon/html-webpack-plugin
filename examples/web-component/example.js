require('./main.css');

var template = (document.currentScript || document._currentScript).ownerDocument.querySelector('template');

var proto = Object.create(window.HTMLElement.prototype);

proto.createdCallback = function () {
  this.el = this.createShadowRoot();
  var clone = document.importNode(template.content, true);
  this.el.appendChild(clone);
  this.mountEl = this.el.getElementById('mountTarget');
  this.mountEl.innerHTML = 'hello';
};

document.registerElement('custom-element', {prototype: proto});
