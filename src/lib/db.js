// Camada de dados — Supabase (Postgres + login Google + tempo real).
// As telas usam apenas useDB()/setDB(): cada alteração é comparada com o último estado
// conhecido do servidor e só as linhas alteradas são gravadas. As regras de acesso (RLS)
// ficam no banco: o aluno só recebe os próprios dados, o professor os da filial, o admin tudo.
import { useSyncExternalStore } from 'react';
import { supabase } from './supabase';
import { seed, FAIXAS_PADRAO, IDX_PRIMEIRA_PRETA } from './seed';
import { uid, todayISO, monthISO, addDays, addMonths, diffDays, brl, maskRG, maskCPF, maskTelefone } from './utils';

const COLECOES = ['filiais', 'professores', 'alunos', 'pagamentos', 'presencas', 'materiais', 'eventos', 'comunicados', 'notificacoes'];
const UNICOS = ['config', 'termos', 'institucional', 'modelos', 'diretoria', 'precos'];

const listeners = new Set();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l) => (listeners.add(l), () => listeners.delete(l));
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

let state = seed(); // valores padrão até o carregamento
let servidor = null; // último estado confirmado no servidor (base do diff)
let session = null; // { role, id } — painel atual
let auth = { status: 'carregando' }; // carregando | anon | novo | pronto | recusado | erro
let sessaoSupabase = null;
const recentes = new Map(); // gravações locais recentes (ignora o eco do tempo real)

/** Documentos e telefones sempre no formato com máscara (inclusive cadastros antigos) */
function formatarPessoa(p) {
  if (!p) return p;
  if (p.rg) p.rg = maskRG(p.rg);
  if (p.cpf) p.cpf = maskCPF(p.cpf);
  if (p.telefone) p.telefone = maskTelefone(p.telefone);
  if (p.saude?.emergenciaTel) p.saude.emergenciaTel = maskTelefone(p.saude.emergenciaTel);
  return p;
}

/** Completa o que vier do banco com os padrões do app */
function normalizar(data) {
  const base = seed();
  for (const k of [...UNICOS, ...COLECOES]) if (data[k] === undefined || data[k] === null) data[k] = base[k];
  data.config = { ...base.config, ...data.config };
  if (!data.config.faixas?.[0]?.nivel) data.config.faixas = FAIXAS_PADRAO;
  if (!data.modelos?.aluno?.oficial) data.modelos = base.modelos;
  data.notificacoes.sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  data.alunos.forEach(formatarPessoa);
  data.professores.forEach(formatarPessoa);
  data.filiais.forEach((f) => f.telefone && (f.telefone = maskTelefone(f.telefone)));
  return data;
}

export function getDB() {
  return state;
}

/** Atualiza alterando o rascunho: setDB(db => { db.alunos.push(...) }). O retorno da função é ignorado. */
export function setDB(fn) {
  const draft = structuredClone(state);
  fn(draft);
  replaceDB(draft);
}

/** Substitui o estado inteiro (rotinas automáticas, restauração de backup) */
export function replaceDB(data) {
  state = data;
  emit();
  agendarSync();
}

export function resetDB() {
  replaceDB(seed());
}

export const useDB = () => useSyncExternalStore(subscribe, () => state);
export const useSession = () => useSyncExternalStore(subscribe, () => session);
export const useAuth = () => useSyncExternalStore(subscribe, () => auth);

// ---------- Sincronização com o Supabase ----------
let timer = null;
let fila = Promise.resolve();

function agendarSync() {
  if (!sessaoSupabase || !servidor) return;
  clearTimeout(timer);
  timer = setTimeout(() => sincronizar(), 250);
}

/** Grava imediatamente o que estiver pendente */
export function flush() {
  clearTimeout(timer);
  return sincronizar();
}

function sincronizar() {
  fila = fila.then(gravarDiferencas).catch(() => {});
  return fila;
}

