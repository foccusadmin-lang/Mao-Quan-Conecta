import { TURNOS, nomeTurno } from '../lib/db';

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

/** Selos dos horários do aluno ("🌅 Manhã · 🌙 Noite") */
export function TurnosBadge({ turnos }) {
  if (!turnos?.length) return <span className="xs muted">⏰ horário não definido</span>;
  return <span className="xs muted">{TURNOS.filter(([k]) => turnos.includes(k)).map(([, n, ic]) => `${ic} ${n}`).join(' · ')}</span>;
}

export const textoTurnos = (turnos) => (turnos?.length ? turnos.map(nomeTurno).join(', ') : 'não definido');
