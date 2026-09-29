import { useEffect, useState } from 'react';
import { useDB, setDB, ehResponsavel, responsaveisFilial } from '../lib/db';
import { TIPOS_PIX, maskChavePix, validarChavePix } from '../lib/utils';
import { Card, Field, toast } from './ui';

export const pixVazio = (nome = '') => ({ tipo: 'cpf', chave: '', titular: nome, cidade: '' });

/** Campos da chave PIX do professor (tipo, chave com máscara, titular e cidade) */
export function CamposChavePix({ pix, onChange }) {
  const v = pix || pixVazio();
  const muda = (p) => onChange({ ...v, ...p });
  return (
    <div className="form-grid">
      <Field label="Tipo de chave">
        <select value={v.tipo} onChange={(e) => muda({ tipo: e.target.value, chave: '' })}>
          {Object.entries(TIPOS_PIX).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
        </select>
      </Field>
      <Field label="Chave PIX">
        <input
          value={maskChavePix(v.tipo, v.chave)}
          onChange={(e) => muda({ chave: v.tipo === 'email' || v.tipo === 'aleatoria' ? e.target.value : maskChavePix(v.tipo, e.target.value) })}
          inputMode={v.tipo === 'cpf' || v.tipo === 'celular' ? 'numeric' : v.tipo === 'email' ? 'email' : 'text'}
          placeholder={{ cpf: '000.000.000-00', celular: '(11) 90000-0000', email: 'nome@email.com', aleatoria: '00000000-0000-0000-0000-000000000000' }[v.tipo]}
        />
      </Field>
      <Field label="Nome do titular da conta" hint="Como aparece no banco">
        <input value={v.titular} onChange={(e) => muda({ titular: e.target.value })} maxLength={60} />
      </Field>
      <Field label="Cidade do titular">
        <input value={v.cidade} onChange={(e) => muda({ cidade: e.target.value })} maxLength={40} placeholder="Barueri" />
      </Field>
    </div>
  );
}

/** Valida e devolve a chave pronta para salvar (null = sem chave); lança erro com a mensagem */
export function prepararPix(pix) {
  if (!pix || !pix.chave?.trim()) return null;
  const erro = validarChavePix(pix);
  if (erro) throw new Error(erro);
  return { tipo: pix.tipo, chave: maskChavePix(pix.tipo, pix.chave), titular: (pix.titular || '').trim(), cidade: (pix.cidade || '').trim() };
}

/** Cartão do painel do professor para cadastrar/alterar a própria chave PIX */
export function MinhaChavePix({ user }) {
  const db = useDB();
  const eu = db.professores.find((p) => p.id === user.id) || user;
  const [pix, setPix] = useState(eu.pix || pixVazio(eu.nome));
  useEffect(() => setPix(eu.pix || pixVazio(eu.nome)), [JSON.stringify(eu.pix || null)]);
  const filial = db.filiais.find((f) => f.id === eu.filialId);
  const responsavel = filial && ehResponsavel(filial, eu.id);
  const nResp = filial ? responsaveisFilial(filial).length : 0;

  const salvar = () => {
    let pronto;
    try {
      pronto = prepararPix(pix);
    } catch (e) {
      return toast(e.message);
    }
    setDB((d) => {
      const p = d.professores.find((x) => x.id === eu.id);
      if (pronto) p.pix = pronto;
      else delete p.pix;
    });
    toast(pronto ? 'Chave PIX salva.' : 'Chave PIX removida.');
  };

  return (
    <Card title="💸 Minha chave PIX para receber mensalidades">
      {responsavel ? (
        <p className="small" style={{ marginTop: 0 }}>
          As mensalidades dos alunos de <b>{filial.nome}</b> são pagas direto nesta chave{nResp > 1 ? <> — a filial tem <b>{nResp} professores responsáveis</b>, então o valor é dividido igualmente e cada um recebe a sua parte</> : ''}. <b>Sem chave cadastrada você fica fora da divisão</b> (o valor é dividido só entre quem tem chave; se ninguém tiver, vai para a Associação).
        </p>
      ) : (
        <div className="alert gold small mb">
          {filial && ehResponsavel(filial, eu.id)
            ? <>Você faz parte da equipe responsável por <b>{filial.nome}</b>, mas as mensalidades são creditadas ao responsável principal definido pela Central. Cadastre sua chave para o caso de a Central indicar você.</>
            : <>Você não é o professor responsável {filial ? <>por <b>{filial.nome}</b></> : 'por uma filial'}. As mensalidades só são creditadas ao responsável principal definido pela Central.</>}
        </div>
      )}
      <CamposChavePix pix={pix} onChange={setPix} />
      <div className="row mt">
        <button className="btn" onClick={salvar}>Salvar chave PIX</button>
        {eu.pix && <button className="btn ghost" onClick={() => setPix(pixVazio(eu.nome))}>Limpar</button>}
      </div>
    </Card>
  );
}
