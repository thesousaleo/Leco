# Leco · controle financeiro

App de finanças pessoais com contas de usuário (e-mail e senha ou Google), dados na nuvem (Supabase) e duas versões geradas automaticamente pelo GitHub:

- **APK Android**: em *Releases* do repositório.
- **Site**: https://thesousaleo.github.io/Leco/

## Recursos
- Cadastro, login, confirmação de e-mail, recuperação de senha e entrar com Google
- Boas-vindas com a primeira conta e o primeiro cartão; tudo começa zerado
- Contas e carteiras com saldo, transferências entre contas
- Cartões de crédito: limite, fatura por mês (fechamento e vencimento), compras parceladas, pagamento de fatura
- Recorrentes (salário, aluguel, assinaturas) lançadas sozinhas como “a pagar/a receber”
- Lembretes de vencimento: no app e como notificação no celular
- Categorias personalizáveis com orçamento mensal e alertas
- Metas de poupança
- Relatórios por período, categoria e conta; exportação para Excel (CSV) e cópia completa (JSON)
- Perfil, troca de e-mail e senha, sair dos outros aparelhos, excluir conta (LGPD)
- Tema claro (fundo branco) e escuro, ocultar valores
- **Assistente no WhatsApp**: registra gastos e receitas por texto, áudio ou foto da nota/comprovante e responde perguntas (saldo, gastos, vencimentos, faturas, orçamentos)

## Novidades do Leco 3
- Bloqueio com PIN, restaurar cópia (JSON), aviso de nova versão no app
- Temas claro, escuro, preto (AMOLED) e automático; 6 cores de destaque; tamanho do texto; alto contraste
- Lançamentos: editar parcelas/recorrências em grupo, ajustar saldo, foto do comprovante, etiquetas, dividir em categorias, lançamento rápido por texto, modelos, duplicar, outra moeda
- Importar extrato (OFX/CSV) e exportar a agenda (.ics) para o Google Agenda
- Planejamento (planejado × realizado, projeção de saldo, reserva de emergência, assinaturas, alertas inteligentes), dívidas e metas automáticas
- Personalização: mês financeiro, primeiro dia da semana, blocos do Início, abas do menu, subcategorias, emojis
- Busca global, gestos (arrastar para pagar/excluir, puxar para atualizar), gráficos novos, vibração, conquistas e dicas
- Testes automáticos antes de cada publicação (`npm test`)

## Novidades do Leco 3.3 (acabamento)
- Vidro líquido refinado: bordas em gradiente translúcido, reflexo nos cartões principais, sombra dupla e brilho nos botões ativos; ouro só como destaque (textos em ouro com contraste AA)
- Avisos de vidro: no topo no celular, no canto no computador, com barra de tempo
- Toque/mouse: botões e cartões crescem 1% ao passar o mouse e encolhem 2% ao tocar; dicas flutuantes nos ícones e gráficos
- Estados vazios com ilustração e "Limpar filtros"; editar/excluir rápido na lista (sempre com confirmação)
- Cópia local dos dados: abre na hora e permite consultar sem internet (apagada ao sair da conta)
- Modo demonstração ("Explorar com dados de exemplo" na tela de entrada ou `?demo=1`): dados fictícios salvos só no navegador
- Moldura de celular no computador (`?moldura=1`): barra de status com hora real, sinal, Wi-Fi e bateria, e indicador de início

## Novidades do Leco 3.7
- Vale-alimentação, vale-refeição e benefício flexível: conta própria (operadora, crédito mensal automático), saldo à parte do saldo total, opção no "Pago com" e "dá por dia" até o próximo crédito. Requer `supabase/v4.sql`.

## Site Clean (visual alternativo)
- Mesmo app, mesmos dados e mesma conta, com outro visual: https://thesousaleo.github.io/Leco/novo/
- Código do visual em `src/68-clean.jsx` e no fim de `src/styles.css` (bloco `data-skin="clean"`). Gerado por `node scripts/build-web.mjs web-clean`.
- Para o login com Google e os e-mails voltarem para o /novo/, inclua `https://thesousaleo.github.io/Leco/**` em Supabase › Authentication › URL Configuration › Redirect URLs.

