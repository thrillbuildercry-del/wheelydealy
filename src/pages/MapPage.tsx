import mapboxgl from 'mapbox-gl';
import { collection, onSnapshot } from 'firebase/firestore';
import { useEffect, useMemo, useRef, useState } from 'react';
import { db } from '../lib/firebase';

interface Sale {
  latitude: number;
  longitude: number;
  amount_received: number;
}

interface GroupedPoint {
  key: string;
  lat: number;
  lng: number;
  salesCount: number;
  revenue: number;
}

export default function MapPage() {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapNode = useRef<HTMLDivElement | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const token = import.meta.env.VITE_MAPBOX_TOKEN;

  useEffect(() => onSnapshot(collection(db, 'sales'), (snap) => setSales(snap.docs.map((d) => d.data() as Sale))), []);

  const grouped = useMemo<GroupedPoint[]>(() => {
    const bucket = new Map<string, GroupedPoint>();
    for (const s of sales) {
      const key = `${s.latitude.toFixed(3)},${s.longitude.toFixed(3)}`;
      if (!bucket.has(key)) {
        bucket.set(key, { key, lat: s.latitude, lng: s.longitude, salesCount: 0, revenue: 0 });
      }
      const entry = bucket.get(key)!;
      entry.salesCount += 1;
      entry.revenue += s.amount_received;
    }
    return [...bucket.values()];
  }, [sales]);

  useEffect(() => {
    if (!token || !mapNode.current) return;
    mapboxgl.accessToken = token;
    if (!mapRef.current) {
      mapRef.current = new mapboxgl.Map({
        container: mapNode.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [-95.7129, 37.0902],
        zoom: 3
      });
    }
    const map = mapRef.current;
    const markers = grouped.map((g) => {
      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(
        `<b>Sales:</b> ${g.salesCount}<br/><b>Revenue:</b> $${g.revenue.toFixed(2)}`
      );
      return new mapboxgl.Marker().setLngLat([g.lng, g.lat]).setPopup(popup).addTo(map);
    });
    return () => markers.forEach((m) => m.remove());
  }, [grouped, token]);

  if (!token) return <div className="card">Set VITE_MAPBOX_TOKEN to enable map view.</div>;
  return <div ref={mapNode} className="h-[70vh] rounded-xl" />;
}
