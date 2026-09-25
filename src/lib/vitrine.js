// Vitrine / portfólio público do atleta ("Construir Carreira").
// Fica fora do sincronizador geral (db.js) porque é pública: visitantes sem login leem por link.
import { supabase } from './supabase';
import { uid } from './utils';

export const RESULTADOS = {
  ouro: { rotulo: 'Ouro', icone: '🥇', cor: '#d4a017' },
  prata: { rotulo: 'Prata', icone: '🥈', cor: '#9aa3ad' },
  bronze: { rotulo: 'Bronze', icone: '🥉', cor: '#b0703a' },
  participacao: { rotulo: 'Participação', icone: '🎌', cor: '#6d6763' },
};

/** "Ana de Souza" -> "ana-de-souza" */
export const gerarSlug = (texto = '') =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

export const vitrineVazia = (aluno) => ({
  nome: aluno.nome,
  foto: aluno.foto || null,
  capa: null,
  titulo: 'Atleta de Kung Fu Wushu',
  bio: '',
  modalidades: '',
  cidade: '',
  instagram: '',
  youtube: '',
  whatsapp: aluno.telefone || '',
  conquistas: [], // { id, campeonato, data, local, categoria, resultado }
  trofeus: [], // { id, titulo, data, descricao }
  honras: [], // { id, titulo, data, concedidoPor }
  midias: [], // { id, tipo: 'foto'|'video'|'youtube', url, legenda, caminho }
  patrocinio: { pixChave: '', pixNome: aluno.nome, pixCidade: '', linkIndicacao: '', mensagem: '' },
});

export function estatisticas(v) {
  const c = v?.conquistas || [];
  return {
    ouro: c.filter((x) => x.resultado === 'ouro').length,
    prata: c.filter((x) => x.resultado === 'prata').length,
    bronze: c.filter((x) => x.resultado === 'bronze').length,
    campeonatos: new Set(c.map((x) => `${(x.campeonato || '').trim().toLowerCase()}|${x.data || ''}`)).size,
    trofeus: (v?.trofeus || []).length,
    honras: (v?.honras || []).length,
  };
}

export const linkVitrine = (slug, base) => `${base}#/atleta/${slug}`;

export async function carregarMinhaVitrine(alunoId) {
  const { data, error } = await supabase.from('vitrines').select('id, slug, data, publicado').eq('id', alunoId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function buscarVitrinePublica(slug) {
  const { data, error } = await supabase.from('vitrines').select('slug, data, publicado').eq('slug', slug).eq('publicado', true).maybeSingle();
  if (error) throw error;
  return data;
}

export async function slugDisponivel(slug, donoId) {
  const { data, error } = await supabase.rpc('mq_slug_disponivel', { p_slug: slug, p_dono: donoId });
  if (error) throw error;
  return !!data;
}

/** Cria ou atualiza a vitrine do atleta logado */
export async function salvarVitrine({ id, email, slug, data, publicado, existe }) {
  const linha = { slug, data, publicado };
  const { error } = existe
    ? await supabase.from('vitrines').update(linha).eq('id', id)
    : await supabase.from('vitrines').insert({ id, email: email.toLowerCase(), ...linha });
  if (error) {
    if (error.code === '23505') throw new Error('Esse link já está em uso por outro atleta. Escolha outro.');
    if (error.code === '23514') throw new Error('Link inválido: use só letras minúsculas, números e hífen (mínimo 3 caracteres).');
    throw error;
  }
}

/** Envia foto/vídeo para o armazenamento público (pasta do usuário logado) */
export async function enviarMidia(arquivo) {
  const { data: sessao } = await supabase.auth.getUser();
  const uidUsuario = sessao?.user?.id;
  if (!uidUsuario) throw new Error('Faça login novamente para enviar arquivos.');
  const limite = arquivo.type.startsWith('video') ? 50 : 10;
  if (arquivo.size > limite * 1024 * 1024) throw new Error(`Arquivo maior que ${limite} MB. Para vídeos longos, use um link do YouTube.`);
  const ext = (arquivo.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  const caminho = `${uidUsuario}/${uid('m')}.${ext}`;
  const { error } = await supabase.storage.from('vitrines').upload(caminho, arquivo, { cacheControl: '31536000', upsert: false, contentType: arquivo.type });
  if (error) throw error;
  const { data } = supabase.storage.from('vitrines').getPublicUrl(caminho);
  return { url: data.publicUrl, caminho, tipo: arquivo.type.startsWith('video') ? 'video' : 'foto' };
}

export async function apagarMidia(caminho) {
  if (caminho) await supabase.storage.from('vitrines').remove([caminho]);
}

/** Reduz a foto antes de enviar (economiza dados e deixa a vitrine rápida) */
export function comprimirImagem(arquivo, lado = 1600, qualidade = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = reject;
    img.onload = () => {
      const escala = Math.min(1, lado / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * escala);
      c.height = Math.round(img.height * escala);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => (b ? resolve(new File([b], arquivo.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' })) : reject(new Error('Falha ao processar a imagem'))), 'image/jpeg', qualidade);
    };
    img.src = URL.createObjectURL(arquivo);
  });
}
