import { useEffect, useState } from 'react';
import { useDB, setDB, filialNome, professorVeAluno, alunoNaFilial } from '../../lib/db';
import { supabase } from '../../lib/supabase';
import { uid } from '../../lib/utils';
import { PageHead, Card, Modal, Avatar, Empty, Search, toast } from '../../components/ui';
import { ResultadosAtleta, resultadosEmLote, medalhas, periodoResultados } from '../../components/Resultados';

const FILTROS = [['com', 'Com resultados'], ['atletas', 'Atletas'], ['todos', 'Todos os alunos']];

/** Central: resultados importados de quem ainda não tem cadastro — atribuir a um aluno quando ele se cadastrar */
function AguardandoCadastro() {
  const db = useDB();
  const [lista, setLista] = useState(null);
  const [destino, setDestino] = useState({});
  const carregar = () => supabase.from('resultados_pendentes').select('*').order('id').then(({ data }) => setLista(data || []));
  useEffect(() => void carregar(), []);
  if (!lista?.length) return null;
  const alunos = db.alunos.filter((a) => a.status === 'aprovado').sort((a, b) => a.nome.localeCompare(b.nome));
  const atribuir = async (p) => {
    const alvo = destino[p.id];
    if (!alvo) return toast('Escolha o aluno.');
    setDB((d) => {
      const x = d.alunos.find((y) => y.id === alvo);
      if (x) x.resultados = [...(x.resultados || []), ...p.data.itens.map((r) => ({ ...r, id: uid('rs') }))];
    });
    const { error } = await supabase.from('resultados_pendentes').delete().eq('id', p.id);
    if (error) return toast('Resultados copiados, mas não foi possível tirar da lista: ' + error.message);
    toast(`${p.data.itens.length} resultado(s) atribuído(s).`);
    carregar();
  };
  return (
    <Card className="mt" title={`⏳ Aguardando cadastro (${lista.length})`}>
      <p className="xs muted" style={{ marginTop: 0 }}>Resultados de atletas que ainda não têm cadastro no app (ou com nome ambíguo). Quando o aluno estiver cadastrado, escolha-o e clique em Atribuir.</p>
      {lista.map((p) => (
        <div key={p.id} className="list-item" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div className="grow" style={{ minWidth: 180 }}>
            <div style={{ fontWeight: 600 }}>{p.data.nome}</div>
            <div className="xs muted">{p.data.itens.length} resultado(s) · {periodoResultados(p.data.itens)}</div>
          </div>
          <select value={destino[p.id] || ''} onChange={(e) => setDestino({ ...destino, [p.id]: e.target.value })} style={{ maxWidth: 240 }}>
            <option value="">Escolher aluno…</option>
            {alunos.map((a) => <option key={a.id} value={a.id}>{a.nome} — {filialNome(db, a.filialId)}</option>)}
          </select>
          <button className="btn sm" onClick={() => atribuir(p)}>Atribuir</button>
        </div>
      ))}
    </Card>
  );
}

/** Professor / Central: Relação Consolidada de Resultados de cada aluno ou de todos de uma vez */
export default function ResultadosAtletas({ user }) {
  const db = useDB();
  const isAdmin = user.role === 'admin';
  const [filial, setFilial] = useState(isAdmin ? '' : user.filialId);
  const [filtro, setFiltro] = useState('com');
  const [q, setQ] = useState('');
  const [marcados, setMarcados] = useState(null); // null = todos da lista
  const [aberto, setAberto] = useState(null);
  const [gerando, setGerando] = useState('');

  const filialAtual = isAdmin ? filial : user.filialId;
  const lista = db.alunos
    .filter((a) => a.status === 'aprovado' && (filtro === 'todos' || (filtro === 'atletas' ? a.atleta?.ativo : a.resultados?.length)) && (!filialAtual || alunoNaFilial(a, filialAtual)) && professorVeAluno(db, user, a))
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
      await resultadosEmLote(sel, formato, (i, n) => setGerando(`Gerando ${i} de ${n}…`));
    } catch (e) {
      toast('Falha ao gerar: ' + e.message);
    } finally {
      setGerando('');
    }
  };
  const al = aberto && db.alunos.find((a) => a.id === aberto);
  const total = lista.reduce((s, a) => s + (a.resultados?.length || 0), 0);

  return (
    <>
      <PageHead title="Resultados dos Atletas" sub={`Relação Consolidada de Resultados${filialAtual ? ' · ' + filialNome(db, filialAtual) : ''}`}>
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
          <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={filtro} onChange={(e) => (setFiltro(e.target.value), setMarcados(null))} style={{ maxWidth: 180 }}>
              {FILTROS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
            </select>
            <label className="check small">
              <input type="checkbox" checked={sel.length === lista.length && lista.length > 0} onChange={(e) => setMarcados(e.target.checked ? null : new Set())} /> Selecionar todos ({sel.length}/{lista.length})
            </label>
            <span className="xs muted">{total} resultado(s) na lista</span>
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
        {lista.length === 0 && <Empty icon="🏅">Nenhum aluno nesta lista.</Empty>}
        {lista.map((a) => {
          const m = medalhas(a.resultados || []);
          return (
            <div key={a.id} className="list-item" style={{ gap: 10 }}>
              <input type="checkbox" checked={!marcados || marcados.has(a.id)} onChange={() => alterna(a.id)} aria-label={`Selecionar ${a.nome}`} />
              <Avatar src={a.foto} name={a.nome} />
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{a.nome} {a.atleta?.ativo && <span title="Atleta">🏆</span>}</div>
                <div className="xs muted">
                  {isAdmin && !filialAtual ? filialNome(db, a.filialId) + ' · ' : ''}
                  {a.resultados?.length ? `🥇 ${m.ouro} · 🥈 ${m.prata} · 🥉 ${m.bronze} · ${a.resultados.length} resultado(s) · ${periodoResultados(a.resultados)}` : 'Sem resultados registrados'}
                </div>
                {(!a.rg || !a.cpf) && <div className="xs" style={{ color: '#b45309' }}>⚠️ {!a.rg && !a.cpf ? 'RG e CPF' : !a.rg ? 'RG' : 'CPF'} não informado no cadastro</div>}
              </div>
              <button className="btn sm dark" onClick={() => setAberto(a.id)}>Abrir</button>
            </div>
          );
        })}
      </Card>

      {isAdmin && <AguardandoCadastro />}

      <Modal open={!!al} onClose={() => setAberto(null)} title={al ? `Resultados — ${al.nome}` : ''} wide>
        {al && <ResultadosAtleta aluno={al} todos={sel.some((x) => x.id === al.id) ? sel : [al, ...sel]} />}
      </Modal>
    </>
  );
}
