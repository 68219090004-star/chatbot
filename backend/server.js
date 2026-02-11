require('dotenv').config();

const express = require('express');
const { errorHandler } = require('./middleware/errorHandler');

// ─── Import Routes ────────────────────────────────────────────
const chatRoutes     = require('./routes/chatRoutes');
const fileRoutes     = require('./routes/fileRoutes');
const historyRoutes  = require('./routes/historyRoutes');

const app  = express();
const PORT = process.env.PORT || 3001;

// ─── CORS Configuration ───────────────────────────────────────
// อนุญาต Frontend ที่อยู่ที่ CORS_ORIGIN เท่านั้นให้ request ได้
app.use((req, res, next) => {
  const origin = process.env.CORS_ORIGIN || 'http://localhost:3000';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Preflight request — browser ส่งก่อน POST จริง
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// ─── Body Parser ──────────────────────────────────────────────
app.use(express.json());   // Parse JSON request bodies

// ─── Mount Routes ─────────────────────────────────────────────
app.use('/api/chat',          chatRoutes);
app.use('/api/chat-file',     fileRoutes);
app.use('/api/clear-history', historyRoutes);

// ─── Health Check (สำหรับ Railway/Vercel ตรวจ status) ──────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Error Handler (ต้องใส่ last เสมอ) ───────────────────────
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ AI Chatbot Backend running on port ${PORT}`);
  console.log(`   CORS origin: ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`);
});