import { useEffect, useMemo, useState } from 'react';
import { useDB, filialNome, alunoNaFilial } from '../../lib/db';
import { fmtDate, addDays, todayISO } from '../../lib/utils';
import { PageHead, Card, Stat, Empty, Avatar, Tabs } from '../../components/ui';
import { ESCALAS, TEXTOS, faixaDaNota, nomeTreino, alertas, listarMonitoramentos } from '../../lib/monitoramento';
import GraficoMonitoramento from '../../components/GraficoMonitoramento';

const PERIODOS = [[7, '7 dias'], [30, '30 dias'], [90, '90 dias'], [365, '12 meses']];
const media = (lista, k) => (lista.length ? Math.round((lista.reduce((s, r) => s + (+r[k] || 0), 0) / lista.length) * 10) / 10 : null);

/** Nota com a bolinha da cor da faixa */
function Nota({ esc, v }) {
  const fx = faixaDaNota(esc, +v);
  return (
    <span className="xs" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} title={fx ? `${fx[3]} — ${fx[4]}` : ''}>
      <span style={{ width: 9, height: 9, borderRadius: 9, background: fx?.[2] }} />
      {esc.sigla} <b>{v}</b>{fx && <span className="muted"> {fx[3]}</span>}
    </span>
  );
}

function Resposta({ r, mostrarNome }) {
  const al = alertas(r);
  return (
    <div className="card" style={{ padding: 12 }}>
      <div className="row between" style={{ flexWrap: 'wrap', gap: 6 }}>
        <div className="small"><b>{fmtDate(r.dataTreino)}</b>{mostrarNome && <> · {r.nome}</>} · <span className="badge">{nomeTreino(r.treino)}</span></div>
        <div className="row" style={{ gap: 4 }}>{al.map(([ic, t]) => <span key={t} className="badge red">{ic} {t}</span>)}</div>
      </div>
      <div className="row mt" style={{ gap: 12, flexWrap: 'wrap' }}>{ESCALAS.map((e) => <Nota key={e.k} esc={e} v={r[e.k]} />)}</div>
      {TEXTOS.some(([k]) => r[k]) && (
        <div className="col" style={{ gap: 4, marginTop: 8 }}>
          {TEXTOS.filter(([k]) => r[k]).map(([k, t]) => (
            <div key={k} className="small"><span className="muted">{t}</span><div style={{ whiteSpace: 'pre-line' }}>{r[k]}</div></div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MonitoramentoEquipe({ user }) {
  const db = useDB();
  const isAdmin = user.role === 'admin';
  const [dias, setDias] = useState(30);
  const [filial, setFilial] = useState(isAdmin ? '' : user.filialId);
  const [atleta, setAtleta] = useState('');
  const [tab, setTab] = useState('coletivo');
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!isAdmin) setFilial(user.filialId);
  }, [user.filialId]);
  useEffect(() => {
    setLista(null);
    listarMonitoramentos({ desde: addDays(todayISO(), -dias) })
      .then(setLista)
      .catch((e) => (setErro(e.message), setLista([])));
  }, [dias]);

  // Atletas da filial (principal ou que também treinam nela)
  const atletas = db.alunos.filter((a) => a.atleta?.ativo && a.status === 'aprovado' && (!filial || alunoNaFilial(a, filial))).sort((a, b) => a.nome.localeCompare(b.nome));
  const idsFilial = new Set(atletas.map((a) => a.id));
  const doFiltro = useMemo(() => (lista || []).filter((r) => (!filial || idsFilial.has(r.alunoId) || r.filialId === filial) && (!atleta || r.alunoId === atleta)), [lista, filial, atleta, atletas.length]);
  const atencao = doFiltro.filter((r) => alertas(r).length);

  // Resumo por atleta (aba individual)
  const porAtleta = atletas.map((a) => {
    const rs = (lista || []).filter((r) => r.alunoId === a.id);
    return { a, rs, ultimo: rs[0], medias: Object.fromEntries(ESCALAS.map((e) => [e.k, media(rs, e.k)])) };
  });

  return (
    <>
      <PageHead title="Monitoramento de Performance" sub={`Equipe de Competição${filial ? ' · ' + filialNome(db, filial) : ''}`}>
        {isAdmin && (
          <select value={filial} onChange={(e) => (setFilial(e.target.value), setAtleta(''))} style={{ maxWidth: 220 }}>
            <option value="">Todas as filiais</option>
            {db.filiais.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        )}
        <select value={dias} onChange={(e) => setDias(+e.target.value)} style={{ maxWidth: 140 }}>
          {PERIODOS.map(([d, n]) => <option key={d} value={d}>Últimos {n}</option>)}
        </select>
        <select value={atleta} onChange={(e) => setAtleta(e.target.value)} style={{ maxWidth: 220 }}>
          <option value="">Todos os atletas</option>
          {atletas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
        </select>
      </PageHead>

      {erro && <div className="alert red mb small">Não foi possível carregar: {erro}</div>}
      {lista === null && <p className="muted">Carregando respostas…</p>}

      {lista !== null && (
        <>
          <div className="grid g4">
            <Stat label="Respostas no período" value={doFiltro.length} icon="📝" tone="ink" hint={`${new Set(doFiltro.map((r) => r.alunoId)).size} atleta(s)`} />
            {ESCALAS.map((e) => <Stat key={e.k} label={`Média ${e.titulo}`} value={media(doFiltro, e.k) ?? '—'} icon={e.k === 'esforco' ? '💪' : e.k === 'foco' ? '🎯' : e.k === 'clima' ? '🤫' : '🔋'} tone={e.k === 'esforco' ? 'gold' : 'ok'} />)}
            <Stat label="Pontos de atenção" value={atencao.length} icon="⚠️" tone="red" />
          </div>

          <Card className="mt" title={atleta ? `📈 Evolução — ${db.alunos.find((a) => a.id === atleta)?.nome || ''}` : '📈 Média da equipe por treino'}>
            <GraficoMonitoramento respostas={doFiltro} />
          </Card>

          <Tabs tabs={[['coletivo', '👥 Coletivo'], ['individual', '🥋 Por atleta'], ['atencao', `⚠️ Atenção (${atencao.length})`]]} value={tab} onChange={setTab} />

          {tab === 'coletivo' && (
            <div className="col" style={{ gap: 8 }}>
              {doFiltro.length === 0 && <Empty icon="📝">Nenhuma resposta no período.</Empty>}
              {doFiltro.map((r) => <Resposta key={r.id} r={r} mostrarNome />)}
            </div>
          )}

          {tab === 'individual' && (
            <Card>
              {atletas.length === 0 && <Empty icon="🏆">Nenhum atleta ativo{filial ? ' nesta filial' : ''}.</Empty>}
              {porAtleta.map(({ a, rs, ultimo, medias }) => (
                <button key={a.id} type="button" className="list-item" onClick={() => (setAtleta(a.id), setTab('coletivo'))} style={{ width: '100%', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left', font: 'inherit', flexWrap: 'wrap', gap: 8 }}>
                  <Avatar src={a.foto} name={a.nome} />
                  <div className="grow" style={{ minWidth: 160 }}>
                    <div style={{ fontWeight: 600 }}>{a.nome}</div>
                    <div className="xs muted">{rs.length ? `${rs.length} resposta(s) · último envio ${fmtDate(ultimo.dataTreino)}` : 'Nenhum envio no período'}</div>
                  </div>
                  {rs.length > 0 && <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>{ESCALAS.map((e) => <Nota key={e.k} esc={e} v={medias[e.k]} />)}</div>}
                </button>
              ))}
            </Card>
          )}

          {tab === 'atencao' && (
            <div className="col" style={{ gap: 8 }}>
              {atencao.length === 0 && <Empty icon="✅">Nenhum sinal de atenção no período.</Empty>}
              {atencao.map((r) => <Resposta key={r.id} r={r} mostrarNome />)}
            </div>
          )}
        </>
      )}
    </>
  );
}