async function gravarDiferencas() {
  if (!sessaoSupabase || !servidor) return;
  const alvo = state;
  const base = servidor;
  let falhou = null;
  const agora = Date.now();

  for (const col of COLECOES) {
    const antes = new Map((base[col] || []).map((r) => [r.id, r]));
    const depois = new Map((alvo[col] || []).map((r) => [r.id, r]));
    // Registros novos são INSERIDOS e os existentes ATUALIZADOS. (Upsert exigiria permissão de
    // criação mesmo para uma simples alteração — ex.: aluno confirmando presença num evento.)
    const novos = [];
    const alterados = [];
    for (const [id, row] of depois) {
      if (!antes.has(id)) novos.push({ id, data: row });
      else if (!igual(antes.get(id), row)) alterados.push({ id, data: row });
    }
    const apagar = [...antes.keys()].filter((id) => !depois.has(id));
    [...novos, ...alterados].forEach((r) => recentes.set(col + ':' + r.id, agora));
    for (let i = 0; i < novos.length; i += 200) {
      const lote = novos.slice(i, i + 200);
      const { error } = await supabase.from(col).insert(lote);
      // Já existia no servidor (criado em outro aparelho): vira atualização
      if (error?.code === '23505') alterados.push(...lote);
      else if (error) falhou = error;
    }
    for (let i = 0; i < alterados.length; i += 8) {
      const resultados = await Promise.all(
        alterados.slice(i, i + 8).map((r) => supabase.from(col).update({ data: r.data }).eq('id', r.id))
      );
      resultados.forEach(({ error }) => error && (falhou = error));
    }
    if (apagar.length) {
      apagar.forEach((id) => recentes.set(col + ':' + id, agora));
      const { error } = await supabase.from(col).delete().in('id', apagar);
      if (error) falhou = error;
    }
  }
  for (const k of UNICOS) {
    if (!igual(base[k], alvo[k])) {
      recentes.set('app_config:' + k, agora);
      const existe = base[k] !== null && base[k] !== undefined;
      const { error } = existe
        ? await supabase.from('app_config').update({ data: alvo[k] }).eq('id', k)
        : await supabase.from('app_config').insert({ id: k, data: alvo[k] });
      if (error) falhou = error;
    }
  }
  servidor = structuredClone(alvo);
  if (falhou) {
    console.error('Falha ao gravar no Supabase:', falhou);
    window.dispatchEvent(new CustomEvent('mqc-erro', { detail: 'Não foi possível salvar uma alteração (sem permissão ou sem conexão). Os dados foram recarregados.' }));
    await carregarTudo();
  }
}

async function buscar(tabela) {
  const out = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await supabase.from(tabela).select('id,data').range(de, de + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

async function carregarTudo() {
  const logado = !!sessaoSupabase;
  const [cfg, ...cols] = await Promise.all([buscar('app_config'), ...(logado ? COLECOES.map(buscar) : [])]);
  const novo = {};
  cfg.forEach((r) => UNICOS.includes(r.id) && (novo[r.id] = r.data));
  COLECOES.forEach((c, i) => (novo[c] = (cols[i] || []).map((r) => ({ ...r.data, id: r.id }))));
  const vazio = !cfg.some((r) => r.id === 'config');
  state = normalizar(novo);
  servidor = structuredClone(state);
  emit();
  return { vazio };
}

// ---------- Tempo real ----------
let canal = null;
function ligarTempoReal() {
  desligarTempoReal();
  canal = supabase.channel('mqc-dados');
  for (const t of [...COLECOES, 'app_config'])
    canal.on('postgres_changes', { event: '*', schema: 'public', table: t }, (p) => aplicarRemoto(t, p.eventType, p.new, p.old));
  canal.subscribe();
}
function desligarTempoReal() {
  if (canal) supabase.removeChannel(canal);
  canal = null;
}

function aplicarRemoto(tabela, evento, novo, velho) {
  const id = novo?.id || velho?.id;
  if (!id || Date.now() - (recentes.get(tabela + ':' + id) || 0) < 2500) return;
  if (tabela === 'app_config') {
    if (!UNICOS.includes(id) || evento === 'DELETE') return;
    state = normalizar({ ...state, [id]: novo.data });
    servidor = { ...servidor, [id]: structuredClone(state[id]) };
    return emit();
  }
  // Aluno promovido a professor enquanto está com o app aberto: recarrega com o novo perfil
  if (tabela === 'professores' && session?.role === 'aluno' && novo?.data?.email?.toLowerCase() === auth.email) return recarregar();
  const aplicar = (lista = []) => {
    if (evento === 'DELETE') return lista.filter((r) => r.id !== id);
    const row = { ...novo.data, id };
    if (tabela === 'alunos' || tabela === 'professores') formatarPessoa(row);
    const i = lista.findIndex((r) => r.id === id);
    if (i >= 0) return lista.map((r) => (r.id === id ? row : r));
    return tabela === 'notificacoes' ? [row, ...lista] : [...lista, row];
  };
  state = { ...state, [tabela]: aplicar(state[tabela]) };
  if (servidor) servidor = { ...servidor, [tabela]: aplicar(servidor[tabela]) };
  emit();
}

// ---------- Autenticação (Google via Supabase) ----------
export async function entrarComGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname, queryParams: { prompt: 'select_account' } },
  });
  if (error) throw error;
}

