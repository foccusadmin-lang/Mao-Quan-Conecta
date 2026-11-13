// Justificativa de falta: o aluno explica a falta; o professor da filial ou o ADM aceita (abona) ou recusa.
// Falta abonada sai da conta de frequência (ajuda na liberação do exame de graduação).
import { useState } from 'react';
import { useDB, aplicarDoServidor, frequencia, filialNome, DIAS_SEMANA, diaDaData } from '../lib/db';
import { supabase } from '../lib/supabase';
import { fmtDate } from '../lib/utils';
import { Card, Empty, toast } from './ui';

const STATUS = {
  pendente: ['gold', '⏳ Em análise'],
  aceita: ['ok', '✅ Abonada'],
  recusada: ['red', '✗ Não aceita'],
};
const diaSemana = (iso) => DIAS_SEMANA.find(([d]) => d === diaDaData(iso))?.[1] || '';
const rotuloAula = (x) => [x.inicio && x.fim ? `${x.inicio}–${x.fim}` : '', x.aula || ''].filter(Boolean).join(' · ');

export function SeloJustificativa({ j }) {
  if (!j) return null;
  const [tom, txt] = STATUS[j.status] || STATUS.pendente;
  return <span className={`badge ${tom}`}>{txt}</span>;
}

/** Painel do aluno: lista das faltas (últimos 90 dias) com o campo para justificar cada uma */
export function MinhasFaltas({ user }) {
  const db = useDB();
  const aluno = db.alunos.find((a) => a.id === user.id) || user;
  const fr = frequencia(db, aluno);
  const [aberta, setAberta] = useState(null); // chave da falta em edição
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [todas, setTodas] = useState(false);
  const lista = fr.ausencias || [];
  const visiveis = todas ? lista : lista.slice(0, 8);
  const pendentes = lista.filter((x) => x.justificativa?.status === 'pendente').length;

  const enviar = async (x) => {
    if (texto.trim().length < 5) return toast('Escreva o motivo da falta.');
    setEnviando(true);
    const { data, error } = await supabase.rpc('mq_justificar_falta', {
      p_chave: x.chave, p_data: x.data, p_horario: x.horario, p_filial: x.filialId || aluno.filialId, p_texto: texto.trim(),
    });
    setEnviando(false);
    if (error) return toast('Não foi possível enviar: ' + error.message);
    aplicarDoServidor('alunos', aluno.id, data);
    setAberta(null);
    setTexto('');
    toast('Justificativa enviada! O professor vai analisar.');
  };

  return (
    <Card title={`📝 Minhas faltas (${fr.faltas})`}>
      <p className="small muted" style={{ marginTop: 0 }}>
        Faltou por um motivo justo (saúde, trabalho, escola, viagem…)? Justifique aqui. Se o professor aceitar, a falta é <b>abonada</b> e deixa de contar
        na sua frequência para o exame de graduação.
        {fr.abonadas ? <> Você já tem <b>{fr.abonadas}</b> falta{fr.abonadas === 1 ? '' : 's'} abonada{fr.abonadas === 1 ? '' : 's'}.</> : null}
        {pendentes ? <> <b>{pendentes}</b> em análise.</> : null}
      </p>
      {lista.length === 0 && <Empty icon="💪">Nenhuma falta nos últimos 90 dias.</Empty>}
      {visiveis.map((x) => {
        const j = x.justificativa;
        const podeEditar = !j || j.status !== 'aceita';
        return (
          <div key={x.chave} className="list-item" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 6 }}>
            <div className="row" style={{ width: '100%', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{fmtDate(x.data)} <span className="xs muted">· {diaSemana(x.data)}</span></div>
                <div className="xs muted">
                  {[rotuloAula(x), x.filialId && (aluno.filiaisExtras?.length ? filialNome(db, x.filialId) : ''), x.lancada ? 'falta lançada na chamada' : ''].filter(Boolean).join(' · ')}
                </div>
              </div>
              <SeloJustificativa j={j} />
            </div>
            {j && aberta !== x.chave && (
              <div className="small" style={{ width: '100%' }}>
                <i>“{j.texto}”</i>
                {j.status !== 'pendente' && j.por && <div className="xs muted">Analisada por {j.por}{j.obs ? ` — ${j.obs}` : ''}</div>}
              </div>
            )}
            {aberta === x.chave ? (
              <div className="col" style={{ width: '100%', gap: 6 }}>
                <textarea rows={3} maxLength={600} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ex.: estava com febre; consulta médica; prova na escola; viagem de trabalho…" autoFocus />
                <div className="row" style={{ gap: 6 }}>
                  <button type="button" className="btn sm" disabled={enviando} onClick={() => enviar(x)}>{enviando ? 'Enviando…' : 'Enviar justificativa'}</button>
                  <button type="button" className="btn sm ghost" onClick={() => setAberta(null)}>Cancelar</button>
                </div>
              </div>
            ) : (
              podeEditar && (
                <button type="button" className="btn sm ghost" onClick={() => (setAberta(x.chave), setTexto(j?.texto || ''))}>
                  {!j ? '✍️ Justificar falta' : j.status === 'recusada' ? '↻ Enviar nova justificativa' : '✏️ Editar justificativa'}
                </button>
              )
            )}
          </div>
        );
      })}
      {lista.length > visiveis.length && <button type="button" className="btn sm ghost mt" onClick={() => setTodas(true)}>Ver todas as {lista.length} faltas</button>}
    </Card>
  );
}

