import { useState } from 'react';
import { useDB, responsaveisFilial } from '../../lib/db';
import { Card, Field } from '../../components/ui';
import Presenca from '../professor/Presenca';

const lerLocal = (k) => {
  try {
    return localStorage.getItem(k) || '';
  } catch {
    return '';
  }
};
const gravarLocal = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch {}
};

/** Central: chamada de qualquer filial — de todos os alunos ou como um professor da equipe (só as modalidades dele) */
export default function ChamadaAdmin({ user }) {
  const db = useDB();
  const [filialId, setFilialId] = useState(() => lerLocal('mq-chamada-filial') || db.filiais.find((f) => f.ativa)?.id || db.filiais[0]?.id || '');
  const [profId, setProfId] = useState('');
  const filial = db.filiais.find((f) => f.id === filialId);
  const equipe = responsaveisFilial(filial)
    .map((r) => ({ ...r, prof: db.professores.find((p) => p.id === r.professorId) }))
    .filter((r) => r.prof);
  const prof = equipe.find((r) => r.professorId === profId)?.prof;

  // Sem professor escolhido: a Central vê todos os alunos da filial. Com professor: a chamada dele (modalidades e horários dele)
  const comoUsuario = prof
    ? { ...prof, role: 'professor', filialId, filialPrincipal: prof.filialId, filiais: [filialId] }
    : { ...user, filialId };

  return (
    <>
      <Card className="mb">
        <div className="form-grid">
          <Field label="Filial">
            <select
              value={filialId}
              onChange={(e) => {
                setFilialId(e.target.value);
                setProfId('');
                gravarLocal('mq-chamada-filial', e.target.value);
              }}
            >
              {db.filiais.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </Field>
          <Field label="Chamada de" hint="Escolha um professor para ver só os alunos das modalidades e horários dele">
            <select value={profId} onChange={(e) => setProfId(e.target.value)}>
              <option value="">Todos os alunos da filial</option>
              {equipe.map((r) => (
                <option key={r.professorId} value={r.professorId}>
                  {r.prof.titulo} {r.prof.nome}{r.departamentos?.length ? ` — ${r.departamentos.join(', ')}` : ''}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Card>
      {filial ? <Presenca key={filialId + profId} user={comoUsuario} /> : <p className="muted">Nenhuma filial cadastrada.</p>}
    </>
  );
}
