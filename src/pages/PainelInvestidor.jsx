import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { carregarPainelInvestidor } from '../lib/investidor';
import { estatisticas } from '../lib/vitrine';
import { Empty } from '../components/ui';
import VitrineAtleta from './VitrineAtleta';

const norm = (s = '') => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Painel do Patrocinador — vitrine de todos os atletas, aberta só pelo link exclusivo #/painel-patrocinador/<código> */
export default function PainelInvestidor() {
  const { token } = useParams();
  const [estado, setEstado] = useState({ carregando: true });
  const [q, setQ] = useState('');
  const [filial, setFilial] = useState('');
  const [modalidade, setModalidade] = useState('');
  const [so, setSo] = useState(''); // '' | medalhistas | patrocinio
  const [aberto, setAberto] = useState(null);

  useEffect(() => {
    carregarPainelInvestidor(token)
      .then((r) => setEstado({ carregando: false, painel: r }))
      .catch((e) => setEstado({ carregando: false, erro: e.message }));
  }, [token]);

  useEffect(() => {
    document.title = 'Painel do Patrocinador — Mao Quan Kung Fu Wushu';
    return () => (document.title = 'Mao Quan Conecta');
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [aberto]);

  const atletas = estado.painel?.atletas || [];
  const filiais = useMemo(() => [...new Set(atletas.map((a) => a.data.filial).filter(Boolean))].sort(), [atletas]);
  const modalidades = useMemo(() => {
    const s = new Set();
    atletas.forEach((a) => (a.data.modalidades || '').split(/[,;/+]| e /).map((m) => m.trim()).filter(Boolean).forEach((m) => s.add(m)));
    return [...s].sort();
  }, [atletas]);
  const lista = atletas.filter((a) => {
    const v = a.data;
    const st = estatisticas(v);
    if (q && !norm(`${v.nome} ${v.titulo || ''} ${v.cidade || ''} ${v.equipe || ''}`).includes(norm(q))) return false;
    if (filial && v.filial !== filial) return false;
    if (modalidade && !norm(v.modalidades || '').includes(norm(modalidade))) return false;
    if (so === 'medalhistas' && !(st.ouro + st.prata + st.bronze)) return false;
    if (so === 'patrocinio' && !(v.patrocinio?.pixChave || /^https:\/\//.test(v.patrocinio?.linkIndicacao || ''))) return false;
    return true;
  });

  if (estado.carregando) return <div className="vitrine-sec"><Empty icon="⏳">Carregando…</Empty></div>;
  if (!estado.painel)
    return (
      <div className="vitrine-sec center">
        <img src="./logo.webp" alt="" style={{ width: 110 }} />
        <h2>Link inválido ou desativado</h2>
        <p className="muted">Este acesso ao Painel do Patrocinador não está mais disponível. Peça um novo link ao professor ou à Associação.</p>
      </div>
    );

  if (aberto) {
    const v = atletas.find((a) => a.slug === aberto);
    if (v) return <VitrineAtleta vitrine={v} voltar={() => setAberto(null)} />;
  }

  const c = estado.painel.convite || {};
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100%' }}>
      <section className="vitrine-hero">
        <div className="inner">
          <div className="row" style={{ gap: 14, alignItems: 'center' }}>
            <img src="./logo.webp" alt="" style={{ width: 64, borderRadius: '50%', background: '#fff' }} />
            <div>
              <div className="xs" style={{ letterSpacing: 2, textTransform: 'uppercase', color: 'var(--gold)', fontWeight: 700 }}>Associação Mao Quan Kung Fu Wushu</div>
              <h1 className="vitrine-nome" style={{ fontSize: 30 }}>Painel do Patrocinador</h1>
              <div style={{ opacity: 0.85 }}>{c.nome ? `Acesso exclusivo para ${c.nome}` : 'Acesso exclusivo'}{c.criadoPor ? ` · enviado por ${c.criadoPor}` : ''}</div>
            </div>
          </div>
          <p style={{ opacity: 0.85, maxWidth: 720 }}>Conheça nossos atletas: conquistas, campeonatos, fotos e vídeos. Em cada perfil você pode apoiar diretamente o atleta como patrocinador.</p>
        </div>
      </section>

      <section className="vitrine-sec">
        <div className="row mb" style={{ flexWrap: 'wrap', gap: 8 }}>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar atleta pelo nome" style={{ flex: '1 1 220px' }} />
          <select value={filial} onChange={(e) => setFilial(e.target.value)} style={{ maxWidth: 220 }}>
            <option value="">Todas as filiais</option>
            {filiais.map((f) => <option key={f}>{f}</option>)}
          </select>
          {modalidades.length > 0 && (
            <select value={modalidade} onChange={(e) => setModalidade(e.target.value)} style={{ maxWidth: 200 }}>
              <option value="">Todas as modalidades</option>
              {modalidades.map((m) => <option key={m}>{m}</option>)}
            </select>
          )}
          <select value={so} onChange={(e) => setSo(e.target.value)} style={{ maxWidth: 220 }}>
            <option value="">Todos os atletas</option>
            <option value="medalhistas">Só medalhistas</option>
            <option value="patrocinio">Aceitam patrocínio</option>
          </select>
        </div>
        <div className="small muted mb">{lista.length} atleta(s)</div>

        {lista.length === 0 ? (
          <Empty icon="🏆">Nenhum atleta encontrado com esses filtros.</Empty>
        ) : (
          <div className="grid g3">
            {lista.map((a) => {
              const v = a.data;
              const st = estatisticas(v);
              return (
                <button key={a.slug} type="button" className="card" onClick={() => setAberto(a.slug)} style={{ textAlign: 'left', cursor: 'pointer', padding: 0, overflow: 'hidden', border: '1px solid var(--line)' }}>
                  <div style={{ height: 92, background: v.capa ? `center/cover url(${v.capa})` : 'linear-gradient(135deg, #141414, #9e0c13)' }} />
                  <div style={{ padding: '0 14px 14px', marginTop: -36 }}>
                    {v.foto ? (
                      <img src={v.foto} alt="" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '3px solid #fff', background: '#fff' }} />
                    ) : (
                      <div style={{ width: 72, height: 72, borderRadius: '50%', border: '3px solid #fff', background: '#ddd' }} />
                    )}
                    <div style={{ fontWeight: 800, fontSize: 17, marginTop: 6 }}>{v.nome}</div>
                    <div className="xs muted">{[v.faixa, v.filial, v.cidade].filter(Boolean).join(' · ')}</div>
                    {v.modalidades && <div className="xs" style={{ marginTop: 4 }}>🥋 {v.modalidades}</div>}
                    <div className="row small" style={{ gap: 10, marginTop: 8 }}>
                      <span title="Ouro">🥇 {st.ouro}</span>
                      <span title="Prata">🥈 {st.prata}</span>
                      <span title="Bronze">🥉 {st.bronze}</span>
                      <span title="Campeonatos">🏟️ {st.campeonatos}</span>
                    </div>
                    <div className="btn sm gold mt" style={{ display: 'inline-flex' }}>Ver perfil completo →</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <footer className="vitrine-sec center small muted" style={{ paddingBottom: 60 }}>
        <img src="./logo.webp" alt="" style={{ width: 56 }} />
        <div>Associação Mao Quan Kung Fu Wushu</div>
      </footer>
    </div>
  );
}
