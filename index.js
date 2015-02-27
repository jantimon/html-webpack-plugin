
'use strict';

// Imports
var _ = require('lodash'),
	path = require('path'),
	fs = require('fs'),
	minify = require('html-minifier');

// Defaults
var def = fs.readFileSync(path.join(__dirname, 'default_index.html'));

/**
 * @constructor
 * @param {Object} options Initial configuration.
 */
function HtmlWebpackPlugin(options) {
	this.options = _.assign({
		filename: 'index.html',
		template: def,
		title: 'Webpack App'
	}, options);
	this.template = _.template(this.options.template);
}

HtmlWebpackPlugin.prototype.apply = function apply(source) {
	var self = this, options = self.options;

	source.plugin('emit', function onEmit(compiler, callback) {
		var stats = compiler.getStats().toJson();
		var html = self.process(compiler, stats);
		compiler.assets[options.filename] = {
			source: function getSource() {
				return html;
			},
			size: function getSize() {
				return html.length;
			}
		};
		callback();
	});
};

HtmlWebpackPlugin.prototype.process = function process(compiler, stats) {
	var context = _.assign({
		assets: stats.assetsByChunkName,
		paths: _.flatten([
			_.values(compiler.options.resolve.externals),
			this.paths(compiler, stats)
		])
	}, this.options);
	return minify.minify(this.template(context), {
		removeComments: true,
		collapseWhitespace: true,
		removeEmptyAttributes: true,
		minifyJS: true,
		minifyCSS: true
	});
};

HtmlWebpackPlugin.prototype.paths = function paths(compiler, stats) {
	var root = compiler.options.output.publicPath || '';
	return _.chain(stats.chunks)
		.sort(function orderEntryLast(a, b) {
			if (a.entry !== b.entry) {
				return b.entry ? 1 : -1;
			} else {
				return b.id - a.id;
			}
		})
		.pluck('files')
		.flatten()
		.map(function rebasePath(path) {
			return root + path;
		})
		.value();
};

module.exports = HtmlWebpackPlugin;
