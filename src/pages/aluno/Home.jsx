import { Link } from 'react-router-dom';
import { useDB, situacaoAluno, frequencia, filialNome } from '../../lib/db';
import { brl, fmtDate, todayISO } from '../../lib/utils';
import { Card, Faixa, Avatar, Empty } from '../../components/ui';
import { InvestButton, SponsorShare } from '../../components/shared';
import { MarcarPresenca } from './Presenca';

export default function AlunoHome({ user }) {
  const db = useDB();
  const fin = situacaoAluno(db, user);
  const fr = frequencia(db, user);
  const hoje = todayISO();
  const eventos = db.eventos.filter((e) => e.publico === 'todos' && e.data >= hoje).sort((a, b) => a.data.localeCompare(b.data)).slice(0, 3);
  const materiais = db.materiais.filter((m) => m.publico === 'aluno' && m.faixaIdx === user.faixaIdx).length;
  const prof = db.professores.find((p) => p.id === db.filiais.find((f) => f.id === user.filialId)?.professorId);

  return (
    <>
      <div className="hero mb">
        <div className="row">
          <Avatar src={user.foto} name={user.nome} size="lg" />
          <div className="grow">
            <h2 style={{ margin: 0 }}>Olá, {user.nome.split(' ')[0]}!</h2>
            <div className="row small" style={{ opacity: 0.9, marginTop: 4 }}>
              <span className="badge" style={{ background: '#fff' }}><Faixa idx={user.faixaIdx} /></span>
              <span>{filialNome(db, user.filialId)}</span>
              {prof && <span>· {prof.titulo} {prof.nome}</span>}
            </div>
          </div>
        </div>
      </div>

      {fin.bloqueado && (
        <Link to="pagamentos" className="alert red mb" style={{ textDecoration: 'none' }}>
          ⛔ <div className="grow"><b>Acesso restrito por inadimplência.</b> Material didático e inscrição em exames estão suspensos até a confirmação do pagamento.</div> Pagar →
        </Link>
      )}
      {!fin.bloqueado && fin.emAberto.length > 0 && (
        <Link to="pagamentos" className="alert gold mb" style={{ textDecoration: 'none' }}>
          🧾 <div className="grow">{fin.emAberto[0].descricao} — {brl(fin.emAberto[0].valor)} · vence em {fmtDate(fin.emAberto[0].vencimento)}</div> →
        </Link>
      )}

      <div className="grid g2">
        <MarcarPresenca user={user} />
        <Card title="📈 Minha frequência">
          <div className="row between"><span>Últimos 90 dias</span><b>{fr.pct}%</b></div>
          <div className={`meter ${fr.ok ? '' : 'bad'}`} style={{ margin: '8px 0' }}><i style={{ width: fr.pct + '%' }} /></div>
          <div className="small muted">Mínimo para exame: {fr.min}% · {fr.presentes} presenças · {fr.faltas} faltas</div>
          {user.preExame && <div className={`alert ${user.preExame.status === 'apto' ? 'ok' : 'gold'} mt small`}>{user.preExame.status === 'apto' ? '✅ Você está APTO para o próximo exame!' : '💪 Seu professor indicou reforço antes do exame.'}</div>}
        </Card>
        <Card title="🎬 Meu conteúdo" actions={<Link to="conteudo" className="btn sm ghost">Abrir</Link>}>
          <p style={{ margin: 0 }}>{materiais} materiais liberados para a sua faixa.</p>
        </Card>
        <Card title="📅 Próximos eventos" actions={<Link to="eventos" className="btn sm ghost">Ver</Link>}>
          {eventos.length === 0 ? <Empty icon="🗓️">Nenhum evento.</Empty> : eventos.map((e) => (
            <div key={e.id} className="list-item"><span className="badge red">{fmtDate(e.data)}</span><div className="grow" style={{ fontWeight: 600 }}>{e.titulo}</div></div>
          ))}
        </Card>
      </div>
      <div className="row mt">
        <InvestButton />
        {user.atleta?.ativo && <SponsorShare nome={`Atleta ${user.nome}`} />}
      </div>
    </>
  );
}
