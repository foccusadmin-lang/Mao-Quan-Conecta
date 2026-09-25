import { useState } from 'react';
import { pixPayload, copy, brl, youtubeEmbed, fmtDate } from '../lib/utils';
import { RESULTADOS, estatisticas } from '../lib/vitrine';
import { toast, Modal } from './ui';
import { useQR } from './shared';

/** Quadro de conquistas: ouro, prata, bronze, campeonatos, troféus e honras ao mérito */
export function QuadroMedalhas({ vitrine, escuro }) {
  const s = estatisticas(vitrine);
  const itens = [
    ['🥇', s.ouro, 'Ouro'],
    ['🥈', s.prata, 'Prata'],
    ['🥉', s.bronze, 'Bronze'],
    ['🏟️', s.campeonatos, 'Campeonatos'],
    ['🏆', s.trofeus, 'Troféus'],
    ['🎖️', s.honras, 'Honra ao mérito'],
  ];
  return (
    <div className="quadro-medalhas">
      {itens.map(([icone, n, rotulo]) => (
        <div key={rotulo} className={`qm ${escuro ? 'escuro' : ''}`}>
          <div className="qm-i">{icone}</div>
          <div className="qm-n">{n}</div>
          <div className="qm-l">{rotulo}</div>
        </div>
      ))}
    </div>
  );
}

/** Lista cronológica das conquistas em campeonatos */
export function ListaConquistas({ conquistas = [], onRemover }) {
  const lista = [...conquistas].sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  if (!lista.length) return <p className="muted small">Nenhuma competição registrada ainda.</p>;
  return (
    <div className="col" style={{ gap: 0 }}>
      {lista.map((c) => {
        const r = RESULTADOS[c.resultado] || RESULTADOS.participacao;
        return (
          <div key={c.id} className="list-item" style={{ alignItems: 'flex-start' }}>
            <div style={{ fontSize: 26, lineHeight: 1 }}>{r.icone}</div>
            <div className="grow">
              <div style={{ fontWeight: 700 }}>{c.campeonato}</div>
              <div className="xs muted">
                {r.rotulo}
                {c.categoria && ` · ${c.categoria}`}
                {c.data && ` · ${fmtDate(c.data)}`}
                {c.local && ` · ${c.local}`}
              </div>
            </div>
            {onRemover && <button className="btn sm ghost icon" onClick={() => onRemover(c.id)} aria-label="Remover">✕</button>}
          </div>
        );
      })}
    </div>
  );
}

/** Galeria de fotos e vídeos (arquivos enviados ou links do YouTube) */
export function Galeria({ midias = [], onRemover }) {
  const [aberta, setAberta] = useState(null);
  if (!midias.length) return <p className="muted small">Nenhuma foto ou vídeo ainda.</p>;
  return (
    <>
      <div className="galeria">
        {midias.map((m) => (
          <div key={m.id} className="galeria-item">
            {m.tipo === 'foto' && <img src={m.url} alt={m.legenda || ''} loading="lazy" onClick={() => setAberta(m)} />}
            {m.tipo === 'video' && <video src={m.url} controls preload="metadata" />}
            {m.tipo === 'youtube' && youtubeEmbed(m.url) && (
              <div className="video"><iframe src={youtubeEmbed(m.url)} title={m.legenda || 'Vídeo'} allowFullScreen loading="lazy" /></div>
            )}
            {m.legenda && <div className="galeria-legenda">{m.legenda}</div>}
            {onRemover && (
              <button className="btn sm dark icon galeria-remover" onClick={() => onRemover(m)} aria-label="Remover">✕</button>
            )}
          </div>
        ))}
      </div>
      <Modal open={!!aberta} onClose={() => setAberta(null)} title={aberta?.legenda || 'Foto'} wide>
        {aberta && <img src={aberta.url} alt={aberta.legenda || ''} style={{ width: '100%', borderRadius: 12 }} />}
      </Modal>
    </>
  );
}

/** Doação por PIX para a chave do próprio atleta, com o valor escolhido pelo visitante */
export function PixDoacao({ chave, nome, cidade, atleta }) {
  const [valor, setValor] = useState(50);
  const [outro, setOutro] = useState('');
  const v = outro ? Number(String(outro).replace(',', '.')) || 0 : valor;
  const payload = chave ? pixPayload({ chave, nome: nome || atleta, cidade: cidade || 'BRASIL', valor: v > 0 ? v : undefined, descricao: `Patrocinio ${atleta}` }) : '';
  const qr = useQR(payload);
  if (!chave) return null;
  return (
    <div className="col" style={{ alignItems: 'center', textAlign: 'center' }}>
      <div className="row" style={{ justifyContent: 'center' }}>
        {[20, 50, 100, 200].map((x) => (
          <button key={x} className={`btn sm ${!outro && valor === x ? '' : 'ghost'}`} onClick={() => (setValor(x), setOutro(''))}>{brl(x)}</button>
        ))}
        <input
          inputMode="decimal"
          placeholder="Outro valor"
          value={outro}
          onChange={(e) => setOutro(e.target.value.replace(/[^\d,.]/g, ''))}
          style={{ width: 130 }}
        />
      </div>
      {qr && <img src={qr} alt="QR Code PIX" style={{ width: 210, height: 210, borderRadius: 12, border: '1px solid var(--line)', background: '#fff' }} />}
      <div style={{ fontSize: 22, fontWeight: 800 }}>{v > 0 ? brl(v) : 'Valor livre'}</div>
      <div className="small muted">Chave PIX de {nome || atleta}: <b style={{ color: 'var(--ink)' }}>{chave}</b></div>
      <div className="row" style={{ justifyContent: 'center' }}>
        <button className="btn dark sm" onClick={() => copy(payload).then(() => toast('PIX copia e cola copiado!'))}>📋 Copiar PIX copia e cola</button>
        <button className="btn ghost sm" onClick={() => copy(chave).then(() => toast('Chave copiada!'))}>Copiar chave</button>
      </div>
    </div>
  );
}
