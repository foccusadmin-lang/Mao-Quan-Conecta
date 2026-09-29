import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useDB } from '../lib/db';
import { supabase } from '../lib/supabase';
import { pixPayload, chavePixEMV, maskChavePix, TIPOS_PIX, copy, brl, waLink, b64e, todayISO, APP_URL, mapsBusca, mapsRota } from '../lib/utils';
import { Modal, toast, WAIcon, Card } from './ui';
import { EnviarComprovante } from './Comprovante';

export function useQR(text, opts = {}) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!text) return setUrl(null);
    QRCode.toDataURL(text, { margin: 1, width: 440, errorCorrectionLevel: 'M', color: { dark: '#141414', light: '#ffffff' }, ...opts })
      .then(setUrl)
      .catch(() => setUrl(null));
  }, [text]);
  return url;
}

export function WhatsFab() {
  const db = useDB();
  return (
    <a className="wa-fab" href={waLink(db.config.whatsapp, 'Olá! Preciso de suporte no app Mao Quan Conecta.')} target="_blank" rel="noreferrer" title={`Suporte técnico — ${db.config.suporteNome}`}>
      <WAIcon />
      <span>Suporte</span>
    </a>
  );
}

// ---------- PIX ----------
/** Professor responsável pela filial, se tiver chave PIX cadastrada (dados já carregados no app) */
export function recebedorLocal(db, filialId) {
  const f = db.filiais.find((x) => x.id === filialId);
  const p = f?.professorId && db.professores.find((x) => x.id === f.professorId);
  return p && p.ativo !== false && p.pix?.chave?.trim() ? { professorId: p.id, nome: p.nome, titulo: p.titulo, telefone: p.telefone, ...p.pix } : null;
}

/** Recebedor das mensalidades da filial. O aluno não lê o cadastro de professores, então consulta o servidor. */
export function useRecebedor(filialId) {
  const db = useDB();
  const local = filialId ? recebedorLocal(db, filialId) : null;
  const [remoto, setRemoto] = useState({ filialId: null, rec: null });
  useEffect(() => {
    if (!filialId || local) return;
    let vivo = true;
    supabase.rpc('mq_recebedor_filial', { p_filial: filialId }).then(({ data }) => vivo && setRemoto({ filialId, rec: data || null }));
    return () => (vivo = false);
  }, [filialId, !!local]);
  if (!filialId) return { carregando: false, rec: null };
  if (local) return { carregando: false, rec: local };
  return { carregando: remoto.filialId !== filialId, rec: remoto.filialId === filialId ? remoto.rec : null };
}

/**
 * QR Code / copia e cola PIX.
 * Com `filialId` (mensalidade), o valor vai para a chave do professor responsável pela filial;
 * sem chave cadastrada, usa a chave da Associação.
 */
export function PixBox({ valor, descricao, txid, filialId }) {
  const db = useDB();
  const { carregando, rec } = useRecebedor(filialId);
  const chave = rec ? chavePixEMV(rec) : db.config.pixChave;
  const nome = rec ? rec.titular || rec.nome : db.config.pixNome;
  const cidade = rec?.cidade || db.config.pixCidade;
  const payload = carregando || !chave ? '' : pixPayload({ chave, nome, cidade, valor, descricao, txid });
  const qr = useQR(payload);
  const telProf = (rec?.telefone || '').replace(/\D/g, '');
  const whats = telProf.length >= 10 ? '55' + telProf : db.config.whatsapp;
  if (carregando) return <div className="small muted center">Carregando dados do PIX…</div>;
  return (
    <div className="col" style={{ alignItems: 'center', textAlign: 'center' }}>
      {qr && <img src={qr} alt="QR Code PIX" style={{ width: 210, height: 210, borderRadius: 12, border: '1px solid var(--line)' }} />}
      {valor ? <div style={{ fontSize: 22, fontWeight: 800 }}>{brl(valor)}</div> : null}
      {rec ? (
        <div className="small muted">
          Recebedor: <b style={{ color: 'var(--ink)' }}>{rec.titulo || 'Laoshi'} {rec.nome}</b> (professor responsável pela filial)
          <br />
          Chave PIX ({TIPOS_PIX[rec.tipo] || 'chave'}): <b style={{ color: 'var(--ink)' }}>{maskChavePix(rec.tipo, rec.chave)}</b>
        </div>
      ) : (
        <div className="small muted">
          Chave PIX (e-mail): <b style={{ color: 'var(--ink)' }}>{db.config.pixChave}</b>
        </div>
      )}
      <div className="row" style={{ justifyContent: 'center' }}>
        <button className="btn dark sm" onClick={() => copy(payload).then(() => toast('PIX copia e cola copiado!'))}>📋 Copiar PIX copia e cola</button>
        <button className="btn ghost sm" onClick={() => copy(chave).then(() => toast('Chave copiada!'))}>Copiar chave</button>
      </div>
      {!rec && db.config.infinitePay && (
        <a className="btn gold sm" href={db.config.infinitePay} target="_blank" rel="noreferrer">💳 Pagar com cartão (InfinitePay)</a>
      )}
      {txid && db.pagamentos.some((x) => x.id === txid) ? (
        <>
          <EnviarComprovante pagamentoId={txid} />
          <a className="xs" href={waLink(whats, `Olá! Enviei o comprovante pelo app: ${descricao || ''} ${valor ? brl(valor) : ''}`)} target="_blank" rel="noreferrer">
            Dúvidas? Falar no WhatsApp{telProf.length >= 10 ? ' com o professor' : ''}
          </a>
        </>
      ) : (
        <a className="btn ok sm" href={waLink(whats, `Olá! Segue o comprovante de pagamento: ${descricao || ''} ${valor ? brl(valor) : ''}`)} target="_blank" rel="noreferrer">
          📎 Enviar comprovante via WhatsApp{telProf.length >= 10 ? ' ao professor' : ''}
        </a>
      )}
    </div>
  );
}

