# 📋 Chamada Escolar — CETI Dariana

Sistema de chamada escolar em tempo real com Firebase Firestore, gráfico de frequência e painel administrativo protegido.

---

## ✅ Funcionalidades

- Registro de presença e ausência por turma em tempo real
- Sincronização instantânea entre dispositivos via Firebase Firestore
- Gráfico de frequência por dia, semana e mês
- Reset automático dos contadores à meia-noite com backup histórico
- Painel administrativo protegido com senha (hash SHA-256 + bloqueio por tentativas)
- Fonte do sistema iOS/macOS (SF Pro / Helvetica Neue)

---

## ⚙️ Configuração antes de publicar

### 1. Configure o Firebase no `index.html`

Abra `index.html` e localize o bloco:

```js
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
};
```

Substitua pelos valores do seu projeto em:
**Firebase Console → Configurações do projeto → Seus apps → SDK**

### 2. Configure o Project ID no `.firebaserc`

```json
{
  "projects": {
    "default": "SEU_PROJECT_ID"
  }
}
```

Substitua `SEU_PROJECT_ID` pelo ID do seu projeto Firebase.

---

## 🚀 Deploy — Passo a passo

### Pré-requisitos

- [Node.js](https://nodejs.org/) instalado (versão 18 ou superior)
- Conta no [Firebase](https://firebase.google.com/)
- Conta no [GitHub](https://github.com/)

### Instalar Firebase CLI

```bash
npm install -g firebase-tools
```

### Login no Firebase

```bash
firebase login
```

### Publicar no Firebase Hosting

```bash
firebase deploy
```

Após o deploy, o app estará disponível em:
```
https://SEU_PROJETO.web.app
```

---

## 📂 Estrutura de arquivos

```
chamada-escolar/
├── index.html          # App principal
├── firebase.json       # Configuração do Firebase Hosting
├── firestore.rules     # Regras de segurança do Firestore
├── firestore.indexes.json
├── .firebaserc         # Project ID do Firebase
├── .gitignore
└── README.md
```

---

## 🔐 Segurança

- Senha do admin verificada via **SHA-256** (Web Crypto API nativa)
- Bloqueio automático após **5 tentativas erradas** por 30 segundos
- A senha nunca é armazenada em texto puro no código
- Headers de segurança HTTP configurados no `firebase.json`

### Trocar a senha do administrador

No `index.html`, localize o comentário `// ===================== SEGURANÇA`:

A senha atual é `Atlanta`. Para trocar, abra o console do navegador e rode:

```js
crypto.subtle.digest('SHA-256', new TextEncoder().encode('NovaSenha'))
  .then(b => console.log([...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')))
```

A função `checkPassword()` compara automaticamente o hash digitado com o hash da senha `Atlanta`. Basta alterar a senha dentro da função `checkPassword` trocando `"Atlanta"` pelo novo valor desejado antes do deploy.

---

## 🕛 Reset automático

Todo dia à meia-noite o sistema:
1. Salva um snapshot do dia no Firestore em `escolas/{id}/historico/{data}`
2. Zera todos os contadores de presença e falta
3. Atualiza a data exibida no cabeçalho
4. Reagenda o próximo reset

---

## 📱 Suporte

Desenvolvido por **Alfa Store** — Soluções e Tecnologia  
📞 (92) 99481-0508 · [WhatsApp](https://wa.me/5592994810508)
