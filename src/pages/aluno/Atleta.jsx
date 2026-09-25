import { useState } from 'react';
import { useDB, setDB, notify } from '../../lib/db';
import { fmtDate } from '../../lib/utils';
import { PageHead, Card, Avatar, Faixa, toast, Empty } from '../../components/ui';

export default function Atleta({ user }) {
  const db = useDB();
  const [ok, setOk] = useState(false);
  if (!user.atleta?.ativo) return <Empty icon="🏆">Área exclusiva para atletas convocados.</Empty>;
  const polo = user.atleta.polo || 'Equipe';
  const equipe = db.alunos.filter((a) => a.atleta?.ativo && a.atleta.polo === user.atleta.polo);

  const aceitar = () => {
    setDB((d) => {
      d.alunos.find((a) => a.id === user.id).atleta.termoAceito = new Date().toISOString();
      notify(d, 'admin', 'Termo de atleta assinado', `${user.nome} (${polo})`);
    });
    toast('Termo do atleta assinado.');
  };

  return (
    <>
      <PageHead title="Página do Atleta" sub={`Polo: ${polo}`} />
      {!user.atleta.termoAceito ? (
        <Card title="📜 Regras e diretrizes do atleta" className="mb">
          <p style={{ whiteSpace: 'pre-line' }}>{db.termos.atleta}</p>
          <label className="check mb"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} /> Li e assumo o compromisso de frequência e conduta com a equipe oficial.</label>
          <button className="btn" disabled={!ok} onClick={aceitar}>Assinar termo do atleta</button>
        </Card>
      ) : (
        <div className="alert ok mb">✅ Termo do atleta assinado em {fmtDate(user.atleta.termoAceito)}.</div>
      )}

      <div className="grid g2">
        <Card title={`🏆 ${polo}`}>
          {equipe.map((a) => (
            <div key={a.id} className="list-item">
              <Avatar src={a.foto} name={a.nome} />
              <div className="grow"><div style={{ fontWeight: 600 }}>{a.nome}</div><Faixa idx={a.faixaIdx} /></div>
            </div>
          ))}
        </Card>
        <Card title="📊 Monitoramento online — Fase 2">
          <div className="alert ink">🗂️ Espaço estruturado para fichas e treinos específicos do atleta. Será ativado após o teste piloto.</div>
        </Card>
      </div>
    </>
  );
}
