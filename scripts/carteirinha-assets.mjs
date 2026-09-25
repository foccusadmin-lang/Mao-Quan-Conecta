// Gera os elementos da carteirinha oficial a partir dos modelos (frente+verso lado a lado, 2000x652)
import sharp from 'sharp';
const [aluno, professor] = process.argv.slice(2);
const out = 'public/carteirinha/';

const circulo = (size) => Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`);
async function recorteCircular(src, cx, cy, r, file, size) {
  await sharp(src)
    .extract({ left: cx - r, top: cy - r, width: r * 2, height: r * 2 })
    .resize(size, size)
    .composite([{ input: circulo(size), blend: 'dest-in' }])
    .png()
    .toFile(out + file);
}

await sharp(aluno).extract({ left: 1000, top: 0, width: 1000, height: 652 }).jpeg({ quality: 92 }).toFile(out + 'verso-aluno.jpg');
await sharp(professor).extract({ left: 1000, top: 0, width: 1000, height: 652 }).jpeg({ quality: 92 }).toFile(out + 'verso-professor.jpg');
await recorteCircular(aluno, 162, 162, 91, 'logo.png', 384);
await recorteCircular(aluno, 828, 527, 45, 'punho.png', 180);

// Máscara da faixa pincelada (alfa = intensidade da cor), recolorível via CSS
const { data, info } = await sharp(aluno).extract({ left: 20, top: 262, width: 160, height: 146 }).raw().toBuffer({ resolveWithObject: true });
const rgba = Buffer.alloc(info.width * info.height * 4);
for (let i = 0, j = 0; i < data.length; i += info.channels, j += 4) {
  const a = 255 - Math.min(data[i], data[i + 1], data[i + 2]);
  rgba[j] = rgba[j + 1] = rgba[j + 2] = 0;
  rgba[j + 3] = a < 40 ? 0 : Math.min(255, a * 1.15);
}
await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).resize(160, 652, { fit: 'fill' }).png().toFile(out + 'faixa-mascara.png');
console.log('ok');
