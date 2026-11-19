import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useDB, situacaoAluno, taxasExame, taxaExameFaixa } from '../../lib/db';
import { brl, fmtDate, todayISO } from '../../lib/utils';

import { PageHead, Card, Modal, Faixa } from '../../components/ui';
import { ExtratoPagamentos } from '../../components/Extrato';
import { PixBox, InvestButton } from '../../components/shared';

/**
 * Taxa do próximo exame de faixa: a faixa seguinte à atual e o valor da tabela (Configurações → Taxa de exame).
 * A cobrança em si é gerada quando o professor libera o aluno no pré-exame; aqui o aluno já vê quanto vai pagar.
 */
function TaxaProximoExame({ user, onPagar }) {
  const db = useDB();
  const faixas = db.config.faixas || [];
  const idx = (user.faixaIdx ?? -1) + 1;
  const proxima = faixas[idx];
  if (!proxima || taxasExame(db)[proxima.nome] == null) return null; // última faixa da tabela (ou faixas pretas): sem taxa aqui
  const valor = taxaExameFaixa(db, idx);
  const cobranca = db.pagamentos
    .filter((p) => p.pessoaId === user.id && p.tipo === 'exame' && (p.descricao || '').includes(proxima.nome))
    .sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''))[0];
  const exame = db.eventos.filter((e) => e.tipo === 'exame' && e.data >= todayISO()).sort((a, b) => a.data.localeCompare(b.data))[0];
  return (
    <Card title="🎖️ Taxa do meu próximo exame" className="mb">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="small muted">Faixa atual → próxima faixa</div>
          <div className="row" style={{ gap: 6, marginTop: 4 }}>
            <Faixa idx={user.faixaIdx} /> <span>→</span> <Faixa idx={idx} />
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="small muted">Taxa do exame</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{brl(cobranca?.valor ?? valor)}</div>
        </div>
      </div>
      {exame && <div className="small mt">📅 Próximo exame: <b>{exame.titulo}</b> — {fmtDate(exame.data)}{exame.hora ? ` às ${exame.hora}` : ''}</div>}
      {!cobranca && (
        <div className="alert ink small mt">⏳ A cobrança da taxa é liberada pelo seu professor depois do pré-exame (frequência e avaliação técnica). Quando for liberada, ela aparece aqui para pagar.</div>
      )}
      {cobranca?.status === 'pendente' && (
        <div className="alert gold small mt" style={{ justifyContent: 'space-between' }}>
          <div>✅ Você foi liberado(a) para o exame! Pague a taxa até <b>{fmtDate(cobranca.vencimento)}</b> para confirmar sua inscrição.</div>
          <button className="btn sm" onClick={() => onPagar(cobranca)}>Pagar taxa</button>
        </div>
      )}
      {cobranca?.status === 'pago' && <div className="alert ok small mt">✅ Taxa paga — inscrição no exame confirmada.</div>}
    </Card>
  );
}

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

      <TaxaProximoExame user={user} onPagar={setPagar} />

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
