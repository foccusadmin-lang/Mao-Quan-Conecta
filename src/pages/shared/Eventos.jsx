import { useState } from 'react';
import { useDB, setDB, notify } from '../../lib/db';
import { uid, fmtDate, todayISO, readImage, mapsRota } from '../../lib/utils';
import { PageHead, Card, Modal, Field, Inp, Tabs, useConfirm, toast, Empty } from '../../components/ui';
import { LinkMapa, enderecoEvento, enderecoFilial } from '../../components/shared';

const TIPOS = { evento: '🎉 Evento', exame: '🎖️ Exame', campeonato: '🏆 Campeonato', reuniao: '💻 Reunião', estagio: '📚 Estágio técnico' };
const vazio = { titulo: '', tipo: 'evento', data: todayISO(), hora: '', local: '', endereco: '', descricao: '', capa: null, meet: '', publico: 'todos', confirmados: [] };

export default function Eventos({ user }) {
  const db = useDB();
  const isAdmin = user.role === 'admin';
  const [tab, setTab] = useState('proximos');
  const [edit, setEdit] = useState(null);
  const [lista, setLista] = useState(null);
  const [ask, confirmEl] = useConfirm();
  const hoje = todayISO();

  const visiveis = db.eventos.filter((e) => isAdmin || e.publico === 'todos' || (e.publico === 'professores' && user.role === 'professor'));
  const eventos = visiveis.filter((e) => (tab === 'proximos' ? e.data >= hoje : e.data < hoje)).sort((a, b) => (tab === 'proximos' ? a.data.localeCompare(b.data) : b.data.localeCompare(a.data)));

  const toggle = (e) =>
    setDB((d) => {
      const x = d.eventos.find((y) => y.id === e.id);
      x.confirmados = x.confirmados.includes(user.id) ? x.confirmados.filter((i) => i !== user.id) : [...x.confirmados, user.id];
    });

  const salvar = () => {
    if (!edit.titulo || !edit.data) return toast('Informe título e data.');
    setDB((d) => {
      if (edit.id) Object.assign(d.eventos.find((x) => x.id === edit.id), edit);
      else {
        d.eventos.push({ ...edit, id: uid('e') });
        notify(d, edit.publico === 'professores' ? 'professores' : 'todos', `Novo ${TIPOS[edit.tipo].slice(3)}: ${edit.titulo}`, `${fmtDate(edit.data)} ${edit.hora || ''} · ${edit.local}`);
      }
    });
    setEdit(null);
    toast('Evento salvo.');
  };

  const nomeDe = (id) => db.alunos.find((a) => a.id === id)?.nome || db.professores.find((p) => p.id === id)?.nome || (id === 'admin' ? 'Central Mao' : id);

  return (
    <>
      <PageHead title="Eventos & Reuniões" sub="Exames, campeonatos da Liga, estágios e reuniões online">
        {isAdmin && <button className="btn" onClick={() => setEdit({ ...vazio })}>+ Novo evento</button>}
      </PageHead>
      <Tabs tabs={[['proximos', 'Próximos'], ['passados', 'Galeria / anteriores']]} value={tab} onChange={setTab} />
      {eventos.length === 0 && <Empty icon="🗓️">Nenhum evento.</Empty>}
      <div className="grid g3">
        {eventos.map((e) => {
          const vou = e.confirmados.includes(user.id);
          return (
            <Card key={e.id} style={{ padding: 0, overflow: 'hidden' }}>
              {e.capa ? <img className="cover" src={e.capa} alt="" style={{ borderRadius: 0 }} /> : <div className="cover" style={{ borderRadius: 0 }}>猫拳</div>}
              <div style={{ padding: 16 }}>
                <div className="row between">
                  <span className="badge red">{fmtDate(e.data)} {e.hora}</span>
                  <span className="badge">{TIPOS[e.tipo]}</span>
                </div>
                <h3 style={{ marginTop: 10 }}>{e.titulo}</h3>
                <div className="small muted">
                  📍 <LinkMapa endereco={enderecoEvento(db, e)}>{e.local || '—'}</LinkMapa>
                  {e.endereco && e.endereco !== e.local && <div className="xs">{e.endereco}</div>}
                  {e.publico === 'professores' && ' · 🔒 Professores'}
                </div>
                {e.descricao && <p className="small" style={{ whiteSpace: 'pre-line' }}>{e.descricao}</p>}
                <div className="row">
                  {enderecoEvento(db, e) && tab === 'proximos' && (
                    <a className="btn sm ghost" href={mapsRota(enderecoEvento(db, e))} target="_blank" rel="noreferrer">🧭 Como chegar</a>
                  )}
                  {e.meet && <a className="btn sm dark" href={e.meet} target="_blank" rel="noreferrer">🎥 Google Meet</a>}
                  {!isAdmin && tab === 'proximos' && (
                    <button className={`btn sm ${vou ? 'ok' : 'ghost'}`} onClick={() => toggle(e)}>{vou ? '✔ Presença confirmada' : 'Confirmar presença'}</button>
                  )}
                  <button className="btn sm link" onClick={() => setLista(e)}>{e.confirmados.length} confirmados</button>
                </div>
                {isAdmin && (
                  <div className="row end mt">
                    <button className="btn sm ghost" onClick={() => ask(`Excluir “${e.titulo}”?`, () => setDB((d) => { d.eventos = d.eventos.filter((x) => x.id !== e.id); }), 'Excluir')}>Excluir</button>
                    <button className="btn sm dark" onClick={() => setEdit({ ...vazio, ...e })}>Editar</button>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Modal open={!!lista} onClose={() => setLista(null)} title={`Confirmados — ${lista?.titulo || ''}`}>
        {lista?.confirmados.length === 0 && <Empty icon="🙋">Ninguém confirmou ainda.</Empty>}
        {lista?.confirmados.map((id) => <div key={id} className="list-item">{nomeDe(id)}</div>)}
      </Modal>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Editar evento' : 'Novo evento'} footer={<button className="btn" onClick={salvar}>Salvar</button>}>
        {edit && (
          <div className="col">
            {edit.capa ? <img className="cover" src={edit.capa} alt="" /> : null}
            <div className="row">
              <label className="btn ghost sm">
                🖼 {edit.capa ? 'Trocar' : 'Enviar'} imagem de capa
                <input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setEdit({ ...edit, capa: await readImage(f, 1200, 0.8) }); }} />
              </label>
              {edit.capa && <button className="btn sm link" onClick={() => setEdit({ ...edit, capa: null })}>Remover</button>}
            </div>
            <div className="form-grid">
              <Field label="Título" style={{ gridColumn: '1/-1' }}><Inp obj={edit} set={setEdit} k="titulo" /></Field>
              <Field label="Tipo">
                <select value={edit.tipo} onChange={(e) => setEdit({ ...edit, tipo: e.target.value })}>
                  {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label="Público">
                <select value={edit.publico} onChange={(e) => setEdit({ ...edit, publico: e.target.value })}>
                  <option value="todos">Todos</option>
                  <option value="professores">Somente professores</option>
                </select>
              </Field>
              <Field label="Data"><Inp obj={edit} set={setEdit} k="data" type="date" /></Field>
              <Field label="Hora"><Inp obj={edit} set={setEdit} k="hora" type="time" /></Field>
              <Field label="Usar endereço de uma filial" hint="Preenche o local e o endereço automaticamente">
                <select
                  value=""
                  onChange={(ev) => {
                    const f = db.filiais.find((x) => x.id === ev.target.value);
                    if (f) setEdit({ ...edit, local: f.nome, endereco: enderecoFilial(f) });
                  }}
                >
                  <option value="">Escolher filial…</option>
                  {db.filiais.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </Field>
              <Field label="Local" hint="Nome do lugar (ex.: Ginásio Municipal) ou “Online”"><Inp obj={edit} set={setEdit} k="local" /></Field>
              <Field label="Endereço completo" style={{ gridColumn: '1/-1' }} hint="Rua, número, bairro e cidade — abre no Google Maps para os alunos">
                <Inp obj={edit} set={setEdit} k="endereco" placeholder="Ex.: R. Rio Grande do Sul, 172, Barueri - SP" />
              </Field>
              <Field label="Link Google Meet"><Inp obj={edit} set={setEdit} k="meet" type="url" placeholder="https://meet.google.com/…" /></Field>
              <Field label="Descrição" style={{ gridColumn: '1/-1' }}><Inp obj={edit} set={setEdit} k="descricao" type="textarea" /></Field>
            </div>
          </div>
        )}
      </Modal>
      {confirmEl}
    </>
  );
}
