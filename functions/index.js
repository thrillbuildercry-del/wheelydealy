const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

exports.createSale = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');

  const userId = context.auth.uid;
  const userRef = db.collection('users').doc(userId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new functions.https.HttpsError('permission-denied', 'Missing user profile');

  const user = userSnap.data();
  const quantity = Number(data.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0 || !/^\d+(\.\d)?$/.test(String(data.quantity))) {
    throw new functions.https.HttpsError('invalid-argument', 'Quantity must be positive with max 1 decimal');
  }

  const result = await db.runTransaction(async (tx) => {
    const productRef = db.collection('products').doc(data.product_id);
    const settingsRef = db.collection('settings').doc('app');

    const [productSnap, settingsSnap] = await Promise.all([tx.get(productRef), tx.get(settingsRef)]);
    if (!productSnap.exists) throw new functions.https.HttpsError('not-found', 'Product not found');

    const product = productSnap.data();
    const settings = settingsSnap.exists
      ? settingsSnap.data()
      : { cuff_enabled: true, commission_type: 'percentage', commission_value: 0, personal_use_discount: 1 };

    if (product.total_quantity < quantity) {
      throw new functions.https.HttpsError('failed-precondition', 'Insufficient inventory');
    }

    const isCuff = Boolean(data.cuff && settings.cuff_enabled);
    const isPersonalUse = user.role === 'admin' && Boolean(data.personal_use);

    const effectivePrice = isPersonalUse
      ? product.cost_price * Number(settings.personal_use_discount || 1)
      : product.sell_price;

    const totalExpected = Number((effectivePrice * quantity).toFixed(2));
    const amountReceived = isCuff ? 0 : Number(data.amount_received || 0);

    let commission = 0;
    if (!isPersonalUse) {
      if (settings.commission_type === 'flat') commission = Number(settings.commission_value || 0);
      else commission = Number(((settings.commission_value || 0) / 100) * totalExpected);
    }

    tx.update(productRef, { total_quantity: Number((product.total_quantity - quantity).toFixed(1)) });

    const saleRef = db.collection('sales').doc();
    tx.set(saleRef, {
      user_id: userId,
      product_id: data.product_id,
      type: product.type,
      quantity,
      total_expected: totalExpected,
      amount_received,
      cuff: isCuff,
      latitude: Number(data.latitude),
      longitude: Number(data.longitude),
      commission: Number(commission.toFixed(2)),
      personal_use: isPersonalUse,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    tx.set(db.collection('inventory_logs').doc(), {
      product_id: data.product_id,
      change_amount: -quantity,
      reason: isPersonalUse ? 'personal_use' : 'sale',
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return { sale_id: saleRef.id };
  });

  return result;
});

exports.setUserRole = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');
  const caller = await db.collection('users').doc(context.auth.uid).get();
  if (!caller.exists || caller.data().role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Admin only');
  }
  if (!['admin', 'worker'].includes(data.role)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid role');
  }
  await db.collection('users').doc(data.uid).set(
    {
      email: data.email || '',
      role: data.role,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );
  return { ok: true };
});