/** Sair (mantido com este nome porque as telas chamam setSession(null)) */
export function setSession(s) {
  if (s === null) supabase.auth.signOut();
}

let rotinaTimer = null;

async function identificar() {
  const { data: quem, error } = await supabase.rpc('mq_whoami');
  if (error) throw error;
  const meta = sessaoSupabase.user.user_metadata || {};
  const foto = meta.avatar_url || meta.picture || null;
  const email = (quem.email || '').toLowerCase();
  const agora = new Date().toISOString();
  clearInterval(rotinaTimer);

  if (quem.admin) {
    session = { role: 'admin', id: 'admin' };
  } else if (quem.professor_id) {
    session = { role: 'professor', id: quem.professor_id };
    setDB((d) => {
      const p = d.professores.find((x) => x.id === quem.professor_id);
      if (p) {
        if (!p.foto && foto) p.foto = foto;
        p.ultimoAcesso = agora;
      }
    });
  } else if (quem.aluno_id) {
    const a = state.alunos.find((x) => x.id === quem.aluno_id);
    if (a?.status === 'recusado') {
      session = null;
      auth = { status: 'recusado', email };
      return emit();
    }
    session = { role: 'aluno', id: quem.aluno_id };
    setDB((d) => {
      const x = d.alunos.find((y) => y.id === quem.aluno_id);
      if (x) {
        if (!x.foto && foto) x.foto = foto;
        x.ultimoAcesso = agora;
      }
    });
  } else {
    // Primeiro acesso: abre o formulário de cadastro
    session = null;
    auth = { status: 'novo', email, nome: meta.full_name || meta.name || '', foto };
    return emit();
  }
  auth = { status: 'pronto', email };
  emit();
  if (session.role !== 'aluno') {
    rotinaFinanceira();
    rotinaTimer = setInterval(rotinaFinanceira, 60 * 60 * 1000);
  }
}

async function processarSessao(s) {
  sessaoSupabase = s;
  try {
    if (!s) {
      clearInterval(rotinaTimer);
      desligarTempoReal();
      session = null;
      auth = { status: 'anon' };
      state = seed();
      servidor = null;
      emit();
      await carregarTudo().catch(() => {});
      return;
    }
    auth = { status: 'carregando', email: s.user.email };
    emit();
    const { vazio } = await carregarTudo();
    const { data: quem } = await supabase.rpc('mq_whoami');
    // Primeiro acesso do administrador num banco vazio: grava a configuração inicial
    if (vazio && quem?.admin) {
      const base = seed();
      const inicial = structuredClone(state);
      for (const c of ['filiais', 'materiais', 'eventos', 'comunicados']) if (!inicial[c].length) inicial[c] = base[c];
      servidor = { ...servidor, ...Object.fromEntries(UNICOS.map((k) => [k, null])) };
      state = inicial;
      emit();
      await flush();
    }
    ligarTempoReal();
    await identificar();
  } catch (e) {
    console.error(e);
    auth = { status: 'erro', mensagem: e.message || String(e) };
    emit();
  }
}

/** Recarrega dados e perfil (após cadastro, promoção ou aprovação) */
export async function recarregar() {
  if (!sessaoSupabase) return;
  await flush();
  await carregarTudo();
  await identificar();
}

let ultimoUsuario = null;
supabase.auth.onAuthStateChange((evento, s) => {
  // Renovação de token não recarrega nada
  const id = s?.user?.id || null;
  if (evento === 'TOKEN_REFRESHED' && id === ultimoUsuario) return (sessaoSupabase = s);
  if (evento !== 'INITIAL_SESSION' && evento !== 'SIGNED_IN' && evento !== 'SIGNED_OUT') return;
  if (evento === 'SIGNED_IN' && id === ultimoUsuario && auth.status === 'pronto') return;
  ultimoUsuario = id;
  if (location.search.includes('code=')) history.replaceState(null, '', location.pathname + location.hash);
  setTimeout(() => processarSessao(s), 0);
});

