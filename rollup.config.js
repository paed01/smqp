import commonjs from '@rollup/plugin-commonjs';

import pkg from './package.json' with { type: 'json' };

export default {
  input: pkg.exports.import,
  plugins: [
    commonjs({
      sourceMap: false,
    }),
  ],
  output: [
    {
      file: pkg.exports.require,
      format: 'cjs',
      exports: 'named',
      footer: 'module.exports = Object.assign(exports.default, exports);',
    },
  ],
};
