import type { Branch, MovementRow, Product, PurchaseOrder, PurchaseOrderStatus, StockRow, Supplier } from './types'
import type { AppData, MovementForm, ProductForm, PurchaseOrderDraftItem, PurchaseOrderForm, TableName } from './appTypes'
import { Field, LowStockTable, MasterPanel, MetricCard, MovementTable, ProductsTable } from './components'
import { currency, relation } from './utils/display'

export function DashboardSection({ data, isLoading, lowStockRows, profileRole, scopeBranches, stockRows }: { data: AppData; isLoading: boolean; lowStockRows: StockRow[]; profileRole: string; scopeBranches: Branch[]; stockRows: StockRow[] }) {
  const totalQuantity = stockRows.reduce((sum, row) => sum + row.quantity, 0)
  const scopeLabel = profileRole === 'admin' ? 'All branches' : relation(scopeBranches[0])?.name ?? 'No branch assigned'
  const isStaff = profileRole === 'staff'
  const scopeDescription = profileRole === 'admin'
    ? 'Full system oversight'
    : profileRole === 'manager'
      ? 'Branch operations overview'
      : 'Daily stock workspace'
  return <>
    <section className="scope-strip"><strong>{scopeLabel}</strong><span>{scopeDescription}</span></section>
    <section className="metrics-grid" aria-live="polite">
      <MetricCard isLoading={isLoading} label="Products" value={data.products.length} />
      <MetricCard isLoading={isLoading} label={isStaff ? 'My Branch' : 'Branches'} value={scopeBranches.length} />
      <MetricCard isLoading={isLoading} label="Low Stock" tone={lowStockRows.length > 0 ? 'warning' : 'normal'} value={lowStockRows.length} />
      <MetricCard isLoading={isLoading} label="Units On Hand" value={totalQuantity} />
    </section>
    <section className="content-grid">{!isStaff && <ProductsTable canManage={false} products={data.products} />}<LowStockTable rows={lowStockRows} /></section>
    <MovementTable movements={data.movements} />
  </>
}

export function MasterDataSection({ canManage, canManageBranches, data, onDelete, onUpdate, onSaveMaster }: { canManage: boolean; canManageBranches: boolean; data: AppData; onDelete: (table: TableName, id: string) => Promise<void>; onUpdate: (table: Exclude<TableName, 'products'>, id: string, values: Record<string, string | null>) => Promise<void>; onSaveMaster: (table: Exclude<TableName, 'products'>, values: Record<string, string | null>) => Promise<void> }) {
  return <section className="stack">
    <MasterPanel canDelete={canManageBranches} canManage={canManageBranches} fields={[{ name: 'name', label: 'Branch name', required: true }, { name: 'address', label: 'Address' }]} headers={['Name', 'Address']} onDelete={(id) => onDelete('branches', id)} onUpdate={(id, values) => onUpdate('branches', id, values)} onSubmit={(values) => onSaveMaster('branches', values)} rows={data.branches.map((branch) => ({ id: branch.id, values: [branch.name, branch.address ?? '-'] }))} title="Branches" />
    <MasterPanel canDelete={canManage} canManage={canManage} fields={[{ name: 'name', label: 'Category name', required: true }]} headers={['Name']} onDelete={(id) => onDelete('categories', id)} onUpdate={(id, values) => onUpdate('categories', id, values)} onSubmit={(values) => onSaveMaster('categories', values)} rows={data.categories.map((category) => ({ id: category.id, values: [category.name] }))} title="Categories" />
    <MasterPanel canDelete={canManage} canManage={canManage} fields={[{ name: 'name', label: 'Supplier name', required: true }, { name: 'contact_person', label: 'Contact person' }, { name: 'phone', label: 'Phone' }, { name: 'email', label: 'Email', type: 'email' }, { name: 'address', label: 'Address' }]} headers={['Name', 'Contact', 'Phone', 'Email', 'Address']} onDelete={(id) => onDelete('suppliers', id)} onUpdate={(id, values) => onUpdate('suppliers', id, values)} onSubmit={(values) => onSaveMaster('suppliers', values)} rows={data.suppliers.map((supplier) => ({ id: supplier.id, values: [supplier.name, supplier.contact_person ?? '-', supplier.phone ?? '-', supplier.email ?? '-', supplier.address ?? '-'] }))} title="Suppliers" />
  </section>
}

