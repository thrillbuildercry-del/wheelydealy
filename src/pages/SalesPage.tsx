import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase';
import { Product, Settings } from '../types';
import { useAuth } from '../contexts/AuthContext';

const decimalPattern = /^\d+(\.\d)?$/;

export default function SalesPage() {
  const { user, role } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [type, setType] = useState<'hard' | 'soft'>('hard');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [amountReceived, setAmountReceived] = useState('');
  const [cuff, setCuff] = useState(false);
  const [personalUse, setPersonalUse] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    return onSnapshot(query(collection(db, 'products'), where('type', '==', type)), (snap) =>
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product))));
  }, [type]);

  useEffect(() => {
    return onSnapshot(collection(db, 'settings'), (snap) => setSettings((snap.docs[0]?.data() as Settings) ?? null));
  }, []);

  const selected = useMemo(() => products.find((p) => p.id === productId), [products, productId]);

  const submitSale = async () => {
    if (!user || !selected || !decimalPattern.test(quantity)) {
      setMsg('Invalid sale payload. Quantity must have 1 decimal place max.');
      return;
    }

    const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true })
    );

    const callable = httpsCallable(functions, 'createSale');
    await callable({
      product_id: selected.id,
      quantity: Number(quantity),
      amount_received: cuff ? 0 : Number(amountReceived || 0),
      cuff,
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      personal_use: role === 'admin' ? personalUse : false
    });

    setQuantity('');
    setAmountReceived('');
    setCuff(false);
    setShowModal(false);
    setMsg('Sale created');
  };

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <h2 className="text-lg font-semibold">Fast Sale Entry</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <select value={type} onChange={(e) => setType(e.target.value as 'hard' | 'soft')}>
            <option value="hard">Hard</option>
            <option value="soft">Soft</option>
          </select>
          <select value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">Select product</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.total_quantity})</option>)}
          </select>
          <input placeholder="Quantity (1 decimal max)" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          {role === 'admin' && (
            <label className="flex items-center gap-2 border-0">
              <input type="checkbox" checked={personalUse} onChange={(e) => setPersonalUse(e.target.checked)} />
              Personal use
            </label>
          )}
        </div>
        <button className="bg-blue-600 text-white" onClick={() => setShowModal(true)} disabled={!selected || !decimalPattern.test(quantity)}>Continue</button>
        {msg && <p>{msg}</p>}
      </div>

      {showModal && (
        <div className="fixed inset-0 grid place-items-center bg-black/40 p-4">
          <div className="card w-full max-w-md space-y-3">
            <h3 className="font-semibold">Payment / CUFF</h3>
            <input placeholder="Amount received" type="number" step="0.01" disabled={cuff} value={amountReceived} onChange={(e) => setAmountReceived(e.target.value)} />
            <label className="flex items-center gap-2 border-0">
              <input type="checkbox" checked={cuff} onChange={(e) => setCuff(e.target.checked)} disabled={!settings?.cuff_enabled} />
              CUFF {settings?.cuff_enabled ? '' : '(disabled by admin setting)'}
            </label>
            <div className="flex gap-2">
              <button onClick={submitSale} className="flex-1 bg-green-600 text-white">Submit Sale</button>
              <button onClick={() => setShowModal(false)} className="flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
