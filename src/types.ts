export type UserRole = 'admin' | 'manager' | 'staff'

export type Profile = {
  id: string
  full_name: string | null
  role: UserRole
  branch_id: string | null
  branches?:
    | {
        name: string
      }
    | {
        name: string
      }[]
    | null
}

export type Product = {
  id: string
  sku: string
  name: string
  description: string | null
  category_id: string | null
  default_supplier_id: string | null
  unit_price: number
  reorder_level: number
  categories?:
    | {
        name: string
      }
    | {
        name: string
      }[]
    | null
  suppliers?:
    | {
        name: string
      }
    | {
        name: string
      }[]
    | null
}

export type StockRow = {
  id: string
  product_id?: string
  branch_id?: string
  quantity: number
  products:
    | {
        name: string
        sku: string
        reorder_level: number
      }
    | {
        name: string
        sku: string
        reorder_level: number
      }[]
    | null
  branches:
    | {
        name: string
      }
    | {
        name: string
      }[]
    | null
}

export type MovementRow = {
  id: string
  movement_type: 'in' | 'out' | 'adjustment'
  quantity: number
  created_at: string
  notes: string | null
  products:
    | {
        name: string
      }
    | {
        name: string
      }[]
    | null
  branches:
    | {
        name: string
      }
    | {
        name: string
      }[]
    | null
}

export type Branch = {
  id: string
  name: string
  address: string | null
}

export type AdminUser = {
  id: string
  email: string
  created_at: string
  last_sign_in_at: string | null
  email_confirmed_at: string | null
  full_name: string | null
  role: UserRole
  branch_id: string | null
}

export type Category = {
  id: string
  name: string
}

export type Supplier = {
  id: string
  name: string
  contact_person: string | null
  phone: string | null
  email: string | null
  address: string | null
}

export type PurchaseOrderStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'received'
  | 'cancelled'

export type PurchaseOrderItem = {
  id: string
  purchase_order_id: string
  product_id: string
  quantity: number
  unit_cost: number
  products:
    | {
        name: string
        sku: string
      }
    | {
        name: string
        sku: string
      }[]
    | null
}

export type PurchaseOrder = {
  id: string
  supplier_id: string
  branch_id: string
  status: PurchaseOrderStatus
  order_date: string
  expected_date: string | null
  notes: string | null
  suppliers:
    | {
        name: string
      }
    | {
        name: string
      }[]
    | null
  branches:
    | {
        name: string
      }
    | {
        name: string
      }[]
    | null
  purchase_order_items?: PurchaseOrderItem[]
}
