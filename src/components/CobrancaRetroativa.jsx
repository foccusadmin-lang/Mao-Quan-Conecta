import { useMemo, useState } from 'react';
import { useDB, setDB, notify, filialNome } from '../lib/db';
import { valorPlano, resumoPlano, temPlanos } from '../lib/planos';
import { uid, brl, todayISO, monthISO, fmtMonth, addDays, addMonths, fmtDate } from '../lib/utils';
import { Field, toast, Empty } from './ui';

const LIMITE_MESES = 24;

/** Lista de competências "AAAA-MM" de `de` até `ate` (inclusive) */
function mesesEntre(de, ate) {
  if (!de || !ate || de > ate) return [];
  const lista = [];
  for (let m = de; m <= ate && lista.length < LIMITE_MESES; m = addMonths(m + '-01', 1).slice(0, 7)) lista.push(m);
  return lista;
}

/**
 * Cobrança de meses anteriores (pendências de antes do cadastro no app), aluno a aluno.
 * `alunoId` fixo quando aberto pela ficha do aluno.
 */
export function CobrancaRetroativa({ user, alunoId, alunos, onFeito }) {
  const db = useDB();
  const mesAnterior = addMonths(monthISO() + '-01', -1).slice(0, 7);
  const [pessoa, setPessoa] = useState(alunoId || '');
  const [de, setDe] = useState(addMonths(monthISO() + '-01', -3).slice(0, 7));
  const [ate, setAte] = useState(mesAnterior);
  const [valor, setValor] = useState('');
  const [valores, setValores] = useState({});
  const [marcados, setMarcados] = useState(null); // null = todos os meses livres
  const [modoVenc, setModoVenc] = useState('novo');
  const [vencNovo, setVencNovo] = useState(addDays(todayISO(), 7));

  const aluno = db.alunos.find((a) => a.id === pessoa);
  const filial = aluno && db.filiais.find((f) => f.id === aluno.filialId);
  const valorPadrao = aluno ? valorPlano(filial, aluno.plano) : 0;
  const dia = String(db.config.diaVencimento || 10).padStart(2, '0');

  const meses = useMemo(() => mesesEntre(de, ate), [de, ate]);
  const jaLancado = (m) => db.pagamentos.find((p) => p.pessoaId === pessoa && p.tipo === 'mensalidade' && p.competencia === m);
  const livres = meses.filter((m) => !jaLancado(m));
  const selecionados = livres.filter((m) => (marcados ? marcados.includes(m) : true));
  const valorDe = (m) => +(valores[m] ?? (valor === '' ? valorPadrao : valor)) || 0;
  const total = selecionados.reduce((s, m) => s + valorDe(m), 0);

  const alterna = (m) => {
    const atual = marcados || livres;
    setMarcados(atual.includes(m) ? atual.filter((x) => x !== m) : [...atual, m]);
  };

  const gerar = () => {
    if (!aluno) return toast('Selecione o aluno.');
    if (!selecionados.length) return toast('Nenhum mês selecionado para cobrar.');
    if (selecionados.some((m) => !(valorDe(m) > 0))) return toast('Informe o valor de todos os meses.');
    if (modoVenc === 'novo' && !vencNovo) return toast('Informe o novo vencimento.');
    const agora = new Date().toISOString();
    setDB((d) => {
      for (const m of selecionados) {
        d.pagamentos.push({
          id: uid('pg'), tipo: 'mensalidade', pessoaId: aluno.id, filialId: aluno.filialId, competencia: m,
          descricao: `Mensalidade ${m} (pendência anterior)${temPlanos(filial) && aluno.plano ? ` — ${resumoPlano(filial, aluno.plano)}` : ''}`,
          valor: valorDe(m), vencimento: modoVenc === 'novo' ? vencNovo : `${m}-${dia}`,
          status: 'pendente', criadoEm: agora, lembretes: [], retroativa: true, lancadoPor: user.nome,
          auditoria: [{ em: agora, por: user.nome, acao: 'lancado', motivo: 'Pendência anterior ao cadastro no app' }],
        });
      }
      notify(d, aluno.id, 'Pendências anteriores lançadas', `${selecionados.length} mensalidade(s) de meses anteriores — total ${brl(total)}. Veja em Pagamentos.`);
    });
    toast(`${selecionados.length} cobrança(s) gerada(s) para ${aluno.nome}.`);
    onFeito?.();
  };

  return (
    <div className="col">
      <div className="alert gold small">
        Use para débitos de <b>antes do cadastro no app</b>. Cada mês vira uma cobrança separada, com registro de quem lançou. Meses já lançados aparecem bloqueados.
      </div>
      <div className="form-grid">
        {!alunoId && (
          <Field label="Aluno" style={{ gridColumn: '1/-1' }}>
            <select value={pessoa} onChange={(e) => (setPessoa(e.target.value), setMarcados(null), setValores({}))}>
              <option value="">Selecione…</option>
              {alunos.map((a) => <option key={a.id} value={a.id}>{a.nome} — {filialNome(db, a.filialId)}</option>)}
            </select>
          </Field>
        )}
        <Field label="De (mês)"><input type="month" value={de} max={mesAnterior} onChange={(e) => (setDe(e.target.value), setMarcados(null))} /></Field>
        <Field label="Até (mês)"><input type="month" value={ate} max={monthISO()} onChange={(e) => (setAte(e.target.value), setMarcados(null))} /></Field>
        <Field label="Valor por mês (R$)" hint={aluno ? `Padrão do plano atual: ${brl(valorPadrao)}` : ''}>
          <input type="number" min="0" step="0.01" value={valor} placeholder={String(valorPadrao || '')} onChange={(e) => (setValor(e.target.value), setValores({}))} />
        </Field>
        <Field label="Vencimento das cobranças">
          <select value={modoVenc} onChange={(e) => setModoVenc(e.target.value)}>
            <option value="novo">Nova data (dá prazo ao aluno)</option>
            <option value="original">Data original de cada mês (já vencidas)</option>
          </select>
        </Field>
        {modoVenc === 'novo' && <Field label="Nova data de vencimento"><input type="date" value={vencNovo} min={todayISO()} onChange={(e) => setVencNovo(e.target.value)} /></Field>}
      </div>
      {modoVenc === 'original' && <div className="alert red small">Com vencimento original as cobranças já nascem vencidas e o aluno fica bloqueado (material e exames) até pagar.</div>}
      {meses.length >= LIMITE_MESES && <div className="xs muted">Limite de {LIMITE_MESES} meses por lançamento.</div>}

      {!aluno ? <Empty icon="🧾">Selecione o aluno para ver os meses.</Empty> : meses.length === 0 ? <Empty icon="📅">Período inválido.</Empty> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th></th><th>Mês</th><th>Vencimento</th><th>Valor</th><th>Situação</th></tr></thead>
            <tbody>
              {meses.map((m) => {
                const ja = jaLancado(m);
                const on = !ja && selecionados.includes(m);
                return (
                  <tr key={m} style={{ opacity: ja ? 0.55 : 1 }}>
                    <td><input type="checkbox" checked={on} disabled={!!ja} onChange={() => alterna(m)} /></td>
                    <td style={{ fontWeight: 600 }}>{fmtMonth(m)}</td>
                    <td className="small">{fmtDate(modoVenc === 'novo' ? vencNovo : `${m}-${dia}`)}</td>
                    <td>
                      {ja ? brl(ja.valor) : (
                        <input type="number" min="0" step="0.01" value={valores[m] ?? (valor === '' ? valorPadrao : valor)} disabled={!on} onChange={(e) => setValores({ ...valores, [m]: e.target.value })} style={{ width: 100 }} />
                      )}
                    </td>
                    <td className="small">{ja ? (ja.status === 'pago' ? '✅ já paga' : '🧾 já lançada') : on ? 'Será cobrada' : 'Não cobrar'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="alert ink" style={{ justifyContent: 'space-between' }}>
        <span>{selecionados.length} mês(es) selecionado(s)</span>
        <b style={{ fontSize: 18 }}>{brl(total)}</b>
      </div>
      <div><button className="btn" disabled={!aluno || !selecionados.length} onClick={gerar}>Gerar {selecionados.length || ''} cobrança(s)</button></div>
    </div>
  );
}
