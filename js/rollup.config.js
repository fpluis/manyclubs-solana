import { promises } from 'fs';
import builtinModules from 'builtin-modules';
import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';
// import { terser } from "rollup-plugin-terser";

const { readdir } = promises;

console.log(`Building lambdas`);

const excludedDirs = ['utils'];

export default readdir('lambdas')
  .then(dirents =>
    dirents
      .filter(dir => !excludedDirs.includes(dir))
      .map(dirent => ({
        input: `lambdas/${dirent}/index.js`,
        output: { file: `lambdas/${dirent}/dist/index.js`, format: 'cjs' },
        external: builtinModules.concat('aws'),
        plugins: [
          // auto(),
          nodeResolve(),
          commonjs({
            ignore: ['pino-pretty', 'stream/web'],
          }),
          json(),
          // terser()
        ],
      })),
  )
  .catch(error => {
    console.error(error);
  });
