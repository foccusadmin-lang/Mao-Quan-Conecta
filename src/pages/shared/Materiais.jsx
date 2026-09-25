import { useState } from 'react';
import { useDB, setDB, notify, professorEmDia } from '../../lib/db';
import { uid, todayISO, readFileAsDataURL, youtubeEmbed } from '../../lib/utils';
import { PageHead, Card, Modal, Field, Inp, Faixa, useConfirm, toast, Empty, FaixaOptions } from '../../components/ui';

export const TIPOS_MAT = { taolu: ['🥋', 'Taolu'], base: ['🦵', 'Bases'], video: ['🎬', 'Vídeo'], teoria: ['📖', 'Teoria'], pdf: ['📄', 'Documento'], certificado: ['🏅', 'Certificado'] };
const vazio = { titulo: '', tipo: 'video', faixaIdx: 0, url: '', arquivo: null, arquivoNome: '', descricao: '', publico: 'aluno', avancado: false };

export function MaterialView({ m }) {
  const yt = youtubeEmbed(m.url);
  return (
    <div className="col">
      {yt && <div className="video"><iframe src={yt} title={m.titulo} allowFullScreen allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" /></div>}
      {m.arquivo?.startsWith('data:video') && <div className="video"><video src={m.arquivo} controls controlsList="nodownload" /></div>}
      {m.arquivo?.startsWith('data:image') && <img src={m.arquivo} alt={m.titulo} style={{ borderRadius: 12 }} />}
      {m.descricao && <p style={{ whiteSpace: 'pre-line', margin: 0 }}>{m.descricao}</p>}
      <div className="row">
        {m.url && !yt && <a className="btn sm dark" href={m.url} target="_blank" rel="noreferrer">Abrir material ↗</a>}
        {m.arquivo && !m.arquivo.startsWith('data:video') && <a className="btn sm dark" href={m.arquivo} download={m.arquivoNome || m.titulo}>⬇ Baixar arquivo</a>}
      </div>
    </div>
  );
}

export default function Materiais({ user }) {
  const db = useDB();
  const isAdmin = user.role === 'admin';
  const [edit, setEdit] = useState(null);
  const [ver, setVer] = useState(null);
  const [faixa, setFaixa] = useState('');
  const [ask, confirmEl] = useConfirm();
  const bloqueado = user.role === 'professor' && !professorEmDia(user);

  const lista = db.materiais.filter((m) => faixa === '' || m.faixaIdx === +faixa).sort((a, b) => a.faixaIdx - b.faixaIdx);

  const salvar = () => {
    if (!edit.titulo) return toast('Informe o título.');
    if (!edit.url && !edit.arquivo) return toast('Informe um link ou envie um arquivo.');
    setDB((d) => {
      if (edit.id) Object.assign(d.materiais.find((m) => m.id === edit.id), edit);
      else {
        d.materiais.push({ ...edit, id: uid('m'), criadoEm: todayISO(), criadoPor: user.nome });
        if (edit.publico === 'aluno') notify(d, 'todos', 'Novo material didático', `${edit.titulo} — ${d.config.faixas[edit.faixaIdx]?.nome}`);
      }
    });
    setEdit(null);
    toast('Material salvo.');
  };

  if (bloqueado)
    return (
      <>
        <PageHead title="Material Didático" />
        <div className="alert red">⛔ A gestão de material didático exige a tarifa de manutenção/filiação em dia. Acesse <b>Filiação</b> para regularizar.</div>
      </>
    );

  return (
    <>
      <PageHead title="Material Didático" sub="Vídeos de Taolu, bases e teoria — liberados por faixa">
        <select value={faixa} onChange={(e) => setFaixa(e.target.value)} style={{ maxWidth: 200 }}>
          <option value="">Todas as faixas</option>
          <FaixaOptions />
        </select>
        <button className="btn" onClick={() => setEdit({ ...vazio })}>+ Adicionar material</button>
      </PageHead>
      {lista.length === 0 && <Empty icon="🎬">Nenhum material.</Empty>}
      <div className="grid g3">
        {lista.map((m) => (
          <Card key={m.id}>
            <div className="mat">
              <div className="ic">{TIPOS_MAT[m.tipo]?.[0]}</div>
              <div className="grow">
                <div style={{ fontWeight: 700 }}>{m.titulo}</div>
                <div className="row xs" style={{ gap: 6, marginTop: 4 }}>
                  <Faixa idx={m.faixaIdx} />
                  <span className="badge">{TIPOS_MAT[m.tipo]?.[1]}</span>
                  {m.publico === 'professor' && <span className="badge ink">Professores</span>}
                  {m.avancado && <span className="badge gold">Avançado</span>}
                </div>
              </div>
            </div>
            <div className="row end mt">
              <button className="btn sm ghost" onClick={() => setVer(m)}>Ver</button>
              {(isAdmin || m.criadoPor === user.nome || user.role === 'professor') && (
                <>
                  <button className="btn sm ghost" onClick={() => ask(`Excluir “${m.titulo}”?`, () => setDB((d) => { d.materiais = d.materiais.filter((x) => x.id !== m.id); }), 'Excluir')}>Excluir</button>
                  <button className="btn sm dark" onClick={() => setEdit({ ...vazio, ...m })}>Editar / Trocar</button>
                </>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Modal open={!!ver} onClose={() => setVer(null)} title={ver?.titulo} wide>{ver && <MaterialView m={ver} />}</Modal>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Editar material' : 'Novo material'} footer={<button className="btn" onClick={salvar}>Salvar</button>}>
        {edit && (
          <div className="col">
            <div className="form-grid">
              <Field label="Título" style={{ gridColumn: '1/-1' }}><Inp obj={edit} set={setEdit} k="titulo" /></Field>
              <Field label="Tipo">
                <select value={edit.tipo} onChange={(e) => setEdit({ ...edit, tipo: e.target.value })}>
                  {Object.entries(TIPOS_MAT).map(([k, [i, l]]) => <option key={k} value={k}>{i} {l}</option>)}
                </select>
              </Field>
              <Field label="Faixa (nível)">
                <select value={edit.faixaIdx} onChange={(e) => setEdit({ ...edit, faixaIdx: +e.target.value })}>
                  <FaixaOptions />
                </select>
              </Field>
              <Field label="Público">
                <select value={edit.publico} onChange={(e) => setEdit({ ...edit, publico: e.target.value })}>
                  <option value="aluno">Alunos da faixa</option>
                  <option value="professor">Somente professores</option>
                </select>
              </Field>
              <Field label="Link (YouTube, Drive, PDF…)" style={{ gridColumn: '1/-1' }}><Inp obj={edit} set={setEdit} k="url" type="url" placeholder="https://" /></Field>
            </div>
            <Field label="Ou enviar arquivo" hint="Até 3 MB nesta versão (vídeos longos: use link do YouTube não listado ou Google Drive).">
              <div className="row">
                <label className="btn ghost sm">
                  ⬆ {edit.arquivo ? 'Trocar arquivo' : 'Upload'}
                  <input
                    type="file"
                    hidden
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        setEdit({ ...edit, arquivo: await readFileAsDataURL(f), arquivoNome: f.name });
                      } catch (err) {
                        toast(err.message);
                      }
                      e.target.value = '';
                    }}
                  />
                </label>
                {edit.arquivo && <span className="small">{edit.arquivoNome} <button className="btn link sm" onClick={() => setEdit({ ...edit, arquivo: null, arquivoNome: '' })}>remover</button></span>}
              </div>
            </Field>
            <Field label="Descrição"><Inp obj={edit} set={setEdit} k="descricao" type="textarea" /></Field>
            <label className="check"><Inp obj={edit} set={setEdit} k="avancado" type="checkbox" /> Treinamento avançado (exige tarifa de manutenção em dia)</label>
          </div>
        )}
      </Modal>
      {confirmEl}
    </>
  );
}
