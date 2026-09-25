import { useState } from 'react';
import { useDB, setDB, notify } from '../../lib/db';
import { fmtDateTime } from '../../lib/utils';
import { PageHead, Card, Field, toast, useConfirm } from '../../components/ui';

export default function Termos() {
  const db = useDB();
  const [f, setF] = useState(db.termos);
  const [ask, confirmEl] = useConfirm();
  const assinados = db.alunos.filter((a) => a.termos?.versao === db.termos.versao);

  const salvar = (novaVersao) => {
    setDB((d) => {
      d.termos = { ...f, versao: novaVersao ? d.termos.versao + 1 : d.termos.versao };
      if (novaVersao) notify(d, 'todos', 'Termos atualizados', 'Uma nova versão dos termos precisa ser assinada no próximo acesso.');
    });
    toast(novaVersao ? 'Nova versão publicada — todos assinarão novamente.' : 'Termos salvos.');
  };

  return (
    <>
      <PageHead title="Termos de Proteção e Fidelidade" sub={`Versão ${db.termos.versao} · exigidos no primeiro acesso do aluno`}>
        <button className="btn ghost" onClick={() => salvar(false)}>Salvar correções</button>
        <button className="btn" onClick={() => ask('Publicar nova versão? Todos os alunos precisarão assinar novamente.', () => salvar(true), 'Publicar')}>Publicar nova versão</button>
      </PageHead>
      <div className="grid g2">
        <Card>
          <div className="col">
            <Field label="Termo de uso de imagem"><textarea rows={5} value={f.imagem} onChange={(e) => setF({ ...f, imagem: e.target.value })} /></Field>
            <Field label="Regulamento interno"><textarea rows={5} value={f.regulamento} onChange={(e) => setF({ ...f, regulamento: e.target.value })} /></Field>
            <Field label="Compromisso de ética e lealdade marcial (Wu De)"><textarea rows={5} value={f.etica} onChange={(e) => setF({ ...f, etica: e.target.value })} /></Field>
            <Field label="Termo do atleta (equipe oficial)"><textarea rows={4} value={f.atleta} onChange={(e) => setF({ ...f, atleta: e.target.value })} /></Field>
          </div>
        </Card>
        <Card title={`✍️ Assinaturas da versão atual (${assinados.length})`}>
          {assinados.length === 0 && <p className="muted">Nenhuma assinatura ainda.</p>}
          {assinados.map((a) => (
            <div key={a.id} className="list-item">
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{a.nome}</div>
                <div className="xs muted">Assinado como “{a.termos.assinatura}” · {fmtDateTime(a.termos.data)}</div>
              </div>
            </div>
          ))}
        </Card>
      </div>
      {confirmEl}
    </>
  );
}
