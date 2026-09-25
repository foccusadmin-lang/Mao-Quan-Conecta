import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useDB, setDB, setSession, filialNome, notify } from '../../lib/db';
import { toast, WAIcon } from '../../components/ui';
import { waLink } from '../../lib/utils';

/** Portão do aluno: termos obrigatórios no primeiro acesso + espera de aprovação */
export default function AlunoGate({ user }) {
  const db = useDB();
  const precisaTermos = !user.termos || user.termos.versao !== db.termos.versao;
  if (precisaTermos) return <TermosAceite user={user} />;
  if (user.status !== 'aprovado') return <Aguardando user={user} />;
  return <Outlet />;
}

function Frame({ children }) {
  return (
    <div style={{ minHeight: '100%', background: 'var(--ink)', padding: '24px 14px', paddingTop: 'calc(24px + env(safe-area-inset-top))' }}>
      <div className="card pad-lg" style={{ maxWidth: 720, margin: '0 auto' }}>
        <div className="row mb">
          <img src="./logo.webp" alt="" style={{ width: 56 }} />
          <div className="brush" style={{ fontSize: 22 }}>MAO QUAN <span style={{ color: 'var(--red)' }}>CONECTA</span></div>
        </div>
        {children}
      </div>
    </div>
  );
}

function TermosAceite({ user }) {
  const db = useDB();
  const t = db.termos;
  const [ok, setOk] = useState({ imagem: false, regulamento: false, etica: false });
  const [assinatura, setAssinatura] = useState('');
  const todos = ok.imagem && ok.regulamento && ok.etica;

  const assinar = () => {
    if (!todos) return toast('Aceite os três termos.');
    if (assinatura.trim().length < 5) return toast('Digite seu nome completo como assinatura.');
    setDB((d) => {
      const a = d.alunos.find((x) => x.id === user.id);
      a.termos = { versao: t.versao, data: new Date().toISOString(), assinatura: assinatura.trim(), userAgent: navigator.userAgent.slice(0, 120) };
      notify(d, 'admin', 'Termos assinados', `${a.nome} assinou os termos v${t.versao}.`);
    });
  };

  const bloco = (k, titulo, texto) => (
    <div className="card mb" style={{ background: '#faf8f6' }}>
      <h3 style={{ fontSize: 15 }}>{titulo}</h3>
      <p className="small" style={{ whiteSpace: 'pre-line' }}>{texto}</p>
      <label className="check"><input type="checkbox" checked={ok[k]} onChange={(e) => setOk({ ...ok, [k]: e.target.checked })} /> Li e aceito</label>
    </div>
  );

  return (
    <Frame>
      <h2 className="brush" style={{ fontWeight: 400 }}>Termos de Proteção e Fidelidade</h2>
      <p className="muted small">Olá, {user.nome.split(' ')[0]}! Antes de continuar, leia e assine digitalmente os termos obrigatórios (versão {t.versao}).</p>
      {bloco('imagem', '📸 Uso de imagem', t.imagem)}
      {bloco('regulamento', '📋 Regulamento interno', t.regulamento)}
      {bloco('etica', '武德 Compromisso de ética e lealdade marcial (Wu De)', t.etica)}
      <label className="field">
        Assinatura digital — digite seu nome completo{user.responsavel ? ' (ou do responsável)' : ''}
        <input value={assinatura} onChange={(e) => setAssinatura(e.target.value)} placeholder={user.nome} style={{ fontFamily: 'var(--brush)', fontSize: 20 }} />
      </label>
      <div className="row between mt">
        <button className="btn ghost" onClick={() => setSession(null)}>Sair</button>
        <button className="btn" disabled={!todos} onClick={assinar}>✍️ Assinar e continuar</button>
      </div>
    </Frame>
  );
}

function Aguardando({ user }) {
  const db = useDB();
  return (
    <Frame>
      <div className="center">
        <div style={{ fontSize: 48 }}>{user.status === 'pendente' ? '⏳' : '🚫'}</div>
        <h2>{user.status === 'pendente' ? 'Cadastro em análise' : 'Acesso inativo'}</h2>
        <p className="muted">
          {user.status === 'pendente'
            ? `Seu pedido de filiação na unidade ${filialNome(db, user.filialId)} foi enviado. Assim que o professor ou a Central aprovar, seu acesso será liberado automaticamente.`
            : 'Seu cadastro está inativo. Fale com seu professor ou com a secretaria.'}
        </p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <a className="btn ok" href={waLink(db.config.whatsapp, `Olá! Sou ${user.nome} e aguardo a aprovação do meu cadastro no Mao Quan Conecta.`)} target="_blank" rel="noreferrer">
            <span style={{ width: 20, display: 'inline-flex' }}><WAIcon /></span> Falar no WhatsApp
          </a>
          <button className="btn ghost" onClick={() => setSession(null)}>Sair</button>
        </div>
      </div>
    </Frame>
  );
}
