import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { buscarVitrinePublica, estatisticas } from '../lib/vitrine';
import { waLink, copy, fmtDate } from '../lib/utils';
import { toast, Empty } from '../components/ui';
import { QuadroMedalhas, ListaConquistas, Galeria, PixDoacao } from '../components/Vitrine';

/** Vitrine pública do atleta — aberta sem login pelo link personalizado #/atleta/<nome> */
export default function VitrineAtleta() {
  const { slug } = useParams();
  const [estado, setEstado] = useState({ carregando: true });

  useEffect(() => {
    buscarVitrinePublica(slug)
      .then((r) => setEstado({ carregando: false, vitrine: r }))
      .catch((e) => setEstado({ carregando: false, erro: e.message }));
  }, [slug]);

  useEffect(() => {
    if (estado.vitrine) document.title = `${estado.vitrine.data.nome} — Atleta Mao Quan Kung Fu Wushu`;
    return () => (document.title = 'Mao Quan Conecta');
  }, [estado.vitrine]);

  if (estado.carregando) return <div className="vitrine-sec"><Empty icon="⏳">Carregando…</Empty></div>;
  if (!estado.vitrine)
    return (
      <div className="vitrine-sec center">
        <img src="./logo.webp" alt="" style={{ width: 110 }} />
        <h2>Vitrine não encontrada</h2>
        <p className="muted">Este link não existe ou o atleta ainda não publicou a vitrine. Confira o endereço com o atleta que o compartilhou.</p>
      </div>
    );

  const v = estado.vitrine.data;
  const p = v.patrocinio || {};
  const s = estatisticas(v);
  const url = window.location.href;
  const temPatrocinio = p.pixChave || /^https:\/\//.test(p.linkIndicacao || '');

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100%' }}>
      <section className="vitrine-hero" style={v.capa ? { backgroundImage: `linear-gradient(rgba(20,20,20,.72), rgba(20,20,20,.9)), url(${v.capa})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
        <div className="inner">
          <div className="row" style={{ gap: 18, alignItems: 'center' }}>
            {v.foto ? <img src={v.foto} alt={v.nome} className="vitrine-foto" /> : <div className="vitrine-foto" />}
            <div className="grow" style={{ minWidth: 220 }}>
              <div className="xs" style={{ letterSpacing: 2, textTransform: 'uppercase', color: 'var(--gold)', fontWeight: 700 }}>Atleta · Associação Mao Quan Kung Fu Wushu</div>
              <h1 className="vitrine-nome">{v.nome}</h1>
              {v.titulo && <div style={{ opacity: 0.9, marginTop: 4 }}>{v.titulo}</div>}
              <div className="row small" style={{ marginTop: 10, gap: 6 }}>
                {v.faixa && <span className="badge" style={{ background: '#fff' }}>🥋 {v.faixa}</span>}
                {v.equipe && <span className="badge gold">🏆 {v.equipe}</span>}
                {v.filial && <span className="badge ink" style={{ border: '1px solid rgba(255,255,255,.25)' }}>🏯 {v.filial}</span>}
                {v.cidade && <span className="badge ink" style={{ border: '1px solid rgba(255,255,255,.25)' }}>📍 {v.cidade}</span>}
              </div>
            </div>
          </div>
          <div className="mt"><QuadroMedalhas vitrine={v} escuro /></div>
          <div className="row mt">
            {temPatrocinio && <a className="btn gold" href="#patrocinar" onClick={(e) => (e.preventDefault(), document.getElementById('patrocinar')?.scrollIntoView({ behavior: 'smooth' }))}>🤝 Patrocinar este atleta</a>}
            {v.instagram && (
              <a
                className="btn dark icon"
                href={/^https?:\/\//.test(v.instagram) ? v.instagram : `https://instagram.com/${v.instagram.replace(/^@/, '')}`}
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                title="Instagram"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="2" y="2" width="20" height="20" rx="5" />
                  <circle cx="12" cy="12" r="4.2" />
                  <circle cx="17.6" cy="6.4" r="1" fill="currentColor" stroke="none" />
                </svg>
              </a>
            )}
            {v.youtube && <a className="btn dark" href={v.youtube} target="_blank" rel="noreferrer">▶ YouTube</a>}
            <button className="btn dark" onClick={() => (navigator.share ? navigator.share({ title: v.nome, url }).catch(() => {}) : copy(url).then(() => toast('Link copiado!')))}>📤 Compartilhar</button>
          </div>
        </div>
      </section>

      {(v.bio || v.modalidades) && (
        <section className="vitrine-sec">
          <h2>Sobre</h2>
          {v.modalidades && <p style={{ margin: '0 0 8px' }}><b>Modalidades:</b> {v.modalidades}</p>}
          {v.bio && <p style={{ whiteSpace: 'pre-line', margin: 0 }}>{v.bio}</p>}
        </section>
      )}

      <section className="vitrine-sec">
        <h2>Competições <span className="small muted" style={{ fontFamily: 'Inter' }}>· {s.campeonatos} campeonato(s)</span></h2>
        <div className="card"><ListaConquistas conquistas={v.conquistas} /></div>
      </section>

      {(v.trofeus?.length > 0 || v.honras?.length > 0) && (
        <section className="vitrine-sec">
          <h2>Troféus e honrarias</h2>
          <div className="grid g2">
            {v.trofeus.map((t) => (
              <div key={t.id} className="card row" style={{ flexWrap: 'nowrap' }}>
                <span style={{ fontSize: 30 }}>🏆</span>
                <div><b>{t.titulo}</b><div className="xs muted">{[t.data && fmtDate(t.data), t.descricao].filter(Boolean).join(' · ')}</div></div>
              </div>
            ))}
            {v.honras.map((h) => (
              <div key={h.id} className="card row" style={{ flexWrap: 'nowrap' }}>
                <span style={{ fontSize: 30 }}>🎖️</span>
                <div><b>{h.titulo}</b><div className="xs muted">{[h.data && fmtDate(h.data), h.concedidoPor].filter(Boolean).join(' · ')}</div></div>
              </div>
            ))}
          </div>
        </section>
      )}

      {v.midias?.length > 0 && (
        <section className="vitrine-sec">
          <h2>Fotos e vídeos</h2>
          <Galeria midias={v.midias} />
        </section>
      )}

      {temPatrocinio && (
        <section className="vitrine-sec" id="patrocinar">
          <h2>Patrocine {v.nome.split(' ')[0]}</h2>
          {p.mensagem && <p style={{ whiteSpace: 'pre-line' }}>{p.mensagem}</p>}
          <div className="grid g2">
            {p.pixChave && (
              <div className="card pad-lg">
                <h3>💸 Doação via PIX</h3>
                <p className="small muted" style={{ marginTop: 0 }}>Escolha o valor e pague pelo app do seu banco. O valor vai direto para o atleta.</p>
                <PixDoacao chave={p.pixChave} nome={p.pixNome} cidade={p.pixCidade} atleta={v.nome} />
              </div>
            )}
            {/^https:\/\//.test(p.linkIndicacao || '') && (
              <div className="card pad-lg">
                <h3>📈 Apoie investindo</h3>
                <p className="small">
                  Abra sua conta pelo link de indicação de <b>{v.nome}</b>. O bônus de indicação vai para o atleta, sem custo extra para você.
                </p>
                <a className="btn block" href={p.linkIndicacao} target="_blank" rel="noreferrer">Quero apoiar investindo →</a>
                <p className="xs muted" style={{ marginBottom: 0 }}>Informação institucional; não constitui recomendação de investimento. Todo investimento envolve riscos.</p>
              </div>
            )}
          </div>
          {v.whatsapp && (
            <a className="btn ok mt" href={waLink('55' + v.whatsapp.replace(/\D/g, ''), `Olá, ${v.nome}! Vi sua vitrine de atleta e tenho interesse em patrocinar.`)} target="_blank" rel="noreferrer">
              💬 Falar com o atleta sobre patrocínio
            </a>
          )}
        </section>
      )}

      <footer className="vitrine-sec center small muted" style={{ paddingBottom: 90 }}>
        <img src="./logo.webp" alt="" style={{ width: 60 }} />
        <div>Atleta filiado à <b>Associação Mao Quan Kung Fu Wushu</b></div>
      </footer>
    </div>
  );
}
