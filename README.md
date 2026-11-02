# Marcaí

Controle de pedidos e agendamento de horários de quadras de vôlei, beach tennis e futevôlei.

## Estrutura

- `backend/` — API REST em Node.js + Express
- `frontend/` — interface em React + Vite
- `shared/` — pacote `@marcai/shared`: tipos, schemas zod e regras de negócio usados por backend e frontend

## Como rodar

```bash
cp .env.example .env
npm install
docker compose -f backend/docker-compose.yml up -d
npm run db:migrate     # desenvolvimento: aplica as migrations
npm run dev            # sobe backend (http://127.0.0.1:3000, só aceita conexões desta máquina) e frontend
npm run dev:frontend   # só o frontend, em http://localhost:5173
```

## Seed

`npm run db:seed` apaga todas as tabelas e recria dados de exemplo. Ele só roda se o nome do banco terminar em `_dev` ou `_test`, ou se `ALLOW_DESTRUCTIVE_SEED=1` estiver definida.

## Produção

```bash
cp .env.example .env   # troque POSTGRES_PASSWORD e a senha em DATABASE_URL antes de subir o banco (devem ser iguais)
npm install
docker compose -f backend/docker-compose.yml up -d   # Postgres só escuta em 127.0.0.1:5435
npm run db:deploy      # aplica as migrations (prisma migrate deploy)
npm run build          # typecheck + build do frontend
npm -w backend start   # API via tsx
```

- Em produção use `db:deploy`. `db:migrate` (`prisma migrate dev`) é só para desenvolvimento.
- Não rode o seed em produção.
