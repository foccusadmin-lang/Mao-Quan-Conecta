import { useState } from 'react';
import { PageHead, Card, Modal, Tabs, Empty } from '../../components/ui';
import { TUTORIAIS } from '../../lib/tutoriais';
import { youtubeEmbed } from '../../lib/utils';

const PUBLICOS = { aluno: '🥋 Para alunos', professor: '👨‍🏫 Para professores', admin: '🏯 Para a Central' };
// Quem vê o quê: aluno vê os de aluno; professor vê os de professor e os de aluno (para ajudar a turma); Central vê todos
const VISIVEIS = { aluno: ['aluno'], professor: ['professor', 'aluno'], admin: ['admin', 'professor', 'aluno'] };
const minutos = (s) => (s >= 60 ? `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, '0')} s` : `${Math.round(s)} s`);

/** 📘 Tutoriais: vídeos curtos com narração e o passo a passo em texto */
export default function Tutoriais({ user }) {
  const grupos = (VISIVEIS[user.role] || ['aluno']).filter((p) => TUTORIAIS.some((t) => t.publico === p));
  const [aba, setAba] = useState(grupos[0] || 'aluno');
  const [aberto, setAberto] = useState(null);
  const lista = TUTORIAIS.filter((t) => t.publico === aba);
  const t = TUTORIAIS.find((x) => x.id === aberto);

  return (
    <>
      <PageHead title="Tutoriais" sub="Vídeos curtos, com narração, mostrando passo a passo como usar o app" />
      {grupos.length > 1 && <Tabs tabs={grupos.map((g) => [g, PUBLICOS[g]])} value={aba} onChange={setAba} />}
      {lista.length === 0 && <Empty icon="📘">Os tutoriais deste perfil estão sendo preparados.</Empty>}
      <div className="grid g3">
        {lista.map((x, i) => (
          <button key={x.id} type="button" className="card" onClick={() => setAberto(x.id)} style={{ textAlign: 'left', cursor: 'pointer', padding: 0, overflow: 'hidden', font: 'inherit' }}>
            <div style={{ position: 'relative', background: '#141414', height: 150, overflow: 'hidden' }}>
              <img src={`./tutoriais/${x.id}.jpg`} alt="" loading="lazy" style={{ width: '100%', objectFit: 'cover', objectPosition: 'top', opacity: 0.85 }} />
              <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ width: 56, height: 56, borderRadius: 56, background: 'rgba(225,6,0,.92)', color: '#fff', fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(0,0,0,.4)' }}>▶</span>
              </span>
              <span className="badge" style={{ position: 'absolute', right: 8, bottom: 8, background: 'rgba(0,0,0,.75)', color: '#fff' }}>{minutos(x.duracao)}</span>
            </div>
            <div style={{ padding: 12 }}>
              <div className="xs muted">Tutorial {i + 1}</div>
              <div style={{ fontWeight: 700 }}>{x.titulo}</div>
              <div className="xs muted" style={{ marginTop: 2 }}>{x.resumo}</div>
            </div>
          </button>
        ))}
      </div>

      <Modal open={!!t} onClose={() => setAberto(null)} title={t?.titulo} wide>
        {t && (
          <div className="col">
            {youtubeEmbed(t.youtube) ? (
              // Com link do YouTube (não listado): a qualidade se ajusta à internet de quem assiste
              <div style={{ width: '100%', maxWidth: 420, margin: '0 auto', aspectRatio: '9 / 16', maxHeight: '72dvh', background: '#000', borderRadius: 12, overflow: 'hidden' }}>
                <iframe
                  src={`${youtubeEmbed(t.youtube)}?autoplay=1&rel=0&playsinline=1`}
                  title={t.titulo}
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  // O YouTube recusa tocar (erro 153) quando não recebe a origem do site
                  referrerPolicy="strict-origin-when-cross-origin"
                  style={{ width: '100%', height: '100%', border: 0 }}
                />
              </div>
            ) : (
              <video
                key={t.id}
                src={`./tutoriais/${t.id}.mp4`}
                poster={`./tutoriais/${t.id}.jpg`}
                controls
                playsInline
                autoPlay
                preload="metadata"
                style={{ width: '100%', maxHeight: '70dvh', background: '#000', borderRadius: 12 }}
              />
            )}
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              {t.youtube && <a className="btn sm ghost" href={t.youtube} target="_blank" rel="noreferrer">▶ Abrir no YouTube</a>}
              <a className="btn sm ghost" href={t.youtube || `./tutoriais/${t.id}.mp4`} {...(t.youtube ? { target: '_blank', rel: 'noreferrer' } : { download: `tutorial-${t.id}.mp4` })}>
                {t.youtube ? '📤 Link para enviar no WhatsApp' : '⬇ Baixar vídeo (para enviar no WhatsApp)'}
              </a>
            </div>
            <Card title="📝 Passo a passo">
              <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.55 }}>
                {t.passos.map((p, i) => <li key={i} style={{ marginBottom: 6 }}>{p}</li>)}
              </ol>
            </Card>
          </div>
        )}
      </Modal>
    </>
  );
}
