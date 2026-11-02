# API Marcaí

## Visão geral

API REST JSON do Marcaí: agendamento de quadras (vôlei, beach tennis, futevôlei) e controle de pedidos do bar (opcionalmente ligados a uma reserva), com cadastro de produtos, categorias e estoque.

- Prefixo: `/api`
- Content-Type: `application/json`
- Sem autenticação (fora de escopo).
- Tipos e schemas zod: pacote `@marcai/shared` (`shared/src`). Backend e frontend usam os mesmos schemas.

## Convenções

### Formato de resposta

Toda resposta de sucesso é um envelope `{ "data": ... }`.

- Recurso único: `ApiResponse<T>` = `{ "data": T }`
- Lista: `ApiListResponse<T>` = `{ "data": T[] }` (sem paginação por enquanto; listas retornam todos os itens do filtro)
- `DELETE` de produto responde `204` sem corpo.

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
| `PRODUCT_NAME_TAKEN` | 409 | já existe produto ativo com esse nome (case-insensitive) |
| `CATEGORY_NAME_TAKEN` | 409 | já existe categoria com esse nome (case-insensitive) |
| `CATEGORY_LIMIT_REACHED` | 409 | limite de 50 categorias atingido |
| `ORDER_NOT_OPEN` | 409 | pedido já pago ou cancelado |
| `INSUFFICIENT_STOCK` | 409 | estoque insuficiente para o pedido |
| `STOCK_CHANGED` | 409 | `expectedStockQuantity` diferente do estoque atual |
| `INTERNAL_ERROR` | 500 | erro inesperado |

### `details` em outros erros

`details` não é só lista de `ValidationIssue`. Formas usadas:

| Situação | Código | `details` |
|---|---|---|
| Produto inexistente em `POST /orders` | `NOT_FOUND` | `{ "productId": "<id>" }` |
| Produto inexistente ou excluído em `PATCH /products/:id` | `NOT_FOUND` | `{ "id": "<id>" }` |
| Produto inexistente ou já excluído em `DELETE /products/:id` | `NOT_FOUND` | `{ "id": "<id>" }` |
| Reserva inexistente (`bookingId` em `POST /orders`, `PATCH /bookings/:id/status`) | `NOT_FOUND` | ausente |
| Pedido inexistente em `PATCH /orders/:id/status` | `NOT_FOUND` | ausente |
| Pedido já pago ou cancelado em `PATCH /orders/:id/status` | `ORDER_NOT_OPEN` (409) | ausente |
| Estoque insuficiente em `POST /orders` | `INSUFFICIENT_STOCK` (409) | `{ "productId": "<id>", "available": <n> }` |
| `expectedStockQuantity` diferente do estoque em `PATCH /products/:id` | `STOCK_CHANGED` (409) | `{ "available": <n> }` |
| Categoria inexistente em `POST` ou `PATCH /products` | `VALIDATION_ERROR` | `[{ "path": "categoryId", "message": "category not found" }]` |
| Preço calculado fora de 0,01 a 100000 | `VALIDATION_ERROR` | `[{ "path": "price", "message": "calculated price must be between 0.01 and 100000" }]` |
| Erro inesperado | `INTERNAL_ERROR` | `{ "requestId": "<id>" }` (para correlacionar com logs) |
| Total do pedido acima de `MAX_MONEY` | `VALIDATION_ERROR` | `[{ "path": "total", "message": "order total is too large" }]` |
| Overflow numérico no banco (backstop) | `VALIDATION_ERROR` (400) | lista de `ValidationIssue` |

### Segurança

- Body JSON limitado a 16 kb (excedente rejeitado pelo parser de body).
- Respostas incluem cabeçalhos de segurança HTTP.
- Proteção contra DNS rebinding: requisição cujo header `Host` não é `127.0.0.1`, `localhost` ou `[::1]` (com ou sem porta) recebe `403`.

### Datas e timezone

- Instantes (`startsAt`, `endsAt`, `createdAt`): ISO 8601 com offset, ex. `2026-11-02T18:00:00-03:00` (`Z` também aceito). Entrada exige offset.
- Dias (`date`): `YYYY-MM-DD`, sempre dia **local** em `America/Sao_Paulo`.
- Filtro `date` cobre `[00:00, 24:00)` locais de São Paulo.
- `date` omitido em `/dashboard/summary` = hoje em São Paulo.

