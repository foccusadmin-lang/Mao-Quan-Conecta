// Declaração da Associação (atleta filiado à FPKF / CBKW): A4, com os dados do atleta e a data do dia.
import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { useDB, setDB, modalidadesAluno, DIAS_SEMANA } from '../lib/db';
import { maskCPF, maskRG } from '../lib/utils';
import { Card, Field, toast } from './ui';
import { imprimirImagens } from '../lib/imprimir';

const DIAS = { 1: 'Segunda-feira', 2: 'Terça-feira', 3: 'Quarta-feira', 4: 'Quinta-feira', 5: 'Sexta-feira', 6: 'Sábado', 0: 'Domingo' };
const ORDEM = [1, 2, 3, 4, 5, 6, 0];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const dataPorExtenso = (d = new Date()) => `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
const W = 1654; // largura da exportação (A4 a 200 dpi)

/** Horários de treino do atleta a partir da grade da filial (dias + início/fim de cada aula escolhida) */
function horariosDaGrade(db, a) {
  const grade = db.filiais.flatMap((f) => f.horarios || []);
  const linhas = [];
  for (const h of grade.filter((x) => a.horarios?.includes(x.id))) {
    const dias = h.dias?.length ? h.dias : [1, 2, 3, 4, 5, 6];
    for (const d of dias) linhas.push({ dia: d, inicio: h.inicio, fim: h.fim });
  }
  return linhas.sort((x, y) => ORDEM.indexOf(x.dia) - ORDEM.indexOf(y.dia) || x.inicio.localeCompare(y.inicio));
}

/** Dados da declaração: o que foi editado na declaração vale sobre o cadastro */
export function dadosDeclaracao(db, a) {
  const d = a.declaracao || {};
  const mods = modalidadesAluno(db, a);
  return {
    nome: d.nome || a.nome || '',
    rg: d.rg || a.rg || '',
    cpf: d.cpf || a.cpf || '',
    modalidade: d.modalidade || mods.join(' e ') || '',
    genero: d.genero || '',
    horarios: d.horarios?.length ? d.horarios : horariosDaGrade(db, a),
  };
}

/**
 * Horários agrupados por dia da semana (uma linha por dia) e intervalos seguidos unidos:
 * Terça 16:00–17:00 + 17:00–18:00 + 19:00–20:30 → "16:00 às 18:00 e 19:00 às 20:30"
 */
export function horariosPorDia(horarios = []) {
  const porDia = new Map();
  for (const h of horarios) {
    if (!h.inicio && !h.fim) continue;
    if (!porDia.has(h.dia)) porDia.set(h.dia, []);
    porDia.get(h.dia).push([h.inicio || '', h.fim || '']);
  }
  return ORDEM.filter((dia) => porDia.has(dia)).map((dia) => {
    const faixas = porDia.get(dia).sort((a, b) => a[0].localeCompare(b[0]));
    const unidas = [];
    for (const [a, b] of faixas) {
      const ult = unidas.at(-1);
      if (ult && a && ult[1] && a <= ult[1]) ult[1] = b > ult[1] ? b : ult[1];
      else unidas.push([a, b]);
    }
    return { dia, faixas: unidas };
  });
}

/** A folha A4 (unidades cqw: tudo escala com a largura). Data e assinatura vêm depois do texto: nunca ficam por baixo dele */
export function DeclaracaoVisual({ d, innerRef }) {
  const fem = d.genero === 'f';
  const masc = d.genero === 'm';
  const art = fem ? 'a' : masc ? 'o' : 'o(a)';
  const port = fem ? 'portadora' : masc ? 'portador' : 'portador(a)';
  const dias = horariosPorDia(d.horarios);
  const emBranco = !dias.length; // sem horários: linhas para preencher à mão, como no modelo
  const linhas = emBranco ? [1, 2, 4, 5, 6].map((dia) => ({ dia, faixas: [['', '']] })) : dias;
  // Muitos dias / horários longos: aproxima as linhas para caber na página
  const longas = linhas.filter((l) => l.faixas.length > 2).length;
  const passo = linhas.length + longas > 6 ? 7 : 12;
  const t = (pt) => `${(pt / 595.32) * 100}cqw`; // tamanho em pontos do PDF original
  const b = { fontWeight: 700 };
  const vazio = (w) => <span style={{ display: 'inline-block', minWidth: t(w), borderBottom: `${t(0.7)} solid #111` }}>{'\u00a0'}</span>;
  return (
    <div style={{ containerType: 'inline-size', width: '100%' }}>
      <div ref={innerRef} style={{ position: 'relative', width: '100%', aspectRatio: '210 / 297', background: '#fff', color: '#111', fontFamily: 'Calibri, Carlito, "Segoe UI", Arial, sans-serif', overflow: 'hidden' }}>
        <img src="./declaracao/marca-dagua.jpg" alt="" style={{ position: 'absolute', left: '16.5%', top: '29.5%', width: '67%' }} />
        <div style={{ position: 'absolute', inset: 0, padding: `${t(46)} ${t(76)} ${t(26)} ${t(85)}`, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: '#e10600', fontWeight: 900, fontSize: t(22), letterSpacing: '.01em', fontFamily: 'Impact, "Arial Narrow", "Segoe UI", sans-serif' }}>ASSOCIAÇÃO MAO QUAN KUNG FU WUSHU</div>
              <div style={{ borderTop: `${t(0.8)} solid #e86a2a`, width: t(363), margin: `${t(8)} 0 ${t(6)}` }} />
              <div style={{ fontSize: t(12), lineHeight: 1.25 }}>Filiado(a) à Federação Paulista de Kung Fu (FPKF)<br />Filiado(a) à Confederação Brasileira de Kung Fu (CBKW)</div>
            </div>
            <img src="./declaracao/logo.jpg" alt="" style={{ width: t(86), marginTop: t(-6) }} />
          </div>

          <p style={{ fontSize: t(12), lineHeight: 1.45, textAlign: 'justify', margin: `${t(26)} 0 0` }}>
            A entidade <span style={b}>Associação Mao Quan Kung-fu Wushu</span>, inscrita no CNPJ sob o nº <span style={b}>69.451.196/0001-37</span>, com sede na Rua Dinamarca, 30, Vila Engenho Novo, CEP 06416-100, Barueri/SP, vem por meio desta <span style={b}>DECLARAR</span> que {art} atleta{' '}
            <span style={b}>{d.nome || '________________'}</span>, {port} do RG nº <span style={b}>{d.rg ? maskRG(d.rg) : '____________'}</span> e do CPF nº{' '}
            <span style={b}>{d.cpf ? maskCPF(d.cpf) : '______________'}</span>, praticante da modalidade <span style={b}>{d.modalidade || '__________'}</span>, faz parte do nosso quadro de atletas e treina regularmente nos seguintes dias e horários:
          </p>

          <ul style={{ listStyle: 'none', fontSize: t(12), fontWeight: 700, margin: `${t(passo === 12 ? 22 : 14)} 0 0`, paddingLeft: t(36), lineHeight: 1.3 }}>
            {linhas.map((l) => (
              <li key={l.dia} style={{ margin: `0 0 ${t(passo)}`, display: 'flex', gap: t(6) }}>
                <span style={{ flex: 'none', width: t(12), marginLeft: t(-18) }}>•</span>
                <span style={{ flex: 'none', width: t(100) }}>{DIAS[l.dia]} das</span>
                <span>
                  {l.faixas.map(([a, z], i) => (
                    <span key={i} style={{ whiteSpace: 'nowrap' }}>
                      {i > 0 && (i === l.faixas.length - 1 ? ' e ' : ', ')}
                      {a || vazio(60)} às {z || vazio(60)}
                    </span>
                  ))}{' '}
                  Horas
                </span>
              </li>
            ))}
          </ul>

          <p style={{ fontSize: t(12), fontWeight: 700, lineHeight: 1.4, textAlign: 'justify', textIndent: t(36), margin: `${t(passo === 12 ? 26 : 14)} 0 0` }}>
            DECLARAMOS AINDA QUE {fem ? 'A' : masc ? 'O' : 'O(A)'} ATLETA NÃO RECEBE, POR PARTE DESTA ENTIDADE, NENHUM TIPO DE BOLSA OU QUALQUER OUTRA FORMA REGULAR DE PAGAMENTO EM VALOR PECUNIÁRIO.
          </p>

          {/* Espaço flexível: com pouco texto a data fica na posição do modelo; com muito, ela desce junto sem sobrepor */}
          <div style={{ flex: '1 1 auto', minHeight: t(18), maxHeight: t(170) }} />
          <div style={{ alignSelf: 'flex-end', fontSize: t(12), marginRight: t(12) }}>Barueri, {dataPorExtenso()}.</div>
          <div style={{ flex: '1 1 auto', minHeight: t(36), maxHeight: t(84) }} />

          <div style={{ textAlign: 'center', fontSize: t(12), lineHeight: 1.3, marginLeft: t(-9) }}>
            <div style={{ borderTop: `${t(0.8)} solid #111`, width: t(226), margin: `0 auto ${t(8)}` }} />
            Francisco Crizante
            <div style={{ fontStyle: 'italic' }}>Técnico e Gestor</div>
          </div>
          <div style={{ flex: '1 1 auto', minHeight: t(16) }} />
          <div style={{ textAlign: 'center', color: '#e10600', fontSize: t(12), lineHeight: 1.3, marginLeft: t(-9) }}>
            <b>– ASSOCIAÇÃO MAO QUAN KUNG FU WUSHU –</b>
            <br />CNPJ 69.451.196/0001-37
            <br />Rua Dinamarca, 30 - Vila Engenho Novo - Barueri/SP - CEP 06416-100
          </div>
        </div>
      </div>
    </div>
  );
}

