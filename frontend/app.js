// ═══════════════════════════════════════════════════════════════
// AI CHATBOT - IMPROVED FRONTEND
// Based on ChatGPT UX/UI Design Philosophy
// ═══════════════════════════════════════════════════════════════

// ─── Configuration ──────────────────────────────────────────────
// Direct API endpoint - works on both dev and production
const API_BASE = '/api';  // Works everywhere via relative path

console.log('🔗 API_BASE:', API_BASE);
console.log('📍 Current URL:', window.location.href);

// ─── DOM Elements ────────────────────────────────────────────────
const elements = {
  sidebar: document.getElementById('sidebar'),
  sidebarToggle: document.getElementById('sidebarToggle'),
  messagesArea: document.getElementById('messagesArea'),
  messageInput: document.getElementById('messageInput'),
  sendBtn: document.getElementById('sendBtn'),
  clearBtn: document.getElementById('clearBtn'),
  attachBtn: document.getElementById('attachBtn'),
  fileInput: document.getElementById('fileInput'),
  filePreview: document.getElementById('filePreview'),
  filePreviewName: document.getElementById('filePreviewName'),
  removeFileBtn: document.getElementById('removeFileBtn'),
  welcomeScreen: document.getElementById('welcomeScreen'),
  newChatBtn: document.getElementById('newChatBtn')
};

// ─── State Management ────────────────────────────────────────────
// Persist sessionId in localStorage to preserve history across actions/refresh
function getStoredSessionId() {
  try {
    return localStorage.getItem('sessionId') || null;
  } catch (e) {
    return null;
  }
}
function createNewSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
function ensureSessionId() {
  let id = getStoredSessionId();
  if (!id) {
    id = createNewSessionId();
    try { localStorage.setItem('sessionId', id); } catch (e) {}
  }
  return id;
}
const state = {
  sessionId: ensureSessionId(),
  selectedFile: null,
  isLoading: false,
  conversationHistory: []
};

// ═══════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════

function init() {
  setupEventListeners();
  setupKeyboardShortcuts();
  autoFocusInput();
  setupSuggestionCards();
}

// ─── Event Listeners ─────────────────────────────────────────────
function setupEventListeners() {
  // Send message
  elements.sendBtn.addEventListener('click', handleSend);
  elements.messageInput.addEventListener('keydown', handleKeyPress);
  
  // Input auto-resize
  elements.messageInput.addEventListener('input', autoResizeTextarea);
  
  // File handling
  elements.attachBtn.addEventListener('click', () => elements.fileInput.click());
  elements.fileInput.addEventListener('change', handleFileSelect);
  elements.removeFileBtn.addEventListener('click', removeFile);
  
  // Chat management
  elements.clearBtn.addEventListener('click', handleClear);
  elements.newChatBtn.addEventListener('click', startNewChat);
  
  // Sidebar toggle (mobile)
  elements.sidebarToggle?.addEventListener('click', toggleSidebar);
  
  // Click outside to close sidebar on mobile
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768) {
      if (!elements.sidebar.contains(e.target) && 
          !elements.sidebarToggle.contains(e.target) &&
          elements.sidebar.classList.contains('open')) {
        elements.sidebar.classList.remove('open');
      }
    }
  });
}

// ─── Keyboard Shortcuts ──────────────────────────────────────────
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Cmd/Ctrl + K = New chat
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      startNewChat();
    }
    
    // Cmd/Ctrl + / = Focus input
    if ((e.metaKey || e.ctrlKey) && e.key === '/') {
      e.preventDefault();
      elements.messageInput.focus();
    }
    
    // Escape = Clear input or close sidebar
    if (e.key === 'Escape') {
      // Close sidebar first if open
      if (elements.sidebar.classList.contains('open')) {
        elements.sidebar.classList.remove('open');
      } else if (elements.messageInput.value) {
        elements.messageInput.value = '';
        autoResizeTextarea();
      }
    }
  });
}

