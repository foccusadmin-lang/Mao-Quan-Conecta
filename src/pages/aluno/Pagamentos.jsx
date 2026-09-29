import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useDB, situacaoAluno } from '../../lib/db';

import { PageHead, Card, Modal } from '../../components/ui';
import { ExtratoPagamentos } from '../../components/Extrato';
import { PixBox, InvestButton } from '../../components/shared';

export default function Pagamentos({ user }) {
  const db = useDB();
  const [pagar, setPagar] = useState(null);
  const fin = situacaoAluno(db, user);

  const todos = db.pagamentos.filter((p) => p.pessoaId === user.id).sort((a, b) => b.vencimento.localeCompare(a.vencimento));

  return (
    <>
      <PageHead title="Pagamentos" sub="PIX, cartão (InfinitePay) e envio de comprovante" />
      {user.isento && <div className="alert gold mb">{user.isentoPor ? `👨‍👩‍👧 ${user.isentoMotivo || 'Plano família'} — você está isento(a) da mensalidade.` : '🎓 Você é isento(a) de mensalidade.'}</div>}
      {!user.isento && <Link to="/aluno/plano" className="alert ink mb" style={{ textDecoration: 'none' }}>📋 <div className="grow">Escolha ou altere suas modalidades, o pacote completo ou o plano família.</div> Meu Plano →</Link>}
      {fin.bloqueado && <div className="alert red mb">⛔ Existem mensalidades vencidas. Conteúdo, certificados e carteirinha ficam bloqueados até a confirmação.</div>}

      <ExtratoPagamentos titulo="🧾 Minhas mensalidades e taxas" pagamentos={todos} onPagar={setPagar} />

      <Card title="💳 Formas de pagamento" className="mt">
        <PixBox descricao="Mensalidade Mao Quan" filialId={user.filialId} />
      </Card>
      <div className="mt"><InvestButton /></div>

      <Modal open={!!pagar} onClose={() => setPagar(null)} title={pagar?.descricao}>
        {pagar && (
          <>
            <PixBox valor={pagar.valor} descricao={pagar.descricao} txid={pagar.id} filialId={pagar.tipo === 'mensalidade' ? pagar.filialId || user.filialId : undefined} />
            <p className="xs muted center">Após pagar, envie o comprovante aqui. A liberação acontece assim que o professor responsável ou a Central conferir.</p>
          </>
        )}
      </Modal>
    </>
  );
}
