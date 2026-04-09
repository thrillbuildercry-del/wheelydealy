import express from 'express';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { config } from '../config.js';
import { prisma } from '../db.js';

const router = express.Router();
const googleClient = new OAuth2Client(config.googleClientId);

const schema = z.object({
  idToken: z.string().min(1),
  role: z.enum([Role.ADMIN, Role.WORKER]).optional()
});

router.post('/google', async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload' });

  const { idToken, role } = parsed.data;

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: config.googleClientId
    });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.sub || !payload.name) {
      return res.status(400).json({ message: 'Google profile incomplete' });
    }

    const user = await prisma.user.upsert({
      where: { email: payload.email },
      update: { name: payload.name, googleSub: payload.sub },
      create: {
        email: payload.email,
        name: payload.name,
        googleSub: payload.sub,
        role: role || Role.WORKER
      }
    });

    const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, config.jwtSecret, { expiresIn: '7d' });
    return res.json({ token, user });
  } catch (error) {
    return res.status(401).json({ message: 'Google authentication failed', error: error.message });
  }
});

export default router;
