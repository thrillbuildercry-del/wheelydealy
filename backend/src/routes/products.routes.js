import express from 'express';
import { z } from 'zod';
import { ProductType } from '@prisma/client';
import { prisma } from '../db.js';
import { authRequired, allowRoles } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();

const upsertSchema = z.object({
  name: z.string().min(2),
  type: z.enum([ProductType.HARD, ProductType.SOFT]),
  totalQuantity: z.number().nonnegative(),
  costPrice: z.number().nonnegative(),
  sellPrice: z.number().positive()
});

router.get('/', authRequired, async (req, res) => {
  const type = req.query.type;
  const where = type ? { type } : {};
  const products = await prisma.product.findMany({ where, orderBy: { name: 'asc' } });
  res.json(products);
});

router.post('/', authRequired, allowRoles('ADMIN'), validate(upsertSchema), async (req, res) => {
  const product = await prisma.product.create({ data: req.body });
  res.status(201).json(product);
});

router.put('/:id', authRequired, allowRoles('ADMIN'), validate(upsertSchema.partial()), async (req, res) => {
  const product = await prisma.product.update({ where: { id: req.params.id }, data: req.body });
  res.json(product);
});

router.delete('/:id', authRequired, allowRoles('ADMIN'), async (req, res) => {
  await prisma.product.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
