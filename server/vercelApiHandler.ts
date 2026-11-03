import type { Request, Response } from 'express';
import app from './app.js';

/**
 * Create an explicit Vercel entry point for a nested Express API route.
 * Vercel may pass either the original URL or a function-relative URL, so pin
 * the Express path to the route this file represents while preserving query.
 */
export function createVercelApiHandler(route: string) {
  return function handler(req: Request, res: Response) {
    const requestUrl = req.url || '/';
    const queryIndex = requestUrl.indexOf('?');
    req.url = `${route}${queryIndex >= 0 ? requestUrl.slice(queryIndex) : ''}`;
    return app(req, res);
  };
}
