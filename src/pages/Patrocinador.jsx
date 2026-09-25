import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useDB } from '../lib/db';
import { b64d, copy, waLink } from '../lib/utils';
import { toast, Card } from '../components/ui';
import { WhatsFab, DiretoriaList } from '../components/shared';

export default function Patrocinador() {
  const { token } = useParams();
  const db = useDB();
  const c = db.config;
  const conv = token ? b64d(token) : null;
  const [sim, setSim] = useState({ indicados: 10, media: 5000 });
  const ganho = sim.indicados * sim.media * 0.05;

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100%' }}>
      <section className="sponsor-hero">
        <img src="./logo.webp" alt="Mao Quan Conecta" />
        <h1>
          Patrocine o <b>Kung Fu</b>
        </h1>
        <p style={{ maxWidth: 620, margin: '0 auto', opacity: 0.85 }}>
          Ambiente exclusivo para parceiros institucionais e comerciais da Associação Mao Quan Kung Fu Wushu.
          {conv?.de && (
            <>
              <br />
              <span className="badge gold" style={{ marginTop: 10 }}>Convite de {conv.de}</span>
            </>
          )}
        </p>
      </section>

      <div className="content" style={{ marginTop: -36 }}>
        <div className="grid g2">
          <Card className="pad-lg" title="🏆 Projeto de incentivo ao esporte">
            <p>
              Sua empresa apoia <b>atletas de competição, viagens para campeonatos e alunos em situação de vulnerabilidade</b> através do código de indicação oficial da Associação na Foccus Invest.
            </p>
            <div className="center mb">
              <div className="xs muted" style={{ marginBottom: 6 }}>CÓDIGO DE INDICAÇÃO</div>
              <span className="code-pill" style={{ background: 'var(--ink)', color: '#fff' }}>
                {c.codigoRef}
                <button className="btn sm" onClick={() => copy(c.codigoRef).then(() => toast('Código copiado!'))}>Copiar</button>
              </span>
            </div>
            <a className="btn block" href={c.investimentoLink} target="_blank" rel="noreferrer">Cadastrar com o código da Associação →</a>
          </Card>

          <Card className="pad-lg" title="🤝 Programa de Parceria Empresarial">
            <p>
              Colaboradores, familiares e amigos do patrocinador podem utilizar o <b>mesmo código de indicação</b>, garantindo ao patrocinador um ganho adicional de <b>5% sobre as aplicações indicadas</b> —
              uma receita institucional paralela à rentabilidade diária de mercado.
            </p>
            <div className="form-grid">
              <label className="field">
                Nº de indicados
                <input type="number" min="0" value={sim.indicados} onChange={(e) => setSim({ ...sim, indicados: +e.target.value })} />
              </label>
              <label className="field">
                Aplicação média (R$)
                <input type="number" min="0" value={sim.media} onChange={(e) => setSim({ ...sim, media: +e.target.value })} />
              </label>
            </div>
            <div className="alert gold mt">
              💡 Simulação ilustrativa de 5% sobre o volume indicado: <b>{ganho.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b>
            </div>
          </Card>

          <Card title="📅 Regras de resgate">
            <div className="list-item">📆 <div><b>Lucros:</b> liquidez toda sexta-feira.</div></div>
            <div className="list-item">🔒 <div><b>Capital principal:</b> carência de 90 dias do valor aplicado em operação. Após a carência, o resgate é processado em até 30 dias a partir da data de solicitação do saque.</div></div>
            <p className="xs muted" style={{ marginBottom: 0 }}>
              Conteúdo institucional sobre o programa de parceria; não constitui recomendação de investimento. Consulte as condições da plataforma — todo investimento envolve riscos.
            </p>
          </Card>

          <Card title="📞 Fale com a Associação">
            <p>Dúvidas sobre cotas de patrocínio, exposição de marca em eventos e campeonatos da Liga:</p>
            <a className="btn ok block" href={waLink(c.whatsapp, 'Olá! Tenho interesse em patrocinar a Associação Mao Quan Kung Fu Wushu.')} target="_blank" rel="noreferrer">
              WhatsApp (11) 94963-2186
            </a>
          </Card>
        </div>

        <h3 className="brush mt" style={{ fontSize: 24, fontWeight: 400 }}>Diretoria</h3>
        <DiretoriaList />
      </div>
      <WhatsFab />
    </div>
  );
}
