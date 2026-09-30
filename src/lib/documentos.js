// Documentos do atleta para inscrições em competições (FPKF, CBKW, Paulista, Brasileiro, Pan, Sul-Americano, Mundial).
// Arquivos no armazenamento privado "documentos-atleta" (pasta = id do aluno); a lista fica em aluno.documentos.
import { supabase } from './supabase';
import { setDB } from './db';
import { uid } from './utils';
import { comprimirImagem } from './vitrine';

/** Documentos padrão (um arquivo por item; o novo envio substitui o anterior) */
export const TIPOS_DOC = [
  { id: 'rg_frente', nome: 'RG ou CNH — frente', icone: '🪪' },
  { id: 'rg_verso', nome: 'RG ou CNH — verso', icone: '🪪' },
  { id: 'foto3x4', nome: 'Foto 3x4', icone: '🖼️' },
  { id: 'passaporte', nome: 'Passaporte', icone: '🛂' },
  { id: 'termo', nome: 'Termo de Responsabilidade — assinado (firma reconhecida ou assinatura digital gov.br)', icone: '✍️' },
  { id: 'formulario_medico', nome: 'Formulário Médico', icone: '🩺' },
  { id: 'ccc_peaae', nome: 'Certificado de conclusão do curso de Prevenção e Enfrentamento do Assédio e Abuso no Esporte (CCC/PEAAE)', icone: '🎓' },
  { id: 'seguro_viagem', nome: 'Bilhete de seguro viagem', icone: '🧳' },
  { id: 'passagem', nome: 'Passagem aérea', icone: '✈️' },
];
/** Áreas livres por entidade (vários arquivos, com descrição) */
export const ENTIDADES = [
  { id: 'fpkf', nome: 'FPKF — Federação Paulista de Kung Fu - Wushu', sigla: 'FPKF' },
  { id: 'cbkw', nome: 'CBKW — Confederação Brasileira de Kung Fu Wushu', sigla: 'CBKW' },
];

const TIPOS_OK = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];

export async function enviarDocumento(aluno, { tipo, entidade, descricao }, arquivo, por) {
  if (!TIPOS_OK.includes(arquivo.type)) throw new Error('Envie foto (JPG/PNG) ou PDF.');
  let f = arquivo;
  if (arquivo.type.startsWith('image/') && !/hei[cf]/.test(arquivo.type)) f = await comprimirImagem(arquivo, 2200, 0.88);
  if (f.size > 10 * 1024 * 1024) throw new Error('Arquivo maior que 10 MB.');
  const ext = f.type === 'application/pdf' ? 'pdf' : (f.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const caminho = `${aluno.id}/${tipo || entidade}/${uid('d')}.${ext}`;
  const { error } = await supabase.storage.from('documentos-atleta').upload(caminho, f, { contentType: f.type, upsert: false });
  if (error) throw error;
  const doc = { id: uid('doc'), tipo: tipo || null, entidade: entidade || null, descricao: (descricao || '').trim(), nome: arquivo.name, caminho, mime: f.type, tamanho: f.size, enviadoEm: new Date().toISOString(), enviadoPor: por };
  let substituido = null;
  setDB((d) => {
    const x = d.alunos.find((a) => a.id === aluno.id);
    if (!x) return;
    const lista = x.documentos || [];
    if (tipo) substituido = lista.find((o) => o.tipo === tipo) || null; // item padrão: substitui
    x.documentos = [...lista.filter((o) => !(tipo && o.tipo === tipo)), doc];
  });
  if (substituido?.caminho) supabase.storage.from('documentos-atleta').remove([substituido.caminho]).catch(() => {});
  return doc;
}

export async function removerDocumento(aluno, doc) {
  setDB((d) => {
    const x = d.alunos.find((a) => a.id === aluno.id);
    if (x) x.documentos = (x.documentos || []).filter((o) => o.id !== doc.id);
  });
  await supabase.storage.from('documentos-atleta').remove([doc.caminho]).catch(() => {});
}

export async function urlDocumento(caminho, baixar = false) {
  const { data, error } = await supabase.storage.from('documentos-atleta').createSignedUrl(caminho, 600, baixar ? { download: true } : undefined);
  if (error) throw error;
  return data.signedUrl;
}

/** Quantos dos documentos padrão o atleta já enviou */
export const progressoDocumentos = (aluno) => {
  const docs = aluno?.documentos || [];
  const feitos = TIPOS_DOC.filter((t) => docs.some((d) => d.tipo === t.id)).length;
  return { feitos, total: TIPOS_DOC.length, extras: docs.filter((d) => d.entidade).length };
};
