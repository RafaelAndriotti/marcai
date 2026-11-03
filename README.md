# Marcaí

Sistema de controle de pedidos (bar e itens) e agendamento de horários de quadras de vôlei, beach tennis e futevôlei.

O Marcaí é uma aplicação web para o painel de uma arena. A API REST (Express + Prisma + PostgreSQL) e o frontend (React + Vite) usam o mesmo pacote compartilhado, `@marcai/shared`, que concentra os tipos, os schemas de validação (zod) e as regras de negócio.

> A API ainda não tem autenticação. Ela aceita apenas conexões da própria máquina. Veja [Produção](#produção).

## Funcionalidades

- **Dashboard**: resumo do dia com número de reservas, taxa de ocupação, faturamento, pedidos abertos e próximas reservas.
- **Quadras**: cadastro de quadras (nome, esporte e preço por hora) e remoção.
- **Agenda**: grade de horários do dia, criação de reservas e troca de status (pendente, confirmada, cancelada, concluída).
- **Pedidos**: criação de pedidos avulsos ou ligados a uma reserva, com baixa de estoque. Cada pedido pode ser marcado como pago ou cancelado.
- **Itens**: cadastro de produtos com custo e margem (o preço de venda é calculado), estoque, categorias e busca por nome, sem diferenciar acentos nem maiúsculas. Filtros por categoria e situação (ativos, em estoque, sem estoque, excluídos).

## Regras de negócio

As regras abaixo estão implementadas no backend (`backend/src/services`) e nos schemas de `shared/src`.

### Fuso horário

- Todas as datas de negócio usam o fuso `America/Sao_Paulo` (`TIMEZONE` em `shared/src/rules.ts`). Dia, horário de funcionamento e início de reserva são sempre locais.
- Datas de reserva são enviadas em ISO 8601 com offset, por exemplo `2027-03-10T18:00:00-03:00`.

### Agenda e reservas

- Funcionamento das 07:00 às 23:00 (horário local). A reserva precisa começar e terminar no mesmo dia local, dentro desse intervalo.
- Reservas são de hora em hora: o início sempre cai em hora cheia (`:00`) e a duração vai de 1 a 4 horas, em múltiplos de 1 hora.
- Não há sobreposição de horários na mesma quadra. Reservas canceladas não ocupam horário. Reativar uma reserva cancelada também verifica conflitos (`409 BOOKING_CONFLICT`).
- Quadras inativas não recebem reservas.
- O preço da reserva é `preço por hora × minutos / 60`, arredondado para 2 casas (meio para cima). O valor é gravado na reserva no momento da criação.
- Status possíveis: `PENDING`, `CONFIRMED`, `CANCELLED` e `DONE`.
- Telefone do cliente: entre 8 e 20 caracteres, com dígitos, espaços, parênteses, `+` ou `-`, e pelo menos 8 dígitos.

### Quadras

- A remoção é lógica: a quadra fica inativa, some das listas e continua disponível para o histórico de reservas.
- Não é possível remover uma quadra que tenha reserva não cancelada que ainda não terminou (`409 COURT_HAS_FUTURE_BOOKINGS`).

### Itens, categorias e estoque

- Preço de venda: `custo × (1 + margem/100)`, com 2 casas e arredondamento meio para cima. O resultado precisa ficar entre R$ 0,01 e R$ 100.000,00.
- Nome de item é único entre itens ativos, sem diferenciar maiúsculas. Categorias também têm nome único sem diferenciar maiúsculas, com até 40 caracteres, e o limite é de 50 categorias.
- A remoção de item também é lógica: o item fica inativo e pode ser visto no filtro de excluídos.
- Estoque é um inteiro de 0 a 1.000.000.
- Itens inativos não podem ser vendidos.
- Edição de produto aceita `expectedStockQuantity`, uma trava otimista: se o estoque mudou desde que a tela foi carregada, a API responde `409 STOCK_CHANGED`.

### Pedidos

- Ciclo de vida: `OPEN` pode virar `PAID` ou `CANCELLED`. Qualquer outra mudança responde `409 ORDER_NOT_OPEN`.
- Criar um pedido baixa o estoque dos itens. Cancelar devolve o estoque. Marcar como pago não altera o estoque.
- Estoque insuficiente responde `409 INSUFFICIENT_STOCK`.
- Um pedido tem de 1 a 50 linhas, sem produto repetido, com quantidade de 1 a 999 por linha.
- Pedido pode ser ligado a uma reserva, desde que a reserva não esteja cancelada. Se o nome do cliente não for informado, usa-se o nome da reserva.
- O preço unitário de cada item é gravado no momento da venda. O total é a soma dos subtotais.

### Dashboard

Endpoint `GET /api/dashboard/summary?date=YYYY-MM-DD` (sem `date`, usa o dia atual):

- `bookingsCount`: reservas do dia que não estão canceladas.
- `occupancyRate`: horas reservadas do dia em quadras ativas ÷ (quadras ativas × 16 h), limitado a 1 e com 4 casas.
- `revenue`: soma das reservas `CONFIRMED` e `DONE` do dia e dos pedidos `PAID` criados no dia.
- `openOrdersCount`: todos os pedidos `OPEN`, independentemente da data.
- `upcomingBookings`: até 10 reservas do dia, não canceladas, que ainda não terminaram.

## Stack

| Parte | Tecnologias |
|---|---|
| Backend | Node.js, Express 5, Prisma 7 (`@prisma/client` com `@prisma/adapter-pg`), PostgreSQL 16, zod 4, tsx |
| Frontend | React 19, Vite 8, React Router 7, Tailwind CSS 4, lucide-react |
| Compartilhado | `@marcai/shared` (TypeScript + zod 4) |
| Testes | Vitest 5 (backend e frontend), supertest (testes de API) |
| Monorepo | npm workspaces, concurrently |

## Estrutura do repositório

```
marcai/
├── shared/                 # @marcai/shared: tipos, schemas zod e regras de negócio
│   └── src/
├── backend/                # API REST
│   ├── prisma/             # schema.prisma, migrations/, seed.ts
│   ├── src/
│   │   ├── routes/         # definição das rotas em /api
│   │   ├── controllers/
│   │   ├── services/       # regras de negócio
│   │   ├── models/         # acesso ao banco (Prisma)
│   │   ├── middleware/     # validação e tratamento de erros
│   │   └── config/         # variáveis de ambiente e cliente Prisma
│   ├── tests/              # testes Vitest + supertest
│   └── docker-compose.yml  # PostgreSQL 16
├── frontend/               # interface React + Vite
│   └── src/
│       ├── pages/          # Dashboard, Quadras, Agenda, Pedidos, Itens
│       ├── components/
│       └── services/api.ts # cliente HTTP
├── docs/
│   └── api.md              # referência da API
├── .env.example
└── package.json            # workspaces: shared, backend, frontend
```

## Pré-requisitos

- Node.js e npm. O repositório não declara uma versão mínima (não há campo `engines`).
- Docker com Docker Compose, para subir o PostgreSQL.
- Git.

## Como rodar localmente

### 1. Variáveis de ambiente

Na raiz do projeto:

```bash
cp .env.example .env
```

No Windows (PowerShell ou cmd): `copy .env.example .env`.

| Variável | Uso |
|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Usuário, senha e banco criados no container do PostgreSQL |
| `DATABASE_URL` | Conexão usada pelo backend e pelo Prisma. Deve usar o mesmo usuário, senha e banco, na porta `5435` |
| `PORT` | Porta da API (padrão `3000`) |

O `.env` fica na raiz e é lido pelo backend, pelo Prisma e pelo `docker-compose.yml`.

### 2. Instalar as dependências

```bash
npm install
```

### 3. Subir o PostgreSQL

```bash
docker compose -f backend/docker-compose.yml up -d
```

O container `marcai-postgres` (imagem `postgres:16`) escuta apenas em `127.0.0.1:5435`.

### 4. Aplicar as migrations

```bash
npm run db:migrate
```

Este comando roda `prisma migrate dev`, que aplica as migrations. No Prisma 7 ele não gera mais o cliente nem roda o seed. Gere o cliente Prisma em `backend/generated/` (pasta ignorada pelo git) logo em seguida:

```bash
npm -w backend run db:generate
```

### 5. Dados de exemplo (opcional)

```bash
npm run db:seed
```

O seed apaga todas as linhas das tabelas e recria dados de exemplo: 4 quadras, 12 reservas, 8 produtos, 3 categorias e 3 pedidos.

Por segurança, ele só roda se o nome do banco terminar em `_dev` ou `_test`. Com o `POSTGRES_DB=marcai` do `.env.example`, há duas opções:

- usar um banco com nome terminando em `_dev`, ou
- liberar explicitamente com `ALLOW_DESTRUCTIVE_SEED=1`:

```bash
ALLOW_DESTRUCTIVE_SEED=1 npm run db:seed        # bash
$env:ALLOW_DESTRUCTIVE_SEED = "1"; npm run db:seed   # PowerShell
```

### 6. Rodar a aplicação

```bash
npm run dev
```

Sobe o backend e o frontend juntos:

- Frontend: <http://localhost:5173>
- API: <http://127.0.0.1:3000/api> (health check em `/api/health`)

O frontend chama `/api`, e o Vite encaminha essas chamadas para `http://127.0.0.1:3000`. Para subir só um dos lados, use `npm run dev:backend` ou `npm run dev:frontend`.

## Scripts

Scripts da raiz (`package.json`):

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe backend (`tsx watch`) e frontend (Vite) em paralelo |
| `npm run dev:backend` | Só o backend, em `127.0.0.1:3000` |
| `npm run dev:frontend` | Só o frontend, em `localhost:5173` |
| `npm run build` | Typecheck de todos os workspaces e build do frontend (`frontend/dist`) |
| `npm run typecheck` | `tsc --noEmit` em `shared`, `backend` e `frontend` |
| `npm test` | Testes do backend e depois do frontend |
| `npm run db:migrate` | Desenvolvimento: `prisma migrate dev` (cria e aplica migrations, não gera o cliente) |
| `npm run db:deploy` | Produção: `prisma migrate deploy` (só aplica migrations) |
| `npm run db:seed` | Recria os dados de exemplo (apaga os dados existentes, veja a seção 5) |

Scripts de workspace úteis, executados com `npm -w <workspace> run <script>`:

| Comando | O que faz |
|---|---|
| `npm -w backend run db:generate` | Gera o cliente Prisma (`prisma generate`) |
| `npm -w backend start` | Inicia a API com `tsx`, sem watch |
| `npm -w frontend run lint` | Lint com oxlint |
| `npm -w frontend run preview` | Serve o build do frontend localmente |

## Testes

```bash
npm test
```

**Backend** (Vitest + supertest, em `backend/tests/`): cobrem a aplicação, quadras, reservas, produtos, categorias, pedidos, estoque, dashboard e testes de endurecimento (`hardening`).

Pré-requisitos para rodar os testes do backend:

1. `DATABASE_URL` definida no `.env` da raiz. A configuração do Vitest lança erro sem ela.
2. Um banco `marcai_test` no mesmo servidor, com as migrations aplicadas. O projeto não cria esse banco nem o migra automaticamente. Um caminho possível:

   ```bash
   docker exec -it marcai-postgres psql -U marcai -d postgres -c "CREATE DATABASE marcai_test;"
   ```

   Depois, aplique as migrations nele, por exemplo rodando `npm run db:deploy` com `DATABASE_URL` apontando para `marcai_test`.

Os testes apagam todas as tabelas antes de cada caso. O setup aborta se a URL não apontar para `marcai_test`, então nunca use o banco de desenvolvimento.

**Frontend** (Vitest): testes das funções de preço e de filtro de itens (`frontend/src/lib/price.test.ts` e `frontend/src/lib/itemFilter.test.ts`).

## API

- Prefixo: `/api`. Requisições e respostas em JSON.
- Sucesso: `{ "data": ... }`. Erro: `{ "error": { "code", "message", "details"? } }`.
- Sem autenticação.
- Recursos: `/health`, `/courts`, `/bookings`, `/categories`, `/products`, `/orders` e `/dashboard/summary`.
- O backend aceita requisições apenas com `Host` igual a `127.0.0.1`, `localhost` ou `[::1]` (proteção contra DNS rebinding). Outros hosts recebem `403`.

A referência completa, com endpoints, parâmetros, exemplos e códigos de erro, está em [docs/api.md](docs/api.md).

## Produção

```bash
cp .env.example .env        # troque POSTGRES_PASSWORD e a senha em DATABASE_URL (devem ser iguais)
npm install
docker compose -f backend/docker-compose.yml up -d   # Postgres escuta só em 127.0.0.1:5435
npm -w backend run db:generate
npm run db:deploy           # aplica as migrations (prisma migrate deploy)
npm run build               # typecheck + build do frontend (frontend/dist)
npm -w backend start        # API com tsx
```

Pontos de atenção:

- Use `db:deploy` em produção. `db:migrate` (`prisma migrate dev`) é só para desenvolvimento.
- Não rode o seed em produção.
- O backend não serve o build do frontend. É preciso servir `frontend/dist` por um servidor estático ou por um proxy reverso que encaminhe `/api` para `127.0.0.1:3000`. O proxy do Vite existe só em desenvolvimento.
- Como a API aceita apenas `Host` de `127.0.0.1`, `localhost` ou `[::1]`, o proxy reverso deve reescrever o header `Host` para um desses valores.
- A API não tem login e só escuta em `127.0.0.1`. Não exponha a porta `3000` diretamente na internet.
