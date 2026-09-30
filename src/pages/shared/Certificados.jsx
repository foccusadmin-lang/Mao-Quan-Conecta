import { useEffect, useMemo, useState } from 'react';
import { useDB, situacaoAluno, filialNome, professorVeAluno } from '../../lib/db';
import { supabase } from '../../lib/supabase';
import { fmtDate } from '../../lib/utils';
import { PageHead, Card, Avatar, Faixa, Empty, Search, Modal } from '../../components/ui';
import { certificadosDoAluno, CertificadoComAcoes } from '../../components/Certificado';

/** O aluno não lê o cadastro de professores: busca só nome/título para a assinatura */
function useDbComAssinaturas(filialId) {
  const db = useDB();
  const [extra, setExtra] = useState([]);
  useEffect(() => {
    if (!filialId || db.professores.length) return;
    supabase.rpc('mq_assinaturas_professores', { p_filial: filialId }).then(({ data }) => setExtra(Array.isArray(data) ? data : []));
  }, [filialId, db.professores.length]);
  return useMemo(() => (extra.length ? { ...db, professores: [...db.professores, ...extra.filter((p) => !db.professores.some((x) => x.id === p.id))] } : db), [db, extra]);
}

function ListaCertificados({ db, aluno, liberado = true, motivo }) {
  const lista = certificadosDoAluno(db, aluno);
  const [sel, setSel] = useState(null);
  const atual = lista.find((c) => c.id === sel) || lista.at(-1);
  if (!lista.length)
    return <Empty icon="📜">O primeiro certificado é emitido na <b>1ª graduação (faixa Branca)</b>. Graduação atual: {db.config.faixas[aluno.faixaIdx]?.nome || '—'}.</Empty>;
  return (
    <div className="col">
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        {lista.map((c) => (
          <button key={c.id} type="button" className={`btn sm ${c.id === atual.id ? '' : 'ghost'}`} onClick={() => setSel(c.id)} title={`Emitido em ${fmtDate(c.data)}`}>
            {c.ordem}ª · {c.faixa}{c.atual ? ' (atual)' : ''}
          </button>
        ))}
      </div>
      <CertificadoComAcoes key={atual.id} c={atual} liberado={liberado} motivo={motivo} />
    </div>
  );
}

export default function Certificados({ user }) {
  const isAluno = user.role === 'aluno';
  const db = useDbComAssinaturas(isAluno ? user.filialId : null);
  const [q, setQ] = useState('');
  const [filial, setFilial] = useState(user.role === 'admin' ? '' : user.filialId);
  const [aberto, setAberto] = useState(null);

  // ---------- Aluno: os próprios certificados ----------
  if (isAluno) {
    const eu = db.alunos.find((a) => a.id === user.id) || user;
    const fin = situacaoAluno(db, eu);
    return (
      <>
        <PageHead title="Meus Certificados" sub="Um certificado para cada graduação conquistada" />
        {fin.bloqueado && <div className="alert red mb">⛔ Existem mensalidades vencidas. O download dos certificados fica bloqueado até a confirmação do pagamento.</div>}
        <Card>
          <ListaCertificados db={db} aluno={eu} liberado={!fin.bloqueado} motivo="Regularize as mensalidades para baixar o certificado." />
        </Card>
      </>
    );
  }

  // ---------- Professor (suas filiais) e Central (todas) ----------
  const alunos = db.alunos
    .filter((a) => a.status === 'aprovado' && (!filial || a.filialId === filial) && professorVeAluno(db, user, a))
    .filter((a) => (a.nome + ' ' + (a.matricula || '')).toLowerCase().includes(q.toLowerCase()))
    .map((a) => ({ a, n: certificadosDoAluno(db, a).length }))
    .sort((x, y) => x.a.nome.localeCompare(y.a.nome));
  const aluno = aberto && db.alunos.find((a) => a.id === aberto);

  return (
    <>
      <PageHead title="Certificados" sub={user.role === 'admin' ? 'Certificados de graduação de todas as filiais' : `Alunos de ${filialNome(db, user.filialId)}`}>
        <Search value={q} onChange={setQ} placeholder="Nome ou matrícula" />
        {user.role === 'admin' && (
          <select value={filial} onChange={(e) => setFilial(e.target.value)} style={{ maxWidth: 220 }}>
            <option value="">Todas as filiais</option>
            {db.filiais.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        )}
      </PageHead>
      <Card>
        {alunos.length === 0 ? <Empty icon="📜">Nenhum aluno encontrado.</Empty> : alunos.map(({ a, n }) => (
          <div key={a.id} className="list-item" style={{ flexWrap: 'wrap' }}>
            <Avatar src={a.foto} name={a.nome} />
            <div className="grow" style={{ minWidth: 160 }}>
              <div style={{ fontWeight: 600 }}>{a.nome}</div>
              <div className="xs muted">{filialNome(db, a.filialId)} · <Faixa idx={a.faixaIdx} /></div>
            </div>
            <span className={`badge ${n ? 'ok' : ''}`}>{n ? `📜 ${n} certificado(s)` : 'Sem certificado ainda'}</span>
            <button className="btn sm" disabled={!n} onClick={() => setAberto(a.id)}>Ver certificados</button>
          </div>
        ))}
      </Card>
      <Modal open={!!aluno} onClose={() => setAberto(null)} title={`📜 Certificados — ${aluno?.nome || ''}`} wide>
        {aluno && <ListaCertificados db={db} aluno={aluno} />}
      </Modal>
    </>
  );
}
