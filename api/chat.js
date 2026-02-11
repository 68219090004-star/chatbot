import groqService from '../backend/services/groqService.js';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only POST allowed
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, sessionId } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Call Groq API service
    const response = await groqService.chat(message, sessionId);
    return res.status(200).json(response);
    
  } catch (error) {
    console.error('❌ Chat API Error:', error.message);
    return res.status(500).json({ 
      error: 'Failed to process request',
      message: error.message 
    });
  }
}
