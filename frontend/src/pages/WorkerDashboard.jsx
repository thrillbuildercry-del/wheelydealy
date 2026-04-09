import { useEffect, useMemo, useState } from 'react';
import SaleModal from '../components/SaleModal';
import {
  createSale,
  getSettings,
  listProducts,
  validateOneDecimalQuantity
} from '../services/firestoreService';
import { useAuth } from '../context/AuthContext';

export default function WorkerDashboard() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [type, setType] = useState('HARD');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [isPersonalUse, setIsPersonalUse] = useState(false);
  const [openPayment, setOpenPayment] = useState(false);
  const [settings, setSettings] = useState({ cuffEnabled: true });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const boot = async () => {
      const [productData, settingsData] = await Promise.all([listProducts(), getSettings()]);
      setProducts(productData);
      setSettings(settingsData);
    };
    boot();
  }, []);

  const filtered = useMemo(() => products.filter((p) => p.type === type), [products, type]);

  const startSale = () => {
    setMessage('');
    if (!selectedProductId) return setMessage('Choose a product first.');
    if (!validateOneDecimalQuantity(quantity)) return setMessage('Quantity must be numeric with max 1 decimal place.');
    setOpenPayment(true);
  };

  const submitSale = async ({ amountReceived, cuffed }) => {
    setLoading(true);
    setMessage('');
    try {
      const location = await new Promise((resolve) => navigator.geolocation.getCurrentPosition(
        ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
        () => resolve(null),
        { maximumAge: 60000, timeout: 5000 }
      ));

      await createSale({
        user,
        productId: selectedProductId,
        quantitySold: quantity,
        amountReceived,
        cuffed,
        isPersonalUse,
        location
      });

      const freshProducts = await listProducts();
      setProducts(freshProducts);
      setOpenPayment(false);
      setQuantity('');
      setSelectedProductId('');
      setIsPersonalUse(false);
      setMessage('✅ Sale saved successfully.');
    } catch (err) {
      setMessage(err.message || 'Failed to save sale.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-white p-4 shadow">
        <h2 className="font-semibold">Quick Sale Entry</h2>
        <p className="text-sm text-slate-600">Step 1: pick product and quantity. Step 2: enter payment.</p>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <select className="rounded-lg border p-2" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="HARD">Hard</option>
            <option value="SOFT">Soft</option>
          </select>

          <select className="rounded-lg border p-2" value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)}>
            <option value="">Select product</option>
            {filtered.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (stock: {p.totalQuantity})
              </option>
            ))}
          </select>

          <input
            className="rounded-lg border p-2"
            placeholder="Quantity (e.g. 1.5)"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />

          <label className="flex items-center gap-2 rounded-lg border p-2 text-sm">
            <input type="checkbox" checked={isPersonalUse} onChange={(e) => setIsPersonalUse(e.target.checked)} />
            Personal use pricing
          </label>
        </div>

        <button
          className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-60"
          onClick={startSale}
          disabled={loading}
        >
          Continue to Payment
        </button>

        {message && <p className="mt-2 text-sm">{message}</p>}
      </section>

      <SaleModal
        open={openPayment}
        onClose={() => setOpenPayment(false)}
        onSubmit={submitSale}
        cuffEnabled={settings.cuffEnabled}
      />
    </div>
  );
}
