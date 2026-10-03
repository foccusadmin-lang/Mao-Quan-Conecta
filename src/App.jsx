import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useDB, useSession, useAuth, setSession, temRecurso, recarregar, useFilialAtiva, filiaisDoProfessor } from './lib/db';
import { supabase } from './lib/supabase';
import PrimeiroAcesso from './pages/PrimeiroAcesso';
import Layout from './components/Layout';
import { Toaster, toast } from './components/ui';
import Login from './pages/Login';
import Validar from './pages/Validar';
import Patrocinador from './pages/Patrocinador';

import AdminDashboard from './pages/admin/Dashboard';
import Filiais from './pages/admin/Filiais';
import Professores from './pages/admin/Professores';
import Carteirinhas from './pages/admin/Carteirinhas';
import Diretoria from './pages/admin/Diretoria';
import InstitucionalAdmin from './pages/admin/InstitucionalAdmin';
import Termos from './pages/admin/Termos';
import Config from './pages/admin/Config';

import Alunos from './pages/shared/Alunos';
import Graduacao from './pages/shared/Graduacao';
import Financeiro from './pages/shared/Financeiro';
import Eventos from './pages/shared/Eventos';
import Comunicados from './pages/shared/Comunicados';
import Materiais from './pages/shared/Materiais';
import OndeTreinar from './pages/shared/OndeTreinar';
import Carreira from './pages/aluno/Carreira';
import VitrineAtleta from './pages/VitrineAtleta';
import PainelInvestidor from './pages/PainelInvestidor';

import ProfDashboard from './pages/professor/Dashboard';
import Presenca from './pages/professor/Presenca';
import ChamadaAdmin from './pages/admin/Chamada';
import Estudo from './pages/professor/Estudo';
import Filiacao from './pages/professor/Filiacao';
import ProfCarteira from './pages/professor/Carteira';
import ProfMeuPlano from './pages/professor/MeuPlano';
import ProfMeusDados from './pages/professor/MeusDados';

import AlunoGate from './pages/aluno/Gate';
import AlunoHome from './pages/aluno/Home';
import AlunoCarteira from './pages/aluno/Carteira';
import Conteudo from './pages/aluno/Conteudo';
import AlunoPresenca from './pages/aluno/Presenca';
import Atleta from './pages/aluno/Atleta';
import Pagamentos from './pages/aluno/Pagamentos';
import MeuPlano from './pages/aluno/MeuPlano';
import Certificados from './pages/shared/Certificados';
import DocumentosAtletas from './pages/shared/DocumentosAtletas';
import Perfil from './pages/aluno/Perfil';
import { Institucional, DiretoriaList } from './components/shared';
import { PageHead } from './components/ui';

function useCurrentUser() {
  const db = useDB();
  const s = useSession();
  const ativa = useFilialAtiva();
  // Professor com mais de uma filial: o painel trabalha na filial escolhida no topo (as demais continuam acessíveis)
  const comoProfessor = (p) => {
    const filiais = filiaisDoProfessor(p);
    return { ...p, role: 'professor', filiais, filialPrincipal: p.filialId, filialId: filiais.includes(ativa) ? ativa : p.filialId };
  };
  if (!s) return null;
  if (s.role === 'admin') return { id: 'admin', role: 'admin', nome: 'Central Mao', foto: null };
  if (s.role === 'professor') {
    const p = db.professores.find((x) => x.id === s.id && x.ativo);
    return p ? comoProfessor(p) : null;
  }
  if (s.role === 'aluno') {
    const a = db.alunos.find((x) => x.id === s.id);
    if (!a) return null;
    // Aluno promovido a Professor: a mesma conta Google passa a abrir o Painel do Laoshi
    const p = db.professores.find((x) => x.ativo && x.email.toLowerCase() === a.email.toLowerCase());
    return p ? comoProfessor(p) : { ...a, role: 'aluno' };
  }
  return null;
}

