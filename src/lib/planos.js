// Planos por filial: modalidades avulsas, pacote completo (promocional) e combos família.
// filial.planos = {
//   modalidades: { [nome]: { ativa, valor } },
//   pacote: { ativo, valor },            // todas as modalidades oferecidas
//   familia: { 2: valor, 3: valor, 4: valor } // valor vazio/0 = combo não oferecido
// }
// aluno.plano = { tipo: 'modalidades' | 'pacote' | 'familia', modalidades: [], combo, familia: { beneficiarios: [{ nome, email, alunoId, cadastrado }] } }
import { brl } from './utils';

export const COMBOS = [2, 3, 4, 5, 6];

export const modalidadesOfertadas = (f) =>
  Object.entries(f?.planos?.modalidades || {})
    .filter(([, v]) => v?.ativa)
    .map(([nome, v]) => ({ nome, valor: +v.valor || 0 }));

export const temPlanos = (f) => modalidadesOfertadas(f).length > 0;
export const pacoteAtivo = (f) => !!f?.planos?.pacote?.ativo && +f.planos.pacote.valor > 0 && modalidadesOfertadas(f).length > 1;
export const combosAtivos = (f) => COMBOS.filter((n) => +f?.planos?.familia?.[n] > 0).map((n) => ({ pessoas: n, valor: +f.planos.familia[n] }));

/** Soma das modalidades escolhidas (sem desconto) */
export const somaModalidades = (f, nomes = []) => modalidadesOfertadas(f).filter((m) => nomes.includes(m.nome)).reduce((s, m) => s + m.valor, 0);

/** Base "qualquer modalidade": a primeira (a de maior valor) paga o valor dela, as demais pagam só o adicional */
export const BASE_QUALQUER = '*';

/**
 * Condição especial da filial (ex.: Sede): a modalidade-base paga o valor dela
 * + um adicional fixo por cada outra modalidade escolhida.
 * filial.planos.combinada = { ativa, base: 'Tradicional' | '*', adicional: 50 }
 */
export const condicaoCombinada = (f) => {
  const c = f?.planos?.combinada;
  if (!c?.ativa || !c.base || !(+c.adicional >= 0)) return null;
  if (c.base !== BASE_QUALQUER && !modalidadesOfertadas(f).some((m) => m.nome === c.base)) return null;
  return { base: c.base, qualquer: c.base === BASE_QUALQUER, adicional: +c.adicional };
};

/** A condição especial vale para esta escolha de modalidades? */
export const condicaoAplica = (cc, nomes = []) => !!cc && nomes.length > 0 && (cc.qualquer || nomes.includes(cc.base));

/** Valor das modalidades escolhidas, aplicando a condição especial quando houver */
export function valorModalidades(f, nomes = []) {
  const ofertadas = modalidadesOfertadas(f).filter((m) => nomes.includes(m.nome));
  const cc = condicaoCombinada(f);
  if (condicaoAplica(cc, ofertadas.map((m) => m.nome))) {
    const vBase = cc.qualquer ? Math.max(...ofertadas.map((m) => m.valor)) : ofertadas.find((m) => m.nome === cc.base).valor;
    return vBase + cc.adicional * (ofertadas.length - 1);
  }
  return ofertadas.reduce((s, m) => s + m.valor, 0);
}

/**
 * Plano família: o combo cobre UMA modalidade por pessoa. Cada modalidade a mais (do titular ou de um beneficiário)
 * soma o adicional da filial. filial.planos.familiaAdicional (R$); sem ele, vale o adicional da condição especial (Sede: R$ 50).
 * Com "todas as modalidades" marcado, o combo cobre tudo para todos (sem adicional).
 */
export const adicionalFamilia = (f) => {
  const v = f?.planos?.familiaAdicional;
  if (v !== undefined && v !== null && v !== '' && +v >= 0) return +v;
  return condicaoCombinada(f)?.adicional || 0;
};

/** Pessoas do plano família com as modalidades de cada uma (beneficiário antigo, sem escolha registrada, conta 1 modalidade) */
export function pessoasFamilia(f, plano) {
  const ofertadas = modalidadesOfertadas(f).map((m) => m.nome);
  const so = (lista) => (lista || []).filter((n) => ofertadas.includes(n));
  return [
    { nome: 'Titular', titular: true, modalidades: so(plano?.modalidades) },
    ...(plano?.familia?.beneficiarios || []).map((b, i) => ({ nome: b.nome?.trim() || `Beneficiário ${i + 1}`, modalidades: Array.isArray(b.modalidades) ? so(b.modalidades) : null })),
  ];
}

/** Quantas modalidades adicionais (além da 1ª de cada pessoa) o plano família tem */
export const extrasFamilia = (f, plano) =>
  !plano || plano.tipo !== 'familia' || plano.todas ? 0 : pessoasFamilia(f, plano).reduce((s, p) => s + Math.max(0, (p.modalidades?.length || 0) - 1), 0);

