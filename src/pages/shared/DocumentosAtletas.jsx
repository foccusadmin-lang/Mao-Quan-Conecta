import { useState } from 'react';
import { useDB, filialNome, professorVeAluno } from '../../lib/db';
import { progressoDocumentos } from '../../lib/documentos';
import { PageHead, Card, Avatar, Faixa, Empty, Search, Modal } from '../../components/ui';
import { DocumentosAtleta } from '../../components/DocumentosAtleta';

/** Professor (suas filiais) e Central (todas): documentos dos atletas para inscrições em competições */
export default function DocumentosAtletas({ user }) {
  const db = useDB();
  const isAdmin = user.role === 'admin';
  const [q, setQ] = useState('');
  const [filial, setFilial] = useState(isAdmin ? '' : user.filialId);
  const [so, setSo] = useState('atletas'); // atletas | todos
  const [aberto, setAberto] = useState(null);

  const lista = db.alunos
    .filter((a) => a.status === 'aprovado' && (!filial || a.filialId === filial) && professorVeAluno(db, user, a))
    .filter((a) => so === 'todos' || a.atleta?.ativo || a.documentos?.length)
    .filter((a) => (a.nome + ' ' + (a.matricula || '')).toLowerCase().includes(q.toLowerCase()))
    .sort((x, y) => x.nome.localeCompare(y.nome));
  const aluno = aberto && db.alunos.find((a) => a.id === aberto);

  return (
    <>
      <PageHead title="Documentos de Atletas" sub="RG/CNH, passaporte, termos, formulários e arquivos FPKF/CBKW para inscrições em competições">
        <Search value={q} onChange={setQ} placeholder="Nome ou matrícula" />
        {isAdmin && (
          <select value={filial} onChange={(e) => setFilial(e.target.value)} style={{ maxWidth: 220 }}>
            <option value="">Todas as filiais</option>
            {db.filiais.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        )}
        <select value={so} onChange={(e) => setSo(e.target.value)} style={{ maxWidth: 200 }}>
          <option value="atletas">Atletas de competição</option>
          <option value="todos">Todos os alunos</option>
        </select>
      </PageHead>
      <Card>
        {lista.length === 0 ? (
          <Empty icon="📁">Nenhum atleta encontrado. Atletas de competição são os alunos marcados como “Atleta” na ficha.</Empty>
        ) : (
          lista.map((a) => {
            const p = progressoDocumentos(a);
            const completo = p.feitos === p.total;
            return (
              <div key={a.id} className="list-item" style={{ flexWrap: 'wrap' }}>
                <Avatar src={a.foto} name={a.nome} />
                <div className="grow" style={{ minWidth: 160 }}>
                  <div style={{ fontWeight: 600 }}>{a.nome} {a.atleta?.ativo && <span title="Atleta de competição">🏆</span>}</div>
                  <div className="xs muted">{filialNome(db, a.filialId)} · <Faixa idx={a.faixaIdx} /></div>
                </div>
                <span className={`badge ${completo ? 'ok' : p.feitos ? 'warn' : ''}`}>📁 {p.feitos}/{p.total}{p.extras ? ` + ${p.extras} FPKF/CBKW` : ''}</span>
                <button className="btn sm" onClick={() => setAberto(a.id)}>Abrir documentos</button>
              </div>
            );
          })
        )}
      </Card>
      <Modal open={!!aluno} onClose={() => setAberto(null)} title={`📁 Documentos — ${aluno?.nome || ''}`} wide>
        {aluno && <DocumentosAtleta aluno={aluno} user={user} />}
      </Modal>
    </>
  );
}
