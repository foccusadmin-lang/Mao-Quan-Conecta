import { useState } from 'react';
import { ESCALAS } from '../lib/monitoramento';
import { fmtDate } from '../lib/utils';

// Paleta categórica (identidade da série, ordem fixa) — não confundir com as cores das faixas de nota
const SERIES = [
  { k: 'recuperacao', nome: 'Recuperação (ERS)', cor: '#2a78d6' },
  { k: 'foco', nome: 'Foco mental', cor: '#eb6834' },
  { k: 'esforco', nome: 'Esforço (PSE)', cor: '#1baf7a' },
  { k: 'clima', nome: 'Clima marcial', cor: '#eda100' },
];
const W = 720;
const H = 260;
const M = { t: 14, r: 16, b: 30, l: 30 };

/** Média por dia de cada indicador (escala 1–10). respostas = [{ dataTreino, recuperacao, foco, esforco, clima }] */
export function mediasPorDia(respostas) {
  const dias = new Map();
  for (const r of respostas) {
    const d = dias.get(r.dataTreino) || { data: r.dataTreino, n: 0, soma: {} };
    d.n++;
    for (const s of SERIES) d.soma[s.k] = (d.soma[s.k] || 0) + (+r[s.k] || 0);
    dias.set(r.dataTreino, d);
  }
  return [...dias.values()]
    .sort((a, b) => a.data.localeCompare(b.data))
    .map((d) => ({ data: d.data, n: d.n, ...Object.fromEntries(SERIES.map((s) => [s.k, Math.round((d.soma[s.k] / d.n) * 10) / 10])) }));
}

export default function GraficoMonitoramento({ respostas, titulo }) {
  const pontos = mediasPorDia(respostas);
  const [hover, setHover] = useState(null);
  const [tabela, setTabela] = useState(false);
  if (!pontos.length) return <p className="small muted">Sem respostas no período.</p>;

  const iw = W - M.l - M.r;
  const ih = H - M.t - M.b;
  const x = (i) => M.l + (pontos.length === 1 ? iw / 2 : (i / (pontos.length - 1)) * iw);
  const y = (v) => M.t + ih - ((v - 1) / 9) * ih;
  const passo = Math.max(1, Math.ceil(pontos.length / 8)); // rótulos de data sem colisão
  const ultimo = pontos.length - 1;

  const mover = (e) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    let melhor = 0;
    pontos.forEach((_, i) => Math.abs(x(i) - px) < Math.abs(x(melhor) - px) && (melhor = i));
    setHover(melhor);
  };

  return (
    <div>
      <div className="row between" style={{ alignItems: 'center', marginBottom: 6 }}>
        {titulo && <b className="small">{titulo}</b>}
        <button type="button" className="btn link sm" onClick={() => setTabela(!tabela)}>{tabela ? 'Ver gráfico' : 'Ver tabela'}</button>
      </div>
      {/* Legenda (sempre presente com mais de uma série) */}
      <div className="row" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
        {SERIES.map((s) => (
          <span key={s.k} className="xs" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--ink, #1b1b1b)' }}>
            <span style={{ width: 14, height: 3, borderRadius: 2, background: s.cor }} />
            {s.nome}
          </span>
        ))}
      </div>

      {tabela ? (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Data</th><th>Respostas</th>{SERIES.map((s) => <th key={s.k}>{s.nome}</th>)}</tr></thead>
            <tbody>
              {pontos.map((p) => (
                <tr key={p.data}><td>{fmtDate(p.data)}</td><td>{p.n}</td>{SERIES.map((s) => <td key={s.k}>{p[s.k]}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Média diária dos indicadores${titulo ? ' — ' + titulo : ''}`} onMouseMove={mover} onMouseLeave={() => setHover(null)} style={{ display: 'block', touchAction: 'pan-y' }} onTouchStart={(e) => mover(e.touches[0] ? { ...e, clientX: e.touches[0].clientX, currentTarget: e.currentTarget } : e)}>
            {[1, 4, 7, 10].map((v) => (
              <g key={v}>
                <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="#e7e3de" strokeWidth="1" />
                <text x={M.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#7a756e">{v}</text>
              </g>
            ))}
            {pontos.map((p, i) => (i % passo === 0 || i === ultimo) && (
              <text key={p.data} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="#7a756e">{fmtDate(p.data).slice(0, 5)}</text>
            ))}
            {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={M.t} y2={M.t + ih} stroke="#b9b2aa" strokeWidth="1" strokeDasharray="3 3" />}
            {SERIES.map((s) => (
              <g key={s.k}>
                <polyline fill="none" stroke={s.cor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={pontos.map((p, i) => `${x(i)},${y(p[s.k])}`).join(' ')} />
                {pontos.map((p, i) => (
                  <circle key={p.data} cx={x(i)} cy={y(p[s.k])} r={hover === i ? 5 : pontos.length > 20 ? 0 : 3.5} fill={s.cor} stroke="#fff" strokeWidth="2" />
                ))}
              </g>
            ))}
          </svg>
          {hover !== null && (
            <div
              className="card"
              style={{ position: 'absolute', top: 4, left: `${(x(hover) / W) * 100}%`, transform: `translateX(${x(hover) > W * 0.6 ? 'calc(-100% - 10px)' : '10px'})`, padding: '8px 10px', pointerEvents: 'none', minWidth: 170, boxShadow: '0 4px 16px rgba(0,0,0,.12)' }}
            >
              <div className="xs" style={{ fontWeight: 700 }}>{fmtDate(pontos[hover].data)} · {pontos[hover].n} resposta(s)</div>
              {SERIES.map((s) => (
                <div key={s.k} className="xs row between" style={{ gap: 10 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 8, background: s.cor }} />{s.nome}</span>
                  <b>{pontos[hover][s.k]}</b>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="xs muted" style={{ marginTop: 4 }}>Escala 1–10 (média do dia). Recuperação, foco e clima: quanto maior, melhor. Esforço (PSE): quanto maior, mais pesado foi o treino.</div>
    </div>
  );
}

export { SERIES as SERIES_MONITORAMENTO, ESCALAS };
