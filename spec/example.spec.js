/*
 * These integration tests compile all cases from the example folder
 * and matches them against their dist folder
 */

/* eslint-env jest */
'use strict';

const path = require('path');
const webpack = require('webpack');
const rimraf = require('rimraf');
const fs = require('fs');
const webpackMajorVersion = require('webpack/package.json').version.split('.')[0];

const OUTPUT_DIR = path.resolve(__dirname, '../dist');

jest.setTimeout(30000);
process.traceDeprecation = true;

function runExample (exampleName, done) {
  const examplePath = path.resolve(__dirname, '..', 'examples', exampleName);
  const exampleOutput = path.join(OUTPUT_DIR, exampleName);
  const fixturePath = path.resolve(examplePath, 'dist', 'webpack-' + webpackMajorVersion);
  // Clear old results
  rimraf(exampleOutput, () => {
    const options = require(path.join(examplePath, 'webpack.config.js'));
    options.context = examplePath;
    options.output.path = exampleOutput + path.sep;
    if (Number(webpackMajorVersion) >= 4) {
      options.plugins.unshift(new webpack.LoaderOptionsPlugin({
        options: {
          context: process.cwd() // or the same value as `context`
        }
      }));
      if (options.module && options.module.loaders) {
        options.module.rules = options.module.loaders;
        delete options.module.loaders;
      }
      options.mode = 'production';
      options.optimization = { minimizer: [] };
    }

    webpack(options, (err, stats) => {
      expect(err).toBeFalsy();
      expect(stats.compilation.errors).toEqual([]);

      const dircompare = require('dir-compare');
      const res = dircompare.compareSync(fixturePath, exampleOutput, { compareSize: true });

      res.diffSet.filter(diff => diff.state === 'distinct').forEach(diff => {
        const file1Contents = fs.readFileSync(path.join(diff.path1, diff.name1)).toString();
        const file2Contents = fs.readFileSync(path.join(diff.path2, diff.name2)).toString();
        expect(file1Contents).toEqual(file2Contents);
      });

      expect(res.same).toBe(true);
      rimraf(exampleOutput, done);
    });
  });
}

describe('HtmlWebpackPlugin Examples', () => {
  it('appcache example', done => {
    runExample('appcache', done);
  });

  it('custom-template example', done => {
    runExample('custom-template', done);
  });

  it('default example', done => {
    runExample('default', done);
  });

  it('favicon example', done => {
    runExample('favicon', done);
  });

  it('html-loader example', done => {
    runExample('html-loader', done);
  });

  it('inline example', done => {
    runExample('inline', done);
  });

  it('pug-loader example', done => {
    runExample('pug-loader', done);
  });

  it('javascript example', done => {
    runExample('javascript', done);
  });

  it('javascript-advanced example', done => {
    runExample('javascript-advanced', done);
  });

  it('sort manually example', done => {
    runExample('sort-manually', done);
  });

  it('template-parameters example', done => {
    runExample('template-parameters', done);
  });
});
