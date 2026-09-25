export const uid = (p = '') => p + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

const pad = (n) => String(n).padStart(2, '0');
export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => toISO(new Date());
export const monthISO = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const addDays = (iso, n) => {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return toISO(d);
};
export const diffDays = (a, b) => Math.round((new Date(a + 'T12:00:00') - new Date(b + 'T12:00:00')) / 86400000);
export const fmtDate = (iso) => (iso ? new Date(iso.length <= 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('pt-BR') : '—');
export const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
export const fmtMonth = (ym) => {
  const [y, m] = ym.split('-');
  return new Date(+y, +m - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
};
export const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const initials = (name = '') =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase() || '?';

export const waLink = (phone, text = '') =>
  `https://wa.me/${String(phone).replace(/\D/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

export const readFileAsDataURL = (file, maxMB = 3) =>
  new Promise((resolve, reject) => {
    if (file.size > maxMB * 1024 * 1024) return reject(new Error(`Arquivo maior que ${maxMB} MB. Use um link externo (YouTube, Google Drive).`));
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

// Reduz imagens antes de salvar (fotos de perfil, capas de eventos)
export const readImage = (file, maxSide = 900, quality = 0.85) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = reject;
    r.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', quality));
      };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });

export const youtubeEmbed = (url = '') => {
  const m = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
};

// ---------- PIX (BR Code estático, padrão EMV do Banco Central) ----------
const tlv = (id, v) => id + String(v.length).padStart(2, '0') + v;
const norm = (s = '') => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 .@-]/g, '').toUpperCase();
function crc16(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = (crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
export function pixPayload({ chave, nome, cidade, valor, txid = '***', descricao }) {
  const gui = tlv('00', 'br.gov.bcb.pix') + tlv('01', chave.trim()) + (descricao ? tlv('02', norm(descricao).slice(0, 40)) : '');
  const tx = (txid || '***').replace(/[^A-Za-z0-9*]/g, '').slice(0, 25) || '***';
  let p =
    tlv('00', '01') +
    tlv('26', gui) +
    tlv('52', '0000') +
    tlv('53', '986') +
    (valor ? tlv('54', Number(valor).toFixed(2)) : '') +
    tlv('58', 'BR') +
    tlv('59', norm(nome).slice(0, 25)) +
    tlv('60', norm(cidade).slice(0, 15)) +
    tlv('62', tlv('05', tx)) +
    '6304';
  return p + crc16(p);
}

export const copy = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const t = document.createElement('textarea');
    t.value = text;
    document.body.appendChild(t);
    t.select();
    document.execCommand('copy');
    t.remove();
    return true;
  }
};

// Codificação simples (base64 url-safe) para links compartilháveis
export const b64e = (obj) => btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const b64d = (s) => {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/')))));
  } catch {
    return null;
  }
};

// Máscaras de documentos
export const maskCPF = (v = '') =>
  v.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
// RG no padrão 00.000.000-0 (o dígito final pode ser X)
export const maskRG = (v = '') => {
  const s = v.toUpperCase().replace(/[^0-9X]/g, '').replace(/X(?=.)/g, '').slice(0, 9);
  return s
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})([0-9X])/, '$1.$2.$3-$4');
};
// Telefone: (11) 90000-0000 (celular) ou (11) 4000-0000 (fixo)
export const maskTelefone = (v = '') => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (!d) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

export const addMonths = (iso, n) => {
  const d = new Date(iso + 'T12:00:00');
  const dia = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(dia, ultimo));
  return toISO(d);
};

// Endereço oficial do app — usado nos QR Codes das carteirinhas e nos links de patrocinador,
// para que sempre apontem para o domínio público (mesmo quando gerados em outro endereço).
export const DOMINIO = 'https://maoquanconecta.com.br';
export const APP_URL = (import.meta.env.VITE_APP_URL || (import.meta.env.PROD ? DOMINIO : location.origin + location.pathname)).replace(/\/+$/, '') + '/';

// Google Maps: abre o endereço (no celular abre o app de mapas) e a rota até o local
export const mapsBusca = (endereco) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`;
export const mapsRota = (endereco) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(endereco)}`;
