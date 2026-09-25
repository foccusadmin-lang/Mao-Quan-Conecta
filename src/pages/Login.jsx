import { useState } from 'react';
import { useDB, entrarComGoogle } from '../lib/db';
import { toast, WAIcon } from '../components/ui';
import { waLink } from '../lib/utils';

const GoogleG = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
);

export default function Login() {
  const db = useDB();
  const [indo, setIndo] = useState(false);
  // Erro devolvido pelo Google/Supabase na volta do login (ex.: chave do cliente inválida)
  const [erro] = useState(() => {
    const q = new URLSearchParams(window.location.search);
    const msg = q.get('error_description') || q.get('error');
    if (msg) history.replaceState(null, '', window.location.pathname + window.location.hash);
    return msg;
  });

  // Login oficial do Google via Supabase: a conta é confirmada no servidor e o painel é decidido pelo e-mail
  const entrar = async () => {
    setIndo(true);
    try {
      await entrarComGoogle();
    } catch (e) {
      setIndo(false);
      toast('Não foi possível abrir o login do Google: ' + e.message);
    }
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
          {erro && (
            <div className="alert red mt small">
              <div>
                <b>Não foi possível concluir o login com o Google.</b>
                <div className="xs" style={{ marginTop: 4 }}>{erro}</div>
                <div className="xs" style={{ marginTop: 4 }}>Tente novamente. Se continuar, fale com o suporte.</div>
              </div>
            </div>
          )}
          <div className="col mt">
            <button className="btn gbtn block" onClick={entrar} disabled={indo} style={{ minHeight: 48 }}>
              <GoogleG /> {indo ? 'Abrindo o Google…' : 'Entrar com Google'}
            </button>
            <p className="xs muted center" style={{ margin: 0 }}>
              O sistema identifica automaticamente o seu perfil — Aluno, Professor (Laoshi) ou Administrador — pela conta Google. No primeiro acesso, alunos preenchem o cadastro e aguardam a liberação.
            </p>
          </div>
          <a className="btn ghost block mt" href={waLink(db.config.whatsapp, 'Olá! Preciso de ajuda para acessar o Mao Quan Conecta.')} target="_blank" rel="noreferrer" style={{ color: '#128c4a' }}>
            <span style={{ width: 20, display: 'inline-flex' }}><WAIcon /></span> Suporte técnico · (11) 94963-2186
          </a>
          <p className="xs muted center">{db.config.suporteNome}</p>
        </div>
      </div>
    </div>
  );
}
