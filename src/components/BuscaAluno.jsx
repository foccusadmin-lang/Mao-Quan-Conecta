import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDB, filialNome, professorVeAluno, setFilialAtiva } from '../lib/db';
import { Avatar, Faixa } from './ui';

const norm = (s = '') => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const soDigitos = (s = '') => String(s).replace(/\D/g, '');

/** Busca de aluno no topo de todas as telas (professor e Central): nome, matrícula, CPF ou e-mail → abre a ficha */
export function BuscaAluno({ user }) {
  const db = useDB();
  const navegar = useNavigate();
  const [q, setQ] = useState('');
  const [aberto, setAberto] = useState(false);
  const [sel, setSel] = useState(0);
  const caixa = useRef(null);

  useEffect(() => {
    const fora = (e) => caixa.current && !caixa.current.contains(e.target) && setAberto(false);
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, []);

  const termo = norm(q.trim());
  const digitos = soDigitos(q);
  const minhas = user.role === 'admin' ? null : new Set(user.filiais?.length ? user.filiais : [user.filialId]);
  const resultados =
    termo.length < 2
      ? []
      : db.alunos
          .filter((a) => !minhas || minhas.has(a.filialId))
          .filter((a) => user.role === 'admin' || a.filialId !== user.filialId || professorVeAluno(db, user, a))
          .filter((a) => norm(`${a.nome} ${a.matricula || ''} ${a.email || ''}`).includes(termo) || (digitos.length >= 3 && soDigitos(`${a.cpf || ''} ${a.rg || ''} ${a.telefone || ''}`).includes(digitos)))
          .sort((x, y) => (norm(x.nome).startsWith(termo) ? -1 : 0) - (norm(y.nome).startsWith(termo) ? -1 : 0) || x.nome.localeCompare(y.nome))
          .slice(0, 8);

  const abrir = (a) => {
    if (user.role === 'professor' && a.filialId !== user.filialId) setFilialAtiva(a.filialId); // aluno de outra filial dele
    navegar(`/${user.role}/alunos?aluno=${a.id}`);
    setQ('');
    setAberto(false);
  };

  return (
    <div ref={caixa} className="busca-aluno">
      <input
        type="search"
        value={q}
        placeholder="🔎 Buscar aluno"
        aria-label="Buscar aluno por nome, matrícula, CPF ou e-mail"
        onChange={(e) => (setQ(e.target.value), setAberto(true), setSel(0))}
        onFocus={() => setAberto(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') (e.preventDefault(), setSel((s) => Math.min(s + 1, resultados.length - 1)));
          else if (e.key === 'ArrowUp') (e.preventDefault(), setSel((s) => Math.max(s - 1, 0)));
          else if (e.key === 'Enter' && resultados[sel]) abrir(resultados[sel]);
          else if (e.key === 'Escape') setAberto(false);
        }}
      />
      {aberto && termo.length >= 2 && (
        <div className="busca-aluno-lista" role="listbox">
          {resultados.length === 0 ? (
            <div className="small muted" style={{ padding: 12 }}>Nenhum aluno encontrado.</div>
          ) : (
            resultados.map((a, i) => (
              <button key={a.id} type="button" role="option" aria-selected={i === sel} className={`busca-aluno-item ${i === sel ? 'sel' : ''}`} onMouseEnter={() => setSel(i)} onClick={() => abrir(a)}>
                <Avatar src={a.foto} name={a.nome} />
                <span className="grow" style={{ minWidth: 0, textAlign: 'left' }}>
                  <span style={{ fontWeight: 600, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nome}</span>
                  <span className="xs muted" style={{ display: 'block' }}>{filialNome(db, a.filialId)} · {a.matricula || a.email}</span>
                </span>
                <Faixa idx={a.faixaIdx} />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
