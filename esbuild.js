const fs = require('fs');
const path = require('path');
fs.rmSync(path.join(__dirname, 'out'), { recursive: true, force: true });
const esbuild = require('esbuild');
const isProduction = process.env.NODE_ENV === 'production';
esbuild
  .build({
    entryPoints: [path.join(__dirname, 'src', 'extension.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: path.join(__dirname, 'out', 'extension.js'),
    external: ['vscode'],
    minify: isProduction,
    sourcemap: !isProduction,
    logLevel: 'info',
  })
  .catch(() => process.exit(1));