// Ao voltar para o app (aba/tela reaberta), busca o que mudou enquanto estava fora
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && sessaoSupabase && auth.status === 'pronto') flush().then(carregarTudo).catch(() => {});
});

// ---------- Notificações ----------
/** para: 'admin' | userId | 'filial:<id>' | 'todos' */
export function notify(db, para, titulo, texto = '') {
  db.notificacoes.unshift({ id: uid('n'), para, titulo, texto, data: new Date().toISOString(), lida: [] });
}

export function notificacoesDe(db, user) {
  if (!user) return [];
  const alvos = new Set(['todos', user.id]);
  if (user.role === 'admin') alvos.add('admin');
  if (user.filialId) alvos.add('filial:' + user.filialId);
  if (user.role === 'professor') alvos.add('professores');
  return db.notificacoes.filter((n) => alvos.has(n.para));
}

// ---------- Recursos do Painel do Professor (definidos pelo Administrador) ----------
export const RECURSOS_PROF = [
  ['alunos', 'Alunos da filial & prontuários'],
  ['presenca', 'Presença, chamada e trava mínima'],
  ['graduacao', 'Pré-exame e proposta de graduação'],
  ['financeiro', 'Mensalidades da filial'],
  ['materiais', 'Gestão de material didático'],
  ['estudo', 'Estudo próprio (acervo)'],
  ['sede', 'Comunicação da Sede'],
  ['eventos', 'Eventos'],
  ['carteira', 'Carteirinha de professor'],
  ['filiacao', 'Filiação / pagamento'],
];
export const recursosPadrao = () => Object.fromEntries(RECURSOS_PROF.map(([k]) => [k, true]));
export const temRecurso = (prof, key) => prof?.recursos?.[key] !== false;

/** Promove um aluno a Professor (Laoshi): a mesma conta Google passa a abrir o Painel do Professor */
export function promoverAProfessor(db, alunoId, { titulo = 'Laoshi', filialId, recursos } = {}) {
  const a = db.alunos.find((x) => x.id === alunoId);
  if (!a) return null;
  if (db.professores.some((p) => p.email.toLowerCase() === a.email.toLowerCase())) return null;
  const prof = {
    id: uid('pr'), nome: a.nome, email: a.email.toLowerCase(), telefone: a.telefone || '', foto: a.foto || null, rg: a.rg || '', cpf: a.cpf || '', nascimento: a.nascimento || '',
    titulo, faixaIdx: Math.max(IDX_PRIMEIRA_PRETA, a.faixaIdx), filialId: filialId || a.filialId || null, ativo: true,
    filiacaoValidaAte: '', recursos: recursos || recursosPadrao(), alunoOrigemId: a.id,
    criadoEm: new Date().toISOString(), obs: '',
  };
  db.professores.push(prof);
  a.promovidoProfessor = { professorId: prof.id, data: todayISO() };
  const fil = db.filiais.find((f) => f.id === prof.filialId);
  if (fil && !fil.professorId) fil.professorId = prof.id;
  notify(db, prof.id, `Você foi promovido(a) a ${titulo}! 🎖️`, 'No próximo acesso com sua conta Google, o Painel do Professor será aberto automaticamente.');
  notify(db, a.id, `Você foi promovido(a) a ${titulo}! 🎖️`, 'Saia e entre novamente com sua conta Google para acessar o Painel do Professor.');
  return prof;
}

// ---------- Regras de negócio ----------
export const faixaNome = (db, idx) => db.config.faixas[idx]?.nome || '—';
export const faixaNivel = (db, idx) => db.config.faixas[idx]?.nivel || '—';
export const filialNome = (db, id) => db.filiais.find((f) => f.id === id)?.nome || '—';

/** Situação financeira do aluno: inadimplente se tiver mensalidade vencida além da tolerância */
export function situacaoAluno(db, aluno) {
  if (!aluno) return { bloqueado: true, emAberto: [], vencidas: [] };
  const hoje = todayISO();
  const emAberto = db.pagamentos.filter((p) => p.pessoaId === aluno.id && p.status === 'pendente');
  const vencidas = emAberto.filter((p) => diffDays(hoje, p.vencimento) > (db.config.diasTolerancia || 0));
  const bloqueado = !aluno.isento && vencidas.length > 0;
  return { bloqueado, emAberto, vencidas };
}

