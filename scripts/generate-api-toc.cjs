/* eslint-env node */

const fs = require('fs');
const toc = require('markdown-toc');
const {version} = require('../package.json');

const filenames = getFileNames();
filenames.forEach(generate);

function getFileNames() {
  const arg = process.argv[2] || './API.md';
  return arg.split(',');
}

function generate(filename) {
  const api = fs.readFileSync(filename, 'utf8');
  const tocOptions = {
    bullets: '-',
    slugify: function (text) {

      return text.toLowerCase()
        .replace(/\s/g, '-')
        .replace(/[^\w-]/g, '');
    },
  };

  const output = toc.insert(api, tocOptions)
    .replace(/<!-- version -->(.|\n)*<!-- versionstop -->/, '<!-- version -->\n# ' + version + ' API Reference\n<!-- versionstop -->');

  fs.writeFileSync(filename, output);
}
