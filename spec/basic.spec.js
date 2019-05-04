/*
 * Integration and unit tests for all features but caching
 */

/* eslint-env jest */
'use strict';

const path = require('path');
const fs = require('fs');
const webpack = require('webpack');
const rimraf = require('rimraf');
const _ = require('lodash');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const webpackMajorVersion = Number(require('webpack/package.json').version.split('.')[0]);
if (isNaN(webpackMajorVersion)) {
  throw new Error('Cannot parse webpack major version');
}

const HtmlWebpackPlugin = require('../index.js');

const OUTPUT_DIR = path.resolve(__dirname, '../dist/basic-spec');

jest.setTimeout(30000);
process.on('unhandledRejection', r => console.log(r));
process.traceDeprecation = true;

function testHtmlPlugin (webpackConfig, expectedResults, outputFile, done, expectErrors, expectWarnings) {
  outputFile = outputFile || 'index.html';
  webpack(webpackConfig, (err, stats) => {
    expect(err).toBeFalsy();
    const compilationErrors = (stats.compilation.errors || []).join('\n');
    if (expectErrors) {
      expect(compilationErrors).not.toBe('');
    } else {
      expect(compilationErrors).toBe('');
    }
    const compilationWarnings = (stats.compilation.warnings || []).join('\n');
    if (expectWarnings) {
      expect(compilationWarnings).not.toBe('');
    } else {
      expect(compilationWarnings).toBe('');
    }
    if (outputFile instanceof RegExp) {
      const fileNames = Object.keys(stats.compilation.assets);
      const matches = Object.keys(stats.compilation.assets).filter(item => outputFile.test(item));
      expect(matches[0] || fileNames).not.toEqual(fileNames);
      outputFile = matches[0];
    }
    expect(outputFile.indexOf('[hash]') === -1).toBe(true);
    const outputFileExists = fs.existsSync(path.join(OUTPUT_DIR, outputFile));
    expect(outputFileExists).toBe(true);
    if (!outputFileExists) {
      return done();
    }
    const htmlContent = fs.readFileSync(path.join(OUTPUT_DIR, outputFile)).toString();
    let chunksInfo;
    for (let i = 0; i < expectedResults.length; i++) {
      const expectedResult = expectedResults[i];
      if (expectedResult instanceof RegExp) {
        expect(htmlContent).toMatch(expectedResult);
      } else if (typeof expectedResult === 'object') {
        if (expectedResult.type === 'chunkhash') {
          if (!chunksInfo) {
            chunksInfo = getChunksInfoFromStats(stats);
          }
          const chunkhash = chunksInfo[expectedResult.chunkName].hash;
          expect(htmlContent).toContain(expectedResult.containStr.replace('%chunkhash%', chunkhash));
        }
      } else {
        expect(htmlContent).toContain(expectedResult.replace('%hash%', stats.hash));
      }
    }
    done();
  });
}

function getChunksInfoFromStats (stats) {
  const chunks = stats.compilation.getStats().toJson().chunks;
  const chunksInfo = {};
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkName = chunk.names[0];
    if (chunkName) {
      chunksInfo[chunkName] = chunk;
    }
  }
  return chunksInfo;
}

