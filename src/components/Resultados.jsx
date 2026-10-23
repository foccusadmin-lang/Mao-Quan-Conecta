// Relação Consolidada de Resultados do Atleta (A4). RG e CPF vêm sempre do cadastro do aluno.
import { useLayoutEffect, useRef, useState } from 'react';
import { setDB } from '../lib/db';
import { maskCPF, maskRG, uid } from '../lib/utils';
import { Card, toast } from './ui';
import { gerarImagem, entregar, documentosEmLote } from './Declaracao';

export const POSICOES = ['1º Lugar', '2º Lugar', '3º Lugar', '4º Lugar', '5º Lugar', '6º Lugar', '7º Lugar', '8º Lugar', 'Participação'];
const ordemPos = (p) => (POSICOES.indexOf(p) < 0 ? 99 : POSICOES.indexOf(p));

/** Resultados agrupados: ano (crescente) → campeonato (na ordem em que aparecem) → itens */
export function agruparResultados(itens = []) {
  const anos = new Map();
  for (const r of itens) {
    if (!anos.has(r.ano)) anos.set(r.ano, new Map());
    const camps = anos.get(r.ano);
    const c = (r.campeonato || 'Campeonato').trim();
    if (!camps.has(c)) camps.set(c, []);
    camps.get(c).push(r);
  }
  return [...anos.entries()].sort((a, b) => a[0] - b[0]).map(([ano, camps]) => ({ ano, campeonatos: [...camps.entries()].map(([nome, rs]) => ({ nome, rs })) }));
}
export const periodoResultados = (itens = []) => {
  const anos = [...new Set(itens.map((r) => +r.ano).filter(Boolean))].sort();
  return !anos.length ? '' : anos.length === 1 ? String(anos[0]) : `${anos[0]} a ${anos.at(-1)}`;
};
export const medalhas = (itens = []) => ({
  ouro: itens.filter((r) => r.posicao === '1º Lugar').length,
  prata: itens.filter((r) => r.posicao === '2º Lugar').length,
  bronze: itens.filter((r) => r.posicao === '3º Lugar').length,
});

/** Itens na ordem do documento: ano crescente; dentro do ano, campeonatos na ordem em que aparecem; colocação crescente */
const ordenados = (itens) => agruparResultados(itens).flatMap((g) => g.campeonatos.flatMap((c) => [...c.rs].sort((a, b) => ordemPos(a.posicao) - ordemPos(b.posicao))));
const linhasEstimadas = (itens) =>
  agruparResultados(itens).reduce((s, g) => s + 1.6 + g.campeonatos.reduce((t, c) => t + 1.3 + c.rs.reduce((u, r) => u + 1 + Math.floor(((r.posicao || '').length + (r.prova || '').length) / 42), 0), 0), 0);

/**
 * Divide a relação em páginas A4 (lista em 2 colunas). A 1ª página tem o cabeçalho completo;
 * as seguintes, só a continuação. Assim a letra continua legível mesmo com muitos resultados.
 */
export function paginarResultados(itens = []) {
  const lista = ordenados(itens);
  if (!lista.length) return [[]];
  const paginas = [[]];
  for (const r of lista) {
    const atual = paginas.at(-1);
    const cap = paginas.length === 1 ? 54 : 80;
    if (atual.length && linhasEstimadas([...atual, r]) > cap) paginas.push([r]);
    else atual.push(r);
  }
  return paginas;
}

/**
 * Divide os grupos em duas colunas de altura parecida, sem partir um campeonato ao meio.
 * Feito à mão (e não com CSS columns): as colunas automáticas do navegador sobrepunham textos na imagem/PDF.
 * Se a 2ª coluna começa no meio de um ano, o ano é repetido no topo dela.
 */
function duasColunas(grupos) {
  const blocos = grupos.flatMap((g) => g.campeonatos.map((c, i) => ({ ano: g.ano, c, primeiro: i === 0 })));
  const peso = (b) => (b.primeiro ? 1.6 : 0) + 1.3 + b.c.rs.reduce((u, r) => u + 1 + Math.floor(((r.posicao || '').length + (r.prova || '').length) / 34), 0);
  const total = blocos.reduce((s, b) => s + peso(b), 0);
  let acc = 0;
  let corte = blocos.length;
  for (const [i, b] of blocos.entries()) {
    if (acc + peso(b) / 2 > total / 2) { corte = i; break; }
    acc += peso(b);
  }
  const agrupa = (lista) => {
    const out = [];
    for (const b of lista) {
      if (!out.length || out.at(-1).ano !== b.ano) out.push({ ano: b.ano, campeonatos: [] });
      out.at(-1).campeonatos.push(b.c);
    }
    return out;
  };
  return [agrupa(blocos.slice(0, Math.max(1, corte))), agrupa(blocos.slice(Math.max(1, corte)))];
}

