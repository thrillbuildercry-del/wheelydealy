import { addDoc, collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { FormEvent, useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { Product } from '../types';

const empty = { name: '', type: 'hard', total_quantity: 0, cost_price: 0, sell_price: 0 };

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<typeof empty>(empty);

  useEffect(() => {
    return onSnapshot(collection(db, 'products'), (snap) => {
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product)));
    });
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await addDoc(collection(db, 'products'), {
      ...form,
      total_quantity: Number(form.total_quantity),
      cost_price: Number(form.cost_price),
      sell_price: Number(form.sell_price)
    });
    setForm(empty);
  };

  const adjustInventory = async (product: Product, change: number) => {
    await updateDoc(doc(db, 'products', product.id), { total_quantity: product.total_quantity + change });
    await addDoc(collection(db, 'inventory_logs'), { product_id: product.id, change_amount: change, reason: 'adjustment', timestamp: new Date().toISOString() });
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <form onSubmit={onSubmit} className="card space-y-2">
        <h2 className="font-semibold">Create Product</h2>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" required />
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as 'hard' | 'soft' })}>
          <option value="hard">hard</option>
          <option value="soft">soft</option>
        </select>
        <input type="number" step="0.1" value={form.total_quantity} onChange={(e) => setForm({ ...form, total_quantity: Number(e.target.value) })} placeholder="Total quantity" required />
        <input type="number" step="0.01" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: Number(e.target.value) })} placeholder="Cost price" required />
        <input type="number" step="0.01" value={form.sell_price} onChange={(e) => setForm({ ...form, sell_price: Number(e.target.value) })} placeholder="Sell price" required />
        <button className="bg-blue-600 text-white">Save</button>
      </form>
      <div className="card">
        <h2 className="mb-2 font-semibold">Manage Products</h2>
        <ul className="space-y-2">
          {products.map((p) => (
            <li key={p.id} className="rounded-lg border p-2">
              <p className="font-medium">{p.name} ({p.type})</p>
              <p>Qty: {p.total_quantity} | CP: {p.cost_price} | SP: {p.sell_price}</p>
              <div className="mt-2 flex gap-2">
                <button onClick={() => adjustInventory(p, 1)}>+1</button>
                <button onClick={() => adjustInventory(p, -1)}>-1</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
