import type { Product, StockRow, MovementRow } from './types'
import { blankToNull, currency, relation } from './utils/display'

export function MasterPanel({
  title,
  headers,
  rows,
  fields,
  canManage,
  canDelete,
  onSubmit,
  onDelete,
  onUpdate,
}: {
  title: string
  headers: string[]
  rows: { id: string; values: string[] }[]
  fields: { name: string; label: string; required?: boolean; type?: string }[]
  canManage: boolean
  canDelete: boolean
  onSubmit: (values: Record<string, string | null>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onUpdate: (id: string, values: Record<string, string | null>) => Promise<void>
}) {
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = Object.fromEntries(
      fields.map((field) => [field.name, blankToNull(new FormData(form).get(field.name))]),
    )
    await onSubmit(values)
    form.reset()
  }

  async function handleEdit(row: { id: string; values: string[] }) {
    const entries = fields.map((field, index) => {
      const currentValue = row.values[index] === '-' ? '' : row.values[index]
      const nextValue = window.prompt(field.label, currentValue)
      return [field.name, nextValue === null ? currentValue : blankToNull(nextValue)]
    })

    await onUpdate(row.id, Object.fromEntries(entries))
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>{title}</h2>
        <span>{rows.length}</span>
      </div>
      {canManage && (
        <form className="form-grid" onSubmit={handleSubmit}>
          {fields.map((field) => (
            <label key={field.name}>
              {field.label}
              <input name={field.name} required={field.required} type={field.type ?? 'text'} />
            </label>
          ))}
          <button type="submit">Add {title.slice(0, -1)}</button>
        </form>
      )}
      <SimpleTable
        canDelete={canDelete}
        canEdit={canManage}
        emptyText={`No ${title.toLowerCase()} yet.`}
        headers={headers}
        onDelete={onDelete}
        onEdit={handleEdit}
        rows={rows}
      />
    </section>
  )
}

export function ProductsTable({
  products,
  canManage,
  onEdit,
  onDelete,
}: {
  products: Product[]
  canManage: boolean
  onEdit?: (product: Product) => void
  onDelete?: (id: string) => void
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Products</h2>
        <span>{products.length}</span>
      </div>
      {products.length === 0 ? (
        <p className="muted-text">No products yet.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>SKU</th><th>Name</th><th>Category</th><th>Supplier</th><th>Price</th><th>Reorder</th>
                {canManage && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>{product.sku}</td>
                  <td>{product.name}</td>
                  <td>{relation(product.categories)?.name ?? '-'}</td>
                  <td>{relation(product.suppliers)?.name ?? '-'}</td>
                  <td>{currency(product.unit_price)}</td>
                  <td>{product.reorder_level}</td>
                  {canManage && (
                    <td><div className="row-actions">
                      <button className="secondary-button" onClick={() => onEdit?.(product)} type="button">Edit</button>
                      <button className="danger-button" onClick={() => onDelete?.(product.id)} type="button">Delete</button>
                    </div></td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export function LowStockTable({ rows }: { rows: StockRow[] }) {
  return (
    <section className="panel">
      <div className="panel-header"><h2>Low Stock Alerts</h2><span>{rows.length}</span></div>
      <SimpleTable
        emptyText="No low stock items."
        headers={['Product', 'Branch', 'Qty', 'Reorder']}
        rowTone="warning"
        rows={rows.map((row) => ({
          id: row.id,
          values: [relation(row.products)?.name ?? '-', relation(row.branches)?.name ?? '-', String(row.quantity), String(relation(row.products)?.reorder_level ?? 0)],
        }))}
      />
    </section>
  )
}

export function MovementTable({ movements }: { movements: MovementRow[] }) {
  return (
    <section className="panel">
      <div className="panel-header"><h2>Recent Stock Movements</h2><span>{movements.length}</span></div>
      <SimpleTable
        emptyText="No stock movements yet."
        headers={['Product', 'Branch', 'Type', 'Qty', 'Date']}
        rows={movements.map((movement) => ({
          id: movement.id,
          values: [relation(movement.products)?.name ?? '-', relation(movement.branches)?.name ?? '-', movement.movement_type, String(movement.quantity), new Date(movement.created_at).toLocaleDateString()],
        }))}
      />
    </section>
  )
}

export function SimpleTable({
  headers,
  rows,
  emptyText,
  rowTone,
  canEdit = false,
  canDelete = false,
  onEdit,
  onDelete,
}: {
  headers: string[]
  rows: { id: string; values: string[] }[]
  emptyText: string
  rowTone?: 'warning'
  canEdit?: boolean
  canDelete?: boolean
  onEdit?: (row: { id: string; values: string[] }) => void
  onDelete?: (id: string) => void
}) {
  if (rows.length === 0) return <p className="muted-text">{emptyText}</p>

  return (
    <div className="table-wrap"><table><thead><tr>
      {headers.map((header) => <th key={header}>{header}</th>)}
      {(canEdit || canDelete) && <th>Actions</th>}
    </tr></thead><tbody>
      {rows.map((row) => <tr className={rowTone ? `row-${rowTone}` : undefined} key={row.id}>
        {row.values.map((cell, cellIndex) => <td key={`${row.id}-${cellIndex}`}>{cell}</td>)}
        {(canEdit || canDelete) && <td><div className="row-actions">
          {canEdit && <button className="secondary-button" onClick={() => onEdit?.(row)} type="button">Edit</button>}
          {canDelete && <button className="danger-button" onClick={() => onDelete?.(row.id)} type="button">Delete</button>}
        </div></td>}
      </tr>)}
    </tbody></table></div>
  )
}

export function MetricCard({ label, value, isLoading, tone = 'normal' }: { label: string; value: number; isLoading: boolean; tone?: 'normal' | 'warning' }) {
  return <article className={`metric-card ${tone}`}><span>{isLoading ? '...' : value}</span><small>{label}</small></article>
}

export function Field({ label, value, onChange, type = 'text', required, min, step }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; min?: string; step?: string }) {
  return <label>{label}<input min={min} onChange={(event) => onChange(event.target.value)} required={required} step={step} type={type} value={value} /></label>
}
