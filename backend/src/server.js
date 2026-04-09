import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config.js';

import authRoutes from './routes/auth.routes.js';
import productRoutes from './routes/products.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import salesRoutes from './routes/sales.routes.js';
import usersRoutes from './routes/users.routes.js';
import inventoryRoutes from './routes/inventory.routes.js';
import reportsRoutes from './routes/reports.routes.js';

const app = express();

app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/auth', authRoutes);
app.use('/products', productRoutes);
app.use('/settings', settingsRoutes);
app.use('/sales', salesRoutes);
app.use('/users', usersRoutes);
app.use('/inventory', inventoryRoutes);
app.use('/reports', reportsRoutes);

app.listen(config.port, () => {
  console.log(`API listening on :${config.port}`);
});