export function ProductsSection({ canManage, data, editingProductId, form, onCancelEdit, onChange, onDelete, onEdit, onSubmit }: { canManage: boolean; data: AppData; editingProductId: string | null; form: ProductForm; onCancelEdit: () => void; onChange: (form: ProductForm) => void; onDelete: (id: string) => void; onEdit: (product: Product) => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void> }) {
  return <section className="stack">
    {canManage && <section className="panel"><div className="panel-header"><h2>{editingProductId ? 'Edit Product' : 'Add Product'}</h2></div><form className="form-grid product-form" onSubmit={onSubmit}>
      <Field label="SKU" onChange={(value) => onChange({ ...form, sku: value })} required value={form.sku} />
      <Field label="Name" onChange={(value) => onChange({ ...form, name: value })} required value={form.name} />
      <Field label="Description" onChange={(value) => onChange({ ...form, description: value })} value={form.description} />
      <label>Category<select onChange={(event) => onChange({ ...form, category_id: event.target.value })} value={form.category_id}><option value="">No category</option>{data.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <label>Supplier<select onChange={(event) => onChange({ ...form, default_supplier_id: event.target.value })} value={form.default_supplier_id}><option value="">No supplier</option>{data.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
      <Field label="Unit price" min="0" onChange={(value) => onChange({ ...form, unit_price: value })} step="0.01" type="number" value={form.unit_price} />
      <Field label="Reorder level" min="0" onChange={(value) => onChange({ ...form, reorder_level: value })} type="number" value={form.reorder_level} />
      <div className="form-actions"><button type="submit">{editingProductId ? 'Save product' : 'Add product'}</button>{editingProductId && <button className="secondary-button" onClick={onCancelEdit} type="button">Cancel</button>}</div>
    </form></section>}
    <ProductsTable canManage={canManage} onDelete={onDelete} onEdit={onEdit} products={data.products} />
  </section>
}

export function StockSection({ stock, lowStockRows }: { stock: StockRow[]; lowStockRows: StockRow[] }) {
  const lowStockIds = new Set(lowStockRows.map((row) => row.id))
  return <section className="panel"><div className="panel-header"><h2>Stock Per Branch</h2><span>{stock.length}</span></div>{stock.length === 0 ? <p className="muted-text">No stock rows yet. Stock appears after movements are recorded.</p> : <div className="table-wrap"><table><thead><tr><th>SKU</th><th>Product</th><th>Branch</th><th>Quantity</th><th>Reorder</th></tr></thead><tbody>{stock.map((row) => <tr className={lowStockIds.has(row.id) ? 'row-warning' : undefined} key={row.id}><td>{relation(row.products)?.sku ?? '-'}</td><td>{relation(row.products)?.name ?? '-'}</td><td>{relation(row.branches)?.name ?? '-'}</td><td>{row.quantity}</td><td>{relation(row.products)?.reorder_level ?? 0}</td></tr>)}</tbody></table></div>}</section>
}

export function MovementsSection({ products, branches, movements, form, onChange, onSubmit }: { products: Product[]; branches: Branch[]; movements: MovementRow[]; form: MovementForm; onChange: (form: MovementForm) => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void> }) {
  return <section className="stack"><section className="panel"><div className="panel-header"><h2>Record Stock Movement</h2></div><form className="form-grid product-form" onSubmit={onSubmit}>
    <label>Product<select onChange={(event) => onChange({ ...form, product_id: event.target.value })} required value={form.product_id}><option value="">Choose product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.sku} - {product.name}</option>)}</select></label>
    <label>Branch<select onChange={(event) => onChange({ ...form, branch_id: event.target.value })} required value={form.branch_id}><option value="">Choose branch</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
    <label>Type<select onChange={(event) => onChange({ ...form, movement_type: event.target.value as MovementForm['movement_type'] })} value={form.movement_type}><option value="in">Stock in</option><option value="out">Stock out</option><option value="adjustment">Adjustment</option></select></label>
    <Field label="Quantity" min="1" onChange={(value) => onChange({ ...form, quantity: value })} required type="number" value={form.quantity} />
    <Field label="Notes" onChange={(value) => onChange({ ...form, notes: value })} value={form.notes} />
    <div className="form-actions"><button disabled={products.length === 0 || branches.length === 0} type="submit">Record movement</button></div>
  </form></section><MovementTable movements={movements} /></section>
}

