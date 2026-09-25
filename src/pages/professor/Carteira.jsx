import { useRef } from 'react';
import { useDB, professorEmDia } from '../../lib/db';
import { PageHead, Card } from '../../components/ui';
import { Carteirinha, ExportButtons, dadosCarteirinha } from '../../components/Carteirinha';

export default function ProfCarteira({ user }) {
  const db = useDB();
  const frente = useRef(null);
  const verso = useRef(null);
  const liberado = professorEmDia(user);
  const motivo = 'Download liberado após a confirmação do pagamento da filiação.';
  return (
    <>
      <PageHead title="Minha Carteirinha" sub="Identidade do Praticante — Professor Filiado" />
      <Card>
        <Carteirinha modelo={db.modelos.professor} dados={dadosCarteirinha(db, user, 'professor')} frenteRef={frente} versoRef={verso} />
        <div className="mt"><ExportButtons getNodes={() => [frente.current, verso.current]} nome={`carteirinha-${user.nome}`} liberado={liberado} motivo={motivo} /></div>
        {!liberado && <div className="alert red mt small">🔒 {motivo}</div>}
        {(!user.rg || !user.cpf || !user.nascimento) && <div className="alert gold mt small">ℹ️ RG, CPF ou data de nascimento não cadastrados — solicite à Central a atualização dos seus dados.</div>}
      </Card>
    </>
  );
}
