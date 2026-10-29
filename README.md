# Gestão SST — base do backend

Esta pasta reúne o template original e a API Node.js/PostgreSQL. A interface é servida pelo próprio backend e mantém o visual do template; cadastros e documentos são carregados e salvos no PostgreSQL. As preferências de notificação ainda ficam neste navegador.

## O que já está modelado

- Empreiteiras e colaboradores, com desligamento da equipe ativa junto ao desligamento da empreiteira.
- Documentos vinculados ao colaborador, com data de emissão, validade padrão de dois anos e validade manual opcional.
- Histórico de vínculos/transferências entre empreiteiras.
- Indicadores do dashboard e contagem mensal de treinamentos.
- Registro básico de auditoria das operações feitas pela API.

## Requisitos

- Node.js 20 ou mais recente.
- Docker Desktop, para subir PostgreSQL localmente, ou uma instância PostgreSQL existente.

## Iniciar localmente

Na pasta `server`, copie `.env.example` para `.env` e ajuste as credenciais se necessário. Na raiz desta entrega:

```powershell
docker compose up -d db
cd server
npm install
npm run db:init
npm run dev
```

A API e a interface ficam em `http://localhost:3000`. Verifique a conexão em `http://localhost:3000/api/health`.

Se já tiver PostgreSQL, configure `DATABASE_URL` em `server/.env` e pule o Docker. Não publique o `.env` nem use credenciais de produção no computador compartilhado.

## Rotas iniciais

- `GET/POST /api/contractors` e `PATCH /api/contractors/:id/status`
- `GET/POST /api/employees`, `PATCH /api/employees/:id/status`
- `POST /api/employees/:id/transfer` e `GET /api/employees/:id/history`
- `GET/POST /api/employees/:id/documents`
- `PATCH /api/documents/:id/expiry`
- `GET /api/dashboard` e `GET /api/audit`

Datas da API usam `AAAA-MM-DD`. Ao criar documento, omitir `expiresOn` calcula dois anos depois da emissão; enviar `expiresOn` marca a validade como manual. Marque `isTraining: true` nos documentos emitidos por treinamento para incluí-los no painel mensal.

## Ainda falta

Adicionar autenticação antes de colocar dados reais, configurar integração OAuth com o Google Drive e automatizar o e-mail semanal. A API ainda não implementa login nem autorização; use apenas dados fictícios até essa parte ser feita.
