/**
 * Validates that all expected chunks are part of the compilation result
 *
 * @param {(string | null | undefined)[]} allChunkNames - all compilation chunk names
 * @param {string[]} expectedChunkNames - expected chunk names
 * @param {string} label
 * @returns {Error | undefined} validation errors
 */
module.exports = function (allChunkNames, expectedChunkNames, label) {
  if (Array.isArray(expectedChunkNames)) {
    const missingChunks = expectedChunkNames.filter(
      (chunkName) => !allChunkNames.includes(chunkName),
    );

    if (missingChunks.length) {
      const chunksStr = missingChunks.join(", ");
      return new Error(
        `HtmlWebpackPlugin: The following chunks provided in the '${label}' option were not found: ${chunksStr}`,
      );
    }
  }
};
