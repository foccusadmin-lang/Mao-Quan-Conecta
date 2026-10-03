import { useState } from 'react';
import { useDB, setDB, notify, professorEmDia, aplicarDoServidor } from '../../lib/db';
import { uid, todayISO, readFileAsDataURL, youtubeEmbed, brl } from '../../lib/utils';
import { PageHead, Card, Modal, Field, Inp, Faixa, useConfirm, toast, Empty, FaixaOptions } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { PixBox } from '../../components/shared';

export const TIPOS_MAT = { taolu: ['🥋', 'Taolu'], base: ['🦵', 'Bases'], video: ['🎬', 'Vídeo'], teoria: ['📖', 'Teoria'], texto: ['✍️', 'Texto / Apostila'], pdf: ['📄', 'Documento'], certificado: ['🏅', 'Certificado'] };
/** Material só de texto (frases, trechos de apostila): não pede link nem arquivo */
const soTexto = (tipo) => tipo === 'texto';
const vazio = { titulo: '', tipo: 'video', faixaIdx: 0, url: '', arquivo: null, arquivoNome: '', descricao: '', publico: 'aluno', avancado: false, pago: false, valor: '', recebedor: '' };

/** Material pago: liberado só depois do pagamento confirmado (quem criou o material não paga) */
export const materialPago = (m) => !!m?.pago && +m.valor > 0;
export const pagamentoMaterial = (db, m, pessoaId) =>
  db.pagamentos.filter((p) => p.tipo === 'material' && p.materialId === m.id && p.pessoaId === pessoaId).sort((a) => (a.status === 'pago' ? -1 : 1))[0];
export const materialLiberado = (db, m, user) => !materialPago(m) || m.criadoPor === user?.nome || pagamentoMaterial(db, m, user?.id)?.status === 'pago';

/** Modal "Liberar material": gera (no servidor) a cobrança com o valor do material e mostra PIX + envio do comprovante */
export function LiberarMaterial({ m, user, onClose }) {
  const db = useDB();
  const pg = pagamentoMaterial(db, m, user.id);
  const [gerando, setGerando] = useState(false);
  const gerar = async () => {
    setGerando(true);
    try {
      const { data, error } = await supabase.rpc('mq_solicitar_material', { p_material: m.id });
      if (error) throw error;
      const { id, ...resto } = data;
      aplicarDoServidor('pagamentos', id, resto);
    } catch (e) {
      toast('Não foi possível gerar a cobrança: ' + e.message);
    } finally {
      setGerando(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={'🔒 ' + m.titulo}>
      <p className="small" style={{ marginTop: 0 }}>Este material é liberado após o pagamento da tarifa de <b>{brl(+m.valor)}</b>. Assim que o professor ou a Central confirmar o pagamento, ele abre automaticamente.</p>
      {pg?.status === 'pago' && <div className="alert ok">✅ Pagamento confirmado — material liberado.</div>}
      {!pg && <button className="btn block" disabled={gerando} onClick={gerar}>{gerando ? 'Gerando…' : '💳 Pagar tarifa do material · ' + brl(+m.valor)}</button>}
      {pg?.status === 'pendente' && <PixBox valor={+pg.valor} descricao={pg.descricao} txid={pg.id} filialId={pg.filialId || undefined} />}
    </Modal>
  );
}

export function MaterialView({ m }) {
  const yt = youtubeEmbed(m.url);
  return (
    <div className="col">
      {yt && <div className="video"><iframe src={yt} title={m.titulo} allowFullScreen allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" /></div>}
      {m.arquivo?.startsWith('data:video') && <div className="video"><video src={m.arquivo} controls controlsList="nodownload" /></div>}
      {m.arquivo?.startsWith('data:image') && <img src={m.arquivo} alt={m.titulo} style={{ borderRadius: 12 }} />}
      {m.descricao && <p style={{ whiteSpace: 'pre-line', margin: 0, ...(soTexto(m.tipo) ? { fontSize: 16, lineHeight: 1.7 } : {}) }}>{m.descricao}</p>}
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
    if (soTexto(edit.tipo) && !edit.descricao?.trim()) return toast('Escreva o texto do material.');
    if (edit.pago && !(+edit.valor > 0)) return toast('Informe o valor da tarifa do material.');
    setDB((d) => {
      // Material pago: guarda valor e quem recebe (Central ou professor da filial do aluno)
      const dados = edit.pago ? { ...edit, valor: +edit.valor, recebedor: edit.recebedor || (isAdmin ? 'central' : 'filial') } : { ...edit, pago: false, valor: '', recebedor: '' };
      if (edit.id) Object.assign(d.materiais.find((m) => m.id === edit.id), dados);
      else {
        d.materiais.push({ ...dados, id: uid('m'), criadoEm: todayISO(), criadoPor: user.nome });
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
                  {materialPago(m) && <span className="badge gold" title="Liberado após o pagamento">💰 {brl(+m.valor)}</span>}
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
              {!soTexto(edit.tipo) && <Field label="Link (YouTube, Drive, PDF…) — opcional" style={{ gridColumn: '1/-1' }}><Inp obj={edit} set={setEdit} k="url" type="url" placeholder="https://" /></Field>}
            </div>
            {soTexto(edit.tipo) && (
              <Field label="Texto do material" hint="Cole ou digite frases, trechos da apostila, fundamentos… Cada linha é mantida como você escrever.">
                <Inp obj={edit} set={setEdit} k="descricao" type="textarea" rows={12} placeholder={'Ex.:\n“O Kung Fu começa e termina com respeito.”\n\nWu De — virtudes da ação: humildade, respeito, retidão, confiança e lealdade.'} style={{ minHeight: 260 }} />
              </Field>
            )}
            {!soTexto(edit.tipo) && <Field label="Ou enviar arquivo — opcional" hint="Pode salvar só com título e descrição e incluir o link/arquivo depois. Até 3 MB nesta versão (vídeos longos: use link do YouTube não listado ou Google Drive).">
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
            </Field>}
            {!soTexto(edit.tipo) && <Field label="Descrição"><Inp obj={edit} set={setEdit} k="descricao" type="textarea" /></Field>}
            <label className="check"><Inp obj={edit} set={setEdit} k="avancado" type="checkbox" /> Treinamento avançado (exige tarifa de manutenção em dia)</label>
            <label className="check"><Inp obj={edit} set={setEdit} k="pago" type="checkbox" /> 💰 Material pago — só é liberado após o pagamento da tarifa</label>
            {edit.pago && (
              <div className="form-grid">
                <Field label="Tarifa do material (R$)"><input type="number" min="0" step="0.01" value={edit.valor} onChange={(e) => setEdit({ ...edit, valor: e.target.value })} placeholder="0,00" /></Field>
                <Field label="Quem recebe o pagamento">
                  <select value={edit.recebedor || (isAdmin ? 'central' : 'filial')} onChange={(e) => setEdit({ ...edit, recebedor: e.target.value })}>
                    <option value="central">Central (PIX da Associação)</option>
                    <option value="filial">Professor da filial do aluno</option>
                  </select>
                </Field>
              </div>
            )}
          </div>
        )}
      </Modal>
      {confirmEl}
    </>
  );
}