/** Folha A4 (cqw). pagina/total: numeração quando a relação ocupa mais de uma folha */
export function ResultadosVisual({ aluno, itens, innerRef, pagina = 1, total = 1, periodoGeral }) {
  const grupos = agruparResultados(itens);
  const linhas = grupos.reduce((s, g) => s + 1 + g.campeonatos.reduce((t, c) => t + 1 + c.rs.length, 0), 0);
  const duas = linhas > 26 || pagina > 1;
  const t = (pt) => `${(pt / 595.32) * 100}cqw`;
  const periodo = periodoGeral ?? periodoResultados(itens);
  // Ajuste automático: se a lista não couber na folha, a letra da lista diminui até caber (o rodapé nunca sai da página)
  const chave = JSON.stringify(itens.map((r) => [r.ano, r.campeonato, r.posicao, r.prova]));
  const [ajuste, setAjuste] = useState({ chave, escala: 1 });
  const escala = ajuste.chave === chave ? ajuste.escala : 1;
  const caixaRef = useRef(null);
  useLayoutEffect(() => {
    const cx = caixaRef.current;
    if (!cx) return;
    if (ajuste.chave !== chave) return setAjuste({ chave, escala: 1 });
    if (cx.scrollHeight > cx.clientHeight + 1 && escala > 0.72) setAjuste({ chave, escala: +(escala * 0.94).toFixed(3) });
  });
  const fonte = 11 * escala;
  return (
    <div style={{ containerType: 'inline-size', width: '100%' }}>
      <div ref={innerRef} data-pagina={pagina} style={{ position: 'relative', width: '100%', aspectRatio: '210 / 297', background: '#fff', color: '#111', fontFamily: 'Calibri, Carlito, "Segoe UI", Arial, sans-serif', overflow: 'hidden' }}>
        <img src="./declaracao/marca-dagua.jpg" alt="" style={{ position: 'absolute', left: '16.5%', top: '29.5%', width: '67%' }} />
        <div ref={caixaRef} style={{ position: 'absolute', inset: 0, padding: `${t(46)} ${t(76)} ${t(26)} ${t(85)}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: '#e10600', fontWeight: 900, fontSize: t(22), letterSpacing: '.01em', fontFamily: 'Impact, "Arial Narrow", "Segoe UI", sans-serif' }}>ASSOCIAÇÃO MAO QUAN KUNG FU WUSHU</div>
              <div style={{ borderTop: `${t(0.8)} solid #e86a2a`, width: t(363), margin: `${t(8)} 0 ${t(6)}` }} />
              <div style={{ fontSize: t(12), lineHeight: 1.25 }}>Filiado(a) à Federação Paulista de Kung Fu (FPKF)<br />Filiado(a) à Confederação Brasileira de Kung Fu (CBKW)</div>
            </div>
            <img src="./declaracao/logo.jpg" alt="" style={{ width: t(86), marginTop: t(-6) }} />
          </div>

          <div style={{ textAlign: 'center', margin: `${t(16)} 0 ${t(4)}` }}>
            <div style={{ fontWeight: 800, fontSize: t(14) }}>RELAÇÃO CONSOLIDADA DE RESULTADOS DO ATLETA{pagina > 1 ? ' (continuação)' : ''}</div>
            {periodo && <div style={{ fontSize: t(11.5) }}>Período: {periodo}</div>}
          </div>
          {pagina > 1 && <div style={{ fontSize: t(11.5) }}><b>Atleta:</b> {aluno.nome}</div>}
          {pagina === 1 && <p style={{ fontSize: t(11), lineHeight: 1.35, textAlign: 'justify', margin: `${t(6)} 0 ${t(8)}` }}>
            A <b>Associação Mao Quan Kung-fu Wushu</b>, inscrita no CNPJ sob o nº <b>69.451.196/0001-37</b>, apresenta a relação dos resultados esportivos registrados do(a) atleta abaixo nos campeonatos realizados{periodo ? ` entre ${periodo.replace(' a ', ' e ')}` : ''}.
          </p>}
          {pagina === 1 && <div style={{ fontSize: t(11.5), lineHeight: 1.45, border: `${t(0.7)} solid #e2dedb`, borderRadius: t(4), padding: `${t(6)} ${t(10)}`, background: 'rgba(255,255,255,.75)' }}>
            <div><b>Atleta:</b> {aluno.nome}</div>
            <div><b>RG:</b> {aluno.rg ? maskRG(aluno.rg) : 'Não informado'} &nbsp;&nbsp; <b>CPF:</b> {aluno.cpf ? maskCPF(aluno.cpf) : 'Não informado'}</div>
          </div>}

          <div style={{ fontSize: t(fonte), lineHeight: 1.3, marginTop: t(10), display: 'flex', gap: t(22), alignItems: 'flex-start', flex: 'none' }}>
            {!grupos.length && <div style={{ fontStyle: 'italic' }}>Nenhum resultado registrado.</div>}
            {(duas ? duasColunas(grupos) : [grupos]).map((coluna, ci) => (
              <div key={ci} style={{ flex: '1 1 0', minWidth: 0 }}>
                {coluna.map((g) => (
                  <div key={g.ano} style={{ marginBottom: t(6) }}>
                    <div style={{ fontWeight: 800, color: '#b30600', fontSize: t(fonte + 1.5) }}>{g.ano}</div>
                    {g.campeonatos.map((c) => (
                      <div key={c.nome} style={{ margin: `${t(2)} 0 ${t(4)}` }}>
                        <div style={{ fontWeight: 700, fontStyle: 'italic' }}>{c.nome}</div>
                        {[...c.rs].sort((a, b) => ordemPos(a.posicao) - ordemPos(b.posicao)).map((r) => (
                          <div key={r.id} style={{ paddingLeft: t(10), textIndent: t(-7) }}>• <b>{r.posicao}</b>{r.prova ? ` — ${r.prova}` : ''}</div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div style={{ flex: '1 1 auto', minHeight: t(12) }} />
          {total > 1 && <div style={{ textAlign: 'right', fontSize: t(10), color: '#555', marginBottom: t(4) }}>Página {pagina} de {total}</div>}
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

/** Relação completa do atleta: uma ou mais folhas A4 */
export function ResultadosDocumento({ aluno, itens, gap = 0 }) {
  const paginas = paginarResultados(itens);
  const periodo = periodoResultados(itens);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      {paginas.map((p, i) => <ResultadosVisual key={i} aluno={aluno} itens={p} pagina={i + 1} total={paginas.length} periodoGeral={periodo} />)}
    </div>
  );
}

export const resultadosEmLote = (alunos, formato, aoProgresso) =>
  documentosEmLote(alunos, (a) => <ResultadosDocumento aluno={a} itens={a.resultados || []} />, formato, 'resultados', aoProgresso);

const novoItem = (base = {}) => ({ id: uid('rs'), ano: base.ano || new Date().getFullYear(), campeonato: base.campeonato || '', posicao: base.posicao || '1º Lugar', prova: '' });

/** Visualizar, editar, imprimir e baixar a relação de um atleta. `todos` (professor / Central) habilita "aplicar a todos". */
export function ResultadosAtleta({ aluno, todos }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState(null); // lista em edição
  const itens = aluno.resultados || [];
  const exportar = async (formato) => {
    setBusy(true);
    try {
      const imgs = [];
      for (const no of ref.current.querySelectorAll('[data-pagina]')) imgs.push(await gerarImagem(no));
      await entregar(imgs, formato, `resultados-${aluno.nome}`.replace(/[^\w-]+/g, '_'));
    } catch (e) {
      toast('Falha ao gerar: ' + e.message);
    } finally {
      setBusy(false);
    }
  };
  const limpos = () => edit.filter((r) => r.ano && (r.campeonato.trim() || r.prova.trim())).map((r) => ({ ...r, ano: +r.ano, campeonato: r.campeonato.trim(), prova: r.prova.trim() }));
  const salvar = () => {
    const l = limpos();
    setDB((d) => {
      const x = d.alunos.find((y) => y.id === aluno.id);
      if (x) x.resultados = l;
    });
    setEdit(null);
    toast('Resultados salvos só para ' + aluno.nome.split(' ')[0] + '.');
  };
  // "Todos": os resultados novos (incluídos nesta edição) vão para todos os alunos da lista — ex.: 1º Lugar por equipe
  const salvarTodos = () => {
    const l = limpos();
    const antigos = new Set(itens.map((r) => r.id));
    const novos = l.filter((r) => !antigos.has(r.id));
    if (!novos.length) return toast('Para aplicar a todos, inclua um resultado novo (ex.: resultado por equipe). Alterações e exclusões valem só para este aluno.');
    if (!window.confirm(`Incluir ${novos.length} resultado(s) novo(s) para ${todos.length} aluno(s)?`)) return;
    setDB((d) => {
      for (const t of todos) {
        const x = d.alunos.find((y) => y.id === t.id);
        if (!x) continue;
        if (x.id === aluno.id) x.resultados = l;
        else {
          const ja = (x.resultados || []).map((r) => `${r.ano}|${r.campeonato}|${r.posicao}|${r.prova}`);
          x.resultados = [...(x.resultados || []), ...novos.filter((r) => !ja.includes(`${r.ano}|${r.campeonato}|${r.posicao}|${r.prova}`)).map((r) => ({ ...r, id: uid('rs') }))];
        }
      }
    });
    setEdit(null);
    toast(`Resultado(s) incluído(s) para ${todos.length} aluno(s).`);
  };
  const muda = (i, patch) => setEdit(edit.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const campeonatos = [...new Set([...(edit || itens)].map((r) => r.campeonato).filter(Boolean))];
  const m = medalhas(itens);

  return (
    <Card title="🏅 Relação Consolidada de Resultados">
      <div className="row mb" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="small">🥇 {m.ouro} · 🥈 {m.prata} · 🥉 {m.bronze} · {itens.length} resultado(s){periodoResultados(itens) ? ` · ${periodoResultados(itens)}` : ''}</span>
      </div>
      <div className="row mb" style={{ gap: 6, flexWrap: 'wrap' }}>
        <button className="btn sm" disabled={busy} onClick={() => exportar('pdf')}>⬇ Baixar PDF</button>
        <button className="btn sm ghost" disabled={busy} onClick={() => exportar('print')}>🖨 Imprimir</button>
        {!edit && <button className="btn sm ghost" onClick={() => setEdit(itens.map((r) => ({ ...r })))}>✏️ Editar resultados</button>}
      </div>

      {edit && (
        <div className="card mb" style={{ background: '#faf8f6' }}>
          <datalist id={`camps-${aluno.id}`}>{campeonatos.map((c) => <option key={c} value={c} />)}</datalist>
          <div className="xs muted mb">RG e CPF são os do cadastro do aluno. Cada linha é um resultado.</div>
          {edit.map((r, i) => (
            <div key={r.id} className="row" style={{ gap: 6, marginBottom: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <input type="number" value={r.ano} min="1990" max="2100" onChange={(e) => muda(i, { ano: e.target.value })} style={{ width: 84 }} aria-label="Ano" />
              <input list={`camps-${aluno.id}`} value={r.campeonato} onChange={(e) => muda(i, { campeonato: e.target.value })} placeholder="Campeonato (ex.: 36º Campeonato Paulista)" style={{ flex: '2 1 200px' }} />
              <select value={r.posicao} onChange={(e) => muda(i, { posicao: e.target.value })} style={{ width: 130 }}>
                {POSICOES.map((p) => <option key={p}>{p}</option>)}
              </select>
              <input value={r.prova} onChange={(e) => muda(i, { prova: e.target.value })} placeholder="Prova / categoria (ex.: Mãos do Sul, Adulto)" style={{ flex: '2 1 200px' }} />
              <button type="button" className="btn link sm" onClick={() => setEdit(edit.filter((_, j) => j !== i))} title="Remover">✕</button>
            </div>
          ))}
          <button type="button" className="btn sm ghost" onClick={() => setEdit([...edit, novoItem(edit.at(-1))])}>+ Resultado</button>
          {todos?.length > 1 && (
            <>
              <div className="small mt" style={{ fontWeight: 600 }}>Deseja alterar apenas este aluno ou todos os alunos?</div>
              <div className="xs muted">“Todos” inclui nos {todos.length} alunos selecionados os resultados <b>novos</b> desta edição (ex.: 1º Lugar por equipe). Alterações e exclusões valem só para este aluno.</div>
            </>
          )}
          <div className="row mt" style={{ gap: 6, flexWrap: 'wrap' }}>
            <button className="btn" onClick={salvar}>{todos?.length > 1 ? `Salvar só para ${aluno.nome.split(' ')[0]}` : 'Salvar resultados'}</button>
            {todos?.length > 1 && <button className="btn dark" onClick={salvarTodos}>Aplicar a todos os {todos.length} alunos</button>}
            <button className="btn ghost" onClick={() => setEdit(null)}>Cancelar</button>
          </div>
        </div>
      )}

      <div ref={ref} style={{ maxWidth: 620, margin: '0 auto' }}>
        <div style={{ boxShadow: '0 6px 24px rgba(0,0,0,.12)', borderRadius: 4, overflow: 'hidden', background: '#ccc' }}>
          <ResultadosDocumento aluno={aluno} itens={edit ? limposPrevia(edit) : itens} gap={8} />
        </div>
      </div>
    </Card>
  );
}
const limposPrevia = (lista) => lista.filter((r) => r.ano && (r.campeonato || r.prova));
