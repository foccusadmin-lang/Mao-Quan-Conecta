import { useState } from 'react';
import { useDB, setDB, setSession, filialNome, notify } from '../../lib/db';
import { fmtDate, maskTelefone } from '../../lib/utils';
import { PageHead, Card, Field, Inp, toast } from '../../components/ui';
import { CamposDadosPessoais, alteracoesImportantes, validarDados, enderecoVazio } from '../../components/DadosPessoais';

export default function Perfil({ user }) {
  const db = useDB();
  const [f, setF] = useState(() => ({
    nome: user.nome || '', foto: user.foto, telefone: user.telefone || '', nascimento: user.nascimento || '', rg: user.rg || '', cpf: user.cpf || '',
    endereco: { ...enderecoVazio(), ...(user.endereco || {}) }, responsavel: user.responsavel || '', saude: { ...user.saude },
  }));

  const salvar = () => {
    const erro = validarDados(f);
    if (erro) return toast(erro);
    const dados = { ...f, nome: f.nome.trim().replace(/\s+/g, ' ') };
    const mudou = alteracoesImportantes(user, dados);
    setDB((d) => {
      Object.assign(d.alunos.find((a) => a.id === user.id), dados);
      if (mudou.length) {
        const msg = `${dados.nome} atualizou: ${mudou.join(', ')}.`;
        notify(d, 'admin', 'Aluno atualizou o cadastro', msg);
        if (user.filialId) notify(d, 'filial:' + user.filialId, 'Aluno atualizou o cadastro', msg);
      }
    });
    toast('Dados atualizados.');
  };

  return (
    <>
      <PageHead title="Meus Dados" sub={`${filialNome(db, user.filialId)} · Matrícula ${user.matricula}`}>
        <button className="btn ghost" onClick={() => setSession(null)}>Sair</button>
        <button className="btn" onClick={salvar}>Salvar</button>
      </PageHead>
      <div className="grid g2">
        <Card title="📝 Dados cadastrais">
          <CamposDadosPessoais f={f} setF={setF} email={user.email} />
          <div className="form-grid mt">
            <Field label="Responsável (se menor de idade)" style={{ gridColumn: '1/-1' }}><Inp obj={f} set={setF} k="responsavel" /></Field>
          </div>
          {user.termos?.data && <div className="xs muted mt">Termos assinados em {fmtDate(user.termos.data)} como “{user.termos.assinatura}”.</div>}
        </Card>
        <Card title="⚕️ Ficha de saúde">
          <div className="form-grid">
            <Field label="Tipo sanguíneo"><Inp obj={f} set={setF} k="saude.tipoSanguineo" /></Field>
            <Field label="Medicamentos"><Inp obj={f} set={setF} k="saude.medicamentos" /></Field>
            <Field label="Alergias"><Inp obj={f} set={setF} k="saude.alergias" /></Field>
            <Field label="Lesões anteriores"><Inp obj={f} set={setF} k="saude.lesoes" /></Field>
            <Field label="Restrições médicas" style={{ gridColumn: '1/-1' }}><Inp obj={f} set={setF} k="saude.restricoes" type="textarea" /></Field>
            <Field label="Contato de emergência"><Inp obj={f} set={setF} k="saude.emergenciaNome" /></Field>
            <Field label="Telefone de emergência"><Inp obj={f} set={setF} k="saude.emergenciaTel" type="tel" mask={maskTelefone} placeholder="(11) 90000-0000" /></Field>
          </div>
        </Card>
      </div>
      <div className="mt"><button className="btn" onClick={salvar}>Salvar alterações</button></div>
    </>
  );
}