/** Professor em dia com a filiação / tarifa de manutenção */
export function professorEmDia(prof) {
  return !!prof?.filiacaoValidaAte && prof.filiacaoValidaAte >= todayISO();
}

/** Frequência dos últimos N dias frente à carga horária da filial */
export function frequencia(db, aluno, dias = 90) {
  const filial = db.filiais.find((f) => f.id === aluno.filialId);
  const inicio = [addDays(todayISO(), -dias), aluno.aprovadoEm || aluno.criadoEm?.slice(0, 10) || todayISO()].sort()[1];
  const periodo = Math.max(1, diffDays(todayISO(), inicio));
  const previstas = Math.max(1, Math.round((periodo / 7) * (filial?.aulasSemana || 2)));
  const presentes = db.presencas.filter((p) => p.alunoId === aluno.id && p.confirmada && p.data >= inicio).length;
  const faltas = Math.max(0, previstas - presentes);
  const pct = Math.min(100, Math.round((presentes / previstas) * 100));
  const ok = pct >= (filial?.minFrequencia ?? 75) && faltas <= (filial?.maxFaltas ?? 99);
  return { previstas, presentes, faltas, pct, ok, min: filial?.minFrequencia ?? 75, maxFaltas: filial?.maxFaltas ?? 99 };
}

/**
 * Rotina automática (roda ao abrir o app): gera mensalidades do mês,
 * dispara lembretes antes/depois do vencimento e notifica bloqueios.
 */
export function rotinaFinanceira() {
  const db0 = getDB();
  const comp = monthISO();
  const hoje = todayISO();
  const dia = String(db0.config.diaVencimento || 10).padStart(2, '0');
  let mudou = false;
  const draft = structuredClone(db0);

  for (const a of draft.alunos) {
    if (a.status !== 'aprovado' || a.isento) continue;
    const existe = draft.pagamentos.some((p) => p.pessoaId === a.id && p.tipo === 'mensalidade' && p.competencia === comp);
    if (!existe) {
      const fil = draft.filiais.find((f) => f.id === a.filialId);
      draft.pagamentos.push({
        id: uid('pg'), tipo: 'mensalidade', pessoaId: a.id, filialId: a.filialId, competencia: comp,
        descricao: `Mensalidade ${comp}`, valor: fil?.mensalidade ?? 0, vencimento: `${comp}-${dia}`,
        status: 'pendente', criadoEm: new Date().toISOString(), lembretes: [],
      });
      mudou = true;
    }
  }
  for (const p of draft.pagamentos) {
    if (p.status !== 'pendente') continue;
    p.lembretes ||= [];
    const d = diffDays(p.vencimento, hoje);
    if (d >= 0 && d <= (draft.config.lembreteDiasAntes || 3) && !p.lembretes.includes('pre')) {
      notify(draft, p.pessoaId, 'Lembrete de vencimento', `${p.descricao} vence em ${new Date(p.vencimento + 'T12:00').toLocaleDateString('pt-BR')}.`);
      p.lembretes.push('pre');
      mudou = true;
    }
    if (d < 0 && !p.lembretes.includes('pos')) {
      notify(draft, p.pessoaId, 'Pagamento em atraso', `${p.descricao} está vencida. Regularize para evitar o bloqueio do conteúdo.`);
      p.lembretes.push('pos');
      mudou = true;
    }
    if (-d > (draft.config.diasTolerancia || 0) && !p.lembretes.includes('bloq')) {
      notify(draft, p.pessoaId, 'Acesso bloqueado por inadimplência', 'Material didático e inscrição em exames suspensos até a confirmação do pagamento.');
      p.lembretes.push('bloq');
      mudou = true;
    }
  }
  // Renovação automática da filiação anual dos professores
  for (const prof of draft.professores) {
    if (!prof.ativo || !prof.planoFiliacao || prof.renovacaoAutomatica === false || !prof.filiacaoValidaAte) continue;
    const temAberto = draft.pagamentos.some((p) => p.pessoaId === prof.id && p.tipo === 'filiacao' && p.status === 'pendente');
    if (temAberto || diffDays(prof.filiacaoValidaAte, hoje) > (draft.config.renovacaoDiasAntes ?? 30)) continue;
    const inicio = [todayISO(), addDays(prof.filiacaoValidaAte, -3)].sort()[1];
    if (gerarFiliacao(draft, prof.id, prof.planoFiliacao, inicio)) {
      notify(draft, prof.id, 'Renovação automática da filiação', 'Um novo ciclo anual foi gerado. Confira as parcelas em Filiação.');
      mudou = true;
    }
  }
  if (mudou) replaceDB(draft);
}

