import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

import { initDb } from './db/database-mongo';
import bunkersRouter from './routes/bunkers';
import ammoTypesRouter from './routes/ammoTypes';
import inventoryRouter from './routes/inventory';
import countsRouter from './routes/counts';
import issuancesRouter from './routes/issuances';
import standardsRouter from './routes/standards';
import unitsRouter from './routes/units';
import templatesRouter from './routes/templates';

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration - allow deployment URLs and localhost for development
const corsOrigins = [
  'http://localhost:5173',
  'http://localhost:4200',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  /^https:\/\/.*\.netlify\.app$/,  // Any Netlify subdomain
  /^https:\/\/.*\.fly\.dev$/,      // Any Fly.io subdomain
];

// Middleware
app.use(cors({ 
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (corsOrigins.some(o => typeof o === 'string' ? o === origin : o.test(origin))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

// Initialize DB and start server
async function startServer() {
  try {
    await initDb();
    
    // Routes
    app.use('/api/units', unitsRouter);
    app.use('/api/bunkers', bunkersRouter);
    app.use('/api/ammo-types', ammoTypesRouter);
    app.use('/api/bunkers/:id/inventory', inventoryRouter);
    app.use('/api/bunkers/:id/counts', countsRouter);
    app.use('/api/bunkers/:id/issuances', issuancesRouter);
    app.use('/api/bunkers/:id/standard', standardsRouter);
    app.use('/api/templates', templatesRouter);

    // Health check
    app.get('/api/health', (_req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    app.listen(PORT, () => {
      console.log(`🚀 Bunker server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
