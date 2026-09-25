import { uid, todayISO, addDays } from './utils';

export const FOCCUS_LINK = 'https://www.foccusinvest.com.br/registrar?ref=G5CL4-ASSOCIACAO';

// Sistema oficial de graduação Mao Quan Kung Fu Wushu
// cor = cor da faixa · ponta = cor da ponta · hanzi = cor do bordado (faixas pretas)
const COR = { branca: '#f5f5f5', vermelha: '#d0121b', cinza: '#9a9a9a', amarela: '#f2c230', verde: '#2e9e4f', azul: '#2463c9', preta: '#111111', dourado: '#d4a017' };
const fx = (nivel, nome, cor, extra = {}) => ({ nivel, nome, cor, ponta: null, hanzi: null, ...extra });
export const NIVEIS = ['Iniciante', 'Intermediária', 'Avançado', 'Professor'];
export const FAIXAS_PADRAO = [
  fx('Iniciante', 'Branca Ponta Vermelha', COR.branca, { ponta: COR.vermelha }),
  fx('Iniciante', 'Branca', COR.branca),
  fx('Iniciante', 'Branca Ponta Cinza', COR.branca, { ponta: COR.cinza }),
  fx('Iniciante', 'Cinza', COR.cinza),
  fx('Iniciante', 'Cinza Ponta Amarela', COR.cinza, { ponta: COR.amarela }),
  fx('Intermediária', 'Amarela', COR.amarela),
  fx('Intermediária', 'Amarela Ponta Verde', COR.amarela, { ponta: COR.verde }),
  fx('Intermediária', 'Verde', COR.verde),
  fx('Intermediária', 'Verde Ponta Azul', COR.verde, { ponta: COR.azul }),
  fx('Avançado', 'Azul', COR.azul),
  fx('Avançado', 'Azul Ponta Vermelha', COR.azul, { ponta: COR.vermelha }),
  fx('Avançado', 'Vermelha', COR.vermelha),
  fx('Avançado', 'Vermelha Ponta Preta', COR.vermelha, { ponta: COR.preta }),
  ...[1, 2, 3, 4].map((d) => fx('Professor', `Preta ${d}º Duan (Hanzi Vermelho)`, COR.preta, { hanzi: COR.vermelha })),
  ...[1, 2, 3, 4].map((d) => fx('Professor', `Preta ${d}º Duan (Hanzi Dourado)`, COR.preta, { hanzi: COR.dourado })),
  fx('Professor', 'Preta (Hanzi Branco)', COR.preta, { hanzi: '#ffffff' }),
];
export const IDX_PRIMEIRA_PRETA = FAIXAS_PADRAO.findIndex((f) => f.nivel === 'Professor');
// Conversão do sistema antigo (9 faixas) para o oficial
export const MAPA_FAIXAS_ANTIGAS = [1, 5, 5, 7, 9, 9, 11, 11, 13];

const DIRETORIA_2025 = [
  ['Presidente', ['Mestre FRANCISCO CRIZANTE OLIVEIRA SILVA (Shifu)']],
  ['Vice Presidente', ['Laoshi GILSON BEZERRA DO NASCIMENTO']],
  ['Departamento Financeiro', ['Jiǎngshī WALDIR RODRIGUES CUSTÓDIO DA SILVA']],
  ['Secretário', ['Laoshi ALMIR PEREIRA DA SILVA']],
  ['Dep. Técnico', ['Laoshi ALAN MORAIS DE SOUZA', 'Laoshi ALISSON ROBERTO BONIFÁCIO DA SILVA SANTOS', 'Laoshi FERNANDO HENRIQUE JESUS OLIVEIRA']],
  ['Dep. Esportivo', ['Laoshi ALMIR PEREIRA DA SILVA']],
  ['Dep. Sanda', ['Laoshi ALAN MORAIS DE SOUZA']],
  ['Dep. Tai Chi Chuan', ['Jiàoliàn JOSÉNILSON COSTA DE OLIVEIRA', 'Jiàoliàn LILIAN STOCCO']],
  ['Dep. Marketing', ['Jiàoliàn JOSÉNILSON COSTA DE OLIVEIRA', 'Jiǎngshī WALDIR RODRIGUES CUSTÓDIO DA SILVA']],
  ['Dep. Geral Conselheiros', ['Shifu FRANCISCO CRIZANTE OLIVEIRA SILVA', 'Laoshi EXPEDITO ZEZA DE MORAIS', 'Laoshi GILSON BEZERRA DO NASCIMENTO', 'Laoshi VALDEMAR FRANCISCO DA SILVA']],
];

