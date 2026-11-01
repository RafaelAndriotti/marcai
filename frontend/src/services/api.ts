import type {
  ApiErrorResponse,
  Booking,
  BookingStatus,
  Court,
  CreateBookingInput,
  CreateOrderInput,
  CreateProductInput,
  DashboardSummary,
  ErrorCode,
  Order,
  OrderStatus,
  Product,
  ProductCategory,
  UpdateProductInput,
} from '@marcai/shared'

const BASE = '/api'

/** Erro tipado da API. code = 'NETWORK_ERROR' quando não há resposta utilizável. */
export class ApiError extends Error {
  readonly code: ErrorCode | 'NETWORK_ERROR'
  readonly status: number
  readonly details?: unknown

  constructor(code: ApiError['code'], message: string, status: number, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.details = details
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new ApiError('NETWORK_ERROR', 'Não foi possível conectar ao servidor.', 0)
  }

  let body: unknown
  try {
    body = await res.json()
  } catch {
    body = undefined
  }

  if (!res.ok) {
    const err = (body as Partial<ApiErrorResponse> | undefined)?.error
    if (err) throw new ApiError(err.code, err.message, res.status, err.details)
    throw new ApiError(
      res.status >= 500 ? 'INTERNAL_ERROR' : 'NETWORK_ERROR',
      res.status >= 500 ? 'O servidor encontrou um erro.' : `Erro inesperado (${res.status}).`,
      res.status,
    )
  }
  if (!body || typeof body !== 'object' || !('data' in body)) {
    throw new ApiError('NETWORK_ERROR', 'Resposta inválida do servidor.', res.status)
  }
  return (body as { data: T }).data
}

function qs(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v)
  const s = sp.toString()
  return s ? `?${s}` : ''
}

export const getCourts = () => request<Court[]>('/courts')
export const getBookings = (date: string, courtId?: string) =>
  request<Booking[]>(`/bookings${qs({ date, courtId })}`)
export const createBooking = (input: CreateBookingInput) =>
  request<Booking>('/bookings', { method: 'POST', body: JSON.stringify(input) })
export const updateBookingStatus = (id: string, status: BookingStatus) =>
  request<Booking>(`/bookings/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
export const getProducts = (category?: ProductCategory) =>
  request<Product[]>(`/products${qs({ category })}`)
export const createProduct = (input: CreateProductInput) =>
  request<Product>('/products', { method: 'POST', body: JSON.stringify(input) })
export const updateProduct = (id: string, input: UpdateProductInput) =>
  request<Product>(`/products/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
export const getOrders = (filter: { status?: OrderStatus; date?: string } = {}) =>
  request<Order[]>(`/orders${qs(filter)}`)
export const updateOrderStatus = (id: string, status: 'PAID' | 'CANCELLED') =>
  request<Order>(`/orders/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
export const createOrder = (input: CreateOrderInput) =>
  request<Order>('/orders', { method: 'POST', body: JSON.stringify(input) })
export const getDashboardSummary = (date?: string) =>
  request<DashboardSummary>(`/dashboard/summary${qs({ date })}`)
