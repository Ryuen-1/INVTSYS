import { useCallback, useEffect, useMemo, useState } from 'react'

import { AdminUsersPage } from './AdminUsersPage'
import { useAuth } from './AuthContext'
import { DashboardSection, MasterDataSection, MovementsSection, ProductsSection, PurchaseOrdersSection, StockSection } from './pages'
import { LoginForm } from './LoginForm'
import type { Branch, Category, MovementRow, Product, PurchaseOrder, PurchaseOrderStatus, StockRow, Supplier } from './types'
import type { AppData, ActiveTab, MovementForm, ProductForm, PurchaseOrderForm, TableName } from './appTypes'
import { blankToNull, relation } from './utils/display'
import { supabase } from './utils/supabase'

const emptyData: AppData = { branches: [], categories: [], suppliers: [], products: [], stock: [], movements: [], purchaseOrders: [] }
const emptyProductForm: ProductForm = { sku: '', name: '', description: '', category_id: '', default_supplier_id: '', unit_price: '0', reorder_level: '0' }
const emptyMovementForm: MovementForm = { product_id: '', branch_id: '', movement_type: 'in', quantity: '1', notes: '' }
const emptyPurchaseOrderForm: PurchaseOrderForm = { supplier_id: '', branch_id: '', expected_date: '', notes: '', items: [{ product_id: '', quantity: '1', unit_cost: '0' }] }

