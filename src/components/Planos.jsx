import { useEffect, useState } from 'react';
import { useDB, setDB, flush, departamentos, notify, mensalidadeDoAluno } from '../lib/db';
import { supabase } from '../lib/supabase';
import { brl, monthISO } from '../lib/utils';
import { COMBOS, modalidadesOfertadas, temPlanos, pacoteAtivo, combosAtivos, somaModalidades, valorPlano, economiaPacote, rotuloValor, condicaoCombinada, condicaoAplica, BASE_QUALQUER, adicionalFamilia, extrasFamilia, resumoPlano, validarPlano, adicionalOutrasFiliais, BOLSAS, temBolsa, cotasPlano, descontoBolsas, valorPlanoBruto } from '../lib/planos';
import { Card, Field, toast } from './ui';

// ---------------------------------------------------------------------------
// Professor / Central: modalidades oferecidas e valores da filial
// ---------------------------------------------------------------------------
export function PlanosFilialEditor({ filial }) {
  const db = useDB();
  const inicial = () => {
    const p = structuredClone(filial.planos || {});
    p.modalidades ||= {};
    for (const nome of departamentos(db)) p.modalidades[nome] ||= { ativa: false, valor: '' };
    p.pacote ||= { ativo: false, valor: '' };
    p.familia ||= {};
    p.combinada ||= { ativa: false, base: 'Tradicional', adicional: '' };
    p.outrasFiliais ||= { ativo: false, valor: '' };
    return p;
  };
  const [p, setP] = useState(inicial);
  const [base, setBase] = useState(filial.mensalidade ?? '');
  useEffect(() => (setP(inicial()), setBase(filial.mensalidade ?? '')), [filial.id]);

  const muda = (nome, patch) => setP({ ...p, modalidades: { ...p.modalidades, [nome]: { ...p.modalidades[nome], ...patch } } });
  const previa = { ...filial, planos: p };
  const ofertadas = modalidadesOfertadas(previa);
  const valorBasePrevia = p.combinada.base === BASE_QUALQUER ? Math.max(0, ...ofertadas.map((m) => m.valor)) : +p.modalidades[p.combinada.base]?.valor || 0;

  const salvar = () => {
    if (Object.values(p.modalidades).some((m) => m.ativa && !(+m.valor > 0))) return toast('Informe o valor de cada modalidade oferecida.');
    if (p.pacote.ativo && !(+p.pacote.valor > 0)) return toast('Informe o valor promocional do pacote.');
    if (p.combinada.ativa && p.combinada.base !== BASE_QUALQUER && !p.modalidades[p.combinada.base]?.ativa) return toast('A modalidade-base da condição especial precisa estar oferecida.');
    if (p.combinada.ativa && !(+p.combinada.adicional >= 0 && p.combinada.adicional !== '')) return toast('Informe o valor adicional por modalidade.');
    if (p.outrasFiliais.ativo && !(+p.outrasFiliais.valor > 0)) return toast('Informe o valor do treino em outras filiais.');
    const limpo = {
      modalidades: Object.fromEntries(Object.entries(p.modalidades).filter(([, m]) => m.ativa || +m.valor > 0).map(([k, m]) => [k, { ativa: !!m.ativa, valor: +m.valor || 0 }])),
      pacote: { ativo: !!p.pacote.ativo, valor: +p.pacote.valor || 0 },
      familia: Object.fromEntries(COMBOS.filter((n) => +p.familia[n] > 0).map((n) => [n, +p.familia[n]])),
      ...(p.combinada.ativa ? { combinada: { ativa: true, base: p.combinada.base, adicional: +p.combinada.adicional } } : {}),
      ...(p.outrasFiliais.ativo && +p.outrasFiliais.valor > 0 ? { outrasFiliais: { ativo: true, valor: +p.outrasFiliais.valor } } : {}),
      ...(p.familiaAdicional !== undefined && p.familiaAdicional !== '' && +p.familiaAdicional >= 0 ? { familiaAdicional: +p.familiaAdicional } : {}),
    };
    setDB((d) => {
      const f = d.filiais.find((x) => x.id === filial.id);
      f.planos = limpo;
      f.mensalidade = +base || 0;
    });
    toast('Planos e valores salvos. Valem a partir da próxima cobrança.');
  };

  return (
    <div className="col">
      <Card title={`🥋 Modalidades oferecidas — ${filial.nome}`}>
        <p className="xs muted" style={{ marginTop: 0 }}>Marque o que a filial oferece e o valor mensal de cada modalidade. O aluno escolhe uma ou mais, o pacote completo ou um combo família.</p>
        {Object.entries(p.modalidades).map(([nome, m]) => (
          <div key={nome} className="list-item" style={{ flexWrap: 'wrap' }}>
            <label className="check grow"><input type="checkbox" checked={!!m.ativa} onChange={(e) => muda(nome, { ativa: e.target.checked })} /> <b>{nome}</b></label>
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <span className="small muted">R$</span>
              <input type="number" min="0" step="0.01" value={m.valor} disabled={!m.ativa} onChange={(e) => muda(nome, { valor: e.target.value })} style={{ width: 110 }} placeholder="0,00" />
              <span className="small muted">/mês</span>
            </div>
          </div>
        ))}
      </Card>

      <Card title="⭐ Condição especial (modalidade-base + adicional)">
        <label className="check">
          <input type="checkbox" checked={!!p.combinada.ativa} onChange={(e) => setP({ ...p, combinada: { ...p.combinada, ativa: e.target.checked } })} />
          <div>Quem escolhe a modalidade-base paga o valor dela + um adicional fixo por cada outra modalidade<div className="xs muted">Ex.: Tradicional R$ 150 + R$ 50 por modalidade → Tradicional e Esportivo = R$ 200</div></div>
        </label>
        {p.combinada.ativa && (
          <>
            <div className="form-grid mt">
              <Field label="Modalidade-base">
                <select value={p.combinada.base} onChange={(e) => setP({ ...p, combinada: { ...p.combinada, base: e.target.value } })}>
                  <option value={BASE_QUALQUER}>Qualquer modalidade (a primeira paga o valor dela)</option>
                  {Object.keys(p.modalidades).map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </Field>
              <Field label="Adicional por modalidade (R$)">
                <input type="number" min="0" step="0.01" value={p.combinada.adicional} onChange={(e) => setP({ ...p, combinada: { ...p.combinada, adicional: e.target.value } })} placeholder="50" />
              </Field>
            </div>
            {valorBasePrevia > 0 && p.combinada.adicional !== "" && (
              <p className="xs muted" style={{ marginBottom: 0 }}>
                {[1, 2, 3, 4, 5].filter((n) => n <= Math.max(1, ofertadas.length)).map((n) => `${n} modalidade${n > 1 ? "s" : ""}${p.combinada.base === BASE_QUALQUER ? "" : n === 1 ? ` (${p.combinada.base})` : ` (${p.combinada.base} + ${n - 1})`}: ${brl(valorBasePrevia + (n - 1) * +p.combinada.adicional)}`).join(" · ")}
              </p>
            )}
          </>
        )}
      </Card>

      <Card title="🏯 Treino em outras filiais">
        <label className="check">
          <input type="checkbox" checked={!!p.outrasFiliais.ativo} onChange={(e) => setP({ ...p, outrasFiliais: { ...p.outrasFiliais, ativo: e.target.checked } })} />
          <div>
            Oferecer “Treino em outra filial” (valor fixo por pessoa)
            <div className="xs muted">Ao editar o plano do aluno (Financeiro → ✏️ editar mensalidade ou ficha do aluno), o professor ou a Central marcam “🏯 Treino em outra filial” no titular e/ou em cada beneficiário. O valor é somado à mensalidade; o valor do combo não muda.</div>
          </div>
        </label>
        {p.outrasFiliais.ativo && (
          <Field label="Valor por pessoa (R$/mês)">
            <input type="number" min="0" step="0.01" value={p.outrasFiliais.valor} onChange={(e) => setP({ ...p, outrasFiliais: { ...p.outrasFiliais, valor: e.target.value } })} placeholder="50" style={{ maxWidth: 200 }} />
          </Field>
        )}
      </Card>

      <div className="grid g2">
        <Card title="🎁 Pacote completo (valor promocional)">
          <label className="check"><input type="checkbox" checked={!!p.pacote.ativo} onChange={(e) => setP({ ...p, pacote: { ...p.pacote, ativo: e.target.checked } })} /> Oferecer pacote com todas as modalidades</label>
          <Field label="Valor promocional (R$/mês)">
            <input type="number" min="0" step="0.01" value={p.pacote.valor} disabled={!p.pacote.ativo} onChange={(e) => setP({ ...p, pacote: { ...p.pacote, valor: e.target.value } })} />
          </Field>
          {ofertadas.length > 0 && (
            <p className="xs muted" style={{ marginBottom: 0 }}>
              Soma avulsa de {ofertadas.map((x) => x.nome).join(' + ')}: <b>{brl(somaModalidades(previa, ofertadas.map((x) => x.nome)))}</b>
              {p.pacote.ativo && +p.pacote.valor > 0 && <> · economia de <b>{brl(economiaPacote(previa))}</b></>}
            </p>
          )}
        </Card>
        <Card title="👨‍👩‍👧 Pacote família">
          <p className="xs muted" style={{ marginTop: 0 }}>Valor mensal total do combo (titular + beneficiários). Deixe em branco o combo que não for oferecido.</p>
          {COMBOS.map((n) => (
            <Field key={n} label={`Combo ${n} pessoas (R$/mês)`}>
              <input type="number" min="0" step="0.01" value={p.familia[n] ?? ''} onChange={(e) => setP({ ...p, familia: { ...p.familia, [n]: e.target.value } })} placeholder="Não oferecido" />
            </Field>
          ))}
          <Field
            label="Modalidade adicional por pessoa (R$/mês)"
            hint={`O combo inclui 1 modalidade por pessoa; cada modalidade a mais soma este valor. Em branco: ${p.combinada.ativa && p.combinada.adicional !== '' ? `usa o adicional da condição especial (${brl(+p.combinada.adicional)})` : 'sem cobrança adicional'}.`}
          >
            <input type="number" min="0" step="0.01" value={p.familiaAdicional ?? ''} onChange={(e) => setP({ ...p, familiaAdicional: e.target.value })} placeholder={p.combinada.ativa && p.combinada.adicional !== '' ? String(p.combinada.adicional) : '0'} />
          </Field>
        </Card>
      </div>

      <Card title="Mensalidade base">
        <Field label="Valor (R$/mês)" hint="Usada quando a filial não tem modalidades configuradas ou o aluno ainda não escolheu o plano">
          <input type="number" min="0" step="0.01" value={base} onChange={(e) => setBase(e.target.value)} style={{ maxWidth: 200 }} />
        </Field>
      </Card>
      <div><button className="btn" onClick={salvar}>Salvar planos e valores</button></div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aluno (ou professor/Central pelo aluno): escolha do plano
// ---------------------------------------------------------------------------
/** Bolsa (desconto) por pessoa — só professor / Central */
function SeletorBolsa({ value, onChange, cota }) {
  const v = BOLSAS.includes(+value) ? +value : 0;
  return (
    <label className="row small" style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <span>🎓 Bolsa</span>
      <select value={v} onChange={(e) => onChange(+e.target.value || undefined)} style={{ maxWidth: 170, padding: '4px 8px' }}>
        {BOLSAS.map((b) => <option key={b} value={b}>{b ? `Bolsista ${b}%` : 'Sem bolsa'}</option>)}
      </select>
      {v > 0 && cota > 0 && <span className="xs muted">− {brl((cota * v) / 100)} (de {brl(cota)})</span>}
    </label>
  );
}

export function EscolhaPlano({ filial, value, onChange, equipe }) {
  const ofertadas = modalidadesOfertadas(filial);
  const cc = condicaoCombinada(filial);
  // Rótulo do preço de cada modalidade: com a condição especial valendo, as adicionais mostram "+ R$ 50"
  const rotuloModalidade = (m, on) => {
    const escolhidas = plano.modalidades || [];
    if (!condicaoAplica(cc, escolhidas)) return ` · ${brl(m.valor)}`;
    if (cc.qualquer) return on ? '' : ` · + ${brl(cc.adicional)}`;
    return m.nome === cc.base ? ` · ${brl(m.valor)}` : ` · + ${brl(cc.adicional)}`;
  };
  const combos = combosAtivos(filial);
  const plano = value || { tipo: 'modalidades', modalidades: [] };
  const muda = (patch) => onChange({ ...plano, ...patch });
  const alterna = (nome) => {
    const atual = plano.modalidades || [];
    muda({ modalidades: atual.includes(nome) ? atual.filter((x) => x !== nome) : [...atual, nome] });
  };
  const ajustaBenef = (combo) => {
    const lista = [...(plano.familia?.beneficiarios || [])].slice(0, combo - 1);
    while (lista.length < combo - 1) lista.push({ nome: '', email: '', modalidades: [] });
    return lista;
  };
  const benef = plano.familia?.beneficiarios || [];
  const mudaBenef = (i, patch) => muda({ familia: { ...plano.familia, beneficiarios: benef.map((b, j) => (j === i ? { ...b, ...patch, alunoId: undefined, cadastrado: undefined } : b)) } });
  // Modalidades do beneficiário não mexem no vínculo com o cadastro dele (isenção)
  const alternaBenef = (i, nome) => {
    const atual = benef[i].modalidades || [];
    const mods = atual.includes(nome) ? atual.filter((x) => x !== nome) : [...atual, nome];
    muda({ familia: { ...plano.familia, beneficiarios: benef.map((b, j) => (j === i ? { ...b, modalidades: mods } : b)) } });
  };
  const adicFam = adicionalFamilia(filial);
  const cotas = cotasPlano(filial, plano);
  const mudaBolsaBenef = (i, v) => muda({ familia: { ...plano.familia, beneficiarios: benef.map((x, j) => (j === i ? { ...x, bolsa: v } : x)) } });
  // Só professor / Central marcam "Treino em outra filial" (o aluno vê o valor, mas não marca)
  const adicOutras = equipe ? adicionalOutrasFiliais(filial) : 0;
  // "🏯 Outras filiais": valor fixo por pessoa (titular ou beneficiário) para treinar também em outras filiais
  const chipOutras = (on, alternar) =>
    adicOutras > 0 && (
      <button type="button" className={`btn sm ${on ? 'dark' : 'ghost'}`} onClick={alternar} title="Treina também em outra filial">
        {on ? '✓ ' : ''}🏯 Treino em outra filial · + {brl(adicOutras)}
      </button>
    );
  const extrasFam = extrasFamilia(filial, plano);
  // Chips de modalidade de uma pessoa da família: a 1ª está no combo, as demais mostram "+ R$ 50"
  const chipsFamilia = (lista, alternar, extra) => (
    <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
      {ofertadas.map((m) => {
        const on = lista.includes(m.nome);
        const extra = adicFam > 0 && (on ? lista.indexOf(m.nome) > 0 : lista.length > 0);
        return (
          <button key={m.nome} type="button" className={`btn sm ${on ? '' : 'ghost'}`} onClick={() => alternar(m.nome)}>
            {on ? '✓ ' : ''}{m.nome}{extra ? ` · + ${brl(adicFam)}` : ''}
          </button>
        );
      })}
      {extra}
    </div>
  );

  if (!temPlanos(filial)) return <div className="alert ink small">Esta filial ainda não configurou modalidades. Mensalidade: <b>{brl(filial?.mensalidade || 0)}</b>.</div>;

  const Opcao = ({ tipo, titulo, sub }) => (
    <label className={`card plano-opcao ${plano.tipo === tipo ? 'sel' : ''}`} style={{ cursor: 'pointer', padding: 12, borderColor: plano.tipo === tipo ? 'var(--red)' : undefined, boxShadow: plano.tipo === tipo ? '0 0 0 2px var(--red-soft)' : undefined }}>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <input
          type="radio"
          name={`tipo-plano-${filial.id}`}
          checked={plano.tipo === tipo}
          onChange={() => muda(tipo === 'familia' ? { tipo, combo: plano.combo || combos[0].pessoas, familia: { beneficiarios: ajustaBenef(plano.combo || combos[0].pessoas) } } : { tipo })}
        />
        <div className="grow"><b>{titulo}</b><div className="xs muted">{sub}</div></div>
      </div>
    </label>
  );

  return (
    <div className="col">
      <div className="grid g3">
        <Opcao tipo="modalidades" titulo="Modalidades avulsas" sub="Escolha uma ou mais" />
        {pacoteAtivo(filial) && <Opcao tipo="pacote" titulo={`Pacote completo · ${brl(filial.planos.pacote.valor)}`} sub={`Todas as modalidades${economiaPacote(filial) ? ` · economize ${brl(economiaPacote(filial))}` : ''}`} />}
        {combos.length > 0 && <Opcao tipo="familia" titulo="Pacote família" sub={combos.map((c) => `${c.pessoas} pessoas ${brl(c.valor)}`).join(' · ')} />}
      </div>

      {plano.tipo === 'modalidades' && (
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {ofertadas.map((m) => {
            const on = (plano.modalidades || []).includes(m.nome);
            return (
              <button key={m.nome} type="button" className={`btn sm ${on ? '' : 'ghost'}`} onClick={() => alterna(m.nome)}>
                {on ? "✓ " : ""}{m.nome}{plano.tipo === "modalidades" ? rotuloModalidade(m, on) : ""}
              </button>
            );
          })}
          {chipOutras(!!plano.outrasFiliais, () => muda({ outrasFiliais: !plano.outrasFiliais }))}
        </div>
      )}
      {plano.tipo === 'modalidades' && cc && (
        <div className="alert gold small">⭐ <div><b>Condição especial desta filial:</b> {cc.qualquer ? <>a primeira modalidade paga o valor dela ({brl(Math.max(...ofertadas.map((m) => m.valor)))})</> : <>{cc.base} {brl(ofertadas.find((m) => m.nome === cc.base)?.valor || 0)}</>} + <b>{brl(cc.adicional)}</b> por cada modalidade adicional.</div></div>
      )}
      {plano.tipo === 'pacote' && <div className="small">Inclui: <b>{ofertadas.map((m) => m.nome).join(', ')}</b></div>}
      {plano.tipo === 'pacote' && adicOutras > 0 && <div className="row">{chipOutras(!!plano.outrasFiliais, () => muda({ outrasFiliais: !plano.outrasFiliais }))}</div>}
      {equipe && plano.tipo !== 'familia' && <SeletorBolsa value={plano.bolsa} cota={cotas[0]?.cota} onChange={(v) => muda({ bolsa: v })} />}

      {plano.tipo === 'familia' && (
        <div className="card" style={{ background: '#faf8f6' }}>
          <div className="form-grid">
            <Field label="Combo">
              <select value={plano.combo} onChange={(e) => muda({ combo: +e.target.value, familia: { beneficiarios: ajustaBenef(+e.target.value) } })}>
                {combos.map((c) => <option key={c.pessoas} value={c.pessoas}>{c.pessoas} pessoas — {brl(c.valor)}/mês</option>)}
              </select>
            </Field>
            <Field label="Modalidades da família">
              <label className="check" style={{ marginTop: 8 }}><input type="checkbox" checked={!!plano.todas} onChange={(e) => muda({ todas: e.target.checked })} /> Todas as modalidades para todos</label>
            </Field>
          </div>
          {!plano.todas && adicFam > 0 && (
            <div className="alert gold small mb">👨‍👩‍👧 <div>O combo inclui <b>1 modalidade por pessoa</b>. Cada modalidade a mais (do titular ou de um beneficiário) soma <b>+ {brl(adicFam)}</b>/mês.</div></div>
          )}
          {plano.todas && adicOutras > 0 && (
            <div className="mb"><b className="small">Titular</b><div className="row" style={{ marginTop: 6 }}>{chipOutras(!!plano.outrasFiliais, () => muda({ outrasFiliais: !plano.outrasFiliais }))}</div></div>
          )}
          {!plano.todas && (
            <div className="mb">
              <b className="small">Suas modalidades (titular)</b>
              <div style={{ marginTop: 6 }}>{chipsFamilia(plano.modalidades || [], alterna, chipOutras(!!plano.outrasFiliais, () => muda({ outrasFiliais: !plano.outrasFiliais })))}</div>
            </div>
          )}
          {equipe && (
            <div className="mb">
              {plano.todas && <b className="small">Titular</b>}
              <SeletorBolsa value={plano.bolsa} cota={cotas[0]?.cota} onChange={(v) => muda({ bolsa: v })} />
            </div>
          )}
          <b className="small">Beneficiários (você é o titular e responsável pelo pagamento)</b>
          <p className="xs muted" style={{ margin: '2px 0 8px' }}>Informe o nome e, se tiver, o e-mail Google de cada um. Quem já tem cadastro fica isento automaticamente; quem se cadastrar depois também.</p>
          {benef.map((b, i) => (
            <div key={i} className="mb" style={{ borderTop: i ? '1px solid var(--line, #e5e1dc)' : 0, paddingTop: i ? 8 : 0 }}>
              <div className="form-grid" style={{ marginBottom: 6 }}>
                <Field label={`Beneficiário ${i + 1} — nome completo`}><input value={b.nome} onChange={(e) => mudaBenef(i, { nome: e.target.value })} /></Field>
                <Field label="E-mail Google (opcional)">
                  <input type="email" value={b.email || ''} onChange={(e) => mudaBenef(i, { email: e.target.value })} placeholder="beneficiario@gmail.com" />
                  {b.cadastrado === true && <span className="hint" style={{ color: 'var(--ok)' }}>✓ Cadastro encontrado — isento</span>}
                  {b.cadastrado === false && <span className="hint">Ainda sem cadastro — ficará isento ao se cadastrar</span>}
                </Field>
              </div>
              {plano.todas && adicOutras > 0 && <div className="row">{chipOutras(!!b.outrasFiliais, () => muda({ familia: { ...plano.familia, beneficiarios: benef.map((x, j) => (j === i ? { ...x, outrasFiliais: !x.outrasFiliais } : x)) } }))}</div>}
              {!plano.todas && (
                <>
                  <div className="xs muted" style={{ marginBottom: 4 }}>Modalidades de {b.nome?.trim() || `beneficiário ${i + 1}`}{!Array.isArray(b.modalidades) && ' (ainda não informadas — conta 1 modalidade)'}</div>
                  {chipsFamilia(b.modalidades || [], (nome) => alternaBenef(i, nome), chipOutras(!!b.outrasFiliais, () => muda({ familia: { ...plano.familia, beneficiarios: benef.map((x, j) => (j === i ? { ...x, outrasFiliais: !x.outrasFiliais } : x)) } })))}
                </>
              )}
              {equipe && <div style={{ marginTop: 6 }}><SeletorBolsa value={b.bolsa} cota={cotas[i + 1]?.cota} onChange={(v) => mudaBolsaBenef(i, v)} /></div>}
            </div>
          ))}
          {extrasFam > 0 && (
            <div className="small" style={{ marginTop: 4 }}>
              Combo {plano.combo} pessoas {brl(+filial.planos.familia?.[plano.combo] || 0)} + {extrasFam} modalidade{extrasFam > 1 ? 's' : ''} adicional{extrasFam > 1 ? 'is' : ''} × {brl(adicFam)} = <b>{brl(valorPlanoBruto(filial, plano))}</b>
            </div>
          )}
        </div>
      )}

      {temBolsa(plano) && (
        <div className="small">
          🎓 Bolsas: {cotas.filter((c) => c.bolsa > 0).map((c) => `${plano.tipo === 'familia' ? (c.titular ? 'titular' : c.nome.split(' ')[0]) + ' ' : ''}${c.bolsa}% (− ${brl(c.desconto)})`).join(' · ')} — valor sem bolsa {brl(valorPlanoBruto(filial, plano))}, desconto <b>− {brl(descontoBolsas(filial, plano))}</b>
        </div>
      )}
      <div className="alert gold" style={{ justifyContent: 'space-between' }}>
        <span>Valor mensal do plano</span>
        <b style={{ fontSize: 20 }}>{rotuloValor(valorPlano(filial, plano))}</b>
      </div>
    </div>
  );
}

/** Grava o plano do aluno e aplica o plano família (isenção dos beneficiários) no servidor */
export async function salvarPlanoAluno(alunoId, plano) {
  const limpo = {
    ...plano,
    modalidades: plano.tipo === 'pacote' ? [] : plano.modalidades || [],
    familia: plano.tipo === 'familia' ? { beneficiarios: (plano.familia?.beneficiarios || []).map((b) => ({ nome: b.nome.trim(), email: (b.email || '').trim().toLowerCase(), ...(Array.isArray(b.modalidades) ? { modalidades: b.modalidades } : {}), ...(b.outrasFiliais ? { outrasFiliais: true } : {}), ...(+b.bolsa > 0 ? { bolsa: +b.bolsa } : {}) })) } : undefined,
    combo: plano.tipo === 'familia' ? plano.combo : undefined,
    todas: plano.tipo === 'familia' ? !!plano.todas : undefined,
    atualizadoEm: new Date().toISOString(),
  };
  Object.keys(limpo).forEach((k) => limpo[k] === undefined && delete limpo[k]);
  setDB((d) => {
    const a = d.alunos.find((x) => x.id === alunoId);
    if (a) a.plano = limpo;
  });
  await flush();
  const { data, error } = await supabase.rpc('mq_aplicar_familia', { p_titular: alunoId });
  if (error) throw error;
  if (limpo.tipo === 'familia' && Array.isArray(data)) {
    // Mostra na hora quem foi encontrado (o servidor já gravou o mesmo resultado)
    setDB((d) => {
      const a = d.alunos.find((x) => x.id === alunoId);
      if (a?.plano?.familia) a.plano.familia.beneficiarios = data;
    });
  }
  return data || [];
}

// ---------------------------------------------------------------------------
// Dia de vencimento escolhido pelo aluno (1 a 28)
// ---------------------------------------------------------------------------
export function DiaVencimento({ aluno }) {
  const db = useDB();
  const padrao = db.config.diaVencimento || 10;
  const escolher = (v) => {
    setDB((d) => {
      const x = d.alunos.find((y) => y.id === aluno.id);
      if (!x) return;
      if (v === '') delete x.diaVencimento;
      else x.diaVencimento = +v;
    });
    toast(v === '' ? `Vencimento no dia padrão (${padrao}).` : `Vencimento no dia ${v}. Vale a partir da próxima mensalidade.`);
  };
  return (
    <Card title="📅 Dia de vencimento da mensalidade">
      <Field label="Vencer todo dia" hint="Vale a partir da próxima mensalidade gerada. Cobranças já emitidas mantêm o vencimento.">
        <select value={aluno.diaVencimento ?? ''} onChange={(e) => escolher(e.target.value)} style={{ maxWidth: 260 }}>
          <option value="">Padrão da Associação (dia {padrao})</option>
          {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>Dia {d}</option>)}
        </select>
      </Field>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Professor / Central: mensalidade padrão ou personalizada (desconto, benefício…)
// ---------------------------------------------------------------------------
export function ValorMensalidade({ aluno, user }) {
  const db = useDB();
  const m = mensalidadeDoAluno(db, aluno);
  const [modo, setModo] = useState(m.personalizada ? 'personalizada' : 'padrao');
  const [valor, setValor] = useState(m.personalizada ? String(m.valor) : '');
  const [motivo, setMotivo] = useState(m.motivo || '');
  const [aplicarAberta, setAplicarAberta] = useState(true);
  const comp = monthISO();
  const aberta = db.pagamentos.find((p) => p.pessoaId === aluno.id && p.tipo === 'mensalidade' && p.competencia === comp && p.status === 'pendente' && !p.comprovantes?.length);

  const salvar = () => {
    const personalizada = modo === 'personalizada';
    if (personalizada && (valor === '' || !(+valor >= 0))) return toast('Informe o valor personalizado.');
    if (personalizada && !motivo.trim()) return toast('Informe o motivo (ex.: bolsa parcial, benefício social).');
    const novo = personalizada ? +(+valor).toFixed(2) : m.padrao;
    const agora = new Date().toISOString();
    setDB((d) => {
      const x = d.alunos.find((y) => y.id === aluno.id);
      if (personalizada) x.mensalidadePersonalizada = { valor: novo, motivo: motivo.trim(), por: user.nome, em: agora };
      else delete x.mensalidadePersonalizada;
      x.historicoMensalidade = [...(x.historicoMensalidade || []), { em: agora, por: user.nome, valor: novo, padrao: m.padrao, personalizada, motivo: personalizada ? motivo.trim() : 'Voltou ao valor padrão' }];
      if (aplicarAberta && aberta) {
        const p = d.pagamentos.find((y) => y.id === aberta.id);
        if (p && p.status === 'pendente') {
          p.valor = novo;
          if (personalizada) Object.assign(p, { personalizada: true, valorPadrao: m.padrao });
          else (delete p.personalizada, delete p.valorPadrao);
          p.auditoria = [...(p.auditoria || []), { em: agora, por: user.nome, acao: 'valor_ajustado', motivo: personalizada ? `Mensalidade personalizada: ${motivo.trim()}` : 'Valor padrão' }];
        }
      }
      notify(d, aluno.id, 'Valor da mensalidade atualizado', personalizada ? `Sua mensalidade passa a ser ${brl(novo)} (${motivo.trim()}).` : `Sua mensalidade voltou ao valor padrão: ${brl(novo)}.`);
    });
    toast('Valor da mensalidade salvo.');
  };

  return (
    <Card title="💲 Valor da mensalidade">
      <div className="col">
        <label className="check">
          <input type="radio" name={`valor-${aluno.id}`} checked={modo === 'padrao'} onChange={() => setModo('padrao')} />
          <div>Mensalidade padrão — <b>{brl(m.padrao)}</b>/mês<div className="xs muted">Calculada pelo plano e pelos valores da filial</div></div>
        </label>
        <label className="check">
          <input type="radio" name={`valor-${aluno.id}`} checked={modo === 'personalizada'} onChange={() => setModo('personalizada')} />
          <div>Mensalidade personalizada<div className="xs muted">Desconto ou benefício não previsto pelo sistema</div></div>
        </label>
        {modo === 'personalizada' && (
          <div className="form-grid">
            <Field label="Valor mensal (R$)" hint={valor !== '' && +valor < m.padrao ? `Desconto de ${brl(m.padrao - +valor)} (${Math.round((1 - +valor / m.padrao) * 100)}%)` : ''}>
              <input type="number" min="0" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} placeholder={String(m.padrao)} />
            </Field>
            <Field label="Motivo"><input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: bolsa parcial, benefício social" /></Field>
          </div>
        )}
        {aberta && (
          <label className="check small">
            <input type="checkbox" checked={aplicarAberta} onChange={(e) => setAplicarAberta(e.target.checked)} /> Aplicar também à mensalidade em aberto deste mês ({brl(aberta.valor)})
          </label>
        )}
        {m.personalizada && <div className="xs muted">Atual: personalizada em {brl(m.valor)} por {m.por || '—'} · {m.motivo}</div>}
        <div><button className="btn" onClick={salvar}>Salvar valor</button></div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Financeiro: editar uma cobrança em aberto (valor/vencimento) e, se quiser,
// salvar o valor como mensalidade personalizada do aluno para os próximos meses
// ---------------------------------------------------------------------------
/** Dentro de "Editar mensalidade": ver e corrigir o plano do aluno (quando ele teve dificuldade em escolher) */
function PlanoNaCobranca({ aluno, onPlanoSalvo }) {
  const db = useDB();
  const filial = db.filiais.find((f) => f.id === aluno.filialId);
  const [editando, setEditando] = useState(false);
  const [plano, setPlano] = useState(aluno.plano || null);
  const [salvando, setSalvando] = useState(false);
  if (!temPlanos(filial)) return null;

  const salvar = async () => {
    const erro = validarPlano(filial, plano);
    if (erro) return toast(erro);
    setSalvando(true);
    try {
      await salvarPlanoAluno(aluno.id, plano);
      const v = valorPlano(filial, plano);
      setEditando(false);
      onPlanoSalvo?.(v);
      toast(`Plano salvo. Valor desta cobrança ajustado para ${brl(v)} — confira e clique em “Salvar alterações”.`);
    } catch (e) {
      toast('Não foi possível salvar o plano: ' + e.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="card" style={{ padding: 12, background: '#faf8f6' }}>
      <div className="row between" style={{ alignItems: 'center' }}>
        <div className="grow">
          <div className="small" style={{ fontWeight: 700 }}>📋 Plano do aluno</div>
          <div className="small">{aluno.plano ? <>{resumoPlano(filial, aluno.plano)} · <b>{brl(valorPlano(filial, aluno.plano))}/mês</b></> : <span className="muted">Nenhum plano escolhido — vale a mensalidade base ({brl(filial.mensalidade || 0)})</span>}</div>
        </div>
        {!editando && <button type="button" className="btn sm ghost" onClick={() => (setPlano(aluno.plano || null), setEditando(true))}>✏️ Editar plano</button>}
      </div>
      {editando && (
        <div className="col mt">
          <EscolhaPlano filial={filial} value={plano} onChange={setPlano} equipe />
          <div className="row" style={{ gap: 6 }}>
            <button type="button" className="btn" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar plano'}</button>
            <button type="button" className="btn ghost" onClick={() => setEditando(false)}>Cancelar</button>
          </div>
          <div className="xs muted">O plano vale para as próximas mensalidades. Depois de salvar, o valor desta cobrança é ajustado ao novo plano para você conferir.</div>
        </div>
      )}
    </div>
  );
}

export function EditarCobranca({ pagamentoId, user, onFeito }) {
  const db = useDB();
  const p = db.pagamentos.find((x) => x.id === pagamentoId);
  const aluno = p && db.alunos.find((a) => a.id === p.pessoaId);
  const m = aluno ? mensalidadeDoAluno(db, aluno) : null;
  const [valor, setValor] = useState(p ? String(p.valor) : '');
  const [vencimento, setVencimento] = useState(p?.vencimento || '');
  const [motivo, setMotivo] = useState(aluno?.mensalidadePersonalizada?.motivo || '');
  const [fixar, setFixar] = useState(p?.tipo === 'mensalidade' && !!aluno);
  const [planoMudou, setPlanoMudou] = useState(false);
  if (!p) return null;
  if (p.status !== 'pendente') return <div className="alert ok small">Esta cobrança já foi paga e não pode ser editada.</div>;

  const novo = valor === '' ? NaN : +(+valor).toFixed(2);
  const ehPadrao = m && novo === +(+m.padrao).toFixed(2);

  const salvar = () => {
    if (!(novo >= 0)) return toast('Informe um valor válido.');
    if (!vencimento) return toast('Informe o vencimento.');
    if (!ehPadrao && !motivo.trim() && (fixar || novo !== p.valor)) return toast('Informe o motivo do valor diferente (ex.: bolsa parcial, benefício).');
    const agora = new Date().toISOString();
    setDB((d) => {
      const x = d.pagamentos.find((y) => y.id === p.id);
      const antes = { valor: x.valor, vencimento: x.vencimento };
      x.valor = novo;
      x.vencimento = vencimento;
      if (p.tipo === 'mensalidade') {
        // Plano corrigido aqui mesmo: a descrição da cobrança acompanha o novo plano
        const al = aluno && d.alunos.find((y) => y.id === aluno.id);
        const fil = al && d.filiais.find((f) => f.id === al.filialId);
        if (planoMudou && al?.plano && temPlanos(fil)) x.descricao = `Mensalidade ${x.competencia} — ${resumoPlano(fil, al.plano)}`;
        if (ehPadrao) (delete x.personalizada, delete x.valorPadrao);
        else Object.assign(x, { personalizada: true, valorPadrao: m?.padrao });
      }
      x.auditoria = [...(x.auditoria || []), { em: agora, por: user.nome, acao: 'cobranca_editada', motivo: `${brl(antes.valor)} → ${brl(novo)}${antes.vencimento !== vencimento ? ` · vencimento ${antes.vencimento} → ${vencimento}` : ''}${motivo.trim() ? ` · ${motivo.trim()}` : ''}` }];
      if (fixar && aluno) {
        const a = d.alunos.find((y) => y.id === aluno.id);
        if (ehPadrao) delete a.mensalidadePersonalizada;
        else a.mensalidadePersonalizada = { valor: novo, motivo: motivo.trim(), por: user.nome, em: agora };
        a.historicoMensalidade = [...(a.historicoMensalidade || []), { em: agora, por: user.nome, valor: novo, padrao: m.padrao, personalizada: !ehPadrao, motivo: ehPadrao ? 'Voltou ao valor padrão' : motivo.trim() }];
      }
      notify(d, p.pessoaId, 'Cobrança atualizada', `${x.descricao}: ${brl(novo)}, vencimento ${new Date(vencimento + 'T12:00').toLocaleDateString('pt-BR')}.`);
    });
    toast('Cobrança atualizada.');
    onFeito?.();
  };

  return (
    <div className="col">
      <div className="card" style={{ padding: 12 }}>
        <div style={{ fontWeight: 700 }}>{aluno?.nome || '—'}</div>
        <div className="small">{p.descricao}</div>
        {m && <div className="xs muted">Mensalidade padrão da academia para este aluno: <b>{brl(m.padrao)}</b>{m.personalizada ? ` · hoje personalizada em ${brl(m.valor)} (${m.motivo || '—'})` : ''}</div>}
      </div>
      {p.tipo === 'mensalidade' && aluno && !aluno.isentoPor && (
        <PlanoNaCobranca aluno={aluno} onPlanoSalvo={(v) => (setValor(String(v)), setFixar(false), setPlanoMudou(true))} />
      )}
      {p.analise === 'enviado' && <div className="alert gold small">Esta cobrança já tem comprovante em conferência. Confira o valor pago antes de alterar.</div>}
      <div className="form-grid">
        <Field label="Valor desta cobrança (R$)" hint={m && novo < m.padrao ? `Desconto de ${brl(m.padrao - novo)} sobre o padrão` : ''}>
          <input type="number" min="0" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
        </Field>
        <Field label="Vencimento"><input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} /></Field>
        <Field label="Motivo" style={{ gridColumn: '1/-1' }}><input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: bolsa parcial, benefício social, acordo com o responsável" /></Field>
      </div>
      {m && (
        <div className="row" style={{ gap: 6 }}>
          <button type="button" className="btn sm ghost" onClick={() => setValor(String(m.padrao))}>Usar valor padrão ({brl(m.padrao)})</button>
        </div>
      )}
      {p.tipo === 'mensalidade' && aluno && (
        <label className="check small">
          <input type="checkbox" checked={fixar} onChange={(e) => setFixar(e.target.checked)} />
          {ehPadrao ? 'Voltar o aluno ao valor padrão também nas próximas mensalidades' : 'Salvar como mensalidade personalizada do aluno (próximas mensalidades com este valor)'}
        </label>
      )}
      <div><button className="btn" onClick={salvar}>Salvar alterações</button></div>
    </div>
  );
}
