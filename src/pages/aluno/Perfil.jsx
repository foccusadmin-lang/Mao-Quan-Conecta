import { useState } from 'react';
import { useDB, setDB, setSession, filialNome } from '../../lib/db';
import { fmtDate, maskCPF, maskRG } from '../../lib/utils';
import { PageHead, Card, Field, Inp, PhotoInput, toast } from '../../components/ui';

export default function Perfil({ user }) {
  const db = useDB();
  const [f, setF] = useState(() => ({ foto: user.foto, telefone: user.telefone, nascimento: user.nascimento, rg: user.rg || '', cpf: user.cpf || '', responsavel: user.responsavel, saude: { ...user.saude } }));
  const salvar = () => {
    setDB((d) => Object.assign(d.alunos.find((a) => a.id === user.id), f));
    toast('Perfil atualizado.');
  };
  return (
    <>
      <PageHead title="Meu Perfil" sub={`${user.email} · ${filialNome(db, user.filialId)} · Matrícula ${user.matricula}`}>
        <button className="btn ghost" onClick={() => setSession(null)}>Sair</button>
        <button className="btn" onClick={salvar}>Salvar</button>
      </PageHead>
      <div className="grid g2">
        <Card title="Dados pessoais">
          <div className="col">
            <PhotoInput value={f.foto} name={user.nome} onChange={(v) => setF({ ...f, foto: v })} />
            <div className="form-grid">
              <Field label="WhatsApp"><Inp obj={f} set={setF} k="telefone" type="tel" /></Field>
              <Field label="Nascimento"><Inp obj={f} set={setF} k="nascimento" type="date" /></Field>
              <Field label="RG"><input value={f.rg} onChange={(e) => setF({ ...f, rg: maskRG(e.target.value) })} placeholder="00.000.000-0" /></Field>
              <Field label="CPF"><input value={f.cpf} inputMode="numeric" onChange={(e) => setF({ ...f, cpf: maskCPF(e.target.value) })} placeholder="000.000.000-00" /></Field>
              <Field label="Responsável"><Inp obj={f} set={setF} k="responsavel" /></Field>
            </div>
            <div className="xs muted">Termos assinados em {fmtDate(user.termos?.data)} como “{user.termos?.assinatura}”.</div>
          </div>
        </Card>
        <Card title="⚕️ Ficha de saúde">
          <div className="form-grid">
            <Field label="Tipo sanguíneo"><Inp obj={f} set={setF} k="saude.tipoSanguineo" /></Field>
            <Field label="Medicamentos"><Inp obj={f} set={setF} k="saude.medicamentos" /></Field>
            <Field label="Alergias"><Inp obj={f} set={setF} k="saude.alergias" /></Field>
            <Field label="Lesões anteriores"><Inp obj={f} set={setF} k="saude.lesoes" /></Field>
            <Field label="Restrições médicas" style={{ gridColumn: '1/-1' }}><Inp obj={f} set={setF} k="saude.restricoes" type="textarea" /></Field>
            <Field label="Contato de emergência"><Inp obj={f} set={setF} k="saude.emergenciaNome" /></Field>
            <Field label="Telefone de emergência"><Inp obj={f} set={setF} k="saude.emergenciaTel" type="tel" /></Field>
          </div>
        </Card>
      </div>
    </>
  );
}
