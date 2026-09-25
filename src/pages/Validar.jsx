import { useParams, Link } from 'react-router-dom';
import { useDB, situacaoAluno, professorEmDia } from '../lib/db';
import { b64d, fmtDate, todayISO } from '../lib/utils';
import { Avatar } from '../components/ui';

/** Página aberta ao escanear o QR Code da carteirinha digital */
export default function Validar() {
  const { payload } = useParams();
  const db = useDB();
  const d = b64d(payload || '');
  if (!d) return <Shell><h2>QR Code inválido</h2></Shell>;

  const aluno = db.alunos.find((a) => a.id === d.id);
  const prof = db.professores.find((p) => p.id === d.id);
  const pessoa = aluno || prof;
  let status = 'nao-verificado';
  if (aluno) status = aluno.status === 'aprovado' && !situacaoAluno(db, aluno).bloqueado ? 'ok' : 'irregular';
  else if (prof) status = prof.ativo && professorEmDia(prof) ? 'ok' : 'irregular';
  const vencida = d.v && d.v < todayISO();

  return (
    <Shell>
      <Avatar src={pessoa?.foto} name={d.n} size="xl" />
      <h2 style={{ margin: '12px 0 2px' }}>{d.n}</h2>
      <div className="badge ink">{d.t === 'professor' ? 'PROFESSOR FILIADO' : d.t === 'atleta' ? 'ATLETA DE COMPETIÇÃO' : 'ALUNO FILIADO'}</div>
      <div className="col mt" style={{ gap: 4 }}>
        <div><b>Graduação:</b> {d.f}</div>
        <div><b>Filial:</b> {d.fl}</div>
        <div><b>Matrícula:</b> {d.m}</div>
        <div><b>Validade:</b> {fmtDate(d.v)}</div>
      </div>
      <div className="mt" style={{ width: '100%' }}>
        {status === 'ok' && !vencida && <div className="alert ok" style={{ justifyContent: 'center' }}>✅ Filiado regular — acesso liberado</div>}
        {(status === 'irregular' || vencida) && <div className="alert red" style={{ justifyContent: 'center' }}>⛔ Situação irregular — procurar a secretaria</div>}
        {status === 'nao-verificado' && !vencida && (
          <div className="alert gold small">Credencial com assinatura válida. Para conferir a situação financeira em tempo real, abra este QR no aparelho da organização (logado como administrador ou professor).</div>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div style={{ minHeight: '100%', background: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="card pad-lg center" style={{ maxWidth: 420, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <img src="./logo.webp" alt="" style={{ width: 80 }} />
        <div className="brush" style={{ color: 'var(--red)', marginBottom: 12 }}>Validação de Carteirinha</div>
        {children}
        <Link to="/" className="btn link sm mt">Mao Quan Conecta</Link>
      </div>
    </div>
  );
}