## Estrutura
| Caminho | Para que serve |
|---|---|
| `src/00-core.jsx` … `src/70-shell.jsx` | O app em React, dividido por assunto (juntado em ordem no build). |
| `src/styles.css` | Cores e vidro líquido (Tailwind CSS). |
| `supabase/schema.sql` | Tabelas, segurança por usuário e categorias padrão. |
| `supabase/v3.sql` | Atualização do Leco 3: dívidas, modelos, planejamento, etiquetas, comprovantes e preferências. |
| `tests/` | Testes automáticos (app e agente do WhatsApp). |
| `supabase/whatsapp.sql` | Tabelas do assistente do WhatsApp (vínculo, códigos, desfazer). |
| `supabase/functions/ler-comprovante/` | Lê a foto do comprovante com o Gemini e devolve os dados do lançamento. |
| `supabase/ia.sql` | Limite diário de leituras por IA. |
| `supabase/functions/whatsapp/` | O assistente: recebe as mensagens da Meta, entende com o Gemini e grava no Leco. |
| `leco.config.json` | Endereço e chave **pública** do Supabase e endereço do site. |
| `scripts/build-web.mjs` | Monta o app num único `index.html` (Android, site ou teste local). |
| `tools/` | Ícones e ajuste do projeto Android. |
| `.github/workflows/gerar-apk.yml` | Gera o APK assinado e publica o site. |

## Configuração do Supabase (uma vez)
1. **SQL Editor › New query**: cole todo o `supabase/schema.sql` e clique em **Run**. Depois, numa nova query, cole e rode `supabase/v3.sql`.
2. **Authentication › URL Configuration**:
   - *Site URL*: `https://thesousaleo.github.io/Leco/`
   - *Redirect URLs*: adicione `https://thesousaleo.github.io/Leco/**` e `br.com.leco.app://auth`
3. **Login com Google** (opcional): crie um *OAuth client* do tipo *Web application* no Google Cloud com o redirecionamento `https://kdnxzxpivkxvhybdmqcp.supabase.co/auth/v1/callback` e cole o *Client ID* e o *Client secret* em **Authentication › Sign In / Providers › Google**.

## GitHub (uma vez)
- **Settings › Secrets and variables › Actions**: `LECO_KEYSTORE_BASE64`, `LECO_KEYSTORE_PASSWORD`, `LECO_KEY_ALIAS` (chave de assinatura do APK).
- **Settings › Pages › Build and deployment › Source**: *GitHub Actions*.

## Atualizações
Cada envio para a branch `main` gera um APK novo em *Releases* e atualiza o site. Para uma versão nova, suba o `"version"` no `package.json`. O APK novo instala por cima do antigo; os dados ficam na nuvem, então nada se perde.

Nunca perca a chave de assinatura (`leco-release.jks` e a senha): sem ela o Android recusa a atualização por cima.

## Teste local (sem servidor)
`npm install && npm run build:test` gera `teste-local.html`, que usa um banco em memória para testar as telas.

## Assistente do WhatsApp (uma vez)
1. **Supabase › SQL Editor**: cole e rode `supabase/whatsapp.sql`.
2. **Meta for Developers** (developers.facebook.com): crie um app do tipo *Business*, adicione o produto **WhatsApp** e, em *API Setup*, cadastre os números que vão testar (até 5) no campo *To*.
3. **Google AI Studio** (aistudio.google.com/apikey): crie uma chave da API do Gemini.
4. **Supabase › Edge Functions › Secrets**: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN` (uma senha inventada), `WHATSAPP_APP_SECRET` (Meta › App settings › Basic) e `GEMINI_API_KEY`.
5. **Supabase › Account › Access Tokens**: gere um token e salve no GitHub como segredo `SUPABASE_ACCESS_TOKEN`. A cada envio para a `main`, a função é publicada sozinha.
6. **Meta › WhatsApp › Configuration › Webhook**: URL `https://kdnxzxpivkxvhybdmqcp.supabase.co/functions/v1/whatsapp`, o mesmo `WHATSAPP_VERIFY_TOKEN`, e assine o campo **messages**.
7. Em `leco.config.json`, preencha `whatsappNumber` com o número do assistente (só dígitos, com 55) para o app mostrar o botão “Enviar pelo WhatsApp”.

O número de teste da Meta só conversa com os números cadastrados no passo 2. Para abrir a todos, registre um número próprio e verifique a empresa na Meta.

## Suporte
Em `leco.config.json`, preencha `supportWhatsapp` com o número do suporte (só dígitos, com 55 e DDD). O botão "Chamar no WhatsApp" aparece em Configurações › Ajuda e suporte.

## Leitura de comprovante com IA (uma vez)
1. **Google AI Studio** (aistudio.google.com/apikey): crie uma chave da API do Gemini.
2. **Supabase › Edge Functions › Secrets**: crie `GEMINI_API_KEY` com a chave.
3. **Supabase › Account › Access Tokens**: gere um token e salve no GitHub como segredo `SUPABASE_ACCESS_TOKEN`. A cada envio para a `main`, as funções `ler-comprovante` e `whatsapp` são publicadas.
4. (Recomendado) **SQL Editor**: rode `supabase/ia.sql` para limitar a 40 leituras por usuário por dia.

A chave do Gemini fica só no servidor; o app nunca a recebe.
