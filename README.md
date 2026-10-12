# 🎓 EduPage - Sistema de Gestão Escolar

Sistema completo de gestão escolar com 4 perfis de utilizador: **Administrador**, **Professor**, **Aluno** e **Pai/Encarregado**.

---

## 📋 Funcionalidades

### 👨‍💼 Administrador
- 🏫 Gestão de turmas, disciplinas e matrículas
- 👥 Gestão de utilizadores (professores, alunos, pais)
- 🔗 Alocação de professores a disciplinas/turmas
- 📊 Estatísticas por turma (médias, assiduidade)
- 📈 Consulta de notas por turma/disciplina
- 📅 Consulta de presenças por turma
- 💬 Envio de comunicados em massa

### 👨‍🏫 Professor
- 📝 Lançamento de notas (ACS1, ACS2, AT)
- ✅ Registo de presenças
- 📚 Publicação de TPCs
- 📊 Verificação de entregas de TPCs
- 💬 Mensagens para alunos e pais

### 👨‍🎓 Aluno
- 📊 Consulta de notas e médias
- 📅 Histórico de presenças
- 📝 Ver TPCs com status (entregue/atrasado/pendente)
- 💬 Mensagens para professores

### 👨‍👦 Pai/Encarregado
- 📊 Acompanhamento dos filhos
- 📅 Consulta de presenças
- 📝 Consulta de TPCs
- 💬 Mensagens para professores

---

## 🛠️ Tecnologias

- **Backend:** Node.js, Express
- **Base de Dados:** SQLite
- **Autenticação:** JWT + bcrypt
- **Frontend:** HTML, CSS, JavaScript (Vanilla)

---

## 🚀 Instalação

### 1. Clonar o repositório

```bash
git clone https://github.com/SEU-USUARIO/edupage.git
cd edupage
```

### 2. Instalar dependências

```bash
npm install
```

### 3. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Edita o `.env` e substitui o `JWT_SECRET`.

### 4. Iniciar o servidor

```bash
npm start
```

Abre em: **http://localhost:3000**

---

## 🔑 Credenciais Padrão

| Perfil | Email | Senha |
|--------|-------|-------|
| 👨‍💼 Admin | `admin@escola.com` | `admin123` |
| 👨‍🏫 Professor | `professor@escola.com` | `prof123` |
| 👨‍👦 Pai | `pai@escola.com` | `pai123` |
| 👨‍🎓 Aluno | `joao@aluno.com` | `aluno123` |

⚠️ **Muda estas senhas em produção!**

---

## 📄 Licença

MIT License — livre para usar, modificar e distribuir.

---

## 👨‍💻 Autor

**Gildo Manhice**
- Projeto final de Monografia
- Moçambique, 2025