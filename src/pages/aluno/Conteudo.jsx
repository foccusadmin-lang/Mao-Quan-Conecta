import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDB, situacaoAluno } from '../../lib/db';
import { PageHead, Card, Modal, Faixa, Empty, NiveisModalidade } from '../../components/ui';
import { MaterialView, TIPOS_MAT, materialPago, materialLiberado, pagamentoMaterial, LiberarMaterial } from '../shared/Materiais';
import { brl } from '../../lib/utils';

export default function Conteudo({ user }) {
  const db = useDB();
  const [ver, setVer] = useState(null);
  const [liberar, setLiberar] = useState(null);
  const fin = situacaoAluno(db, user);
  const doAluno = db.materiais.filter((m) => m.publico === 'aluno');
  const atuais = doAluno.filter((m) => m.faixaIdx === user.faixaIdx);
  const proximaIdx = user.faixaIdx + 1;
  const proximos = doAluno.filter((m) => m.faixaIdx === proximaIdx);
  // Revisão: todo o conteúdo das faixas anteriores continua liberado (da mais recente para a Neutra)
  const anteriores = [];
  for (let i = user.faixaIdx - 1; i >= 0; i--) {
    const ms = doAluno.filter((m) => m.faixaIdx === i);
    if (ms.length) anteriores.push([i, ms]);
  }
  const [faixaRevisao, setFaixaRevisao] = useState('');
  const revisao = anteriores.filter(([i]) => faixaRevisao === '' || i === +faixaRevisao);

  const cartao = (m) => (
    <Card key={m.id} className={fin.bloqueado ? 'locked' : ''}>
      <div className="mat">
        <div className="ic">{fin.bloqueado ? '🔒' : TIPOS_MAT[m.tipo]?.[0]}</div>
        <div className="grow">
          <div style={{ fontWeight: 700 }}>{m.titulo}</div>
          <div className="row xs" style={{ gap: 6, marginTop: 4 }}>
            <span className="badge">{TIPOS_MAT[m.tipo]?.[1]}</span>
            {m.avancado && <span className="badge gold">Avançado</span>}
            {materialPago(m) && !materialLiberado(db, m, user) && (
              <span className="badge gold">{pagamentoMaterial(db, m, user.id)?.status === 'pendente' ? '⏳ Aguardando pagamento' : '💰 ' + brl(+m.valor)}</span>
            )}
          </div>
        </div>
      </div>
      <div className="row end mt">
        {materialLiberado(db, m, user) ? (
          <button className="btn sm" disabled={fin.bloqueado} onClick={() => setVer(m)}>▶ Acessar</button>
        ) : (
          <button className="btn sm gold" disabled={fin.bloqueado} onClick={() => setLiberar(m)}>🔓 Liberar · {brl(+m.valor)}</button>
        )}
      </div>
    </Card>
  );

  return (
    <>
      <PageHead title="Meu Conteúdo" sub="Taolu, bases e teoria do seu nível atual e de todas as faixas anteriores">
        <span className="badge" style={{ padding: '6px 12px' }}><Faixa idx={user.faixaIdx} /></span>{" "}<NiveisModalidade aluno={user} />
      </PageHead>

      {fin.bloqueado && (
        <Link to="/aluno/pagamentos" className="alert red mb" style={{ textDecoration: 'none' }}>
          ⛔ <div className="grow">Conteúdo bloqueado por inadimplência. Regularize para liberar os vídeos novamente.</div> Pagar →
        </Link>
      )}

      {atuais.length === 0 && <Empty icon="🎬">Ainda não há material publicado para a sua faixa.</Empty>}
      <div className="grid g3">{atuais.map(cartao)}</div>

      {anteriores.length > 0 && (
        <>
          <div className="row between mt" style={{ alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>📚 Revisão — faixas anteriores</h3>
            {anteriores.length > 1 && (
              <select value={faixaRevisao} onChange={(e) => setFaixaRevisao(e.target.value)} style={{ maxWidth: 240 }}>
                <option value="">Todas as faixas anteriores</option>
                {anteriores.map(([i]) => <option key={i} value={i}>{db.config.faixas[i]?.nome}</option>)}
              </select>
            )}
          </div>
          <p className="small muted">Todo o conteúdo que você já estudou continua disponível para revisar.</p>
          {revisao.map(([i, ms]) => (
            <div key={i} className="mb">
              <div className="small mb" style={{ fontWeight: 600 }}><Faixa idx={i} /></div>
              <div className="grid g3">{ms.map(cartao)}</div>
            </div>
          ))}
        </>
      )}

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
      {liberar && <LiberarMaterial m={liberar} user={user} onClose={() => setLiberar(null)} />}
    </>
  );
}
