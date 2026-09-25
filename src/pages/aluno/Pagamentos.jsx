import { useState } from 'react';
import { useDB, situacaoAluno } from '../../lib/db';
import { brl, fmtDate, todayISO } from '../../lib/utils';
import { PageHead, Card, Modal, StatusBadge, Empty } from '../../components/ui';
import { PixBox, InvestButton } from '../../components/shared';

export default function Pagamentos({ user }) {
  const db = useDB();
  const [pagar, setPagar] = useState(null);
  const fin = situacaoAluno(db, user);
  const hoje = todayISO();
  const todos = db.pagamentos.filter((p) => p.pessoaId === user.id).sort((a, b) => b.vencimento.localeCompare(a.vencimento));

  return (
    <>
      <PageHead title="Pagamentos" sub="PIX, cartão (InfinitePay) e envio de comprovante" />
      {user.isento && <div className="alert gold mb">🎓 Você é isento(a) de mensalidade.</div>}
      {fin.bloqueado && <div className="alert red mb">⛔ Existem mensalidades vencidas. Conteúdo, certificados e carteirinha ficam bloqueados até a confirmação.</div>}

      <div className="grid g2">
        <Card title="🧾 Em aberto">
          {fin.emAberto.length === 0 && <Empty icon="✅">Nada em aberto. Obrigado!</Empty>}
          {fin.emAberto.map((p) => (
            <div key={p.id} className="list-item" style={{ flexWrap: 'wrap' }}>
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{p.descricao}</div>
                <div className="xs muted">Vencimento {fmtDate(p.vencimento)}</div>
              </div>
              <b>{brl(p.valor)}</b>
              <StatusBadge status={p.vencimento < hoje ? 'vencido' : 'pendente'} />
              <button className="btn sm" onClick={() => setPagar(p)}>Pagar</button>
            </div>
          ))}
        </Card>
        <Card title="💳 Formas de pagamento">
          <PixBox descricao="Mao Quan Kung Fu" />
        </Card>
      </div>

      <Card title="Histórico" className="mt">
        {todos.length === 0 ? <Empty icon="🧾">Sem lançamentos.</Empty> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Descrição</th><th>Vencimento</th><th>Valor</th><th>Status</th></tr></thead>
              <tbody>
                {todos.map((p) => (
                  <tr key={p.id}><td>{p.descricao}</td><td>{fmtDate(p.vencimento)}</td><td>{brl(p.valor)}</td><td><StatusBadge status={p.status === 'pendente' && p.vencimento < hoje ? 'vencido' : p.status} /></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <div className="mt"><InvestButton /></div>

      <Modal open={!!pagar} onClose={() => setPagar(null)} title={pagar?.descricao}>
        {pagar && (
          <>
            <PixBox valor={pagar.valor} descricao={pagar.descricao} txid={pagar.id} />
            <p className="xs muted center">Após o pagamento, envie o comprovante. A liberação acontece assim que o professor ou a Central confirmar.</p>
          </>
        )}
      </Modal>
    </>
  );
}
