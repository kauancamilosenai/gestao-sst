import express from 'express';
import { app as gestaoSstApp } from './server/src/app.js';

// Vercel treats this exported Express application as the server-side function.
const app = express();
app.use(gestaoSstApp);

export default app;

