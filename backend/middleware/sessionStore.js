// ─── In-Memory Session Store ─────────────────────────────────
// เก็บ chat history แบบ per-session
// Key = sessionId, Value = array of {role, content} messages

const sessions = new Map();

// System prompt — บอก AI ว่าให้ตอบเป็นไทย
const SYSTEM_PROMPT = `คุณเป็น AI Assistant ที่มีความรู้รอบด้านและเป็นมิตร
ให้ตอบคำถามทุกอย่างเป็นภาษาไทยเป็นหลัก
ถ้าผู้ใช้ถามเป็นภาษาอื่น ให้ตอบในภาษานั้น
ให้คำตอบที่ชัดเจน จริงจัง และเป็นประโยชน์
ถ้าไม่แน่ใจ บอกตรงๆ อย่า fabricate ข้อมูล`;

// ─── Get หรือ Create session ────────────────────────────────
function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    // สร้าง session ใหม่พร้อม system prompt เป็น message แรก
    sessions.set(sessionId, [
      { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
      { role: 'model', parts: [{ text: 'สวัสดีครับ! ผมเป็น AI Assistant พร้อมช่วยเลยนะครับ คุณอยากรู้เรื่องอะไรบ้าง?' }] }
    ]);
  }
  return sessions.get(sessionId);
}

// ─── Add message ─────────────────────────────────────────────
function addMessage(sessionId, role, parts) {
  const history = getSession(sessionId);
  history.push({ role, parts });
  return history;
}

// ─── Clear session (ล้าง history) ────────────────────────────
function clearSession(sessionId) {
  sessions.delete(sessionId);
  return getSession(sessionId); // สร้าง fresh session ใหม่
}

module.exports = { getSession, addMessage, clearSession };