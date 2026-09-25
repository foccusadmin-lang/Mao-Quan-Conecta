import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useDB } from '../lib/db';
import { pixPayload, copy, brl, waLink, b64e, todayISO, APP_URL } from '../lib/utils';
import { Modal, toast, WAIcon, Card } from './ui';

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
export function PixBox({ valor, descricao, txid }) {
  const db = useDB();
  const payload = pixPayload({ chave: db.config.pixChave, nome: db.config.pixNome, cidade: db.config.pixCidade, valor, descricao, txid });
  const qr = useQR(payload);
  return (
    <div className="col" style={{ alignItems: 'center', textAlign: 'center' }}>
      {qr && <img src={qr} alt="QR Code PIX" style={{ width: 210, height: 210, borderRadius: 12, border: '1px solid var(--line)' }} />}
      {valor ? <div style={{ fontSize: 22, fontWeight: 800 }}>{brl(valor)}</div> : null}
      <div className="small muted">
        Chave PIX (e-mail): <b style={{ color: 'var(--ink)' }}>{db.config.pixChave}</b>
      </div>
      <div className="row" style={{ justifyContent: 'center' }}>
        <button className="btn dark sm" onClick={() => copy(payload).then(() => toast('PIX copia e cola copiado!'))}>📋 Copiar PIX copia e cola</button>
        <button className="btn ghost sm" onClick={() => copy(db.config.pixChave).then(() => toast('Chave copiada!'))}>Copiar chave</button>
      </div>
      {db.config.infinitePay && (
        <a className="btn gold sm" href={db.config.infinitePay} target="_blank" rel="noreferrer">💳 Pagar com cartão (InfinitePay)</a>
      )}
      <a className="btn ok sm" href={waLink(db.config.whatsapp, `Olá! Segue o comprovante de pagamento: ${descricao || ''} ${valor ? brl(valor) : ''}`)} target="_blank" rel="noreferrer">
        📎 Enviar comprovante via WhatsApp
      </a>
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
