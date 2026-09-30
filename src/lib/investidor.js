// Painel do Patrocinador: vitrine de todos os atletas, acessada só por link exclusivo
import { supabase } from './supabase';
import { APP_URL } from './utils';

export const linkInvestidor = (token) => `${APP_URL}#/painel-patrocinador/${token}`;

export async function criarConviteInvestidor(nome) {
  const { data, error } = await supabase.rpc('mq_criar_convite_investidor', { p_nome: nome || '' });
  if (error) throw error;
  return data;
}

export async function meusConvites() {
  const { data, error } = await supabase.from('convites_investidor').select('*').order('criado_em', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function desativarConvite(token) {
  const { error } = await supabase.from('convites_investidor').update({ ativo: false }).eq('token', token);
  if (error) throw error;
}

/** Sem login: valida o link e traz os atletas (null = link inválido ou desativado) */
export async function carregarPainelInvestidor(token) {
  const { data, error } = await supabase.rpc('mq_vitrine_investidor', { p_token: token });
  if (error) throw error;
  return data;
}