// ─── Suggestion Cards ────────────────────────────────────────────
function setupSuggestionCards() {
  const cards = document.querySelectorAll('.suggestion-card');
  cards.forEach(card => {
    card.addEventListener('click', () => {
      const prompt = card.getAttribute('data-prompt');
      elements.messageInput.value = prompt;
      autoResizeTextarea();
      elements.messageInput.focus();
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// CORE FUNCTIONS
// ═══════════════════════════════════════════════════════════════

// ─── Handle Send ─────────────────────────────────────────────────
async function handleSend() {
  if (state.isLoading) return;

  const text = elements.messageInput.value.trim();
  if (!text && !state.selectedFile) return;

  // Hide welcome screen on first message
  if (elements.welcomeScreen) {
    elements.welcomeScreen.style.display = 'none';
  }

  // Display user message immediately (Optimistic UI)
  appendMessage('user', text || '(แนบไฟล์)', state.selectedFile?.name);
  
  // Clear input
  elements.messageInput.value = '';
  autoResizeTextarea();

  // Set loading state
  setLoading(true);

  try {
    let response;
    if (state.selectedFile) {
      response = await sendWithFile(text, state.selectedFile);
      removeFile();
    } else {
      response = await sendText(text);
    }

    // Display AI response with streaming effect
    await appendMessageWithStreaming('ai', response.data.message);

    // Save to conversation history
    state.conversationHistory.push(
      { role: 'user', content: text },
      { role: 'assistant', content: response.data.message }
    );

  } catch (err) {
    appendError(err.message || 'เกิดข้อผิดพลาดในการส่งข้อความ');
  } finally {
    setLoading(false);
    autoFocusInput();
  }
}

// ─── Send Text Only ──────────────────────────────────────────────
async function sendText(message) {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      sessionId: state.sessionId, 
      message 
    })
  });
  return handleResponse(res);
}

// ─── Send with File ──────────────────────────────────────────────
async function sendWithFile(message, file) {
  const formData = new FormData();
  formData.append('sessionId', state.sessionId);
  if (message) formData.append('message', message);
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/chat-file`, {
    method: 'POST',
    body: formData
  });
  return handleResponse(res);
}

// ─── Handle Clear ────────────────────────────────────────────────
async function handleClear() {
  if (!confirm('ล้างประวัติการสนทนาทั้งหมดใช่หรือไม่?')) return;

  try {
    await fetch(`${API_BASE}/clear-history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: state.sessionId })
    });

    // Clear UI
    elements.messagesArea.innerHTML = '';
    state.conversationHistory = [];
    
    // Show welcome screen again
    showWelcomeScreen();

  } catch (err) {
    appendError('ไม่สามารถล้างประวัติได้ กรุณาลองใหม่');
  }
}

// ─── Start New Chat ──────────────────────────────────────────────
function startNewChat() {
  state.sessionId = createNewSessionId();
  try { localStorage.setItem('sessionId', state.sessionId); } catch (e) {}
  elements.messagesArea.innerHTML = '';
  state.conversationHistory = [];
  showWelcomeScreen();
  autoFocusInput();
}

// ═══════════════════════════════════════════════════════════════
// UI FUNCTIONS
// ═══════════════════════════════════════════════════════════════

// ─── Append Message ──────────────────────────────────────────────
function appendMessage(role, text, fileName = null) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role}`;
  messageDiv.setAttribute('role', 'article');
  messageDiv.setAttribute('aria-label', `${role} message`);

  // Create avatar
  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent = role === 'user' ? '👤' : '🤖';

  // Create content
  const content = document.createElement('div');
  content.className = 'message-content';

  // Add file tag if exists
  if (fileName) {
    const fileTag = document.createElement('div');
    fileTag.className = 'file-tag';
    fileTag.innerHTML = `📎 ${fileName}`;
    content.appendChild(fileTag);
  }

  // Add text
  const textP = document.createElement('p');
  textP.textContent = text;
  content.appendChild(textP);

  // Add message actions (for AI messages)
  if (role === 'ai') {
    const actions = createMessageActions(text);
    content.appendChild(actions);
  }

  messageDiv.appendChild(avatar);
  messageDiv.appendChild(content);
  elements.messagesArea.appendChild(messageDiv);

  scrollToBottom();
}

// ─── Append Message with Streaming ───────────────────────────────
async function appendMessageWithStreaming(role, text) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role}`;
  
  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent = '🤖';

  const content = document.createElement('div');
  content.className = 'message-content';

  const textP = document.createElement('p');
  content.appendChild(textP);

  messageDiv.appendChild(avatar);
  messageDiv.appendChild(content);
  elements.messagesArea.appendChild(messageDiv);

  // Streaming effect
  await typeText(textP, text);

  // Add message actions
  const actions = createMessageActions(text);
  content.appendChild(actions);

  scrollToBottom();
}