export const planoFiliacao = (db, id) => db.config.planosFiliacao?.find((p) => p.id === id);
export const descPlano = (pl) => (pl.parcelas === 1 ? `${pl.nome} — ${brl(pl.valorParcela)}` : `${pl.nome} — ${pl.parcelas}x de ${brl(pl.valorParcela)}`);

/** Gera todas as parcelas de um ciclo anual de filiação (vencimentos mensais) */
export function gerarFiliacao(db, profId, planoId, inicio = todayISO()) {
  const prof = db.professores.find((x) => x.id === profId);
  const pl = planoFiliacao(db, planoId);
  if (!prof || !pl) return false;
  const ciclo = uid('ci');
  const primeiro = addDays(inicio, 3);
  for (let i = 0; i < pl.parcelas; i++) {
    db.pagamentos.push({
      id: uid('pg'), tipo: 'filiacao', plano: pl.id, ciclo, parcela: i + 1, parcelas: pl.parcelas, meses: 12 / pl.parcelas,
      pessoaId: prof.id, filialId: prof.filialId, competencia: addMonths(primeiro, i).slice(0, 7),
      descricao: pl.parcelas === 1 ? 'Filiação anual (à vista)' : `Filiação anual — parcela ${i + 1}/${pl.parcelas}`,
      valor: pl.valorParcela, vencimento: addMonths(primeiro, i), status: 'pendente', criadoEm: new Date().toISOString(), lembretes: [],
    });
  }
  prof.planoFiliacao = pl.id;
  if (prof.renovacaoAutomatica === undefined) prof.renovacaoAutomatica = true;
  notify(db, prof.id, 'Cobrança de filiação gerada', descPlano(pl));
  notify(db, 'admin', 'Filiação de professor gerada', `${prof.nome}: ${descPlano(pl)}`);
  return true;
}

/** Confirma pagamento e aplica os desbloqueios correspondentes */
export function confirmarPagamento(db, pagId, por, metodo = 'manual') {
  const p = db.pagamentos.find((x) => x.id === pagId);
  if (!p) return;
  p.status = 'pago';
  p.pagoEm = new Date().toISOString();
  p.confirmadoPor = por;
  p.metodo = metodo;
  if (p.tipo === 'filiacao') {
    const prof = db.professores.find((x) => x.id === p.pessoaId);
    if (prof) {
      const base = professorEmDia(prof) ? prof.filiacaoValidaAte : todayISO();
      // Cada parcela paga estende a validade proporcionalmente (à vista = 12 meses, 3x = 4 meses, 6x = 2 meses)
      const meses = p.meses ?? (p.plano === 'anual' ? 12 : 1);
      prof.filiacaoValidaAte = addMonths(base, meses);
    }
  }
  if (p.tipo === 'exame') {
    const a = db.alunos.find((x) => x.id === p.pessoaId);
    if (a) a.inscritoExame = true;
  }
  notify(db, p.pessoaId, 'Pagamento confirmado ✅', `${p.descricao} — acesso a vídeos, certificados e carteirinha liberado.`);
}