// Carteirinha oficial: posições em % do cartão (modelo 1000 x 652)
const campoCart = (key, label, x, y, size = 2.6, extra = {}) => ({ key, label, x, y, size, visible: true, ...extra });
export const CAMPOS_PADRAO = () => [
  campoCart('nome', 'Nome', 21, 40.6),
  campoCart('rg', 'RG', 21, 54),
  campoCart('cpf', 'CPF', 45.7, 54),
  campoCart('nascimento', 'Nascimento', 21, 67.2),
  campoCart('graduacao', 'Graduação', 45.7, 67.2),
  campoCart('escola', 'Escola', 21, 80.4),
  campoCart('validade', 'Validade', 45.7, 80.4),
  campoCart('foto', 'Foto', 72.2, 23.7, 21.3),
  campoCart('qr', 'QR Code', 78.3, 73.5, 9, { visible: false }),
];

export const MODELOS_PADRAO = () => ({
  aluno: { oficial: true, graduacao: 'faixa', rotulo: 'Aluno', corRotulo: '#ffffff', hanzi: '學生', pinyin: 'Xuéshēng', cor: '#e2101b', mostrarPunho: true, frente: null, verso: 'carteirinha/verso-aluno.jpg', fields: CAMPOS_PADRAO() },
  professor: { oficial: true, graduacao: 'nivel', rotulo: 'Professor', corRotulo: '#d0121b', hanzi: '老師', pinyin: 'Lǎoshī', cor: '#f5e61a', mostrarPunho: true, frente: null, verso: 'carteirinha/verso-professor.jpg', fields: CAMPOS_PADRAO() },
  atleta: { oficial: true, graduacao: 'faixa', rotulo: 'Atleta', corRotulo: '#ffffff', hanzi: '運動員', pinyin: 'Yùndòngyuán', cor: '#141414', mostrarPunho: true, frente: null, verso: 'carteirinha/verso-aluno.jpg', fields: CAMPOS_PADRAO() },
});