export default function App() {
  const user = useCurrentUser();
  const auth = useAuth();
  const loc = useLocation();
  useEffect(() => {
    const aviso = (e) => toast(e.detail);
    window.addEventListener('mqc-erro', aviso);
    return () => window.removeEventListener('mqc-erro', aviso);
  }, []);

  // Páginas públicas (validação do QR e patrocinador) não dependem de login
  const publica = /^\/(validar|patrocinador|atleta|painel-patrocinador)\//.test(loc.pathname + '/');
  if (!publica && auth.status === 'carregando') return <TelaStatus titulo="Conectando…" texto="Carregando seus dados com segurança." />;
  if (!publica && auth.status === 'novo') return <><PrimeiroAcesso /><Toaster /></>;
  if (!publica && auth.status === 'recusado')
    return <TelaStatus titulo="Cadastro não aprovado" texto={`A conta ${auth.email} não foi aprovada. Fale com o professor da sua filial.`} sair />;
  if (!publica && auth.status === 'erro')
    return <TelaStatus titulo="Não foi possível conectar" texto={auth.mensagem} sair recarregar />;
  const home = user ? '/' + user.role : '/login';

  return (
    <>
      <Routes>
        <Route path="/login" element={user ? <Navigate to={home} replace /> : <Login />} />
        <Route path="/validar/:payload" element={<Validar />} />
        <Route path="/patrocinador/:token?" element={<Patrocinador />} />
        <Route path="/atleta/:slug" element={<VitrineAtleta />} />
        <Route path="/painel-patrocinador/:token" element={<PainelInvestidor />} />

        {user?.role === 'admin' && (
          <Route path="/admin" element={<Layout user={user} />}>
            <Route index element={<AdminDashboard />} />
            <Route path="filiais" element={<Filiais />} />
            <Route path="professores" element={<Professores />} />
            <Route path="certificados" element={<Certificados user={user} />} />
            <Route path="documentos" element={<DocumentosAtletas user={user} />} />
            <Route path="alunos" element={<Alunos user={user} />} />
            <Route path="chamada" element={<ChamadaAdmin user={user} />} />
            <Route path="graduacao" element={<Graduacao user={user} />} />
            <Route path="financeiro" element={<Financeiro user={user} />} />
            <Route path="carteirinhas" element={<Carteirinhas />} />
            <Route path="eventos" element={<Eventos user={user} />} />
            <Route path="comunicados" element={<Comunicados user={user} />} />
            <Route path="materiais" element={<Materiais user={user} />} />
            <Route path="diretoria" element={<Diretoria />} />
            <Route path="institucional" element={<InstitucionalAdmin />} />
            <Route path="termos" element={<Termos />} />
            <Route path="config" element={<Config />} />
          </Route>
        )}

        {user?.role === 'professor' && (
          <Route path="/professor" element={<Layout user={user} />}>
            <Route index element={<ProfDashboard user={user} />} />
            {temRecurso(user, 'alunos') && <Route path="alunos" element={<Alunos user={user} />} />}
            {temRecurso(user, 'presenca') && <Route path="presenca" element={<Presenca user={user} />} />}
            {temRecurso(user, 'graduacao') && <Route path="graduacao" element={<Graduacao user={user} />} />}
            {temRecurso(user, 'financeiro') && <Route path="financeiro" element={<Financeiro user={user} />} />}
            {temRecurso(user, 'materiais') && <Route path="materiais" element={<Materiais user={user} />} />}
            {temRecurso(user, 'estudo') && <Route path="estudo" element={<Estudo user={user} />} />}
            {temRecurso(user, 'sede') && <Route path="sede" element={<Comunicados user={user} />} />}
            {temRecurso(user, 'eventos') && <Route path="eventos" element={<Eventos user={user} />} />}
            <Route path="onde-treinar" element={<OndeTreinar user={user} />} />
            {temRecurso(user, 'carteira') && <Route path="carteira" element={<ProfCarteira user={user} />} />}
            <Route path="certificados" element={<Certificados user={user} />} />
            <Route path="documentos" element={<DocumentosAtletas user={user} />} />
            {temRecurso(user, 'filiacao') && <Route path="filiacao" element={<Filiacao user={user} />} />}
            <Route path="plano" element={<ProfMeuPlano user={user} />} />
            <Route path="dados" element={<ProfMeusDados user={user} />} />
            <Route path="atleta" element={<ComoPraticante user={user}>{(pr) => <Atleta user={pr} base="/professor" />}</ComoPraticante>} />
            <Route path="carreira" element={<ComoPraticante user={user}>{(pr) => <Carreira user={pr} base="/professor" />}</ComoPraticante>} />
          </Route>
        )}

        {user?.role === 'aluno' && (
          <Route path="/aluno" element={<AlunoGate user={user} />}>
            <Route element={<Layout user={user} />}>
              <Route index element={<AlunoHome user={user} />} />
              <Route path="carteira" element={<AlunoCarteira user={user} />} />
              <Route path="conteudo" element={<Conteudo user={user} />} />
              <Route path="presenca" element={<AlunoPresenca user={user} />} />
              <Route path="eventos" element={<Eventos user={user} />} />
              <Route path="atleta" element={<Atleta user={user} />} />
              <Route path="carreira" element={<Carreira user={user} />} />
              <Route path="onde-treinar" element={<OndeTreinar user={user} />} />
              <Route path="institucional" element={<><PageHead title="Institucional" sub="Linhagem, história e o código de ética Wu De" /><Institucional /></>} />
              <Route path="diretoria" element={<><PageHead title="Diretoria 2025" sub="Diretores em atuação na vigência atual" /><DiretoriaList /></>} />
              <Route path="plano" element={<MeuPlano user={user} />} />
              <Route path="pagamentos" element={<Pagamentos user={user} />} />
              <Route path="certificados" element={<Certificados user={user} />} />
              <Route path="perfil" element={<Perfil user={user} />} />
            </Route>
          </Route>
        )}

        <Route path="*" element={<Navigate to={home} replace />} />
      </Routes>
      <Toaster />
    </>
  );
}

