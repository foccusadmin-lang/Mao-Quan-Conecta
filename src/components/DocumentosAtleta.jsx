import { useRef, useState } from 'react';
import { useDB } from '../lib/db';
import { fmtDate } from '../lib/utils';
import { TIPOS_DOC, ENTIDADES, enviarDocumento, removerDocumento, urlDocumento, progressoDocumentos } from '../lib/documentos';
import { Card, toast, useConfirm } from './ui';

/** Botão invisível de arquivo + ação de envio */
function Enviar({ rotulo, onArquivo, disabled, className = 'btn sm' }) {
  const ref = useRef(null);
  return (
    <>
      <input ref={ref} type="file" accept="image/*,application/pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onArquivo(f); }} />
      <button type="button" className={className} disabled={disabled} onClick={() => ref.current?.click()}>{rotulo}</button>
    </>
  );
}

async function abrir(doc, baixar) {
  try {
    const url = await urlDocumento(doc.caminho, baixar);
    window.open(url, '_blank', 'noopener');
  } catch (e) {
    toast('Não foi possível abrir: ' + e.message);
  }
}

/** Documentos do atleta para competições — usado pelo atleta, pelo professor e pela Central */
export function DocumentosAtleta({ aluno: alunoProp, user }) {
  const db = useDB();
  const aluno = db.alunos.find((a) => a.id === alunoProp.id) || alunoProp;
  const docs = aluno.documentos || [];
  const [enviando, setEnviando] = useState('');
  const [descricao, setDescricao] = useState({});
  const [ask, confirmEl] = useConfirm();
  const prog = progressoDocumentos(aluno);

  const enviar = async (chave, dados, arquivo) => {
    setEnviando(chave);
    try {
      await enviarDocumento(aluno, dados, arquivo, user?.nome || aluno.nome);
      toast('Documento enviado.');
      if (dados.entidade) setDescricao((d) => ({ ...d, [dados.entidade]: '' }));
    } catch (e) {
      toast('Não foi possível enviar: ' + e.message);
    } finally {
      setEnviando('');
    }
  };
  const remover = (doc) => ask(`Remover “${doc.descricao || TIPOS_DOC.find((t) => t.id === doc.tipo)?.nome || doc.nome}”?`, () => removerDocumento(aluno, doc).then(() => toast('Documento removido.')), 'Remover');

  const Linha = ({ doc, titulo, icone, chave, dados }) => (
    <div className="list-item" style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <span style={{ fontSize: 22 }}>{icone}</span>
      <div className="grow" style={{ minWidth: 180 }}>
        <div style={{ fontWeight: 600 }} className="small">{titulo}</div>
        {doc ? (
          <div className="xs muted">✅ Enviado em {fmtDate(doc.enviadoEm)}{doc.enviadoPor ? ` por ${doc.enviadoPor}` : ''} · {doc.mime === 'application/pdf' ? 'PDF' : 'imagem'}</div>
        ) : (
          <div className="xs" style={{ color: 'var(--red)' }}>Pendente</div>
        )}
      </div>
      <div className="row" style={{ gap: 6 }}>
        {doc && <button type="button" className="btn sm ghost" onClick={() => abrir(doc)}>👁 Ver</button>}
        {doc && <button type="button" className="btn sm ghost" onClick={() => abrir(doc, true)} title="Baixar">⬇</button>}
        {dados && <Enviar rotulo={enviando === chave ? 'Enviando…' : doc ? '🔄 Substituir' : '📎 Enviar'} disabled={!!enviando} className={`btn sm ${doc ? 'ghost' : ''}`} onArquivo={(f) => enviar(chave, dados, f)} />}
        {doc && <button type="button" className="btn sm ghost icon" aria-label="Remover" onClick={() => remover(doc)}>✕</button>}
      </div>
    </div>
  );

  return (
    <div className="col">
      <div className="alert ink small">
        <div>
          📁 Documentos usados nas inscrições de competições (<b>FPKF</b>, <b>CBKW</b>, Paulista, Brasileiro, Sul-Americano, Pan-Americano e Mundial). Envie foto ou PDF legível.
          Ficam guardados em área privada: só você, os professores da sua filial e a Central têm acesso.
          <div style={{ marginTop: 4 }}><b>{prog.feitos} de {prog.total}</b> documentos principais enviados{prog.extras ? ` · ${prog.extras} arquivo(s) FPKF/CBKW` : ''}.</div>
        </div>
      </div>

      <Card title="🪪 Documentos do atleta">
        {TIPOS_DOC.map((t) => (
          <Linha key={t.id} doc={docs.find((d) => d.tipo === t.id)} titulo={t.nome} icone={t.icone} chave={t.id} dados={{ tipo: t.id }} />
        ))}
      </Card>

      {ENTIDADES.map((e) => {
        const daEntidade = docs.filter((d) => d.entidade === e.id);
        return (
          <Card key={e.id} title={`🏛️ Documentos para ${e.nome}`}>
            <p className="xs muted" style={{ marginTop: 0 }}>Fichas de inscrição, termos e formulários próprios da {e.sigla}. Envie quantos arquivos precisar.</p>
            {daEntidade.length === 0 && <p className="small muted">Nenhum arquivo enviado para a {e.sigla}.</p>}
            {daEntidade.map((d) => (
              <Linha key={d.id} doc={d} titulo={d.descricao || d.nome} icone="📄" />
            ))}
            <div className="row mt" style={{ flexWrap: 'wrap', gap: 6 }}>
              <input value={descricao[e.id] || ''} onChange={(ev) => setDescricao({ ...descricao, [e.id]: ev.target.value })} placeholder={`Descrição (ex.: Ficha de inscrição ${e.sigla} 2026)`} style={{ flex: '1 1 240px' }} />
              <Enviar
                rotulo={enviando === e.id ? 'Enviando…' : `📎 Enviar para ${e.sigla}`}
                disabled={!!enviando}
                onArquivo={(f) => {
                  if (!(descricao[e.id] || '').trim()) return toast('Escreva uma descrição para o arquivo.');
                  enviar(e.id, { entidade: e.id, descricao: descricao[e.id] }, f);
                }}
              />
            </div>
          </Card>
        );
      })}
      {confirmEl}
    </div>
  );
}
