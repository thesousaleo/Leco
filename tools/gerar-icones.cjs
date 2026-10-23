const sharp = require('sharp');
const fs = require('fs'); const path = require('path');
const R = 'resources/android/res';
const mark = (x, y, s) => `
<g transform="translate(${x} ${y}) scale(${s})">
  <defs>
    <linearGradient id="l" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F7F5EF"/><stop offset="1" stop-color="#A9DCCB"/></linearGradient>
    <radialGradient id="c" cx=".34" cy=".3" r=".85"><stop offset="0" stop-color="#FFDB7E"/><stop offset=".55" stop-color="#E8A317"/><stop offset="1" stop-color="#B57406"/></radialGradient>
  </defs>
  <path d="M10 6h9v27h21v9H10z" fill="url(#l)" stroke="url(#l)" stroke-width="2.5" stroke-linejoin="round"/>
  <circle cx="31" cy="22.5" r="9.5" fill="url(#c)"/>
  <circle cx="31" cy="22.5" r="6.3" fill="none" stroke="#9A6205" stroke-opacity=".55" stroke-width="1.3"/>
  <path d="M26.6 18.6a6 6 0 0 1 4-2.3" fill="none" stroke="#FFF3CF" stroke-opacity=".85" stroke-width="1.3" stroke-linecap="round"/>
</g>`;
const bg = (w, h) => `<defs><radialGradient id="g" cx=".25" cy=".15" r="1"><stop offset="0" stop-color="#14806B"/><stop offset=".55" stop-color="#0F5C4D"/><stop offset="1" stop-color="#0B2F29"/></radialGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/>`;
// glyph occupies 48 units; centred
const glyph = (size, frac) => { const s = (size * frac) / 48; const o = (size - 48 * s) / 2; return mark(o, o, s); };
const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
(async () => {
  for (const [d, k] of Object.entries(dens)) {
    const dir = path.join(R, `mipmap-${d}`); fs.mkdirSync(dir, { recursive: true });
    const L = Math.round(48 * k), F = Math.round(108 * k);
    const sq = `<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${L}"><clipPath id="r"><rect width="${L}" height="${L}" rx="${L*0.22}"/></clipPath><g clip-path="url(#r)">${bg(L, L)}</g>${glyph(L, .62)}</svg>`;
    const rd = `<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${L}"><clipPath id="r"><circle cx="${L/2}" cy="${L/2}" r="${L/2}"/></clipPath><g clip-path="url(#r)">${bg(L, L)}</g>${glyph(L, .58)}</svg>`;
    const fg = `<svg xmlns="http://www.w3.org/2000/svg" width="${F}" height="${F}">${glyph(F, .5)}</svg>`;
    await sharp(Buffer.from(sq)).png().toFile(path.join(dir, 'ic_launcher.png'));
    await sharp(Buffer.from(rd)).png().toFile(path.join(dir, 'ic_launcher_round.png'));
    await sharp(Buffer.from(fg)).png().toFile(path.join(dir, 'ic_launcher_foreground.png'));
  }
  fs.mkdirSync(path.join(R, 'mipmap-anydpi-v26'), { recursive: true });
  const adaptive = `<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@color/ic_launcher_background"/>\n    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n</adaptive-icon>\n`;
  fs.writeFileSync(path.join(R, 'mipmap-anydpi-v26/ic_launcher.xml'), adaptive);
  fs.writeFileSync(path.join(R, 'mipmap-anydpi-v26/ic_launcher_round.xml'), adaptive);
  fs.mkdirSync(path.join(R, 'values'), { recursive: true });
  fs.writeFileSync(path.join(R, 'values/ic_launcher_background.xml'), `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#0F5C4D</color>\n</resources>\n`);
  // splash: fundo branco com o logo e o nome
  const splash = (w, h) => { const s = Math.min(w, h) * 0.22 / 48; const x = (w - 48 * s) / 2, y = h / 2 - 48 * s * 0.75;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#FFFFFF"/>
    <circle cx="${w/2}" cy="${y + 24*s}" r="${48*s*0.95}" fill="#E4EFEA"/>
    ${mark(x, y, s).replace(/#F7F5EF/,'#14806B').replace(/#A9DCCB/,'#0B2F29')}
    <text x="${w/2}" y="${y + 24*s + 48*s*0.95 + Math.min(w,h)*0.1}" text-anchor="middle" font-family="Manrope, Arial, sans-serif" font-weight="800" font-size="${Math.min(w,h)*0.085}" fill="#0B2F29" letter-spacing="-1">Lec<tspan fill="#E8A317">o</tspan></text></svg>`; };
  const sizes = { drawable: [480, 800], 'drawable-port-mdpi': [320, 480], 'drawable-port-hdpi': [480, 800], 'drawable-port-xhdpi': [720, 1280], 'drawable-port-xxhdpi': [960, 1600], 'drawable-port-xxxhdpi': [1280, 1920],
    'drawable-land-mdpi': [480, 320], 'drawable-land-hdpi': [800, 480], 'drawable-land-xhdpi': [1280, 720], 'drawable-land-xxhdpi': [1600, 960], 'drawable-land-xxxhdpi': [1920, 1280] };
  for (const [d, [w, h]] of Object.entries(sizes)) { const dir = path.join(R, d); fs.mkdirSync(dir, { recursive: true }); await sharp(Buffer.from(splash(w, h))).png().toFile(path.join(dir, 'splash.png')); }
  await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><clipPath id="r"><rect width="512" height="512" rx="112"/></clipPath><g clip-path="url(#r)">${bg(512,512)}</g>${glyph(512,.62)}</svg>`)).png().toFile('resources/icone-leco-512.png');
  console.log('ok');
})();
