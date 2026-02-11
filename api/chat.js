const https = require('https');

const MODEL = 'llama-3.3-70b-versatile';

// Helper: Make API call to Groq
function makeApiCall(messages, apiKey) {
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
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            reject(new Error(parsed.error.message || 'Groq API Error'));
          } else {
            resolve(parsed.choices[0].message.content);
          }
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

// Export handler for Vercel
module.exports = async (req, res) => {
  // ✅ Read API_KEY inside handler (at request time, not module load time)
  const API_KEY = process.env.GROQ_API_KEY;
  
  // CORS Headers - Allow any origin (Vercel handles domain routing)
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
  res.setHeader('Content-Type', 'application/json');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only POST allowed
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, sessionId } = req.body;
    
    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Check if GROQ_API_KEY exists
    if (!API_KEY) {
      console.error('❌ GROQ_API_KEY not set in environment variables');
      return res.status(500).json({ 
        error: 'Server configuration error: GROQ_API_KEY not set',
        details: 'Please set GROQ_API_KEY in Vercel Environment Variables'
      });
    }

    console.log('✅ Chat request received');
    console.log('📝 Message:', message.substring(0, 50) + '...');
    console.log('🔑 API Key set:', !!API_KEY);

    // Call Groq API with the API_KEY
    const aiMessage = await makeApiCall([
      { role: 'user', content: message }
    ], API_KEY);

    return res.status(200).json({ 
      success: true,
      data: {
        message: aiMessage
      }
    });
    
  } catch (error) {
    console.error('❌ Chat API Error:', error.message);
    console.error('Stack:', error.stack);
    return res.status(500).json({ 
      error: 'Failed to process request',
      message: error.message,
      details: error.toString()
    });
  }
};
