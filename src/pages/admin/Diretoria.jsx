import { useState } from 'react';
import { useDB, setDB } from '../../lib/db';
import { uid } from '../../lib/utils';
import { PageHead, Card, Modal, Field, useConfirm, toast } from '../../components/ui';

export default function Diretoria() {
  const db = useDB();
  const [edit, setEdit] = useState(null);
  const [ask, confirmEl] = useConfirm();

  const salvar = () => {
    const membros = edit.membrosTxt.split('\n').map((s) => s.trim()).filter(Boolean);
    if (!edit.cargo || !membros.length) return toast('Informe o cargo e ao menos um membro.');
    setDB((d) => {
      if (edit.id) Object.assign(d.diretoria.find((x) => x.id === edit.id), { cargo: edit.cargo, membros });
      else d.diretoria.push({ id: uid('d'), cargo: edit.cargo, membros });
    });
    setEdit(null);
  };
  const mover = (i, dir) =>
    setDB((d) => {
      const j = i + dir;
      if (j < 0 || j >= d.diretoria.length) return;
      [d.diretoria[i], d.diretoria[j]] = [d.diretoria[j], d.diretoria[i]];
    });

  return (
    <>
      <PageHead title="Gestão de Diretoria" sub="Diretoria Mao Quan Kung Fu Wushu — exibida nas vitrines de professores, alunos e patrocinadores">
        <button className="btn" onClick={() => setEdit({ cargo: '', membrosTxt: '' })}>+ Novo cargo</button>
      </PageHead>
      <div className="grid g3">
        {db.diretoria.map((d, i) => (
          <Card key={d.id}>
            <div className="xs" style={{ color: 'var(--red)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>{d.cargo}</div>
            {d.membros.map((m, k) => <div key={k} style={{ fontWeight: 600, marginTop: 4 }}>{m}</div>)}
            <div className="row end mt">
              <button className="btn sm ghost icon" onClick={() => mover(i, -1)} aria-label="Subir">↑</button>
              <button className="btn sm ghost icon" onClick={() => mover(i, 1)} aria-label="Descer">↓</button>
              <button className="btn sm ghost" onClick={() => ask(`Excluir o cargo “${d.cargo}”?`, () => setDB((x) => { x.diretoria = x.diretoria.filter((y) => y.id !== d.id); }), 'Excluir')}>Excluir</button>
              <button className="btn sm dark" onClick={() => setEdit({ id: d.id, cargo: d.cargo, membrosTxt: d.membros.join('\n') })}>Editar</button>
            </div>
          </Card>
        ))}
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Editar cargo' : 'Novo cargo'} footer={<button className="btn" onClick={salvar}>Salvar</button>}>
        {edit && (
          <div className="col">
            <Field label="Cargo / Departamento"><input value={edit.cargo} onChange={(e) => setEdit({ ...edit, cargo: e.target.value })} /></Field>
            <Field label="Membros" hint="Um por linha, com o título (Shifu, Laoshi, Jiǎngshī, Jiàoliàn…)">
              <textarea rows={5} value={edit.membrosTxt} onChange={(e) => setEdit({ ...edit, membrosTxt: e.target.value })} />
            </Field>
          </div>
        )}
      </Modal>
      {confirmEl}
    </>
  );
}
