'use strict';

const THROW_ERR = Symbol('throw error');
const CALLBACK_ERR = Symbol('pass error in callback');

class AddOnPlugin {

  constructor (behaviour) {
    this.behaviour = behaviour;
  }
  apply (compiler) {
    compiler.plugin('compilation', (compilation) => {
      compilation.plugin('html-webpack-plugin-alter-asset-tags', (pluginArgs, callback) => {
        const err = new Error('TEST ERROR');
        switch (this.behaviour) {
          case THROW_ERR:
            throw err;
          default:
            callback(err);
        }
      });
    });
  }
}

AddOnPlugin.THROW_ERR = THROW_ERR;
AddOnPlugin.CALLBACK_ERR = CALLBACK_ERR;

module.exports = AddOnPlugin;
