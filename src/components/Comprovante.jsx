import { useEffect, useRef, useState } from 'react';
import { useDB, setDB, aplicarDoServidor, confirmarPagamento, recusarComprovante, filialNome } from '../lib/db';
import { supabase } from '../lib/supabase';
import { comprimirImagem } from '../lib/vitrine';
import { uid, brl, fmtDate, todayISO } from '../lib/utils';
import { Field, StatusBadge, toast } from './ui';

const TIPOS_OK = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];
const dataHora = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

/** Sobe o arquivo para o armazenamento privado e registra no pagamento (fica "em conferência") */
export async function enviarComprovante(pagamento, arquivo) {
  if (!TIPOS_OK.includes(arquivo.type)) throw new Error('Envie uma foto (JPG, PNG) ou PDF do comprovante.');
  let f = arquivo;
  if (arquivo.type.startsWith('image/') && !/hei[cf]/.test(arquivo.type)) f = await comprimirImagem(arquivo, 1800, 0.85);
  if (f.size > 10 * 1024 * 1024) throw new Error('Arquivo maior que 10 MB.');
  const ext = f.type === 'application/pdf' ? 'pdf' : (f.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const caminho = `${pagamento.id}/${uid('c')}.${ext}`;
  const { error: e1 } = await supabase.storage.from('comprovantes').upload(caminho, f, { contentType: f.type, upsert: false });
  if (e1) throw e1;
  const { data, error: e2 } = await supabase.rpc('mq_registrar_comprovante', { p_pagamento: pagamento.id, p_arquivo: { caminho, nome: arquivo.name, tipo: f.type, tamanho: f.size } });
  if (e2) throw e2;
  aplicarDoServidor('pagamentos', pagamento.id, data);
  return data;
}

export const urlComprovante = async (caminho) => {
  const { data, error } = await supabase.storage.from('comprovantes').createSignedUrl(caminho, 600);
  if (error) throw error;
  return data.signedUrl;
};

/** Situação do comprovante (para listas) */
export function SeloComprovante({ p }) {
  if (p.metodo === 'isencao')
    return p.isencao === 'familia'
      ? <span className="badge gold" title={p.descricao}>👨‍👩‍👧 Plano família</span>
      : <span className="badge gold" title="Mensalidade isenta — bolsa integral">🎓 Bolsista 100%</span>;
  if (p.status === 'pago' && p.comprovantes?.length) return <span className="badge ok" title="Pago com comprovante conferido">📎 Conferido</span>;
  if (p.analise === 'enviado') return <span className="badge warn" title="Comprovante enviado — aguardando conferência">📎 Em conferência</span>;
  if (p.analise === 'recusado') return <span className="badge red" title={p.motivoRecusa || ''}>📎 Recusado</span>;
  return null;
}

/** Bloco de envio de comprovante — aparece em toda tela que pede pagamento */
export function EnviarComprovante({ pagamentoId }) {
  const db = useDB();
  const p = db.pagamentos.find((x) => x.id === pagamentoId);
  const input = useRef(null);
  const [enviando, setEnviando] = useState(false);
  if (!p) return null;
  if (p.status === 'pago') return <div className="alert ok small">✅ Pagamento confirmado em {fmtDate(p.pagoEm)}.</div>;

  const escolher = async (e) => {
    const arq = e.target.files?.[0];
    e.target.value = '';
    if (!arq) return;
    setEnviando(true);
    try {
      await enviarComprovante(p, arq);
      toast('Comprovante enviado! A Central e o professor responsável vão conferir.');
    } catch (err) {
      toast('Não foi possível enviar: ' + err.message);
    } finally {
      setEnviando(false);
    }
  };

  const ultimo = p.comprovantes?.at(-1);
  return (
    <div className="card" style={{ width: '100%', background: '#faf8f6', textAlign: 'left' }}>
      <b className="small">📎 Comprovante de pagamento</b>
      {p.analise === 'enviado' && ultimo && (
        <div className="alert gold small" style={{ margin: '8px 0' }}>⏳ Enviado em {dataHora(ultimo.enviadoEm)} — aguardando conferência.</div>
      )}
      {p.analise === 'recusado' && (
        <div className="alert red small" style={{ margin: '8px 0' }}>⚠️ Comprovante não confirmado: {p.motivoRecusa || 'confira os dados'}. Envie um novo.</div>
      )}
      {!p.analise && <p className="xs muted" style={{ margin: '4px 0 8px' }}>Depois de pagar, envie a foto ou o PDF do comprovante para conferência.</p>}
      <input ref={input} type="file" accept="image/*,application/pdf" onChange={escolher} hidden />
      <button type="button" className="btn ok sm block" disabled={enviando} onClick={() => input.current?.click()}>
        {enviando ? 'Enviando…' : p.analise === 'enviado' ? '📎 Enviar outro comprovante' : '📎 Enviar comprovante'}
      </button>
    </div>
  );
}

function ArquivoComprovante({ c }) {
  const [url, setUrl] = useState(null);
  const [erro, setErro] = useState('');
  useEffect(() => {
    urlComprovante(c.caminho).then(setUrl).catch((e) => setErro(e.message));
  }, [c.caminho]);
  const pdf = c.tipo === 'application/pdf';
  return (
    <div className="card" style={{ padding: 10 }}>
      <div className="xs muted">
        Enviado por <b>{c.enviadoPor}</b> ({c.papel === 'pagador' ? 'pagador' : c.papel === 'admin' ? 'Central' : 'professor'}) em {dataHora(c.enviadoEm)} · {c.nome}
      </div>
      {erro && <div className="xs" style={{ color: 'var(--red)' }}>Não foi possível abrir: {erro}</div>}
      {url && !pdf && (
        <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="Comprovante" style={{ width: '100%', maxHeight: 420, objectFit: 'contain', borderRadius: 8, marginTop: 6, background: '#fff' }} /></a>
      )}
      {url && pdf && <a className="btn sm dark mt" href={url} target="_blank" rel="noreferrer">📄 Abrir PDF do comprovante</a>}
    </div>
  );
}

const ACOES = { comprovante_enviado: '📎 Comprovante enviado', comprovante_recusado: '⚠️ Comprovante recusado', confirmado: '✅ Pagamento confirmado' };

/** Conferência e auditoria de um pagamento (Central / professor responsável) */
export function ConferenciaPagamento({ pagamentoId, user, nomePessoa, onFeito, podeDecidir = true }) {
  const db = useDB();
  const p = db.pagamentos.find((x) => x.id === pagamentoId);
  const [motivo, setMotivo] = useState('');
  const [recusando, setRecusando] = useState(false);
  if (!p) return null;
  const hoje = todayISO();

  const confirmar = (metodo) => {
    setDB((d) => confirmarPagamento(d, p.id, user.nome, metodo));
    toast('Pagamento confirmado e registrado na auditoria.');
    onFeito?.();
  };
  const recusar = () => {
    if (!motivo.trim()) return toast('Informe o motivo (ex.: valor diferente, comprovante ilegível).');
    setDB((d) => recusarComprovante(d, p.id, user.nome, motivo.trim()));
    toast('Comprovante recusado. O pagador foi avisado.');
    onFeito?.();
  };

  return (
    <div className="col">
      <div className="card" style={{ padding: 12 }}>
        <div className="row between">
          <div>
            <div style={{ fontWeight: 700 }}>{nomePessoa || '—'}</div>
            <div className="small">{p.descricao}</div>
            <div className="xs muted">{filialNome(db, p.filialId)} · vencimento {fmtDate(p.vencimento)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{brl(p.valor)}</div>
            <StatusBadge status={p.status === 'pendente' && p.vencimento < hoje ? 'vencido' : p.status} />
          </div>
        </div>
      </div>

      <b className="small">📎 Comprovantes ({p.comprovantes?.length || 0})</b>
      {!p.comprovantes?.length && <p className="small muted" style={{ margin: 0 }}>Nenhum comprovante enviado.</p>}
      {[...(p.comprovantes || [])].reverse().map((c) => <ArquivoComprovante key={c.caminho} c={c} />)}

      {podeDecidir && p.status === 'pendente' && (
        <div className="card" style={{ background: '#faf8f6', padding: 12 }}>
          {!recusando ? (
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <button className="btn ok" onClick={() => confirmar(p.comprovantes?.length ? 'pix' : 'manual')}>✔ Confirmar pagamento</button>
              <button className="btn ghost" onClick={() => confirmar('dinheiro')}>💵 Recebido em mãos</button>
              {p.analise === 'enviado' && <button className="btn ghost" style={{ color: 'var(--red)' }} onClick={() => setRecusando(true)}>✖ Recusar comprovante</button>}
            </div>
          ) : (
            <>
              <Field label="Motivo da recusa (o pagador verá esta mensagem)">
                <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: valor diferente do cobrado" autoFocus />
              </Field>
              <div className="row mt">
                <button className="btn" style={{ background: 'var(--red)' }} onClick={recusar}>Recusar comprovante</button>
                <button className="btn ghost" onClick={() => setRecusando(false)}>Cancelar</button>
              </div>
            </>
          )}
        </div>
      )}

      <b className="small">🧾 Trilha de auditoria</b>
      {!p.auditoria?.length && <p className="small muted" style={{ margin: 0 }}>Sem registros.</p>}
      {(p.auditoria || []).map((r, i) => (
        <div key={i} className="list-item small" style={{ alignItems: 'flex-start' }}>
          <div className="grow">
            <b>{ACOES[r.acao] || r.acao}</b>
            {r.metodo && <> · {r.metodo === 'dinheiro' ? 'em mãos' : r.metodo.toUpperCase()}</>}
            {r.arquivo && <> · {r.arquivo}</>}
            {r.motivo && <div className="xs">Motivo: {r.motivo}</div>}
            <div className="xs muted">{dataHora(r.em)} · {r.por}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
