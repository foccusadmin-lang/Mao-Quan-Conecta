import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDB, situacaoAluno } from '../../lib/db';
import { PageHead, Card, Modal, Faixa, Empty } from '../../components/ui';
import { MaterialView, TIPOS_MAT } from '../shared/Materiais';

export default function Conteudo({ user }) {
  const db = useDB();
  const [ver, setVer] = useState(null);
  const fin = situacaoAluno(db, user);
  const doAluno = db.materiais.filter((m) => m.publico === 'aluno');
  const atuais = doAluno.filter((m) => m.faixaIdx === user.faixaIdx);
  const proximaIdx = user.faixaIdx + 1;
  const proximos = doAluno.filter((m) => m.faixaIdx === proximaIdx);

  return (
    <>
      <PageHead title="Meu Conteúdo" sub="Taolu, bases e teoria do seu nível atual">
        <span className="badge" style={{ padding: '6px 12px' }}><Faixa idx={user.faixaIdx} /></span>
      </PageHead>

      {fin.bloqueado && (
        <Link to="/aluno/pagamentos" className="alert red mb" style={{ textDecoration: 'none' }}>
          ⛔ <div className="grow">Conteúdo bloqueado por inadimplência. Regularize para liberar os vídeos novamente.</div> Pagar →
        </Link>
      )}

      {atuais.length === 0 && <Empty icon="🎬">Ainda não há material publicado para a sua faixa.</Empty>}
      <div className="grid g3">
        {atuais.map((m) => (
          <Card key={m.id} className={fin.bloqueado ? 'locked' : ''}>
            <div className="mat">
              <div className="ic">{fin.bloqueado ? '🔒' : TIPOS_MAT[m.tipo]?.[0]}</div>
              <div className="grow">
                <div style={{ fontWeight: 700 }}>{m.titulo}</div>
                <div className="row xs" style={{ gap: 6, marginTop: 4 }}>
                  <span className="badge">{TIPOS_MAT[m.tipo]?.[1]}</span>
                  {m.avancado && <span className="badge gold">Avançado</span>}
                </div>
              </div>
            </div>
            <div className="row end mt">
              <button className="btn sm" disabled={fin.bloqueado} onClick={() => setVer(m)}>▶ Acessar</button>
            </div>
          </Card>
        ))}
      </div>

      {proximaIdx < db.config.faixas.length && (
        <>
          <h3 className="mt">🔒 Próximo nível — <Faixa idx={proximaIdx} /></h3>
          <p className="small muted">Liberado automaticamente após a aprovação oficial no exame de graduação.</p>
          <div className="grid g3">
            {proximos.map((m) => (
              <Card key={m.id} className="locked">
                <div className="mat"><div className="ic">🔒</div><div style={{ fontWeight: 700 }}>{m.titulo}</div></div>
              </Card>
            ))}
            {proximos.length === 0 && <Card className="locked"><div className="mat"><div className="ic">🔒</div><div>Conteúdo da próxima faixa</div></div></Card>}
          </div>
        </>
      )}
      <Modal open={!!ver} onClose={() => setVer(null)} title={ver?.titulo} wide>{ver && <MaterialView m={ver} />}</Modal>
    </>
  );
}
