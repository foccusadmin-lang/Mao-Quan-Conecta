import { useState } from 'react';
import { useDB, setDB, setSession, filialNome, notify } from '../../lib/db';
import { fmtDate, maskTelefone } from '../../lib/utils';
import { PageHead, Card, Field, Inp, toast } from '../../components/ui';
import { CamposDadosPessoais, alteracoesImportantes, validarDados, enderecoVazio } from '../../components/DadosPessoais';
import FiliaisTreino, { limparExtras } from '../../components/FiliaisTreino';
import { TurnosInput, textoTurnos } from '../../components/Turnos';

export default function Perfil({ user }) {
  const db = useDB();
  const [f, setF] = useState(() => ({
    nome: user.nome || '', foto: user.foto, telefone: user.telefone || '', nascimento: user.nascimento || '', rg: user.rg || '', cpf: user.cpf || '',
    endereco: { ...enderecoVazio(), ...(user.endereco || {}) }, responsavel: user.responsavel || '', saude: { ...user.saude },
    filiaisExtras: user.filiaisExtras || [],
    turnos: user.turnos || [],
  }));

  const salvar = () => {
    const erro = validarDados(f);
    if (erro) return toast(erro);
    const dados = { ...f, nome: f.nome.trim().replace(/\s+/g, ' ') };
    if ((f.foto || null) !== (user.foto || null)) dados.fotoDefinida = true; // não volta a ser a foto do Google
    const mudou = alteracoesImportantes(user, dados);
    const extras = limparExtras(user.filialId, f.filiaisExtras);
    const novasFiliais = extras.filter((x) => !(user.filiaisExtras || []).includes(x));
    if (extras.join() !== (user.filiaisExtras || []).join()) mudou.push('filiais de treino');
    if ((f.turnos || []).join() !== (user.turnos || []).join()) mudou.push(`horário de treino (${textoTurnos(f.turnos)})`);
    setDB((d) => {
      const x = d.alunos.find((a) => a.id === user.id);
      Object.assign(x, dados);
      if (f.turnos?.length) x.turnos = f.turnos;
      else delete x.turnos;
      if (extras.length) x.filiaisExtras = extras;
      else delete x.filiaisExtras;
      for (const fid of novasFiliais) notify(d, 'filial:' + fid, 'Aluno de outra filial treinando aqui', `${dados.nome} (${filialNome(d, user.filialId)}) também treina nesta filial e já aparece na sua chamada.`);
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
        <Card title="⏰ Horário de treino">
          <p className="small muted" style={{ marginTop: 0 }}>Marque em qual horário você treina (pode ser mais de um). Você aparece na chamada do professor somente nesses horários.</p>
          <TurnosInput value={f.turnos} onChange={(v) => setF({ ...f, turnos: v })} />
          {!f.turnos?.length && <div className="xs muted mt">Sem horário definido, seu nome aparece em todas as chamadas.</div>}
        </Card>
        <Card title="🏯 Filiais onde treino">
          <div className="small mb">Filial principal: <b>{filialNome(db, user.filialId)}</b></div>
          <FiliaisTreino principal={user.filialId} value={f.filiaisExtras} onChange={(v) => setF({ ...f, filiaisExtras: v })} />
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
