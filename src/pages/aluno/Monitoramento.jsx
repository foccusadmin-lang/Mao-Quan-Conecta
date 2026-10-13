import { useEffect, useState } from 'react';
import { todayISO, fmtDate } from '../../lib/utils';
import { PageHead, Card, Field, toast, Empty } from '../../components/ui';
import { ESCALAS, TEXTOS, TREINOS, faixaDaNota, nomeTreino, enviarMonitoramento, listarMonitoramentos } from '../../lib/monitoramento';

/** Nota 1–10 em botões coloridos por faixa (verde / azul / amarelo / laranja / vermelho) + descrição da faixa escolhida */
export function EscalaNota({ esc, value, onChange }) {
  const sel = value ? faixaDaNota(esc, value) : null;
  return (
    <div className="col" style={{ gap: 8 }}>
      <div className="col" style={{ gap: 6 }}>
        {esc.faixas.map(([a, b, cor, titulo, desc]) => {
          const ativa = sel && sel[0] === a;
          return (
            <div key={a} className="row" style={{ gap: 8, flexWrap: 'nowrap', alignItems: 'stretch', borderRadius: 12, padding: 6, background: ativa ? cor + '1f' : 'transparent', border: `1.5px solid ${ativa ? cor : 'var(--line, #e5e1dc)'}` }}>
              <div className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                {Array.from({ length: b - a + 1 }, (_, i) => b - i).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => onChange(n)}
                    aria-pressed={value === n}
                    title={`${n} — ${titulo}`}
                    style={{ width: 40, height: 40, borderRadius: 10, border: `2px solid ${cor}`, background: value === n ? cor : '#fff', color: value === n ? '#fff' : '#1b1b1b', fontWeight: 800, fontSize: 16, cursor: 'pointer' }}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => onChange(b)} style={{ all: 'unset', cursor: 'pointer', flex: 1, minWidth: 0 }}>
                <div className="small" style={{ fontWeight: 700 }}>
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 10, background: cor, marginRight: 6 }} />
                  {a === b ? a : `${a} – ${b}`} · {titulo}
                </div>
                <div className="xs muted">{desc}</div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const vazio = () => ({ dataTreino: todayISO(), treino: '', recuperacao: null, foco: null, esforco: null, clima: null, senti: '', fizBem: '', melhorar: '' });

export default function Monitoramento({ user }) {
  const [f, setF] = useState(vazio);
  const [enviando, setEnviando] = useState(false);
  const [hist, setHist] = useState(null);

  const carregar = () => listarMonitoramentos({ alunoId: user.id }).then(setHist).catch(() => setHist([]));
  useEffect(() => void carregar(), [user.id]);

  if (!user.atleta?.ativo) return <Empty icon="🏆">O monitoramento é exclusivo para atletas da equipe de competição.</Empty>;

  const enviar = async () => {
    if (!f.dataTreino) return toast('Informe a data do treino.');
    if (!f.treino) return toast('Qual foi o treino de hoje?');
    const falta = ESCALAS.find((e) => !f[e.k]);
    if (falta) return toast(`Escolha a nota de ${falta.titulo}.`);
    setEnviando(true);
    try {
      await enviarMonitoramento(user.id, { ...f, senti: f.senti.trim(), fizBem: f.fizBem.trim(), melhorar: f.melhorar.trim() });
      toast('Monitoramento enviado! Obrigado pela sinceridade. 🥋');
      setF(vazio());
      window.scrollTo({ top: 0, behavior: 'smooth' });
      carregar();
    } catch (e) {
      toast('Não foi possível enviar: ' + e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <PageHead title="Monitoramento de Performance" sub="Equipe de Competição — envie após cada treino (físico ou técnico)" />
      <Card className="mb">
        <ol className="small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
          <li><b>Para diminuir a ansiedade</b> — se você estiver exausto, os dados vão me dizer e eu vou ajustar seu treino. Você não precisa se matar todo dia para evoluir.</li>
          <li><b>Para proteger seu foco</b> — concentração e ambiente leve no Wuguan é o que vai nos preparar para qualquer desafio. O formulário vai nos ajudar a manter esse ambiente agradável para todos.</li>
          <li><b>Para cuidar do seu mental</b> — o diário emocional é o seu espaço (sinta-se à vontade para se expressar). O que você sente importa tanto quanto (ou mais do que) o seu soco ou chute.</li>
        </ol>
      </Card>

      <div className="grid g2">
        <Card title="📝 Treino de hoje">
          <div className="form-grid">
            <Field label="Data do treino"><input type="date" value={f.dataTreino} max={todayISO()} onChange={(e) => setF({ ...f, dataTreino: e.target.value })} /></Field>
            <Field label="Nome do atleta"><input value={user.nome} disabled /></Field>
          </div>
          <Field label="Qual foi o treino de hoje?">
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              {TREINOS.map(([k, n]) => (
                <button key={k} type="button" className={`btn sm ${f.treino === k ? '' : 'ghost'}`} onClick={() => setF({ ...f, treino: k })}>{f.treino === k ? '✓ ' : ''}{n}</button>
              ))}
            </div>
          </Field>
        </Card>

        {ESCALAS.map((esc) => (
          <Card key={esc.k} title={esc.titulo}>
            <p className="xs muted" style={{ marginTop: 0 }}>{esc.pergunta}</p>
            <EscalaNota esc={esc} value={f[esc.k]} onChange={(v) => setF({ ...f, [esc.k]: v })} />
          </Card>
        ))}

        <Card title="💭 Diário">
          {TEXTOS.map(([k, titulo, dica]) => (
            <Field key={k} label={titulo} hint={dica}>
              <textarea rows={3} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
            </Field>
          ))}
        </Card>
      </div>
      <div className="row end mt"><button className="btn" disabled={enviando} onClick={enviar}>{enviando ? 'Enviando…' : '📨 Enviar monitoramento'}</button></div>

      <Card className="mt" title="📚 Meus envios">
        {hist === null && <p className="small muted">Carregando…</p>}
        {hist?.length === 0 && <p className="small muted">Você ainda não enviou nenhum monitoramento.</p>}
        {hist?.slice(0, 30).map((r) => (
          <div key={r.id} className="list-item" style={{ flexWrap: 'wrap', gap: 6 }}>
            <b className="small" style={{ minWidth: 90 }}>{fmtDate(r.dataTreino)}</b>
            <span className="badge">{nomeTreino(r.treino)}</span>
            {ESCALAS.map((esc) => {
              const fx = faixaDaNota(esc, +r[esc.k]);
              return (
                <span key={esc.k} className="xs" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 9, background: fx?.[2] }} />
                  {esc.sigla} <b>{r[esc.k]}</b>
                </span>
              );
            })}
          </div>
        ))}
      </Card>
    </>
  );
}
