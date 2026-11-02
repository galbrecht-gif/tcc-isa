# Sistema de Controle Digital de Entrada Atrasada e Saída Antecipada - SENAI

Aplicação full stack (Node.js/Express + SQLite/PostgreSQL/Knex + React/Vite) para registrar entradas atrasadas e autorizar saídas antecipadas.

## Executar

Pré-requisito: Node.js 18+.

```bash
cd backend
cp .env.example .env        # Windows: copy .env.example .env
npm install
npm run setup               # migrations (preserva os dados existentes)
npm run seed                # opcional: dados de exemplo; apaga os dados do banco local
npm run dev                 # API em http://localhost:3001

cd ../frontend
npm install
npm run dev                 # http://localhost:5173 (proxy /api -> 3001)
```

Testes do backend (fluxos completos, banco temporário): `cd backend && npm test`.

## Login

- **Google OAuth**: preencha `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `GOOGLE_CALLBACK_URL` no `.env` (URI autorizada: `http://localhost:3001/api/auth/google/callback`). Alunos cadastrados podem entrar com qualquer conta Google verificada; gestor, professor e portaria só entram com e-mail verificado dos domínios `sp.senai.br` e `dp.senai.br` (ajuste `SENAI_EMAIL_DOMAINS` se necessário). O e-mail precisa estar cadastrado e ativo em `usuarios`; o perfil vem exclusivamente do banco e o usuário não escolhe a role. O usuário é recarregado do banco a cada requisição, então mudanças de e-mail/perfil/ativo valem imediatamente.
- **Modo demo** (`DEMO_MODE=true`): botões de atalho no login; o aluno pode ser escolhido na lista (maior/menor calculado na hora). Desativado automaticamente com `NODE_ENV=production`.
- **Responsável**: acessa `/responsavel/validar` com protocolo + código de 6 dígitos (1 minuto, uso único, 5 tentativas). Ao autorizar, pode registrar uma observação opcional sobre como o aluno sairá. Cada aluno pode ter até 3 responsáveis vinculados, que recebem o código por e-mail.

## Dados do seed

Gestor, professor, portaria, turma DEV 2 e 5 alunos com responsáveis, conforme a especificação. Os e-mails dos alunos não foram informados; foram usados placeholders (`*.@aluno.senai.br`) em [backend/database/seed.js](backend/database/seed.js) - altere-os em "Gerenciar Usuários" para os e-mails Google reais. A idade nunca é armazenada: é calculada a partir de `data_nascimento` em `America/Sao_Paulo` (Thaina passa a ser maior de idade em 12/11/2026 sem intervenção).

## E-mail

Com `SMTP_HOST` configurado, envia via Nodemailer. Em desenvolvimento, sem SMTP (ou em falha), imprime no console e grava em `emails_log`. Em producao, SMTP e obrigatorio e falhas no envio sao reportadas sem fallback enganoso.

## Estrutura

Segue a estrutura solicitada (`backend/src/{config,controllers,middlewares,models,routes,services}`, `backend/database/{migrations,seed.js}`, `frontend/src/...`). Estilização com CSS global institucional (`frontend/src/index.css`) e ícones `lucide-react`.

## Banco

Acesso via Knex. SQLite e usado localmente; em producao configure PostgreSQL com `DB_CLIENT=pg` e `DATABASE_URL` (opcionalmente `DB_SSL=true`), ou MySQL com `DB_CLIENT=mysql2` e `DB_*`. Producao recusa SQLite para evitar perda de dados em disco efemero. `npm run setup` aplica somente migrations; `npm run seed` e destrutivo e bloqueado em producao, a menos que `ALLOW_DESTRUCTIVE_SEED=true` seja configurado explicitamente. Auditoria em `logs_sistema` (usuário, ação, dados anteriores/novos, IP, timestamp). Isolamento por perfil aplicado nas queries ([escopo.js](backend/src/models/escopo.js)): aluno vê só o próprio histórico, responsável só dependentes (e nunca entradas atrasadas), professor só suas turmas.

### Supabase e deploy da API

O Supabase fornece o PostgreSQL; a API continua sendo executada no serviço onde já está hospedada. Para conectar:

1. Crie um projeto no Supabase e aguarde o banco ficar disponível.
2. No painel do projeto, abra **Connect** e escolha **Session pooler**. Copie a URI PostgreSQL mostrada ali (não use a chave `anon` nem `service_role`).
3. Nas variáveis de ambiente da hospedagem da API, configure `DB_CLIENT=pg` e `DATABASE_URL` com essa URI. Mantenha a URI em segredo; se a senha tiver caracteres especiais, use a URI fornecida pelo Supabase ou codifique-os conforme URL encoding.
4. Configure também os segredos e endereços de produção listados em `backend/.env.example` (Google OAuth e SMTP). A URL de callback OAuth deve ser `https://SEU-DOMINIO-DA-API/api/auth/google/callback`; em `FRONTEND_URL`, informe a origem pública do site.
5. Publique a API. O comando de inicialização executa apenas as migrations pendentes, cria/atualiza as tabelas sem apagar registros e inicia a API. Confirme a conexão abrindo `https://SEU-DOMINIO-DA-API/api/health`, que deve responder `{"ok":true,"database":"connected"}`.
6. Cadastre o primeiro gestor com o comando `npm run criar-gestor-inicial --prefix backend`, definindo temporariamente `GESTOR_NOME` e `GESTOR_EMAIL` no ambiente da hospedagem. O e-mail precisa pertencer a um domínio permitido e o comando só funciona se ainda não existir nenhum gestor. Depois, entre com Google e cadastre usuários pelo painel. Não execute `npm run seed` no banco real: ele contém dados de demonstração e apaga os registros antes de recriá-los.

Se estiver usando o Blueprint deste repositório, o `render.yaml` pede `DATABASE_URL` como variável secreta e executa migrations sem seed. Se a API estiver em outra hospedagem, configure as mesmas variáveis no painel dessa hospedagem e use `npm run migrate --prefix backend` como comando de release/deploy, ou mantenha as migrations no comando de inicialização. O plano gratuito do Supabase pode pausar projetos inativos e não inclui backups automáticos; confirme as condições atuais do plano antes de colocar dados reais de alunos.