// ─── Type Text Effect ────────────────────────────────────────────
function typeText(element, text, speed = 10) {
  return new Promise((resolve) => {
    let index = 0;
    const cursor = document.createElement('span');
    cursor.className = 'streaming-cursor';
    cursor.setAttribute('aria-hidden', 'true');
    element.appendChild(cursor);

    const interval = setInterval(() => {
      if (index < text.length) {
        element.textContent = text.slice(0, index + 1);
        element.appendChild(cursor);
        index++;
        
        // Auto-scroll while typing
        if (index % 10 === 0) {
          scrollToBottom();
        }
      } else {
        cursor.remove();
        clearInterval(interval);
        resolve();
      }
    }, speed);
  });
}

// ─── Create Message Actions ──────────────────────────────────────
function createMessageActions(text) {
  const actions = document.createElement('div');
  actions.className = 'message-actions';

  // Copy button
  const copyBtn = document.createElement('button');
  copyBtn.className = 'message-action-btn';
  copyBtn.innerHTML = '📋 Copy';
  copyBtn.setAttribute('aria-label', 'Copy message');
  copyBtn.addEventListener('click', () => copyToClipboard(text, copyBtn));

  // Regenerate button (placeholder)
  const regenBtn = document.createElement('button');
  regenBtn.className = 'message-action-btn';
  regenBtn.innerHTML = '🔄 Regenerate';
  regenBtn.setAttribute('aria-label', 'Regenerate response');
  regenBtn.addEventListener('click', () => {
    // TODO: Implement regenerate functionality
    console.log('Regenerate clicked');
  });

  actions.appendChild(copyBtn);
  actions.appendChild(regenBtn);

  return actions;
}

// ─── Copy to Clipboard ───────────────────────────────────────────
async function copyToClipboard(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    const originalText = button.innerHTML;
    button.innerHTML = '✓ Copied';
    button.style.color = 'var(--success)';
    
    setTimeout(() => {
      button.innerHTML = originalText;
      button.style.color = '';
    }, 2000);
  } catch (err) {
    console.error('Failed to copy:', err);
  }
}

// ─── Append Error ────────────────────────────────────────────────
function appendError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-msg';
  errorDiv.setAttribute('role', 'alert');
  
  const errorText = document.createElement('span');
  errorText.textContent = `⚠️ ${message}`;
  
  const retryBtn = document.createElement('button');
  retryBtn.className = 'retry-btn';
  retryBtn.textContent = '🔄 Retry';
  retryBtn.addEventListener('click', () => {
    errorDiv.remove();
    handleSend();
  });

  errorDiv.appendChild(errorText);
  errorDiv.appendChild(retryBtn);
  elements.messagesArea.appendChild(errorDiv);

  scrollToBottom();
}

// ─── Loading State ───────────────────────────────────────────────
function setLoading(loading) {
  state.isLoading = loading;
  elements.sendBtn.disabled = loading;
  elements.messageInput.disabled = loading;

  const existingIndicator = elements.messagesArea.querySelector('.loading-indicator');
  
  if (loading) {
    const indicator = document.createElement('div');
    indicator.className = 'message ai loading-indicator';
    indicator.setAttribute('aria-label', 'AI is typing');
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = '🤖';
    
    const dots = document.createElement('div');
    dots.className = 'loading-dots';
    dots.setAttribute('aria-hidden', 'true');
    dots.innerHTML = '<span></span><span></span><span></span>';
    
    indicator.appendChild(avatar);
    indicator.appendChild(dots);
    elements.messagesArea.appendChild(indicator);
    scrollToBottom();
  } else {
    existingIndicator?.remove();
  }
}

// ─── File Handlers ───────────────────────────────────────────────
function handleFileSelect(e) {
  state.selectedFile = e.target.files[0] || null;
  if (state.selectedFile) {
    elements.filePreviewName.textContent = state.selectedFile.name;
    elements.filePreview.style.display = 'flex';
  }
}

