// Route GestEra's /api/* requests through the same Express handlers used by
// the local server. Vercel hosts the Vite build as static files separately.
import app from '../server/app.js';

export default app;
