// Monta www/index.html a partir de src/app.jsx e src/styles.css.
// Tudo fica num único ficheiro (React incluído), para o app abrir mesmo sem internet.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const tw = require('tailwindcss');
const esbuild = require('esbuild');

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const src = read('src/app.jsx');
const cssIn = read('src/styles.css');

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

// 2. React + o app num único script
const bundle = await esbuild.build({
  stdin: {
    contents: `import * as R from 'react'; import * as D from 'react-dom/client'; window.React = R; window.ReactDOM = D;`,
    resolveDir: root,
    loader: 'js',
  },
  bundle: true, write: false, format: 'iife', minify: true, target: 'es2019',
  define: { 'process.env.NODE_ENV': '"production"' },
});
const app = (await esbuild.transform(src, { loader: 'jsx', jsx: 'transform', jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment', target: 'es2019', minify: true, charset: 'utf8' })).code;

const html = `<!doctype html>
<html lang="pt-BR" data-leco="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<meta name="theme-color" content="#FFFFFF">
<title>Leco</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap">
<style>${css}
html,body{margin:0;height:100%;overscroll-behavior:none;-webkit-tap-highlight-color:transparent}</style>
</head>
<body>
<div id="root"></div>
<script>window.LECO_NATIVE = true;</script>
<script>${bundle.outputFiles[0].text}</script>
<script>${app}</script>
</body>
</html>
`;
fs.mkdirSync(path.join(root, 'www'), { recursive: true });
fs.writeFileSync(path.join(root, 'www/index.html'), html);
console.log(`www/index.html pronto (${Math.round(html.length / 1024)} KB)`);