export function seed() {
  const hoje = todayISO();
  const filiais = [
    'Sede (Matriz)', 'Osasco', 'Filial 03', 'Filial 04', 'Filial 05', 'Filial 06', 'Filial 07', 'Filial 08', 'Filial 09',
  ].map((nome, i) => ({
    id: 'fil' + (i + 1),
    nome,
    cidade: i === 1 ? 'Osasco - SP' : 'São Paulo - SP',
    endereco: '',
    professorId: null,
    mensalidade: 120,
    aulasSemana: 2,
    minFrequencia: 75,
    maxFaltas: 6,
    ativa: true,
  }));

  return {
    versao: 1,
    filiais,
    professores: [],
    alunos: [],
    pagamentos: [],
    presencas: [],
    materiais: [
      { id: uid('m'), titulo: 'Bases fundamentais (Ma Bu, Gong Bu, Pu Bu)', tipo: 'base', faixaIdx: 0, url: '', arquivo: null, descricao: 'Posturas básicas do estilo. Substitua pelo link do vídeo oficial.', publico: 'aluno', criadoEm: hoje },
      { id: uid('m'), titulo: 'Taolu da Faixa Amarela', tipo: 'taolu', faixaIdx: 1, url: '', arquivo: null, descricao: 'Sequência oficial da faixa amarela.', publico: 'aluno', criadoEm: hoje },
      { id: uid('m'), titulo: 'Didática para Laoshi — Módulo 1', tipo: 'teoria', faixaIdx: 0, url: '', arquivo: null, descricao: 'Capacitação técnica para professores.', publico: 'professor', criadoEm: hoje },
    ],
    eventos: [
      { id: uid('e'), titulo: 'Exame de Graduação Semestral', tipo: 'exame', data: addDays(hoje, 30), hora: '09:00', local: 'Sede (Matriz)', descricao: 'Exame oficial de troca de faixa. Somente alunos aptos no pré-exame.', capa: null, meet: '', publico: 'todos', confirmados: [] },
      { id: uid('e'), titulo: 'Reunião de Professores', tipo: 'reuniao', data: addDays(hoje, 10), hora: '20:00', local: 'Online', descricao: 'Alinhamento técnico e calendário.', capa: null, meet: 'https://meet.google.com/', publico: 'professores', confirmados: [] },
    ],
    comunicados: [
      { id: uid('c'), titulo: 'Bem-vindos ao Mao Quan Conecta', texto: 'A nova plataforma oficial da Associação já está no ar. Mantenham os cadastros dos alunos atualizados.', tipo: 'circular', destino: 'professores', data: new Date().toISOString() },
    ],
    notificacoes: [],
    diretoria: DIRETORIA_2025.map(([cargo, membros]) => ({ id: uid('d'), cargo, membros })),
    precos: [
      { id: uid('p'), nome: 'Mensalidade padrão', valor: 120, descricao: 'Valor base — cada filial pode ter valor próprio.' },
      { id: uid('p'), nome: 'Filiação Professor — Anual à vista', valor: 300, descricao: 'Inclui placa personalizada e certificado de alvará.' },
      { id: uid('p'), nome: 'Filiação Professor — Anual em 3x', valor: 100, descricao: '3 parcelas mensais de R$ 100,00.' },
      { id: uid('p'), nome: 'Filiação Professor — Anual em 6x', valor: 50, descricao: '6 parcelas mensais de R$ 50,00.' },
      { id: uid('p'), nome: 'Taxa de Exame de Graduação', valor: 80, descricao: 'Gerada somente após pré-avaliação “Apto”.' },
    ],
    modelos: MODELOS_PADRAO(),
    config: {
      adminEmail: 'maoquankungfuwushu@gmail.com',
      whatsapp: '5511949632186',
      suporteNome: 'Grupo WD - Waldir Rodrigues',
      pixChave: 'maochuenloja@gmail.com',
      pixNome: 'MAO QUAN KUNG FU WUSHU',
      pixCidade: 'SAO PAULO',
      infinitePay: '',
      lojaOficial: '',
      investimentoAtivo: true,
      investimentoLink: FOCCUS_LINK,
      codigoRef: 'G5CL4-ASSOCIACAO',
      diaVencimento: 10,
      lembreteDiasAntes: 3,
      diasTolerancia: 5,
      taxaExame: 80,
      // Filiação anual do professor: à vista, 3x ou 6x (cobrança recorrente com renovação automática)
      planosFiliacao: [
        { id: 'avista', nome: 'Anual à vista', parcelas: 1, valorParcela: 300 },
        { id: '3x', nome: 'Anual em 3x', parcelas: 3, valorParcela: 100 },
        { id: '6x', nome: 'Anual em 6x', parcelas: 6, valorParcela: 50 },
      ],
      renovacaoDiasAntes: 30,
      faixas: FAIXAS_PADRAO,
      polos: ['Equipe Sede', 'Equipe Osasco'],
    },
    termos: {
      versao: 1,
      imagem:
        'Autorizo, de forma gratuita, o uso da minha imagem e voz (ou do menor sob minha responsabilidade) em fotos e vídeos produzidos em aulas, eventos, exames e campeonatos da Associação Mao Quan Kung Fu Wushu, para fins institucionais e de divulgação.',
      regulamento:
        'Declaro conhecer e cumprir o regulamento interno: pontualidade, uso do uniforme oficial, respeito aos horários, zelo pelo espaço de treino e cumprimento das obrigações financeiras da filial.',
      etica:
        'Comprometo-me com o código de ética marcial (Wu De): humildade, respeito, retidão, confiança e lealdade à Associação, ao Mestre, aos professores e aos colegas de treino, não utilizando as técnicas aprendidas de forma irresponsável.',
      atleta:
        'Como atleta convocado, comprometo-me a cumprir a frequência mínima dos treinos da equipe oficial, manter conduta exemplar dentro e fora das competições e representar a Associação com disciplina e respeito.',
    },
    institucional: {
      historia:
        'Espaço para a história do estilo Mao Chuen / Mao Quan (猫拳 — “Punho do Gato”). Edite este texto no painel do Administrador › Institucional.',
      biografia:
        'Mestre Francisco Crizante Oliveira Silva (Shifu) — Presidente da Associação Mao Quan Kung Fu Wushu. Edite a biografia completa no painel do Administrador.',
      linhagem: [
        { geracao: '1ª geração', nome: 'Fundador do estilo (editar)' },
        { geracao: '2ª geração', nome: 'Mestre (editar)' },
        { geracao: 'Atual', nome: 'Shifu Francisco Crizante Oliveira Silva' },
      ],
      wude: [
        { grupo: 'Virtudes da Ação (手德)', itens: ['Qian Xu — Humildade', 'Zun Jing — Respeito', 'Zheng Yi — Retidão', 'Xin Yong — Confiança', 'Zhong Cheng — Lealdade'] },
        { grupo: 'Virtudes da Mente (心德)', itens: ['Yi Zhi — Vontade', 'Ren Nai — Resistência', 'Heng Xin — Perseverança', 'Yi Li — Paciência', 'Yong Gan — Coragem'] },
      ],
    },
  };
}
