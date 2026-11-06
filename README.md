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

- **Cadastro e login de aluno**: qualquer pessoa pode criar uma conta de aluno com qualquer e-mail válido (não precisa ser institucional), informando nome, nascimento, turma e uma senha (confirmada na tela). O cadastro não verifica se a caixa de e-mail existe nem envia confirmação: a conta é criada imediatamente e já pode ser acessada com e-mail e senha. Use um endereço que consiga acessar para poder recuperar a senha. Menores de 18 anos também informam um responsável, que fica vinculado para as autorizações de saída. A recuperação de senha exige um código enviado ao e-mail cadastrado.
- **Login por e-mail e senha**: encaminha cada conta ao perfil salvo no cadastro. Os atalhos de **Entrar com Google** permitem selecionar Aluno, Gestor, Professor ou Portaria, e o servidor verifica se a conta está autorizada para o perfil.
- **Acesso com mais de um perfil**: use o atalho Google da área desejada; a conta precisa estar cadastrada e autorizada para aquele perfil.
- **Contas da equipe**: gestores podem cadastrar novos professores em **Gerenciar Usuários**, informando o e-mail e a senha temporária padrão `Senai@123`. O acesso fica associado ao perfil Professor cadastrado; no primeiro login por e-mail e senha, o professor será encaminhado para criar uma senha pessoal. Os atalhos Google continuam sujeitos às permissões da conta e do perfil. Para redefinir senhas depois, um gestor deve gerar uma nova senha temporária pelo painel. A recuperação por código é exclusiva para alunos.
- **Modo demo** (`DEMO_MODE=true`): botões de atalho no login; o aluno pode ser escolhido na lista (maior/menor calculado na hora). Desativado automaticamente com `NODE_ENV=production`.
- **Responsável**: acessa `/responsavel/validar` com protocolo + código de 6 dígitos (1 minuto, uso único, 5 tentativas). Ao autorizar, pode registrar uma observação opcional sobre como o aluno sairá. Cada aluno pode ter até 3 responsáveis vinculados, que recebem o código por e-mail.

## Dados do seed

Gestor, professor, portaria, turma DEV 2 e 5 alunos com responsáveis, conforme a especificação. Os e-mails dos alunos não foram informados; foram usados placeholders (`*.@aluno.senai.br`) em [backend/database/seed.js](backend/database/seed.js) - altere-os em "Gerenciar Usuários" para os e-mails Google reais. A idade nunca é armazenada: é calculada a partir de `data_nascimento` em `America/Sao_Paulo` (Thaina passa a ser maior de idade em 12/11/2026 sem intervenção).

## E-mail

Com `SMTP_HOST` configurado, envia via Nodemailer. A recuperação de senha exige entrega SMTP confirmada; se o serviço estiver ausente ou falhar, a API informa que o código não foi enviado e não deixa um código inutilizável ativo. O cadastro de aluno não depende de e-mail. Outros e-mails podem usar o fallback de demonstração em desenvolvimento (console e `emails_log`). Em produção, SMTP é obrigatório.

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
6. Cadastre o primeiro gestor com o comando `npm run criar-gestor-inicial --prefix backend`, definindo temporariamente `GESTOR_NOME`, `GESTOR_EMAIL` e `GESTOR_SENHA_TEMPORARIA` no ambiente da hospedagem. O e-mail precisa estar autorizado para Gestor em `backend/src/config/equipePermitida.js`; o comando só funciona se ainda não existir nenhum gestor.
7. Para criar/atualizar as contas de equipe pré-autorizadas, configure `EQUIPE_SENHA_TEMPORARIA` (por exemplo, `Senai@123`) no ambiente conectado ao banco de produção e execute uma vez `npm run definir-senha-equipe --prefix backend`. O comando provisiona as contas de gestores e professores declaradas em `backend/src/config/equipePermitida.js` e exige a troca da senha no primeiro acesso. Execute-o somente contra o banco correto: cada nova execução redefine a senha temporária de todas essas contas. Não o inclua no comando de inicialização/deploy. Gestores também podem cadastrar professores pelo painel. Não execute `npm run seed` no banco real: ele contém dados de demonstração e apaga os registros antes de recriá-los.

Se estiver usando o Blueprint deste repositório, o `render.yaml` pede `DATABASE_URL` como variável secreta e executa migrations sem seed. Se a API estiver em outra hospedagem, configure as mesmas variáveis no painel dessa hospedagem e use `npm run migrate --prefix backend` como comando de release/deploy, ou mantenha as migrations no comando de inicialização. O plano gratuito do Supabase pode pausar projetos inativos e não inclui backups automáticos; confirme as condições atuais do plano antes de colocar dados reais de alunos.