describe('HtmlWebpackPlugin', () => {
  beforeEach(done => {
    rimraf(OUTPUT_DIR, done);
  });

  it('generates a default index.html file for a single entry point', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin()]
    }, [/<body>[\s]*<script src="index_bundle.js"><\/script>[\s]*<\/body>/], null, done);
  });

  it('generates a default index.html file with multiple entry points', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: {
        util: path.join(__dirname, 'fixtures/util.js'),
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin()]
    }, ['<script src="util_bundle.js"', '<script src="app_bundle.js"'], null, done);
  });

  it('allows you to specify a custom loader without injection', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: {
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({
        inject: false,
        template: 'pug-loader!' + path.join(__dirname, 'fixtures/template.pug')
      })]
    },
    ['<script src="app_bundle.js', 'Some unique text'], null, done);
  });

  it('should pass through loader errors', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: {
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({
        inject: false,
        template: path.join(__dirname, 'fixtures/invalid.html')
      })]
    },
    ['ReferenceError: foo is not defined'], null, done, true);
  });

  it('uses a custom loader from webpacks config', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: {
        app: path.join(__dirname, 'fixtures/index.js')
      },
      module: {
        rules: [
          { test: /\.pug$/, loader: 'pug-loader' }
        ]
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({
        inject: false,
        template: path.join(__dirname, 'fixtures/template.pug')
      })]
    },
    ['<script src="app_bundle.js', 'Some unique text'], null, done);
  });

  it('works when using html-loader', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: {
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({
        inject: true,
        template: 'html-loader!' + path.join(__dirname, 'fixtures/plain.html')
      })]
    },
    ['<script src="app_bundle.js"'], null, done);
  });

  it('allows you to specify your own HTML template file', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: {
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({
        template: path.join(__dirname, 'fixtures/test.html'),
        inject: false
      })]
    },
    ['<script src="app_bundle.js', 'Some unique text'], null, done);
  });

  it('picks up src/index.ejs by default', done => {
    testHtmlPlugin({
      mode: 'production',
      context: path.join(__dirname, 'fixtures'),
      entry: {
        app: './index.js'
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin()]
    },
    ['<script src="app_bundle.js', 'src/index.ejs'], null, done);
  });

  it('allows you to inject the assets into a given html file', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: {
        util: path.join(__dirname, 'fixtures/util.js'),
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({
        inject: true,
        template: path.join(__dirname, 'fixtures/plain.html')
      })]
    }, ['<script src="util_bundle.js"', '<script src="app_bundle.js"'], null, done);
  });

  it('allows you to inject the assets into the body of the given template', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: {
        util: path.join(__dirname, 'fixtures/util.js'),
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({
        inject: 'body',
        template: path.join(__dirname, 'fixtures/plain.html')
      })]
    }, ['<script src="util_bundle.js"', '<script src="app_bundle.js"'], null, done);
  });

  it('allows you to inject the assets into the head of the given template', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: {
        util: path.join(__dirname, 'fixtures/util.js'),
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({
        inject: 'head',
        template: path.join(__dirname, 'fixtures/plain.html')
      })]
    }, ['<script src="util_bundle.js"', '<script src="app_bundle.js"'], null, done);
  });

  it('allows you to inject a specified asset into a given html file', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: {
        util: path.join(__dirname, 'fixtures/util.js'),
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({
        inject: true,
        chunks: ['app'],
        template: path.join(__dirname, 'fixtures/plain.html')
      })]
    }, ['<script src="app_bundle.js"'], null, done);
  });

  it('allows you to inject a specified asset into a given html file', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: {
        util: path.join(__dirname, 'fixtures/util.js'),
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({
        inject: true,
        excludeChunks: ['util'],
        template: path.join(__dirname, 'fixtures/plain.html')
      })]
    }, ['<script src="app_bundle.js"'], null, done);
  });

  it('allows you to use chunkhash with asset into a given html file', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: {
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({
        inject: false,
        template: path.join(__dirname, 'fixtures/webpackconfig.html')
      })]
    }, [{
      type: 'chunkhash',
      chunkName: 'app',
      containStr: '<script src="app_bundle.js"'
    }], null, done);
  });

  it('allows you to disable injection', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: {
        util: path.join(__dirname, 'fixtures/util.js'),
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({
        inject: false,
        template: path.join(__dirname, 'fixtures/plain.html')
      })]
    }, ['<body></body>'], null, done);
  });

  it('allows you to specify your own HTML template function', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: { app: path.join(__dirname, 'fixtures/index.js') },
      output: {
        path: OUTPUT_DIR,
        filename: 'app_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({
        templateContent: function () {
          return fs.readFileSync(path.join(__dirname, 'fixtures/plain.html'), 'utf8');
        }
      })]
    },
    ['<script src="app_bundle.js"'], null, done);
  });

  it('works with source maps', done => {
    testHtmlPlugin({
      mode: 'development',
      devtool: 'sourcemap',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin()]
    }, ['<script src="index_bundle.js"'], null, done);
  });

  it('handles hashes in bundle filenames', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle_[hash].js'
      },
      plugins: [new HtmlWebpackPlugin()]
    }, [/<script src="index_bundle_[0-9a-f]+\.js"*/], null, done);
  });

  it('handles hashes in the directory which has the bundle file', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        publicPath: '/dist/[hash]/',
        filename: 'index_bundle_[hash].js'
      },
      plugins: [new HtmlWebpackPlugin()]
    }, [/<script src="\/dist\/[0-9a-f]+\/index_bundle_[0-9a-f]+\.js"*/], null, done);
  });

  it('allows to append hashes to the assets', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({ hash: true })]
    }, ['<script src="index_bundle.js?%hash%"'], null, done);
  });

  it('allows to append hashes to the assets', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({ hash: true, inject: true })]
    }, ['<script src="index_bundle.js?%hash%"'], null, done);
  });

  it('should work with the css extract plugin', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/theme.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      module: {
        rules: [
          { test: /\.css$/, use: [MiniCssExtractPlugin.loader, 'css-loader'] }
        ]
      },
      plugins: [
        new HtmlWebpackPlugin(),
        new MiniCssExtractPlugin({ filename: 'styles.css' })
      ]
    }, ['<link href="styles.css" rel="stylesheet">'], null, done);
  });

  it('should work with the css extract plugin on windows and protocol relative urls support (#205)', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/theme.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js',
        publicPath: '//localhost:8080/'
      },
      module: {
        rules: [
          { test: /\.css$/, use: [MiniCssExtractPlugin.loader, 'css-loader'] }
        ]
      },
      plugins: [
        new HtmlWebpackPlugin(),
        new MiniCssExtractPlugin({ filename: 'styles.css' })
      ]
    }, ['<link href="//localhost:8080/styles.css"'], null, done);
  });

  it('should allow to add cache hashes to with the css assets', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/theme.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js',
        publicPath: '/some/'
      },
      module: {
        rules: [
          { test: /\.css$/, use: [MiniCssExtractPlugin.loader, 'css-loader'] }
        ]
      },
      plugins: [
        new HtmlWebpackPlugin({
          hash: true,
          filename: path.resolve(OUTPUT_DIR, 'subfolder', 'test.html')
        }),
        new MiniCssExtractPlugin({ filename: 'styles.css' })
      ]
    }, ['<link href="/some/styles.css?%hash%"'], path.join('subfolder', 'test.html'), done);
  });

  it('should allow to add cache hashes to with the css assets', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/theme.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js',
        publicPath: '/some'
      },
      module: {
        rules: [
          { test: /\.css$/, use: [MiniCssExtractPlugin.loader, 'css-loader'] }
        ]
      },
      plugins: [
        new HtmlWebpackPlugin({ hash: true }),
        new MiniCssExtractPlugin({ filename: 'styles.css' })
      ]
    }, ['<link href="/some/styles.css?%hash%"'], null, done);
  });

  it('should allow to add cache hashes to with the css assets', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/theme.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js',
        publicPath: 'some/'
      },
      module: {
        rules: [
          { test: /\.css$/, use: [MiniCssExtractPlugin.loader, 'css-loader'] }
        ]
      },
      plugins: [
        new HtmlWebpackPlugin({ hash: true }),
        new MiniCssExtractPlugin({ filename: 'styles.css' })
      ]
    }, ['<link href="some/styles.css?%hash%"'], null, done);
  });

  it('should allow to add cache hashes to with the css assets', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/theme.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      module: {
        rules: [
          { test: /\.css$/, use: [MiniCssExtractPlugin.loader, 'css-loader'] }
        ]
      },
      plugins: [
        new HtmlWebpackPlugin({ hash: true }),
        new MiniCssExtractPlugin({ filename: 'styles.css' })
      ]
    }, ['<link href="styles.css?%hash%"'], null, done);
  });

  it('should allow to add cache hashes to with the css assets', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/theme.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      module: {
        rules: [
          { test: /\.css$/, use: [MiniCssExtractPlugin.loader, 'css-loader'] }
        ]
      },
      plugins: [
        new HtmlWebpackPlugin({
          hash: true,
          filename: path.resolve(OUTPUT_DIR, 'subfolder', 'test.html')
        }),
        new MiniCssExtractPlugin({ filename: 'styles.css' })
      ]
    }, ['<link href="../styles.css?%hash%"'], path.join('subfolder', 'test.html'), done);
  });

  it('should inject css files when using the extract text plugin', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/theme.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      module: {
        rules: [
          { test: /\.css$/, use: [MiniCssExtractPlugin.loader, 'css-loader'] }
        ]
      },
      plugins: [
        new HtmlWebpackPlugin({ inject: true }),
        new MiniCssExtractPlugin({ filename: 'styles.css' })
      ]
    }, ['<link href="styles.css"'], null, done);
  });

  it('should allow to add cache hashes to with injected css assets', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/theme.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      module: {
        rules: [
          { test: /\.css$/, use: [MiniCssExtractPlugin.loader, 'css-loader'] }
        ]
      },
      plugins: [
        new HtmlWebpackPlugin({ hash: true, inject: true }),
        new MiniCssExtractPlugin({ filename: 'styles.css' })
      ]
    }, ['<link href="styles.css?%hash%"'], null, done);
  });

  it('should output xhtml link stylesheet tag', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/theme.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      module: {
        rules: [
          { test: /\.css$/, use: [MiniCssExtractPlugin.loader, 'css-loader'] }
        ]
      },
      plugins: [
        new HtmlWebpackPlugin({
          xhtml: true,
          minify: {
            keepClosingSlash: true
          }
        }),
        new MiniCssExtractPlugin({ filename: 'styles.css' })
      ]
    }, ['<link href="styles.css" rel="stylesheet"/>'], null, done);
  });

  it('prepends the publicPath to function', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js',
        publicPath () {
          return '/';
        }
      },
      plugins: [new HtmlWebpackPlugin()]
    }, ['<script src="/index_bundle.js"'], null, done);
  });

  it('prepends the publicPath to /some/', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js',
        publicPath: '/some/'
      },
      plugins: [new HtmlWebpackPlugin()]
    }, ['<script src="/some/index_bundle.js"'], null, done);
  });

  it('prepends the publicPath to /some', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js',
        publicPath: '/some'
      },
      plugins: [new HtmlWebpackPlugin()]
    }, ['<script src="/some/index_bundle.js"'], null, done);
  });

  it('prepends the publicPath to /some', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js',
        publicPath: 'some/'
      },
      plugins: [new HtmlWebpackPlugin()]
    }, ['<script src="some/index_bundle.js"'], null, done);
  });

  it('prepends the publicPath to undefined', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin()]
    }, ['<script src="index_bundle.js"'], null, done);
  });

  it('prepends the publicPath to undefined', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({
        filename: path.resolve(OUTPUT_DIR, 'subfolder', 'test.html')
      })]
    }, ['<script src="../index_bundle.js"'], path.join('subfolder', 'test.html'), done);
  });

  it('prepends the publicPath to script src', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js',
        publicPath: 'http://cdn.example.com/assets/'
      },
      plugins: [new HtmlWebpackPlugin()]
    }, ['<script src="http://cdn.example.com/assets/index_bundle.js"'], null, done);
  });

  it('handles subdirectories in the webpack output bundles', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'assets/index_bundle.js',
        publicPath: '/'
      },
      plugins: [new HtmlWebpackPlugin()]
    }, ['<script src="/assets/index_bundle.js"'], null, done);
  });

  it('handles subdirectories in the webpack output bundles along with a relative path', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'assets/index_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin()]
    }, ['<script src="assets/index_bundle.js"'], null, done);
  });

  it('handles subdirectories in the webpack output bundles along with a relative path', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'assets/index_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({
        filename: path.resolve(OUTPUT_DIR, 'subfolder', 'test.html')
      })]
    }, ['<script src="../assets/index_bundle.js"'], path.join('subfolder', 'test.html'), done);
  });

  it('handles subdirectories in the webpack output bundles along with a absolute path', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'assets/index_bundle.js',
        publicPath: 'http://cdn.example.com/'
      },
      plugins: [new HtmlWebpackPlugin()]
    }, ['<script src="http://cdn.example.com/assets/index_bundle.js"'], null, done);
  });

  it('allows you to configure the title of the generated HTML page', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({ title: 'My Cool App' })]
    }, ['<title>My Cool App</title>'], null, done);
  });

  it('allows you to configure the output filename', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({ filename: 'test.html' })]
    }, ['<script src="index_bundle.js"'], 'test.html', done);
  });

  it('will replace [hash] in the filename with the child compilation hash', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({
        filename: 'test-[hash].html'
      })]
    }, ['<script src="index_bundle.js"'], /test-\S+\.html$/, done);
  });

  it('should allow filename in the format of [<hashType>:contenthash:<digestType>:<length>]', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: {
        index: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin({ filename: 'index.[sha256:contenthash:base32:32].html' })
      ]
    }, [], /index\.[a-z0-9]{32}\.html/, done);
  });

  it('will replace [contenthash] in the filename with a content hash of 32 hex characters', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: {
        index: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin({ filename: 'index.[contenthash].html' })
      ]
    }, [], /index\.[a-f0-9]{32}\.html/, done);
  });

  it('will replace [templatehash] in the filename with a content hash of 32 hex characters', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: {
        index: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin({ filename: 'index.[templatehash].html' })
      ]
    }, [], /index\.[a-f0-9]{32}\.html/, done);
  });

  it('allows you to use an absolute output filename', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({
        filename: path.resolve(OUTPUT_DIR, 'subfolder', 'test.html')
      })]
    }, ['<script src="../index_bundle.js"'], path.join('subfolder', 'test.html'), done);
  });

  it('allows you to use an absolute output filename outside the output path', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: path.join(OUTPUT_DIR, 'app'),
        filename: 'index_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({
        filename: path.resolve(OUTPUT_DIR, 'test.html')
      })]
    }, ['<script src="app/index_bundle.js"'], 'test.html', done);
  });

  it('allows you to use an relative output filename outside the output path', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: path.join(OUTPUT_DIR, 'app'),
        filename: 'index_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({
        filename: '../test.html'
      })]
    }, ['<script src="app/index_bundle.js"'], 'test.html', done);
  });

  it('will try to use a relative name if the filename is in a subdirectory', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({ filename: 'assets/test.html' })]
    }, ['<script src="../index_bundle.js"'], 'assets/test.html', done);
  });

  it('will try to use a relative name if the filename and the script are in a subdirectory', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'assets/index_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({ filename: 'assets/demo/test.html' })]
    }, ['<script src="../../assets/index_bundle.js"'], 'assets/demo/test.html', done);
  });

  it('allows you write multiple HTML files', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: {
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin(),
        new HtmlWebpackPlugin({
          filename: 'second-file.html',
          template: path.join(__dirname, 'fixtures/test.html')
        }),
        new HtmlWebpackPlugin({
          filename: 'third-file.html',
          template: path.join(__dirname, 'fixtures/test.html')
        })
      ]
    }, ['<script src="index_bundle.js"'], null, () => {
      expect(fs.existsSync(path.join(OUTPUT_DIR, 'second-file.html'))).toBe(true);
      expect(fs.existsSync(path.join(OUTPUT_DIR, 'third-file.html'))).toBe(true);
      done();
    });
  });

  it('should inject js css files even if the html file is incomplete', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/theme.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      module: {
        rules: [
          { test: /\.css$/, use: [MiniCssExtractPlugin.loader, 'css-loader'] }
        ]
      },
      plugins: [
        new HtmlWebpackPlugin({ template: path.join(__dirname, 'fixtures/empty_html.html') }),
        new MiniCssExtractPlugin({ filename: 'styles.css' })
      ]
    }, ['<link href="styles.css"', '<script src="index_bundle.js"'], null, done);
  });

  it('exposes the webpack configuration to templates', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: {
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        publicPath: 'https://cdn.com',
        filename: '[name]_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({ template: path.join(__dirname, 'fixtures/webpackconfig.html') })]
    },
    ['Public path is https://cdn.com'], null, done);
  });

  it('fires the html-webpack-plugin-alter-asset-tags event', done => {
    let eventFired = false;
    const examplePlugin = {
      apply: function (compiler) {
        compiler.plugin('compilation', compilation => {
          HtmlWebpackPlugin.getHooks(compilation).alterAssetTags.tapAsync('HtmlWebpackPluginTest', (object, callback) => {
            expect(Object.keys(object.assetTags)).toEqual(['scripts', 'styles', 'meta']);
            eventFired = true;
            callback();
          });
        });
      }
    };

    const shouldExpectWarnings = webpackMajorVersion < 4;
    testHtmlPlugin({
      mode: 'production',
      entry: {
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin(),
        examplePlugin
      ]
    }, [], null, () => {
      expect(eventFired).toBe(true);
      done();
    }, false,
    shouldExpectWarnings);
  });

  it('allows events to add a no-value attribute', done => {
    const examplePlugin = {
      apply: function (compiler) {
        compiler.plugin('compilation', compilation => {
          HtmlWebpackPlugin.getHooks(compilation).alterAssetTags.tapAsync('HtmlWebpackPluginTest', (pluginArgs, callback) => {
            pluginArgs.assetTags.scripts = pluginArgs.assetTags.scripts.map(tag => {
              if (tag.tagName === 'script') {
                tag.attributes.specialAttribute = true;
              }
              return tag;
            });
            callback(null, pluginArgs);
          });
        });
      }
    };
    testHtmlPlugin({
      mode: 'production',
      entry: {
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin(),
        examplePlugin
      ]
    },
    [/<body>[\s]*<script src="app_bundle.js" specialattribute><\/script>[\s]*<\/body>/],
    null, done, false, false);
  });

  it('allows events to remove an attribute by setting it to false', done => {
    const examplePlugin = {
      apply: function (compiler) {
        compiler.plugin('compilation', compilation => {
          HtmlWebpackPlugin.getHooks(compilation).alterAssetTags.tapAsync('HtmlWebpackPluginTest', (pluginArgs, callback) => {
            pluginArgs.assetTags.scripts = pluginArgs.assetTags.scripts.map(tag => {
              if (tag.tagName === 'script') {
                tag.attributes.async = false;
              }
              return tag;
            });
            callback(null, pluginArgs);
          });
        });
      }
    };
    testHtmlPlugin({
      mode: 'production',
      entry: {
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin(),
        examplePlugin
      ]
    },
    [/<body>[\s]*<script src="app_bundle.js"><\/script>[\s]*<\/body>/],
    null, done, false, false);
  });

  it('fires the html-webpack-plugin-after-template-execution event', done => {
    let eventFired = false;
    const examplePlugin = {
      apply: function (compiler) {
        compiler.plugin('compilation', compilation => {
          HtmlWebpackPlugin.getHooks(compilation).afterTemplateExecution.tapAsync('HtmlWebpackPluginTest', (object, callback) => {
            eventFired = true;
            callback();
          });
        });
      }
    };

    const shouldExpectWarnings = webpackMajorVersion < 4;
    testHtmlPlugin({
      mode: 'production',
      entry: {
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin(),
        examplePlugin
      ]
    }, [], null, () => {
      expect(eventFired).toBe(true);
      done();
    }, false,
    shouldExpectWarnings);
  });

  it('fires the html-webpack-plugin-before-emit event', done => {
    let eventFired = false;
    const examplePlugin = {
      apply: function (compiler) {
        compiler.plugin('compilation', compilation => {
          HtmlWebpackPlugin.getHooks(compilation).beforeEmit.tapAsync('HtmlWebpackPluginTest', (object, callback) => {
            eventFired = true;
            callback();
          });
        });
      }
    };
    const shouldExpectWarnings = webpackMajorVersion < 4;
    testHtmlPlugin({
      mode: 'production',
      entry: {
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin(),
        examplePlugin
      ]
    }, [], null, () => {
      expect(eventFired).toBe(true);
      done();
    }, false,
    shouldExpectWarnings);
  });

  it('fires the html-webpack-plugin-after-emit event', done => {
    let eventFired = false;
    const examplePlugin = {
      apply: function (compiler) {
        compiler.plugin('compilation', compilation => {
          HtmlWebpackPlugin.getHooks(compilation).afterEmit.tapAsync('HtmlWebpackPluginTest', (object, callback) => {
            eventFired = true;
            callback();
          });
        });
      }
    };
    testHtmlPlugin({
      mode: 'production',
      entry: {
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin(),
        examplePlugin
      ]
    }, [], null, () => {
      expect(eventFired).toBe(true);
      done();
    });
  });

  it('allows to modify the html during html-webpack-plugin-before-emit event', done => {
    let eventFired = false;
    const examplePlugin = {
      apply: function (compiler) {
        compiler.plugin('compilation', compilation => {
          HtmlWebpackPlugin.getHooks(compilation).beforeEmit.tapAsync('HtmlWebpackPluginTest', (object, callback) => {
            eventFired = true;
            object.html += 'Injected by plugin';
            callback();
          });
        });
      }
    };

    const shouldExpectWarnings = webpackMajorVersion < 4;
    testHtmlPlugin({
      mode: 'production',
      entry: {
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin(),
        examplePlugin
      ]
    }, ['Injected by plugin'], null, () => {
      expect(eventFired).toBe(true);
      done();
    }, false,
    shouldExpectWarnings);
  });

  it('allows to access all hooks from within a plugin', done => {
    let hookNames;
    const examplePlugin = {
      apply: function (compiler) {
        compiler.plugin('compilation', compilation => {
          hookNames = Object.keys(HtmlWebpackPlugin.getHooks(compilation)).sort();
        });
      }
    };

    const shouldExpectWarnings = webpackMajorVersion < 4;
    testHtmlPlugin({
      mode: 'production',
      entry: {
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin(),
        examplePlugin
      ]
    }, [], null, () => {
      expect(hookNames).toEqual([
        'afterEmit',
        'afterTemplateExecution',
        'alterAssetTagGroups',
        'alterAssetTags',
        'beforeAssetTagGeneration',
        'beforeEmit']);
      done();
    }, false,
    shouldExpectWarnings);
  });

  it('allows to modify sequentially the html during html-webpack-plugin-before-emit event by edit the given arguments object', done => {
    let eventFiredForFirstPlugin = false;
    let eventFiredForSecondPlugin = false;
    const examplePlugin = {
      apply: function (compiler) {
        compiler.plugin('compilation', compilation => {
          HtmlWebpackPlugin.getHooks(compilation).beforeEmit.tapAsync('HtmlWebpackPluginTest', (object, callback) => {
            eventFiredForFirstPlugin = true;
            object.html += 'Injected by first plugin';
            callback(null, object);
          });
        });
      }
    };
    const secondExamplePlugin = {
      apply: function (compiler) {
        compiler.plugin('compilation', compilation => {
          HtmlWebpackPlugin.getHooks(compilation).beforeEmit.tapAsync('HtmlWebpackPluginTest', (object, callback) => {
            eventFiredForSecondPlugin = true;
            object.html += ' Injected by second plugin';
            callback(null);
          });
        });
      }
    };

    const shouldExpectWarnings = webpackMajorVersion < 4;
    testHtmlPlugin({
      mode: 'production',
      entry: {
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin(),
        examplePlugin,
        secondExamplePlugin
      ]
    }, ['Injected by first plugin Injected by second plugin'], null, () => {
      expect(eventFiredForFirstPlugin).toBe(true);
      expect(eventFiredForSecondPlugin).toBe(true);
      done();
    }, false,
    shouldExpectWarnings);
  });

  it('allows to modify sequentially the html during html-webpack-plugin-before-emit event either by edit the given arguments object or by return a new object in the callback', done => {
    let eventFiredForFirstPlugin = false;
    let eventFiredForSecondPlugin = false;
    const examplePlugin = {
      apply: function (compiler) {
        compiler.plugin('compilation', compilation => {
          HtmlWebpackPlugin.getHooks(compilation).beforeEmit.tapAsync('HtmlWebpackPluginTest', (object, callback) => {
            eventFiredForFirstPlugin = true;
            const result = _.extend(object, {
              html: object.html + 'Injected by first plugin'
            });
            callback(null, result);
          });
        });
      }
    };
    const secondExamplePlugin = {
      apply: function (compiler) {
        compiler.plugin('compilation', compilation => {
          HtmlWebpackPlugin.getHooks(compilation).beforeEmit.tapAsync('HtmlWebpackPluginTest', (object, callback) => {
            eventFiredForSecondPlugin = true;
            object.html += ' Injected by second plugin';
            callback(null);
          });
        });
      }
    };

    const shouldExpectWarnings = webpackMajorVersion < 4;
    testHtmlPlugin({
      mode: 'production',
      entry: {
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin(),
        examplePlugin,
        secondExamplePlugin
      ]
    }, ['Injected by first plugin Injected by second plugin'], null, () => {
      expect(eventFiredForFirstPlugin).toBe(true);
      expect(eventFiredForSecondPlugin).toBe(true);
      done();
    }, false,
    shouldExpectWarnings);
  });

  it('allows to modify sequentially the html during html-webpack-plugin-before-emit event by return a new object in the callback', done => {
    let eventFiredForFirstPlugin = false;
    let eventFiredForSecondPlugin = false;
    const examplePlugin = {
      apply: function (compiler) {
        compiler.plugin('compilation', compilation => {
          HtmlWebpackPlugin.getHooks(compilation).beforeEmit.tapAsync('HtmlWebpackPluginTest', (object, callback) => {
            eventFiredForFirstPlugin = true;
            const result = _.extend(object, {
              html: object.html + 'Injected by first plugin'
            });
            callback(null, result);
          });
        });
      }
    };
    const secondExamplePlugin = {
      apply: function (compiler) {
        compiler.plugin('compilation', compilation => {
          HtmlWebpackPlugin.getHooks(compilation).beforeEmit.tapAsync('HtmlWebpackPluginTest', (object, callback) => {
            eventFiredForSecondPlugin = true;
            const result = _.extend(object, {
              html: object.html + ' Injected by second plugin'
            });
            callback(null, result);
          });
        });
      }
    };

    testHtmlPlugin({
      mode: 'production',
      entry: {
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin(),
        examplePlugin,
        secondExamplePlugin
      ]
    }, ['Injected by first plugin Injected by second plugin'], null, () => {
      expect(eventFiredForFirstPlugin).toBe(true);
      expect(eventFiredForSecondPlugin).toBe(true);
      done();
    });
  });

  it('allows to modify the html during html-webpack-plugin-after-template-execution event', done => {
    let eventFired = false;
    const examplePlugin = {
      apply: function (compiler) {
        compiler.plugin('compilation', compilation => {
          HtmlWebpackPlugin.getHooks(compilation).afterTemplateExecution.tapAsync('HtmlWebpackPluginTest', (object, callback) => {
            eventFired = true;
            object.bodyTags.push(HtmlWebpackPlugin.createHtmlTagObject('script', { src: 'funky-script.js' }));
            object.html += 'Injected by plugin';
            callback();
          });
        });
      }
    };

    const shouldExpectWarnings = webpackMajorVersion < 4;
    testHtmlPlugin({
      mode: 'production',
      entry: {
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin(),
        examplePlugin
      ]
    }, ['Injected by plugin', '<script src="funky-script.js"'], null, () => {
      expect(eventFired).toBe(true);
      done();
    }, false,
    shouldExpectWarnings);
  });

  it('allows to modify the html during html-webpack-plugin-before-asset-tag-generation event', done => {
    let eventFired = false;
    const examplePlugin = {
      apply: function (compiler) {
        compiler.plugin('compilation', compilation => {
          HtmlWebpackPlugin.getHooks(compilation).beforeAssetTagGeneration.tapAsync('HtmlWebpackPluginTest', (object, callback) => {
            eventFired = true;
            object.assets.js.push('funky-script.js');
            callback();
          });
        });
      }
    };
    testHtmlPlugin({
      mode: 'production',
      entry: {
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin({
          inject: false,
          template: 'pug-loader!' + path.join(__dirname, 'fixtures/template.pug')
        }),
        examplePlugin
      ]
    }, ['<script src="funky-script.js"'], null, () => {
      expect(eventFired).toBe(true);
      done();
    });
  });

  it('fires the events in the correct order', done => {
    const hookCallOrder = [
      'beforeAssetTagGeneration',
      'alterAssetTags',
      'alterAssetTagGroups',
      'afterTemplateExecution',
      'beforeEmit',
      'afterEmit'
    ];
    let eventsFired = [];
    let hookLength = 0;
    const examplePlugin = {
      apply: function (compiler) {
        compiler.plugin('compilation', compilation => {
          const hooks = HtmlWebpackPlugin.getHooks(compilation);
          hookLength = hooks.length;
          // Hook into all hooks
          Object.keys(hooks).forEach((hookName) => {
            hooks[hookName].tapAsync('HtmlWebpackPluginTest', (object, callback) => {
              eventsFired.push(hookName);
              callback();
            });
          });
        });
      }
    };
    const shouldExpectWarnings = webpackMajorVersion < 4;
    testHtmlPlugin({
      mode: 'production',
      entry: {
        app: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin(),
        examplePlugin
      ]
    }, [], null, () => {
      expect(hookLength).not.toBe(0);
      expect(eventsFired).toEqual(hookCallOrder);
      done();
    }, false,
    shouldExpectWarnings);
  });
  it('works with commons chunk plugin', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: {
        util: path.join(__dirname, 'fixtures/util.js'),
        index: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      optimization: {
        splitChunks: {
          cacheGroups: {
            commons: {
              chunks: 'initial',
              name: 'common',
              enforce: true
            }
          }
        }
      },
      plugins: [
        new HtmlWebpackPlugin()
      ]
    }, [
      /<script src="common_bundle.js">[\s\S]*<script src="util_bundle.js">/,
      /<script src="common_bundle.js"[\s\S]*<script src="index_bundle.js">/], null, done);
  });

  it('adds a favicon', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin({
          favicon: path.join(__dirname, 'fixtures/favicon.ico')
        })
      ]
    }, [/<link rel="shortcut icon" href="[^"]+\.ico">/], null, done);
  });

  it('adds a base tag with attributes', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin({
          base: {
            href: 'http://example.com/page.html',
            target: '_blank'
          }
        })
      ]
    }, [/<base href="http:\/\/example\.com\/page\.html" target="_blank">/], null, done);
  });

  it('adds a base tag short syntax', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin({
          base: 'http://example.com/page.html'
        })
      ]
    }, [/<base href="http:\/\/example\.com\/page\.html">/], null, done);
  });

  it('adds a meta tag', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin({
          meta: {
            'viewport': {
              'name': 'viewport',
              'content': 'width=device-width, initial-scale=1, shrink-to-fit=no'
            }
          }
        })
      ]
    }, [/<meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">/], null, done);
  });

  it('adds a meta tag with short notation', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin({
          meta: {
            'viewport': 'width=device-width, initial-scale=1, shrink-to-fit=no'
          }
        })
      ]
    }, [/<meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">/], null, done);
  });

  it('adds a favicon with publicPath set to /some/', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        publicPath: '/some/',
        filename: 'index_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin({
          favicon: path.join(__dirname, 'fixtures/favicon.ico')
        })
      ]
    }, [/<link rel="shortcut icon" href="\/some\/+[^"]+\.ico">/], null, done);
  });

  it('adds a favicon with publicPath set to /some', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        publicPath: '/some',
        filename: 'index_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin({
          favicon: path.join(__dirname, 'fixtures/favicon.ico')
        })
      ]
    }, [/<link rel="shortcut icon" href="\/some\/+[^"]+\.ico">/], null, done);
  });

  it('adds a favicon with publicPath set to some/', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        publicPath: 'some/',
        filename: 'index_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin({
          favicon: path.join(__dirname, 'fixtures/favicon.ico')
        })
      ]
    }, [/<link rel="shortcut icon" href="some\/+[^"]+\.ico">/], null, done);
  });

  it('adds a favicon with publicPath undefined', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin({
          favicon: path.join(__dirname, 'fixtures/favicon.ico')
        })
      ]
    }, [/<link rel="shortcut icon" href="[^"]+\.ico">/], null, done);
  });

  it('adds a favicon with publicPath undefined', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin({
          favicon: path.join(__dirname, 'fixtures/favicon.ico'),
          filename: path.resolve(OUTPUT_DIR, 'subfolder', 'test.html')
        })
      ]
    }, [/<link rel="shortcut icon" href="\.\.\/[^"]+\.ico">/], path.join('subfolder', 'test.html'), done);
  });

  it('adds a favicon with a publichPath set to /[hash]/ and replaces the hash', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        publicPath: '/[hash]/',
        filename: 'index_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin({
          favicon: path.join(__dirname, 'fixtures/favicon.ico')
        })
      ]
    }, [/<link rel="shortcut icon" href="\/[a-z0-9]{20}\/favicon\.ico">/], null, done);
  });

  it('adds a favicon with a publichPath set to [hash]/ and replaces the hash', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        publicPath: '[hash]/',
        filename: 'index_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin({
          favicon: path.join(__dirname, 'fixtures/favicon.ico')
        })
      ]
    }, [/<link rel="shortcut icon" href="[a-z0-9]{20}\/favicon\.ico">/], null, done);
  });

  it('adds a favicon with inject enabled', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin({
          inject: true,
          favicon: path.join(__dirname, 'fixtures/favicon.ico')
        })
      ]
    }, [/<link rel="shortcut icon" href="[^"]+\.ico">/], null, done);
  });

  it('adds a favicon with xhtml enabled', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin({
          inject: true,
          xhtml: true,
          minify: {
            keepClosingSlash: true
          },
          favicon: path.join(__dirname, 'fixtures/favicon.ico')
        })
      ]
    }, [/<link rel="shortcut icon" href="[^"]+\.ico"\/>/], null, done);
  });

  it('shows an error if the favicon could not be load', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin({
          inject: true,
          favicon: path.join(__dirname, 'fixtures/does_not_exist.ico')
        })
      ]
    }, ['Error: HtmlWebpackPlugin: could not load file'], null, done, true);
  });

  it('adds a manifest', done => {
    const AppCachePlugin = require('appcache-webpack-plugin');
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [
        new AppCachePlugin({ settings: ['prefer-online'] }),
        new HtmlWebpackPlugin()
      ]
    }, ['<html manifest="manifest.appcache">'], null, done);
  });

  it('does not add a manifest if already present', done => {
    const AppCachePlugin = require('appcache-webpack-plugin');
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [
        new AppCachePlugin({ settings: ['prefer-online'] }),
        new HtmlWebpackPlugin({
          template: path.join(__dirname, 'fixtures/plain.html')
        })
      ]
    }, ['<html lang="en" manifest="foo.appcache">'], null, done);
  });

  it('works with webpack bannerplugin', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [
        new webpack.BannerPlugin('Copyright and such.'),
        new HtmlWebpackPlugin()
      ]
    }, ['<html'], null, done);
  });

  it('shows an error when a template fails to load', done => {
    testHtmlPlugin({
      mode: 'development',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin({
          template: path.join(__dirname, 'fixtures/non-existing-template.html')
        })
      ]
    }, ['Child compilation failed:\n  Entry module not found:'], null, done, true);
  });

  it('should sort the chunks in auto mode', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: {
        util: path.join(__dirname, 'fixtures/util.js'),
        index: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      optimization: {
        splitChunks: {
          cacheGroups: {
            commons: {
              chunks: 'initial',
              name: 'common',
              enforce: true
            }
          }
        }
      },
      plugins: [
        new HtmlWebpackPlugin({
          chunksSortMode: 'auto'
        })
      ]
    }, [
      /(<script src="common_bundle.js">.+<script src="util_bundle.js">.+<script src="index_bundle.js">)|(<script src="common_bundle.js">.+<script src="index_bundle.js">.+<script src="util_bundle.js">)/
    ], null, done);
  });

  it('should sort the chunks in custom (reverse alphabetical) order', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: {
        b: path.join(__dirname, 'fixtures/index.js'),
        c: path.join(__dirname, 'fixtures/util.js'),
        a: path.join(__dirname, 'fixtures/index.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin({
          chunksSortMode: function (a, b) {
            if (a < b) {
              return 1;
            }
            if (a > b) {
              return -1;
            }
            return 0;
          }
        })
      ]
    }, [/<script src="c_bundle.js">.+<script src="b_bundle.js">.+<script src="a_bundle.js">/], null, done);
  });

  it('should sort manually by the chunks', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: {
        b: path.join(__dirname, 'fixtures/util.js'),
        a: path.join(__dirname, 'fixtures/theme.js'),
        d: path.join(__dirname, 'fixtures/util.js'),
        c: path.join(__dirname, 'fixtures/theme.js')
      },
      output: {
        path: OUTPUT_DIR,
        filename: '[name]_bundle.js'
      },
      module: {
        rules: [
          { test: /\.css$/, loader: 'css-loader' }
        ]
      },
      optimization: {
        splitChunks: {
          cacheGroups: {
            commons: {
              chunks: 'initial',
              name: 'common',
              enforce: true
            }
          }
        }
      },
      plugins: [
        new HtmlWebpackPlugin({
          chunksSortMode: 'manual',
          chunks: ['common', 'a', 'b', 'c']
        })
      ]
    }, [
      /<script src="common_bundle.js">.+<script src="a_bundle.js">.+<script src="b_bundle.js">.+<script src="c_bundle.js">/], null, done);
  });

  it('should add the webpack compilation object as a property of the templateParam object', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin({
          template: path.join(__dirname, 'fixtures/templateParam.js'),
          inject: false
        })
      ]
    }, ['templateParams keys: "compilation,webpackConfig,htmlWebpackPlugin"'], null, done);
  });

  it('should allow to disable template parameters', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin({
          template: path.join(__dirname, 'fixtures/templateParam.js'),
          inject: false,
          templateParameters: false
        })
      ]
    }, ['templateParams keys: ""'], null, done);
  });

  it('should allow to set specific template parameters', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin({
          template: path.join(__dirname, 'fixtures/templateParam.js'),
          inject: false,
          templateParameters: { foo: 'bar' }
        })
      ]
    }, ['templateParams keys: "foo"'], null, done);
  });

  it('should allow to set specific template parameters using a function', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin({
          template: path.join(__dirname, 'fixtures/templateParam.js'),
          inject: false,
          templateParameters: function () {
            return { 'foo': 'bar' };
          }
        })
      ]
    }, ['templateParams keys: "foo"'], null, done);
  });

  it('should allow to set specific template parameters using a async function', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin({
          template: path.join(__dirname, 'fixtures/templateParam.js'),
          inject: false,
          templateParameters: function () {
            return Promise.resolve({ 'foo': 'bar' });
          }
        })
      ]
    }, ['templateParams keys: "foo"'], null, done);
  });

  it('should not treat templateContent set to an empty string as missing', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: { app: path.join(__dirname, 'fixtures/index.js') },
      output: {
        path: OUTPUT_DIR,
        filename: 'app_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({
        templateContent: ''
      })]
    },
    [/^<script src="app_bundle\.js"><\/script>$/], null, done);
  });

  it('allows you to inject the assets into the body of the given spaced closing tag template', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({
        inject: 'body',
        template: path.join(__dirname, 'fixtures/spaced_plain.html')
      })]
    }, [/<body>[\s]*<script src="index_bundle.js"><\/script>[\s]*<\/body>/], null, done);
  });

  it('allows you to inject the assets into the head of the given spaced closing tag template', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({
        inject: 'head',
        template: path.join(__dirname, 'fixtures/spaced_plain.html')
      })]
    }, [/<head>[\s]*<script src="index_bundle.js"><\/script>[\s]*<\/head>/], null, done);
  });

  it('should minify by default when mode is production', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin()]
    }, [/<!doctype html><html><head><meta charset="utf-8">/], null, done);
  });

  it('should not minify by default when mode is development', done => {
    testHtmlPlugin({
      mode: 'development',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin()]
    }, [/<!DOCTYPE html>\s+<html>\s+<head>\s+<meta charset="utf-8">/], null, done);
  });

  it('should minify in production if options.minify is true', done => {
    testHtmlPlugin({
      mode: 'development',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({ minify: true })]
    }, [/<!doctype html><html><head><meta charset="utf-8">/], null, done);
  });

  it('should minify in development if options.minify is true', done => {
    testHtmlPlugin({
      mode: 'development',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({ minify: true })]
    }, [/<!doctype html><html><head><meta charset="utf-8">/], null, done);
  });

  it('should not minify in production if options.minify is false', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({ minify: false })]
    }, [/<!DOCTYPE html>\s+<html>\s+<head>\s+<meta charset="utf-8">/], null, done);
  });

  it('should not minify in development if options.minify is false', done => {
    testHtmlPlugin({
      mode: 'development',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({ minify: false })]
    }, [/<!DOCTYPE html>\s+<html>\s+<head>\s+<meta charset="utf-8">/], null, done);
  });

  it('should allow custom minify options and not merge them with the defaults', done => {
    testHtmlPlugin({
      mode: 'production',
      entry: path.join(__dirname, 'fixtures/index.js'),
      output: {
        path: OUTPUT_DIR,
        filename: 'index_bundle.js'
      },
      plugins: [new HtmlWebpackPlugin({
        minify: {
          useShortDoctype: true
        }
      })]
    }, [/<!doctype html>\s+<html>\s+<head>\s+<meta charset="utf-8">/], null, done);
  });
});
