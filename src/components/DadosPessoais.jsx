import { useRef, useState } from 'react';
import { maskCPF, maskRG, maskTelefone } from '../lib/utils';
import { Field, Inp, PhotoInput } from './ui';

export const maskCEP = (v = '') => v.replace(/\D/g, '').slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2');
export const enderecoVazio = () => ({ cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '' });

const ROTULOS = { nome: 'nome', rg: 'RG', cpf: 'CPF', nascimento: 'nascimento', telefone: 'WhatsApp' };

/** Campos que a Central quer saber quando mudam (identidade) */
export function alteracoesImportantes(antes, depois) {
  return Object.keys(ROTULOS).filter((k) => (antes?.[k] || '') !== (depois?.[k] || '')).map((k) => ROTULOS[k]);
}

/** Validação básica antes de salvar; retorna mensagem ou '' */
export function validarDados(f) {
  if (!f.nome?.trim() || f.nome.trim().split(/\s+/).length < 2) return 'Informe o nome completo (nome e sobrenome).';
  if (f.cpf && f.cpf.replace(/\D/g, '').length !== 11) return 'CPF incompleto.';
  if (f.telefone && f.telefone.replace(/\D/g, '').length < 10) return 'WhatsApp incompleto (DDD + número).';
  if (f.endereco?.cep && f.endereco.cep.replace(/\D/g, '').length !== 8) return 'CEP incompleto.';
  return '';
}

/** Nome, foto, contatos, documentos e endereço */
/** Consulta o CEP no ViaCEP (serviço público). Retorna { logradouro, bairro, cidade, uf, complemento } ou null */
export async function buscarCEP(cep) {
  const d = cep.replace(/\D/g, '');
  if (d.length !== 8) return null;
  const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
  if (!r.ok) throw new Error('Serviço de CEP indisponível');
  const j = await r.json();
  if (j.erro) return null;
  return { logradouro: j.logradouro || '', bairro: j.bairro || '', cidade: j.localidade || '', uf: j.uf || '', complemento: j.complemento || '' };
}

export function CamposDadosPessoais({ f, setF, email }) {
  const end = f.endereco || enderecoVazio();
  const mudaEnd = (patch) => setF((atual) => ({ ...atual, endereco: { ...(atual.endereco || enderecoVazio()), ...patch } }));
  const numeroRef = useRef(null);
  const [cepStatus, setCepStatus] = useState(''); // '' | buscando | ok | nao | erro

  const mudaCEP = async (valor) => {
    const cep = maskCEP(valor);
    mudaEnd({ cep });
    if (cep.replace(/\D/g, '').length !== 8) return setCepStatus('');
    setCepStatus('buscando');
    try {
      const achado = await buscarCEP(cep);
      if (!achado) return setCepStatus('nao');
      // Preenche rua, bairro, cidade e UF; número e complemento ficam para o usuário
      setF((atual) => {
        const e = atual.endereco || enderecoVazio();
        if (e.cep !== cep) return atual; // CEP mudou enquanto buscava
        return { ...atual, endereco: { ...e, logradouro: achado.logradouro, bairro: achado.bairro, cidade: achado.cidade, uf: achado.uf, complemento: e.complemento } };
      });
      setCepStatus('ok');
      setTimeout(() => numeroRef.current?.focus(), 50);
    } catch {
      setCepStatus('erro');
    }
  };

  const dicaCEP = { buscando: '🔎 Buscando endereço…', ok: '✅ Endereço preenchido — informe o número', nao: 'CEP não encontrado. Preencha o endereço manualmente.', erro: 'Não foi possível consultar o CEP agora. Preencha manualmente.' }[cepStatus];
  return (
    <div className="col">
      <PhotoInput value={f.foto} name={f.nome} onChange={(v) => setF({ ...f, foto: v })} />
      <div className="form-grid">
        <Field label="Nome completo" style={{ gridColumn: '1/-1' }} hint="Aparece na carteirinha, nos certificados e nas listas"><Inp obj={f} set={setF} k="nome" /></Field>
        <Field label="E-mail (login Google)" hint="Para trocar o e-mail de acesso, fale com a Central"><input value={email || ''} disabled /></Field>
        <Field label="WhatsApp"><Inp obj={f} set={setF} k="telefone" type="tel" mask={maskTelefone} placeholder="(11) 90000-0000" /></Field>
        <Field label="Data de nascimento"><Inp obj={f} set={setF} k="nascimento" type="date" /></Field>
        <Field label="RG"><input value={maskRG(f.rg || '')} onChange={(e) => setF({ ...f, rg: maskRG(e.target.value) })} placeholder="00.000.000-0" maxLength={12} /></Field>
        <Field label="CPF"><input value={maskCPF(f.cpf || '')} inputMode="numeric" onChange={(e) => setF({ ...f, cpf: maskCPF(e.target.value) })} placeholder="000.000.000-00" maxLength={14} /></Field>
      </div>
      <b className="small" style={{ marginTop: 6 }}>🏠 Endereço</b>
      <div className="form-grid">
        <Field label="CEP" hint={dicaCEP}><input value={end.cep} inputMode="numeric" onChange={(e) => mudaCEP(e.target.value)} placeholder="00000-000" maxLength={9} /></Field>
        <Field label="Rua / Avenida"><input value={end.logradouro} onChange={(e) => mudaEnd({ logradouro: e.target.value })} /></Field>
        <Field label="Número"><input ref={numeroRef} value={end.numero} onChange={(e) => mudaEnd({ numero: e.target.value })} placeholder="Nº da casa" /></Field>
        <Field label="Complemento"><input value={end.complemento} onChange={(e) => mudaEnd({ complemento: e.target.value })} /></Field>
        <Field label="Bairro"><input value={end.bairro} onChange={(e) => mudaEnd({ bairro: e.target.value })} /></Field>
        <Field label="Cidade"><input value={end.cidade} onChange={(e) => mudaEnd({ cidade: e.target.value })} /></Field>
        <Field label="UF"><input value={end.uf} onChange={(e) => mudaEnd({ uf: e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2) })} placeholder="SP" maxLength={2} /></Field>
      </div>
    </div>
  );
}
