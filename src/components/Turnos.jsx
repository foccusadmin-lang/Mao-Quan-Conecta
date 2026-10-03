import { useEffect, useState } from 'react';
import { useDB, setDB, TURNOS, nomeTurno, horariosFilial, rotuloHorario, turnoDoHorario, DIAS_SEMANA, textoDias } from '../lib/db';
import { uid } from '../lib/utils';
import { Card, toast } from './ui';

/** Escolha dos horários de treino (manhã / tarde / noite) — um ou mais */
export function TurnosInput({ value = [], onChange, disabled }) {
  const alterna = (k) => onChange(value.includes(k) ? value.filter((x) => x !== k) : TURNOS.map(([t]) => t).filter((t) => t === k || value.includes(t)));
  return (
    <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
      {TURNOS.map(([k, nome, ic]) => {
        const on = value.includes(k);
        return (
          <button key={k} type="button" disabled={disabled} className={`btn sm ${on ? '' : 'ghost'}`} onClick={() => alterna(k)}>
            {on ? '✓ ' : ''}{ic} {nome}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Horário de treino do aluno: nos períodos em que a filial tem grade de horários, ele escolhe o horário exato
 * (ex.: Noite 18:00–19:30); nos demais, só o período. value = { turnos, horarios }
 */
export function HorarioTreinoInput({ filialIds = [], value, onChange, disabled }) {
  const db = useDB();
  const filiais = filialIds.map((id) => db.filiais.find((f) => f.id === id)).filter(Boolean);
  const turnos = value?.turnos || [];
  const horarios = value?.horarios || [];
  const varias = filiais.length > 1;
  const emite = (novosTurnos, novosHorarios) => onChange({ turnos: TURNOS.map(([t]) => t).filter((t) => novosTurnos.includes(t)), horarios: novosHorarios });

  return (
    <div className="col" style={{ gap: 8 }}>
      {TURNOS.map(([k, nome, ic]) => {
        const grade = filiais.flatMap((f) => horariosFilial(f, k).map((h) => ({ ...h, filial: f })));
        if (!grade.length) {
          const on = turnos.includes(k);
          return (
            <div key={k} className="row" style={{ gap: 6 }}>
              <button type="button" disabled={disabled} className={`btn sm ${on ? '' : 'ghost'}`} onClick={() => emite(on ? turnos.filter((t) => t !== k) : [...turnos, k], horarios)}>
                {on ? '✓ ' : ''}{ic} {nome}
              </button>
            </div>
          );
        }
        const idsPeriodo = grade.map((h) => h.id);
        return (
          <div key={k} className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="small" style={{ minWidth: 72 }}>{ic} {nome}</span>
            {grade.map((h) => {
              const on = horarios.includes(h.id);
              const alternar = () => {
                const hs = on ? horarios.filter((x) => x !== h.id) : [...horarios, h.id];
                const ainda = hs.some((x) => idsPeriodo.includes(x));
                emite(ainda ? [...new Set([...turnos, k])] : turnos.filter((t) => t !== k), hs);
              };
              return (
                <button key={h.id} type="button" disabled={disabled} className={`btn sm ${on ? '' : 'ghost'}`} onClick={alternar}>
                  {on ? '✓ ' : ''}{rotuloHorario(h, true)}{varias ? ` · ${h.filial.nome}` : ''}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/** Selos dos horários do aluno ("🌅 Manhã · 🌙 Noite 18:00–19:30") */
export function TurnosBadge({ turnos, horarios }) {
  const db = useDB();
  if (!turnos?.length) return <span className="xs muted">⏰ horário não definido</span>;
  const todos = db.filiais.flatMap((f) => f.horarios || []);
  const texto = TURNOS.filter(([k]) => turnos.includes(k)).map(([k, n, ic]) => {
    const hs = todos.filter((h) => h.turno === k && horarios?.includes(h.id)).sort((a, b) => a.inicio.localeCompare(b.inicio));
    return `${ic} ${n}${hs.length ? ' ' + hs.map((h) => rotuloHorario(h, true)).join(', ') : ''}`;
  });
  return <span className="xs muted">{texto.join(' · ')}</span>;
}

export const textoTurnos = (turnos) => (turnos?.length ? turnos.map(nomeTurno).join(', ') : 'não definido');

/** Professor / Central: grade de horários da filial (ex.: noite 18:00–19:30, 19:30–20:00, 20:00–21:30) */
export function HorariosFilialEditor({ filial }) {
  const [lista, setLista] = useState(() => structuredClone(filial.horarios || []));
  useEffect(() => setLista(structuredClone(filial.horarios || [])), [filial.id]);
  const [novo, setNovo] = useState({ inicio: '', fim: '', dias: [], aula: '' });
  // Renomear a aula de um horário já cadastrado
  const renomear = (h) => {
    const nome = window.prompt('Nome da aula (ex.: Treino de força, Treino tradicional). Deixe vazio para tirar.', h.aula || '');
    if (nome === null) return;
    setLista(lista.map((x) => (x.id === h.id ? (nome.trim() ? { ...x, aula: nome.trim() } : (({ aula, ...r }) => r)(x)) : x)));
  };
  const cruzaDias = (a, b) => !a.length || !b.length || a.some((d) => b.includes(d));

  const adicionar = () => {
    if (!novo.inicio || !novo.fim) return toast('Informe o início e o fim do horário.');
    if (novo.fim <= novo.inicio) return toast('O fim precisa ser depois do início.');
    if (lista.some((h) => cruzaDias(novo.dias, h.dias || []) && novo.inicio < h.fim && h.inicio < novo.fim)) return toast('Esse horário se sobrepõe a outro já cadastrado no mesmo dia.');
    const dias = novo.dias.length === 7 ? [] : DIAS_SEMANA.map(([d]) => d).filter((d) => novo.dias.includes(d));
    setLista([...lista, { id: uid('hr'), turno: turnoDoHorario(novo.inicio), inicio: novo.inicio, fim: novo.fim, ...(dias.length ? { dias } : {}), ...(novo.aula.trim() ? { aula: novo.aula.trim() } : {}) }].sort((a, b) => a.inicio.localeCompare(b.inicio)));
    setNovo({ ...novo, inicio: '', fim: '', aula: '' }); // mantém os dias marcados para cadastrar o próximo horário do mesmo dia
  };
  const salvar = () => {
    setDB((d) => {
      const f = d.filiais.find((x) => x.id === filial.id);
      if (lista.length) f.horarios = lista;
      else delete f.horarios;
    });
    toast('Horários de aula salvos.');
  };

  return (
    <Card title={`🕐 Horários de aula — ${filial.nome}`}>
      <p className="small muted" style={{ marginTop: 0 }}>
        Cadastre os dias e horários das aulas (ex.: segunda 09:00–10:00, 10:20–11:30 e 13:00–14:30). O aluno escolhe o horário em que treina e a chamada fica separada por horário, mostrando só as aulas do dia da semana.
      </p>
      {TURNOS.map(([k, nome, ic]) => {
        const hs = lista.filter((h) => h.turno === k);
        return (
          <div key={k} className="list-item" style={{ flexWrap: 'wrap', gap: 6 }}>
            <b className="small" style={{ minWidth: 80 }}>{ic} {nome}</b>
            {hs.length === 0 && <span className="xs muted">sem horários cadastrados (chamada única do período)</span>}
            {hs.map((h) => (
              <span key={h.id} className="badge" style={{ padding: '4px 8px' }}>
                <b>{textoDias(h)}</b> {rotuloHorario(h)}{' '}
                <button type="button" className="btn link sm" title="Nome da aula" onClick={() => renomear(h)}>✏️</button>
                <button type="button" className="btn link sm" title="Remover horário" onClick={() => setLista(lista.filter((x) => x.id !== h.id))}>✕</button>
              </span>
            ))}
          </div>
        );
      })}
      <div className="small mt" style={{ fontWeight: 600 }}>Novo horário</div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
        {DIAS_SEMANA.map(([d, n]) => {
          const on = novo.dias.includes(d);
          return (
            <button key={d} type="button" className={`btn sm ${on ? '' : 'ghost'}`} onClick={() => setNovo({ ...novo, dias: on ? novo.dias.filter((x) => x !== d) : [...novo.dias, d] })}>
              {on ? '✓ ' : ''}{n}
            </button>
          );
        })}
        <span className="xs muted" style={{ alignSelf: 'center' }}>{novo.dias.length ? '' : 'nenhum dia marcado = todos os dias'}</span>
      </div>
      <div className="row mt" style={{ gap: 6, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <label className="small">Início<br /><input type="time" value={novo.inicio} onChange={(e) => setNovo({ ...novo, inicio: e.target.value })} /></label>
        <label className="small">Fim<br /><input type="time" value={novo.fim} onChange={(e) => setNovo({ ...novo, fim: e.target.value })} /></label>
        <label className="small grow" style={{ minWidth: 180 }}>Aula (opcional)<br /><input value={novo.aula} onChange={(e) => setNovo({ ...novo, aula: e.target.value })} placeholder="Ex.: Treino de força" /></label>
        <button type="button" className="btn ghost" onClick={adicionar}>+ Adicionar horário</button>
      </div>
      <div className="xs muted mt">O período (manhã, tarde ou noite) é definido pelo horário de início: antes das 12h, até as 18h, ou depois.</div>
      <div className="row end mt"><button type="button" className="btn" onClick={salvar}>Salvar horários</button></div>
    </Card>
  );
}

/** Aulas do dia (grade de horários) — painel do professor (filial ativa) e da Central (todas as filiais) */
export function AulasDoDia({ filialIds }) {
  const db = useDB();
  const hoje = new Date().getDay();
  const agora = `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;
  const filiais = db.filiais.filter((f) => (!filialIds || filialIds.includes(f.id)) && (f.horarios || []).length);
  const blocos = filiais.map((f) => ({ f, hs: horariosFilial(f, null, hoje) })).filter((b) => b.hs.length);
  const nomeDia = DIAS_SEMANA.find(([d]) => d === hoje)?.[1];
  return (
    <Card title={`🕐 Aulas de hoje (${nomeDia})`}>
      {!filiais.length && <p className="small muted" style={{ margin: 0 }}>Nenhuma grade de horários cadastrada. Cadastre em Presença → “🕐 Horários de aula”.</p>}
      {filiais.length > 0 && !blocos.length && <p className="small muted" style={{ margin: 0 }}>Sem aulas cadastradas para hoje.</p>}
      {blocos.map(({ f, hs }) => (
        <div key={f.id} className="mb">
          {(!filialIds || filialIds.length > 1) && <div className="xs muted" style={{ fontWeight: 600, marginBottom: 2 }}>{f.nome}</div>}
          {hs.map((h) => {
            const status = agora >= h.fim ? 'encerrada' : agora >= h.inicio ? 'agora' : '';
            return (
              <div key={h.id} className="list-item" style={{ padding: '6px 0', opacity: status === 'encerrada' ? 0.55 : 1 }}>
                <b className="small" style={{ minWidth: 96 }}>{h.inicio}–{h.fim}</b>
                <span className="small grow">{h.aula || <span className="muted">Aula ({nomeTurno(h.turno).toLowerCase()})</span>}</span>
                {status === 'agora' && <span className="badge ok">acontecendo agora</span>}
                {status === 'encerrada' && <span className="xs muted">encerrada</span>}
              </div>
            );
          })}
        </div>
      ))}
    </Card>
  );
}
