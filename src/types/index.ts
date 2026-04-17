export type OrderStatus =
  | 'submitted'
  | 'authorized'
  | 'picking'
  | 'ready'
  | 'partially_ready'
  | 'captured'
  | 'completed'
  | 'voided'
  | 'canceled'

export type ItemStatus =
  | 'requested'
  | 'found'
  | 'unavailable'
  | 'substituted'
  | 'refused_restricted'

export type SubstitutionPreference = 'none' | 'allow_similar'

export interface CartItem {
  productId: string
  name: string
  price: number
  qty: number
  restricted: boolean
}

export interface StoreInfo {
  id: string
  name: string
  location: string | null
  windowModeEnabled: boolean
  windowModeStart: string | null
  windowModeEnd: string | null
  timezone: string
}

export interface ProductInfo {
  id: string
  name: string
  category: string | null
  price: number
  nighttimeAvailable: boolean
  restrictedFlag: boolean
  imageUrl: string | null
}

export interface OrderSummary {
  id: string
  customerName: string
  customerPhone: string | null
  status: OrderStatus
  estimatedTotal: number
  finalTotal: number | null
  pickupCode: string
  pickupCodeQr: string | null
  substitutionPreference: SubstitutionPreference
  createdAt: string
  completedAt: string | null
  items: OrderItemSummary[]
}

export interface OrderItemSummary {
  id: string
  productId: string | null
  requestedName: string
  requestedPrice: number
  qtyRequested: number
  qtyFound: number
  finalPrice: number | null
  status: ItemStatus
  substitutionReason: string | null
}
