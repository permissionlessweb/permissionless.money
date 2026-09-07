import { createRequire } from 'module';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { minify } = require('html-minifier-terser');
const here = path.dirname(fileURLToPath(import.meta.url));

function assertMintLibs(tree) {
  const verify = path.join(here, 'scripts', 'verify-mint-libs.mjs');
  const r = spawnSync(process.execPath, [verify, tree], { stdio: 'inherit' });
  if (r.status !== 0) {
    throw new Error('mint-libs check failed — refusing to finish a mixed mint build');
  }
}

async function build() {
  const outdir = 'dist';
  await fs.mkdirSync(outdir, { recursive: true });

  // Minify HTML
  for (const file of ['pages/index.html', 'pages/mint.html']) {
    const content = await fs.readFileSync(file, 'utf8');
    const minified = await minify(content, {
      collapseWhitespace: true,
      conservativeCollapse: true,
      minifyJS: false,
      minifyCSS: false,
    });

    // Write the minified content to the output directory
    const outputPath = path.join(outdir, file);
    await fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    await fs.writeFileSync(outputPath, minified, 'utf8');
  }

  // Copy lib/ JS modules (including nested demos/). Mint must ship the
  // whole tree — never pages without onboard-client / checkout / auth.
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

  const qr = spawnSync(process.execPath, [path.join(here, 'scripts', 'write-donate-qr.mjs')], { stdio: 'inherit' });
  if (qr.status !== 0) throw new Error('donate ZIP-321 QR bake failed');

  // Copy public/ except slim state.json slices — FE fetches S3 cw-orch state.
  function copyPublic(srcDir, destDir) {
    fs.mkdirSync(destDir, { recursive: true });
    for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
      if (entry.name === 'state.json' || entry.name === 'terp-state.json') continue;
      const from = path.join(srcDir, entry.name);
      const to = path.join(destDir, entry.name);
      if (entry.isDirectory()) copyPublic(from, to);
      else fs.copyFileSync(from, to);
    }
  }
  copyPublic('public', path.join(outdir, 'public'));
  for (const slim of ['state.json', 'terp-state.json']) {
    const p = path.join(outdir, 'public', slim);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  assertMintLibs(path.join(here, outdir));

  // Locale catalogs for client i18n (see docs/i18n.md).
  if (fs.existsSync('locales')) {
    fs.cpSync('locales', path.join(outdir, 'locales'), { recursive: true, force: true });
  }

  console.log('Build complete');
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});