### Dinheiro

Reais como `number` com no máximo 2 casas (ex. `120.5`). Nunca centavos. Entrada com mais de 2 casas é rejeitada (comparação estrita, ex. `0.010000001` é inválido). Máximo `99999999.99` (`MAX_MONEY`; vale para `pricePerHour` e `costPrice`). O preço de venda de produto tem teto próprio (`MAX_PRODUCT_PRICE` = `100000`). A margem de produto é percentual, não monetária.

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
| GET | `/api/categories` | Lista categorias | 200 |
| POST | `/api/categories` | Cria categoria | 201 |
| GET | `/api/products` | Lista produtos (filtros `categoryId`, `status`) | 200 |
| POST | `/api/products` | Cria produto | 201 |
| PATCH | `/api/products/:id` | Edita produto | 200 |
| DELETE | `/api/products/:id` | Exclui produto (exclusão lógica) | 204 |
| GET | `/api/orders` | Lista pedidos (filtros `status`, `date`) | 200 |
| POST | `/api/orders` | Cria pedido (baixa estoque) | 201 |
| PATCH | `/api/orders/:id/status` | Marca pedido pago ou cancelado (cancelar devolve estoque) | 200 |
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
| `customerName` | string | obrigatório, trim, até 80 caracteres |
| `customerPhone` | string | obrigatório; deve casar com `^[0-9 ()+-]{8,20}$` (só dígitos, espaço, `(`, `)`, `+` e `-`; 8 a 20 caracteres) |
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

### GET /api/categories

Lista categorias, ordenadas por nome.

```json
{ "data": [
  { "id": "cat_bebida", "name": "Bebida" },
  { "id": "cat_comida", "name": "Comida" }
] }
```

Status: 200, 500.

### POST /api/categories

