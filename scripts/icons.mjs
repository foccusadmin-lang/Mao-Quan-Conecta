// Gera os ícones PWA (PNG) a partir do logo oficial.
import sharp from 'sharp';

const src = 'public/logo.webp';
const sizes = [72, 96, 128, 144, 152, 180, 192, 384, 512];

for (const s of sizes) {
  await sharp(src)
    .resize(s, s, { fit: 'contain', background: '#ffffff' })
    .flatten({ background: '#ffffff' })
    .png()
    .toFile(`public/icons/icon-${s}.png`);
}
// Ícone "maskable" com margem de segurança
await sharp(src)
  .resize(410, 410, { fit: 'contain', background: '#ffffff' })
  .extend({ top: 51, bottom: 51, left: 51, right: 51, background: '#ffffff' })
  .flatten({ background: '#ffffff' })
  .png()
  .toFile('public/icons/maskable-512.png');
console.log('Ícones gerados.');
