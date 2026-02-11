const express = require('express');
const multer  = require('multer');
const router  = express.Router();
const { getSession, addMessage } = require('../middleware/sessionStore');
const { validateFile }          = require('../middleware/fileValidator');
const { sendChatWithFile }      = require('../services/groqService'); // เปลี่ยนจาก geminiService

// Multer config: เก็บใน memory (ไม่ write ลง disk)
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/chat-file
// Form fields: sessionId, message (optional prompt)
// File field: file
router.post('/', upload.single('file'), async (req, res, next) => {
  try {
    const { sessionId, message } = req.body;

    // ─── Validate sessionId ──────────────────────────────
    if (!sessionId) {
      const err = new Error('sessionId จำเป็น');
      err.statusCode = 400;
      return next(err);
    }

    // ─── Validate file ───────────────────────────────────
    const validation = validateFile(req.file);
    if (!validation.valid) {
      const err = new Error(validation.error);
      err.statusCode = 400;
      return next(err);
    }

    // ─── Build user message พร้อม file reference ──────────
    const userText = message?.trim()
      || `กรุณาอ่านไฟล์ "${req.file.originalname}" และสรุปสาระสำคัญ`;

    const history = addMessage(sessionId, 'user', [{ text: userText }]);

    // ─── เรียก Groq พร้อม file (แทน Gemini) ──────────────
    const aiResponse = await sendChatWithFile(
      history,
      req.file.buffer,       // File buffer จาก multer
      validation.mimeType   // Validated MIME type
    );

    // ─── บันทึก response ─────────────────────────────────
    addMessage(sessionId, 'model', [{ text: aiResponse }]);

    res.json({
      success: true,
      data: {
        message:   aiResponse,
        role:      'model',
        sessionId: sessionId,
        fileName:  req.file.originalname
      }
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;