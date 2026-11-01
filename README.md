# Marcaí

Controle de pedidos e agendamento de horários de quadras de vôlei, beach tennis e futevôlei.

## Estrutura

- `backend/` — API REST em Node.js + Express
- `frontend/` — interface em React + Vite

## Como rodar

```bash
cp .env.example .env
npm install
npm --prefix frontend install
docker compose -f backend/docker-compose.yml up -d
npm run dev            # backend em http://localhost:3000
npm run dev:frontend   # frontend em http://localhost:5173
```
