module.exports = {
  "*": [
    "prettier --cache --write --ignore-unknown",
    "cspell --cache --no-must-find-files",
  ],
  "*.js": ["eslint --cache --fix"],
};
