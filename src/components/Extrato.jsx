import { useState } from 'react';
import { brl, fmtDate, todayISO } from '../lib/utils';
import { Card, Tabs, StatusBadge, Empty } from './ui';
import { SeloComprovante } from './Comprovante';

const METODO = { pix: 'PIX', dinheiro: 'Em mãos', manual: 'Confirmado', cartao: 'Cartão' };

/** Extrato do pagador: o que está em aberto e o que já foi pago */
export function ExtratoPagamentos({ pagamentos, onPagar, titulo = '🧾 Minhas mensalidades' }) {
  const hoje = todayISO();
  const abertos = pagamentos.filter((p) => p.status === 'pendente').sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const pagos = pagamentos.filter((p) => p.status === 'pago').sort((a, b) => (b.pagoEm || '').localeCompare(a.pagoEm || ''));
  const [aba, setAba] = useState(abertos.length ? 'abertos' : 'pagos');
  const soma = (l) => l.reduce((s, p) => s + +p.valor, 0);
  const ano = hoje.slice(0, 4);
  const pagosAno = pagos.filter((p) => p.pagoEm?.startsWith(ano));
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
          <div style={{ fontSize: 20, fontWeight: 800 }}>{brl(soma(pagos))}</div>
          <div className="xs muted">{pagos.length} pagamento(s)</div>
        </div>
      </div>

      <Tabs tabs={[['abertos', `Em aberto (${abertos.length})`], ['pagos', `Pagas (${pagos.length})`]]} value={aba} onChange={setAba} />

      {aba === 'abertos' &&
        (abertos.length === 0 ? <Empty icon="✅">Nada em aberto.</Empty> : abertos.map((p) => (
          <div key={p.id} className="list-item" style={{ flexWrap: 'wrap' }}>
            <div className="grow" style={{ minWidth: 180 }}>
              <div style={{ fontWeight: 600 }}>{p.descricao}</div>
              <div className="xs muted">Vencimento {fmtDate(p.vencimento)}</div>
            </div>
            <b>{brl(p.valor)}</b>
            <StatusBadge status={p.vencimento < hoje ? 'vencido' : 'pendente'} /> <SeloComprovante p={p} />
            {onPagar && <button className="btn sm" onClick={() => onPagar(p)}>{p.analise === 'enviado' ? 'Ver / reenviar' : 'Pagar'}</button>}
          </div>
        )))}

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
                    <td className="nowrap">{fmtDate(p.pagoEm)}</td>
                    <td className="small">{METODO[p.metodo] || p.metodo || '—'}</td>
                    <td className="nowrap" style={{ fontWeight: 700 }}>{brl(p.valor)}</td>
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
