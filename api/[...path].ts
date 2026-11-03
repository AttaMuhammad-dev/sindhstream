// Route GestEra's /api/* requests through the same Express handlers used by
// the local server. Vercel hosts the Vite build as static files separately.
import app from '../server/app.js';
import type { Request, Response } from 'express';

/**
 * A catch-all Vercel function can receive either the public `/api/...` path or
 * the path with the function prefix removed. Normalize both forms before the
 * shared Express router sees the request.
 */
export default function handler(req: Request, res: Response) {
  const requestUrl = req.url || '/';
  const [pathname, query] = requestUrl.split(/(?=\?)/, 2);
  if (pathname !== '/api' && !pathname.startsWith('/api/')) {
    req.url = `/api/${pathname.replace(/^\/+/, '')}${query || ''}`;
  }
  return app(req, res);
}