export async function gerarImagem(node) {
  const escala = W / node.getBoundingClientRect().width;
  return toJpeg(node, { pixelRatio: escala, cacheBust: true, backgroundColor: '#ffffff', quality: 0.92 });
}

/** Imprime ou baixa várias páginas A4 (uma imagem por página) */
export function entregar(imagens, formato, arquivo) {
  if (formato === 'pdf') {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    imagens.forEach((img, i) => {
      if (i) pdf.addPage();
      pdf.addImage(img, 'JPEG', 0, 0, 210, 297);
    });
    pdf.save(`${arquivo}.pdf`);
    return;
  }
  return imprimirImagens(imagens, { orientacao: 'portrait', titulo: arquivo });
}

/**
 * Declarações de vários alunos de uma vez (um PDF com uma página por aluno, ou impressão única).
 * Cada folha é montada fora da tela, convertida em imagem e descartada.
 */
export const declaracoesEmLote = (db, alunos, formato, aoProgresso) =>
  documentosEmLote(alunos, (a, ref) => <DeclaracaoVisual d={dadosDeclaracao(db, a)} innerRef={ref} />, formato, 'declaracao', aoProgresso);

/** Gera um documento A4 por aluno (montado fora da tela) e entrega tudo num PDF ou numa impressão só */
export async function documentosEmLote(alunos, renderizar, formato, prefixo, aoProgresso) {
  const caixa = document.createElement('div');
  caixa.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:#fff';
  document.body.appendChild(caixa);
  const root = createRoot(caixa);
  const imagens = [];
  try {
    for (const [i, a] of alunos.entries()) {
      aoProgresso?.(i + 1, alunos.length);
      let no = null;
      await new Promise((ok) => {
        root.render(renderizar(a, (n) => (no = n)));
        setTimeout(ok, 60);
      });
      await Promise.all([...caixa.querySelectorAll('img')].map((im) => (im.complete ? 0 : new Promise((r) => ((im.onload = r), (im.onerror = r))))));
      // Documento com várias folhas (data-pagina): uma imagem por folha
      const folhas = [...caixa.querySelectorAll('[data-pagina]')];
      for (const n of folhas.length ? folhas : [no]) imagens.push(await gerarImagem(n));
    }
  } finally {
    root.unmount();
    caixa.remove();
  }
  await entregar(imagens, formato, (alunos.length === 1 ? `${prefixo}-${alunos[0].nome}` : `${prefixo}-${alunos.length}-alunos`).replace(/[^\w-]+/g, '_'));
}

