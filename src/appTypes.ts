import type {
  Branch,
  Category,
  MovementRow,
  Product,
  PurchaseOrder,
  StockRow,
  Supplier,
} from './types'

export type ActiveTab =
  | 'dashboard'
  | 'master-data'
  | 'products'
  | 'stock'
  | 'movements'
  | 'purchase-orders'
  | 'admin-users'

export type TableName = 'branches' | 'categories' | 'suppliers' | 'products'

export type AppData = {
  branches: Branch[]
  categories: Category[]
  suppliers: Supplier[]
  products: Product[]
  stock: StockRow[]
  movements: MovementRow[]
  purchaseOrders: PurchaseOrder[]
}

export type ProductForm = {
  sku: string
  name: string
  description: string
  category_id: string
  default_supplier_id: string
  unit_price: string
  reorder_level: string
}

export type MovementForm = {
  product_id: string
  branch_id: string
  movement_type: 'in' | 'out' | 'adjustment'
  quantity: string
  notes: string
}

export type PurchaseOrderDraftItem = {
  product_id: string
  quantity: string
  unit_cost: string
}

export type PurchaseOrderForm = {
  supplier_id: string
  branch_id: string
  expected_date: string
  notes: string
  items: PurchaseOrderDraftItem[]
}
