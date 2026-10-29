# Gestão SST

Sistema de gestão de empreiteiras, colaboradores, histórico de vínculos e documentos de SST. A interface do template foi mantida; a aplicação é servida pela API Node.js e persiste os registros no PostgreSQL.

## Funcionalidades

- Cadastro e desligamento de empreiteiras e colaboradores.
- Histórico de transferências entre empreiteiras.
- Documentos por colaborador, com validade padrão de dois anos e validade manual opcional.
- Indicadores do painel e contagem mensal de treinamentos.
- Registro básico de auditoria das operações feitas pela API.
- Login individual com sessão em cookie HttpOnly, SameSite Strict e expiração após 8 horas.
- Criação de contas pela pessoa autenticada; todos os usuários têm acesso completo, conforme a regra atual do projeto.

## Requisitos locais

- Node.js 20 ou mais recente.
- Docker Desktop para subir PostgreSQL local, ou outra instância PostgreSQL.

## Executar localmente

Na raiz do projeto, copie `server/.env.example` para `server/.env` e personalize `ADMIN_NAME`, `ADMIN_EMAIL` e `ADMIN_PASSWORD` com uma senha forte de pelo menos 12 caracteres. Não compartilhe nem publique esse arquivo.

```powershell
docker compose up -d db
cd server
npm ci
npm run dev
```

Na primeira inicialização a API cria o esquema e a primeira conta configurada em `.env`. A interface abre em `http://localhost:3000`. Verifique o banco em `http://localhost:3000/api/health`.

Se você já tiver PostgreSQL, configure `DATABASE_URL` em `server/.env` e pule o Docker. Use `PGSSL=true` para uma conexão TLS com certificado válido e, quando necessário, informe o certificado raiz por `PGSSL_CA`.

## Publicar para a equipe

A configuração proposta usa Supabase para PostgreSQL em São Paulo e Fly.io para servir site e API na região de São Paulo (`gru`). O banco começa vazio: este deploy não importa registros do banco local.

### 1. Criar o PostgreSQL no Supabase

1. Crie um projeto e escolha **South America (São Paulo)**.
2. Defina uma senha forte para o banco e guarde-a em um gerenciador de senhas.
3. Abra **Connect** e copie a conexão **Direct connection**. O Fly.io é uma VM de longa duração, então esse é o tipo indicado nas opções de conexão do Supabase. Se a rede ou DNS não aceitar IPv6, use **Session pooler**.
4. Guarde a URL com segurança. Ela contém a senha do banco; nunca a coloque no GitHub.

### 2. Preparar o Fly.io

Instale o `flyctl`, entre na sua conta e, nesta pasta, troque `app` em `fly.toml` por um identificador único que você queira usar. Depois:

```powershell
fly auth login
fly apps create NOME-UNICO-DO-APP
fly secrets set DATABASE_URL="URL-DO-SUPABASE" ADMIN_NAME="Seu nome" ADMIN_EMAIL="seu-email@empresa.com.br" ADMIN_PASSWORD="senha-forte-com-12-ou-mais-caracteres"
fly deploy
```

Use a mesma grafia para `NOME-UNICO-DO-APP` em `fly.toml` e no comando `fly apps create`. Os valores de `fly secrets set` ficam no cofre de segredos do Fly; evite compartilhar a tela ou guardar senhas no histórico do terminal. `PGSSL=true` e `NODE_ENV=production` já estão configurados em `fly.toml`.

No primeiro início, o servidor cria as tabelas e cria a conta inicial com os segredos `ADMIN_*`. A aplicação fica em `https://NOME-UNICO-DO-APP.fly.dev`. Entre com o e-mail e a senha inicial e use **Adicionar usuário** para criar os acessos da equipe.

> O aplicativo não manda convites por e-mail nem oferece recuperação de senha ainda. Entregue as senhas temporárias por canal privado. Todos os usuários cadastrados podem criar outras contas e têm permissões iguais.

### Dados e backup

O banco local existente permanece na máquina e não é enviado neste procedimento. A instância Supabase começa vazia, com apenas o esquema e a conta inicial. Configure e confira backups no painel do provedor antes de usar dados reais; mantenha os dados pessoais fora do repositório GitHub.

## Rotas da API

- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/users`
- `GET /api/health` (status do servidor e banco; sem autenticação)
- `GET/POST /api/contractors`, `PATCH /api/contractors/:id/status`
- `GET/POST /api/employees`, `PATCH /api/employees/:id/status`
- `POST /api/employees/:id/transfer`, `GET /api/employees/:id/history`
- `GET/POST /api/employees/:id/documents`, `PATCH /api/documents/:id/expiry`
- `GET /api/dashboard`, `GET /api/audit`

Datas da API usam `AAAA-MM-DD`. Ao criar documento, omitir `expiresOn` calcula dois anos depois da emissão; enviar `expiresOn` marca a validade como manual. Marque `isTraining: true` nos documentos emitidos por treinamento para incluí-los no painel mensal.

## Próximas melhorias

- Papéis e permissões por função, gestão/desativação de contas e recuperação de senha.
- Integração OAuth com Google Drive para armazenar documentos; hoje a API guarda metadados e links.
- Automatização dos e-mails de vencimento.
- Migração manual e deliberada dos registros locais, caso seja autorizada no futuro.

