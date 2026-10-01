import { setDB } from '../lib/db';
import { Card, PhotoInput, toast } from './ui';

/**
 * Foto da carteirinha (3×4), separada da foto de perfil.
 * O perfil continua com a foto de identificação/atleta; a carteirinha pode usar uma foto de documento.
 */
export default function FotoCarteirinha({ pessoa, colecao = 'alunos' }) {
  const propria = !!pessoa.fotoCarteirinha;
  const gravar = (foto) => {
    setDB((d) => {
      const x = d[colecao].find((y) => y.id === pessoa.id);
      if (!x) return;
      if (foto) x.fotoCarteirinha = foto;
      else delete x.fotoCarteirinha;
    });
    toast(foto ? 'Foto da carteirinha atualizada.' : 'A carteirinha voltou a usar a foto do perfil.');
  };

  return (
    <Card title="📷 Foto da carteirinha (3×4)">
      <p className="small muted" style={{ marginTop: 0 }}>
        Escolha uma foto de documento só para a carteirinha. A foto do seu perfil (e do perfil de atleta) não muda.
      </p>
      <div className="col" style={{ gap: 8 }}>
        <label className="check">
          <input type="radio" name={`foto-cart-${pessoa.id}`} checked={!propria} onChange={() => propria && gravar(null)} /> Usar a foto do perfil
        </label>
        <label className="check" style={{ alignItems: 'center' }}>
          <input type="radio" name={`foto-cart-${pessoa.id}`} checked={propria} readOnly onClick={() => !propria && toast('Tire ou escolha a foto 3×4 abaixo.')} /> Usar uma foto 3×4 diferente
        </label>
        <PhotoInput formato="3x4" value={pessoa.fotoCarteirinha || null} name={pessoa.nome} onChange={gravar} />
        <div className="xs muted">Dica: fundo claro, rosto de frente e centralizado, sem boné ou óculos escuros.</div>
      </div>
    </Card>
  );
}