/**
 * Treino em outras filiais (ex.: Sede): valor fixo por pessoa somado à mensalidade.
 * filial.planos.outrasFiliais = { ativo, valor }. Na escolha do plano, cada pessoa (titular e beneficiários) marca
 * "Outras filiais"; e aluno de outra filial que também treina nesta paga este valor na mensalidade dele.
 */
export const adicionalOutrasFiliais = (f) => (f?.planos?.outrasFiliais?.ativo && +f.planos.outrasFiliais.valor > 0 ? +f.planos.outrasFiliais.valor : 0);
/** Quantas pessoas do plano marcaram "Outras filiais" */
export const pessoasOutrasFiliais = (plano) =>
  !plano ? 0 : (plano.outrasFiliais ? 1 : 0) + (plano.tipo === 'familia' ? (plano.familia?.beneficiarios || []).filter((b) => b.outrasFiliais).length : 0);

/** Valor mensal do plano do aluno. Sem planos configurados na filial, vale a mensalidade base. */
export function valorPlano(f, plano) {
  const v = valorPlanoBase(f, plano);
  return temPlanos(f) && plano ? v + pessoasOutrasFiliais(plano) * adicionalOutrasFiliais(f) : v;
}
function valorPlanoBase(f, plano) {
  const base = +f?.mensalidade || 0;
  if (!temPlanos(f) || !plano) return base;
  if (plano.tipo === 'familia') {
    const combo = +f.planos.familia?.[plano.combo];
    return combo ? combo + extrasFamilia(f, plano) * adicionalFamilia(f) : base;
  }
  if (plano.tipo === 'pacote' && pacoteAtivo(f)) return +f.planos.pacote.valor;
  return valorModalidades(f, plano.modalidades) || base;
}

export const modalidadesDoPlano = (f, plano) =>
  !plano ? [] : plano.tipo === 'pacote' || (plano.tipo === 'familia' && plano.todas) ? modalidadesOfertadas(f).map((m) => m.nome) : (plano.modalidades || []).filter((n) => modalidadesOfertadas(f).some((m) => m.nome === n));

/** Texto curto: "Sanda + Tai Chi Chuan", "Pacote completo", "Família (3 pessoas) · Sanda" */
export function resumoPlano(f, plano) {
  if (!temPlanos(f) || !plano) return 'Mensalidade';
  if (plano.tipo === 'pacote') return 'Pacote completo' + (plano.outrasFiliais && adicionalOutrasFiliais(f) ? ' + outras filiais' : '');
  const mods = modalidadesDoPlano(f, plano);
  if (plano.tipo === 'familia') {
    const extras = extrasFamilia(f, plano);
    const outras = adicionalOutrasFiliais(f) ? pessoasOutrasFiliais(plano) : 0;
    return `Família (${plano.combo} pessoas)${mods.length ? ' · ' + (plano.todas ? 'todas as modalidades' : mods.join(' + ')) : ''}${extras ? ` · ${extras} modalidade${extras > 1 ? 's' : ''} adicional${extras > 1 ? 'is' : ''}` : ''}${outras ? ` · ${outras} em outras filiais` : ''}`;
  }
  return (mods.join(' + ') || 'Mensalidade') + (plano.outrasFiliais && adicionalOutrasFiliais(f) ? ' + outras filiais' : '');
}

/** Retorna mensagem de erro ou '' */
export function validarPlano(f, plano) {
  if (!temPlanos(f)) return '';
  if (!plano?.tipo) return 'Escolha um plano.';
  if (plano.tipo === 'pacote' && !pacoteAtivo(f)) return 'O pacote completo não está disponível nesta filial.';
  if (plano.tipo === 'modalidades' && !modalidadesDoPlano(f, plano).length) return 'Escolha pelo menos uma modalidade.';
  if (plano.tipo === 'familia') {
    if (!+f.planos.familia?.[plano.combo]) return 'Escolha o combo família.';
    if (!plano.todas && !modalidadesDoPlano(f, plano).length) return 'Escolha as modalidades da família.';
    const bs = plano.familia?.beneficiarios || [];
    if (bs.length !== plano.combo - 1 || bs.some((b) => !b.nome?.trim())) return `Informe o nome dos ${plano.combo - 1} beneficiário(s).`;
    if (bs.some((b) => b.email && !/^\S+@\S+\.\S+$/.test(b.email.trim()))) return 'E-mail de beneficiário inválido.';
    if (!plano.todas) {
      const sem = pessoasFamilia(f, plano).find((p) => !p.titular && p.modalidades && !p.modalidades.length);
      if (sem) return `Escolha a modalidade de ${sem.nome}.`;
    }
  }
  return '';
}

export const economiaPacote = (f) => Math.max(0, valorModalidades(f, modalidadesOfertadas(f).map((m) => m.nome)) - (+f?.planos?.pacote?.valor || 0));
export const rotuloValor = (v) => (v > 0 ? `${brl(v)}/mês` : '—');
