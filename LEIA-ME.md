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

## Estrutura
| Caminho | Para que serve |
|---|---|
| `src/00-core.jsx` … `src/70-shell.jsx` | O app em React, dividido por assunto (juntado em ordem no build). |
| `src/styles.css` | Cores e vidro líquido (Tailwind CSS). |
| `supabase/schema.sql` | Tabelas, segurança por usuário e categorias padrão. |
| `leco.config.json` | Endereço e chave **pública** do Supabase e endereço do site. |
| `scripts/build-web.mjs` | Monta o app num único `index.html` (Android, site ou teste local). |
| `tools/` | Ícones e ajuste do projeto Android. |
| `.github/workflows/gerar-apk.yml` | Gera o APK assinado e publica o site. |

## Configuração do Supabase (uma vez)
1. **SQL Editor › New query**: cole todo o `supabase/schema.sql` e clique em **Run**.
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
