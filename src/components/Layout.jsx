import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useDB, setDB, setSession, notificacoesDe, temRecurso } from '../lib/db';
import { fmtDateTime } from '../lib/utils';
import { Avatar, Modal, Empty } from './ui';
import { WhatsFab } from './shared';

export const NAVS = {
  admin: [
    ['', '📊', 'Dashboard'],
    ['filiais', '🏯', 'Academias Filiadas'],
    ['professores', '👨‍🏫', 'Professores'],
    ['alunos', '🥋', 'Alunos & Prontuários'],
    ['graduacao', '🎖️', 'Graduação & Pré-Exame'],
    ['financeiro', '💳', 'Financeiro'],
    ['carteirinhas', '🪪', 'Carteirinhas'],
    ['eventos', '📅', 'Eventos & Reuniões'],
    ['comunicados', '📢', 'Comunicados'],
    ['materiais', '🎬', 'Material Didático'],
    ['diretoria', '🏛️', 'Diretoria'],
    ['institucional', '📜', 'Institucional'],
    ['termos', '✍️', 'Termos & Fidelidade'],
    ['config', '⚙️', 'Configurações'],
  ],
  professor: [
    ['', '📊', 'Minha Unidade'],
    ['alunos', '🥋', 'Alunos da Filial'],
    ['presenca', '✅', 'Presença & Chamada'],
    ['graduacao', '🎖️', 'Pré-Exame'],
    ['financeiro', '💳', 'Mensalidades'],
    ['materiais', '🎬', 'Material Didático'],
    ['estudo', '📚', 'Estudo Próprio'],
    ['sede', '📢', 'Comunicação da Sede'],
    ['eventos', '📅', 'Eventos'],
    ['carteira', '🪪', 'Minha Carteirinha'],
    ['filiacao', '🏅', 'Filiação'],
  ],
  aluno: [
    ['', '🏠', 'Início'],
    ['carteira', '🪪', 'Carteira Digital'],
    ['conteudo', '🎬', 'Meu Conteúdo'],
    ['presenca', '✅', 'Presença'],
    ['eventos', '📅', 'Eventos'],
    ['atleta', '🏆', 'Atleta'],
    ['institucional', '📜', 'Institucional'],
    ['diretoria', '🏛️', 'Diretoria'],
    ['pagamentos', '💳', 'Pagamentos'],
    ['perfil', '👤', 'Meu Perfil'],
  ],
};

const ROLE_LABEL = { admin: 'Central Mao · Administrador', professor: 'Painel do Laoshi', aluno: 'Área do Aluno' };

export default function Layout({ user }) {
  const db = useDB();
  const [open, setOpen] = useState(false);
  const [bell, setBell] = useState(false);
  const loc = useLocation();
  const base = '/' + user.role;
  const nav = NAVS[user.role].filter(([p]) => !(p === 'atleta' && !user.atleta?.ativo) && (user.role !== 'professor' || !p || temRecurso(user, p)));
  const current = nav.find(([p]) => loc.pathname === (p ? `${base}/${p}` : base)) || nav[0];
  const notes = notificacoesDe(db, user);
  const unread = notes.filter((n) => !n.lida.includes(user.id)).length;

  useEffect(() => setOpen(false), [loc.pathname]);

  const openBell = () => {
    setBell(true);
    if (unread)
      setDB((d) => {
        const ids = new Set(notes.map((n) => n.id));
        d.notificacoes.forEach((n) => ids.has(n.id) && !n.lida.includes(user.id) && n.lida.push(user.id));
      });
  };

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <img src="./logo.webp" alt="Mao Quan Conecta" />
          <div>
            <div className="t1">MAO QUAN</div>
            <div className="t2">CONECTA</div>
          </div>
        </div>
        <div className="role">{ROLE_LABEL[user.role]}</div>
        <nav className="nav">
          {nav.map(([p, ico, label]) => (
            <NavLink key={p} to={p ? `${base}/${p}` : base} end>
              <span className="ico">{ico}</span>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="foot row">
          <Avatar src={user.foto} name={user.nome} />
          <div className="grow">
            <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.nome}</div>
            <button className="btn link sm" style={{ padding: 0, color: '#bbb' }} onClick={() => setSession(null)}>Sair ↩</button>
          </div>
        </div>
      </aside>
      <div className={`scrim ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />
      <div className="main">
        <header className="topbar">
          <button className="btn icon ghost burger" onClick={() => setOpen(true)} aria-label="Menu">☰</button>
          <h1>{current[2]}</h1>
          <button className="btn icon ghost bell" onClick={openBell} aria-label="Notificações">
            🔔{unread > 0 && <span className="dot">{unread}</span>}
          </button>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
      <WhatsFab />
      <Modal open={bell} onClose={() => setBell(false)} title="Notificações">
        {notes.length === 0 ? (
          <Empty icon="🔕">Nenhuma notificação.</Empty>
        ) : (
          notes.slice(0, 60).map((n) => (
            <div className="list-item" key={n.id} style={{ alignItems: 'flex-start' }}>
              <div className="grow">
                <div style={{ fontWeight: 700 }}>{n.titulo}</div>
                {n.texto && <div className="small">{n.texto}</div>}
                <div className="xs muted">{fmtDateTime(n.data)}</div>
              </div>
            </div>
          ))
        )}
      </Modal>
    </div>
  );
}
