import { useDB, setDB, frequencia, filiaisDoAluno, filialNome } from '../../lib/db';
import { uid, todayISO, fmtDate } from '../../lib/utils';
import { PageHead, Card, toast } from '../../components/ui';
import { AttendanceChart } from '../../components/shared';

export function MarcarPresenca({ user }) {
  const db = useDB();
  const hoje = todayISO();
  const filiais = filiaisDoAluno(user);
  const varias = filiais.length > 1;
  const regs = db.presencas.filter((p) => p.alunoId === user.id && p.data === hoje);
  const confirmada = regs.find((p) => p.confirmada);
  const pendente = regs.find((p) => !p.confirmada);
  const reg = confirmada || pendente;

  // Treina em mais de uma filial: marca na filial onde está hoje (e pode trocar enquanto o professor não confirmar)
  const marcar = (filialId) => {
    setDB((d) => {
      d.presencas = d.presencas.filter((p) => !(p.alunoId === user.id && p.data === hoje && !p.confirmada));
      d.presencas.push({ id: uid('pz'), alunoId: user.id, filialId, data: hoje, origem: 'aluno', confirmada: false });
    });
    toast(`Presença registrada${varias ? ' em ' + filialNome(db, filialId) : ''}! Aguarde a confirmação do Laoshi.`);
  };
  const onde = (p) => (varias ? ` (${filialNome(db, p.filialId)})` : '');

  return (
    <Card title="✅ Presença de hoje">
      {reg && (
        <div className={`alert ${reg.confirmada ? 'ok' : 'gold'}`}>
          {reg.confirmada ? `✔ Presença confirmada pelo professor${onde(reg)}.` : `⏳ Presença marcada${onde(reg)} — aguardando confirmação na chamada.`}
        </div>
      )}
      {!reg && !varias && (
        <button className="btn block" style={{ minHeight: 54, fontSize: 16 }} onClick={() => marcar(user.filialId)}>🥋 Estou no treino — marcar presença</button>
      )}
      {!confirmada && varias && (
        <div className="col" style={{ gap: 8, marginTop: reg ? 10 : 0 }}>
          <div className="small muted">{pendente ? 'Treinando em outra filial hoje? Troque aqui:' : 'Em qual filial você está treinando hoje?'}</div>
          {filiais.filter((fid) => fid !== pendente?.filialId).map((fid) => (
            <button key={fid} className={`btn block ${pendente ? 'ghost' : ''}`} style={{ minHeight: pendente ? 44 : 54, fontSize: pendente ? 14 : 16 }} onClick={() => marcar(fid)}>
              {pendente ? '🔁 Trocar para' : '🥋 Estou no treino —'} {filialNome(db, fid)}
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function AlunoPresenca({ user }) {
  const db = useDB();
  const fr = frequencia(db, user);
  const ultimas = db.presencas.filter((p) => p.alunoId === user.id).sort((a, b) => b.data.localeCompare(a.data)).slice(0, 20);
  return (
    <>
      <PageHead title="Presença" sub="Registro diário integrado à chamada do professor" />
      <div className="grid g2">
        <MarcarPresenca user={user} />
        <Card title={`Frequência: ${fr.pct}%`}>
          <div className={`meter ${fr.ok ? '' : 'bad'}`}><i style={{ width: fr.pct + '%' }} /></div>
          <p className="small muted">Mínimo exigido para o exame de graduação: {fr.min}% e no máximo {fr.maxFaltas} faltas em 90 dias. Você tem {fr.faltas}.</p>
        </Card>
        <Card title="Presenças por mês"><AttendanceChart alunoId={user.id} /></Card>
        <Card title="Últimos registros">
          {ultimas.length === 0 && <p className="muted">Sem registros.</p>}
          {ultimas.map((p) => (
            <div key={p.id} className="list-item">
              <div className="grow">{fmtDate(p.data)}{filiaisDoAluno(user).length > 1 && <span className="xs muted"> · {filialNome(db, p.filialId)}</span>}</div>
              <span className={`badge ${p.confirmada ? 'ok' : 'warn'}`}>{p.confirmada ? 'Confirmada' : 'Aguardando'}</span>
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}