// ---------- Investimento ----------
export function InvestModal({ open, onClose, sponsor }) {
  const db = useDB();
  const c = db.config;
  return (
    <Modal open={open} onClose={onClose} title="🥋 Apoie o esporte — Programa de Incentivo" glass>
      <div className="col" style={{ gap: 14 }}>
        <p style={{ margin: 0 }}>
          Ao abrir sua conta na <b>Foccus Invest</b> com o código de indicação da Associação, uma parte do resultado (<b>5% de repasse</b>, sem dedução do seu capital)
          é destinada ao apoio de <b>atletas, viagens para competições e auxílio a alunos carentes</b> — enquanto você mantém a sua rentabilidade diária.
        </p>
        {sponsor && (
          <p style={{ margin: 0 }}>
            <b>Programa de Parceria Empresarial:</b> colaboradores, familiares e amigos do patrocinador podem usar o mesmo código, garantindo ao patrocinador um ganho adicional de
            5% sobre as aplicações indicadas.
          </p>
        )}
        <div style={{ textAlign: 'center' }}>
          <div className="xs" style={{ opacity: 0.7, marginBottom: 6 }}>CÓDIGO DE INDICAÇÃO</div>
          <span className="code-pill">
            {c.codigoRef}
            <button className="btn sm" onClick={() => copy(c.codigoRef).then(() => toast('Código copiado!'))}>Copiar</button>
          </span>
        </div>
        <div className="grid g2" style={{ gap: 10 }}>
          <div className="alert ink" style={{ background: 'rgba(255,255,255,.08)', color: '#fff', borderColor: 'rgba(255,255,255,.15)' }}>
            📅 <div><b>Rendimentos:</b> resgate todas as sextas-feiras.</div>
          </div>
          <div className="alert ink" style={{ background: 'rgba(255,255,255,.08)', color: '#fff', borderColor: 'rgba(255,255,255,.15)' }}>
            🔒 <div><b>Capital principal:</b> carência de 90 dias do valor aplicado em operação. Após a carência, o resgate é processado em até 30 dias a partir da data de solicitação do saque.</div>
          </div>
        </div>
        <p className="xs" style={{ margin: 0, opacity: 0.65 }}>
          Informação institucional sobre o programa de parceria. Não constitui recomendação de investimento — leia as condições da plataforma antes de aplicar. Todo investimento envolve riscos.
        </p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <a className="btn" href={c.investimentoLink} target="_blank" rel="noreferrer">Quero me cadastrar →</a>
          <a className="btn ok" href={waLink(c.whatsapp, 'Olá! Quero saber mais sobre o programa de incentivo (código ' + c.codigoRef + ').')} target="_blank" rel="noreferrer">
            WhatsApp (11) 94963-2186
          </a>
        </div>
      </div>
    </Modal>
  );
}

