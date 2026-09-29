import { useEffect, useState } from 'react';
import { useDB, setDB, flush, departamentos } from '../lib/db';
import { supabase } from '../lib/supabase';
import { brl } from '../lib/utils';
import { COMBOS, modalidadesOfertadas, temPlanos, pacoteAtivo, combosAtivos, somaModalidades, valorPlano, economiaPacote, rotuloValor } from '../lib/planos';
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
    return p;
  };
  const [p, setP] = useState(inicial);
  const [base, setBase] = useState(filial.mensalidade ?? '');
  useEffect(() => (setP(inicial()), setBase(filial.mensalidade ?? '')), [filial.id]);

  const muda = (nome, patch) => setP({ ...p, modalidades: { ...p.modalidades, [nome]: { ...p.modalidades[nome], ...patch } } });
  const previa = { ...filial, planos: p };
  const ofertadas = modalidadesOfertadas(previa);

  const salvar = () => {
    if (Object.values(p.modalidades).some((m) => m.ativa && !(+m.valor > 0))) return toast('Informe o valor de cada modalidade oferecida.');
    if (p.pacote.ativo && !(+p.pacote.valor > 0)) return toast('Informe o valor promocional do pacote.');
    const limpo = {
      modalidades: Object.fromEntries(Object.entries(p.modalidades).filter(([, m]) => m.ativa || +m.valor > 0).map(([k, m]) => [k, { ativa: !!m.ativa, valor: +m.valor || 0 }])),
      pacote: { ativo: !!p.pacote.ativo, valor: +p.pacote.valor || 0 },
      familia: Object.fromEntries(COMBOS.filter((n) => +p.familia[n] > 0).map((n) => [n, +p.familia[n]])),
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
export function EscolhaPlano({ filial, value, onChange }) {
  const ofertadas = modalidadesOfertadas(filial);
  const combos = combosAtivos(filial);
  const plano = value || { tipo: 'modalidades', modalidades: [] };
  const muda = (patch) => onChange({ ...plano, ...patch });
  const alterna = (nome) => {
    const atual = plano.modalidades || [];
    muda({ modalidades: atual.includes(nome) ? atual.filter((x) => x !== nome) : [...atual, nome] });
  };
  const ajustaBenef = (combo) => {
    const lista = [...(plano.familia?.beneficiarios || [])].slice(0, combo - 1);
    while (lista.length < combo - 1) lista.push({ nome: '', email: '' });
    return lista;
  };
  const benef = plano.familia?.beneficiarios || [];
  const mudaBenef = (i, patch) => muda({ familia: { ...plano.familia, beneficiarios: benef.map((b, j) => (j === i ? { ...b, ...patch, alunoId: undefined, cadastrado: undefined } : b)) } });

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

      {(plano.tipo === 'modalidades' || (plano.tipo === 'familia' && !plano.todas)) && (
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {ofertadas.map((m) => {
            const on = (plano.modalidades || []).includes(m.nome);
            return (
              <button key={m.nome} type="button" className={`btn sm ${on ? '' : 'ghost'}`} onClick={() => alterna(m.nome)}>
                {on ? '✓ ' : ''}{m.nome}{plano.tipo === 'modalidades' ? ` · ${brl(m.valor)}` : ''}
              </button>
            );
          })}
        </div>
      )}
      {plano.tipo === 'pacote' && <div className="small">Inclui: <b>{ofertadas.map((m) => m.nome).join(', ')}</b></div>}

      {plano.tipo === 'familia' && (
        <div className="card" style={{ background: '#faf8f6' }}>
          <div className="form-grid">
            <Field label="Combo">
              <select value={plano.combo} onChange={(e) => muda({ combo: +e.target.value, familia: { beneficiarios: ajustaBenef(+e.target.value) } })}>
                {combos.map((c) => <option key={c.pessoas} value={c.pessoas}>{c.pessoas} pessoas — {brl(c.valor)}/mês</option>)}
              </select>
            </Field>
            <Field label="Modalidades da família">
              <label className="check" style={{ marginTop: 8 }}><input type="checkbox" checked={!!plano.todas} onChange={(e) => muda({ todas: e.target.checked })} /> Todas as modalidades</label>
            </Field>
          </div>
          <b className="small">Beneficiários (você é o titular e responsável pelo pagamento)</b>
          <p className="xs muted" style={{ margin: '2px 0 8px' }}>Informe o nome e, se tiver, o e-mail Google de cada um. Quem já tem cadastro fica isento automaticamente; quem se cadastrar depois também.</p>
          {benef.map((b, i) => (
            <div key={i} className="form-grid" style={{ marginBottom: 6 }}>
              <Field label={`Beneficiário ${i + 1} — nome completo`}><input value={b.nome} onChange={(e) => mudaBenef(i, { nome: e.target.value })} /></Field>
              <Field label="E-mail Google (opcional)">
                <input type="email" value={b.email || ''} onChange={(e) => mudaBenef(i, { email: e.target.value })} placeholder="beneficiario@gmail.com" />
                {b.cadastrado === true && <span className="hint" style={{ color: 'var(--ok)' }}>✓ Cadastro encontrado — isento</span>}
                {b.cadastrado === false && <span className="hint">Ainda sem cadastro — ficará isento ao se cadastrar</span>}
              </Field>
            </div>
          ))}
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
    familia: plano.tipo === 'familia' ? { beneficiarios: (plano.familia?.beneficiarios || []).map((b) => ({ nome: b.nome.trim(), email: (b.email || '').trim().toLowerCase() })) } : undefined,
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
