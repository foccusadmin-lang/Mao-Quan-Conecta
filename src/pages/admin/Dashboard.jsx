import { Link } from 'react-router-dom';
import { useDB, situacaoAluno, professorEmDia, filialNome } from '../../lib/db';
import { brl, fmtDate, todayISO, monthISO } from '../../lib/utils';
import { PageHead, Stat, Card, Empty, Avatar } from '../../components/ui';
import { SponsorShare } from '../../components/shared';

export default function AdminDashboard() {
  const db = useDB();
  const hoje = todayISO();
  const aprovados = db.alunos.filter((a) => a.status === 'aprovado');
  const pendentes = db.alunos.filter((a) => a.status === 'pendente');
  const inadimplentes = aprovados.filter((a) => situacaoAluno(db, a).bloqueado);
  const profsIrregulares = db.professores.filter((p) => p.ativo && !professorEmDia(p));
  const filiaisSemProf = db.filiais.filter((f) => f.ativa && !f.professorId);
  const comp = monthISO();
  const recebidoMes = db.pagamentos.filter((p) => p.status === 'pago' && p.pagoEm?.startsWith(comp)).reduce((s, p) => s + Number(p.valor), 0);
  const aReceber = db.pagamentos.filter((p) => p.status === 'pendente').reduce((s, p) => s + Number(p.valor), 0);
  const proximos = db.eventos.filter((e) => e.data >= hoje).sort((a, b) => a.data.localeCompare(b.data)).slice(0, 4);

  const avisos = [
    pendentes.length && [`${pendentes.length} cadastro(s) aguardando aprovação`, 'alunos'],
    inadimplentes.length && [`${inadimplentes.length} aluno(s) bloqueado(s) por inadimplência`, 'financeiro'],
    profsIrregulares.length && [`${profsIrregulares.length} professor(es) com filiação vencida`, 'professores'],
    filiaisSemProf.length && [`${filiaisSemProf.length} filial(is) sem professor responsável`, 'filiais'],
  ].filter(Boolean);

  return (
    <>
      <PageHead title="Central Mao" sub="Visão geral da Associação em tempo real">
        <SponsorShare nome="Central Mao — Matriz" />
      </PageHead>

      <div className="grid g4">
        <Stat label="Filiais ativas" value={db.filiais.filter((f) => f.ativa).length} icon="🏯" tone="ink" />
        <Stat label="Total de alunos" value={aprovados.length} icon="🥋" tone="red" hint={`${db.professores.filter((p) => p.ativo).length} professores`} />
        <Stat label="Cadastros pendentes" value={pendentes.length} icon="⏳" tone="gold" />
        <Stat label="Eventos" value={db.eventos.length} icon="📅" tone="ok" hint={`${proximos.length} próximos`} />
        <Stat label="Recebido no mês" value={brl(recebidoMes)} icon="💰" tone="ok" />
        <Stat label="A receber" value={brl(aReceber)} icon="🧾" tone="gold" />
        <Stat label="Inadimplentes" value={inadimplentes.length} icon="⛔" tone="red" />
        <Stat label="Aptos p/ exame" value={aprovados.filter((a) => a.preExame?.status === 'apto').length} icon="🎖️" tone="ink" />
      </div>

      <div className="grid g2 mt">
        <Card title="⚠️ Avisos">
          {avisos.length === 0 ? (
            <Empty icon="✅">Tudo em ordem por aqui.</Empty>
          ) : (
            avisos.map(([t, to], i) => (
              <Link key={i} to={to} className="alert gold mb" style={{ textDecoration: 'none' }}>
                ⚠️ <div className="grow">{t}</div> →
              </Link>
            ))
          )}
        </Card>

        <Card title="⏳ Cadastros pendentes" actions={<Link className="btn sm ghost" to="alunos">Ver todos</Link>}>
          {pendentes.length === 0 ? (
            <Empty icon="📭">Nenhum cadastro pendente.</Empty>
          ) : (
            pendentes.slice(0, 5).map((a) => (
              <div key={a.id} className="list-item">
                <Avatar src={a.foto} name={a.nome} />
                <div className="grow">
                  <div style={{ fontWeight: 600 }}>{a.nome}</div>
                  <div className="xs muted">{filialNome(db, a.filialId)} · {fmtDate(a.criadoEm)}</div>
                </div>
              </div>
            ))
          )}
        </Card>

        <Card title="📅 Próximos eventos" actions={<Link className="btn sm ghost" to="eventos">Gerenciar</Link>}>
          {proximos.length === 0 ? (
            <Empty icon="🗓️">Nenhum evento futuro.</Empty>
          ) : (
            proximos.map((e) => (
              <div key={e.id} className="list-item">
                <div className="badge red">{fmtDate(e.data)}</div>
                <div className="grow">
                  <div style={{ fontWeight: 600 }}>{e.titulo}</div>
                  <div className="xs muted">{e.local} · {e.confirmados.length} confirmados</div>
                </div>
              </div>
            ))
          )}
        </Card>

        <Card title="🏯 Alunos por filial">
          {db.filiais.map((f) => {
            const n = aprovados.filter((a) => a.filialId === f.id).length;
            const max = Math.max(1, ...db.filiais.map((x) => aprovados.filter((a) => a.filialId === x.id).length));
            return (
              <div key={f.id} style={{ marginBottom: 8 }}>
                <div className="row between small"><span>{f.nome}</span><b>{n}</b></div>
                <div className="meter"><i style={{ width: `${(n / max) * 100}%`, background: 'var(--red)' }} /></div>
              </div>
            );
          })}
        </Card>
      </div>
    </>
  );
}
