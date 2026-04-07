import { collection, onSnapshot } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { db } from '../lib/firebase';
import { Product, Settings } from '../types';

interface Sale {
  total_expected: number;
  amount_received: number;
  cuff: boolean;
}

export default function AdminDashboardPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [settingsDocId, setSettingsDocId] = useState<string>('');
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => onSnapshot(collection(db, 'sales'), (s) => setSales(s.docs.map((d) => d.data() as Sale))), []);
  useEffect(() => onSnapshot(collection(db, 'products'), (s) => setProducts(s.docs.map((d) => ({ id: d.id, ...d.data() } as Product)))), []);
  useEffect(
    () =>
      onSnapshot(collection(db, 'settings'), (s) => {
        setSettingsDocId(s.docs[0]?.id ?? 'app');
        setSettings((s.docs[0]?.data() as Settings) ?? null);
      }),
    []
  );

  const metrics = useMemo(() => {
    const expected = sales.reduce((a, s) => a + s.total_expected, 0);
    const received = sales.reduce((a, s) => a + s.amount_received, 0);
    const cuffOutstanding = sales.filter((s) => s.cuff).reduce((a, s) => a + s.total_expected, 0);
    return { expected, received, cuffOutstanding, totalSales: sales.length };
  }, [sales]);

  const chartData = [
    { name: 'Expected', value: Number(metrics.expected.toFixed(2)) },
    { name: 'Received', value: Number(metrics.received.toFixed(2)) },
    { name: 'Cuff Outstanding', value: Number(metrics.cuffOutstanding.toFixed(2)) }
  ];

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total sales" value={String(metrics.totalSales)} />
        <StatCard label="Expected" value={`$${metrics.expected.toFixed(2)}`} />
        <StatCard label="Received" value={`$${metrics.received.toFixed(2)}`} />
        <StatCard label="Cuff balance" value={`$${metrics.cuffOutstanding.toFixed(2)}`} />
      </div>
      <div className="card h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#2563eb" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="card">
        <h3 className="mb-2 font-semibold">Settings</h3>
        <p>Settings document id: {settingsDocId}</p>
        <p>CUFF enabled: {String(settings?.cuff_enabled ?? false)}</p>
        <p>Commission: {settings?.commission_type} ({settings?.commission_value})</p>
      </div>
      <div className="card">
        <h3 className="mb-2 font-semibold">Inventory Remaining</h3>
        <ul className="space-y-1">
          {products.map((p) => (
            <li key={p.id}>{p.name}: {p.total_quantity}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <p className="text-sm text-slate-600">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
