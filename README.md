# Mao Quan Conecta

Plataforma PWA da **Associação Mao Quan Kung Fu Wushu**: web + app instalável (Android, iOS, tablets, iPad e notebooks), com 4 painéis: **Administrador (Central Mao)**, **Professor (Laoshi)**, **Aluno** e **Patrocinador**.

## Rodar

```bash
npm install
npm run dev        # http://localhost:5173 (também acessível pela rede local)
npm run build      # gera /dist para publicar (Vercel, Netlify, Hostinger, etc.)
```

Para instalar como app: abra o endereço publicado (HTTPS) no celular → **Adicionar à tela inicial**.

## Acessos

Todos entram pelo mesmo botão **Entrar com Google**; o sistema identifica o painel pela conta:

| Painel | Como entrar |
|---|---|
| Administrador | Somente a conta Google `maoquankungfuwushu@gmail.com` |
| Professor | Conta Google promovida pelo Admin (Alunos › Abrir › Promover a Professor) ou cadastrada em *Professores*; o Admin define quais recursos aparecem no painel |
| Aluno | Qualquer outra conta Google → primeiro acesso escolhe a filial → assina os termos → aguarda aprovação |
| Patrocinador | Link gerado pelo botão **🤝 Patrocinador** (Admin, Professor e Atleta) |

**Login Google real:** crie um *OAuth Client ID* (tipo Web) no Google Cloud Console, adicione o domínio em *Authorized JavaScript origins* e crie o arquivo `.env`:

```
VITE_GOOGLE_CLIENT_ID=seu-client-id.apps.googleusercontent.com
```

Sem essa variável o app roda em **modo de pré-visualização** (digita-se o e-mail Google).

Em *Configurações › Dados* há **Carregar demonstração** para testar todos os fluxos.

## Estrutura

```
src/lib/db.js          camada de dados + regras (bloqueio, frequência, cobranças, notificações)
src/lib/seed.js        dados iniciais (9 filiais, Diretoria 2025, faixas, termos, preços)
src/lib/utils.js       datas, moeda, PIX BR Code (EMV + CRC16), uploads
src/components/        layout responsivo, UI, carteirinha/QR/exportação, PIX, investimento
src/pages/admin|professor|aluno|shared   telas de cada painel
```

## Fase atual × próxima fase

**Fase 1 (esta entrega):** todo o front-end funcional. Os dados ficam salvos **no próprio aparelho** (localStorage) e sincronizam em tempo real entre abas. Use *Exportar/Restaurar backup* em Configurações.

**Fase 2 (necessária para uso em produção com vários aparelhos):** API Node.js/Express + MongoDB + WebSockets.
Todas as telas acessam os dados apenas por `useDB()` / `setDB()` em `src/lib/db.js` — basta trocar essa camada pelas chamadas REST/Socket.io. Na fase 2 também devem ir para o servidor:
- validação do token do login Google no servidor (hoje a identificação da conta é feita no navegador — **não é segura para produção**);
- a cobrança automática via gateway (InfinitePay/PIX dinâmico com webhook de confirmação);
- armazenamento de vídeos/arquivos (S3, Cloudinary ou Google Drive) — hoje o upload é limitado a 3 MB;
- verificação de situação do QR Code em qualquer aparelho.

## Carteirinha oficial

Modelo “Identidade do Praticante” (frente + verso) para Aluno (faixa vermelha), Professor (faixa amarela) e Atleta.
Os elementos gráficos ficam em `public/carteirinha/` e foram recortados dos modelos originais com
`node scripts/carteirinha-assets.mjs <modelo-aluno.jpg> <modelo-professor.jpg>` (imagens 2000 × 652, frente + verso lado a lado).
O Administrador pode trocar cores, textos, posição dos campos, fundo da frente e imagem do verso em *Carteirinhas*.

## Publicação — maoquanconecta.com.br

O projeto já inclui `vercel.json` (recomendado) e `netlify.toml`. HTTPS é emitido automaticamente pela hospedagem.

1. **Hospedagem (Vercel):** crie a conta em vercel.com e publique:
   `npx vercel` (primeira vez, responde às perguntas) e depois `npx vercel --prod`.
   Ou conecte um repositório GitHub em *Add New › Project* (framework: Vite).
2. **Domínio no Vercel:** *Project › Settings › Domains* → adicione `maoquanconecta.com.br` e `www.maoquanconecta.com.br`.
3. **DNS no Registro.br** (*registro.br › Domínios › maoquanconecta.com.br › DNS › Editar zona*, usando os servidores DNS do Registro.br):

   | Tipo | Nome | Valor |
   |---|---|---|
   | A | *(vazio / @)* | `76.76.21.21` |
   | CNAME | `www` | `cname.vercel-dns.com.` |

   Confira os valores exibidos pelo próprio Vercel na tela do domínio — use sempre os que ele indicar.
   (Netlify: A → `75.2.60.5` e CNAME `www` → `<seu-site>.netlify.app.`)
4. **Google Login:** no Google Cloud Console, adicione `https://maoquanconecta.com.br` e `https://www.maoquanconecta.com.br`
   em *Origens JavaScript autorizadas* e cadastre `VITE_GOOGLE_CLIENT_ID` nas variáveis de ambiente do Vercel (depois, *Redeploy*).

A propagação do DNS leva de alguns minutos a algumas horas. Os QR Codes das carteirinhas e os links de patrocinador
já apontam para `https://maoquanconecta.com.br` em produção.
