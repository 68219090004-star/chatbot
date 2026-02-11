// ─── Centralized Error Handler ───────────────────────────────
// Express error handler ต้องมี 4 parameters: (err, req, res, next)

function errorHandler(err, req, res, next) {
  // Log error ใน console (สำหรับ debugging)
  console.error('❌ Error:', err.message);

  // ถ้า error มี status code กำหนดมา (เราใส่เอง) ใช้อันนั้น
  // ไม่มี → default เป็น 500 Internal Server Error
  const statusCode = err.statusCode || 500;

  // Response format เดียวกันทุก error — Frontend parse ง่าย
  res.status(statusCode).json({
    success: false,
    error: {
      message: statusCode >= 500
        ? 'เกิดข้อผิดพลาด กรุณาลอง retry'  // ไม่ expose internal error ใน 5xx
        : err.message,                         // 4xx บอกผู้ใช้ได้เลย
      code: statusCode
    }
  });
}

module.exports = { errorHandler };