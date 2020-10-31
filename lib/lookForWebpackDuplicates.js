// @ts-check
const webpack = require('webpack');
const path = require('path');

module.exports = {
  /**
   * The new Webpack 5 hook system is using a Singletons
   * technique which relies on node require
   *
   * This technique breaks if multiple packages of the same name
   * are installed as `require('packageX').hooks` would return different
   * results
   *
   * This health check tries to identify this breaking change and to explain
   * the problem to the user
   *
   * @param {webpack.Compiler} compiler
   * @returns {boolean}
   */
  lookForWebpackDuplicates: (compiler) => {
    // Check if compilation is using the constructor from the same package
    // as the current compilation instance
    if (webpack.Compiler && compiler instanceof webpack.Compiler) {
      return false;
    }
    // Gather information about the relative webpack environment
    const relativeWebpackLocation = path.dirname(
      require.resolve('webpack/package.json')
    );
    const relativeWebpackVersion = require('webpack/package.json').version;

    throw new Error(
      `\nMultiple webpack versions detected!\n\nThe new Webpack 5 hook system does NOT support multiple webpack installations` +
        `\nHtmlWebpackPlugin detected duplicated Webpack ${relativeWebpackVersion} in '${relativeWebpackLocation}'` +
        `\nPlease check your node_modules directory for duplicatates`
    );
  }
};
