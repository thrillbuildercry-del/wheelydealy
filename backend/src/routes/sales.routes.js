import express from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authRequired, allowRoles } from '../middleware/auth.js';
import { assertOneDecimal } from '../utils/decimal.js';
import { createSaleWithInventory } from '../services/sale.service.js';

const router = express.Router();

const createSchema = z.object({
  productId: z.string(),
  quantitySold: z.number().positive(),
  amountReceived: z.number().nonnegative(),
  cuffed: z.boolean(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  isPersonalUse: z.boolean().optional().default(false)
});

router.post('/', authRequired, allowRoles('WORKER', 'ADMIN'), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload' });

  if (!assertOneDecimal(parsed.data.quantitySold)) {
    return res.status(400).json({ message: 'Quantity must be one decimal place maximum' });
  }

  try {
    const sale = await createSaleWithInventory({ userId: req.user.id, ...parsed.data });
    return res.status(201).json(sale);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.get('/', authRequired, async (req, res) => {
  const where = req.user.role === 'WORKER' ? { userId: req.user.id } : {};
  const sales = await prisma.sale.findMany({
    where,
    include: { user: true, product: true },
    orderBy: { createdAt: 'desc' },
    take: 200
  });
  res.json(sales);
});

router.get('/map', authRequired, async (_req, res) => {
  const sales = await prisma.sale.findMany({ where: { latitude: { not: null }, longitude: { not: null } } });

  const grouped = sales.reduce((acc, sale) => {
    const key = `${sale.latitude},${sale.longitude}`;
    if (!acc[key]) {
      acc[key] = { latitude: sale.latitude, longitude: sale.longitude, totalSales: 0, transactions: 0 };
    }
    acc[key].totalSales += Number(sale.expectedTotal);
    acc[key].transactions += 1;
    return acc;
  }, {});

  res.json(Object.values(grouped));
});

router.get('/unpaid', authRequired, allowRoles('ADMIN'), async (_req, res) => {
  const unpaid = await prisma.sale.findMany({ where: { cuffed: true, unpaidBalance: { gt: 0 } }, include: { user: true, product: true } });
  res.json(unpaid);
});

export default router;
