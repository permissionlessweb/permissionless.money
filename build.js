import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const { minify } = require('html-minifier-terser');

async function build() {
  const outdir = 'dist';
  await fs.mkdirSync(outdir, { recursive: true });

  // Minify HTML
  for (const file of ['pages/index.html', 'pages/loyalty.html', 'pages/zk.html', 'pages/contact.html']) {
    const content = await fs.readFileSync(file, 'utf8');
    const minified = await minify(content, { collapseWhitespace: true });

    // Write the minified content to the output directory
    const outputPath = path.join(outdir, file);
    await fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    await fs.writeFileSync(outputPath, minified, 'utf8');
  }

  // Copy lib/ JS modules (including nested demos/).
  function copyJsTree(srcDir, destDir) {
    fs.mkdirSync(destDir, { recursive: true });
    for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
      const from = path.join(srcDir, entry.name);
      const to = path.join(destDir, entry.name);
      if (entry.isDirectory()) {
        copyJsTree(from, to);
      } else if (entry.name.endsWith('.js')) {
        fs.copyFileSync(from, to);
      }
    }
  }
  copyJsTree('lib', path.join(outdir, 'lib'));

  // // Copy pkg/ WASM (if built).
  // if (fs.existsSync('pkg') && (fs.existsSync('pkg/passkey_wasm.js') || fs.existsSync('pkg/oline_wasm.js'))) {
  //   const pkgOut = path.join(outdir, 'pkg');
  //   fs.mkdirSync(pkgOut, { recursive: true });
  //   for (const file of fs.readdirSync('pkg')) {
  //     if (file.endsWith('.js') || file.endsWith('.wasm') || file.endsWith('.d.ts')) {
  //       fs.copyFileSync(path.join('pkg', file), path.join(pkgOut, file));
  //     }
  //   }
  //   console.log('Copied WASM pkg/ to dist/pkg/');
  // } else {
  //   console.warn('No pkg/ — run: npm run wasm-build');
  // }

  // Copy public/.
  fs.cpSync('public', path.join(outdir, 'public'), { recursive: true, force: true });

  // Locale catalogs for client i18n (see docs/i18n.md).
  if (fs.existsSync('locales')) {
    fs.cpSync('locales', path.join(outdir, 'locales'), { recursive: true, force: true });
  }

  console.log('Build complete');
}

build();
