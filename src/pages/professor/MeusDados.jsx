import { useState } from 'react';
import { useDB, setDB, setSession, filialNome, notify } from '../../lib/db';
import { PageHead, Card, toast } from '../../components/ui';
import { CamposDadosPessoais, alteracoesImportantes, validarDados, enderecoVazio } from '../../components/DadosPessoais';
import { MinhaChavePix } from '../../components/ChavePix';

const CAMPOS = ['nome', 'foto', 'telefone', 'nascimento', 'rg', 'cpf', 'endereco'];

export default function ProfMeusDados({ user }) {
  const db = useDB();
  const eu = db.professores.find((p) => p.id === user.id) || user;
  const [f, setF] = useState(() => ({
    nome: eu.nome || '', foto: eu.foto, telefone: eu.telefone || '', nascimento: eu.nascimento || '', rg: eu.rg || '', cpf: eu.cpf || '',
    endereco: { ...enderecoVazio(), ...(eu.endereco || {}) },
  }));

  const salvar = () => {
    const erro = validarDados(f);
    if (erro) return toast(erro);
    const dados = { ...f, nome: f.nome.trim().replace(/\s+/g, ' ') };
    const mudou = alteracoesImportantes(eu, dados);
    const email = (eu.email || '').toLowerCase();
    setDB((d) => {
      Object.assign(d.professores.find((p) => p.id === eu.id), dados);
      // Mesma pessoa como praticante (matrícula de aluno com o mesmo e-mail): mantém os dados iguais
      const pr = d.alunos.find((a) => (a.email || '').toLowerCase() === email);
      if (pr) CAMPOS.forEach((k) => (pr[k] = dados[k]));
      if (mudou.length) notify(d, 'admin', 'Professor atualizou o cadastro', `${dados.nome} (${filialNome(d, eu.filialId)}) atualizou: ${mudou.join(', ')}.`);
    });
    toast('Dados atualizados.');
  };

  return (
    <>
      <PageHead title="Meus Dados" sub={`${eu.titulo || 'Laoshi'} · ${filialNome(db, eu.filialId)}`}>
        <button className="btn ghost" onClick={() => setSession(null)}>Sair</button>
        <button className="btn" onClick={salvar}>Salvar</button>
      </PageHead>
      <div className="grid g2">
        <Card title="📝 Dados cadastrais">
          <CamposDadosPessoais f={f} setF={setF} email={eu.email} />
          <p className="xs muted">Título, graduação, filial e recursos do painel são definidos pela Central.</p>
          <button className="btn" onClick={salvar}>Salvar alterações</button>
        </Card>
        <MinhaChavePix user={user} />
      </div>
    </>
  );
}