/** Professor / ADM: justificativas enviadas pelos alunos (aceitar abona a falta) */
export function JustificativasEquipe({ alunos }) {
  const db = useDB();
  const [obs, setObs] = useState({});
  const [ocupado, setOcupado] = useState('');
  const [verAnalisadas, setVerAnalisadas] = useState(false);
  const itens = alunos
    .flatMap((a) => (a.justificativas || []).map((j) => ({ a, j })))
    .sort((x, y) => (y.j.em || '').localeCompare(x.j.em || ''));
  const pendentes = itens.filter((x) => x.j.status === 'pendente');
  const analisadas = itens.filter((x) => x.j.status !== 'pendente').slice(0, 30);

  const avaliar = async (a, j, status) => {
    setOcupado(j.id);
    const { data, error } = await supabase.rpc('mq_avaliar_justificativa', { p_aluno: a.id, p_id: j.id, p_status: status, p_obs: obs[j.id] || null });
    setOcupado('');
    if (error) return toast('Não foi possível salvar: ' + error.message);
    aplicarDoServidor('alunos', a.id, data);
    toast(status === 'aceita' ? `Falta de ${a.nome.split(' ')[0]} abonada.` : status === 'recusada' ? 'Justificativa recusada.' : 'Voltou para análise.');
  };

  const Linha = ({ a, j }) => (
    <div className="list-item" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 6 }}>
      <div className="row" style={{ width: '100%', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
        <div className="grow">
          <div style={{ fontWeight: 600 }}>{a.nome}</div>
          <div className="xs muted">
            Falta de {fmtDate(j.data)} ({diaSemana(j.data)}){j.filialId ? ` · ${filialNome(db, j.filialId)}` : ''} · enviada em {fmtDate(j.em)}
          </div>
        </div>
        <SeloJustificativa j={j} />
      </div>
      <div className="small" style={{ width: '100%' }}><i>“{j.texto}”</i></div>
      {j.status === 'pendente' ? (
        <div className="row" style={{ gap: 6, width: '100%' }}>
          <input style={{ flex: '1 1 200px' }} placeholder="Observação para o aluno (opcional)" value={obs[j.id] || ''} onChange={(e) => setObs({ ...obs, [j.id]: e.target.value })} />
          <button type="button" className="btn sm ok" disabled={ocupado === j.id} onClick={() => avaliar(a, j, 'aceita')}>✅ Aceitar (abonar)</button>
          <button type="button" className="btn sm ghost" disabled={ocupado === j.id} onClick={() => avaliar(a, j, 'recusada')}>✗ Recusar</button>
        </div>
      ) : (
        <div className="row" style={{ gap: 6 }}>
          <span className="xs muted">Por {j.por || '—'}{j.analisadoEm ? ` em ${fmtDate(j.analisadoEm)}` : ''}{j.obs ? ` — ${j.obs}` : ''}</span>
          <button type="button" className="btn link sm" disabled={ocupado === j.id} onClick={() => avaliar(a, j, 'pendente')}>Desfazer</button>
        </div>
      )}
    </div>
  );

  return (
    <Card title={`📝 Justificativas de falta (${pendentes.length} para analisar)`}>
      <p className="small muted" style={{ marginTop: 0 }}>Ao aceitar, a falta é abonada: deixa de contar na frequência do aluno (e no limite de faltas do pré-exame).</p>
      {pendentes.length === 0 && <Empty icon="✅">Nenhuma justificativa aguardando análise.</Empty>}
      {pendentes.map((x) => <Linha key={x.a.id + x.j.id} {...x} />)}
      {analisadas.length > 0 && (
        <div className="mt">
          <button type="button" className="btn sm ghost" onClick={() => setVerAnalisadas(!verAnalisadas)}>{verAnalisadas ? 'Ocultar' : 'Ver'} analisadas ({analisadas.length})</button>
          {verAnalisadas && analisadas.map((x) => <Linha key={x.a.id + x.j.id} {...x} />)}
        </div>
      )}
    </Card>
  );
}
