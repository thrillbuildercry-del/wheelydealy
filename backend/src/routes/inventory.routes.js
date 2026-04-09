import express from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authRequired, allowRoles } from '../middleware/auth.js';

const router = express.Router();

const schema = z.object({
  productId: z.string(),
  newQty: z.number().nonnegative(),
  reason: z.string().min(3)
});

router.post('/adjust', authRequired, allowRoles('ADMIN'), async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload' });

  const { productId, newQty, reason } = parsed.data;
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return res.status(404).json({ message: 'Product not found' });

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.product.update({ where: { id: productId }, data: { totalQuantity: newQty } });
    const adjustment = await tx.inventoryAdjustment.create({
      data: {
        productId,
        adjustedById: req.user.id,
        previousQty: product.totalQuantity,
        newQty,
        reason
      }
    });
    return { updated, adjustment };
  });

  res.json(result);
});

router.get('/adjustments', authRequired, allowRoles('ADMIN'), async (_req, res) => {
  const adjustments = await prisma.inventoryAdjustment.findMany({ include: { adjustedBy: true, product: true }, orderBy: { createdAt: 'desc' } });
  res.json(adjustments);
});

export default router;
