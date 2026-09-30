// Certificado de graduação — modelo oficial da Associação (public/certificado/modelo.jpg, 2000x1411),
// com nome, documento, graduação, data e assinaturas preenchidos pelo sistema.
import { useRef, useState } from 'react';
import { toPng, toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { maskCPF, maskRG } from '../lib/utils';
import { toast } from './ui';

const W = 2000;
const H = 1411;
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const dataExtenso = (iso) => {
  const d = new Date((iso || '').slice(0, 10) + 'T12:00:00');
  return isNaN(d) ? '' : `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
};
const cidadeDe = (filial) => ((filial?.cidade || '').split(/\s[-–—]\s|\s-|-\s|,/)[0] || 'Barueri').trim();

/**
 * Lista de certificados do aluno: um por graduação conquistada (histórico + faixa atual),
 * a partir da 1ª graduação (faixa Branca). Neutra e Branca Ponta Vermelha são de ingresso.
 */
export function certificadosDoAluno(db, aluno) {
  if (!aluno) return [];
  const faixas = db.config.faixas || [];
  const PRIMEIRA = 2; // índice da faixa Branca (1ª graduação)
  const filial = db.filiais.find((f) => f.id === aluno.filialId);
  const hist = (aluno.historicoGraduacao || []).filter((h) => !h.modalidade && Number.isInteger(h.faixaIdx));
  const idxs = new Set(hist.map((h) => h.faixaIdx).filter((i) => i >= PRIMEIRA && i <= aluno.faixaIdx));
  if (aluno.faixaIdx >= PRIMEIRA) idxs.add(aluno.faixaIdx);
  const profDaFilial = db.professores.find((p) => p.id === filial?.professorId);
  return [...idxs]
    .sort((a, b) => a - b)
    .map((idx) => {
      const h = [...hist].reverse().find((x) => x.faixaIdx === idx);
      const f = faixas[idx] || {};
      const aprovador = h?.por && db.professores.find((p) => p.nome?.trim().toLowerCase() === h.por.trim().toLowerCase());
      const prof = aprovador || profDaFilial;
      return {
        id: `${aluno.id}-${idx}`,
        faixaIdx: idx,
        ordem: idx - 1,
        faixa: f.nome || '—',
        fase: f.nivel || '',
        data: h?.data || aluno.aprovadoEm || aluno.criadoEm || new Date().toISOString(),
        cidade: cidadeDe(filial),
        aluno: aluno.nome,
        documento: aluno.cpf ? { tipo: 'CPF', numero: maskCPF(aluno.cpf) } : aluno.rg ? { tipo: 'RG', numero: maskRG(aluno.rg) } : null,
        professor: prof ? { nome: prof.nome?.trim(), titulo: prof.titulo || 'Laoshi' } : h?.por ? { nome: h.por, titulo: '' } : null,
        atual: idx === aluno.faixaIdx,
      };
    });
}

const P = (v) => `${(v / W) * 100}cqw`; // medida do modelo (px em 2000) → proporcional à largura
const texto = { position: 'absolute', left: 0, right: 0, textAlign: 'center', fontFamily: "'Delius', 'Comic Sans MS', cursive", color: '#1d1b1b', whiteSpace: 'nowrap' };
const brilho = { textShadow: '0 0 6px #fff, 0 0 10px #fff, 0 0 14px #fff' };

/** Certificado renderizado sobre o modelo (escala com a largura do contêiner) */
export function CertificadoVisual({ c, innerRef }) {
  return (
    <div ref={innerRef} style={{ position: 'relative', width: '100%', aspectRatio: `${W} / ${H}`, containerType: 'inline-size', background: '#fff', overflow: 'hidden' }}>
      <img src="./certificado/modelo.jpg" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} crossOrigin="anonymous" />
      <div style={{ ...texto, ...brilho, top: P(676), fontSize: P(45) }}>
        Certifico que o aluno <b>{c.aluno}</b>,
      </div>
      <div style={{ ...texto, ...brilho, top: P(753), fontSize: P(45) }}>
        {c.documento ? <>Portador do {c.documento.tipo} nº <b>{c.documento.numero}</b>, </> : null}concluiu com êxito a <b>{c.ordem}ª</b> graduação
      </div>
      <div style={{ ...texto, ...brilho, top: P(830), fontSize: P(45) }}>
        na fase {c.fase} da faixa <b>{c.faixa}</b> na Avaliação Técnica, Física,
      </div>
      <div style={{ ...texto, ...brilho, top: P(906), fontSize: P(45) }}>Psicológica e Conhecimentos Especiais do Curso de Kung Fu Wushu Mao Quan.</div>
      <div style={{ ...texto, left: P(1100), right: P(280), top: P(1028), fontSize: P(44), textAlign: 'right' }}>
        {c.cidade}, {dataExtenso(c.data)}
      </div>
      <div style={{ ...texto, left: P(720), right: P(850), top: P(1262), fontSize: P(43), overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.aluno}</div>
      {c.professor && (
        <div style={{ ...texto, ...brilho, left: P(1225), right: P(170), top: P(1198), fontSize: P(43), lineHeight: 1.1 }}>
          {c.professor.nome}
          {c.professor.titulo && <div>{c.professor.titulo}</div>}
        </div>
      )}
    </div>
  );
}

async function gerarImagem(node, jpg) {
  const escala = W / node.getBoundingClientRect().width; // exporta em 2000px de largura
  const opts = { pixelRatio: escala, cacheBust: true, backgroundColor: '#ffffff' };
  return jpg ? toJpeg(node, { ...opts, quality: 0.93 }) : toPng(node, opts);
}

/** Certificado + botões de download (PDF A4, JPG, PNG) e impressão */
export function CertificadoComAcoes({ c, liberado = true, motivo }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const nome = `certificado-${c.aluno}-${c.faixa}`.replace(/[^\w-]+/g, '_');
  const exportar = async (formato) => {
    if (!liberado) return toast(motivo || 'Download bloqueado.');
    setBusy(true);
    try {
      if (formato === 'pdf') {
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        pdf.addImage(await gerarImagem(ref.current, true), 'JPEG', 0, 0, 297, 210);
        pdf.save(`${nome}.pdf`);
      } else if (formato === 'print') {
        const url = await gerarImagem(ref.current, true);
        const w = window.open('', '_blank');
        if (!w) return toast('Permita pop-ups para imprimir.');
        w.document.write(`<html><head><title>Certificado</title><style>@page{size:A4 landscape;margin:0}body{margin:0}img{width:297mm;height:210mm}</style></head><body><img src="${url}"/><script>window.onload=()=>setTimeout(()=>window.print(),250)</script></body></html>`);
        w.document.close();
      } else {
        const a = document.createElement('a');
        a.href = await gerarImagem(ref.current, formato === 'jpg');
        a.download = `${nome}.${formato}`;
        a.click();
      }
    } catch (e) {
      toast('Falha ao exportar: ' + e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="col">
      <div style={{ boxShadow: '0 6px 24px rgba(0,0,0,.12)', borderRadius: 6, overflow: 'hidden' }}>
        <CertificadoVisual c={c} innerRef={ref} />
      </div>
      <div className="row" style={{ justifyContent: 'center' }}>
        {['pdf', 'jpg', 'png'].map((f) => (
          <button key={f} className="btn sm dark" disabled={busy} onClick={() => exportar(f)}>⬇ {f.toUpperCase()}</button>
        ))}
        <button className="btn sm ghost" disabled={busy} onClick={() => exportar('print')}>🖨 Imprimir</button>
      </div>
    </div>
  );
}
