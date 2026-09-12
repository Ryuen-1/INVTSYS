import { useEffect, useState } from 'react'

import { supabase } from './utils/supabase'

type InventoryItem = {
  id: number
  name: string
  sku: string | null
  quantity: number | null
  location: string | null
}

function App() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    async function getInventoryItems() {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id, name, sku, quantity, location')
        .order('name', { ascending: true })

      if (error) {
        setErrorMessage(error.message)
      } else {
        setItems(data ?? [])
      }

      setIsLoading(false)
    }

    getInventoryItems()
  }, [])

  return (
    <main className="app-shell">
      <section className="inventory-header">
        <div>
          <p className="eyebrow">Supabase Inventory</p>
          <h1>Inventory System</h1>
        </div>
        <div className="metric">
          <span>{items.length}</span>
          <small>items</small>
        </div>
      </section>

      <section className="inventory-panel" aria-live="polite">
        {isLoading && <p className="status-text">Loading inventory...</p>}

        {!isLoading && errorMessage && (
          <div className="empty-state">
            <h2>Connect your inventory table</h2>
            <p>{errorMessage}</p>
            <p>
              Create an <code>inventory_items</code> table in Supabase with
              readable rows, then refresh this app.
            </p>
          </div>
        )}

        {!isLoading && !errorMessage && items.length === 0 && (
          <div className="empty-state">
            <h2>No inventory yet</h2>
            <p>Add rows to your Supabase inventory table to see them here.</p>
          </div>
        )}

        {!isLoading && !errorMessage && items.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>SKU</th>
                <th>Quantity</th>
                <th>Location</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.sku ?? '-'}</td>
                  <td>{item.quantity ?? 0}</td>
                  <td>{item.location ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  )
}

export default App
