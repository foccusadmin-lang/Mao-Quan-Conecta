import { useState } from 'react';
import { useDB, setDB, notify } from '../../lib/db';
import { uid, fmtDateTime } from '../../lib/utils';
import { PageHead, Card, Modal, Field, Tabs, useConfirm, toast, Empty } from '../../components/ui';
import { DiretoriaList } from '../../components/shared';

const TIPOS = { aviso: '📌 Aviso oficial', circular: '📄 Circular', convocacao: '📣 Convocação da Diretoria', estagio: '📚 Estágio técnico', reuniao: '💻 Reunião de professores' };

export default function Comunicados({ user }) {
  const db = useDB();
  const isAdmin = user.role === 'admin';
  const [tab, setTab] = useState('avisos');
  const [edit, setEdit] = useState(null);
  const [ask, confirmEl] = useConfirm();
  const lista = [...db.comunicados].sort((a, b) => b.data.localeCompare(a.data));

  const salvar = () => {
    if (!edit.titulo || !edit.texto) return toast('Preencha título e texto.');
    setDB((d) => {
      if (edit.id) Object.assign(d.comunicados.find((c) => c.id === edit.id), edit);
      else {
        d.comunicados.push({ ...edit, id: uid('c'), data: new Date().toISOString() });
        notify(d, edit.destino, `${TIPOS[edit.tipo]}: ${edit.titulo}`, edit.texto.slice(0, 120));
      }
    });
    setEdit(null);
    toast('Comunicado publicado.');
  };

  return (
    <>
      <PageHead title={isAdmin ? 'Comunicados' : 'Comunicação da Sede'} sub="Avisos, circulares, convocações, estágios e reuniões enviados pela Sede">
        {isAdmin && <button className="btn" onClick={() => setEdit({ titulo: '', texto: '', tipo: 'aviso', destino: 'professores' })}>+ Novo comunicado</button>}
      </PageHead>
      <Tabs tabs={[['avisos', '📢 Comunicados'], ['diretoria', '🏛️ Diretoria em atuação']]} value={tab} onChange={setTab} />
      {tab === 'avisos' && (
        <div className="col">
          {lista.length === 0 && <Empty icon="📭">Nenhum comunicado.</Empty>}
          {lista.map((c) => (
            <Card key={c.id}>
              <div className="row between">
                <span className="badge red">{TIPOS[c.tipo]}</span>
                <span className="xs muted">{fmtDateTime(c.data)} · {c.destino === 'todos' ? 'Todos' : 'Professores'}</span>
              </div>
              <h3 style={{ marginTop: 10 }}>{c.titulo}</h3>
              <p style={{ whiteSpace: 'pre-line', margin: 0 }}>{c.texto}</p>
              {isAdmin && (
                <div className="row end mt">
                  <button className="btn sm ghost" onClick={() => ask('Excluir comunicado?', () => setDB((d) => { d.comunicados = d.comunicados.filter((x) => x.id !== c.id); }), 'Excluir')}>Excluir</button>
                  <button className="btn sm dark" onClick={() => setEdit(c)}>Editar</button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
      {tab === 'diretoria' && <DiretoriaList />}

      <Modal open={!!edit} onClose={() => setEdit(null)} title="Comunicado" footer={<button className="btn" onClick={salvar}>Publicar</button>}>
        {edit && (
          <div className="col">
            <div className="form-grid">
              <Field label="Tipo">
                <select value={edit.tipo} onChange={(e) => setEdit({ ...edit, tipo: e.target.value })}>
                  {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label="Destino">
                <select value={edit.destino} onChange={(e) => setEdit({ ...edit, destino: e.target.value })}>
                  <option value="professores">Professores</option>
                  <option value="todos">Todos (inclui alunos)</option>
                </select>
              </Field>
            </div>
            <Field label="Título"><input value={edit.titulo} onChange={(e) => setEdit({ ...edit, titulo: e.target.value })} /></Field>
            <Field label="Texto"><textarea rows={6} value={edit.texto} onChange={(e) => setEdit({ ...edit, texto: e.target.value })} /></Field>
          </div>
        )}
      </Modal>
      {confirmEl}
    </>
  );
}