Body (`createCategorySchema`): `name`, obrigatório. Regras em [Categorias](#categorias).

Request:

```json
{ "name": "Sucos" }
```

Response 201: `{ "data": { "id": "cat_sucos", "name": "Sucos" } }`

Nome duplicado, response 409:

```json
{ "error": { "code": "CATEGORY_NAME_TAKEN", "message": "Já existe uma categoria com este nome" } }
```

Status: 201, 400 `VALIDATION_ERROR`, 409 `CATEGORY_NAME_TAKEN` ou `CATEGORY_LIMIT_REACHED`, 500.

### GET /api/products

Query (`listProductsQuerySchema`):

- `categoryId` (opcional).
- `status`: `active | inactive | all`, default `active`. Por padrão só retorna produtos ativos; `all` inclui excluídos (`active: false`).

Ordenado por nome.

```json
{ "data": [
  { "id": "p1", "name": "Água 500ml", "price": 5, "costPrice": 2.5, "profitMargin": 100,
    "stockQuantity": 48, "categoryId": "cat_bebida", "categoryName": "Bebida", "active": true }
] }
```

Status: 200, 400 `VALIDATION_ERROR` (`status` fora do enum), 500.

### POST /api/products

Body (`createProductSchema`):

| Campo | Tipo | Regra |
|---|---|---|
| `name` | string | obrigatório, normalizado para Unicode NFC e depois trim, 1 a 80 caracteres (limite vale para o nome normalizado); sem caracteres de controle ou de formatação invisíveis (`\p{Cc}`, `\p{Cf}`); único entre produtos ativos (ver abaixo) |
| `costPrice` | number | obrigatório, > 0, até 2 casas, máximo `99999999.99` |
| `profitMargin` | number | obrigatório, de 0 a 1000 (em %, ex. `35.5` = 35,5%), até 2 casas |
| `stockQuantity` | integer | obrigatório, de 0 a 1000000 |
| `categoryId` | string | obrigatório; categoria deve existir |

`price` (preço de venda) não é enviado: é calculado como `costPrice * (1 + profitMargin / 100)`, arredondado a 2 casas (HALF_UP). Resultado fora de 0,01 a 100000 é rejeitado com 400.

Produto criado com `active: true`.

Request:

```json
{ "name": "Isotônico", "costPrice": 4.9, "profitMargin": 83.67, "stockQuantity": 50, "categoryId": "cat_bebida" }
```

Response 201: `{ "data": { "id": "p2", "name": "Isotônico", "price": 9, "costPrice": 4.9, "profitMargin": 83.67, "stockQuantity": 50, "categoryId": "cat_bebida", "categoryName": "Bebida", "active": true } }`

Nome duplicado, response 409:

```json
{ "error": { "code": "PRODUCT_NAME_TAKEN", "message": "Já existe um produto com este nome" } }
```

Status: 201, 400 `VALIDATION_ERROR` (categoria inexistente: `details.path = "categoryId"`; preço calculado fora da faixa: `details.path = "price"`), 409 `PRODUCT_NAME_TAKEN`, 500.

### PATCH /api/products/:id

Body (`updateProductSchema`): qualquer subconjunto de `name`, `costPrice`, `profitMargin`, `stockQuantity`, `categoryId`, com as mesmas regras do POST, mais `expectedStockQuantity` (trava otimista, ver abaixo). Ao menos um campo é obrigatório (body vazio = 400 `VALIDATION_ERROR`). Campos ausentes não mudam.

- Enviar `costPrice` ou `profitMargin` recalcula `price`; o campo não enviado usa o valor atual.
- `stockQuantity` define o estoque diretamente.
- `expectedStockQuantity` só aplica a alteração se o estoque atual for igual a este valor; senão 409 `STOCK_CHANGED`. Pode ser enviado sozinho, como checagem.
- Produto excluído não é editável (404).

`active` não é editável por aqui; exclusão é feita pelo `DELETE`.

Request: `{ "costPrice": 5, "profitMargin": 90 }` (`price` passa a ser 9,5)

Response 200: `Product` atualizado.

Alterar `costPrice` ou `profitMargin` **não** altera pedidos existentes: `OrderItem.unitPrice` é copiado na criação do pedido.

Status: 200, 400 `VALIDATION_ERROR`, 404 `NOT_FOUND` (produto inexistente ou excluído; `details.id`), 409 `PRODUCT_NAME_TAKEN` (novo nome já usado por outro produto ativo; renomear para o próprio nome ou mudar só caixa do próprio nome é permitido), 409 `STOCK_CHANGED` (`details.available`), 500.

### DELETE /api/products/:id

Exclusão lógica: marca `active = false`. Sem corpo.

- Some da lista padrão (aparece com `status=inactive` ou `all`).
- Não entra em pedidos novos (400, `items[n].productId`); pedidos antigos mantêm o item.
- Libera o nome para outro produto.

Status: 204, 404 `NOT_FOUND` (inexistente ou já excluído; `details.id`), 500.

### GET /api/orders

Query (`listOrdersQuerySchema`): `status` (`OPEN | PAID | CANCELLED`, opcional); `date` (YYYY-MM-DD, opcional; dia local de criação em São Paulo). Ordenado por `createdAt` decrescente.

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
| `bookingId` | string | opcional, até 64 caracteres; reserva deve existir e não estar cancelada |
| `customerName` | string | opcional, trim, 1 a 80 caracteres; se ausente e houver `bookingId`, usa o cliente da reserva; senão `null` |
| `items` | array | 1 a 50 itens; `productId` não pode se repetir |
| `items[].productId` | string | até 64 caracteres; produto existente e ativo |
| `items[].quantity` | integer | 1 a 999 |

`unitPrice` é copiado do produto no momento do pedido (mudança futura de preço não altera pedidos antigos). `subtotal = unitPrice * quantity`; `total` = soma dos subtotais, 2 casas. Status inicial `OPEN`. Preço/total enviados pelo cliente são ignorados.

Criar o pedido baixa `stockQuantity` de cada produto, na mesma transação. Se algum produto não tiver estoque para a quantidade pedida (somada por produto), 409 `INSUFFICIENT_STOCK`.

Uso pela UI:

- Avulso: enviar `customerName` sem `bookingId`. Vinculado: enviar `bookingId` (`customerName` opcional, herda da reserva). Os dois podem ser enviados juntos; `customerName` explícito prevalece. Sem nenhum dos dois, o pedido é criado com `customerName: null`.
- `productId` duplicado em `items` é rejeitado com 400 `VALIDATION_ERROR` (`details.path = "items"`); o cliente deve somar as quantidades em um único item.
- Não há inclusão de itens em pedido aberto nem forma de pagamento nesta entrega.

Request:

```json
{ "bookingId": "b1", "items": [ { "productId": "p1", "quantity": 2 }, { "productId": "p2", "quantity": 1 } ] }
```

Response 201: objeto `Order` (como acima).

Status: 201, 400 `VALIDATION_ERROR` (reserva cancelada: `details.path = "bookingId"`; produto inativo: `details.path = "items[n].productId"`; total do pedido acima de `MAX_MONEY`: `details.path = "total"`, mensagem "order total is too large"), 404 `NOT_FOUND` (reserva sem `details`; produto com `details.productId`), 409 `INSUFFICIENT_STOCK` (`details.productId`, `details.available`), 500.

### PATCH /api/orders/:id/status

Body (`updateOrderStatusSchema`): `{ "status": "PAID" }` ou `{ "status": "CANCELLED" }`. Só pedido `OPEN` muda; `PAID` e `CANCELLED` são finais.

`CANCELLED` devolve ao estoque as quantidades do pedido. `PAID` não mexe no estoque.

Response 200: `Order` atualizado.

Status: 200, 400 `VALIDATION_ERROR` (status fora de `PAID | CANCELLED`), 404 `NOT_FOUND`, 409 `ORDER_NOT_OPEN`, 500.

O faturamento do dashboard soma pedidos `PAID` pela data de **criação** do pedido.

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
- `Product.price = costPrice * (1 + profitMargin / 100)`, arredondado a 2 casas (HALF_UP); recalculado quando `costPrice` ou `profitMargin` muda.
- `OrderItem.unitPrice` = `Product.price` no momento da criação (editar o preço depois não afeta pedidos já feitos); `subtotal = unitPrice * quantity`; `Order.total = soma(subtotal)`.

### Dashboard

- `revenue` = soma de `price` das reservas `CONFIRMED` ou `DONE` do dia local + soma de `total` dos pedidos `PAID` do dia local (por `createdAt`).
- `occupancyRate` = horas reservadas não canceladas no dia / (quadras ativas × 16 h). Sem quadras ativas = `0`. Limitado a 1.

### Categorias

- Nome: 1 a 40 caracteres, normalizado para NFKC e depois trim; sem caracteres de controle ou de formatação invisíveis. Mesmas regras de nome de produto.
- Nome único, case-insensitive → 409 `CATEGORY_NAME_TAKEN`.
- Limite de 50 categorias (`MAX_CATEGORIES`) → 409 `CATEGORY_LIMIT_REACHED`.
- Não há `PATCH` nem `DELETE` de categoria. Produto não pode ficar sem categoria.

### Produtos

- Nome único entre produtos **ativos**, case-insensitive após trim (`Água` e `água` colidem) → 409 `PRODUCT_NAME_TAKEN`. Produto excluído (inativo) libera o nome.
- Estoque: `stockQuantity` é inteiro >= 0. Criar pedido baixa; cancelar pedido devolve; pagar não altera. `PATCH` com `stockQuantity` sobrescreve o valor; use `expectedStockQuantity` para não sobrescrever alteração concorrente.
- Exclusão é lógica (`active = false`); ver `DELETE /api/products/:id`.
- Deploy: os índices únicos de nome (produtos e categorias) usam `lower(name)` e exigem banco com locale UTF-8 (ex. `en_US.utf8`). Com locale `C`/`POSIX`, letras não ASCII não são convertidas para minúsculas e a unicidade case-insensitive falha para elas.
- A migration do índice de produtos falha se já existirem nomes que diferem só por caixa; deduplicar antes de aplicar.
- Migration de categorias: produtos antigos foram ligados às categorias `Bebida`, `Comida` e `Outro`, conforme o antigo enum `BEBIDA | COMIDA | OUTRO`.

## Helpers em `@marcai/shared`

- `validateBookingInterval`, `BOOKING_DURATION`, `BUSINESS_HOURS_MINUTES`, `TIMEZONE`, `toLocalParts`, `todayLocalDate`
- `moneySchema`, `roundMoney`, `MAX_MONEY`, `MAX_PRODUCT_PRICE`, `MAX_CATEGORIES`
- `ApiResponse`, `ApiListResponse`, `ApiErrorResponse`, `ValidationIssue`, `HealthStatus`, `ERROR_CODES`
