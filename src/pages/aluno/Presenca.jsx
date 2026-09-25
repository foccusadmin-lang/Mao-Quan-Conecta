import { useDB, setDB, frequencia } from '../../lib/db';
import { uid, todayISO, fmtDate } from '../../lib/utils';
import { PageHead, Card, toast } from '../../components/ui';
import { AttendanceChart } from '../../components/shared';

export function MarcarPresenca({ user }) {
  const db = useDB();
  const hoje = todayISO();
  const reg = db.presencas.find((p) => p.alunoId === user.id && p.data === hoje);
  const marcar = () => {
    setDB((d) => d.presencas.push({ id: uid('pz'), alunoId: user.id, filialId: user.filialId, data: hoje, origem: 'aluno', confirmada: false }));
    toast('Presença registrada! Aguarde a confirmação do Laoshi.');
  };
  return (
    <Card title="✅ Presença de hoje">
      {reg ? (
        <div className={`alert ${reg.confirmada ? 'ok' : 'gold'}`}>{reg.confirmada ? '✔ Presença confirmada pelo professor.' : '⏳ Presença marcada — aguardando confirmação na chamada.'}</div>
      ) : (
        <button className="btn block" style={{ minHeight: 54, fontSize: 16 }} onClick={marcar}>🥋 Estou no treino — marcar presença</button>
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
              <div className="grow">{fmtDate(p.data)}</div>
              <span className={`badge ${p.confirmada ? 'ok' : 'warn'}`}>{p.confirmada ? 'Confirmada' : 'Aguardando'}</span>
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}
