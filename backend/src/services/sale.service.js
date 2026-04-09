import { prisma } from '../db.js';

const toNum = (v) => Number(v);

export function calculateCommission(expectedTotal, settings) {
  if (settings.commissionType === 'FLAT') {
    return { type: 'FLAT', value: toNum(settings.commissionValue), amount: toNum(settings.commissionValue) };
  }
  const pct = toNum(settings.commissionValue);
  const amount = Number(((expectedTotal * pct) / 100).toFixed(2));
  return { type: 'PERCENTAGE', value: pct, amount };
}

export async function createSaleWithInventory({ userId, productId, quantitySold, amountReceived, cuffed, latitude, longitude, isPersonalUse }) {
  return prisma.$transaction(async (tx) => {
    const settings = await tx.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
    const product = await tx.product.findUnique({ where: { id: productId } });

    if (!product) throw new Error('Product not found');
    if (toNum(product.totalQuantity) < quantitySold) throw new Error('Insufficient inventory');
    if (cuffed && !settings.cuffEnabled) throw new Error('CUFF is disabled by admin');

    const unitSell = isPersonalUse ? Number(product.sellPrice) * Number(settings.personalUseMultiplier) : Number(product.sellPrice);
    const expectedTotal = Number((unitSell * quantitySold).toFixed(2));
    const unpaidBalance = Number((expectedTotal - amountReceived).toFixed(2));

    if (!cuffed && unpaidBalance > 0) throw new Error('Payment is below expected total; mark as cuffed to continue');

    const commission = calculateCommission(expectedTotal, settings);

    const sale = await tx.sale.create({
      data: {
        userId,
        productId,
        type: product.type,
        quantitySold,
        unitCostPrice: product.costPrice,
        unitSellPrice: unitSell,
        expectedTotal,
        amountReceived,
        cuffed,
        unpaidBalance,
        isPersonalUse,
        commissionType: commission.type,
        commissionValue: commission.value,
        commissionAmount: commission.amount,
        latitude,
        longitude
      }
    });

    await tx.product.update({
      where: { id: productId },
      data: {
        totalQuantity: { decrement: quantitySold }
      }
    });

    return sale;
  });
}
