# API Marcaí

## Visão geral

API REST JSON do Marcaí: agendamento de quadras (vôlei, beach tennis, futevôlei) e controle de pedidos do bar (opcionalmente ligados a uma reserva).

- Prefixo: `/api`
- Content-Type: `application/json`
- Sem autenticação (fora de escopo).
- Tipos e schemas zod: pacote `@marcai/shared` (`shared/src`). Backend e frontend usam os mesmos schemas.

## Convenções

### Formato de resposta

Toda resposta de sucesso é um envelope `{ "data": ... }`.

- Recurso único: `ApiResponse<T>` = `{ "data": T }`
- Lista: `ApiListResponse<T>` = `{ "data": T[] }` (sem paginação por enquanto; listas retornam todos os itens do filtro)

Erro (`ApiErrorResponse`):

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Dados inválidos", "details": [{ "path": "endsAt", "message": "duration must be at least 30 minutes" }] } }
```

`details` é opcional. Em `VALIDATION_ERROR` é uma lista de `{ path, message }` (`ValidationIssue`). Códigos (`ERROR_CODES`):

| Código | HTTP | Uso |
|---|---|---|
| `VALIDATION_ERROR` | 400 | body/query/param inválido |
| `NOT_FOUND` | 404 | recurso (ou rota) inexistente |
| `BOOKING_CONFLICT` | 409 | reserva sobrepõe outra não cancelada na mesma quadra |
| `INTERNAL_ERROR` | 500 | erro inesperado |

### Datas e timezone

- Instantes (`startsAt`, `endsAt`, `createdAt`): ISO 8601 com offset, ex. `2026-11-02T18:00:00-03:00` (`Z` também aceito). Entrada exige offset.
- Dias (`date`): `YYYY-MM-DD`, sempre dia **local** em `America/Sao_Paulo`.
- Filtro `date` cobre `[00:00, 24:00)` locais de São Paulo.
- `date` omitido em `/dashboard/summary` = hoje em São Paulo.

### Dinheiro

Reais como `number` com no máximo 2 casas (ex. `120.5`). Nunca centavos. Entrada com mais de 2 casas é rejeitada.

### IDs

Strings opacas.

## Endpoints

| Método | Rota | Descrição | Sucesso |
|---|---|---|---|
| GET | `/api/health` | Health check | 200 |
| GET | `/api/courts` | Lista quadras | 200 |
| POST | `/api/courts` | Cria quadra | 201 |
| GET | `/api/bookings` | Lista reservas (filtros `date`, `courtId`) | 200 |
| POST | `/api/bookings` | Cria reserva | 201 |
| PATCH | `/api/bookings/:id/status` | Altera status da reserva | 200 |
| GET | `/api/products` | Lista produtos | 200 |
| GET | `/api/orders` | Lista pedidos (filtro `status`) | 200 |
| POST | `/api/orders` | Cria pedido | 201 |
| GET | `/api/dashboard/summary` | Resumo do dia | 200 |

Enums: `Sport` = `VOLEI | BEACH_TENNIS | FUTEVOLEI`; `BookingStatus` = `PENDING | CONFIRMED | CANCELLED | DONE`; `OrderStatus` = `OPEN | PAID | CANCELLED`.

---

### GET /api/health

Response 200:

```json
{ "data": { "status": "ok" } }
```

### GET /api/courts

Lista quadras (ativas e inativas), ordenadas por nome.

```json
{ "data": [
  { "id": "c1", "name": "Quadra 1", "sport": "VOLEI", "pricePerHour": 80, "active": true }
] }
```

Status: 200, 500.

### POST /api/courts

Body (`createCourtSchema`):

| Campo | Tipo | Regra |
|---|---|---|
| `name` | string | obrigatório, trim, não vazio |
| `sport` | Sport | obrigatório |
| `pricePerHour` | number | obrigatório, >= 0, até 2 casas |
| `active` | boolean | opcional, default `true` |

Request:

```json
{ "name": "Quadra Areia 2", "sport": "BEACH_TENNIS", "pricePerHour": 90.5 }
```

Response 201:

```json
{ "data": { "id": "c2", "name": "Quadra Areia 2", "sport": "BEACH_TENNIS", "pricePerHour": 90.5, "active": true } }
```

Status: 201, 400 `VALIDATION_ERROR`, 500.

### GET /api/bookings

Query (`listBookingsQuerySchema`): `date` (YYYY-MM-DD, opcional), `courtId` (opcional). Sem filtros retorna todas. Ordenado por `startsAt` crescente. Inclui canceladas (cliente filtra por `status`). Com `date`, retorna reservas cujo `startsAt` cai no dia local.

Request: `GET /api/bookings?date=2026-11-02&courtId=c1`

Response 200:

```json
{ "data": [
  {
    "id": "b1", "courtId": "c1",
    "court": { "id": "c1", "name": "Quadra 1", "sport": "VOLEI" },
    "customerName": "Ana", "customerPhone": "11999990000",
    "startsAt": "2026-11-02T18:00:00-03:00", "endsAt": "2026-11-02T19:30:00-03:00",
    "status": "PENDING", "price": 120
  }
] }
```

Status: 200, 400 `VALIDATION_ERROR` (date/courtId inválidos), 500.

### POST /api/bookings

Body (`createBookingSchema`):

| Campo | Tipo | Regra |
|---|---|---|
| `courtId` | string | obrigatório; quadra deve existir |
| `customerName` | string | obrigatório, trim |
| `customerPhone` | string | obrigatório, trim |
| `startsAt` | string | ISO 8601 com offset |
| `endsAt` | string | ISO 8601 com offset |

Validações de intervalo (erro reportado em `endsAt`):

- `endsAt` > `startsAt`
- `startsAt` alinhado à grade de 30 min no horário local (minutos `:00` ou `:30`, segundos e milissegundos zero); como a duração é múltipla de 30 min, `endsAt` também fica alinhado
- duração mínima 30 min, múltipla de 30 min, máxima 4 h
- início e fim no mesmo dia local (São Paulo)
- dentro do horário de funcionamento: início >= 07:00 e fim <= 23:00 locais

`status` inicial: `PENDING`. `price` é calculado no servidor: `pricePerHour * duração em horas`, arredondado a 2 casas. Um `price` enviado no body é ignorado.

Request:

```json
{ "courtId": "c1", "customerName": "Ana", "customerPhone": "11999990000",
  "startsAt": "2026-11-02T18:00:00-03:00", "endsAt": "2026-11-02T19:30:00-03:00" }