/** Campos da declaração que fazem sentido aplicar a vários alunos de uma vez (os dados pessoais ficam de cada um) */
const CAMPOS_GERAIS = ['genero', 'modalidade', 'horarios'];

/** Perfil do atleta: visualizar, editar, imprimir e baixar a declaração (a data é sempre a do dia) */
export function DeclaracaoAtleta({ aluno, todos, titulo }) {
  const db = useDB();
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState(null);
  const d = dadosDeclaracao(db, aluno);
  const arquivo = `declaracao-${d.nome}`.replace(/[^\w-]+/g, '_');

  const exportar = async (formato) => {
    setBusy(true);
    try {
      await entregar([await gerarImagem(ref.current)], formato, arquivo);
    } catch (e) {
      toast('Falha ao gerar: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const limpo = () => ({
    ...edit,
    nome: edit.nome.trim(),
    modalidade: edit.modalidade.trim(),
    horarios: edit.horarios.filter((h) => h.inicio || h.fim),
  });
  const salvar = () => {
    const l = limpo();
    setDB((dd) => {
      const x = dd.alunos.find((y) => y.id === aluno.id);
      if (x) x.declaracao = { ...l, atualizadoEm: new Date().toISOString() };
    });
    setEdit(null);
    toast('Declaração atualizada só para ' + (l.nome || aluno.nome) + '.');
  };
  // Aplica a todos os alunos da lista só o que mudou (tratamento, modalidade, horários); nome, RG e CPF ficam de cada um
  const salvarTodos = () => {
    const l = limpo();
    const mudou = CAMPOS_GERAIS.filter((k) => JSON.stringify(l[k]) !== JSON.stringify(d[k]));
    if (!mudou.length) return toast('Nada para aplicar a todos: altere o tratamento, a modalidade ou os horários.');
    const nomes = { genero: 'tratamento', modalidade: 'modalidade', horarios: 'dias e horários' };
    if (!window.confirm(`Aplicar ${mudou.map((k) => nomes[k]).join(', ')} a ${todos.length} aluno(s)? Nome, RG e CPF continuam os de cada um.`)) return;
    const agora = new Date().toISOString();
    setDB((dd) => {
      for (const t of todos) {
        const x = dd.alunos.find((y) => y.id === t.id);
        if (!x) continue;
        const base = x.declaracao || {};
        x.declaracao = { ...base, ...Object.fromEntries(mudou.map((k) => [k, l[k]])), atualizadoEm: agora };
      }
      // Os dados pessoais editados valem para este aluno
      const x = dd.alunos.find((y) => y.id === aluno.id);
      if (x) x.declaracao = { ...x.declaracao, nome: l.nome, rg: l.rg, cpf: l.cpf };
    });
    setEdit(null);
    toast(`Alteração aplicada a ${todos.length} aluno(s).`);
  };
  const restaurar = () => {
    setDB((dd) => {
      const x = dd.alunos.find((y) => y.id === aluno.id);
      if (x) delete x.declaracao;
    });
    setEdit(null);
    toast('Declaração refeita com os dados do cadastro.');
  };
  const mudaH = (i, patch) => setEdit({ ...edit, horarios: edit.horarios.map((h, j) => (j === i ? { ...h, ...patch } : h)) });

  return (
    <Card title={titulo || '📄 Declaração da Associação (FPKF / CBKW)'}>
      <p className="xs muted" style={{ marginTop: 0 }}>{todos ? 'Preenchida com os dados do aluno.' : 'Preenchida com seus dados.'} A data é sempre a do dia em que você imprime ou baixa.</p>
      <div className="row mb" style={{ gap: 6, flexWrap: 'wrap' }}>
        <button className="btn sm" disabled={busy} onClick={() => exportar('pdf')}>⬇ Baixar PDF</button>
        <button className="btn sm ghost" disabled={busy} onClick={() => exportar('print')}>🖨 Imprimir</button>
        {!edit && <button className="btn sm ghost" onClick={() => setEdit({ ...d, horarios: d.horarios.map((h) => ({ ...h })) })}>✏️ Editar</button>}
      </div>

      {edit && (
        <div className="card mb" style={{ background: '#faf8f6' }}>
          <div className="form-grid">
            <Field label="Nome completo"><input value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} /></Field>
            <Field label="Tratamento no texto">
              <select value={edit.genero} onChange={(e) => setEdit({ ...edit, genero: e.target.value })}>
                <option value="">o(a) atleta, portador(a)</option>
                <option value="f">a atleta, portadora</option>
                <option value="m">o atleta, portador</option>
              </select>
            </Field>
            <Field label="RG"><input value={maskRG(edit.rg || '')} onChange={(e) => setEdit({ ...edit, rg: maskRG(e.target.value) })} maxLength={12} /></Field>
            <Field label="CPF"><input value={maskCPF(edit.cpf || '')} inputMode="numeric" onChange={(e) => setEdit({ ...edit, cpf: maskCPF(e.target.value) })} maxLength={14} /></Field>
            <Field label="Modalidade" style={{ gridColumn: '1/-1' }}><input value={edit.modalidade} onChange={(e) => setEdit({ ...edit, modalidade: e.target.value })} placeholder="Ex.: Tai Chi Chuan" /></Field>
          </div>
          {todos?.length > 1 && <div className="xs muted mb">Ao aplicar a todos, vão para os demais alunos só o tratamento, a modalidade e os dias e horários que você mudar. Nome, RG e CPF são sempre de cada aluno.</div>}
          <b className="small">Dias e horários de treino</b>
          {edit.horarios.map((h, i) => (
            <div key={i} className="row" style={{ gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              <select value={h.dia} onChange={(e) => mudaH(i, { dia: +e.target.value })} style={{ maxWidth: 160 }}>
                {DIAS_SEMANA.map(([dd]) => <option key={dd} value={dd}>{DIAS[dd]}</option>)}
              </select>
              <input type="time" value={h.inicio} onChange={(e) => mudaH(i, { inicio: e.target.value })} style={{ maxWidth: 120 }} />
              <span className="small">às</span>
              <input type="time" value={h.fim} onChange={(e) => mudaH(i, { fim: e.target.value })} style={{ maxWidth: 120 }} />
              <button type="button" className="btn link sm" onClick={() => setEdit({ ...edit, horarios: edit.horarios.filter((_, j) => j !== i) })}>✕</button>
            </div>
          ))}
          <button type="button" className="btn sm ghost mt" onClick={() => setEdit({ ...edit, horarios: [...edit.horarios, { dia: 1, inicio: '', fim: '' }] })}>+ Dia de treino</button>
          {todos?.length > 1 && <div className="small mt" style={{ fontWeight: 600 }}>Deseja alterar apenas este aluno ou todos os alunos?</div>}
          <div className="row mt" style={{ gap: 6, flexWrap: 'wrap' }}>
            <button className="btn" onClick={salvar}>{todos?.length > 1 ? `Salvar só para ${(edit.nome || aluno.nome).split(' ')[0]}` : 'Salvar declaração'}</button>
            {todos?.length > 1 && <button className="btn dark" onClick={salvarTodos}>Aplicar a todos os {todos.length} alunos</button>}
            <button className="btn ghost" onClick={() => setEdit(null)}>Cancelar</button>
            {aluno.declaracao && <button className="btn ghost" onClick={restaurar}>↺ Usar dados do cadastro</button>}
          </div>
        </div>
      )}

      <div style={{ maxWidth: 620, margin: '0 auto', boxShadow: '0 6px 24px rgba(0,0,0,.12)', borderRadius: 4, overflow: 'hidden' }}>
        <DeclaracaoVisual d={edit || d} innerRef={ref} />
      </div>
    </Card>
  );
}
