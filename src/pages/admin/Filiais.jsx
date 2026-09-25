import { useState } from 'react';
import { useDB, setDB } from '../../lib/db';
import { brl, uid, waLink, maskTelefone } from '../../lib/utils';
import { PageHead, Card, Modal, Field, Inp, Avatar, PhotoInput, useConfirm, toast, Empty } from '../../components/ui';

const vazio = { nome: '', cidade: '', endereco: '', responsaveis: '', telefone: '', email: '', professorId: '', mensalidade: 120, aulasSemana: 2, minFrequencia: 75, maxFaltas: 6, ativa: true };

export default function Filiais() {
  const db = useDB();
  const [edit, setEdit] = useState(null);
  const [ask, confirmEl] = useConfirm();

  const salvar = () => {
    if (!edit.nome) return toast('Informe o nome da filial.');
    setDB((d) => {
      const data = { ...edit, professorId: edit.professorId || null };
      delete data._fotoProf;
      if (edit.id) Object.assign(d.filiais.find((f) => f.id === edit.id), data);
      else d.filiais.push({ ...data, id: uid('fil') });
      const fid = edit.id || d.filiais.at(-1).id;
      if (data.professorId) {
        d.filiais.forEach((f) => f.id !== fid && f.professorId === data.professorId && (f.professorId = null));
        const p = d.professores.find((x) => x.id === data.professorId);
        p.filialId = fid;
        if (edit._fotoProf !== undefined) p.foto = edit._fotoProf;
      }
    });
    setEdit(null);
    toast('Filial salva.');
  };

  const prof = (id) => db.professores.find((p) => p.id === id);

  return (
    <>
      <PageHead title="Academias Filiadas" sub={`${db.filiais.length} filiais cadastradas`}>
        <button className="btn" onClick={() => setEdit({ ...vazio })}>+ Nova filial</button>
      </PageHead>

      {db.filiais.length === 0 && <Empty>Nenhuma filial.</Empty>}
      <div className="grid g3">
        {db.filiais.map((f) => {
          const p = prof(f.professorId);
          const alunos = db.alunos.filter((a) => a.filialId === f.id && a.status === 'aprovado').length;
          return (
            <Card key={f.id}>
              <div className="row between">
                <span className={`badge ${f.ativa ? 'ok' : ''}`}>{f.ativa ? 'Ativa' : 'Inativa'}</span>
                <span className="badge gold">{brl(f.mensalidade)}/mês</span>
              </div>
              <h3 style={{ marginTop: 10 }}>{f.nome}</h3>
              <div className="small muted">📍 {f.endereco ? `${f.endereco} · ` : ''}{f.cidade}</div>
              {f.responsaveis && <div className="small" style={{ marginTop: 4 }}>👥 {f.responsaveis}</div>}
              {(f.telefone || f.email) && (
                <div className="row small" style={{ marginTop: 4, gap: 8 }}>
                  {f.telefone && <a href={waLink('55' + f.telefone.replace(/\D/g, ''), `Olá! Contato pela filial ${f.nome} — Mao Quan Conecta.`)} target="_blank" rel="noreferrer">📞 {f.telefone}</a>}
                  {f.email && <a href={`mailto:${f.email}`}>✉️ {f.email}</a>}
                </div>
              )}
              <div className="list-item">
                <Avatar src={p?.foto} name={p?.nome || '?'} />
                <div className="grow">
                  <div className="xs muted">Professor responsável</div>
                  <div style={{ fontWeight: 600 }}>{p ? `${p.titulo} ${p.nome}` : <span className="muted">Não definido</span>}</div>
                </div>
              </div>
              <div className="row small muted">
                <span>🥋 {alunos} alunos</span>
                <span>📆 {f.aulasSemana}x/semana</span>
                <span>✅ mín. {f.minFrequencia}%</span>
              </div>
              <div className="row end mt">
                <button className="btn sm ghost" onClick={() => ask(`Excluir a filial “${f.nome}”? Os alunos vinculados ficarão sem filial.`, () => setDB((d) => { d.filiais = d.filiais.filter((x) => x.id !== f.id); }), 'Excluir')}>Excluir</button>
                <button className="btn sm dark" onClick={() => setEdit({ ...vazio, ...f, professorId: f.professorId || '' })}>Editar</button>
              </div>
            </Card>
          );
        })}
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Editar filial' : 'Nova filial'} footer={<button className="btn" onClick={salvar}>Salvar</button>}>
        {edit && (
          <div className="col">
            <div className="form-grid">
              <Field label="Nome da filial"><Inp obj={edit} set={setEdit} k="nome" /></Field>
              <Field label="Cidade"><Inp obj={edit} set={setEdit} k="cidade" /></Field>
              <Field label="Endereço" style={{ gridColumn: '1/-1' }}><Inp obj={edit} set={setEdit} k="endereco" /></Field>
              <Field label="Responsáveis" style={{ gridColumn: '1/-1' }} hint="Nomes como aparecem na divulgação (ex.: Laoshi Alan, Jiàoliàn Lilian)"><Inp obj={edit} set={setEdit} k="responsaveis" /></Field>
              <Field label="Telefone / WhatsApp"><Inp obj={edit} set={setEdit} k="telefone" type="tel" mask={maskTelefone} placeholder="(11) 90000-0000" /></Field>
              <Field label="E-mail"><Inp obj={edit} set={setEdit} k="email" type="email" /></Field>
              <Field label="Mensalidade (R$)" hint="Valor específico desta filial"><Inp obj={edit} set={setEdit} k="mensalidade" type="number" min="0" step="0.01" /></Field>
              <Field label="Aulas por semana"><Inp obj={edit} set={setEdit} k="aulasSemana" type="number" min="1" /></Field>
              <Field label="Frequência mínima p/ exame (%)"><Inp obj={edit} set={setEdit} k="minFrequencia" type="number" min="0" max="100" /></Field>
              <Field label="Máximo de faltas (90 dias)"><Inp obj={edit} set={setEdit} k="maxFaltas" type="number" min="0" /></Field>
              <Field label="Professor responsável" style={{ gridColumn: '1/-1' }}>
                <select value={edit.professorId} onChange={(e) => setEdit({ ...edit, professorId: e.target.value })}>
                  <option value="">— Nenhum —</option>
                  {db.professores.map((p) => <option key={p.id} value={p.id}>{p.titulo} {p.nome}</option>)}
                </select>
              </Field>
            </div>
            {edit.professorId && (
              <Field label="Foto do professor" hint="Por padrão usa a foto do perfil Google. Envie manualmente caso ele não tenha.">
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