function removeFile() {
  state.selectedFile = null;
  elements.fileInput.value = '';
  elements.filePreview.style.display = 'none';
}

// ─── Auto-resize Textarea ────────────────────────────────────────
function autoResizeTextarea() {
  elements.messageInput.style.height = 'auto';
  elements.messageInput.style.height = Math.min(
    elements.messageInput.scrollHeight,
    200
  ) + 'px';
}

// ─── Handle Key Press ────────────────────────────────────────────
function handleKeyPress(e) {
  // Enter without Shift = Send
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
}

// ─── Auto Focus Input ────────────────────────────────────────────
function autoFocusInput() {
  setTimeout(() => {
    elements.messageInput.focus();
  }, 100);
}

// ─── Scroll to Bottom ────────────────────────────────────────────
function scrollToBottom() {
  requestAnimationFrame(() => {
    elements.messagesArea.scrollTo({
      top: elements.messagesArea.scrollHeight,
      behavior: 'smooth'
    });
  });
}

// ─── Toggle Sidebar (Mobile) ─────────────────────────────────────
function toggleSidebar() {
  elements.sidebar.classList.toggle('open');
  const isOpen = elements.sidebar.classList.contains('open');
  elements.sidebarToggle.setAttribute('aria-expanded', isOpen);
}

// ─── Show Welcome Screen ─────────────────────────────────────────
function showWelcomeScreen() {
  const welcome = document.createElement('div');
  welcome.className = 'welcome-screen';
  welcome.id = 'welcomeScreen';
  welcome.innerHTML = `
    <div class="welcome-header">
      <div class="welcome-icon" aria-hidden="true">
        <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 8v8m-4-4h8"/>
        </svg>
      </div>
      <h1 class="welcome-title">What can I help with?</h1>
      <p class="welcome-subtitle">Start a conversation or try one of the suggestions below</p>
    </div>

    <div class="suggestions-grid">
      <button class="suggestion-card" data-prompt="Help me brainstorm creative ideas for a project">
        <span class="icon" aria-hidden="true">💡</span>
        <p>Brainstorm creative ideas for a project</p>
      </button>
      
      <button class="suggestion-card" data-prompt="Write a professional email for me">
        <span class="icon" aria-hidden="true">📝</span>
        <p>Write a professional email</p>
      </button>
      
      <button class="suggestion-card" data-prompt="Explain quantum computing in simple terms">
        <span class="icon" aria-hidden="true">🔍</span>
        <p>Explain a complex topic simply</p>
      </button>
      
      <button class="suggestion-card" data-prompt="Help me debug this code">
        <span class="icon" aria-hidden="true">💻</span>
        <p>Debug code or write scripts</p>
      </button>
    </div>
  `;
  
  elements.messagesArea.appendChild(welcome);
  setupSuggestionCards();
}

// ─── Response Handler ────────────────────────────────────────────
async function handleResponse(res) {
  let data;
  try {
    data = await res.json();
  } catch (err) {
    console.error('❌ Invalid JSON response:', err);
    throw new Error('Server returned invalid response: ' + res.status + ' ' + res.statusText);
  }
  
  if (!res.ok) {
    console.error('❌ API Error:', data);
    throw new Error(data.error?.message || data.error || data.message || 'Unknown error');
  }
  return data;
}

// ═══════════════════════════════════════════════════════════════
// ADDITIONAL FEATURES
// ═══════════════════════════════════════════════════════════════

// ─── Theme Toggle (Optional) ─────────────────────────────────────
function toggleTheme() {
  const html = document.documentElement;
  const currentTheme = html.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
}

// Load saved theme
function loadTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
}

// ─── Detect Mobile ───────────────────────────────────────────────
function isMobile() {
  return window.innerWidth <= 768;
}

// ─── Handle Resize ───────────────────────────────────────────────
window.addEventListener('resize', () => {
  if (!isMobile() && elements.sidebar.classList.contains('open')) {
    elements.sidebar.classList.remove('open');
  }
});

// ═══════════════════════════════════════════════════════════════
// INITIALIZATION ON LOAD
// ═══════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  loadTheme();
  init();
  console.log('🚀 AI Chatbot initialized');
});

// ─── Service Worker (Optional for PWA) ───────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // navigator.registerServiceWorker('/sw.js');
  });
}