import { useEffect, useState } from 'react';
import { useDB, setDB, frequencia, notify, professorVeAluno } from '../../lib/db';
import { uid, todayISO, fmtDate } from '../../lib/utils';
import { PageHead, Card, Avatar, Faixa, Tabs, toast, Empty, Field, Search } from '../../components/ui';
import { AttendanceChart } from '../../components/shared';

export default function Presenca({ user }) {
  const db = useDB();
  const filial = db.filiais.find((f) => f.id === user.filialId);
  const [tab, setTab] = useState('chamada');
  const [data, setData] = useState(todayISO());
  const [marcados, setMarcados] = useState({});
  const [sel, setSel] = useState(null);
  const [trava, setTrava] = useState(null);

  const alunos = filial ? db.alunos.filter((a) => a.filialId === filial.id && a.status === 'aprovado' && professorVeAluno(db, user, a)).sort((a, b) => a.nome.localeCompare(b.nome)) : [];
  const meusIds = new Set(alunos.map((a) => a.id)); // só os alunos das modalidades deste professor
  const [q, setQ] = useState('');
  const lista = alunos.filter((a) => (a.nome + ' ' + (a.matricula || '')).toLowerCase().includes(q.toLowerCase())); // só filtra a exibição
  const doDia = db.presencas.filter((p) => p.filialId === filial?.id && p.data === data && meusIds.has(p.alunoId));

  // Sincroniza: pré-marca quem já confirmou pelo app ou chamada anterior
  const chave = doDia.map((p) => p.alunoId + p.confirmada).join();
  useEffect(() => {
    const m = {};
    doDia.forEach((p) => (m[p.alunoId] = true));
    setMarcados(m);
  }, [data, chave]);
  useEffect(() => {
    if (filial) setTrava({ aulasSemana: filial.aulasSemana, minFrequencia: filial.minFrequencia, maxFaltas: filial.maxFaltas });
  }, [filial?.id]);

  if (!filial) return <Empty icon="🏯">Você ainda não foi vinculado a uma filial.</Empty>;

  const salvar = () => {
    setDB((d) => {
      // Mexe só na chamada dos próprios alunos (não apaga a de outro professor da mesma filial)
      d.presencas = d.presencas.filter((p) => !(p.filialId === filial.id && p.data === data && meusIds.has(p.alunoId) && !marcados[p.alunoId]));
      for (const a of alunos) {
        if (!marcados[a.id]) continue;
        const ex = d.presencas.find((p) => p.alunoId === a.id && p.data === data);
        if (ex) ex.confirmada = true;
        else d.presencas.push({ id: uid('pz'), alunoId: a.id, filialId: filial.id, data, origem: 'professor', confirmada: true });
      }
      notify(d, 'filial:' + filial.id, 'Chamada registrada', `Presenças de ${fmtDate(data)} confirmadas pelo Laoshi.`);
    });
    toast('Chamada salva.');
  };

  const pelosAlunos = doDia.filter((p) => p.origem === 'aluno' && !p.confirmada).length;

  return (
    <>
      <PageHead title="Presença & Trava Mínima" sub={filial.nome}>
        <Search value={q} onChange={setQ} placeholder="Buscar aluno" />
      </PageHead>
      <Tabs tabs={[['chamada', '✅ Chamada'], ['historico', '📈 Histórico e gráficos'], ['trava', '🔒 Trava mínima']]} value={tab} onChange={setTab} />

      {tab === 'chamada' && (
        <Card
          title="Chamada do dia"
          actions={
            <>
              <input type="date" value={data} max={todayISO()} onChange={(e) => setData(e.target.value)} style={{ maxWidth: 170 }} />
              <button className="btn sm ghost" onClick={() => setMarcados({ ...marcados, ...Object.fromEntries(lista.map((a) => [a.id, true])) })}>Marcar todos</button>
            </>
          }
        >
          {pelosAlunos > 0 && <div className="alert gold mb small">📲 {pelosAlunos} aluno(s) marcaram presença pelo app — já pré-selecionados. Salve para confirmar.</div>}
          {lista.length === 0 && <Empty>Nenhum aluno ativo na filial.</Empty>}
          {lista.map((a) => {
            const p = doDia.find((x) => x.alunoId === a.id);
            return (
              <label key={a.id} className="list-item check" style={{ alignItems: 'center' }}>
                <input type="checkbox" checked={!!marcados[a.id]} onChange={(e) => setMarcados({ ...marcados, [a.id]: e.target.checked })} />
                <Avatar src={a.foto} name={a.nome} />
                <div className="grow">
                  <div style={{ fontWeight: 600 }}>{a.nome} {a.saude?.restricoes && <span title={a.saude.restricoes}>⚕️</span>}</div>
                  <Faixa idx={a.faixaIdx} />
                </div>
                {p?.origem === 'aluno' && <span className="badge gold">via app</span>}
                {p?.confirmada && <span className="badge ok">confirmada</span>}
              </label>
            );
          })}
          {lista.length > 0 && (
            <div className="row end mt">
              <span className="small muted">{Object.values(marcados).filter(Boolean).length} presentes</span>
              <button className="btn" onClick={salvar}>Salvar chamada</button>
            </div>
          )}
        </Card>
      )}

      {tab === 'historico' && (
        <div className="grid g2">
          <Card title="Assiduidade (últimos 90 dias)">
            {lista.map((a) => {
              const f = frequencia(db, a);
              return (
                <button key={a.id} className="list-item" style={{ width: '100%', background: sel === a.id ? 'var(--red-soft)' : 'none', border: 0, cursor: 'pointer', textAlign: 'left', font: 'inherit', borderRadius: 8, padding: '10px 6px' }} onClick={() => setSel(a.id)}>
                  <div className="grow">
                    <div className="row between small"><b>{a.nome}</b><span>{f.pct}% · {f.faltas} faltas</span></div>
                    <div className={`meter ${f.ok ? '' : 'bad'}`}><i style={{ width: f.pct + '%' }} /></div>
                  </div>
                </button>
              );
            })}
            {lista.length === 0 && <Empty>Sem alunos.</Empty>}
          </Card>
          <Card title={sel ? `Gráfico — ${alunos.find((a) => a.id === sel)?.nome}` : 'Selecione um aluno'}>
            {sel ? <AttendanceChart alunoId={sel} /> : <Empty icon="📈">Toque em um aluno para ver o gráfico individual.</Empty>}
          </Card>
        </div>
      )}

      {tab === 'trava' && trava && (
        <Card title="Trava de presença mínima para o pré-exame">
          <p className="small muted">Configuração autônoma da sua unidade. Alunos abaixo destes limites não podem ser marcados como “Apto” na pré-avaliação.</p>
          <div className="form-grid">
            <Field label="Aulas por semana (carga horária)"><input type="number" min="1" value={trava.aulasSemana} onChange={(e) => setTrava({ ...trava, aulasSemana: +e.target.value })} /></Field>
            <Field label="Frequência mínima (%)"><input type="number" min="0" max="100" value={trava.minFrequencia} onChange={(e) => setTrava({ ...trava, minFrequencia: +e.target.value })} /></Field>
            <Field label="Limite de faltas (90 dias)"><input type="number" min="0" value={trava.maxFaltas} onChange={(e) => setTrava({ ...trava, maxFaltas: +e.target.value })} /></Field>
          </div>
          <div className="row end mt">
            <button className="btn" onClick={() => (setDB((d) => Object.assign(d.filiais.find((f) => f.id === filial.id), trava)), toast('Trava atualizada.'))}>Salvar trava</button>
          </div>
        </Card>
      )}
    </>
  );
}
