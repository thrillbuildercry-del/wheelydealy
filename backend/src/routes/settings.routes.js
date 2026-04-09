import express from 'express';
import { z } from 'zod';
import { CommissionType } from '@prisma/client';
import { prisma } from '../db.js';
import { authRequired, allowRoles } from '../middleware/auth.js';

const router = express.Router();
const schema = z.object({
  cuffEnabled: z.boolean().optional(),
  personalUseMultiplier: z.number().min(0).max(1).optional(),
  commissionType: z.enum([CommissionType.PERCENTAGE, CommissionType.FLAT]).optional(),
  commissionValue: z.number().nonnegative().optional()
});

router.get('/', authRequired, async (_req, res) => {
  const settings = await prisma.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  res.json(settings);
});

router.put('/', authRequired, allowRoles('ADMIN'), async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid settings payload' });

  const settings = await prisma.settings.upsert({
    where: { id: 1 },
    update: parsed.data,
    create: { id: 1, ...parsed.data }
  });
  res.json(settings);
});

export default router;
