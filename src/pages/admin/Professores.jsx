import { useState } from 'react';
import { IDX_PRIMEIRA_PRETA } from '../../lib/seed';
import { useDB, setDB, professorEmDia, filialNome, notify, RECURSOS_PROF, recursosPadrao, temRecurso, adicionarResponsavel, removerResponsavel, ehResponsavel, departamentos, modalidadesProfessor, responsaveisFilial } from '../../lib/db';
import { uid, fmtDate, addDays, todayISO, maskCPF, maskRG, maskTelefone } from '../../lib/utils';
import { PageHead, Card, Modal, Field, Inp, Avatar, PhotoInput, Faixa, useConfirm, toast, Empty, Search, FaixaOptions } from '../../components/ui';
import { CamposChavePix, prepararPix, pixVazio } from '../../components/ChavePix';

const TITULOS = ['Shifu', 'Laoshi', 'Jiǎngshī', 'Jiàoliàn', 'Zhùjiào'];
const vazio = { nome: '', email: '', telefone: '', rg: '', cpf: '', nascimento: '', titulo: 'Laoshi', faixaIdx: IDX_PRIMEIRA_PRETA, filialId: '', foto: null, ativo: true, filiacaoValidaAte: '', obs: '', recursos: recursosPadrao() };

export default function Professores() {
  const db = useDB();
  const [edit, setEdit] = useState(null);
  const [q, setQ] = useState('');
  const [ask, confirmEl] = useConfirm();

  const salvar = () => {
    if (!edit.nome || !/^\S+@\S+\.\S+$/.test(edit.email)) return toast('Informe nome e e-mail válido.');
    const email = edit.email.trim().toLowerCase();
    if (db.professores.some((p) => p.email === email && p.id !== edit.id)) return toast('E-mail já cadastrado.');
    let pix;
    try {
      pix = prepararPix(edit.pix);
    } catch (e) {
      return toast('Chave PIX: ' + e.message);
    }
    const antesExtras = (edit.id && db.professores.find((p) => p.id === edit.id)?.filiaisExtras) || [];
    setDB((d) => {
      const data = { ...edit, email, filialId: edit.filialId || null, pix };
      if (!pix) delete data.pix;
      let id = edit.id;
      if (id) {
        const alvo = d.professores.find((p) => p.id === id);
        if ((data.foto || null) !== (alvo.foto || null)) data.fotoDefinida = true; // não volta a ser a foto do Google
        Object.assign(alvo, data);
        if (!pix) delete alvo.pix;
        // Mesma pessoa como praticante: nome e foto iguais nas duas fichas
        const pr = d.alunos.find((a) => (a.email || '').toLowerCase() === email);
        if (pr) {
          pr.nome = data.nome;
          pr.foto = data.foto;
          if (data.fotoDefinida) pr.fotoDefinida = true;
        }
      } else {
        id = uid('pr');
        d.professores.push({ ...data, id, criadoEm: new Date().toISOString() });
        notify(d, id, 'Acesso habilitado', 'Bem-vindo(a) ao painel do Laoshi!');
      }
      if (data.filialId) {
        const f = d.filiais.find((x) => x.id === data.filialId);
        if (f && !f.professorId) adicionarResponsavel(f, id);
        // Mantém as modalidades iguais na equipe de responsáveis da filial
        if (f && ehResponsavel(f, id)) f.equipe = responsaveisFilial(f).map((r) => (r.professorId === id ? { ...r, departamentos: [...(data.modalidades || [])] } : r));
      }
      // Filiais adicionais: entra na equipe de responsáveis de cada uma; sai das que foram desmarcadas
      const extras = (data.filiaisExtras || []).filter((x) => x && x !== data.filialId);
      const alvo = d.professores.find((p) => p.id === id);
      alvo.filiaisExtras = extras;
      if (!extras.length) delete alvo.filiaisExtras;
      for (const f of d.filiais) {
        if (f.id === data.filialId) continue;
        if (extras.includes(f.id)) adicionarResponsavel(f, id);
        else if (antesExtras.includes(f.id)) removerResponsavel(f, id);
      }
    });
    setEdit(null);
    toast('Professor salvo.');
  };

  const promover = (p) =>
    ask(`Promover ${p.nome} para ${db.config.faixas[p.faixaIdx + 1]?.nome || 'o próximo nível'}?`, () =>
      setDB((d) => {
        const x = d.professores.find((y) => y.id === p.id);
        x.faixaIdx = Math.min(d.config.faixas.length - 1, x.faixaIdx + 1);
        (x.historicoGraduacao ||= []).push({ data: todayISO(), faixaIdx: x.faixaIdx });
        notify(d, p.id, 'Graduação aprovada 🎖️', `Nova graduação: ${d.config.faixas[x.faixaIdx].nome}`);
      })
    );

  const lista = db.professores.filter((p) => (p.nome + p.email).toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageHead title="Professores Filiados" sub="A conta Google cadastrada aqui abre automaticamente o Painel do Laoshi. Para promover um aluno, use Alunos › Abrir › Promover a Professor.">
        <Search value={q} onChange={setQ} />
        <button className="btn" onClick={() => setEdit({ ...vazio })}>+ Novo professor</button>
      </PageHead>

      <Card>
        {lista.length === 0 ? (
          <Empty icon="👨‍🏫">Nenhum professor cadastrado.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Professor</th><th>Filial</th><th>Graduação</th><th>Filiação</th><th>Acesso</th><th></th></tr>
              </thead>
              <tbody>
                {lista.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="row" style={{ flexWrap: 'nowrap' }}>
                        <Avatar src={p.foto} name={p.nome} />
                        <div>
                          <div style={{ fontWeight: 600 }}>{p.titulo} {p.nome}</div>
                          <div className="xs muted">{p.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {filialNome(db, p.filialId)}{p.filiaisExtras?.length ? <span className="xs muted"> + {p.filiaisExtras.map((x) => filialNome(db, x)).join(", ")}</span> : null}
                      <div className="xs">
                        {db.filiais.some((f) => ehResponsavel(f, p.id)) && <span className="badge gold" style={{ marginRight: 4 }}>{db.filiais.some((f) => f.professorId === p.id) ? 'Responsável principal' : 'Responsável'}</span>}
                        {p.pix?.chave ? <span className="badge ok">PIX ✓</span> : <span className="badge">Sem PIX</span>}
                      </div>
                    </td>
                    <td><Faixa idx={p.faixaIdx} /></td>
                    <td>{professorEmDia(p) ? <span className="badge ok">até {fmtDate(p.filiacaoValidaAte)}</span> : <span className="badge red">Vencida</span>}</td>
                    <td><span className={`badge ${p.ativo ? 'ok' : ''}`}>{p.ativo ? 'Ativo' : 'Bloqueado'}</span><div className="xs muted">{RECURSOS_PROF.filter(([k]) => temRecurso(p, k)).length}/{RECURSOS_PROF.length} recursos</div></td>
                    <td className="nowrap">
                      <button className="btn sm ghost" onClick={() => promover(p)} title="Propor/Aprovar graduação">🎖️</button>{' '}
                      <button className="btn sm dark" onClick={() => setEdit({ ...vazio, ...p, modalidades: [...modalidadesProfessor(db, p)], filialId: p.filialId || '', recursos: { ...recursosPadrao(), ...p.recursos } })}>Editar</button>{' '}
                      <button className="btn sm ghost" onClick={() => ask(`Excluir ${p.nome}?`, () => setDB((d) => { d.professores = d.professores.filter((x) => x.id !== p.id); d.filiais.forEach((f) => removerResponsavel(f, p.id)); }), 'Excluir')}>🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Editar professor' : 'Novo professor'} footer={<button className="btn" onClick={salvar}>Salvar</button>}>
        {edit && (
          <div className="col">
            <PhotoInput value={edit.foto} name={edit.nome} onChange={(v) => setEdit({ ...edit, foto: v })} />
            <div className="form-grid">
              <Field label="Nome completo"><Inp obj={edit} set={setEdit} k="nome" /></Field>
              <Field label="E-mail de login (Google)"><Inp obj={edit} set={setEdit} k="email" type="email" /></Field>
              <Field label="Telefone"><Inp obj={edit} set={setEdit} k="telefone" type="tel" mask={maskTelefone} placeholder="(11) 90000-0000" /></Field>
              <Field label="Nascimento"><Inp obj={edit} set={setEdit} k="nascimento" type="date" /></Field>
              <Field label="RG"><input value={maskRG(edit.rg || '')} onChange={(e) => setEdit({ ...edit, rg: maskRG(e.target.value) })} placeholder="00.000.000-0" inputMode="text" maxLength={12} /></Field>
              <Field label="CPF"><input value={maskCPF(edit.cpf || '')} inputMode="numeric" onChange={(e) => setEdit({ ...edit, cpf: maskCPF(e.target.value) })} placeholder="000.000.000-00" maxLength={14} /></Field>
              <Field label="Título">
                <select value={edit.titulo} onChange={(e) => setEdit({ ...edit, titulo: e.target.value })}>
                  {TITULOS.map((t) => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Graduação">
                <select value={edit.faixaIdx} onChange={(e) => setEdit({ ...edit, faixaIdx: +e.target.value })}>
                  <FaixaOptions />
                </select>
              </Field>
              <Field label="Filial designada">
                <select value={edit.filialId} onChange={(e) => setEdit({ ...edit, filialId: e.target.value })}>
                  <option value="">— Nenhuma —</option>
                  {db.filiais.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </Field>
              <Field label="Filiais adicionais" style={{ gridColumn: '1/-1' }} hint="Para quem responde por mais de uma filial (ex.: Sede e Engenho Novo). No painel ele escolhe no topo em qual filial está trabalhando.">
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  {db.filiais.filter((f) => f.id !== edit.filialId).map((f) => {
                    const on = (edit.filiaisExtras || []).includes(f.id);
                    return (
                      <button key={f.id} type="button" className={`btn sm ${on ? '' : 'ghost'}`} onClick={() => setEdit({ ...edit, filiaisExtras: on ? edit.filiaisExtras.filter((x) => x !== f.id) : [...(edit.filiaisExtras || []), f.id] })}>
                        {on ? '✓ ' : ''}{f.nome}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="Modalidades sob responsabilidade" style={{ gridColumn: '1/-1' }} hint="O professor vê só os alunos dessas modalidades na filial. Sem nenhuma marcada, vê todos os alunos da filial.">
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  {departamentos(db).map((m) => {
                    const on = (edit.modalidades || []).includes(m);
                    return (
                      <button key={m} type="button" className={`btn sm ${on ? '' : 'ghost'}`} onClick={() => setEdit({ ...edit, modalidades: on ? edit.modalidades.filter((x) => x !== m) : [...(edit.modalidades || []), m] })}>
                        {on ? '✓ ' : ''}{m}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="Filiação válida até" hint="Atualizada automaticamente ao confirmar o pagamento">
                <Inp obj={edit} set={setEdit} k="filiacaoValidaAte" type="date" />
              </Field>
            </div>
            <div className="row">
              <button type="button" className="btn sm ghost" onClick={() => setEdit({ ...edit, filiacaoValidaAte: addDays(todayISO(), 30) })}>+30 dias</button>
              <button type="button" className="btn sm ghost" onClick={() => setEdit({ ...edit, filiacaoValidaAte: addDays(todayISO(), 365) })}>+1 ano</button>
            </div>
            {edit.id && (() => {
              const pr = db.alunos.find((a) => (a.email || '').toLowerCase() === (edit.email || '').toLowerCase());
              const liberar = (ativo, polo) =>
                setDB((d) => {
                  const x = d.alunos.find((a) => a.id === pr.id);
                  x.atleta = { ...(x.atleta || {}), ativo, polo: polo ?? x.atleta?.polo ?? '' };
                  if (ativo && !pr.atleta?.ativo) notify(d, edit.id, 'Você foi liberado(a) como Atleta 🏆', 'O menu Atleta já aparece no seu painel: monte seu perfil em Construir Carreira.');
                });
              return (
                <div className="card" style={{ background: '#faf8f6' }}>
                  <b>🏆 Atleta</b>
                  {!pr ? (
                    <p className="xs muted" style={{ margin: '4px 0 0' }}>Este professor ainda não tem matrícula de praticante. Ele ativa em <b>Meu Plano</b>; depois a liberação de atleta aparece aqui.</p>
                  ) : (
                    <div className="col" style={{ marginTop: 6 }}>
                      <label className="check">
                        <input type="checkbox" checked={!!pr.atleta?.ativo} onChange={(e) => (liberar(e.target.checked), toast(e.target.checked ? 'Liberado como atleta.' : 'Área de atleta desativada.'))} /> Liberado como atleta (menu Atleta e Construir Carreira no painel dele)
                      </label>
                      {pr.atleta?.ativo && (
                        <Field label="Polo / Equipe">
                          <select value={pr.atleta.polo || ''} onChange={(e) => liberar(true, e.target.value)}>
                            <option value="">Selecione…</option>
                            {db.config.polos.filter(Boolean).map((p) => <option key={p}>{p}</option>)}
                          </select>
                        </Field>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
            <div className="card" style={{ background: '#faf8f6' }}>
              <b>💸 Chave PIX para receber as mensalidades da filial</b>
              <p className="xs muted" style={{ margin: '4px 0 10px' }}>Usada quando este professor é o responsável pela filial. O próprio professor também pode alterar no painel dele.</p>
              <CamposChavePix pix={edit.pix || pixVazio(edit.nome)} onChange={(pix) => setEdit({ ...edit, pix })} />
            </div>
            <Field label="Observações"><Inp obj={edit} set={setEdit} k="obs" type="textarea" /></Field>
            <div className="card" style={{ background: '#faf8f6' }}>
              <div className="row between mb">
                <b>Recursos do Painel do Professor</b>
                <div className="row">
                  <button type="button" className="btn sm ghost" onClick={() => setEdit({ ...edit, recursos: recursosPadrao() })}>Todos</button>
                  <button type="button" className="btn sm ghost" onClick={() => setEdit({ ...edit, recursos: Object.fromEntries(RECURSOS_PROF.map(([k]) => [k, false])) })}>Nenhum</button>
                </div>
              </div>
              <div className="grid g2" style={{ gap: 8 }}>
                {RECURSOS_PROF.map(([k, label]) => (
                  <label key={k} className="check">
                    <input type="checkbox" checked={temRecurso(edit, k)} onChange={(e) => setEdit({ ...edit, recursos: { ...edit.recursos, [k]: e.target.checked } })} />
                    {label}
                  </label>
                ))}
              </div>
              <p className="xs muted" style={{ margin: '8px 0 0' }}>O painel “Minha Unidade” fica sempre disponível. Os demais itens aparecem conforme marcado aqui.</p>
            </div>
            <label className="check"><Inp obj={edit} set={setEdit} k="ativo" type="checkbox" /> Acesso ao painel habilitado</label>
          </div>
        )}
      </Modal>
      {confirmEl}
    </>
  );
}