export function novoAluno(db, dados) {
  const a = {
    id: uid('al'),
    // Matrícula única mesmo quando o próprio aluno se cadastra (ele não enxerga os demais)
    matricula: 'MQ' + Date.now().toString(36).toUpperCase().slice(-6),
    status: 'pendente',
    faixaIdx: 0,
    foto: null,
    telefone: '',
    nascimento: '',
    rg: '',
    cpf: '',
    responsavel: '',
    isento: false,
    saude: { tipoSanguineo: '', alergias: '', lesoes: '', restricoes: '', medicamentos: '', emergenciaNome: '', emergenciaTel: '' },
    tecnico: [],
    termos: null,
    atleta: { ativo: false, polo: '', termoAceito: null },
    preExame: null,
    inscritoExame: false,
    historicoGraduacao: [],
    qrToken: uid('q'),
    criadoEm: new Date().toISOString(),
    ...dados,
  };
  db.alunos.push(a);
  if (a.status === 'pendente') {
    notify(db, 'admin', 'Novo cadastro pendente', `${a.nome} solicitou filiação (${filialNome(db, a.filialId)}).`);
    if (a.filialId) notify(db, 'filial:' + a.filialId, 'Novo aluno aguardando aprovação', a.nome);
  }
  return a;
}

/** Qual perfil já usa este e-mail Google (o login é decidido por ele) */
export function perfilDoEmail(db, email) {
  const e = (email || '').trim().toLowerCase();
  if (!e) return null;
  if (e === db.config.adminEmail.toLowerCase()) return 'admin';
  if (db.professores.some((p) => p.email.toLowerCase() === e)) return 'professor';
  if (db.alunos.some((a) => a.email.toLowerCase() === e)) return 'aluno';
  return null;
}

/** Acesso liberado pela Central/Laoshi: o aluno já entra direto no painel no 1º login com essa conta Google */
export function liberarAluno(db, dados, por) {
  const a = novoAluno(db, { ...dados, email: dados.email.trim().toLowerCase(), status: 'aprovado', aprovadoEm: todayISO(), liberadoPor: por });
  notify(db, a.id, 'Bem-vindo(a) à Associação Mao Quan! 🥋', 'Seu acesso foi liberado. Complete seu perfil e assine os termos.');
  if (a.filialId) notify(db, 'filial:' + a.filialId, 'Aluno liberado', `${a.nome} (${a.email})`);
  return a;
}

/** Dados de demonstração para testar todos os fluxos */
export function carregarDemo() {
  setDB((db) => {
    const prof = {
      id: uid('pr'), nome: 'Professor Demonstração', email: 'professor.demo@gmail.com', filialId: 'fil2', foto: null,
      titulo: 'Laoshi', faixaIdx: IDX_PRIMEIRA_PRETA, telefone: '', ativo: true, filiacaoValidaAte: addDays(todayISO(), 200), demo: true,
      criadoEm: new Date().toISOString(),
    };
    db.professores.push(prof);
    db.filiais.find((f) => f.id === 'fil2').professorId = prof.id;
    const nomes = ['Ana Souza', 'Bruno Lima', 'Carla Mendes', 'Diego Rocha', 'Eduarda Alves'];
    nomes.forEach((nome, i) => {
      const a = novoAluno(db, {
        nome, email: nome.toLowerCase().replace(' ', '.') + '@gmail.com', filialId: i < 3 ? 'fil2' : 'fil1',
        status: i === 4 ? 'pendente' : 'aprovado', faixaIdx: i % 3, demo: true,
        aprovadoEm: addDays(todayISO(), -80),
      });
      if (a.status === 'aprovado') {
        for (let d = 0; d < 80; d += 3 + (i % 2)) db.presencas.push({ id: uid('pz'), alunoId: a.id, filialId: a.filialId, data: addDays(todayISO(), -d), origem: 'professor', confirmada: true });
      }
    });
  });
  rotinaFinanceira();
  // Parte dos alunos de demonstração já com a mensalidade paga
  setDB((db) => {
    const pagos = db.alunos.filter((a) => a.demo && a.status === 'aprovado').slice(0, 2).map((a) => a.id);
    db.pagamentos.filter((p) => pagos.includes(p.pessoaId) && p.status === 'pendente').forEach((p) => confirmarPagamento(db, p.id, 'Demonstração', 'pix'));
  });
}

export function limparDemo() {
  setDB((db) => {
    const ids = new Set([...db.alunos.filter((a) => a.demo), ...db.professores.filter((p) => p.demo)].map((x) => x.id));
    db.alunos = db.alunos.filter((a) => !a.demo);
    db.professores = db.professores.filter((p) => !p.demo);
    db.pagamentos = db.pagamentos.filter((p) => !ids.has(p.pessoaId));
    db.presencas = db.presencas.filter((p) => !ids.has(p.alunoId));
    db.filiais.forEach((f) => ids.has(f.professorId) && (f.professorId = null));
  });
}
