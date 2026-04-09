import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import { db } from '../lib/firebase';

const APP_SETTINGS_DOC = 'app';

export async function upsertUserProfile(user, role = 'WORKER') {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      email: user.email,
      name: user.displayName || user.email,
      role,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } else {
    await updateDoc(ref, {
      email: user.email,
      name: user.displayName || snap.data().name || user.email,
      updatedAt: serverTimestamp()
    });
  }

  return getUserProfile(user.uid);
}

export async function getUserProfile(uid) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function ensureSettings() {
  const ref = doc(db, 'settings', APP_SETTINGS_DOC);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      cuffEnabled: true,
      commissionType: 'PERCENTAGE',
      commissionValue: 5,
      personalUseMultiplier: 0.1,
      updatedAt: serverTimestamp()
    });
  }
}

export async function getSettings() {
  await ensureSettings();
  const snap = await getDoc(doc(db, 'settings', APP_SETTINGS_DOC));
  return snap.data();
}

export async function updateSettings(payload) {
  await updateDoc(doc(db, 'settings', APP_SETTINGS_DOC), {
    ...payload,
    updatedAt: serverTimestamp()
  });
}

export async function listProducts(type) {
  const productsRef = collection(db, 'products');
  const q = type
    ? query(productsRef, where('type', '==', type), orderBy('name', 'asc'))
    : query(productsRef, orderBy('name', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createProduct(product) {
  await addDoc(collection(db, 'products'), {
    ...product,
    totalQuantity: Number(product.totalQuantity),
    costPrice: Number(product.costPrice),
    sellPrice: Number(product.sellPrice),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function updateProduct(id, patch) {
  await updateDoc(doc(db, 'products', id), {
    ...patch,
    totalQuantity: Number(patch.totalQuantity),
    costPrice: Number(patch.costPrice),
    sellPrice: Number(patch.sellPrice),
    updatedAt: serverTimestamp()
  });
}

export async function deleteProduct(id) {
  await deleteDoc(doc(db, 'products', id));
}

export async function listUsers() {
  const snap = await getDocs(query(collection(db, 'users'), orderBy('name', 'asc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function updateUserRole(userId, role) {
  await updateDoc(doc(db, 'users', userId), { role, updatedAt: serverTimestamp() });
}

export async function updateUserActive(userId, active) {
  await updateDoc(doc(db, 'users', userId), { active, updatedAt: serverTimestamp() });
}

export async function listenSales(callback) {
  const q = query(collection(db, 'sales'), orderBy('createdAt', 'desc'), limit(100));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export function validateOneDecimalQuantity(input) {
  return /^\d+(\.\d)?$/.test(String(input));
}

function calculateCommission(expectedTotal, settings) {
  if (settings.commissionType === 'FLAT') return Number(settings.commissionValue || 0);
  return Number(expectedTotal) * (Number(settings.commissionValue || 0) / 100);
}

export async function createSale({
  user,
  productId,
  quantitySold,
  amountReceived,
  cuffed,
  isPersonalUse,
  location
}) {
  if (!validateOneDecimalQuantity(quantitySold)) {
    throw new Error('Quantity must have at most one decimal place.');
  }

  const settings = await getSettings();
  if (cuffed && !settings.cuffEnabled) {
    throw new Error('CUFF is disabled by admin.');
  }

  const productRef = doc(db, 'products', productId);
  const salesRef = collection(db, 'sales');

  await runTransaction(db, async (tx) => {
    const productSnap = await tx.get(productRef);
    if (!productSnap.exists()) throw new Error('Product not found.');

    const product = productSnap.data();
    const qty = Number(quantitySold);

    if (Number(product.totalQuantity) < qty) {
      throw new Error('Not enough inventory available.');
    }

    const effectiveSellPrice = isPersonalUse
      ? Number(product.sellPrice) * Number(settings.personalUseMultiplier || 0.1)
      : Number(product.sellPrice);

    const expectedTotal = Number((effectiveSellPrice * qty).toFixed(2));
    const received = cuffed ? 0 : Number(amountReceived || 0);
    const commission = calculateCommission(expectedTotal, settings);

    tx.update(productRef, {
      totalQuantity: Number((Number(product.totalQuantity) - qty).toFixed(1)),
      updatedAt: serverTimestamp()
    });

    tx.set(doc(salesRef), {
      userId: user.uid,
      userName: user.name || user.email,
      productId,
      productName: product.name,
      type: product.type,
      quantitySold: qty,
      expectedTotal,
      amountReceived: received,
      cuffed,
      unpaidBalance: Number((expectedTotal - received).toFixed(2)),
      commission,
      isPersonalUse,
      location: location || null,
      createdAt: serverTimestamp()
    });
  });
}

export function buildMapSummary(sales) {
  const grouped = new Map();

  for (const sale of sales) {
    if (!sale.location?.latitude || !sale.location?.longitude) continue;
    const key = `${sale.location.latitude.toFixed(4)}:${sale.location.longitude.toFixed(4)}`;
    const current = grouped.get(key) || {
      key,
      latitude: sale.location.latitude,
      longitude: sale.location.longitude,
      transactions: 0,
      totalSales: 0
    };

    current.transactions += 1;
    current.totalSales += Number(sale.expectedTotal || 0);
    grouped.set(key, current);
  }

  return [...grouped.values()].sort((a, b) => b.totalSales - a.totalSales);
}

export function buildSummary(sales, products) {
  const totals = sales.reduce((acc, sale) => {
    acc.expectedRevenue += Number(sale.expectedTotal || 0);
    acc.actualReceived += Number(sale.amountReceived || 0);
    acc.outstandingCuff += Number(sale.unpaidBalance || 0);
    return acc;
  }, { expectedRevenue: 0, actualReceived: 0, outstandingCuff: 0 });

  const inventoryRemaining = products.reduce((acc, product) => acc + Number(product.totalQuantity || 0), 0);

  return {
    totals,
    inventoryRemaining,
    salesCount: sales.length
  };
}
