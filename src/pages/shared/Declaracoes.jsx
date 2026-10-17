import { useState } from 'react';
import { useDB, filialNome, professorVeAluno, alunoNaFilial } from '../../lib/db';
import { PageHead, Card, Modal, Avatar, Empty, Search, toast } from '../../components/ui';
import { DeclaracaoAtleta, declaracoesEmLote, dadosDeclaracao } from '../../components/Declaracao';

/** Professor / Central: declarações da Associação (FPKF / CBKW) de cada aluno ou de todos de uma vez */
export default function Declaracoes({ user }) {
  const db = useDB();
  const isAdmin = user.role === 'admin';
  const [filial, setFilial] = useState(isAdmin ? '' : user.filialId);
  const [soAtletas, setSoAtletas] = useState(true);
  const [q, setQ] = useState('');
  const [marcados, setMarcados] = useState(null); // null = todos da lista
  const [aberto, setAberto] = useState(null);
  const [gerando, setGerando] = useState('');

  const filialAtual = isAdmin ? filial : user.filialId;
  const lista = db.alunos
    .filter((a) => a.status === 'aprovado' && (!soAtletas || a.atleta?.ativo) && (!filialAtual || alunoNaFilial(a, filialAtual)) && professorVeAluno(db, user, a))
    .filter((a) => (a.nome + ' ' + (a.matricula || '')).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.nome.localeCompare(b.nome));
  const sel = marcados ? lista.filter((a) => marcados.has(a.id)) : lista;
  const alterna = (id) => {
    const s = new Set(marcados || lista.map((a) => a.id));
    s.has(id) ? s.delete(id) : s.add(id);
    setMarcados(s);
  };

  const lote = async (formato) => {
    if (!sel.length) return toast('Selecione pelo menos um aluno.');
    setGerando('Preparando…');
    try {
      await declaracoesEmLote(db, sel, formato, (i, n) => setGerando(`Gerando ${i} de ${n}…`));
    } catch (e) {
      toast('Falha ao gerar: ' + e.message);
    } finally {
      setGerando('');
    }
  };

  const al = aberto && db.alunos.find((a) => a.id === aberto);

  return (
    <>
      <PageHead title="Declarações" sub={`Declaração da Associação (FPKF / CBKW)${filialAtual ? ' · ' + filialNome(db, filialAtual) : ''}`}>
        <Search value={q} onChange={setQ} placeholder="Buscar aluno" />
        {isAdmin && (
          <select value={filial} onChange={(e) => (setFilial(e.target.value), setMarcados(null))} style={{ maxWidth: 220 }}>
            <option value="">Todas as filiais</option>
            {db.filiais.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        )}
      </PageHead>

      <Card>
        <div className="row between mb" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
            <label className="check small"><input type="checkbox" checked={soAtletas} onChange={(e) => (setSoAtletas(e.target.checked), setMarcados(null))} /> Somente atletas</label>
            <label className="check small">
              <input type="checkbox" checked={sel.length === lista.length && lista.length > 0} onChange={(e) => setMarcados(e.target.checked ? null : new Set())} /> Selecionar todos ({sel.length}/{lista.length})
            </label>
          </div>
          <div className="row" style={{ gap: 6 }}>
            {gerando ? (
              <span className="small muted">⏳ {gerando}</span>
            ) : (
              <>
                <button className="btn sm" disabled={!sel.length} onClick={() => lote('pdf')}>⬇ PDF dos selecionados ({sel.length})</button>
                <button className="btn sm ghost" disabled={!sel.length} onClick={() => lote('print')}>🖨 Imprimir selecionados</button>
              </>
            )}
          </div>
        </div>
        {lista.length === 0 && <Empty icon="📄">Nenhum aluno{soAtletas ? ' atleta' : ''} encontrado.</Empty>}
        {lista.map((a) => {
          const d = dadosDeclaracao(db, a);
          const falta = [!d.rg && 'RG', !d.cpf && 'CPF', !d.modalidade && 'modalidade', !d.horarios.length && 'horários'].filter(Boolean);
          return (
            <div key={a.id} className="list-item" style={{ gap: 10 }}>
              <input type="checkbox" checked={!marcados || marcados.has(a.id)} onChange={() => alterna(a.id)} aria-label={`Selecionar ${a.nome}`} />
              <Avatar src={a.foto} name={a.nome} />
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{a.nome} {a.atleta?.ativo && <span title="Atleta">🏆</span>}</div>
                <div className="xs muted">
                  {isAdmin && !filialAtual ? filialNome(db, a.filialId) + ' · ' : ''}
                  {d.modalidade || 'sem modalidade'}
                  {a.declaracao && ' · ✏️ editada'}
                </div>
                {falta.length > 0 && <div className="xs" style={{ color: '#b45309' }}>⚠️ Falta: {falta.join(', ')}</div>}
              </div>
              <button className="btn sm dark" onClick={() => setAberto(a.id)}>Abrir</button>
            </div>
          );
        })}
      </Card>

      <Modal open={!!al} onClose={() => setAberto(null)} title={al ? `Declaração — ${al.nome}` : ''} wide>
        {al && <DeclaracaoAtleta aluno={al} todos={sel.some((x) => x.id === al.id) ? sel : [al, ...sel]} />}
      </Modal>
    </>
  );
}
