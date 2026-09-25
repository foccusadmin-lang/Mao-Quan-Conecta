// Carteirinha oficial "Identidade do Praticante" (frente + verso), baseada no modelo da Associação.
import { useRef, useState } from 'react';
import { toPng, toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { faixaNome, faixaNivel, filialNome } from '../lib/db';
import { fmtDate, b64e, APP_URL, maskRG, maskCPF } from '../lib/utils';
import { toast } from './ui';
export { CAMPOS_PADRAO, MODELOS_PADRAO } from '../lib/seed';
import { useQR } from './shared';

export const CARD_W = 1000;
export const CARD_H = 652;
const PDF_MM = [86, 56]; // mesma proporção do modelo

/** Graduação impressa: faixa (ex.: Amarela Ponta Verde), nível (ex.: Intermediária) ou ambos */
function graduacaoTexto(db, pessoa, tipo) {
  const fmt = db.modelos[tipo]?.graduacao || (tipo === 'professor' ? 'nivel' : 'faixa');
  if (fmt === 'nivel') return tipo === 'professor' ? 'Professor' : faixaNivel(db, pessoa.faixaIdx);
  if (fmt === 'ambos') return ` · `;
  return faixaNome(db, pessoa.faixaIdx);
}

// Reduz a fonte de textos longos para caberem na coluna do cartão
const ajuste = (key, texto = '') => {
  const max = key === 'nome' ? 34 : 17;
  return Math.min(1, max / Math.max(1, String(texto).length));
};

export function dadosCarteirinha(db, pessoa, tipo) {
  const validade = tipo === 'professor' ? pessoa.filiacaoValidaAte : pessoa.carteirinhaValidade || `${new Date().getFullYear()}-12-31`;
  const payload = b64e({ id: pessoa.id, n: pessoa.nome, t: tipo, f: faixaNome(db, pessoa.faixaIdx), fl: filialNome(db, pessoa.filialId), m: pessoa.matricula || pessoa.id.slice(-6).toUpperCase(), v: validade, k: pessoa.qrToken });
  return {
    nome: pessoa.nome,
    rg: pessoa.rg ? maskRG(pessoa.rg) : '—',
    cpf: pessoa.cpf ? maskCPF(pessoa.cpf) : '—',
    nascimento: pessoa.nascimento ? fmtDate(pessoa.nascimento) : '—',
    graduacao: graduacaoTexto(db, pessoa, tipo),
    escola: filialNome(db, pessoa.filialId),
    validade: validade ? fmtDate(validade) : '—',
    foto: pessoa.foto,
    qrText: `${APP_URL}#/validar/${payload}`,
  };
}

/** Frente da carteirinha. Em modo edição os campos podem ser arrastados. */
export function CardFrente({ modelo, dados, editing, sel, onSel, onMove, cardRef }) {
  const qr = useQR(dados.qrText);
  const box = useRef(null);
  const drag = useRef(null);

  const down = (e, f) => {
    if (!editing) return;
    e.preventDefault();
    onSel?.(f.key);
    const r = box.current.getBoundingClientRect();
    drag.current = { key: f.key, sx: e.clientX, sy: e.clientY, ox: f.x, oy: f.y, w: r.width, h: r.height };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    const x = Math.max(0, Math.min(98, d.ox + ((e.clientX - d.sx) / d.w) * 100));
    const y = Math.max(0, Math.min(98, d.oy + ((e.clientY - d.sy) / d.h) * 100));
    onMove?.(d.key, Math.round(x * 10) / 10, Math.round(y * 10) / 10);
  };
  const up = () => (drag.current = null);
  const setRefs = (el) => {
    box.current = el;
    if (cardRef) cardRef.current = el;
  };

  return (
    <div className={`idc ${editing ? 'editing' : ''}`} ref={setRefs}>
      {modelo.frente ? (
        <img className="idc-bg" src={modelo.frente} alt="" />
      ) : (
        <>
          <div className="idc-faixa" style={{ background: modelo.cor }} />
          <div className="idc-mao">貓</div>
          <img className="idc-logo" src="carteirinha/logo.png" alt="" />
          <div className="idc-titulo">IDENTIDADE DO PRATICANTE</div>
          <div className="idc-sub">MAO QUAN KUNG FU WUSHU</div>
          <div className="idc-han">貓拳功夫武術</div>
          <div className="idc-rotulo" style={{ color: modelo.corRotulo }}>{modelo.rotulo}</div>
          <div className="idc-hanzi" style={{ color: modelo.corRotulo }}>
            <span>{modelo.hanzi}</span>
            <small>{modelo.pinyin}</small>
          </div>
          {modelo.mostrarPunho && <img className="idc-punho" src="carteirinha/punho.png" alt="" />}
        </>
      )}

      {modelo.fields.filter((f) => f.visible).map((f) => {
        const pos = { left: f.x + '%', top: f.y + '%' };
        const handlers = { onPointerDown: (e) => down(e, f), onPointerMove: move, onPointerUp: up };
        const cls = sel === f.key ? ' sel' : '';
        if (f.key === 'foto')
          return (
            <div key={f.key} {...handlers} className={'f idc-foto' + cls} style={{ ...pos, width: f.size + '%' }}>
              {dados.foto ? <img src={dados.foto} alt="" draggable={false} crossOrigin="anonymous" /> : <span>FOTO</span>}
            </div>
          );
        if (f.key === 'qr')
          return (
            <div key={f.key} {...handlers} className={'f idc-qr' + cls} style={{ ...pos, width: f.size + '%' }}>
              {qr && <img src={qr} alt="QR" draggable={false} />}
            </div>
          );
        return (
          <div key={f.key} {...handlers} className={'f idc-campo' + cls} style={pos}>
            <div className="l" style={{ fontSize: f.size * 1.15 + 'cqw' }}>{f.label}</div>
            <div className="v" style={{ fontSize: f.size * ajuste(f.key, dados[f.key]) + 'cqw' }}>{dados[f.key]}</div>
          </div>
        );
      })}
    </div>
  );
}

export function CardVerso({ modelo, cardRef }) {
  return (
    <div className="idc" ref={cardRef}>
      <img className="idc-bg" src={modelo.verso} alt="Verso da carteirinha" />
    </div>
  );
}

/** Frente e verso lado a lado (ou empilhados em telas pequenas) com refs para exportação */
export function Carteirinha({ modelo, dados, frenteRef, versoRef }) {
  const [lado, setLado] = useState('frente');
  return (
    <div className="col" style={{ alignItems: 'center' }}>
      <div className="idc-flip">
        <div style={{ display: lado === 'frente' ? 'block' : 'none' }}><CardFrente modelo={modelo} dados={dados} cardRef={frenteRef} /></div>
        <div style={{ display: lado === 'verso' ? 'block' : 'none' }}><CardVerso modelo={modelo} cardRef={versoRef} /></div>
      </div>
      <div className="tabs" style={{ margin: 0 }}>
        <button className={lado === 'frente' ? 'on' : ''} onClick={() => setLado('frente')}>Frente</button>
        <button className={lado === 'verso' ? 'on' : ''} onClick={() => setLado('verso')}>Verso</button>
      </div>
    </div>
  );
}

// ---------- Exportação ----------
async function renderizar(node, jpg) {
  // Garante que o nó esteja visível durante a captura
  const wrap = node.parentElement;
  const prev = wrap?.style.display;
  if (wrap && prev === 'none') wrap.style.display = 'block';
  try {
    const opts = { pixelRatio: 3, cacheBust: true, backgroundColor: '#ffffff' };
    return jpg ? await toJpeg(node, { ...opts, quality: 0.95 }) : await toPng(node, opts);
  } finally {
    if (wrap && prev === 'none') wrap.style.display = prev;
  }
}

function baixar(url, nome) {
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
}

export async function exportarCarteirinha(nodes, formato, nome = 'carteirinha') {
  const [frente, verso] = nodes;
  const safe = nome.replace(/[^\w-]+/g, '_');
  if (formato === 'png' || formato === 'jpg') {
    const jpg = formato === 'jpg';
    baixar(await renderizar(frente, jpg), `${safe}-frente.${formato}`);
    if (verso) baixar(await renderizar(verso, jpg), `${safe}-verso.${formato}`);
  } else if (formato === 'pdf') {
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: PDF_MM });
    pdf.addImage(await renderizar(frente), 'PNG', 0, 0, ...PDF_MM);
    if (verso) {
      pdf.addPage(PDF_MM, 'landscape');
      pdf.addImage(await renderizar(verso), 'PNG', 0, 0, ...PDF_MM);
    }
    pdf.save(`${safe}.pdf`);
  } else if (formato === 'print') {
    const w = window.open('', '_blank');
    if (!w) return toast('Permita pop-ups para imprimir.');
    const imgs = [await renderizar(frente), verso && (await renderizar(verso))].filter(Boolean);
    w.document.write(
      `<html><head><title>${nome}</title><style>@page{size:A4;margin:12mm}body{margin:0;font-family:sans-serif}img{width:${PDF_MM[0]}mm;height:${PDF_MM[1]}mm;margin:0 6mm 6mm 0;border:0.2mm dashed #bbb}</style></head><body>` +
        imgs.map((u) => `<img src="${u}"/>`).join('') +
        `<script>window.onload=()=>setTimeout(()=>window.print(),250)</script></body></html>`
    );
    w.document.close();
  }
}

export function ExportButtons({ getNodes, nome, liberado = true, motivo }) {
  const [busy, setBusy] = useState(false);
  const run = async (f) => {
    if (!liberado) return toast(motivo || 'Download bloqueado.');
    setBusy(true);
    try {
      await exportarCarteirinha(getNodes(), f, nome);
    } catch (e) {
      toast('Falha ao exportar: ' + e.message);
    }
    setBusy(false);
  };
  return (
    <div className="row" style={{ justifyContent: 'center' }}>
      {['pdf', 'jpg', 'png'].map((f) => (
        <button key={f} className="btn sm dark" disabled={busy} onClick={() => run(f)}>⬇ {f.toUpperCase()}</button>
      ))}
      <button className="btn sm ghost" disabled={busy} onClick={() => run('print')}>🖨 Imprimir</button>
    </div>
  );
}
