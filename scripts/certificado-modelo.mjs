// Gera public/certificado/modelo.jpg a partir do certificado de exemplo:
// remove os textos variáveis (corpo, data, nome do aluno e do professor) preenchendo com o fundo ao redor.
import sharp from 'sharp';

const ORIGEM = 'scripts/certificado-original.jpg';
const DESTINO = 'public/certificado/modelo.jpg';

// Regiões com texto variável (x, y, largura, altura) no modelo 2000x1411
const REGIOES = [
  { x: 215, y: 668, w: 1590, h: 305, limiar: 105, raio: 6 }, // 4 linhas do texto principal
  { x: 1105, y: 1022, w: 615, h: 78, limiar: 110, raio: 6 }, // "Barueri, 13 de junho de 2026"
  { x: 745, y: 1264, w: 395, h: 52, limiar: 110, raio: 6 }, // nome do aluno (assinatura do meio)
  { x: 1395, y: 1196, w: 310, h: 104, limiar: 100, raio: 6 }, // professor (sobre a silhueta)
];

const img = sharp(ORIGEM);
const { width: W, height: H } = await img.metadata();
const raw = await img.removeAlpha().raw().toBuffer();
const px = (x, y) => (y * W + x) * 3;
const lum = (i) => 0.299 * raw[i] + 0.587 * raw[i + 1] + 0.114 * raw[i + 2];

for (const r of REGIOES) {
  // 1) máscara das letras (pixels escuros), engordada 3px para pegar a borda suavizada
  const mask = new Uint8Array(r.w * r.h);
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (lum(px(r.x + x, r.y + y)) < r.limiar) mask[y * r.w + x] = 1;
  const grossa = new Uint8Array(mask);
  const R = r.raio || 3;
  for (let y = 0; y < r.h; y++)
    for (let x = 0; x < r.w; x++)
      if (mask[y * r.w + x])
        for (let dy = -R; dy <= R; dy++)
          for (let dx = -R; dx <= R; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < r.w && ny < r.h) grossa[ny * r.w + nx] = 1;
          }
  // 1b) contorno branco (brilho) que o original põe atrás das letras sobre a marca d'água
  if (r.brilho) {
    const RB = r.raioBrilho;
    const perto = new Uint8Array(r.w * r.h);
    for (let y = 0; y < r.h; y++)
      for (let x = 0; x < r.w; x++)
        if (mask[y * r.w + x])
          for (let dy = -RB; dy <= RB; dy += 2)
            for (let dx = -RB; dx <= RB; dx += 2) {
              const nx = x + dx, ny = y + dy;
              if (nx >= 0 && ny >= 0 && nx < r.w && ny < r.h) perto[ny * r.w + nx] = 1;
            }
    for (let y = 0; y < r.h; y++)
      for (let x = 0; x < r.w; x++) {
        const k = y * r.w + x;
        if (!grossa[k] && (perto[k] || perto[k - 1] || perto[k - r.w]) && lum(px(r.x + x, r.y + y)) > r.brilho) grossa[k] = 1;
      }
  }
  // 2) preenche de fora para dentro com a média dos vizinhos já conhecidos (inpainting simples)
  let faltam = grossa.reduce((s, v) => s + v, 0);
  while (faltam > 0) {
    const novos = [];
    for (let y = 0; y < r.h; y++)
      for (let x = 0; x < r.w; x++) {
        if (!grossa[y * r.w + x]) continue;
        let s0 = 0, s1 = 0, s2 = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if ((dx || dy) && nx >= 0 && ny >= 0 && nx < r.w && ny < r.h && !grossa[ny * r.w + nx]) {
              const i = px(r.x + nx, r.y + ny);
              s0 += raw[i]; s1 += raw[i + 1]; s2 += raw[i + 2]; n++;
            }
          }
        if (n >= 2) novos.push([x, y, s0 / n, s1 / n, s2 / n]);
      }
    if (!novos.length) break;
    for (const [x, y, a, b, c] of novos) {
      const i = px(r.x + x, r.y + y);
      raw[i] = a; raw[i + 1] = b; raw[i + 2] = c;
      grossa[y * r.w + x] = 0;
    }
    faltam -= novos.length;
  }
}

await sharp(raw, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 86, mozjpeg: true }).toFile(DESTINO);
console.log('ok', DESTINO);
