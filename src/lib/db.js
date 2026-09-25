// Camada de dados. Nesta fase os dados ficam no aparelho (localStorage) e são
// sincronizados em tempo real entre abas/janelas via BroadcastChannel.
// Todas as telas usam apenas useDB()/setDB(), então trocar por uma API REST +
// WebSocket (Node/Express + MongoDB) exige alterar somente este arquivo.
import { useSyncExternalStore } from 'react';
import { seed, FAIXAS_PADRAO, MAPA_FAIXAS_ANTIGAS, IDX_PRIMEIRA_PRETA } from './seed';
import { uid, todayISO, monthISO, addDays, addMonths, diffDays, brl } from './utils';

const KEY = 'mqc_db_v1';
const SKEY = 'mqc_session_v1';
const listeners = new Set();
const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('mqc-sync') : null;

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw);
      const base = seed();
      for (const k of Object.keys(base)) if (data[k] === undefined) data[k] = base[k];
      data.config = { ...base.config, ...data.config };
      delete data.config.filiacaoMensal;
      delete data.config.filiacaoAnual;
      // Plano mensal de filiação foi substituído pela anual (à vista, 3x ou 6x): descarta cobranças pendentes dele
      data.pagamentos = (data.pagamentos || []).filter((p) => !(p.tipo === 'filiacao' && p.plano === 'mensal' && p.status === 'pendente'));
      // Migração: acesso do Administrador exclusivamente pela conta Google oficial
      if (data.config.adminEmail === 'associacaomaochuen@gmail.com') data.config.adminEmail = base.config.adminEmail;
      delete data.config.adminUser;
      delete data.config.adminPass;
      // Migração: carteirinhas passam a usar o modelo oficial (frente + verso)
      if (!data.modelos?.aluno?.oficial) data.modelos = base.modelos;
      // Migração: sistema oficial de graduação (Iniciante › Intermediária › Avançado › Professor)
      if (!data.config.faixas?.[0]?.nivel) {
        const conv = (i) => (typeof i === 'number' ? MAPA_FAIXAS_ANTIGAS[i] ?? 0 : i);
        data.config.faixas = FAIXAS_PADRAO;
        data.alunos.forEach((a) => {
          a.faixaIdx = conv(a.faixaIdx);
          (a.historicoGraduacao || []).forEach((h) => (h.faixaIdx = conv(h.faixaIdx)));
        });
        data.professores.forEach((p) => (p.faixaIdx = Math.max(IDX_PRIMEIRA_PRETA, conv(p.faixaIdx))));
        data.materiais.forEach((m) => (m.faixaIdx = conv(m.faixaIdx)));
      }
      return data;
    }
  } catch {}
  return seed();
}

let state = load();
persist(); // grava eventuais migrações
let session = (() => {
  try {
    return JSON.parse(localStorage.getItem(SKEY)) || null;
  } catch {
    return null;
  }
})();

const emit = () => listeners.forEach((l) => l());
const subscribe = (l) => (listeners.add(l), () => listeners.delete(l));

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    alert('O armazenamento do aparelho está cheio. Use links externos para vídeos/arquivos grandes.');
  }
}

export function getDB() {
  return state;
}

/** Atualiza o banco alterando o rascunho: setDB(db => { db.alunos.push(...) }). O retorno da função é ignorado. */
export function setDB(fn) {
  const draft = structuredClone(state);
  fn(draft);
  replaceDB(draft);
}

/** Substitui o banco inteiro (restauração de backup, rotinas automáticas) */
export function replaceDB(data) {
  state = data;
  persist();
  emit();
  bc?.postMessage('db');
}

export function resetDB() {
  state = seed();
  persist();
  emit();
  bc?.postMessage('db');
}

export const useDB = () => useSyncExternalStore(subscribe, () => state);

// ---------- Sessão ----------
export const useSession = () => useSyncExternalStore(subscribe, () => session);
export function setSession(s) {
  session = s;
  if (s) localStorage.setItem(SKEY, JSON.stringify(s));
  else localStorage.removeItem(SKEY);
  emit();
}

if (bc) bc.onmessage = () => ((state = load()), emit());
window.addEventListener('storage', (e) => {
  if (e.key === KEY) (state = load()), emit();
});

// ---------- Notificações ----------
/** para: 'admin' | userId | 'filial:<id>' | 'todos' */
export function notify(db, para, titulo, texto = '') {
  db.notificacoes.unshift({ id: uid('n'), para, titulo, texto, data: new Date().toISOString(), lida: [] });
  db.notificacoes = db.notificacoes.slice(0, 300);
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
    matricula: 'MQ' + String(db.alunos.length + 1001),
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
