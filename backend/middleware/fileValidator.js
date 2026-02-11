// ─── File Validation Middleware ──────────────────────────────
// Whitelist approach: อนุญาตเฉพาะ MIME type ที่เราอยากรับ

const ALLOWED_TYPES = {
  'application/pdf':   'application/pdf',
  'text/plain':        'text/plain',
  'image/png':         'image/png',
  'image/jpeg':        'image/jpeg',
  'image/jpg':         'image/jpeg'
};

// Max file size จาก env, default 10MB
const MAX_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB) || 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

function validateFile(file) {
  // Check 1: ไม่มีไฟล์
  if (!file) {
    return { valid: false, error: 'ไม่พบไฟล์ attachment' };
  }

  // Check 2: File type ไม่อยู่ใน whitelist
  const mimeType = ALLOWED_TYPES[file.mimetype];
  if (!mimeType) {
    return {
      valid: false,
      error: `File type "${file.mimetype}" ไม่รับ. รับเฉพาะ: PDF, TXT, PNG, JPG`
    };
  }

  // Check 3: File size เกิน limit
  if (file.size > MAX_SIZE_BYTES) {
    return {
      valid: false,
      error: `ไฟล์ใหญ่เกิน ${MAX_SIZE_MB}MB (ขนาดจริง: ${(file.size / 1024 / 1024).toFixed(2)}MB)`
    };
  }

  return { valid: true, mimeType };
}

module.exports = { validateFile };