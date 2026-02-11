// ─── Groq API Service ─────────────────────────────────────────
// จัดการ communication กับ Groq API ทั้งหมด
// Groq ใช้ OpenAI-compatible API format

const https = require('https');

const API_KEY = process.env.GROQ_API_KEY;
const MODEL = 'llama-3.3-70b-versatile'; // Model ดีสุดของ Groq
const BASE_URL = 'https://api.groq.com';

// ─── Helper: ส่ง HTTP POST ───────────────────────────────────
function makeApiCall(messages) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model: MODEL,
      messages: messages,
      temperature: 0.7,
      max_tokens: 2048
    });

    const options = {
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode !== 200) {
            return reject(new Error(
              parsed.error?.message || 'Groq API error'
            ));
          }
          resolve(parsed);
        } catch (e) {
          reject(new Error('Failed to parse API response'));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// ─── Convert Gemini format to OpenAI format ──────────────────
// Gemini: [{role: 'user', parts: [{text: '...'}]}]
// OpenAI: [{role: 'user', content: '...'}]
function convertToOpenAIFormat(geminiHistory) {
  return geminiHistory.map(msg => {
    // Extract text from parts array
    const text = msg.parts?.map(p => p.text).join('\n') || '';
    
    // Convert role: 'model' -> 'assistant'
    const role = msg.role === 'model' ? 'assistant' : msg.role;
    
    return {
      role: role,
      content: text
    };
  });
}

// ─── Send Chat (text only) ────────────────────────────────────
async function sendChat(geminiHistory) {
  // Convert Gemini format to OpenAI format
  const messages = convertToOpenAIFormat(geminiHistory);
  
  const response = await makeApiCall(messages);
  
  if (!response.choices?.[0]?.message?.content) {
    throw new Error('AI ไม่ response ที่คาดไว้ กรุณา retry');
  }
  
  return response.choices[0].message.content;
}

// ─── Send Chat with File ──────────────────────────────────────
// Note: Groq ไม่รองรับ vision/file upload ในบาง models
// แต่ llama-3.2-90b-vision-preview รองรับ images
async function sendChatWithFile(geminiHistory, fileBuffer, mimeType) {
  // Check if it's an image
  if (mimeType.startsWith('image/')) {
    // Convert to base64
    const base64Data = fileBuffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Data}`;
    
    // Convert history
    const messages = convertToOpenAIFormat(geminiHistory);
    
    // Add image to last message
    const lastMsg = messages[messages.length - 1];
    lastMsg.content = [
      { type: 'text', text: lastMsg.content },
      { type: 'image_url', image_url: { url: dataUrl } }
    ];
    
    // Use vision model for images
    const postData = JSON.stringify({
      model: 'llama-3.2-90b-vision-preview',
      messages: messages,
      temperature: 0.7,
      max_tokens: 2048
    });
    
    const options = {
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const response = await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode !== 200) {
              return reject(new Error(parsed.error?.message || 'Groq API error'));
            }
            resolve(parsed);
          } catch (e) {
            reject(new Error('Failed to parse API response'));
          }
        });
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
    
    if (!response.choices?.[0]?.message?.content) {
      throw new Error('AI ไม่ response ที่คาดไว้ กรุณา retry');
    }
    
    return response.choices[0].message.content;
  } else {
    // For non-image files (PDF, TXT), extract text and send as message
    let fileContent = '';
    
    if (mimeType === 'text/plain') {
      fileContent = fileBuffer.toString('utf-8');
    } else if (mimeType === 'application/pdf') {
      fileContent = '[PDF file uploaded - content extraction not implemented yet]';
    }
    
    // Convert history
    const messages = convertToOpenAIFormat(geminiHistory);
    
    // Append file content to last message
    const lastMsg = messages[messages.length - 1];
    lastMsg.content = `${lastMsg.content}\n\n[File Content]:\n${fileContent}`;
    
    const response = await makeApiCall(messages);
    
    if (!response.choices?.[0]?.message?.content) {
      throw new Error('AI ไม่ response ที่คาดไว้ กรุณา retry');
    }
    
    return response.choices[0].message.content;
  }
}

module.exports = { sendChat, sendChatWithFile };