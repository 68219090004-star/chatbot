const express = require('express');
const router  = express.Router();
const { clearSession } = require('../middleware/sessionStore');

// POST /api/clear-history
// Body: { sessionId: string }
router.post('/', (req, res, next) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      const err = new Error('sessionId จำเป็น');
      err.statusCode = 400;
      return next(err);
    }

    // ล้าง session เก่า สร้าง session ใหม่
    clearSession(sessionId);

    res.json({
      success: true,
      data: { message: 'ล้างประวัติเรียบร้อย เริ่มใหม่ได้เลยครับ' }
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;