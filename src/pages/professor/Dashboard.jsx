import { Link } from 'react-router-dom';
import { useDB, situacaoAluno, frequencia, professorEmDia } from '../../lib/db';
import { brl, fmtDate, todayISO, monthISO } from '../../lib/utils';
import { PageHead, Stat, Card, Empty, Faixa, Avatar } from '../../components/ui';
import { SponsorShare, InvestButton } from '../../components/shared';

export default function ProfDashboard({ user }) {
  const db = useDB();
  const filial = db.filiais.find((f) => f.id === user.filialId);
  const hoje = todayISO();

  if (!filial)
    return (
      <>
        <PageHead title={`Olá, ${user.titulo} ${user.nome.split(' ')[0]}`} />
        <div className="alert gold">🏯 Sua conta ainda não foi vinculada a uma filial. Aguarde o Administrador Geral designar sua unidade.</div>
      </>
    );

  const alunos = db.alunos.filter((a) => a.filialId === filial.id && a.status === 'aprovado');
  const pendentes = db.alunos.filter((a) => a.filialId === filial.id && a.status === 'pendente');
  const bloqueados = alunos.filter((a) => situacaoAluno(db, a).bloqueado);
  const presHoje = db.presencas.filter((p) => p.filialId === filial.id && p.data === hoje);
  const recebido = db.pagamentos.filter((p) => p.filialId === filial.id && p.status === 'pago' && p.pagoEm?.startsWith(monthISO())).reduce((s, p) => s + +p.valor, 0);
  const aberto = db.pagamentos.filter((p) => p.filialId === filial.id && p.status === 'pendente').reduce((s, p) => s + +p.valor, 0);
  const baixaFreq = alunos.filter((a) => !frequencia(db, a).ok);
  const comunicados = [...db.comunicados].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 3);

  return (
    <>
      <PageHead title={`Olá, ${user.titulo} ${user.nome.split(' ')[0]}`} sub={`Unidade: ${filial.nome} · Mensalidade ${brl(filial.mensalidade)}`}>
        <SponsorShare nome={`${user.titulo} ${user.nome}`} />
      </PageHead>

      {!professorEmDia(user) && (
        <Link to="filiacao" className="alert red mb" style={{ textDecoration: 'none' }}>
          ⛔ <div className="grow">Sua filiação / tarifa de manutenção está vencida. Gestão de material e estudo próprio ficam bloqueados.</div> Regularizar →
        </Link>
      )}

      <div className="grid g4">
        <Stat label="Alunos ativos" value={alunos.length} icon="🥋" tone="red" />
        <Stat label="Aguardando aprovação" value={pendentes.length} icon="⏳" tone="gold" />
        <Stat label="Presentes hoje" value={presHoje.length} icon="✅" tone="ok" />
        <Stat label="Inadimplentes" value={bloqueados.length} icon="⛔" tone="ink" />
        <Stat label="Recebido no mês" value={brl(recebido)} icon="💰" tone="ok" />
        <Stat label="Em aberto" value={brl(aberto)} icon="🧾" tone="gold" />
      </div>

      <div className="grid g2 mt">
        <Card title="⚠️ Frequência abaixo do mínimo" actions={<Link to="presenca" className="btn sm ghost">Chamada</Link>}>
          {baixaFreq.length === 0 ? <Empty icon="💪">Todos com frequência em dia.</Empty> : baixaFreq.slice(0, 6).map((a) => {
            const f = frequencia(db, a);
            return (
              <div key={a.id} className="list-item">
                <Avatar src={a.foto} name={a.nome} />
                <div className="grow"><div style={{ fontWeight: 600 }}>{a.nome}</div><Faixa idx={a.faixaIdx} /></div>
                <span className="badge red">{f.pct}%</span>
              </div>
            );
          })}
        </Card>
        <Card title="📢 Últimos comunicados da Sede" actions={<Link to="sede" className="btn sm ghost">Ver todos</Link>}>
          {comunicados.length === 0 ? <Empty icon="📭">Nada novo.</Empty> : comunicados.map((c) => (
            <div key={c.id} className="list-item" style={{ alignItems: 'flex-start' }}>
              <div className="grow"><div style={{ fontWeight: 600 }}>{c.titulo}</div><div className="small muted">{c.texto.slice(0, 110)}</div><div className="xs muted">{fmtDate(c.data)}</div></div>
            </div>
          ))}
        </Card>
      </div>
      <div className="mt"><InvestButton /></div>
    </>
  );
}