export function InvestButton({ block }) {
  const db = useDB();
  const [open, setOpen] = useState(false);
  if (!db.config.investimentoAtivo) return null;
  return (
    <>
      <button className={`btn gold ${block ? 'block' : ''}`} onClick={() => setOpen(true)}>💰 Apoie atletas — Investimento</button>
      <InvestModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** Link de acesso para a página de Patrocinador */
export function SponsorShare({ nome }) {
  const link = `${APP_URL}#/patrocinador/${b64e({ de: nome, em: todayISO() })}`;
  const share = async () => {
    const data = { title: 'Mao Quan Conecta — Patrocinador', text: `Convite de ${nome} para apoiar o Kung Fu Mao Quan`, url: link };
    if (navigator.share) {
      try {
        await navigator.share(data);
        return;
      } catch {}
    }
    await copy(link);
    toast('Link de patrocinador copiado!');
  };
  return (
    <button className="btn dark" onClick={share}>🤝 Patrocinador</button>
  );
}

// ---------- Diretoria ----------
export function DiretoriaList({ compact }) {
  const db = useDB();
  return (
    <div className={compact ? 'col' : 'grid g3'}>
      {db.diretoria.map((d) => (
        <div key={d.id} className={compact ? 'list-item' : 'card'} style={compact ? { alignItems: 'flex-start' } : {}}>
          <div>
            <div className="xs" style={{ color: 'var(--red)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>{d.cargo}</div>
            {d.membros.map((m, i) => (
              <div key={i} style={{ fontWeight: 600, marginTop: 3 }}>{m}</div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Gráfico de frequência mensal ----------
export function AttendanceChart({ alunoId, meses = 6 }) {
  const db = useDB();
  const hoje = new Date();
  const data = [];
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const n = db.presencas.filter((p) => p.alunoId === alunoId && p.confirmada && p.data.startsWith(ym)).length;
    data.push({ l: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''), n });
  }
  const max = Math.max(4, ...data.map((d) => d.n));
  return (
    <div className="bars" role="img" aria-label="Presenças por mês">
      {data.map((d, i) => (
        <div className="b" key={i}>
          <em>{d.n}</em>
          <i style={{ height: `${(d.n / max) * 100}%` }} />
          <span>{d.l}</span>
        </div>
      ))}
    </div>
  );
}

export function Institucional() {
  const db = useDB();
  const ins = db.institucional;
  return (
    <div className="grid g2">
      <Card title="📜 História do estilo Mao Chuen">
        <p style={{ whiteSpace: 'pre-line', margin: 0 }}>{ins.historia}</p>
      </Card>
      <Card title="🧓 Biografia do Mestre">
        <p style={{ whiteSpace: 'pre-line', margin: 0 }}>{ins.biografia}</p>
      </Card>
      <Card title="🌳 Árvore genealógica da linhagem (Linji)">
        <div className="tree">
          {ins.linhagem.map((n, i) => (
            <div className="node" key={i}>
              <div className="xs" style={{ color: 'var(--red)', fontWeight: 700 }}>{n.geracao}</div>
              <div style={{ fontWeight: 700 }}>{n.nome}</div>
            </div>
          ))}
        </div>
      </Card>
      <Card title={<><span className="han">武德</span> Wu De — Código de ética marcial</>}>
        {ins.wude.map((g, i) => (
          <div key={i} className="mb">
            <div style={{ fontWeight: 700, color: 'var(--red-dark)' }}>{g.grupo}</div>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {g.itens.map((it, j) => <li key={j}>{it}</li>)}
            </ul>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ---------- Endereços clicáveis (Google Maps) ----------
export const enderecoFilial = (f) => (f ? [f.endereco, f.cidade].filter(Boolean).join(', ') : '');

/** Endereço completo do evento: o informado, o da filial com o mesmo nome do local ou o próprio local */
export function enderecoEvento(db, e) {
  if (e.endereco) return e.endereco;
  const f = db.filiais.find((x) => x.nome === e.local);
  if (f?.endereco) return enderecoFilial(f);
  return /^online$/i.test((e.local || '').trim()) ? '' : e.local || '';
}

export function LinkMapa({ endereco, children, rota }) {
  if (!endereco) return <span>{children}</span>;
  return (
    <a href={rota ? mapsRota(endereco) : mapsBusca(endereco)} target="_blank" rel="noreferrer" title="Abrir no Google Maps" style={{ textDecoration: 'underline', textUnderlineOffset: 2 }}>
      {children}
    </a>
  );
}
