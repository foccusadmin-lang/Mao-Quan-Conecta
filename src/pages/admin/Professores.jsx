import { useState } from 'react';
import { IDX_PRIMEIRA_PRETA } from '../../lib/seed';
import { useDB, setDB, professorEmDia, filialNome, notify, RECURSOS_PROF, recursosPadrao, temRecurso } from '../../lib/db';
import { uid, fmtDate, addDays, todayISO, maskCPF, maskRG, maskTelefone } from '../../lib/utils';
import { PageHead, Card, Modal, Field, Inp, Avatar, PhotoInput, Faixa, useConfirm, toast, Empty, Search, FaixaOptions } from '../../components/ui';

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
    setDB((d) => {
      const data = { ...edit, email, filialId: edit.filialId || null };
      let id = edit.id;
      if (id) Object.assign(d.professores.find((p) => p.id === id), data);
      else {
        id = uid('pr');
        d.professores.push({ ...data, id, criadoEm: new Date().toISOString() });
        notify(d, id, 'Acesso habilitado', 'Bem-vindo(a) ao painel do Laoshi!');
      }
      if (data.filialId) {
        const f = d.filiais.find((x) => x.id === data.filialId);
        if (f && !f.professorId) f.professorId = id;
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
                    <td>{filialNome(db, p.filialId)}</td>
                    <td><Faixa idx={p.faixaIdx} /></td>
                    <td>{professorEmDia(p) ? <span className="badge ok">até {fmtDate(p.filiacaoValidaAte)}</span> : <span className="badge red">Vencida</span>}</td>
                    <td><span className={`badge ${p.ativo ? 'ok' : ''}`}>{p.ativo ? 'Ativo' : 'Bloqueado'}</span><div className="xs muted">{RECURSOS_PROF.filter(([k]) => temRecurso(p, k)).length}/{RECURSOS_PROF.length} recursos</div></td>
                    <td className="nowrap">
                      <button className="btn sm ghost" onClick={() => promover(p)} title="Propor/Aprovar graduação">🎖️</button>{' '}
                      <button className="btn sm dark" onClick={() => setEdit({ ...vazio, ...p, filialId: p.filialId || '', recursos: { ...recursosPadrao(), ...p.recursos } })}>Editar</button>{' '}
                      <button className="btn sm ghost" onClick={() => ask(`Excluir ${p.nome}?`, () => setDB((d) => { d.professores = d.professores.filter((x) => x.id !== p.id); d.filiais.forEach((f) => f.professorId === p.id && (f.professorId = null)); }), 'Excluir')}>🗑</button>
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
              <Field label="RG"><input value={edit.rg || ''} onChange={(e) => setEdit({ ...edit, rg: maskRG(e.target.value) })} placeholder="00.000.000-0" inputMode="text" maxLength={12} /></Field>
              <Field label="CPF"><input value={edit.cpf || ''} inputMode="numeric" onChange={(e) => setEdit({ ...edit, cpf: maskCPF(e.target.value) })} placeholder="000.000.000-00" maxLength={14} /></Field>
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
              <Field label="Filiação válida até" hint="Atualizada automaticamente ao confirmar o pagamento">
                <Inp obj={edit} set={setEdit} k="filiacaoValidaAte" type="date" />
              </Field>
            </div>
            <div className="row">
              <button type="button" className="btn sm ghost" onClick={() => setEdit({ ...edit, filiacaoValidaAte: addDays(todayISO(), 30) })}>+30 dias</button>
              <button type="button" className="btn sm ghost" onClick={() => setEdit({ ...edit, filiacaoValidaAte: addDays(todayISO(), 365) })}>+1 ano</button>
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