function App() {
  const { user, profile, isLoading: isAuthLoading, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard')
  const [data, setData] = useState<AppData>(emptyData)
  const [productForm, setProductForm] = useState<ProductForm>(emptyProductForm)
  const [movementForm, setMovementForm] = useState<MovementForm>(emptyMovementForm)
  const [purchaseOrderForm, setPurchaseOrderForm] = useState<PurchaseOrderForm>(emptyPurchaseOrderForm)
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const canManage = profile?.role === 'admin' || profile?.role === 'manager'
  const canManageBranches = profile?.role === 'admin'
  const canManageUsers = profile?.role === 'admin'
  const navigationTabs: Array<[ActiveTab, string]> = profile?.role === 'admin'
    ? [['dashboard', 'Dashboard'], ['master-data', 'Master Data'], ['products', 'Products'], ['stock', 'Stock'], ['movements', 'Movements'], ['purchase-orders', 'Purchase Orders'], ['admin-users', 'Admin Users']]
    : profile?.role === 'manager'
      ? [['dashboard', 'Dashboard'], ['master-data', 'Master Data'], ['products', 'Products'], ['stock', 'Stock'], ['movements', 'Movements'], ['purchase-orders', 'Purchase Orders']]
      : [['dashboard', 'Dashboard'], ['stock', 'My Stock'], ['movements', 'Record Movement']]

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)
    const [branchesResult, categoriesResult, suppliersResult, productsResult, stockResult, movementsResult, purchaseOrdersResult] = await Promise.all([
      supabase.from('branches').select('id, name, address').order('name'),
      supabase.from('categories').select('id, name').order('name'),
      supabase.from('suppliers').select('id, name, contact_person, phone, email, address').order('name'),
      supabase.from('products').select('id, sku, name, description, category_id, default_supplier_id, unit_price, reorder_level, categories(name), suppliers(name)').order('name'),
      supabase.from('inventory_stock').select('id, product_id, branch_id, quantity, products(name, sku, reorder_level), branches(name)').order('quantity', { ascending: true }),
      supabase.from('stock_movements').select('id, movement_type, quantity, created_at, notes, products(name), branches(name)').order('created_at', { ascending: false }).limit(10),
      supabase.from('purchase_orders').select('id, supplier_id, branch_id, status, order_date, expected_date, notes, suppliers(name), branches(name), purchase_order_items(id, purchase_order_id, product_id, quantity, unit_cost, products(name, sku))').order('created_at', { ascending: false }),
    ])

    const firstError = branchesResult.error ?? categoriesResult.error ?? suppliersResult.error ?? productsResult.error ?? stockResult.error ?? movementsResult.error ?? purchaseOrdersResult.error
    if (firstError) {
      setData(emptyData)
      setErrorMessage(firstError.message)
    } else {
      setData({
        branches: (branchesResult.data ?? []) as Branch[],
        categories: (categoriesResult.data ?? []) as Category[],
        suppliers: (suppliersResult.data ?? []) as Supplier[],
        products: (productsResult.data ?? []) as unknown as Product[],
        stock: (stockResult.data ?? []) as unknown as StockRow[],
        movements: (movementsResult.data ?? []) as unknown as MovementRow[],
        purchaseOrders: (purchaseOrdersResult.data ?? []) as unknown as PurchaseOrder[],
      })
    }
    setIsLoading(false)
  }, [])

  useEffect(() => { if (user && profile) loadData() }, [loadData, profile, user])

  const lowStockRows = useMemo(() => buildStockRows(data.products, data.branches, data.stock, profile?.role, profile?.branch_id).filter((row) => {
    const reorderLevel = relation(row.products)?.reorder_level ?? 0
    return reorderLevel > 0 && row.quantity < reorderLevel
  }), [data.branches, data.products, data.stock, profile?.branch_id, profile?.role])
  const stockRows = useMemo(() => buildStockRows(data.products, data.branches, data.stock, profile?.role, profile?.branch_id), [data.branches, data.products, data.stock, profile?.branch_id, profile?.role])
  const movementBranches = useMemo(() => profile?.role === 'admin' ? data.branches : data.branches.filter((branch) => branch.id === profile?.branch_id), [data.branches, profile?.branch_id, profile?.role])

  useEffect(() => { if (!movementForm.branch_id && movementBranches.length > 0) setMovementForm((current) => ({ ...current, branch_id: movementBranches[0].id })) }, [movementBranches, movementForm.branch_id])
  useEffect(() => { if (!purchaseOrderForm.branch_id && movementBranches.length > 0) setPurchaseOrderForm((current) => ({ ...current, branch_id: movementBranches[0].id })) }, [movementBranches, purchaseOrderForm.branch_id])

  if (isAuthLoading) return <main className="loading-screen">Loading...</main>
  if (!user) return <LoginForm />

  async function saveMasterRecord(table: Exclude<TableName, 'products'>, values: Record<string, string | null>) {
    setNotice(null); setErrorMessage(null)
    const result = table === 'branches'
      ? await supabase.from('branches').insert({ name: values.name ?? '', address: values.address })
      : table === 'categories'
        ? await supabase.from('categories').insert({ name: values.name ?? '' })
        : await supabase.from('suppliers').insert({ name: values.name ?? '', contact_person: values.contact_person, phone: values.phone, email: values.email, address: values.address })
    if (result.error) { setErrorMessage(result.error.message); return }
    setNotice('Record added.'); await loadData()
  }

  async function deleteRecord(table: TableName, id: string) {
    setNotice(null); setErrorMessage(null)
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) { setErrorMessage(error.message); return }
    setNotice('Record deleted.'); await loadData()
  }

  async function updateMasterRecord(table: Exclude<TableName, 'products'>, id: string, values: Record<string, string | null>) {
    setNotice(null); setErrorMessage(null)
    const result = table === 'branches'
      ? await supabase.from('branches').update({ name: values.name ?? '', address: values.address }).eq('id', id)
      : table === 'categories'
        ? await supabase.from('categories').update({ name: values.name ?? '' }).eq('id', id)
        : await supabase.from('suppliers').update({ name: values.name ?? '', contact_person: values.contact_person, phone: values.phone, email: values.email, address: values.address }).eq('id', id)
    if (result.error) { setErrorMessage(result.error.message); return }
    setNotice('Record updated.'); await loadData()
  }

  async function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNotice(null); setErrorMessage(null)
    const payload = { sku: productForm.sku.trim(), name: productForm.name.trim(), description: blankToNull(productForm.description), category_id: blankToNull(productForm.category_id), default_supplier_id: blankToNull(productForm.default_supplier_id), unit_price: Number(productForm.unit_price || 0), reorder_level: Number(productForm.reorder_level || 0) }
    const request = editingProductId ? supabase.from('products').update(payload).eq('id', editingProductId) : supabase.from('products').insert(payload)
    const { error } = await request
    if (error) { setErrorMessage(error.message); return }
    setNotice(editingProductId ? 'Product updated.' : 'Product added.'); setEditingProductId(null); setProductForm(emptyProductForm); await loadData()
  }

  async function saveMovement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNotice(null); setErrorMessage(null)
    if (!user) { setErrorMessage('You need to be signed in to record stock movements.'); return }
    const quantity = Number(movementForm.quantity)
    if (!movementForm.product_id || !movementForm.branch_id || quantity <= 0) { setErrorMessage('Choose a product, branch, and quantity greater than zero.'); return }
    const { error } = await supabase.from('stock_movements').insert({ product_id: movementForm.product_id, branch_id: movementForm.branch_id, movement_type: movementForm.movement_type, quantity, notes: blankToNull(movementForm.notes), created_by: user.id })
    if (error) { setErrorMessage(error.message); return }
    setNotice('Stock movement recorded.'); setMovementForm({ ...emptyMovementForm, branch_id: movementBranches[0]?.id ?? '' }); await loadData()
  }

  async function savePurchaseOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNotice(null); setErrorMessage(null)
    if (!user) { setErrorMessage('You need to be signed in to create purchase orders.'); return }
    const validItems = purchaseOrderForm.items.map((item) => ({ product_id: item.product_id, quantity: Number(item.quantity), unit_cost: Number(item.unit_cost || 0) })).filter((item) => item.product_id && item.quantity > 0)
    if (!purchaseOrderForm.supplier_id || !purchaseOrderForm.branch_id || validItems.length === 0) { setErrorMessage('Choose a supplier, branch, and at least one line item.'); return }
    const { data: order, error: orderError } = await supabase.from('purchase_orders').insert({ supplier_id: purchaseOrderForm.supplier_id, branch_id: purchaseOrderForm.branch_id, expected_date: blankToNull(purchaseOrderForm.expected_date), notes: blankToNull(purchaseOrderForm.notes), created_by: user.id }).select('id').single()
    if (orderError) { setErrorMessage(orderError.message); return }
    const { error: itemsError } = await supabase.from('purchase_order_items').insert(validItems.map((item) => ({ purchase_order_id: order.id, product_id: item.product_id, quantity: item.quantity, unit_cost: item.unit_cost })))
    if (itemsError) { setErrorMessage(itemsError.message); return }
    setNotice('Purchase order created.'); setPurchaseOrderForm({ ...emptyPurchaseOrderForm, branch_id: movementBranches[0]?.id ?? '' }); await loadData()
  }

  async function updatePurchaseOrderStatus(order: PurchaseOrder, status: PurchaseOrderStatus) {
    setNotice(null); setErrorMessage(null)
    if (!user) { setErrorMessage('You need to be signed in to update purchase orders.'); return }
    const { error: updateError } = await supabase.from('purchase_orders').update({ status }).eq('id', order.id)
    if (updateError) { setErrorMessage(updateError.message); return }
    if (status === 'received' && order.status !== 'received') {
      const items = order.purchase_order_items ?? []
      if (items.length > 0) {
        const { error: movementError } = await supabase.from('stock_movements').insert(items.map((item) => ({ product_id: item.product_id, branch_id: order.branch_id, movement_type: 'in' as const, quantity: item.quantity, reference_type: 'purchase_order', reference_id: order.id, notes: `Received PO ${order.id.slice(0, 8)}`, created_by: user.id })))
        if (movementError) { setErrorMessage(movementError.message); return }
      }
    }
    setNotice(status === 'received' ? 'Purchase order received and stock updated.' : 'Purchase order updated.'); await loadData()
  }

  function startEditProduct(product: Product) {
    setEditingProductId(product.id)
    setProductForm({ sku: product.sku, name: product.name, description: product.description ?? '', category_id: product.category_id ?? '', default_supplier_id: product.default_supplier_id ?? '', unit_price: String(product.unit_price), reorder_level: String(product.reorder_level) })
  }

  return <main className="app-shell">
    <header className="top-bar"><div><p className="eyebrow">Supabase Inventory</p><h1>Inventory System</h1></div><div className="user-box"><strong>{profile?.full_name ?? user.email}</strong><span>{profile?.role ?? 'staff'}{relation(profile?.branches)?.name ? ` - ${relation(profile?.branches)?.name}` : ''}</span><button className="secondary-button" onClick={signOut} type="button">Sign out</button></div></header>
    <nav className="tab-bar" aria-label="Inventory sections">{navigationTabs.map(([tab, label]) => <button className={activeTab === tab ? 'active' : ''} key={tab} onClick={() => setActiveTab(tab)} type="button">{label}</button>)}</nav>
    {notice && <p className="notice">{notice}</p>}
    {errorMessage && <section className="empty-state setup-warning"><h2>Supabase message</h2><p>{errorMessage}</p></section>}
    {activeTab === 'dashboard' && <DashboardSection data={data} isLoading={isLoading} lowStockRows={lowStockRows} profileRole={profile?.role ?? 'staff'} scopeBranches={movementBranches} stockRows={stockRows} />}
    {activeTab === 'master-data' && <MasterDataSection canManage={canManage} canManageBranches={canManageBranches} data={data} onDelete={deleteRecord} onUpdate={updateMasterRecord} onSaveMaster={saveMasterRecord} />}
    {activeTab === 'products' && <ProductsSection canManage={canManage} data={data} editingProductId={editingProductId} form={productForm} onCancelEdit={() => { setEditingProductId(null); setProductForm(emptyProductForm) }} onChange={setProductForm} onDelete={(id) => deleteRecord('products', id)} onEdit={startEditProduct} onSubmit={saveProduct} />}
    {activeTab === 'stock' && <StockSection lowStockRows={lowStockRows} stock={stockRows} />}
    {activeTab === 'movements' && <MovementsSection branches={movementBranches} form={movementForm} movements={data.movements} onChange={setMovementForm} onSubmit={saveMovement} products={data.products} />}
    {activeTab === 'purchase-orders' && <PurchaseOrdersSection branches={movementBranches} canManage={canManage} form={purchaseOrderForm} onChange={setPurchaseOrderForm} onCreate={savePurchaseOrder} onStatusChange={updatePurchaseOrderStatus} orders={data.purchaseOrders} products={data.products} suppliers={data.suppliers} />}
    {activeTab === 'admin-users' && canManageUsers && <AdminUsersPage branches={data.branches} />}
  </main>
}

function buildStockRows(products: Product[], branches: Branch[], existingStock: StockRow[], role: string | undefined, branchId: string | null | undefined) {
  const visibleBranches = role === 'admin' ? branches : branches.filter((branch) => branch.id === branchId)
  const existingByProductBranch = new Map(existingStock.map((row) => [`${row.product_id}-${row.branch_id}`, row]))
  return products.flatMap((product) => visibleBranches.map((branch) => {
    const existing = existingByProductBranch.get(`${product.id}-${branch.id}`)
    return existing ?? { id: `${product.id}-${branch.id}`, product_id: product.id, branch_id: branch.id, quantity: 0, products: { name: product.name, sku: product.sku, reorder_level: product.reorder_level }, branches: { name: branch.name } }
  }))
}

export default App
