import { useState } from 'react';
import { useDB, setDB } from '../../lib/db';
import { PageHead, Card, Field, toast } from '../../components/ui';
import { Institucional } from '../../components/shared';

export default function InstitucionalAdmin() {
  const db = useDB();
  const ins = db.institucional;
  const [f, setF] = useState(() => ({
    historia: ins.historia,
    biografia: ins.biografia,
    linhagem: ins.linhagem.map((n) => `${n.geracao} | ${n.nome}`).join('\n'),
    wude: ins.wude.map((g) => [g.grupo, ...g.itens].join('\n')).join('\n\n'),
  }));
  const salvar = () => {
    setDB((d) => {
      d.institucional = {
        historia: f.historia,
        biografia: f.biografia,
        linhagem: f.linhagem.split('\n').filter((l) => l.trim()).map((l) => {
          const [g, ...n] = l.split('|');
          return n.length ? { geracao: g.trim(), nome: n.join('|').trim() } : { geracao: '', nome: g.trim() };
        }),
        wude: f.wude.split(/\n\s*\n/).filter((b) => b.trim()).map((b) => {
          const [grupo, ...itens] = b.split('\n').map((s) => s.trim()).filter(Boolean);
          return { grupo, itens };
        }),
      };
    });
    toast('Conteúdo institucional salvo.');
  };
  return (
    <>
      <PageHead title="Institucional" sub="Linhagem (Linji), história do estilo, biografia do Mestre e Wu De">
        <button className="btn" onClick={salvar}>Salvar</button>
      </PageHead>
      <Card>
        <div className="form-grid">
          <Field label="História do estilo Mao Chuen"><textarea rows={8} value={f.historia} onChange={(e) => setF({ ...f, historia: e.target.value })} /></Field>
          <Field label="Biografia do Mestre"><textarea rows={8} value={f.biografia} onChange={(e) => setF({ ...f, biografia: e.target.value })} /></Field>
          <Field label="Árvore genealógica (Linji)" hint="Uma geração por linha:  Geração | Nome">
            <textarea rows={7} value={f.linhagem} onChange={(e) => setF({ ...f, linhagem: e.target.value })} />
          </Field>
          <Field label="Wu De — Código de ética" hint="Blocos separados por linha em branco. 1ª linha = título do grupo.">
            <textarea rows={7} value={f.wude} onChange={(e) => setF({ ...f, wude: e.target.value })} />
          </Field>
        </div>
      </Card>
      <h3 className="mt">Pré-visualização</h3>
      <Institucional />
    </>
  );
}
