import { useEffect, useState } from 'react';
import { useDB, setDB, frequencia, notify, professorVeAluno, alunoNaFilial, filialExtraDoAluno, filialNome, TURNOS, nomeTurno, turnoAgora, alunoNoTurno, presencaNoTurno, horariosFilial, horarioAgora, alunoNoHorario, presencaNoHorario, rotuloHorario, diaDaData, DIAS_SEMANA } from '../../lib/db';
import { TurnosBadge, HorariosFilialEditor } from '../../components/Turnos';
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
  // Horário da chamada: o do professor (se ele dá aula em um só) ou o do momento; '' = todos
  const [turno, setTurno] = useState(() => {
    const meus = user.turnos || [];
    if (meus.length === 1) return meus[0];
    return !meus.length || meus.includes(turnoAgora()) ? turnoAgora() : meus[0];
  });

  // Inclui quem é de outra filial mas também treina aqui (dias alternados)
  const alunos = filial
    ? db.alunos.filter((a) => a.status === 'aprovado' && alunoNaFilial(a, filial.id) && (filialExtraDoAluno(a, filial.id) || professorVeAluno(db, user, a))).sort((a, b) => a.nome.localeCompare(b.nome))
    : [];
  // Vários horários no mesmo período (ex.: 18:00–19:30, 19:30–20:00…): a chamada é de um horário
  // ...e a grade é a do dia da semana da chamada (ex.: segunda 9h–10h, 10h20–11h30)
  const gradeTurno = horariosFilial(filial, turno, diaDaData(data));
  const refHorario = () => (data === todayISO() ? new Date() : new Date(data + 'T00:00'));
  const [horarioId, setHorarioId] = useState(() => horarioAgora(filial, turno, refHorario())?.id || '');
  useEffect(() => {
    if (!gradeTurno.some((h) => h.id === horarioId)) setHorarioId(horarioAgora(filial, turno, refHorario())?.id || '');
  }, [turno, data, filial?.id, gradeTurno.map((h) => h.id).join()]);
  const horario = gradeTurno.find((h) => h.id === horarioId) || null;
  const naSessao = (a) => alunoNoTurno(a, turno) && alunoNoHorario(a, horario, filial);
  const presNaSessao = (p) => presencaNoTurno(p, turno) && presencaNoHorario(p, horario);
  const rotuloSessao = turno ? nomeTurno(turno) + (horario ? ' ' + rotuloHorario(horario) : '') : '';
  // Chamada só com quem treina no horário escolhido (aluno sem horário definido aparece em todos)
  const daChamada = alunos.filter(naSessao);
  const meusIds = new Set(daChamada.map((a) => a.id)); // só os alunos das modalidades deste professor, neste horário
  const [q, setQ] = useState('');
  const lista = (tab === 'chamada' ? daChamada : alunos).filter((a) => (a.nome + ' ' + (a.matricula || '')).toLowerCase().includes(q.toLowerCase())); // só filtra a exibição
  const doDia = db.presencas.filter((p) => p.filialId === filial?.id && p.data === data && meusIds.has(p.alunoId) && presNaSessao(p));

  // Sincroniza: pré-marca quem já confirmou pelo app ou chamada anterior
  const chave = doDia.map((p) => p.alunoId + p.confirmada).join();
  useEffect(() => {
    const m = {};
    doDia.forEach((p) => (m[p.alunoId] = true));
    setMarcados(m);
  }, [data, chave, turno, horarioId]);
  useEffect(() => {
    if (filial) setTrava({ aulasSemana: filial.aulasSemana, minFrequencia: filial.minFrequencia, maxFaltas: filial.maxFaltas });
  }, [filial?.id]);

  if (!filial) return <Empty icon="🏯">Você ainda não foi vinculado a uma filial.</Empty>;

  const salvar = () => {
    setDB((d) => {
      // Mexe só na chamada dos próprios alunos (não apaga a de outro professor da mesma filial)
      d.presencas = d.presencas.filter((p) => !(p.filialId === filial.id && p.data === data && meusIds.has(p.alunoId) && presNaSessao(p) && !marcados[p.alunoId]));
      for (const a of daChamada) {
        if (!marcados[a.id]) continue;
        // Cada filial tem a sua chamada: a presença de outra filial no mesmo dia não é tocada
        // ...e cada horário também: a presença da manhã não é mexida na chamada da noite
        const ex = d.presencas.find((p) => p.alunoId === a.id && p.data === data && p.filialId === filial.id && presNaSessao(p));
        if (ex) {
          ex.confirmada = true;
          if (turno) ex.turno = turno;
          if (horario) ex.horario = horario.id;
        } else d.presencas.push({ id: uid('pz'), alunoId: a.id, filialId: filial.id, data, ...(turno ? { turno } : {}), ...(horario ? { horario: horario.id } : {}), origem: 'professor', confirmada: true });
      }
      notify(d, 'filial:' + filial.id, 'Chamada registrada', `Presenças de ${fmtDate(data)}${rotuloSessao ? ` (${rotuloSessao})` : ''} confirmadas pelo Laoshi.`);
    });
    toast(`Chamada${rotuloSessao ? ' — ' + rotuloSessao : ''} salva.`);
  };

  const pelosAlunos = doDia.filter((p) => p.origem === 'aluno' && !p.confirmada).length;

  return (
    <>
      <PageHead title="Presença & Trava Mínima" sub={filial.nome}>
        <Search value={q} onChange={setQ} placeholder="Buscar aluno" />
      </PageHead>
      <Tabs tabs={[['chamada', '✅ Chamada'], ['historico', '📈 Histórico e gráficos'], ['horarios', '🕐 Horários de aula'], ['trava', '🔒 Trava mínima']]} value={tab} onChange={setTab} />

      {tab === 'chamada' && (
        <Card
          title={`Chamada do dia${rotuloSessao ? ' — ' + rotuloSessao : ''}`}
          actions={
            <>
              <input type="date" value={data} max={todayISO()} onChange={(e) => setData(e.target.value)} style={{ maxWidth: 170 }} />
              <button className="btn sm ghost" onClick={() => setMarcados({ ...marcados, ...Object.fromEntries(lista.map((a) => [a.id, true])) })}>Marcar todos</button>
            </>
          }
        >
          <div className="row mb" style={{ gap: 6, flexWrap: 'wrap' }}>
            {[...TURNOS, ['', 'Todos', '👥']].map(([k, nome, ic]) => (
              <button key={k || 'todos'} type="button" className={`btn sm ${turno === k ? '' : 'ghost'}`} onClick={() => setTurno(k)}>
                {ic} {nome} <span className="xs" style={{ opacity: 0.75 }}>({alunos.filter((a) => alunoNoTurno(a, k)).length})</span>
              </button>
            ))}
          </div>
          {turno && (filial.horarios || []).some((h) => h.turno === turno) && gradeTurno.length === 0 && (
            <div className="xs muted mb">Sem horário de aula cadastrado para {DIAS_SEMANA.find(([d]) => d === diaDaData(data))?.[1]} neste período — chamada do período inteiro.</div>
          )}
          {gradeTurno.length > 0 && (
            <div className="row mb" style={{ gap: 6, flexWrap: 'wrap' }}>
              {gradeTurno.map((h) => (
                <button key={h.id} type="button" className={`btn sm ${horarioId === h.id ? 'dark' : 'ghost'}`} onClick={() => setHorarioId(h.id)}>
                  🕐 {rotuloHorario(h)} <span className="xs" style={{ opacity: 0.75 }}>({alunos.filter((a) => alunoNoTurno(a, turno) && alunoNoHorario(a, h, filial)).length})</span>
                </button>
              ))}
              <button type="button" className={`btn sm ${!horarioId ? 'dark' : 'ghost'}`} onClick={() => setHorarioId('')}>Período inteiro</button>
            </div>
          )}
          {turno && alunos.some((a) => !a.turnos?.length) && (
            <div className="xs muted mb">Alunos sem horário definido aparecem em todas as chamadas até escolherem o horário em “Meus Dados” (ou você definir na ficha do aluno).</div>
          )}
          {pelosAlunos > 0 && <div className="alert gold mb small">📲 {pelosAlunos} aluno(s) marcaram presença pelo app — já pré-selecionados. Salve para confirmar.</div>}
          {lista.length === 0 && <Empty>{turno ? `Nenhum aluno neste horário (${rotuloSessao}).` : 'Nenhum aluno ativo na filial.'}</Empty>}
          {lista.map((a) => {
            const p = doDia.find((x) => x.alunoId === a.id);
            const outra = !p && db.presencas.find((x) => x.alunoId === a.id && x.data === data && x.filialId !== filial.id);
            return (
              <label key={a.id} className="list-item check" style={{ alignItems: 'center' }}>
                <input type="checkbox" checked={!!marcados[a.id]} onChange={(e) => setMarcados({ ...marcados, [a.id]: e.target.checked })} />
                <Avatar src={a.foto} name={a.nome} />
                <div className="grow">
                  <div style={{ fontWeight: 600 }}>{a.nome} {a.saude?.restricoes && <span title={a.saude.restricoes}>⚕️</span>}</div>
                  <Faixa idx={a.faixaIdx} />
                  {(!turno || !a.turnos?.length || (horario && !a.horarios?.includes(horario.id))) && <div><TurnosBadge turnos={a.turnos} horarios={a.horarios} /></div>}
                  {filialExtraDoAluno(a, filial.id) && <div className="xs muted">🔁 Filial principal: {filialNome(db, a.filialId)}</div>}
                </div>
                {outra && <span className="badge" title="Presença registrada em outra filial nesta data">📍 {filialNome(db, outra.filialId)}</span>}
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

      {tab === 'horarios' && <HorariosFilialEditor filial={filial} />}

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
