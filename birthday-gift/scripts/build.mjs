import { readFile, writeFile, mkdir, cp, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const [template, css, js, rawConfig] = await Promise.all(
  ['index.html', 'styles.css', 'app.js', 'gift.config.json'].map(name => readFile(path.join(root, name), 'utf8')),
);
const config = JSON.parse(rawConfig);
if (!Number.isInteger(config.amount) || config.amount < 1 || config.amount > 999999) throw new Error('Invalid voucher amount');
for (const field of ['recipient', 'sender', 'title', 'subtitle', 'message', 'voucherNote']) {
  if (typeof config[field] !== 'string' || !config[field].trim()) throw new Error(`Missing config: ${field}`);
}
for (const media of [...(config.photos || []).map(photo => typeof photo === 'string' ? photo : photo.src), config.music?.src].filter(Boolean)) {
  if (/^(https?:|data:)/.test(media)) continue;
  const resolved = path.resolve(root, media);
  if (!resolved.startsWith(root + path.sep)) throw new Error('Media paths must stay inside the site directory');
  await access(resolved);
}
const html = template
  .replace('<link rel="stylesheet" href="styles.css" />', () => `<style id="gift-styles">${css.replace(/<\/style/gi, '<\\/style')}</style>`)
  .replace('<script id="gift-config" type="application/json">null</script>', () => `<script id="gift-config" type="application/json">${JSON.stringify(config).replace(/</g, '\\u003c')}</script>`)
  .replace('<script src="app.js" defer></script>', () => `<script id="gift-app" type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>`);
await mkdir(path.join(root, 'dist'), { recursive: true });
await writeFile(path.join(root, 'dist/index.html'), html);
await cp(path.join(root, 'assets'), path.join(root, 'dist/assets'), { recursive: true });
console.log('Built dist/index.html — no external runtime dependencies.');
console.log(`Photos: ${config.photos.length}; background audio: ${config.music?.src ? 'configured' : 'not supplied (music-platform link available)'}.`);
