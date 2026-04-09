import express from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../db.js';
import { authRequired, allowRoles } from '../middleware/auth.js';

const router = express.Router();
const schema = z.object({ role: z.enum([Role.ADMIN, Role.WORKER]), isActive: z.boolean().optional() });

router.get('/', authRequired, allowRoles('ADMIN'), async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(users);
});

router.put('/:id', authRequired, allowRoles('ADMIN'), async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload' });
  const user = await prisma.user.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(user);
});

export default router;
