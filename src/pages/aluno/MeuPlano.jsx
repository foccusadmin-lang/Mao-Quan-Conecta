import { useState } from 'react';
import { useDB } from '../../lib/db';
import { brl } from '../../lib/utils';
import { temPlanos, valorPlano, resumoPlano, validarPlano } from '../../lib/planos';
import { PageHead, Card, toast } from '../../components/ui';
import { EscolhaPlano, salvarPlanoAluno } from '../../components/Planos';

export default function MeuPlano({ user }) {
  const db = useDB();
  const eu = db.alunos.find((a) => a.id === user.id) || user;
  const filial = db.filiais.find((f) => f.id === eu.filialId);
  const [plano, setPlano] = useState(eu.plano || null);
  const [salvando, setSalvando] = useState(false);

  if (!filial) return <div className="alert gold">Seu cadastro ainda não está vinculado a uma filial.</div>;

  if (eu.isentoPor)
    return (
      <>
        <PageHead title="Meu Plano" sub={filial.nome} />
        <div className="alert ok">👨‍👩‍👧 {eu.isentoMotivo || 'Você faz parte de um plano família'}. Você está isento(a) da mensalidade — o titular é o responsável pelo pagamento.</div>
      </>
    );

  const salvar = async () => {
    const erro = validarPlano(filial, plano);
    if (erro) return toast(erro);
    setSalvando(true);
    try {
      const lista = await salvarPlanoAluno(eu.id, plano);
      const achados = lista.filter((b) => b.cadastrado).length;
      toast(plano.tipo === 'familia' ? `Plano salvo. ${achados} beneficiário(s) com cadastro já ficaram isentos.` : 'Plano salvo.');
    } catch (e) {
      toast('Não foi possível salvar: ' + e.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <PageHead title="Meu Plano" sub={`${filial.nome} · escolha suas modalidades, o pacote ou o plano família`} />
      {eu.plano && temPlanos(filial) && (
        <div className="alert ink mb">
          Plano atual: <b>{resumoPlano(filial, eu.plano)}</b> · {brl(valorPlano(filial, eu.plano))}/mês
        </div>
      )}
      <Card>
        <EscolhaPlano filial={filial} value={plano} onChange={setPlano} />
        {temPlanos(filial) && (
          <>
            <p className="xs muted">A alteração vale a partir da próxima mensalidade gerada. Cobranças já emitidas não mudam.</p>
            <button className="btn" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar plano'}</button>
          </>
        )}
      </Card>
    </>
  );
}
