import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import { db } from './db.ts';
import { apiRouter } from './routes.ts';

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, '');
}

function getAllowedOrigins(req: Request): Set<string> {
  const allowed = new Set<string>([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ]);

  const envUrls = [
    process.env.APP_URL,
    process.env.FRONTEND_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
    process.env.VERCEL_BRANCH_URL ? `https://${process.env.VERCEL_BRANCH_URL}` : undefined,
    process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined,
  ];

  for (const url of envUrls) {
    if (url && typeof url === 'string' && !url.startsWith('MY_')) {
      allowed.add(normalizeOrigin(url));
    }
  }

  if (process.env.ALLOWED_ORIGINS) {
    for (const entry of process.env.ALLOWED_ORIGINS.split(',')) {
      if (entry.trim()) {
        allowed.add(normalizeOrigin(entry));
      }
    }
  }

  // Always allow same-origin host header (covers custom Vercel domains and preview URLs)
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (typeof host === 'string' && host.trim()) {
    const xfProto = req.headers['x-forwarded-proto'];
    const proto = typeof xfProto === 'string' && xfProto.trim() ? xfProto.split(',')[0].trim() : req.protocol || 'https';
    allowed.add(`${proto}://${host.trim()}`);
    allowed.add(`https://${host.trim()}`);
    if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) {
      allowed.add(`http://${host.trim()}`);
    }
  }

  return allowed;
}

export function createApiApp() {
  const app = express();
  app.set('trust proxy', 1);

  // Strict trusted-origin CORS policy for API routes
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    const originHeader = req.headers.origin;
    if (typeof originHeader === 'string' && originHeader.trim()) {
      const origin = normalizeOrigin(originHeader);
      const allowedOrigins = getAllowedOrigins(req);

      if (allowedOrigins.has(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
        res.setHeader('Access-Control-Max-Age', '86400');
      } else {
        console.warn(`Blocked untrusted CORS origin on ${req.method} ${req.originalUrl}: ${origin}`);
        if (req.method === 'OPTIONS') {
          return res.status(403).json({
            error: 'Nguồn truy cập (CORS) không được phép.',
            code: 'CORS_FORBIDDEN',
          });
        }
        return res.status(403).json({
          error: 'Nguồn truy cập (CORS) không được phép.',
          code: 'CORS_FORBIDDEN',
        });
      }
    }

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    next();
  });

  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    try {
      db.prepare('SELECT 1 AS ok').get();
      res.json({
        status: 'ok',
        app: 'SOCRATES KIDS AI',
        db: 'connected',
      });
    } catch (err: unknown) {
      console.error('Health check DB error:', err instanceof Error ? err.message : String(err));
      res.status(503).json({
        status: 'error',
        error: 'Cơ sở dữ liệu tạm thời không khả dụng.',
        code: 'DB_UNAVAILABLE',
      });
    }
  });

  app.use('/api', apiRouter);

  app.use('/api/*', (_req: Request, res: Response) => {
    res.status(404).json({
      error: 'API endpoint không tồn tại.',
      code: 'API_NOT_FOUND',
    });
  });

  // Sanitized global error handler (no stack traces or secrets leaked to clients)
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const errObj = err as { status?: number; type?: string; message?: string };
    console.error(`Unhandled API error on ${req.method} ${req.originalUrl}:`, errObj?.message || err);

    if (errObj?.type === 'entity.parse.failed') {
      return res.status(400).json({
        error: 'Dữ liệu gửi lên không đúng định dạng JSON.',
        code: 'INVALID_JSON',
      });
    }
    if (errObj?.type === 'entity.too.large') {
      return res.status(413).json({
        error: 'Dữ liệu tải lên vượt quá dung lượng cho phép.',
        code: 'PAYLOAD_TOO_LARGE',
      });
    }

    const status = typeof errObj?.status === 'number' && errObj.status >= 400 && errObj.status < 600 ? errObj.status : 500;
    res.status(status).json({
      error: 'Hệ thống máy chủ tạm thời gặp sự cố. Vui lòng thử lại sau ít phút.',
      code: 'INTERNAL_SERVER_ERROR',
    });
  });

  return app;
}
