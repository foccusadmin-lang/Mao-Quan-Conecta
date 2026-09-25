import { useEffect, useRef, useState } from 'react';
import { useDB, setDB, setSession, novoAluno } from '../lib/db';
import { Modal, Field, toast, WAIcon } from '../components/ui';
import { waLink, maskCPF, maskRG } from '../lib/utils';

const GOOGLE_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function parseJwt(t) {
  const p = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(decodeURIComponent(escape(atob(p))));
}

/** Botão Google real (se VITE_GOOGLE_CLIENT_ID estiver configurado) ou modo de simulação */
function GoogleLogin({ onUser, label = 'Entrar com Google' }) {
  const ref = useRef(null);
  const cb = useRef(onUser);
  cb.current = onUser;
  const [demo, setDemo] = useState(false);
  const [f, setF] = useState({ email: '', name: '' });

  useEffect(() => {
    if (!GOOGLE_ID) return;
    const init = () => {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_ID,
        callback: (r) => {
          const j = parseJwt(r.credential);
          cb.current({ email: j.email.toLowerCase(), name: j.name, picture: j.picture });
        },
      });
      window.google.accounts.id.renderButton(ref.current, { theme: 'outline', size: 'large', text: 'continue_with', locale: 'pt-BR', width: ref.current.offsetWidth || 320 });
    };
    if (window.google?.accounts) return init();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = init;
    document.head.appendChild(s);
  }, []);

  if (GOOGLE_ID) return <div ref={ref} style={{ width: '100%', minHeight: 44 }} />;
  return (
    <>
      <button className="btn gbtn block" onClick={() => setDemo(true)}>
        <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
        {label}
      </button>
      <Modal
        open={demo}
        onClose={() => setDemo(false)}
        title="Entrar com Google"
        footer={
          <button
            className="btn"
            onClick={() => {
              if (!/^\S+@\S+\.\S+$/.test(f.email)) return toast('Informe um e-mail válido.');
              setDemo(false);
              onUser({ email: f.email.trim().toLowerCase(), name: f.name.trim() || f.email.split('@')[0], picture: null });
            }}
          >
            Continuar
          </button>
        }
      >
        <div className="alert gold mb small">
          ⚙️ Modo de pré-visualização: o login Google real é ativado ao configurar <code>VITE_GOOGLE_CLIENT_ID</code> (ver README).
        </div>
        <div className="col">
          <Field label="E-mail da conta Google">
            <input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="seuemail@gmail.com" autoFocus />
          </Field>
          <Field label="Nome">
            <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Seu nome completo" />
          </Field>
        </div>
      </Modal>
    </>
  );
}

export default function Login() {
  const db = useDB();
  const [cadastro, setCadastro] = useState(null);

  /** Login único: a conta Google define o painel (Administrador › Professor › Aluno) */
  const entrar = (g) => {
    const email = g.email.toLowerCase();
    if (email === db.config.adminEmail.toLowerCase()) return setSession({ role: 'admin', id: 'admin' });

    const p = db.professores.find((x) => x.email.toLowerCase() === email);
    if (p) {
      if (!p.ativo) return toast('Seu acesso de professor está desativado. Fale com a Central.');
      setDB((d) => {
        const x = d.professores.find((y) => y.id === p.id);
        if (g.picture && !x.foto) x.foto = g.picture;
        x.ultimoAcesso = new Date().toISOString();
      });
      return setSession({ role: 'professor', id: p.id });
    }

    const a = db.alunos.find((x) => x.email.toLowerCase() === email);
    if (a) {
      if (a.status === 'recusado') return toast('Cadastro não aprovado. Fale com seu professor.');
      setDB((d) => {
        const x = d.alunos.find((y) => y.id === a.id);
        if (g.picture && !x.foto) x.foto = g.picture;
        x.ultimoAcesso = new Date().toISOString();
      });
      return setSession({ role: 'aluno', id: a.id });
    }
    setCadastro({ email, nome: g.name, foto: g.picture, telefone: '', nascimento: '', rg: '', cpf: '', filialId: '', responsavel: '' });
  };
  const concluirCadastro = () => {
    if (!cadastro.nome || !cadastro.filialId || !cadastro.telefone) return toast('Preencha nome, telefone e filial.');
    let id;
    setDB((d) => (id = novoAluno(d, cadastro).id));
    setCadastro(null);
    setSession({ role: 'aluno', id });
  };

  return (
    <div className="login-wrap">
      <div className="login-art">
        <img src="./logo.webp" alt="Mao Quan Conecta" />
        <div className="tag">
          Associação <b>Mao Quan</b> Kung Fu Wushu
        </div>
      </div>
      <div className="login-form">
        <div className="login-card">
          <h2 className="brush" style={{ fontSize: 30, margin: 0 }}>Bem-vindo(a)</h2>
          <p className="muted" style={{ marginTop: 4 }}>Entre com a sua conta Google</p>
          <div className="col mt">
            <GoogleLogin onUser={entrar} />
            <p className="xs muted center" style={{ margin: 0 }}>
              O sistema identifica automaticamente o seu perfil — Aluno, Professor (Laoshi) ou Administrador — pela conta Google. No primeiro acesso, alunos escolhem a filial e aguardam a aprovação.
            </p>
          </div>
          <a className="btn ghost block mt" href={waLink(db.config.whatsapp, 'Olá! Preciso de ajuda para acessar o Mao Quan Conecta.')} target="_blank" rel="noreferrer" style={{ color: '#128c4a' }}>
            <span style={{ width: 20, display: 'inline-flex' }}><WAIcon /></span> Suporte técnico · (11) 94963-2186
          </a>
          <p className="xs muted center">{db.config.suporteNome}</p>
        </div>
      </div>

      <Modal
        open={!!cadastro}
        onClose={() => setCadastro(null)}
        title="Primeiro acesso — Solicitar filiação"
        footer={<button className="btn" onClick={concluirCadastro}>Enviar cadastro</button>}
      >
        {cadastro && (
          <div className="form-grid">
            <Field label="Nome completo">
              <input value={cadastro.nome} onChange={(e) => setCadastro({ ...cadastro, nome: e.target.value })} />
            </Field>
            <Field label="E-mail (Google)">
              <input value={cadastro.email} disabled />
            </Field>
            <Field label="WhatsApp">
              <input type="tel" value={cadastro.telefone} onChange={(e) => setCadastro({ ...cadastro, telefone: e.target.value })} placeholder="(11) 90000-0000" />
            </Field>
            <Field label="Data de nascimento">
              <input type="date" value={cadastro.nascimento} onChange={(e) => setCadastro({ ...cadastro, nascimento: e.target.value })} />
            </Field>
            <Field label="RG">
              <input value={cadastro.rg} onChange={(e) => setCadastro({ ...cadastro, rg: maskRG(e.target.value) })} placeholder="00.000.000-0" />
            </Field>
            <Field label="CPF">
              <input value={cadastro.cpf} inputMode="numeric" onChange={(e) => setCadastro({ ...cadastro, cpf: maskCPF(e.target.value) })} placeholder="000.000.000-00" />
            </Field>
            <Field label="Academia / Filial">
              <select value={cadastro.filialId} onChange={(e) => setCadastro({ ...cadastro, filialId: e.target.value })}>
                <option value="">Selecione…</option>
                {db.filiais.filter((f) => f.ativa).map((f) => (
                  <option key={f.id} value={f.id}>{f.nome}</option>
                ))}
              </select>
            </Field>
            <Field label="Responsável (se menor de idade)">
              <input value={cadastro.responsavel} onChange={(e) => setCadastro({ ...cadastro, responsavel: e.target.value })} />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
