import { useRef, useState } from 'react';
import { useDB, setDB } from '../../lib/db';
import { readImage } from '../../lib/utils';
import { MODELOS_PADRAO } from '../../lib/seed';
import { PageHead, Card, Tabs, Field, toast, useConfirm } from '../../components/ui';
import { CardFrente, CardVerso, ExportButtons, dadosCarteirinha } from '../../components/Carteirinha';

const TIPOS = [['aluno', '🥋 Aluno'], ['professor', '👨‍🏫 Professor'], ['atleta', '🏆 Atleta de Competição']];

function UploadBtn({ label, onImage, max = 2000 }) {
  return (
    <label className="btn ghost sm">
      ⬆ {label}
      <input
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) onImage(await readImage(f, max, 0.92));
          e.target.value = '';
        }}
      />
    </label>
  );
}

export default function Carteirinhas() {
  const db = useDB();
  const [tipo, setTipo] = useState('aluno');
  const [sel, setSel] = useState('nome');
  const [pessoaId, setPessoaId] = useState('');
  const [ask, confirmEl] = useConfirm();
  const frenteRef = useRef(null);
  const versoRef = useRef(null);
  const modelo = db.modelos[tipo];

  const pessoas = tipo === 'professor' ? db.professores : db.alunos.filter((a) => a.status === 'aprovado' && (tipo === 'aluno' || a.atleta?.ativo));
  const pessoa = pessoas.find((p) => p.id === pessoaId) || pessoas[0];
  const exemplo = { id: 'exemplo', nome: 'Nome do Praticante', rg: '12.345.678-9', cpf: '123.456.789-00', nascimento: '2000-01-01', faixaIdx: 1, filialId: 'fil1', matricula: 'MQ0000', foto: null, qrToken: 'x', filiacaoValidaAte: `${new Date().getFullYear()}-12-31` };
  const dados = dadosCarteirinha(db, pessoa || exemplo, tipo);

  const upd = (fn) => setDB((d) => void fn(d.modelos[tipo]));
  const campo = modelo.fields.find((f) => f.key === sel);
  const updCampo = (patch) => upd((m) => Object.assign(m.fields.find((f) => f.key === sel), patch));
  const ehImagem = campo && ['foto', 'qr'].includes(campo.key);

  return (
    <>
      <PageHead title="Carteirinhas & Carteira Digital" sub="Modelo oficial “Identidade do Praticante” — frente e verso" />
      <Tabs tabs={TIPOS} value={tipo} onChange={(t) => (setTipo(t), setPessoaId(''))} />

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))' }}>
        <Card title="Pré-visualização" actions={<span className="xs muted">Arraste os campos da frente para reposicionar</span>}>
          <div className="col" style={{ alignItems: 'center' }}>
            <div className="idc-flip">
              <div className="xs muted mb">FRENTE</div>
              <CardFrente
                modelo={modelo}
                dados={dados}
                editing
                sel={sel}
                onSel={setSel}
                cardRef={frenteRef}
                onMove={(key, x, y) => upd((m) => Object.assign(m.fields.find((f) => f.key === key), { x, y }))}
              />
              <div className="xs muted mb mt">VERSO</div>
              <CardVerso modelo={modelo} cardRef={versoRef} />
            </div>
          </div>
          <div className="col mt">
            <Field label="Preencher automaticamente com os dados de">
              <select value={pessoa?.id || ''} onChange={(e) => setPessoaId(e.target.value)}>
                {pessoas.length === 0 && <option value="">(exemplo)</option>}
                {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </Field>
            <ExportButtons getNodes={() => [frenteRef.current, versoRef.current]} nome={`carteirinha-${tipo}-${dados.nome}`} />
            <p className="xs muted center" style={{ margin: 0 }}>PDF com 2 páginas (frente e verso) · JPG/PNG geram dois arquivos · impressão em A4 com linha de corte.</p>
          </div>
        </Card>

        <Card title="Personalização do modelo">
          <div className="col">
            <div className="form-grid">
              <Field label="Cor da faixa lateral">
                <input type="color" value={modelo.cor} onChange={(e) => upd((m) => (m.cor = e.target.value))} />
              </Field>
              <Field label="Cor do texto vertical">
                <input type="color" value={modelo.corRotulo} onChange={(e) => upd((m) => (m.corRotulo = e.target.value))} />
              </Field>
              <Field label="Texto vertical">
                <input value={modelo.rotulo} onChange={(e) => upd((m) => (m.rotulo = e.target.value))} />
              </Field>
              <Field label="Ideograma + pinyin">
                <div className="row" style={{ flexWrap: 'nowrap' }}>
                  <input value={modelo.hanzi} onChange={(e) => upd((m) => (m.hanzi = e.target.value))} style={{ width: 90 }} />
                  <input value={modelo.pinyin} onChange={(e) => upd((m) => (m.pinyin = e.target.value))} />
                </div>
              </Field>
            </div>
            <Field label="Graduação impressa na carteirinha">
              <select value={modelo.graduacao || (tipo === 'professor' ? 'nivel' : 'faixa')} onChange={(e) => upd((m) => (m.graduacao = e.target.value))}>
                <option value="faixa">Faixa (ex.: Amarela Ponta Verde)</option>
                <option value="nivel">Nível (ex.: Intermediária{tipo === 'professor' ? ' / Professor' : ''})</option>
                <option value="ambos">Nível · Faixa</option>
              </select>
            </Field>
            <label className="check"><input type="checkbox" checked={modelo.mostrarPunho} onChange={(e) => upd((m) => (m.mostrarPunho = e.target.checked))} /> Exibir o símbolo do punho</label>

            <Field label="Frente personalizada (opcional)" hint="Substitui o fundo oficial; os campos continuam preenchidos automaticamente. Proporção 1000 × 652 px.">
              <div className="row">
                <UploadBtn label="Enviar fundo da frente" onImage={(url) => (upd((m) => (m.frente = url)), toast('Fundo da frente aplicado.'))} />
                {modelo.frente && <button className="btn sm ghost" onClick={() => upd((m) => (m.frente = null))}>Usar frente oficial</button>}
              </div>
            </Field>
            <Field label="Verso" hint="Por padrão usa o verso oficial (Grão Mestre, Mestre, CNPJ, federações).">
              <div className="row">
                <UploadBtn label="Enviar novo verso" onImage={(url) => (upd((m) => (m.verso = url)), toast('Verso atualizado.'))} />
                <button className="btn sm ghost" onClick={() => upd((m) => (m.verso = MODELOS_PADRAO()[tipo].verso))}>Verso oficial</button>
              </div>
            </Field>

            <div className="xs muted" style={{ fontWeight: 600 }}>CAMPOS DA FRENTE</div>
            <div className="tabs" style={{ flexWrap: 'wrap', margin: 0 }}>
              {modelo.fields.map((f) => (
                <button key={f.key} className={sel === f.key ? 'on' : ''} onClick={() => setSel(f.key)}>
                  {f.visible ? '' : '🚫 '}{f.label}
                </button>
              ))}
            </div>

            {campo && (
              <div className="card" style={{ background: '#faf8f6' }}>
                <div className="form-grid">
                  {!ehImagem && (
                    <Field label="Rótulo">
                      <input value={campo.label} onChange={(e) => updCampo({ label: e.target.value })} />
                    </Field>
                  )}
                  <Field label={`Posição X: ${campo.x}%`}>
                    <input type="range" min="0" max="98" step="0.2" value={campo.x} onChange={(e) => updCampo({ x: +e.target.value })} />
                  </Field>
                  <Field label={`Posição Y: ${campo.y}%`}>
                    <input type="range" min="0" max="98" step="0.2" value={campo.y} onChange={(e) => updCampo({ y: +e.target.value })} />
                  </Field>
                  <Field label={`Tamanho: ${campo.size}`}>
                    <input type="range" min="1.2" max={ehImagem ? 40 : 6} step="0.1" value={campo.size} onChange={(e) => updCampo({ size: +e.target.value })} />
                  </Field>
                </div>
                <label className="check mt"><input type="checkbox" checked={campo.visible} onChange={(e) => updCampo({ visible: e.target.checked })} /> Visível</label>
              </div>
            )}

            <div className="row">
              <button className="btn sm ghost" onClick={() => ask(`Restaurar o modelo oficial de ${tipo}? As personalizações serão perdidas.`, () => upd((m) => Object.assign(m, MODELOS_PADRAO()[tipo])), 'Restaurar')}>↺ Restaurar modelo oficial</button>
            </div>
            <div className="alert ink small">
              🔐 <div>O QR Code de validação fica sempre na <b>Carteira Digital</b> do app. Na carteirinha impressa ele é opcional — ative o campo “QR Code” para posicioná-lo (ex.: no lugar do símbolo do punho).</div>
            </div>
          </div>
        </Card>
      </div>
      {confirmEl}
    </>
  );
}
