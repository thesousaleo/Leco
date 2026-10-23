# Leco · app Android

Este é o projeto do Leco pronto para virar um aplicativo Android (APK). Você não precisa instalar nada no computador: o próprio GitHub compila o APK de graça, assina com a sua chave e coloca o ficheiro numa página de download.

## O que tem nesta pasta

| Caminho | Para que serve |
|---|---|
| `src/app.jsx` | O app inteiro em React. É aqui que se fazem as mudanças. |
| `src/styles.css` | Cores, vidro líquido e tema (Tailwind CSS). |
| `www/index.html` | O app já montado (é gerado de novo a cada build). |
| `resources/android/res/` | Ícone e tela de abertura do Leco. |
| `.github/workflows/gerar-apk.yml` | A receita que o GitHub segue para gerar o APK. |
| `package.json` | Nome, versão e bibliotecas do app. |
| `capacitor.config.json` | Identidade do app no Android (`br.com.leco.app`). |

## Primeira vez: gerar o APK

### 1. Crie o repositório
1. Entre em [github.com](https://github.com) (crie uma conta grátis, se ainda não tiver).
2. Clique em **New repository**, dê o nome `leco` e clique em **Create repository**.
   Pode ser público ou privado. Num repositório privado, para baixar o APK no celular você precisa estar logado no GitHub pelo navegador.

### 2. Envie os ficheiros
1. Na página do repositório, clique em **uploading an existing file**.
2. Arraste **todo o conteúdo** desta pasta (não a pasta em si) e clique em **Commit changes**.
3. Confira se a pasta `.github` foi enviada. Ela fica oculta em alguns computadores e às vezes fica para trás. Se não aparecer na lista:
   **Add file › Create new file**, escreva o nome `.github/workflows/gerar-apk.yml`, cole o conteúdo do ficheiro com esse nome e clique em **Commit changes**.

### 3. Cadastre a chave de assinatura
A chave garante que só você consegue publicar atualizações do Leco. Ela vem num pacote separado (`leco-chave`), que **não** deve ir para o repositório.

1. No repositório: **Settings › Secrets and variables › Actions › New repository secret**.
2. Crie os três segredos indicados no ficheiro `SEGREDOS-DO-GITHUB.txt`:
   `LECO_KEYSTORE_BASE64`, `LECO_KEYSTORE_PASSWORD` e `LECO_KEY_ALIAS`.

### 4. Gere o APK
1. Vá em **Actions**. Se o GitHub pedir, clique em **I understand my workflows, go ahead and enable them**.
2. Abra **Gerar APK do Leco** e clique em **Run workflow**.
3. Leva de 5 a 10 minutos. Quando ficar verde, abra a aba **Releases** do repositório.

### 5. Instale no celular
1. No celular, abra a página **Releases** do repositório e toque em `Leco-1.0.0.apk`.
2. O Android vai pedir para **permitir instalar apps desta fonte** (o navegador). Permita.
3. Se o Play Protect avisar que o app é desconhecido, toque em **Instalar mesmo assim**. O aviso aparece porque o app não veio da Play Store.

O app abre com dados de exemplo. Para usar com os seus dados de verdade, vá em **Ajustes › Preferências › Começar do zero** e depois defina o **Saldo inicial**.

## Como fazer atualizações

Cada envio de alterações para a branch `main` gera um APK novo automaticamente.

1. **Mude o app.** Edite `src/app.jsx` ou `src/styles.css` (pelo próprio GitHub: abra o ficheiro, clique no lápis, faça a mudança e clique em **Commit changes**). Pode pedir as mudanças ao Claude e colar o ficheiro novo.
2. **Suba a versão.** Em `package.json`, troque `"version": "1.0.0"` por `"1.1.0"` (ou `1.0.1` para correções pequenas). O número de build sobe sozinho.
3. **Espere o build** em **Actions** e baixe o novo APK em **Releases**.
4. **Instale por cima** do app que já está no celular. Os seus dados continuam lá.

### Regras para as atualizações funcionarem
- **Nunca perca a chave** (`leco-release.jks` e a senha). Sem ela, o Android recusa instalar a atualização por cima, e a única saída é desinstalar o app, o que apaga os dados.
- **Não mude** o `appId` (`br.com.leco.app`) no `capacitor.config.json`.
- Os dados ficam guardados **só no celular**. Desinstalar o app apaga tudo.

## Para quem quiser compilar no computador (opcional)
Com Node.js 20, Java 17 e Android Studio instalados:

```bash
npm install
npm run build:web
npx cap add android            # só na primeira vez
cp -r resources/android/res/* android/app/src/main/res/
npx cap sync android
npx cap open android           # abre no Android Studio › Build › Build APK
```

Para trocar o ícone ou a tela de abertura, edite `tools/gerar-icones.cjs` e rode `node tools/gerar-icones.cjs` (precisa do pacote `sharp`).
