import { useDB } from '../lib/db';

/**
 * "Também treino em…": filiais adicionais do aluno (dias de aula alternados).
 * O nome dele aparece na chamada de todas; mensalidade e cadastro continuam na filial principal.
 */
export default function FiliaisTreino({ principal, value = [], onChange, disabled }) {
  const db = useDB();
  const outras = db.filiais.filter((x) => x.id !== principal && (x.ativa || value.includes(x.id)));
  if (!principal || !outras.length) return null;
  const alterna = (id, on) => onChange(on ? [...new Set([...value, id])] : value.filter((x) => x !== id));
  return (
    <div className="col" style={{ gap: 6 }}>
      {outras.map((x) => (
        <label key={x.id} className="check">
          <input type="checkbox" disabled={disabled} checked={value.includes(x.id)} onChange={(e) => alterna(x.id, e.target.checked)} /> {x.nome}
        </label>
      ))}
      <div className="xs muted">Marque as outras filiais onde treina em dias alternados. O nome aparece na lista de chamada de cada uma; a mensalidade continua na filial principal.</div>
    </div>
  );
}

/** Remove duplicadas e a própria filial principal */
export const limparExtras = (principal, extras = []) => [...new Set(extras.filter((x) => x && x !== principal))];
