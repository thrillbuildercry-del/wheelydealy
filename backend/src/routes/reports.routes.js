import express from 'express';
import { prisma } from '../db.js';
import { authRequired, allowRoles } from '../middleware/auth.js';

const router = express.Router();

router.get('/summary', authRequired, allowRoles('ADMIN'), async (req, res) => {
  const period = req.query.period === 'weekly' ? 7 : 1;
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - period);

  const sales = await prisma.sale.findMany({ where: { createdAt: { gte: start } }, include: { product: true } });
  const products = await prisma.product.findMany();

  const totals = sales.reduce((acc, sale) => {
    acc.expectedRevenue += Number(sale.expectedTotal);
    acc.actualReceived += Number(sale.amountReceived);
    acc.outstandingCuff += Number(sale.unpaidBalance);
    const profit = (Number(sale.unitSellPrice) - Number(sale.unitCostPrice)) * Number(sale.quantitySold);
    acc.profit += profit;
    return acc;
  }, { expectedRevenue: 0, actualReceived: 0, outstandingCuff: 0, profit: 0, salesCount: sales.length });

  const inventoryRemaining = products.map((p) => ({ productId: p.id, name: p.name, remaining: p.totalQuantity }));

  res.json({ period, totals, inventoryRemaining });
});

router.get('/export.csv', authRequired, allowRoles('ADMIN'), async (_req, res) => {
  const sales = await prisma.sale.findMany({ include: { user: true, product: true } });
  const rows = ['timestamp,user,product,type,qty,expected,received,cuffed,unpaid'];

  sales.forEach((s) => {
    rows.push([
      s.createdAt.toISOString(),
      s.user.email,
      s.product.name,
      s.type,
      s.quantitySold,
      s.expectedTotal,
      s.amountReceived,
      s.cuffed,
      s.unpaidBalance
    ].join(','));
  });

  res.setHeader('Content-Type', 'text/csv');
  res.send(rows.join('\n'));
});

export default router;
