import { useEffect, useMemo, useState } from 'react';
import {
  buildMapSummary,
  buildSummary,
  createProduct,
  deleteProduct,
  getSettings,
  listProducts,
  listUsers,
  listenSales,
  updateProduct,
  updateSettings,
  updateUserActive,
  updateUserRole
} from '../services/firestoreService';

const emptyProduct = { name: '', type: 'HARD', totalQuantity: 0, costPrice: 0, sellPrice: 0 };

export default function AdminDashboard() {
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [sales, setSales] = useState([]);
  const [settings, setSettingsState] = useState({
    cuffEnabled: true,
    commissionType: 'PERCENTAGE',
    commissionValue: 5,
    personalUseMultiplier: 0.1
  });
  const [newProduct, setNewProduct] = useState(emptyProduct);
  const [editingProductId, setEditingProductId] = useState(null);
  const [message, setMessage] = useState('');

  const refreshCore = async () => {
    const [productData, userData, settingsData] = await Promise.all([
      listProducts(),
      listUsers(),
      getSettings()
    ]);
    setProducts(productData);
    setUsers(userData);
    setSettingsState(settingsData);
  };

  useEffect(() => {
    refreshCore();
    const unsub = listenSales(setSales);
    return () => unsub();
  }, []);

  const summary = useMemo(() => buildSummary(sales, products), [sales, products]);
  const mapSummary = useMemo(() => buildMapSummary(sales), [sales]);

  const saveSettings = async () => {
    await updateSettings({
      cuffEnabled: settings.cuffEnabled,
      commissionType: settings.commissionType,
      commissionValue: Number(settings.commissionValue),
      personalUseMultiplier: Number(settings.personalUseMultiplier)
    });
    setMessage('Settings updated.');
  };

  const saveProduct = async () => {
    const payload = {
      ...newProduct,
      totalQuantity: Number(newProduct.totalQuantity),
      costPrice: Number(newProduct.costPrice),
      sellPrice: Number(newProduct.sellPrice)
    };

    if (editingProductId) {
      await updateProduct(editingProductId, payload);
      setMessage('Product updated.');
    } else {
      await createProduct(payload);
      setMessage('Product created.');
    }

    setNewProduct(emptyProduct);
    setEditingProductId(null);
    await refreshCore();
  };

  const editProduct = (product) => {
    setEditingProductId(product.id);
    setNewProduct(product);
  };

  const removeProduct = async (id) => {
    await deleteProduct(id);
    setMessage('Product deleted.');
    await refreshCore();
  };

  const changeRole = async (userId, role) => {
    await updateUserRole(userId, role);
    await refreshCore();
    setMessage('User role updated.');
  };

  const toggleActive = async (userId, active) => {
    await updateUserActive(userId, active);
    await refreshCore();
    setMessage('User status updated.');
  };

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat title="Expected Revenue" value={`$${summary.totals.expectedRevenue.toFixed(2)}`} />
        <Stat title="Actual Received" value={`$${summary.totals.actualReceived.toFixed(2)}`} />
        <Stat title="Outstanding CUFF" value={`$${summary.totals.outstandingCuff.toFixed(2)}`} />
        <Stat title="Inventory Remaining" value={summary.inventoryRemaining.toFixed(1)} />
      </section>

      {message && <p className="rounded-lg bg-green-50 p-2 text-sm text-green-700">{message}</p>}

      <section className="rounded-xl bg-white p-4 shadow">
        <h3 className="font-semibold">Business Settings</h3>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={settings.cuffEnabled} onChange={(e) => setSettingsState({ ...settings, cuffEnabled: e.target.checked })} />
            Enable CUFF sales
          </label>
          <select className="rounded border p-2" value={settings.commissionType} onChange={(e) => setSettingsState({ ...settings, commissionType: e.target.value })}>
            <option value="PERCENTAGE">Commission: Percentage</option>
            <option value="FLAT">Commission: Flat</option>
          </select>
          <input className="rounded border p-2" value={settings.commissionValue} onChange={(e) => setSettingsState({ ...settings, commissionValue: e.target.value })} placeholder="Commission value" />
          <input className="rounded border p-2" value={settings.personalUseMultiplier} onChange={(e) => setSettingsState({ ...settings, personalUseMultiplier: e.target.value })} placeholder="Personal use multiplier" />
        </div>
        <button className="mt-3 rounded bg-blue-600 px-3 py-2 text-white" onClick={saveSettings}>Save Settings</button>
      </section>

      <section className="rounded-xl bg-white p-4 shadow">
        <h3 className="font-semibold">Products (Full Edit)</h3>
        <div className="mt-2 grid gap-2 md:grid-cols-5">
          <input className="rounded border p-2" placeholder="Name" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} />
          <select className="rounded border p-2" value={newProduct.type} onChange={(e) => setNewProduct({ ...newProduct, type: e.target.value })}>
            <option value="HARD">HARD</option>
            <option value="SOFT">SOFT</option>
          </select>
          <input className="rounded border p-2" type="number" step="0.1" placeholder="Qty" value={newProduct.totalQuantity} onChange={(e) => setNewProduct({ ...newProduct, totalQuantity: e.target.value })} />
          <input className="rounded border p-2" type="number" step="0.01" placeholder="Cost" value={newProduct.costPrice} onChange={(e) => setNewProduct({ ...newProduct, costPrice: e.target.value })} />
          <input className="rounded border p-2" type="number" step="0.01" placeholder="Sell" value={newProduct.sellPrice} onChange={(e) => setNewProduct({ ...newProduct, sellPrice: e.target.value })} />
        </div>
        <div className="mt-2 flex gap-2">
          <button className="rounded bg-blue-600 px-3 py-2 text-white" onClick={saveProduct}>{editingProductId ? 'Update Product' : 'Add Product'}</button>
          {editingProductId && <button className="rounded border px-3 py-2" onClick={() => { setEditingProductId(null); setNewProduct(emptyProduct); }}>Cancel Edit</button>}
        </div>

        <SimpleTable
          headers={['Name', 'Type', 'Qty', 'Cost', 'Sell', 'Actions']}
          rows={products.map((p) => [
            p.name,
            p.type,
            Number(p.totalQuantity).toFixed(1),
            `$${Number(p.costPrice).toFixed(2)}`,
            `$${Number(p.sellPrice).toFixed(2)}`,
            <div key={p.id} className="flex gap-2">
              <button className="rounded border px-2 py-1 text-xs" onClick={() => editProduct(p)}>Edit</button>
              <button className="rounded border px-2 py-1 text-xs text-red-600" onClick={() => removeProduct(p.id)}>Delete</button>
            </div>
          ])}
        />
      </section>

      <section className="rounded-xl bg-white p-4 shadow">
        <h3 className="font-semibold">Users (Role + Access Control)</h3>
        <SimpleTable
          headers={['Name', 'Email', 'Role', 'Active', 'Actions']}
          rows={users.map((u) => [
            u.name,
            u.email,
            u.role,
            u.active ? 'Yes' : 'No',
            <div key={u.uid} className="flex gap-2">
              <button className="rounded border px-2 py-1 text-xs" onClick={() => changeRole(u.uid, u.role === 'ADMIN' ? 'WORKER' : 'ADMIN')}>
                Make {u.role === 'ADMIN' ? 'Worker' : 'Admin'}
              </button>
              <button className="rounded border px-2 py-1 text-xs" onClick={() => toggleActive(u.uid, !u.active)}>
                {u.active ? 'Disable' : 'Enable'}
              </button>
            </div>
          ])}
        />
      </section>

      <section className="rounded-xl bg-white p-4 shadow">
        <h3 className="font-semibold">Sales Location Summary</h3>
        <p className="mb-2 text-sm text-slate-600">Click coordinates to open Google Maps.</p>
        <SimpleTable
          headers={['Coordinates', 'Transactions', 'Total Sales']}
          rows={mapSummary.map((m) => [
            <a key={m.key} className="text-blue-600 underline" target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${m.latitude},${m.longitude}`}>
              {m.latitude.toFixed(5)}, {m.longitude.toFixed(5)}
            </a>,
            m.transactions,
            `$${m.totalSales.toFixed(2)}`
          ])}
        />
      </section>
    </div>
  );
}

function Stat({ title, value }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow">
      <p className="text-xs text-slate-500">{title}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

function SimpleTable({ headers, rows }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr>
            {headers.map((h) => <th key={h} className="border-b p-2 text-left">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => <td key={j} className="border-b p-2 align-top">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
