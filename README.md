# Sistema de Controle Digital de Entrada Atrasada e Saída Antecipada - SENAI

Aplicação full stack (Node.js/Express + SQLite/Knex + React/Vite) para registrar entradas atrasadas e autorizar saídas antecipadas.

## Executar

Pré-requisito: Node.js 18+.

```bash
cd backend
cp .env.example .env        # Windows: copy .env.example .env
npm install
npm run setup               # migrations + seed
npm run dev                 # API em http://localhost:3001

cd ../frontend
npm install
npm run dev                 # http://localhost:5173 (proxy /api -> 3001)
```

Testes do backend (fluxos completos, banco temporário): `cd backend && npm test`.

## Login

- **Google OAuth**: preencha `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `GOOGLE_CALLBACK_URL` no `.env` (URI autorizada: `http://localhost:3001/api/auth/google/callback`). O e-mail é buscado em `usuarios`; o perfil vem exclusivamente do banco e o usuário não escolhe a role. O usuário é recarregado do banco a cada requisição, então mudanças de e-mail/perfil/ativo valem imediatamente.
- **Modo demo** (`DEMO_MODE=true`): botões de atalho no login; o aluno pode ser escolhido na lista (maior/menor calculado na hora). Desativado automaticamente com `NODE_ENV=production`.
- **Responsável**: acessa `/responsavel/validar` com protocolo + código de 6 dígitos (15 min, uso único, 5 tentativas). Em modo demo a tela lista os e-mails enviados para facilitar o teste.

## Dados do seed

Gestor, professor, portaria, turma DEV 2 e 5 alunos com responsáveis, conforme a especificação. Os e-mails dos alunos não foram informados; foram usados placeholders (`*.@aluno.senai.br`) em [backend/database/seed.js](backend/database/seed.js) - altere-os em "Gerenciar Usuários" para os e-mails Google reais. A idade nunca é armazenada: é calculada a partir de `data_nascimento` em `America/Sao_Paulo` (Thaina passa a ser maior de idade em 12/11/2026 sem intervenção).

## E-mail

Com `SMTP_HOST` configurado, envia via Nodemailer. Caso contrário (ou em falha), imprime no console e grava em `emails_log`.

## Estrutura

Segue a estrutura solicitada (`backend/src/{config,controllers,middlewares,models,routes,services}`, `backend/database/{migrations,seed.js}`, `frontend/src/...`). Estilização com CSS global institucional (`frontend/src/index.css`) e ícones `lucide-react`.

## Banco

Acesso via Knex; para MySQL use `DB_CLIENT=mysql2`, instale `mysql2` e preencha `DB_*`. Auditoria em `logs_sistema` (usuário, ação, dados anteriores/novos, IP, timestamp). Isolamento por perfil aplicado nas queries ([escopo.js](backend/src/models/escopo.js)): aluno vê só o próprio histórico, responsável só dependentes (e nunca entradas atrasadas), professor só suas turmas.
