import { useState } from 'react';
import { brl, fmtDate, todayISO } from '../lib/utils';
import { Card, Tabs, StatusBadge, Empty, Modal } from './ui';
import { SeloComprovante, EnviarComprovante } from './Comprovante';

const METODO = { pix: 'PIX', dinheiro: 'Em mãos', manual: 'Confirmado', cartao: 'Cartão', isencao: 'Isenção' };

/** Extrato do pagador: o que está em aberto e o que já foi pago */
export function ExtratoPagamentos({ pagamentos, onPagar, titulo = '🧾 Minhas mensalidades' }) {
  const hoje = todayISO();
  const abertos = pagamentos.filter((p) => p.status === 'pendente').sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const pagos = pagamentos.filter((p) => p.status === 'pago').sort((a, b) => (b.pagoEm || '').localeCompare(a.pagoEm || ''));
  const [aba, setAba] = useState(abertos.length ? 'abertos' : 'pagos');
  const [jaPaguei, setJaPaguei] = useState(null);
  const soma = (l) => l.reduce((s, p) => s + +p.valor, 0);
  const ano = hoje.slice(0, 4);
  const efetivos = pagos.filter((p) => p.metodo !== 'isencao');
  const isentos = pagos.filter((p) => p.metodo === 'isencao');
  const pagosAno = efetivos.filter((p) => p.pagoEm?.startsWith(ano));
  const vencidos = abertos.filter((p) => p.vencimento < hoje);

  return (
    <Card title={titulo}>
      <div className="grid g3 mb">
        <div className="card" style={{ padding: 12, borderLeft: '4px solid var(--red)' }}>
          <div className="xs muted">Em aberto</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{brl(soma(abertos))}</div>
          <div className="xs muted">{abertos.length} cobrança(s){vencidos.length ? ` · ${vencidos.length} vencida(s)` : ''}</div>
        </div>
        <div className="card" style={{ padding: 12, borderLeft: '4px solid var(--ok)' }}>
          <div className="xs muted">Pago em {ano}</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{brl(soma(pagosAno))}</div>
          <div className="xs muted">{pagosAno.length} pagamento(s)</div>
        </div>
        <div className="card" style={{ padding: 12, borderLeft: '4px solid var(--ink)' }}>
          <div className="xs muted">Total já pago</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{brl(soma(efetivos))}</div>
          <div className="xs muted">{efetivos.length} pagamento(s){isentos.length ? ` · ${isentos.length} mês(es) com bolsa/isenção` : ''}</div>
        </div>
      </div>

      <Tabs tabs={[['abertos', `Em aberto (${abertos.length})`], ['pagos', `Pagas (${pagos.length})`]]} value={aba} onChange={setAba} />

      {aba === 'abertos' && abertos.length > 0 && onPagar && (
        <div className="alert ink small mb" style={{ alignItems: 'flex-start' }}>
          <div>
            <b>💡 Como confirmar um pagamento</b>
            <ol style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              <li><b>Ainda não pagou?</b> Toque em <b>Pagar</b> e use o QR Code ou o PIX copia e cola.</li>
              <li><b>Já pagou</b> (inclusive mensalidade atrasada ou paga fora do app)? Toque em <b>📎 Já paguei</b> e envie a foto ou o PDF do comprovante.</li>
              <li>O professor ou a Central confere: a cobrança fica <b>Em conferência</b> e depois muda para <b>Paga</b>. Se algo não bater, você recebe o motivo e pode enviar outro.</li>
            </ol>
          </div>
        </div>
      )}
      {aba === 'abertos' &&
        (abertos.length === 0 ? <Empty icon="✅">Nada em aberto.</Empty> : abertos.map((p) => (
          <div key={p.id} className="list-item" style={{ flexWrap: 'wrap' }}>
            <div className="grow" style={{ minWidth: 180 }}>
              <div style={{ fontWeight: 600 }}>{p.descricao}</div>
              <div className="xs muted">Vencimento {fmtDate(p.vencimento)}</div>
            </div>
            <b>{brl(p.valor)}</b>
            <StatusBadge status={p.vencimento < hoje ? 'vencido' : 'pendente'} /> <SeloComprovante p={p} />{p.personalizada && <span className="badge gold" title={p.valorPadrao ? `Valor padrão: ${brl(p.valorPadrao)}` : ''}>🎁 Valor personalizado</span>}
            {onPagar && p.analise !== 'enviado' && <button className="btn sm" onClick={() => onPagar(p)}>Pagar</button>}
            {onPagar && (
              <button className={`btn sm ${p.analise === 'enviado' ? 'ghost' : 'ok'}`} onClick={() => setJaPaguei(p.id)}>
                {p.analise === 'enviado' ? '📎 Ver / reenviar comprovante' : '📎 Já paguei'}
              </button>
            )}
          </div>
        )))}

      <Modal open={!!jaPaguei} onClose={() => setJaPaguei(null)} title="📎 Já paguei — enviar comprovante">
        {jaPaguei && (() => {
          const p = pagamentos.find((x) => x.id === jaPaguei);
          if (!p) return null;
          return (
            <div className="col">
              <div className="card" style={{ padding: 12 }}>
                <div style={{ fontWeight: 700 }}>{p.descricao}</div>
                <div className="small">
                  {brl(p.valor)} · vencimento {fmtDate(p.vencimento)} <StatusBadge status={p.vencimento < hoje ? 'vencido' : 'pendente'} />
                </div>
              </div>
              <p className="small" style={{ margin: 0 }}>
                Envie a <b>foto ou o PDF do comprovante</b> (PIX, transferência ou recibo). Vale também para mensalidades <b>atrasadas</b> ou pagas fora do app.
                Confira se o <b>valor</b> e a <b>data</b> aparecem no comprovante.
              </p>
              <EnviarComprovante pagamentoId={p.id} />
              <p className="xs muted center" style={{ margin: 0 }}>A liberação acontece assim que o professor responsável ou a Central conferir.</p>
            </div>
          );
        })()}
      </Modal>

      {aba === 'pagos' &&
        (pagos.length === 0 ? <Empty icon="🧾">Nenhum pagamento confirmado ainda.</Empty> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Descrição</th><th>Vencimento</th><th>Pago em</th><th>Forma</th><th>Valor</th><th></th></tr></thead>
              <tbody>
                {pagos.map((p) => (
                  <tr key={p.id}>
                    <td>{p.descricao}</td>
                    <td className="nowrap">{fmtDate(p.vencimento)}</td>
                    <td className="nowrap">{p.metodo === 'isencao' ? '—' : fmtDate(p.pagoEm)}</td>
                    <td className="small">{METODO[p.metodo] || p.metodo || '—'}</td>
                    <td className="nowrap" style={{ fontWeight: 700 }}>
                      {brl(p.valor)}
                      {p.metodo === 'isencao' && p.valorOriginal > 0 && <div className="xs muted" style={{ fontWeight: 400, textDecoration: 'line-through' }}>{brl(p.valorOriginal)}</div>}
                    </td>
                    <td><StatusBadge status="pago" /> <SeloComprovante p={p} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </Card>
  );
}