```

Response 201: objeto `Booking` (como acima), `price` = 80 * 1.5 = `120`.

Conflito, response 409:

```json
{ "error": { "code": "BOOKING_CONFLICT", "message": "Quadra já reservada neste horário" } }
```

Status: 201, 400 `VALIDATION_ERROR`, 404 `NOT_FOUND` (quadra inexistente), 409 `BOOKING_CONFLICT`, 500.

Quadra inativa: backend deve rejeitar com 400 `VALIDATION_ERROR` (`details.path = "courtId"`).

### PATCH /api/bookings/:id/status

Body (`updateBookingStatusSchema`): `{ "status": "CONFIRMED" }` (qualquer `BookingStatus`).

Response 200: `Booking` atualizado.

Regra: sair de `CANCELLED` para outro status exige re-checar conflito; se sobrepõe, 409 `BOOKING_CONFLICT`.

Status: 200, 400 `VALIDATION_ERROR`, 404 `NOT_FOUND`, 409 `BOOKING_CONFLICT`, 500.

### GET /api/products

Lista produtos do bar, ordenados por nome. Inclui inativos (`active: false`); o cliente deve oferecer só ativos.

```json
{ "data": [ { "id": "p1", "name": "Água 500ml", "price": 5, "active": true } ] }
```

Status: 200, 500.

### GET /api/orders

Query (`listOrdersQuerySchema`): `status` (`OPEN | PAID | CANCELLED`, opcional). Ordenado por `createdAt` decrescente.

Response 200:

```json
{ "data": [
  {
    "id": "o1", "bookingId": "b1", "customerName": "Ana", "status": "OPEN",
    "total": 17.5, "createdAt": "2026-11-02T21:10:00.000Z",
    "items": [
      { "id": "i1", "productId": "p1", "productName": "Água 500ml", "quantity": 2, "unitPrice": 5, "subtotal": 10 },
      { "id": "i2", "productId": "p2", "productName": "Isotônico", "quantity": 1, "unitPrice": 7.5, "subtotal": 7.5 }
    ]
  }
] }
```

Status: 200, 400 `VALIDATION_ERROR`, 500.

### POST /api/orders

Body (`createOrderSchema`):

| Campo | Tipo | Regra |
|---|---|---|
| `bookingId` | string | opcional; reserva deve existir |
| `customerName` | string | opcional; se ausente e houver `bookingId`, usa o cliente da reserva; senão `null` |
| `items` | array | 1 a 50 itens |
| `items[].productId` | string | produto existente e ativo |
| `items[].quantity` | integer | 1 a 999 |

`unitPrice` é copiado do produto no momento do pedido (mudança futura de preço não altera pedidos antigos). `subtotal = unitPrice * quantity`; `total` = soma dos subtotais, 2 casas. Status inicial `OPEN`. Preço/total enviados pelo cliente são ignorados.

Request:

```json
{ "bookingId": "b1", "items": [ { "productId": "p1", "quantity": 2 }, { "productId": "p2", "quantity": 1 } ] }
```

Response 201: objeto `Order` (como acima).

Status: 201, 400 `VALIDATION_ERROR` (produto inativo: `details.path = "items[n].productId"`), 404 `NOT_FOUND` (reserva ou produto inexistente), 500.

### GET /api/dashboard/summary

Query (`dashboardQuerySchema`): `date` (YYYY-MM-DD, opcional; default hoje em São Paulo).

Response 200:

```json
{ "data": {
  "date": "2026-11-02",
  "bookingsCount": 8,
  "occupancyRate": 0.3125,
  "revenue": 1045.5,
  "openOrdersCount": 3,
  "upcomingBookings": []
} }
```

`upcomingBookings` é `Booking[]`.

Campos:

- `bookingsCount`: reservas do dia não canceladas.
- `occupancyRate`: 0 a 1. Ver regra abaixo.
- `revenue`: ver regra abaixo, em reais.
- `openOrdersCount`: pedidos `OPEN` (todos os abertos, não só do dia).
- `upcomingBookings`: reservas não canceladas do dia com `endsAt` futuro, ordenadas por `startsAt` (máx. 10).

Status: 200, 400 `VALIDATION_ERROR`, 500.

## Regras de negócio

### Conflito de reservas

Duas reservas conflitam se são da **mesma quadra**, ambas **não `CANCELLED`**, e os intervalos se sobrepõem: `a.startsAt < b.endsAt && b.startsAt < a.endsAt`. Intervalos adjacentes (fim = início) não conflitam. Reservas canceladas não bloqueiam horário. Checagem e insert devem ser atômicos (transação) para evitar corrida.

### Duração e horário

- Duração: mínimo 30 min, múltiplos de 30 min, máximo 4 h.
- Início alinhado à grade de 30 min (`:00` ou `:30`, sem segundos/ms).
- Funcionamento: 07:00 a 23:00 (America/Sao_Paulo), 16 h por dia. Reserva não atravessa meia-noite.

### Cálculo de valores

- `Booking.price = Court.pricePerHour * (duração em minutos / 60)`, arredondado a 2 casas.
- `OrderItem.unitPrice` = `Product.price` no momento da criação; `subtotal = unitPrice * quantity`; `Order.total = soma(subtotal)`.

### Dashboard

- `revenue` = soma de `price` das reservas `CONFIRMED` ou `DONE` do dia local + soma de `total` dos pedidos `PAID` do dia local (por `createdAt`).
- `occupancyRate` = horas reservadas não canceladas no dia / (quadras ativas × 16 h). Sem quadras ativas = `0`. Limitado a 1.

## Helpers em `@marcai/shared`

- `validateBookingInterval`, `BOOKING_DURATION`, `BUSINESS_HOURS`, `TIMEZONE`, `toLocalParts`, `todayLocalDate`
- `moneySchema`, `roundMoney`
- `ApiResponse`, `ApiListResponse`, `ApiErrorResponse`, `ValidationIssue`, `HealthStatus`
