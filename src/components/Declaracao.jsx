// Declaração da Associação (atleta filiado à FPKF / CBKW): A4, com os dados do atleta e a data do dia.
import { useRef, useState } from 'react';
import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { useDB, setDB, modalidadesAluno, DIAS_SEMANA } from '../lib/db';
import { maskCPF, maskRG } from '../lib/utils';
import { Card, Field, toast } from './ui';

const DIAS = { 1: 'Segunda-feira', 2: 'Terça-feira', 3: 'Quarta-feira', 4: 'Quinta-feira', 5: 'Sexta-feira', 6: 'Sábado', 0: 'Domingo' };
const ORDEM = [1, 2, 3, 4, 5, 6, 0];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const dataPorExtenso = (d = new Date()) => `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
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

/** A folha A4 (unidades cqw: tudo escala com a largura) */
export function DeclaracaoVisual({ d, innerRef }) {
  const fem = d.genero === 'f';
  const masc = d.genero === 'm';
  const art = fem ? 'a' : masc ? 'o' : 'o(a)';
  const port = fem ? 'portadora' : masc ? 'portador' : 'portador(a)';
  const linhas = d.horarios?.length ? d.horarios : [1, 2, 4, 5, 6].map((dia) => ({ dia, inicio: '', fim: '' }));
  const t = (pt) => `${(pt / 595.32) * 100}cqw`; // tamanho em pontos do PDF original
  const b = { fontWeight: 700 };
  return (
    <div style={{ containerType: 'inline-size', width: '100%' }}>
      <div ref={innerRef} style={{ position: 'relative', width: '100%', aspectRatio: '210 / 297', background: '#fff', color: '#111', fontFamily: 'Calibri, Carlito, "Segoe UI", Arial, sans-serif', overflow: 'hidden' }}>
        <img src="./declaracao/marca-dagua.jpg" alt="" style={{ position: 'absolute', left: '16.5%', top: '29.5%', width: '67%' }} />
        <div style={{ position: 'absolute', inset: 0, padding: `${t(46)} ${t(76)} 0 ${t(85)}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: '#e10600', fontWeight: 900, fontSize: t(22), letterSpacing: '.01em', fontFamily: 'Impact, "Arial Narrow", "Segoe UI", sans-serif' }}>ASSOCIAÇÃO MAO QUAN KUNG FU WUSHU</div>
              <div style={{ borderTop: `${t(0.8)} solid #e86a2a`, width: t(363), margin: `${t(8)} 0 ${t(6)}` }} />
              <div style={{ fontSize: t(12), lineHeight: 1.25 }}>Filiado(a) à Federação Paulista de Kung Fu (FPKF)<br />Filiado(a) à Confederação Brasileira de Kung Fu (CBKW)</div>
            </div>
            <img src="./declaracao/logo.jpg" alt="" style={{ width: t(86), marginTop: t(-6) }} />
          </div>

          <p style={{ fontSize: t(12), lineHeight: 1.45, textAlign: 'justify', marginTop: t(26) }}>
            A entidade <span style={b}>Associação Mao Quan Kung-fu Wushu</span>, inscrita no CNPJ sob o nº <span style={b}>69.451.196/0001-37</span>, com sede na Rua Dinamarca, 30, Vila Engenho Novo, CEP 06416-100, Barueri/SP, vem por meio desta <span style={b}>DECLARAR</span> que {art} atleta{' '}
            <span style={b}>{d.nome || '________________'}</span>, {port} do RG nº <span style={b}>{d.rg ? maskRG(d.rg) : '____________'}</span> e do CPF nº{' '}
            <span style={b}>{d.cpf ? maskCPF(d.cpf) : '______________'}</span>, praticante da modalidade <span style={b}>{d.modalidade || '__________'}</span>, faz parte do nosso quadro de atletas e treina regularmente nos seguintes dias e horários:
          </p>

          <ul style={{ fontSize: t(12), fontWeight: 700, margin: `${t(22)} 0 0`, paddingLeft: t(36), lineHeight: 1 }}>
            {linhas.map((l, i) => (
              <li key={i} style={{ margin: `0 0 ${t(12)}` }}>
                <span style={{ display: 'inline-block', width: t(106) }}>{DIAS[l.dia]} das</span>
                <span style={{ display: 'inline-block', minWidth: t(64), textAlign: 'center', borderBottom: l.inicio ? 0 : `${t(0.7)} solid #111` }}>{l.inicio || ' '}</span>
                <span style={{ margin: `0 ${t(10)}` }}>às</span>
                <span style={{ display: 'inline-block', minWidth: t(64), textAlign: 'center', borderBottom: l.fim ? 0 : `${t(0.7)} solid #111` }}>{l.fim || ' '}</span>
                <span style={{ marginLeft: t(10) }}>Horas</span>
              </li>
            ))}
          </ul>

          <p style={{ fontSize: t(12), fontWeight: 700, lineHeight: 1.4, textAlign: 'justify', textIndent: t(36), marginTop: t(26) }}>
            DECLARAMOS AINDA QUE {fem ? 'A' : masc ? 'O' : 'O(A)'} ATLETA NÃO RECEBE, POR PARTE DESTA ENTIDADE, NENHUM TIPO DE BOLSA OU QUALQUER OUTRA FORMA REGULAR DE PAGAMENTO EM VALOR PECUNIÁRIO.
          </p>
        </div>

        <div style={{ position: 'absolute', right: t(88), top: `${((841.92 - 259) / 841.92) * 100 - 1.2}%`, fontSize: t(12) }}>Barueri, {dataPorExtenso()}.</div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: `${((841.92 - 162) / 841.92) * 100}%`, textAlign: 'center', fontSize: t(12), lineHeight: 1.3 }}>
          <div style={{ borderTop: `${t(0.8)} solid #111`, width: t(226), margin: `0 auto ${t(8)}` }} />
          Francisco Crizante
          <div style={{ fontStyle: 'italic' }}>Técnico e Gestor</div>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: t(26), textAlign: 'center', color: '#e10600', fontSize: t(12), lineHeight: 1.3 }}>
          <b>– ASSOCIAÇÃO MAO QUAN KUNG FU WUSHU –</b>
          <br />CNPJ 69.451.196/0001-37
          <br />Rua Dinamarca, 30 - Vila Engenho Novo - Barueri/SP - CEP 06416-100
        </div>
      </div>
    </div>
  );
}

