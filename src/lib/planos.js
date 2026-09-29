// Planos por filial: modalidades avulsas, pacote completo (promocional) e combos família.
// filial.planos = {
//   modalidades: { [nome]: { ativa, valor } },
//   pacote: { ativo, valor },            // todas as modalidades oferecidas
//   familia: { 2: valor, 3: valor, 4: valor } // valor vazio/0 = combo não oferecido
// }
// aluno.plano = { tipo: 'modalidades' | 'pacote' | 'familia', modalidades: [], combo, familia: { beneficiarios: [{ nome, email, alunoId, cadastrado }] } }
import { brl } from './utils';

export const COMBOS = [2, 3, 4];

export const modalidadesOfertadas = (f) =>
  Object.entries(f?.planos?.modalidades || {})
    .filter(([, v]) => v?.ativa)
    .map(([nome, v]) => ({ nome, valor: +v.valor || 0 }));

export const temPlanos = (f) => modalidadesOfertadas(f).length > 0;
export const pacoteAtivo = (f) => !!f?.planos?.pacote?.ativo && +f.planos.pacote.valor > 0 && modalidadesOfertadas(f).length > 1;
export const combosAtivos = (f) => COMBOS.filter((n) => +f?.planos?.familia?.[n] > 0).map((n) => ({ pessoas: n, valor: +f.planos.familia[n] }));

/** Soma das modalidades escolhidas (sem desconto) */
export const somaModalidades = (f, nomes = []) => modalidadesOfertadas(f).filter((m) => nomes.includes(m.nome)).reduce((s, m) => s + m.valor, 0);

/** Valor mensal do plano do aluno. Sem planos configurados na filial, vale a mensalidade base. */
export function valorPlano(f, plano) {
  const base = +f?.mensalidade || 0;
  if (!temPlanos(f) || !plano) return base;
  if (plano.tipo === 'familia') return +f.planos.familia?.[plano.combo] || base;
  if (plano.tipo === 'pacote' && pacoteAtivo(f)) return +f.planos.pacote.valor;
  return somaModalidades(f, plano.modalidades) || base;
}

export const modalidadesDoPlano = (f, plano) =>
  !plano ? [] : plano.tipo === 'pacote' || (plano.tipo === 'familia' && plano.todas) ? modalidadesOfertadas(f).map((m) => m.nome) : (plano.modalidades || []).filter((n) => modalidadesOfertadas(f).some((m) => m.nome === n));

/** Texto curto: "Sanda + Tai Chi Chuan", "Pacote completo", "Família (3 pessoas) · Sanda" */
export function resumoPlano(f, plano) {
  if (!temPlanos(f) || !plano) return 'Mensalidade';
  if (plano.tipo === 'pacote') return 'Pacote completo';
  const mods = modalidadesDoPlano(f, plano);
  if (plano.tipo === 'familia') return `Família (${plano.combo} pessoas)${mods.length ? ' · ' + (plano.todas ? 'todas as modalidades' : mods.join(' + ')) : ''}`;
  return mods.join(' + ') || 'Mensalidade';
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
  }
  return '';
}

export const economiaPacote = (f) => Math.max(0, somaModalidades(f, modalidadesOfertadas(f).map((m) => m.nome)) - (+f?.planos?.pacote?.valor || 0));
export const rotuloValor = (v) => (v > 0 ? `${brl(v)}/mês` : '—');
