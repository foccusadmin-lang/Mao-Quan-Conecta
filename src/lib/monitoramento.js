// Monitoramento de Performance — Equipe de Competição (formulário pós-treino do atleta)
import { supabase } from './supabase';
import { uid } from './utils';

/** Cores das faixas de nota (verde → azul → amarelo → laranja → vermelho) */
export const COR = { verde: '#1f9d55', azul: '#1e6fd9', amarelo: '#e8b100', laranja: '#f06a1d', vermelho: '#dc2f2f' };

export const TREINOS = [
  ['tecnico', 'Técnico'],
  ['forca', 'Força'],
  ['tecnico_forca', 'Técnico e Força'],
];
export const nomeTreino = (k) => TREINOS.find(([t]) => t === k)?.[1] || k || '—';

/**
 * Escalas do formulário. Cada faixa: [mín, máx, cor, título, descrição].
 * Em recuperação, foco e clima, nota alta é bom (verde); no esforço (PSE) a cor segue a intensidade (verde = leve, vermelho = máximo).
 */
export const ESCALAS = [
  {
    k: 'recuperacao', sigla: 'ERS', titulo: 'Recuperação Subjetiva (ERS)', pergunta: 'Como seu corpo e sua mente chegaram para o treino?',
    faixas: [
      [9, 10, COR.verde, 'Total', 'Energia máxima, sem dores, mente pronta.'],
      [7, 8, COR.azul, 'Bom', 'Recuperado, pronto para treinar forte.'],
      [5, 6, COR.amarelo, 'Médio', 'Um pouco de dor muscular, sono razoável.'],
      [3, 4, COR.laranja, 'Cansado', 'Corpo pesado, mente fadigada.'],
      [1, 2, COR.vermelho, 'Exausto', 'Risco de lesão, muito sono, dor intensa.'],
    ],
  },
  {
    k: 'foco', sigla: 'Foco', titulo: 'Foco Mental', pergunta: 'Avalie sua concentração. 10 = totalmente presente em cada movimento; notas baixas = distraído com coisas de fora do treino.',
    faixas: [
      [9, 10, COR.verde, 'Estado de Fluxo', 'Respiração sincronizada com o movimento. Olhar fixo, cortante e concentrado. Sente cada músculo trabalhando.'],
      [7, 8, COR.azul, 'Focado', 'Concentrado na maior parte do treino. Corrige os erros rapidamente quando apontados.'],
      [5, 6, COR.amarelo, 'Disperso', 'Mente “viajando”. Conversas paralelas ocasionais. Movimento no “automático”, sem intenção marcial.'],
      [3, 4, COR.laranja, 'Desatento', 'Esquece sequências da forma. Olha o relógio ou os outros atletas. Mais tempo conversando do que treinando.'],
      [1, 2, COR.vermelho, 'Ausente', 'Não ouve as correções do treinador. Presença física, mas a mente fora do WuGuan.'],
    ],
  },
  {
    k: 'esforco', sigla: 'PSE', titulo: 'Percepção de Esforço (PSE)', pergunta: 'Quão pesado foi o treino de hoje para você?',
    faixas: [
      [10, 10, COR.vermelho, 'Máximo', '“Vou desmaiar, não aguento nem mais um passo.”'],
      [7, 9, COR.laranja, 'Muito Forte', '“Muito difícil manter a técnica, respiração ofegante.”'],
      [5, 6, COR.amarelo, 'Forte', '“Treino pesado, mas consegui terminar bem.”'],
      [3, 4, COR.azul, 'Moderado', '“Suando, mas o ritmo está sob controle.”'],
      [1, 2, COR.verde, 'Leve', '“Muito fácil, como um aquecimento longo.”'],
    ],
  },
  {
    k: 'clima', sigla: 'Clima', titulo: 'Clima Marcial e Silêncio', pergunta: 'O quanto você respeitou a disciplina do grupo? Você ajudou a manter a concentração?',
    faixas: [
      [9, 10, COR.verde, 'Muito Bom', '“Não falei nada fora do treino. Estive presente em cada movimento.”'],
      [7, 8, COR.azul, 'Bom', '“Falei o necessário sobre o treino, mas me distraí uma ou duas vezes.”'],
      [4, 6, COR.amarelo, 'Disperso', '“Participei de conversas paralelas e perdi o ritmo do treino.”'],
      [1, 3, COR.vermelho, 'Ruim', '“Falei mais do que treinei e senti que atrapalhei o ambiente.”'],
    ],
  },
];
export const faixaDaNota = (esc, n) => {
  const v = Math.min(10, Math.max(1, Math.round(+n))); // médias (ex.: 8,5) caem na faixa mais próxima
  return esc.faixas.find(([a, b]) => v >= a && v <= b);
};

export const TEXTOS = [
  ['senti', 'Como me senti hoje', 'Seja honesto com seu estado emocional. Ex.: “Me senti frustrado porque não acertei o salto” ou “Me senti animado e motivado com a nova sequência”. Isso me faz entender seu momento.'],
  ['fizBem', 'O que fiz bem hoje?', 'Identifique um acerto específico. Ex.: “Minha base Mabu estava mais baixa e firme” ou “Consegui manter o olhar focado no final da forma”.'],
  ['melhorar', 'O que preciso melhorar para o próximo treino?', 'O que você vai corrigir? Ex.: “Preciso esticar mais o braço no soco” ou “Preciso controlar melhor a respiração para não cansar no meio da forma”.'],
];

/** Sinais de atenção para o professor */
export function alertas(r) {
  const a = [];
  if (+r.recuperacao <= 2) a.push(['🔴', 'Exausto — risco de lesão']);
  else if (+r.recuperacao <= 4) a.push(['🟠', 'Cansado']);
  if (+r.esforco >= 10) a.push(['🔴', 'Esforço máximo']);
  if (+r.foco <= 4) a.push(['🟠', 'Foco baixo']);
  if (+r.clima <= 3) a.push(['🟠', 'Clima marcial ruim']);
  return a;
}

const linha = (row) => ({ ...row.data, id: row.id, alunoId: row.aluno_id, filialId: row.filial_id, criadoEm: row.criado_em });

export async function enviarMonitoramento(alunoId, dados) {
  const { data, error } = await supabase.from('monitoramentos').insert({ id: uid('mt'), aluno_id: alunoId, data: dados }).select().single();
  if (error) throw error;
  return linha(data);
}

/** Respostas visíveis para quem está logado (o atleta vê as dele; professor, as das filiais dele; Central, todas) */
export async function listarMonitoramentos({ desde, alunoId } = {}) {
  let q = supabase.from('monitoramentos').select('*').order('criado_em', { ascending: false }).limit(2000);
  if (alunoId) q = q.eq('aluno_id', alunoId);
  if (desde) q = q.gte('data->>dataTreino', desde);
  const { data, error } = await q;
  if (error) throw error;
  // Mais recentes primeiro pela data do treino (o atleta pode enviar o de um dia anterior)
  return (data || []).map(linha).sort((a, b) => (b.dataTreino || '').localeCompare(a.dataTreino || '') || (b.criadoEm || '').localeCompare(a.criadoEm || ''));
}
