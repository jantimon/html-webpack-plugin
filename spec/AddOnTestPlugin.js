/* eslint-env jasmine */
/* global since:false */
'use strict';

require('jasmine2-custom-message');

const THROW_ERR = Symbol('throw error');
const CALLBACK_ERR = Symbol('pass error in callback');
const CHECK_ARGS = Symbol('check passed arguments');

const EVENTS = {};
EVENTS['html-webpack-plugin-before-html-generation'] = ['assets', 'plugin', 'outputName'];
EVENTS['html-webpack-plugin-before-html-processing'] = ['html', 'assets', 'plugin', 'outputName'];
EVENTS['html-webpack-plugin-alter-asset-tags'] = ['head', 'body', 'plugin', 'chunks', 'outputName'];
EVENTS['html-webpack-plugin-after-html-processing'] = ['html', 'assets', 'plugin', 'outputName'];
EVENTS['html-webpack-plugin-after-emit'] = ['html', 'plugin', 'outputName'];

const checkArgs = (event, pluginArgs) => {
  EVENTS[event].forEach(key => {
    since(`Event ${event} should have argument ${key}`).expect(pluginArgs[key]).toBeTruthy();
  });
};

class AddOnTestPlugin {

  constructor (behaviour) {
    this.behaviour = behaviour;
  }

  apply (compiler) {
    compiler.plugin('compilation', (compilation) => {
      switch (this.behaviour) {
        case THROW_ERR:
          compilation.plugin('html-webpack-plugin-alter-asset-tags', (pluginArgs, callback) => {
            throw new Error('Addon Test Error');
          });
          break;
        case CALLBACK_ERR:
          compilation.plugin('html-webpack-plugin-alter-asset-tags', (pluginArgs, callback) => {
            callback(new Error('Addon Test Error'));
          });
          break;
        case CHECK_ARGS:
          Object.keys(EVENTS).forEach(event => {
            compilation.plugin(event, (pluginArgs, callback) => {
              checkArgs(event, pluginArgs);
              callback(null, pluginArgs);
            });
          });
          break;
        default:
          throw new Error(`Unknown addon test behaviour ${this.behaviour}`);
      }
    });
  }
}

AddOnTestPlugin.THROW_ERR = THROW_ERR;
AddOnTestPlugin.CALLBACK_ERR = CALLBACK_ERR;
AddOnTestPlugin.CHECK_ARGS = CHECK_ARGS;

module.exports = AddOnTestPlugin;