async function gerarImagem(node) {
  const escala = W / node.getBoundingClientRect().width;
  return toJpeg(node, { pixelRatio: escala, cacheBust: true, backgroundColor: '#ffffff', quality: 0.92 });
}

/** Perfil do atleta: visualizar, editar, imprimir e baixar a declaração (a data é sempre a do dia) */
export function DeclaracaoAtleta({ aluno }) {
  const db = useDB();
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState(null);
  const d = dadosDeclaracao(db, aluno);
  const arquivo = `declaracao-${d.nome}`.replace(/[^\w-]+/g, '_');

  const exportar = async (formato) => {
    setBusy(true);
    try {
      const img = await gerarImagem(ref.current);
      if (formato === 'pdf') {
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        pdf.addImage(img, 'JPEG', 0, 0, 210, 297);
        pdf.save(`${arquivo}.pdf`);
      } else {
        const w = window.open('', '_blank');
        if (!w) return toast('Permita pop-ups para imprimir.');
        w.document.write(`<html><head><title>Declaração</title><style>@page{size:A4 portrait;margin:0}body{margin:0}img{width:210mm;height:297mm}</style></head><body><img src="${img}"/><script>window.onload=()=>setTimeout(()=>window.print(),250)</script></body></html>`);
        w.document.close();
      }
    } catch (e) {
      toast('Falha ao gerar: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const salvar = () => {
    const limpo = {
      ...edit,
      nome: edit.nome.trim(),
      modalidade: edit.modalidade.trim(),
      horarios: edit.horarios.filter((h) => h.inicio || h.fim),
    };
    setDB((dd) => {
      const x = dd.alunos.find((y) => y.id === aluno.id);
      if (x) x.declaracao = { ...limpo, atualizadoEm: new Date().toISOString() };
    });
    setEdit(null);
    toast('Declaração atualizada.');
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
    <Card title="📄 Declaração da Associação (FPKF / CBKW)">
      <p className="xs muted" style={{ marginTop: 0 }}>Preenchida com seus dados. A data é sempre a do dia em que você imprime ou baixa.</p>
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
          <div className="row mt" style={{ gap: 6, flexWrap: 'wrap' }}>
            <button className="btn" onClick={salvar}>Salvar declaração</button>
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
