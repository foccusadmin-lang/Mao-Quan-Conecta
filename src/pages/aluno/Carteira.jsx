import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useDB, situacaoAluno } from '../../lib/db';
import { PageHead, Card, Faixa } from '../../components/ui';
import { useQR } from '../../components/shared';
import { Carteirinha, ExportButtons, dadosCarteirinha } from '../../components/Carteirinha';

function CartaoTipo({ db, user, tipo, titulo, liberado, motivo }) {
  const frente = useRef(null);
  const verso = useRef(null);
  return (
    <Card title={titulo}>
      <Carteirinha modelo={db.modelos[tipo]} dados={dadosCarteirinha(db, user, tipo)} frenteRef={frente} versoRef={verso} />
      <div className="mt"><ExportButtons getNodes={() => [frente.current, verso.current]} nome={`${tipo}-${user.nome}`} liberado={liberado} motivo={motivo} /></div>
      {!liberado && <div className="alert red mt small">🔒 {motivo}</div>}
    </Card>
  );
}

export default function AlunoCarteira({ user }) {
  const db = useDB();
  const dados = dadosCarteirinha(db, user, 'aluno');
  const qr = useQR(dados.qrText);
  const fin = situacaoAluno(db, user);
  // Download liberado somente com pagamento confirmado (ou isenção) e sem inadimplência
  const temPago = db.pagamentos.some((p) => p.pessoaId === user.id && p.status === 'pago');
  const liberado = !fin.bloqueado && (temPago || user.isento);
  const motivo = 'Download liberado após a confirmação do pagamento.';
  const faltaDados = !user.rg || !user.cpf || !user.nascimento || !user.foto;

  return (
    <>
      <PageHead title="Carteira Digital" sub="Apresente o QR Code em eventos, exames e campeonatos da Liga" />
      <div className="grid g2">
        <div className="wallet">
          <div className="brush" style={{ fontSize: 22 }}>MAO QUAN <span style={{ color: 'var(--red)' }}>CONECTA</span></div>
          <div className="qrbox">{qr && <img src={qr} alt="QR Code de identificação" />}</div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{user.nome}</div>
          <div className="row" style={{ justifyContent: 'center', marginTop: 6 }}>
            <span className="badge" style={{ background: '#fff' }}><Faixa idx={user.faixaIdx} /></span>
            <span className="badge ink">{user.matricula}</span>
          </div>
          <div className="mt">{fin.bloqueado ? <span className="badge red">Situação irregular</span> : <span className="badge ok">Filiado regular</span>}</div>
        </div>

        <CartaoTipo db={db} user={user} tipo="aluno" titulo="🪪 Identidade do Praticante" liberado={liberado} motivo={motivo} />
        {user.atleta?.ativo && <CartaoTipo db={db} user={user} tipo="atleta" titulo="🏆 Atleta de Competição" liberado={liberado} motivo={motivo} />}
      </div>
      {faltaDados && (
        <Link to="/aluno/perfil" className="alert gold mt" style={{ textDecoration: 'none' }}>
          ℹ️ <div className="grow">Complete foto, RG, CPF e data de nascimento no seu perfil para que a carteirinha saia completa.</div> →
        </Link>
      )}
    </>
  );
}
