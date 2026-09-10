/**
 * Validates that all expected chunks are part of the compilation result
 *
 * @param {(string | null | undefined)[]} allChunkNames - all compilation chunk names
 * @param {string[]} expectedChunkNames - expected chunk names
 * @param {string} label
 * @returns {Error[]} validation errors
 */
module.exports = function (allChunkNames, expectedChunkNames, label) {
  if (!Array.isArray(expectedChunkNames)) {
    return [];
  }

  const missingChunks = expectedChunkNames.filter(
    (chunkName) => !allChunkNames.includes(chunkName),
  );

  return missingChunks.map((chunk) => {
    return new Error(
      `HtmlWebpackPlugin: The chunk '${chunk}' provided in the 'options.${label}' option was not found in the compilation results`,
    );
  });
};