export function PurchaseOrdersSection({ suppliers, branches, products, orders, form, canManage, onChange, onCreate, onStatusChange }: { suppliers: Supplier[]; branches: Branch[]; products: Product[]; orders: PurchaseOrder[]; form: PurchaseOrderForm; canManage: boolean; onChange: (form: PurchaseOrderForm) => void; onCreate: (event: React.FormEvent<HTMLFormElement>) => Promise<void>; onStatusChange: (order: PurchaseOrder, status: PurchaseOrderStatus) => Promise<void> }) {
  function updateItem(index: number, nextItem: PurchaseOrderDraftItem) {
    onChange({ ...form, items: form.items.map((item, itemIndex) => itemIndex === index ? nextItem : item) })
  }

  return <section className="stack">{canManage && <section className="panel"><div className="panel-header"><h2>Create Purchase Order</h2></div><form className="po-form" onSubmit={onCreate}>
    <div className="form-grid"><label>Supplier<select onChange={(event) => onChange({ ...form, supplier_id: event.target.value })} required value={form.supplier_id}><option value="">Choose supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label><label>Branch<select onChange={(event) => onChange({ ...form, branch_id: event.target.value })} required value={form.branch_id}><option value="">Choose branch</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label><Field label="Expected date" onChange={(value) => onChange({ ...form, expected_date: value })} type="date" value={form.expected_date} /><Field label="Notes" onChange={(value) => onChange({ ...form, notes: value })} value={form.notes} /></div>
    <div className="line-items"><div className="line-items-header"><h3>Line Items</h3><button className="secondary-button" onClick={() => onChange({ ...form, items: [...form.items, { product_id: '', quantity: '1', unit_cost: '0' }] })} type="button">Add line</button></div>{form.items.map((item, index) => <div className="line-item-row" key={index}><label>Product<select onChange={(event) => updateItem(index, { ...item, product_id: event.target.value })} required value={item.product_id}><option value="">Choose product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.sku} - {product.name}</option>)}</select></label><Field label="Quantity" min="1" onChange={(value) => updateItem(index, { ...item, quantity: value })} required type="number" value={item.quantity} /><Field label="Unit cost" min="0" onChange={(value) => updateItem(index, { ...item, unit_cost: value })} step="0.01" type="number" value={item.unit_cost} /><button className="danger-button" disabled={form.items.length === 1} onClick={() => onChange({ ...form, items: form.items.filter((_, itemIndex) => itemIndex !== index) })} type="button">Remove</button></div>)}</div>
    <div className="form-actions padded-actions"><button disabled={suppliers.length === 0 || branches.length === 0 || products.length === 0} type="submit">Create purchase order</button></div>
  </form></section>}
  <section className="panel"><div className="panel-header"><h2>Purchase Orders</h2><span>{orders.length}</span></div>{orders.length === 0 ? <p className="muted-text">No purchase orders yet.</p> : <div className="table-wrap"><table><thead><tr><th>Supplier</th><th>Branch</th><th>Status</th><th>Expected</th><th>Items</th><th>Total</th></tr></thead><tbody>{orders.map((order) => { const items = order.purchase_order_items ?? []; const total = items.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0); return <tr key={order.id}><td>{relation(order.suppliers)?.name ?? '-'}</td><td>{relation(order.branches)?.name ?? '-'}</td><td>{canManage ? <select className="compact-select" onChange={(event) => onStatusChange(order, event.target.value as PurchaseOrderStatus)} value={order.status}>{['draft', 'pending', 'approved', 'received', 'cancelled'].map((status) => <option key={status} value={status}>{status}</option>)}</select> : order.status}</td><td>{order.expected_date ?? '-'}</td><td>{items.length === 0 ? '-' : items.map((item) => `${relation(item.products)?.sku ?? 'Item'} x ${item.quantity}`).join(', ')}</td><td>{currency(total)}</td></tr> })}</tbody></table></div>}</section>
  </section>
}
