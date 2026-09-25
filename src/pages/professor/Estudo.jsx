import { useState } from 'react';
import { useDB, professorEmDia } from '../../lib/db';
import { PageHead, Card, Modal, Faixa, Empty } from '../../components/ui';
import { MaterialView, TIPOS_MAT } from '../shared/Materiais';
import { Institucional } from '../../components/shared';

export default function Estudo({ user }) {
  const db = useDB();
  const [ver, setVer] = useState(null);
  const emDia = professorEmDia(user);
  // Professor acessa todo o acervo: seu nível atual e superiores, além de capacitações exclusivas
  const rank = (m) => (m.publico === 'professor' ? 0 : 1);
  const lista = [...db.materiais].sort((a, b) => rank(a) - rank(b) || a.faixaIdx - b.faixaIdx);

  return (
    <>
      <PageHead title="Estudo Próprio" sub="Acervo histórico, materiais teóricos e capacitações técnicas" />
      {!emDia && <div className="alert red mb">⛔ Acervo bloqueado: regularize a filiação / tarifa de manutenção.</div>}
      <div className="grid g3">
        {lista.map((m) => (
          <Card key={m.id} className={emDia ? '' : 'locked'}>
            <div className="mat">
              <div className="ic">{emDia ? TIPOS_MAT[m.tipo]?.[0] : '🔒'}</div>
              <div className="grow">
                <div style={{ fontWeight: 700 }}>{m.titulo}</div>
                <div className="row xs" style={{ gap: 6, marginTop: 4 }}>
                  <Faixa idx={m.faixaIdx} />
                  {m.publico === 'professor' && <span className="badge ink">Capacitação</span>}
                </div>
              </div>
            </div>
            <div className="row end mt"><button className="btn sm dark" disabled={!emDia} onClick={() => setVer(m)}>Estudar</button></div>
          </Card>
        ))}
      </div>
      {lista.length === 0 && <Empty icon="📚">Acervo vazio.</Empty>}
      <h3 className="mt">Institucional</h3>
      <Institucional />
      <Modal open={!!ver} onClose={() => setVer(null)} title={ver?.titulo} wide>{ver && <MaterialView m={ver} />}</Modal>
    </>
  );
}
