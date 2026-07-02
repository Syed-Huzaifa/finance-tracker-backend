// Vercel serverless entrypoint. Vercel routes all requests here (see vercel.json)
// and uses the exported Express app as the request handler.
import app from '../src/index.js';

export default app;
