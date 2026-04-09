import { useEffect, useState } from 'react';

export default function SaleModal({ open, onClose, onSubmit, cuffEnabled }) {
  const [amountReceived, setAmountReceived] = useState('');
  const [cuffed, setCuffed] = useState(false);

  useEffect(() => {
    if (open) {
      setAmountReceived('');
      setCuffed(false);
    }
  }, [open]);

  if (!open) return null;

  const submit = () => onSubmit({ amountReceived: Number(amountReceived || 0), cuffed });

  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-xl">
        <h3 className="mb-1 text-lg font-semibold">Payment Entry</h3>
        <p className="mb-3 text-xs text-slate-600">Enter payment or mark as CUFF.</p>

        <input
          type="number"
          step="0.01"
          className="w-full rounded border p-2"
          placeholder="Amount received"
          value={amountReceived}
          onChange={(e) => setAmountReceived(e.target.value)}
        />

        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={cuffed} disabled={!cuffEnabled} onChange={(e) => setCuffed(e.target.checked)} />
          Mark as CUFF {cuffEnabled ? '' : '(disabled by admin)'}
        </label>

        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded border px-3 py-1" onClick={onClose}>Cancel</button>
          <button className="rounded bg-blue-600 px-3 py-1 text-white" onClick={submit}>Submit Sale</button>
        </div>
      </div>
    </div>
  );
}
