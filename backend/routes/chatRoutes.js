const express  = require('express');
const router  = express.Router();
const { getSession, addMessage } = require('../middleware/sessionStore');
const { sendChat }              = require('../services/groqService'); // เปลี่ยนจาก geminiService

// POST /api/chat
// Body: { sessionId: string, message: string }
router.post('/', async (req, res, next) => {
  try {
    const { sessionId, message } = req.body;

    // ─── Validate input ──────────────────────────────────────
    if (!sessionId || typeof sessionId !== 'string') {
      const err = new Error('sessionId ต้องเป็น string');
      err.statusCode = 400;
      return next(err);
    }
    if (!message || message.trim().length === 0) {
      const err = new Error('message ว่าง กรุณาพิมพ์ข้อความ');
      err.statusCode = 400;
      return next(err);
    }

    // ─── เพิ่ม user message ใน session history ──────────────
    const history = addMessage(sessionId, 'user', [{ text: message.trim() }]);

    // ─── เรียก Groq API (แทน Gemini) ────────────────────────
    const aiResponse = await sendChat(history);

    // ─── บันทึก AI response ใน session (เพื่อ context ครั้งต่อไป) ─
    addMessage(sessionId, 'model', [{ text: aiResponse }]);

    // ─── ส่ง response กลับ Frontend ──────────────────────────
    res.json({
      success: true,
      data: {
        message:  aiResponse,
        role:     'model',
        sessionId: sessionId
      }
    });

  } catch (error) {
    // Pass error ไปยัง centralized error handler
    next(error);
  }
});

module.exports = router;