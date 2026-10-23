// Monta o Leco num único index.html (React, Supabase e o app incluídos).
//   node scripts/build-web.mjs native   → www/index.html  (APK Android)
//   node scripts/build-web.mjs web      → site/index.html (site no GitHub Pages)
//   node scripts/build-web.mjs test <saída.html>  → teste local com banco em memória
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const tw = require('tailwindcss');
const esbuild = require('esbuild');

const mode = process.argv[2] || 'native';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const srcDir = path.join(root, 'src');
const files = fs.readdirSync(srcDir).filter((f) => /^\d\d-.*\.jsx$/.test(f)).sort();
const src = files.map((f) => `/* ---- ${f} ---- */\n${fs.readFileSync(path.join(srcDir, f), 'utf8')}`).join('\n');
const cssIn = fs.readFileSync(path.join(srcDir, 'styles.css'), 'utf8');
const config = JSON.parse(fs.readFileSync(path.join(root, 'leco.config.json'), 'utf8'));

// 1. CSS do Tailwind (v4) só com as classes usadas
const twDir = path.dirname(require.resolve('tailwindcss/package.json'));
const compiler = await tw.compile(cssIn, {
  base: twDir,
  loadStylesheet: async (id) => {
    const p = require.resolve(id === 'tailwindcss' ? 'tailwindcss/index.css' : id);
    return { path: p, base: path.dirname(p), content: fs.readFileSync(p, 'utf8') };
  },
});
const candidates = [...new Set(src.replace(/\$\{/g, ' ').split(/[\s"'`]+/).map((s) => s.replace(/^[{(]+|[})]+$/g, '')).filter(Boolean))];
const css = (await esbuild.transform(compiler.build(candidates), { loader: 'css', minify: true })).code;

// 2. Bibliotecas
let entry = "import * as R from 'react'; import * as D from 'react-dom/client'; window.React = R; window.ReactDOM = D;\n";
if (mode !== 'test') entry += "import { createClient } from '@supabase/supabase-js'; window.LecoSupabase = { createClient };\n";
if (mode === 'native') {
  entry += `import { App } from '@capacitor/app'; import { Browser } from '@capacitor/browser';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'; import { Share } from '@capacitor/share';
window.LecoNative = { App, Browser, LocalNotifications, Filesystem, Directory, Encoding, Share };\n`;
}
const libs = await esbuild.build({
  stdin: { contents: entry, resolveDir: root, loader: 'js' },
  bundle: true, write: false, format: 'iife', minify: true, target: 'es2020', legalComments: 'none',
  define: { 'process.env.NODE_ENV': '"production"', global: 'window' },
});
const app = (await esbuild.transform(src, { loader: 'jsx', jsx: 'transform', jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment', target: 'es2020', minify: mode !== 'test', charset: 'utf8' })).code;

const flags = [
  `window.LECO_CONFIG = ${JSON.stringify(config)};`,
  mode === 'native' ? 'window.LECO_NATIVE = true;' : '',
  mode === 'test' ? 'window.LECO_TEST_BACKEND = true;' : '',
].join('\n');

const html = `<!doctype html>
<html lang="pt-BR" data-leco="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover${mode === 'native' ? ', user-scalable=no' : ''}">
<meta name="theme-color" content="#FFFFFF">
<meta name="description" content="Leco · controle financeiro pessoal: contas, cartões, faturas, recorrências, metas e relatórios.">
<title>Leco · Controle financeiro</title>
<link rel="icon" type="image/png" href="data:image/png;base64,${fs.readFileSync(path.join(root, 'resources/icone-leco-512.png')).toString('base64')}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap">
<style>${css}
html,body{margin:0;min-height:100%;overscroll-behavior-y:none;-webkit-tap-highlight-color:transparent}</style>
</head>
<body>
<div id="root"></div>
<script>${flags}</script>
<script>${libs.outputFiles[0].text}</script>
<script>${app}</script>
</body>
</html>
`;
const out = mode === 'test' ? path.resolve(process.argv[3] || '/tmp/leco-test.html') : path.join(root, mode === 'web' ? 'site/index.html' : 'www/index.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
// No site, publica também as páginas estáticas de public/ (ex.: política de privacidade)
if (mode === 'web' && fs.existsSync(path.join(root, 'public'))) {
  for (const f of fs.readdirSync(path.join(root, 'public'))) fs.copyFileSync(path.join(root, 'public', f), path.join(root, 'site', f));
}
console.log(`${path.relative(root, out) || out} pronto (${Math.round(html.length / 1024)} KB)`);