function TelaStatus({ titulo, texto, sair, recarregar }) {
  return (
    <div style={{ minHeight: '100%', background: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="card pad-lg center" style={{ maxWidth: 420, width: '100%' }}>
        <img src="./logo.webp" alt="" style={{ width: 90 }} />
        <h2 style={{ marginTop: 10 }}>{titulo}</h2>
        <p className="muted">{texto}</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          {recarregar && <button className="btn" onClick={() => location.reload()}>Tentar de novo</button>}
          {sair && <button className="btn ghost" onClick={() => setSession(null)}>Sair</button>}
        </div>
      </div>
    </div>
  );
}
/** Professor que também é atleta: as telas de atleta usam a ficha de praticante (mesmo e-mail Google) */
function ComoPraticante({ user, children }) {
  const db = useDB();
  const [ativando, setAtivando] = useState(false);
  const pr = db.alunos.find((a) => (a.email || '').toLowerCase() === (user.email || '').toLowerCase());
  if (pr?.atleta?.ativo) return children(pr);

  const ativar = async () => {
    setAtivando(true);
    try {
      const dados = {
        matricula: 'MQ' + Date.now().toString(36).toUpperCase().slice(-6),
        nome: user.nome, telefone: user.telefone || '', foto: user.foto || null, rg: user.rg || '', cpf: user.cpf || '', nascimento: user.nascimento || '', responsavel: '',
        saude: { tipoSanguineo: '', alergias: '', lesoes: '', restricoes: '', medicamentos: '', emergenciaNome: '', emergenciaTel: '' },
        tecnico: [], termos: null, preExame: null, inscritoExame: false, historicoGraduacao: [], qrToken: 'q' + Date.now().toString(36), criadoEm: new Date().toISOString(),
      };
      const { error } = await supabase.rpc('mq_ativar_atleta_professor', { p_dados: dados });
      if (error) throw error;
      await recarregar();
      toast('Perfil de atleta ativado! Agora monte sua carreira.');
    } catch (e) {
      toast('Não foi possível ativar: ' + e.message);
    } finally {
      setAtivando(false);
    }
  };

  return (
    <>
      <div className="page-head"><div><h2>Atleta</h2><p>Monte seu perfil de atleta e sua vitrine pública</p></div></div>
      <div className="card pad-lg" style={{ maxWidth: 640 }}>
        <div style={{ fontSize: 40 }}>🏆</div>
        <h3 style={{ margin: '6px 0' }}>Ativar meu perfil de atleta</h3>
        <p className="small">
          Como professor, você também pode competir e ter a sua vitrine de atleta: medalhas, campeonatos, troféus, fotos e vídeos, com link próprio para patrocinadores.
          O perfil usa o seu e-mail Google e a sua graduação atual.
        </p>
        <p className="xs muted">Ativar o perfil de atleta não gera mensalidade. A mensalidade só existe se você escolher um plano de treino em Meu Plano.</p>
        <button className="btn gold" disabled={ativando} onClick={ativar}>{ativando ? 'Ativando…' : '🏅 Ativar perfil de atleta'}</button>
      </div>
    </>
  );
}
