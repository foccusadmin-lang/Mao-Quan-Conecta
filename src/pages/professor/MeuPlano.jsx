import { useEffect, useState } from 'react';
import { useDB, recarregar, filialNome } from '../../lib/db';
import { supabase } from '../../lib/supabase';
import { brl, todayISO, uid } from '../../lib/utils';
import { temPlanos, valorPlano, resumoPlano, validarPlano } from '../../lib/planos';
import { PageHead, Card, Modal, toast } from '../../components/ui';
import { ExtratoPagamentos } from '../../components/Extrato';
import { PixBox } from '../../components/shared';
import { EscolhaPlano, salvarPlanoAluno } from '../../components/Planos';

/**
 * O professor também é praticante: ganha uma matrícula de aluno (mesmo e-mail Google)
 * para escolher modalidades/pacote/família e pagar a mensalidade como qualquer aluno.
 */
export default function ProfMeuPlano({ user }) {
  const db = useDB();
  const email = (user.email || '').toLowerCase();
  const pr = db.alunos.find((a) => (a.email || '').toLowerCase() === email);
  // Professores treinam como alunos da Sede
  const filialId = db.config.filialSede || 'fil1';
  const [plano, setPlano] = useState(pr?.plano || { tipo: 'modalidades', modalidades: [] });
  const [salvando, setSalvando] = useState(false);
  const [pagar, setPagar] = useState(null);
  useEffect(() => {
    if (pr?.plano) setPlano(pr.plano);
  }, [pr?.id]);

  const filial = db.filiais.find((f) => f.id === (pr?.filialId || filialId));


  const ativar = async () => {
    if (!filial) return toast('Filial Sede não encontrada. Fale com a Central.');
    const erro = validarPlano(filial, plano);
    if (erro) return toast(erro);
    setSalvando(true);
    try {
      // Criada no servidor já aprovada na Sede (professor de outra filial não pode aprovar aluno de lá)
      const dados = {
        matricula: 'MQ' + Date.now().toString(36).toUpperCase().slice(-6),
        nome: user.nome, telefone: user.telefone || '', foto: user.foto || null, rg: user.rg || '', cpf: user.cpf || '', nascimento: user.nascimento || '', responsavel: '',
        saude: { tipoSanguineo: '', alergias: '', lesoes: '', restricoes: '', medicamentos: '', emergenciaNome: '', emergenciaTel: '' },
        tecnico: [], termos: null, atleta: { ativo: false, polo: '', termoAceito: null }, preExame: null, inscritoExame: false, historicoGraduacao: [],
        qrToken: uid('q'), criadoEm: new Date().toISOString(),
        ...(temPlanos(filial) ? { plano: { ...plano, atualizadoEm: new Date().toISOString() } } : {}),
      };
      const { data: id, error } = await supabase.rpc('mq_matricula_praticante', { p_dados: dados });
      if (error) throw error;
      if (plano.tipo === 'familia' && temPlanos(filial)) await supabase.rpc('mq_aplicar_familia', { p_titular: id });
      await recarregar();
      toast('Matrícula de praticante ativada na Sede.');
    } catch (e) {
      toast('Não foi possível ativar: ' + e.message);
    } finally {
      setSalvando(false);
    }
  };

  const salvar = async () => {
    const erro = validarPlano(filial, plano);
    if (erro) return toast(erro);
    setSalvando(true);
    try {
      await salvarPlanoAluno(pr.id, plano);
      toast('Plano salvo.');
    } catch (e) {
      toast('Não foi possível salvar: ' + e.message);
    } finally {
      setSalvando(false);
    }
  };

  if (!pr)
    return (
      <>
        <PageHead title="Meu Plano" sub="Como praticante: suas modalidades, pacote ou plano família" />
        <Card title="🥋 Ativar minha matrícula de praticante">
          <p className="small" style={{ marginTop: 0 }}>
            Além de professor, você também é praticante: seus treinos são como aluno da <b>{filial?.nome || 'Sede'}</b>. Escolha o plano abaixo. A matrícula usa o mesmo e-mail Google e a sua graduação atual, já sai aprovada, e a mensalidade entra na cobrança mensal como a de qualquer aluno.
          </p>
          {filial && <EscolhaPlano filial={filial} value={plano} onChange={setPlano} />}
          <button className="btn mt" disabled={salvando || !filial} onClick={ativar}>{salvando ? 'Ativando…' : 'Ativar matrícula de praticante'}</button>
        </Card>
      </>
    );


  return (
    <>
      <PageHead title="Meu Plano" sub={`Praticante · ${filialNome(db, pr.filialId)} · matrícula ${pr.matricula || '—'}`} />
      {pr.status === 'pendente' && <div className="alert gold mb">⏳ Sua matrícula de praticante aguarda aprovação do professor de {filialNome(db, pr.filialId)}.</div>}
      {pr.isentoPor ? (
        <div className="alert ok mb">👨‍👩‍👧 {pr.isentoMotivo || 'Plano família'} — você está isento(a) da mensalidade.</div>
      ) : pr.isento ? (
        <div className="alert gold mb">🎓 Você está isento(a) da mensalidade como praticante.</div>
      ) : null}

      {!pr.isentoPor && (
        <Card title="📋 Plano" className="mb">
          {pr.plano && temPlanos(filial) && (
            <div className="alert ink mb">Plano atual: <b>{resumoPlano(filial, pr.plano)}</b> · {brl(valorPlano(filial, pr.plano))}/mês</div>
          )}
          {filial && <EscolhaPlano filial={filial} value={plano} onChange={setPlano} />}
          {temPlanos(filial) && (
            <>
              <p className="xs muted">A alteração vale a partir da próxima mensalidade gerada.</p>
              <button className="btn" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar plano'}</button>
            </>
          )}
        </Card>
      )}

      <ExtratoPagamentos pagamentos={db.pagamentos.filter((p) => p.pessoaId === pr.id)} onPagar={setPagar} />

      <Modal open={!!pagar} onClose={() => setPagar(null)} title={pagar?.descricao}>
        {pagar && <PixBox valor={pagar.valor} descricao={pagar.descricao} txid={pagar.id} filialId={pagar.tipo === 'mensalidade' ? pagar.filialId : undefined} />}
      </Modal>
    </>
  );
}
