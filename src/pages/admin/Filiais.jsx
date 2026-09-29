import { useState } from 'react';
import { useDB, setDB, responsaveisFilial, departamentos, filialNome } from '../../lib/db';
import { brl, uid, waLink, maskTelefone } from '../../lib/utils';
import { PageHead, Card, Modal, Field, Inp, Avatar, PhotoInput, useConfirm, toast, Empty } from '../../components/ui';
import { LinkMapa, enderecoFilial } from '../../components/shared';

const vazio = { nome: '', cidade: '', endereco: '', responsaveis: '', telefone: '', email: '', professorId: '', equipe: [], mensalidade: 120, aulasSemana: 2, minFrequencia: 75, maxFaltas: 6, ativa: true };

export default function Filiais() {
  const db = useDB();
  const [edit, setEdit] = useState(null);
  const [ask, confirmEl] = useConfirm();
  const deps = departamentos(db);

  const abrir = (f) => setEdit({ ...vazio, ...f, equipe: responsaveisFilial(f).map((r) => ({ ...r, departamentos: [...(r.departamentos || [])] })), professorId: f.professorId || '' });

  const salvar = () => {
    if (!edit.nome) return toast('Informe o nome da filial.');
    const equipe = edit.equipe.filter((r) => r.professorId);
    if (new Set(equipe.map((r) => r.professorId)).size !== equipe.length) return toast('O mesmo professor aparece duas vezes na equipe.');
    const principal = equipe.some((r) => r.professorId === edit.professorId) ? edit.professorId : equipe[0]?.professorId || null;
    setDB((d) => {
      const data = { ...edit, equipe, professorId: principal };
      delete data._fotoProf;
      if (edit.id) Object.assign(d.filiais.find((f) => f.id === edit.id), data);
      else d.filiais.push({ ...data, id: uid('fil') });
      const fid = edit.id || d.filiais.at(-1).id;
      // Cada professor responde por uma filial: sai da equipe das outras e passa a ser vinculado a esta
      equipe.forEach(({ professorId }) => {
        d.filiais.forEach((f) => {
          if (f.id === fid || !responsaveisFilial(f).some((r) => r.professorId === professorId)) return;
          f.equipe = responsaveisFilial(f).filter((r) => r.professorId !== professorId);
          if (f.professorId === professorId) f.professorId = f.equipe[0]?.professorId || null;
        });
        const p = d.professores.find((x) => x.id === professorId);
        if (p) p.filialId = fid;
      });
      if (principal && edit._fotoProf !== undefined) d.professores.find((x) => x.id === principal).foto = edit._fotoProf;
    });
    setEdit(null);
    toast('Filial salva.');
  };

  const prof = (id) => db.professores.find((p) => p.id === id);
  const mudaResp = (i, patch) => setEdit({ ...edit, equipe: edit.equipe.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const alternaDep = (i, dep) => {
    const atual = edit.equipe[i].departamentos || [];
    mudaResp(i, { departamentos: atual.includes(dep) ? atual.filter((x) => x !== dep) : [...atual, dep] });
  };

  return (
    <>
      <PageHead title="Academias Filiadas" sub={`${db.filiais.length} filiais cadastradas`}>
        <button className="btn" onClick={() => setEdit({ ...vazio, equipe: [{ professorId: '', departamentos: [] }] })}>+ Nova filial</button>
      </PageHead>

      {db.filiais.length === 0 && <Empty>Nenhuma filial.</Empty>}
      <div className="grid g3">
        {db.filiais.map((f) => {
          const equipe = responsaveisFilial(f);
          const alunos = db.alunos.filter((a) => a.filialId === f.id && a.status === 'aprovado').length;
          return (
            <Card key={f.id}>
              <div className="row between">
                <span className={`badge ${f.ativa ? 'ok' : ''}`}>{f.ativa ? 'Ativa' : 'Inativa'}</span>
                <span className="badge gold">{brl(f.mensalidade)}/mês</span>
              </div>
              <h3 style={{ marginTop: 10 }}>{f.nome}</h3>
              <div className="small muted">📍 <LinkMapa endereco={enderecoFilial(f)}>{f.endereco ? `${f.endereco} · ` : ''}{f.cidade}</LinkMapa></div>
              {f.responsaveis && <div className="small" style={{ marginTop: 4 }}>👥 {f.responsaveis}</div>}
              {(f.telefone || f.email) && (
                <div className="row small" style={{ marginTop: 4, gap: 8 }}>
                  {f.telefone && <a href={waLink('55' + f.telefone.replace(/\D/g, ''), `Olá! Contato pela filial ${f.nome} — Mao Quan Conecta.`)} target="_blank" rel="noreferrer">📞 {f.telefone}</a>}
                  {f.email && <a href={`mailto:${f.email}`}>✉️ {f.email}</a>}
                </div>
              )}
              <div className="xs muted" style={{ marginTop: 10 }}>{equipe.length > 1 ? 'Professores responsáveis' : 'Professor responsável'}</div>
              {equipe.length === 0 && <div className="list-item"><Avatar name="?" /><span className="muted">Não definido</span></div>}
              {equipe.map((r) => {
                const p = prof(r.professorId);
                return (
                  <div key={r.professorId} className="list-item" style={{ alignItems: 'flex-start' }}>
                    <Avatar src={p?.foto} name={p?.nome || '?'} />
                    <div className="grow">
                      <div style={{ fontWeight: 600 }}>{p ? `${p.titulo} ${p.nome}` : <span className="muted">Professor removido</span>}</div>
                      <div className="row" style={{ gap: 4, marginTop: 2 }}>
                        {(r.departamentos || []).map((x) => <span key={x} className="badge">{x}</span>)}
                        {f.professorId === r.professorId && equipe.length > 1 && <span className="badge ink" title="Responsável principal">Principal</span>} <span className="badge ok" title="Recebe a parte das mensalidades via PIX">💸 {equipe.length > 1 ? `1/${equipe.length} da mensalidade` : 'Mensalidades'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="row small muted">
                <span>🥋 {alunos} alunos</span>
                <span>📆 {f.aulasSemana}x/semana</span>
                <span>✅ mín. {f.minFrequencia}%</span>
              </div>
              <div className="row end mt">
                <button className="btn sm ghost" onClick={() => ask(`Excluir a filial “${f.nome}”? Os alunos vinculados ficarão sem filial.`, () => setDB((d) => { d.filiais = d.filiais.filter((x) => x.id !== f.id); }), 'Excluir')}>Excluir</button>
                <button className="btn sm dark" onClick={() => abrir(f)}>Editar</button>
              </div>
            </Card>
          );
        })}
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Editar filial' : 'Nova filial'} wide footer={<button className="btn" onClick={salvar}>Salvar</button>}>
        {edit && (
          <div className="col">
            <div className="form-grid">
              <Field label="Nome da filial"><Inp obj={edit} set={setEdit} k="nome" /></Field>
              <Field label="Cidade"><Inp obj={edit} set={setEdit} k="cidade" /></Field>
              <Field label="Endereço" style={{ gridColumn: '1/-1' }}><Inp obj={edit} set={setEdit} k="endereco" /></Field>
              <Field label="Responsáveis (divulgação)" style={{ gridColumn: '1/-1' }} hint="Nomes como aparecem em Onde Treinar (ex.: Laoshi Alan, Jiàoliàn Lilian)"><Inp obj={edit} set={setEdit} k="responsaveis" /></Field>
              <Field label="Telefone / WhatsApp"><Inp obj={edit} set={setEdit} k="telefone" type="tel" mask={maskTelefone} placeholder="(11) 90000-0000" /></Field>
              <Field label="E-mail"><Inp obj={edit} set={setEdit} k="email" type="email" /></Field>
              <Field label="Mensalidade (R$)" hint="Valor específico desta filial"><Inp obj={edit} set={setEdit} k="mensalidade" type="number" min="0" step="0.01" /></Field>
              <Field label="Aulas por semana"><Inp obj={edit} set={setEdit} k="aulasSemana" type="number" min="1" /></Field>
              <Field label="Frequência mínima p/ exame (%)"><Inp obj={edit} set={setEdit} k="minFrequencia" type="number" min="0" max="100" /></Field>
              <Field label="Máximo de faltas (90 dias)"><Inp obj={edit} set={setEdit} k="maxFaltas" type="number" min="0" /></Field>
            </div>

            <div className="card" style={{ background: '#faf8f6' }}>
              <b>🥋 Professores responsáveis</b>
              <p className="xs muted" style={{ margin: '4px 0 10px' }}>
                Marque as modalidades de cada um (Geral, Tradicional, Esportivo, Sanda, Tai Chi Chuan…). A mensalidade dos alunos é <b>dividida igualmente</b> entre os responsáveis que têm chave PIX cadastrada (ex.: R$ 300 com 2 professores = R$ 150 para cada, um PIX para cada). O marcado como <b>Principal</b> aparece primeiro e representa a filial.
              </p>
              {edit.equipe.length === 0 && <p className="small muted">Nenhum responsável definido.</p>}
              {edit.equipe.map((r, i) => {
                const outraFilial = r.professorId && prof(r.professorId)?.filialId && prof(r.professorId).filialId !== edit.id ? prof(r.professorId).filialId : null;
                return (
                  <div key={i} className="card" style={{ marginBottom: 10, padding: 12 }}>
                    <div className="row" style={{ flexWrap: 'wrap' }}>
                      <select value={r.professorId} onChange={(e) => mudaResp(i, { professorId: e.target.value })} style={{ flex: '1 1 220px' }}>
                        <option value="">Selecione o professor…</option>
                        {db.professores.map((p) => (
                          <option key={p.id} value={p.id} disabled={edit.equipe.some((x, j) => j !== i && x.professorId === p.id)}>{p.titulo} {p.nome}</option>
                        ))}
                      </select>
                      <label className="check small" title="Recebe as mensalidades da filial via PIX">
                        <input type="radio" name="principal" checked={!!r.professorId && edit.professorId === r.professorId} disabled={!r.professorId} onChange={() => setEdit({ ...edit, professorId: r.professorId })} /> ⭐ Principal
                      </label>
                      <button
                        type="button"
                        className="btn sm ghost icon"
                        aria-label="Remover responsável"
                        onClick={() => setEdit({ ...edit, equipe: edit.equipe.filter((_, j) => j !== i), professorId: edit.professorId === r.professorId ? '' : edit.professorId })}
                      >
                        ✕
                      </button>
                    </div>
                    <div className="row" style={{ gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                      <span className="xs muted">Modalidades:</span>
                      {deps.map((dep) => {
                        const on = (r.departamentos || []).includes(dep);
                        return (
                          <button key={dep} type="button" className={`btn sm ${on ? '' : 'ghost'}`} onClick={() => alternaDep(i, dep)}>
                            {on ? '✓ ' : ''}{dep}
                          </button>
                        );
                      })}
                    </div>
                    {outraFilial && <div className="xs" style={{ color: 'var(--red)', marginTop: 6 }}>Hoje vinculado a {filialNome(db, outraFilial)} — ao salvar, passa para esta filial.</div>}
                  </div>
                );
              })}
              <button type="button" className="btn sm dark" onClick={() => setEdit({ ...edit, equipe: [...edit.equipe, { professorId: '', departamentos: [] }] })}>+ Adicionar responsável</button>
            </div>

            {edit.professorId && (
              <Field label="Foto do responsável principal" hint="Por padrão usa a foto do perfil Google. Envie manualmente caso ele não tenha.">
                <PhotoInput
                  value={edit._fotoProf !== undefined ? edit._fotoProf : prof(edit.professorId)?.foto}
                  name={prof(edit.professorId)?.nome}
                  onChange={(v) => setEdit({ ...edit, _fotoProf: v })}
                />
              </Field>
            )}
            <label className="check"><Inp obj={edit} set={setEdit} k="ativa" type="checkbox" /> Filial ativa</label>
          </div>
        )}
      </Modal>
      {confirmEl}
    </>
  );
}
