import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDB, filialNome, faixaNome } from '../../lib/db';
import { uid, copy, APP_URL, maskTelefone, youtubeEmbed } from '../../lib/utils';
import {
  RESULTADOS, gerarSlug, vitrineVazia, linkVitrine, carregarMinhaVitrine, salvarVitrine, slugDisponivel,
  enviarMidia, apagarMidia, comprimirImagem,
} from '../../lib/vitrine';
import { PageHead, Card, Field, Tabs, toast, Empty, useConfirm } from '../../components/ui';
import { QuadroMedalhas, ListaConquistas, Galeria, PixDoacao } from '../../components/Vitrine';

const TABS = [
  ['perfil', '👤 Perfil'],
  ['conquistas', '🥇 Campeonatos'],
  ['trofeus', '🏆 Troféus & Honras'],
  ['galeria', '📸 Fotos & Vídeos'],
  ['patrocinio', '🤝 Patrocínio'],
  ['publicar', '🌐 Publicar'],
];

export default function Carreira({ user }) {
  const db = useDB();
  const [ask, confirmEl] = useConfirm();
  const [tab, setTab] = useState('perfil');
  const [carregando, setCarregando] = useState(true);
  const [existe, setExiste] = useState(false);
  const [slug, setSlug] = useState('');
  const [publicado, setPublicado] = useState(false);
  const [v, setV] = useState(() => vitrineVazia(user));
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [alterado, setAlterado] = useState(false);

  const [nova, setNova] = useState({ campeonato: '', data: '', local: '', categoria: '', resultado: 'ouro' });
  const [trofeu, setTrofeu] = useState({ titulo: '', data: '', descricao: '' });
  const [honra, setHonra] = useState({ titulo: '', data: '', concedidoPor: '' });
  const [yt, setYt] = useState({ url: '', legenda: '' });
  const [legendaArquivo, setLegendaArquivo] = useState('');

  useEffect(() => {
    carregarMinhaVitrine(user.id)
      .then((r) => {
        if (r) {
          setExiste(true);
          setSlug(r.slug);
          setPublicado(r.publicado);
          setV({ ...vitrineVazia(user), ...r.data, patrocinio: { ...vitrineVazia(user).patrocinio, ...(r.data.patrocinio || {}) } });
        } else setSlug(gerarSlug(user.nome));
      })
      .catch((e) => toast('Não foi possível carregar sua vitrine: ' + e.message))
      .finally(() => setCarregando(false));
  }, [user.id]);

  const muda = (patch) => (setV((x) => ({ ...x, ...patch })), setAlterado(true));
  const mudaPat = (patch) => muda({ patrocinio: { ...v.patrocinio, ...patch } });
  const url = linkVitrine(slug || 'seu-nome', APP_URL);

  const salvar = async (publicar = publicado) => {
    const s = gerarSlug(slug);
    if (s.length < 3) return toast('Escolha um link com pelo menos 3 letras.');
    if (publicar && !v.patrocinio.pixChave && !v.patrocinio.linkIndicacao)
      toast('Dica: cadastre sua chave PIX ou link de indicação na aba Patrocínio para receber apoio.');
    setSalvando(true);
    try {
      if (!(await slugDisponivel(s, user.id))) throw new Error('Esse link já está em uso por outro atleta. Escolha outro.');
      const dados = {
        ...v,
        faixa: faixaNome(db, user.faixaIdx),
        filial: filialNome(db, user.filialId),
        equipe: user.atleta?.polo || '',
      };
      await salvarVitrine({ id: user.id, email: user.email, slug: s, data: dados, publicado: publicar, existe });
      setExiste(true);
      setSlug(s);
      setPublicado(publicar);
      setAlterado(false);
      toast(publicar ? 'Vitrine publicada! 🎉' : 'Carreira salva.');
    } catch (e) {
      toast(e.message);
    }
    setSalvando(false);
  };

  const enviarArquivo = async (arquivo) => {
    if (!arquivo) return;
    setEnviando(true);
    try {
      const f = arquivo.type.startsWith('image') ? await comprimirImagem(arquivo) : arquivo;
      const m = await enviarMidia(f);
      muda({ midias: [...v.midias, { id: uid('md'), ...m, legenda: legendaArquivo.trim() }] });
      setLegendaArquivo('');
      toast('Arquivo adicionado. Lembre de salvar.');
    } catch (e) {
      toast(e.message);
    }
    setEnviando(false);
  };

  const enviarFotoPerfil = async (arquivo, campo) => {
    if (!arquivo) return;
    setEnviando(true);
    try {
      const m = await enviarMidia(await comprimirImagem(arquivo, campo === 'capa' ? 1800 : 800));
      muda({ [campo]: m.url });
    } catch (e) {
      toast(e.message);
    }
    setEnviando(false);
  };

  if (!user.atleta?.ativo) return <Empty icon="🏆">Área exclusiva para atletas convocados.</Empty>;
  if (carregando) return <Empty icon="⏳">Carregando sua carreira…</Empty>;

  return (
    <>
      <PageHead title="Construir Carreira" sub="Monte seu portfólio de atleta e divulgue para conquistar patrocínios">
        <Link to="/aluno/atleta" className="btn ghost">← Voltar</Link>
        {existe && publicado && <a className="btn ghost" href={url} target="_blank" rel="noreferrer">👁 Ver vitrine</a>}
        <button className="btn" disabled={salvando} onClick={() => salvar()}>{salvando ? 'Salvando…' : alterado ? '💾 Salvar alterações' : '💾 Salvar'}</button>
      </PageHead>

      <QuadroMedalhas vitrine={v} />
      <div className="mt" />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'perfil' && (
        <div className="grid g2">
          <Card title="Apresentação">
            <div className="col">
              <div className="row">
                {v.foto ? <img src={v.foto} alt="" className="vitrine-foto" style={{ width: 90, height: 90 }} /> : <div className="vitrine-foto" style={{ width: 90, height: 90 }} />}
                <label className="btn ghost sm">
                  📷 {v.foto ? 'Trocar foto' : 'Enviar foto'}
                  <input type="file" accept="image/*" hidden onChange={(e) => (enviarFotoPerfil(e.target.files?.[0], 'foto'), (e.target.value = ''))} />
                </label>
                <label className="btn ghost sm">
                  🖼 {v.capa ? 'Trocar capa' : 'Foto de capa'}
                  <input type="file" accept="image/*" hidden onChange={(e) => (enviarFotoPerfil(e.target.files?.[0], 'capa'), (e.target.value = ''))} />
                </label>
              </div>
              <Field label="Nome de atleta"><input value={v.nome} onChange={(e) => muda({ nome: e.target.value })} /></Field>
              <Field label="Título" hint="Ex.: Atleta de Sanda · Campeão Paulista 2026"><input value={v.titulo} onChange={(e) => muda({ titulo: e.target.value })} /></Field>
              <Field label="Modalidades"><input value={v.modalidades} onChange={(e) => muda({ modalidades: e.target.value })} placeholder="Ex.: Taolu, Sanda, Tai Chi Chuan" /></Field>
              <Field label="Cidade"><input value={v.cidade} onChange={(e) => muda({ cidade: e.target.value })} placeholder="Ex.: Barueri - SP" /></Field>
              <Field label="Sobre mim" hint="Conte sua trajetória, objetivos e por que merece apoio">
                <textarea rows={6} value={v.bio} onChange={(e) => muda({ bio: e.target.value })} />
              </Field>
            </div>
          </Card>
          <Card title="Contato e redes">
            <div className="col">
              <Field label="Instagram"><input value={v.instagram} onChange={(e) => muda({ instagram: e.target.value.replace(/^@/, '') })} placeholder="seuperfil (sem @)" /></Field>
              <Field label="Canal do YouTube (link)"><input value={v.youtube} onChange={(e) => muda({ youtube: e.target.value })} placeholder="https://youtube.com/@…" /></Field>
              <Field label="WhatsApp para patrocinadores"><input type="tel" value={v.whatsapp} onChange={(e) => muda({ whatsapp: maskTelefone(e.target.value) })} placeholder="(11) 90000-0000" /></Field>
              <div className="alert ink small">
                <div>Na vitrine também aparecem automaticamente sua graduação (<b>{faixaNome(db, user.faixaIdx)}</b>), filial (<b>{filialNome(db, user.filialId)}</b>) e equipe (<b>{user.atleta?.polo || '—'}</b>).</div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {tab === 'conquistas' && (
        <div className="grid g2">
          <Card title="Registrar competição">
            <div className="col">
              <Field label="Campeonato"><input value={nova.campeonato} onChange={(e) => setNova({ ...nova, campeonato: e.target.value })} placeholder="Ex.: Campeonato Paulista de Kung Fu" /></Field>
              <div className="form-grid">
                <Field label="Data"><input type="date" value={nova.data} onChange={(e) => setNova({ ...nova, data: e.target.value })} /></Field>
                <Field label="Local"><input value={nova.local} onChange={(e) => setNova({ ...nova, local: e.target.value })} placeholder="Cidade/ginásio" /></Field>
                <Field label="Categoria / prova" style={{ gridColumn: '1/-1' }}><input value={nova.categoria} onChange={(e) => setNova({ ...nova, categoria: e.target.value })} placeholder="Ex.: Taolu Mão Livre — Adulto" /></Field>
              </div>
              <div className="row">
                {Object.entries(RESULTADOS).map(([k, r]) => (
                  <button key={k} type="button" className={`btn sm ${nova.resultado === k ? '' : 'ghost'}`} onClick={() => setNova({ ...nova, resultado: k })}>
                    {r.icone} {r.rotulo}
                  </button>
                ))}
              </div>
              <button
                className="btn dark"
                onClick={() => {
                  if (!nova.campeonato.trim()) return toast('Informe o nome do campeonato.');
                  muda({ conquistas: [...v.conquistas, { ...nova, id: uid('c'), campeonato: nova.campeonato.trim() }] });
                  setNova({ ...nova, categoria: '', resultado: 'ouro' });
                  toast('Competição adicionada.');
                }}
              >
                + Adicionar ao portfólio
              </button>
              <p className="xs muted" style={{ margin: 0 }}>Várias provas no mesmo campeonato (mesmo nome e data) contam como um único campeonato disputado.</p>
            </div>
          </Card>
          <Card title={`Histórico (${v.conquistas.length})`}>
            <ListaConquistas conquistas={v.conquistas} onRemover={(id) => ask('Remover esta competição?', () => muda({ conquistas: v.conquistas.filter((c) => c.id !== id) }), 'Remover')} />
          </Card>
        </div>
      )}

      {tab === 'trofeus' && (
        <div className="grid g2">
          <Card title="🏆 Troféus">
            <div className="col">
              <Field label="Troféu"><input value={trofeu.titulo} onChange={(e) => setTrofeu({ ...trofeu, titulo: e.target.value })} placeholder="Ex.: Melhor Atleta do Festival 2026" /></Field>
              <div className="form-grid">
                <Field label="Data"><input type="date" value={trofeu.data} onChange={(e) => setTrofeu({ ...trofeu, data: e.target.value })} /></Field>
                <Field label="Descrição"><input value={trofeu.descricao} onChange={(e) => setTrofeu({ ...trofeu, descricao: e.target.value })} /></Field>
              </div>
              <button className="btn dark" onClick={() => {
                if (!trofeu.titulo.trim()) return toast('Informe o troféu.');
                muda({ trofeus: [...v.trofeus, { ...trofeu, id: uid('t') }] });
                setTrofeu({ titulo: '', data: '', descricao: '' });
              }}>+ Adicionar troféu</button>
              {v.trofeus.map((t) => (
                <div key={t.id} className="list-item">
                  <span style={{ fontSize: 22 }}>🏆</span>
                  <div className="grow"><b>{t.titulo}</b><div className="xs muted">{[t.data && new Date(t.data + 'T12:00').toLocaleDateString('pt-BR'), t.descricao].filter(Boolean).join(' · ')}</div></div>
                  <button className="btn sm ghost icon" onClick={() => muda({ trofeus: v.trofeus.filter((x) => x.id !== t.id) })} aria-label="Remover">✕</button>
                </div>
              ))}
            </div>
          </Card>
          <Card title="🎖️ Honra ao mérito">
            <div className="col">
              <Field label="Honraria"><input value={honra.titulo} onChange={(e) => setHonra({ ...honra, titulo: e.target.value })} placeholder="Ex.: Moção de Aplausos — Câmara de Barueri" /></Field>
              <div className="form-grid">
                <Field label="Data"><input type="date" value={honra.data} onChange={(e) => setHonra({ ...honra, data: e.target.value })} /></Field>
                <Field label="Concedida por"><input value={honra.concedidoPor} onChange={(e) => setHonra({ ...honra, concedidoPor: e.target.value })} /></Field>
              </div>
              <button className="btn dark" onClick={() => {
                if (!honra.titulo.trim()) return toast('Informe a honraria.');
                muda({ honras: [...v.honras, { ...honra, id: uid('h') }] });
                setHonra({ titulo: '', data: '', concedidoPor: '' });
              }}>+ Adicionar honra ao mérito</button>
              {v.honras.map((h) => (
                <div key={h.id} className="list-item">
                  <span style={{ fontSize: 22 }}>🎖️</span>
                  <div className="grow"><b>{h.titulo}</b><div className="xs muted">{[h.data && new Date(h.data + 'T12:00').toLocaleDateString('pt-BR'), h.concedidoPor].filter(Boolean).join(' · ')}</div></div>
                  <button className="btn sm ghost icon" onClick={() => muda({ honras: v.honras.filter((x) => x.id !== h.id) })} aria-label="Remover">✕</button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === 'galeria' && (
        <div className="col">
          <div className="grid g2">
            <Card title="📸 Enviar foto ou vídeo">
              <div className="col">
                <Field label="Legenda (opcional)"><input value={legendaArquivo} onChange={(e) => setLegendaArquivo(e.target.value)} placeholder="Ex.: Final do Paulista 2026" /></Field>
                <label className={`btn ${enviando ? 'ghost' : ''}`}>
                  {enviando ? 'Enviando…' : '⬆ Escolher foto ou vídeo'}
                  <input type="file" accept="image/*,video/mp4,video/webm,video/quicktime" hidden disabled={enviando} onChange={(e) => (enviarArquivo(e.target.files?.[0]), (e.target.value = ''))} />
                </label>
                <p className="xs muted" style={{ margin: 0 }}>Fotos até 10 MB (reduzidas automaticamente) · vídeos até 50 MB. Para vídeos longos, use um link do YouTube.</p>
              </div>
            </Card>
            <Card title="▶ Adicionar vídeo do YouTube">
              <div className="col">
                <Field label="Link do vídeo"><input value={yt.url} onChange={(e) => setYt({ ...yt, url: e.target.value })} placeholder="https://youtu.be/…" /></Field>
                <Field label="Legenda"><input value={yt.legenda} onChange={(e) => setYt({ ...yt, legenda: e.target.value })} /></Field>
                <button className="btn dark" onClick={() => {
                  if (!youtubeEmbed(yt.url)) return toast('Link do YouTube inválido.');
                  muda({ midias: [...v.midias, { id: uid('md'), tipo: 'youtube', url: yt.url.trim(), legenda: yt.legenda.trim() }] });
                  setYt({ url: '', legenda: '' });
                }}>+ Adicionar vídeo</button>
              </div>
            </Card>
          </div>
          <Card title={`Galeria (${v.midias.length})`}>
            <Galeria
              midias={v.midias}
              onRemover={(m) => ask('Remover este item da galeria?', async () => {
                muda({ midias: v.midias.filter((x) => x.id !== m.id) });
                await apagarMidia(m.caminho).catch(() => {});
              }, 'Remover')}
            />
          </Card>
        </div>
      )}

      {tab === 'patrocinio' && (
        <div className="grid g2">
          <Card title="💸 Doação por PIX">
            <div className="col">
              <Field label="Sua chave PIX" hint="CPF, e-mail, telefone ou chave aleatória — o valor cai direto na sua conta">
                <input value={v.patrocinio.pixChave} onChange={(e) => mudaPat({ pixChave: e.target.value.trim() })} placeholder="Ex.: seuemail@gmail.com" />
              </Field>
              <div className="form-grid">
                <Field label="Nome do recebedor"><input value={v.patrocinio.pixNome} onChange={(e) => mudaPat({ pixNome: e.target.value })} /></Field>
                <Field label="Cidade do recebedor"><input value={v.patrocinio.pixCidade} onChange={(e) => mudaPat({ pixCidade: e.target.value })} placeholder="Ex.: Barueri" /></Field>
              </div>
              <Field label="Mensagem para patrocinadores">
                <textarea rows={3} value={v.patrocinio.mensagem} onChange={(e) => mudaPat({ mensagem: e.target.value })} placeholder="Ex.: Seu apoio me ajuda a custear viagens e inscrições em campeonatos." />
              </Field>
              {v.patrocinio.pixChave && (
                <div className="card" style={{ background: '#faf8f6' }}>
                  <div className="xs muted mb">Pré-visualização (como o visitante vê):</div>
                  <PixDoacao chave={v.patrocinio.pixChave} nome={v.patrocinio.pixNome} cidade={v.patrocinio.pixCidade} atleta={v.nome} />
                </div>
              )}
            </div>
          </Card>
          <Card title="📈 Bônus de indicação (Foccus Invest)">
            <div className="col">
              <Field label="Seu link de indicação" hint="Opcional. Quem investir pelo seu link gera bônus de indicação para você.">
                <input type="url" value={v.patrocinio.linkIndicacao} onChange={(e) => mudaPat({ linkIndicacao: e.target.value.trim() })} placeholder="https://www.foccusinvest.com.br/registrar?ref=…" />
              </Field>
              {v.patrocinio.linkIndicacao && !/^https:\/\//.test(v.patrocinio.linkIndicacao) && <div className="alert red small">O link precisa começar com https://</div>}
              <p className="xs muted" style={{ margin: 0 }}>
                Na vitrine aparece o botão “Apoiar investindo”. Informação institucional: não constitui recomendação de investimento.
              </p>
            </div>
          </Card>
        </div>
      )}

      {tab === 'publicar' && (
        <div className="grid g2">
          <Card title="🔗 Seu link personalizado">
            <div className="col">
              <Field label="Endereço da vitrine" hint="Só letras minúsculas, números e hífen">
                <div className="row" style={{ flexWrap: 'nowrap', gap: 6 }}>
                  <span className="xs muted nowrap">…/atleta/</span>
                  <input value={slug} onChange={(e) => (setSlug(gerarSlug(e.target.value)), setAlterado(true))} />
                </div>
              </Field>
              <div className="alert ink small" style={{ wordBreak: 'break-all' }}><div>{url}</div></div>
              <div className="row">
                <button className="btn ghost sm" onClick={() => copy(url).then(() => toast('Link copiado!'))}>📋 Copiar link</button>
                {navigator.share && existe && publicado && (
                  <button className="btn ghost sm" onClick={() => navigator.share({ title: `${v.nome} — Atleta Mao Quan`, text: 'Conheça minha carreira no Kung Fu e apoie!', url }).catch(() => {})}>📤 Compartilhar</button>
                )}
              </div>
            </div>
          </Card>
          <Card title="🌐 Publicação">
            <div className="col">
              <div className={`alert ${publicado ? 'ok' : 'gold'}`}>
                <div>{publicado ? '✅ Sua vitrine está pública. Qualquer pessoa com o link pode ver e patrocinar.' : '🔒 Sua vitrine ainda não está pública.'}</div>
              </div>
              {publicado ? (
                <>
                  <a className="btn" href={url} target="_blank" rel="noreferrer">👁 Abrir minha vitrine</a>
                  <button className="btn ghost" disabled={salvando} onClick={() => ask('Tirar a vitrine do ar? O link deixará de funcionar até você publicar de novo.', () => salvar(false), 'Despublicar')}>Despublicar</button>
                </>
              ) : (
                <button className="btn" disabled={salvando} onClick={() => salvar(true)}>🚀 Publicar vitrine</button>
              )}
              <p className="xs muted" style={{ margin: 0 }}>Ficam públicos: nome, foto, graduação, filial, conquistas, galeria, redes e dados de patrocínio. RG, CPF, telefone de cadastro e dados de saúde nunca aparecem.</p>
            </div>
          </Card>
        </div>
      )}
      {confirmEl}
    </>
  );
}
