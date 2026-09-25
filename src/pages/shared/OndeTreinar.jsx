import { useState } from 'react';
import { useDB } from '../../lib/db';
import { waLink, mapsRota } from '../../lib/utils';
import { PageHead, Card, Empty, Search } from '../../components/ui';
import { LinkMapa, enderecoFilial } from '../../components/shared';

/** Todas as academias filiadas, com endereço no mapa e contato — para treinar em outra unidade */
export default function OndeTreinar({ user }) {
  const db = useDB();
  const [q, setQ] = useState('');
  const minha = user?.filialId;
  const lista = db.filiais
    .filter((f) => f.ativa)
    .filter((f) => [f.nome, f.cidade, f.endereco, f.responsaveis].join(' ').toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (a.id === minha ? -1 : b.id === minha ? 1 : a.nome.localeCompare(b.nome)));

  return (
    <>
      <PageHead title="Onde Treinar" sub="Academias filiadas à Associação Mao Quan — toque no endereço para abrir no mapa">
        <Search value={q} onChange={setQ} placeholder="Cidade, bairro ou professor" />
      </PageHead>
      {lista.length === 0 && <Empty icon="📍">Nenhuma filial encontrada.</Empty>}
      <div className="grid g3">
        {lista.map((f) => {
          const endereco = enderecoFilial(f);
          const tel = (f.telefone || '').replace(/\D/g, '');
          return (
            <Card key={f.id} style={f.id === minha ? { borderColor: 'var(--red)', borderWidth: 2 } : {}}>
              {f.id === minha && <span className="badge red">Sua filial</span>}
              <h3 style={{ marginTop: f.id === minha ? 8 : 0 }}>{f.nome}</h3>
              <div className="small" style={{ marginBottom: 6 }}>
                📍 <LinkMapa endereco={endereco}>{endereco || 'Endereço não informado'}</LinkMapa>
              </div>
              {f.responsaveis && <div className="small muted">👥 {f.responsaveis}</div>}
              {f.telefone && <div className="small muted">📞 {f.telefone}</div>}
              <div className="row mt">
                {endereco && <a className="btn sm" href={mapsRota(endereco)} target="_blank" rel="noreferrer">🧭 Como chegar</a>}
                {tel && (
                  <a
                    className="btn sm ok"
                    href={waLink('55' + tel, `Olá! Sou ${user?.nome || 'aluno(a)'} da Associação Mao Quan e gostaria de informações para treinar na filial ${f.nome}.`)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    WhatsApp
                  </a>
                )}
              </div>
            </Card>
          );
        })}
      </div>
      <p className="xs muted mt">Para mudar oficialmente de filial, fale com o professor da nova unidade ou com a Central.</p>
    </>
  );
}
