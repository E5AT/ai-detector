// ============================================================
// CONFIG
// ============================================================
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const DETECTION_PROMPT = `You are a balanced text analysis system. Your goal is to determine whether text was written by a human or AI.

IMPORTANT: Most text in the world is human-written. Only score HIGH probability if there are CLEAR, UNMISTAKABLE signs of AI generation. Be conservative - when in doubt, lean toward human.

Evaluate the text for these HUMAN indicators (gives lower AI score):
- Personal voice, unique perspective, or individual opinion
- Historical context, era-specific language, or cultural references
- Emotional nuance, personal anecdotes, or subjective observations
- Natural imperfections: occasional typos, informal language, contractions
- Varied sentence structure, rhythm, or stylistic choices
- Specific named entities, real places, or lived experiences

Evaluate for AI indicators (only gives high score if MULTIPLE strong signs):
- Robotic or unnaturally perfect grammar throughout
- Generic, vague language with no specific details
- Repetitive sentence structures or parallel constructions
- Hedging language like "generally," "often," "typically" used excessively
- No emotional connection or personal perspective
- Surface-level analysis without depth or nuance
- Clock-like consistency in writing quality (too perfect)

If the text is well-written literature, academic content, or formal writing - assume HUMAN unless there are MULTIPLE obvious AI tells.

Respond ONLY in this exact JSON format:
{
  "probability": <integer 0-100>,
  "verdict": "<Likely AI-Generated | Likely Human-Written | Uncertain>",
  "explanation": "<2-3 sentences explaining your reasoning>"
}

Text to analyze:
{TEXT}`;

const MAX_CHARS = 30000;

// ============================================================
// STATE
// ============================================================
const state = {
  apiKey: '',
  isLoading: false,
  lastResult: null,
  currentTheme: 'light'
};

// ============================================================
// DOM ELEMENTS
// ============================================================
const DOM = {
  htmlRoot: document.getElementById('html-root'),
  themeToggle: document.getElementById('theme-toggle'),
  iconMoon: document.getElementById('icon-moon'),
  iconSun: document.getElementById('icon-sun'),
  bgGlow: document.getElementById('bg-glow'),
  body: document.body,
  apiKeyInput: document.getElementById('api-key-input'),
  togglePassword: document.getElementById('toggle-password'),
  apiKeyStatus: document.getElementById('api-key-status'),
  textInput: document.getElementById('text-input'),
  charCount: document.getElementById('char-count'),
  analyzeBtn: document.getElementById('analyze-btn'),
  btnText: document.getElementById('btn-text'),
  loadingSpinner: document.getElementById('loading-spinner'),
  errorMessage: document.getElementById('error-message'),
  errorText: document.getElementById('error-text'),
  resultSection: document.getElementById('result-section'),
  verdictBadge: document.getElementById('verdict-badge'),
  percentage: document.getElementById('percentage'),
  confidenceFill: document.getElementById('confidence-fill'),
  confidenceLabel: document.getElementById('confidence-label'),
  explanation: document.getElementById('explanation'),
  copyBtn: document.getElementById('copy-btn'),
  copyText: document.getElementById('copy-text'),
  clearBtn: document.getElementById('clear-btn')
};

// ============================================================
// STORAGE
// ============================================================
const storage = {
  getApiKey: () => localStorage.getItem('gemini_api_key') || '',
  setApiKey: (key) => localStorage.setItem('gemini_api_key', key),
  getTheme: () => localStorage.getItem('theme') || 'light',
  setTheme: (theme) => localStorage.setItem('theme', theme)
};

// ============================================================
// DARK MODE
// ============================================================
function initTheme() {
  const savedTheme = storage.getTheme();
  state.currentTheme = savedTheme;
  applyTheme(savedTheme);
}

function applyTheme(theme) {
  if (theme === 'dark') {
    DOM.htmlRoot.classList.add('dark');
    DOM.bgGlow.classList.remove('opacity-0');
    DOM.body.classList.remove('bg-gray-100', 'text-gray-900');
    DOM.body.classList.add('bg-slate-900', 'text-white');
    DOM.iconMoon.classList.add('hidden');
    DOM.iconSun.classList.remove('hidden');
  } else {
    DOM.htmlRoot.classList.remove('dark');
    DOM.bgGlow.classList.add('opacity-0');
    DOM.body.classList.add('bg-gray-100', 'text-gray-900');
    DOM.body.classList.remove('bg-slate-900', 'text-white');
    DOM.iconMoon.classList.remove('hidden');
    DOM.iconSun.classList.add('hidden');
  }
}

function toggleTheme() {
  const newTheme = state.currentTheme === 'dark' ? 'light' : 'dark';
  state.currentTheme = newTheme;
  storage.setTheme(newTheme);
  applyTheme(newTheme);
}

// ============================================================
// API KEY HANDLING
// ============================================================
function loadApiKey() {
  state.apiKey = storage.getApiKey();
  DOM.apiKeyInput.value = state.apiKey;
  updateApiKeyStatus();
}

function handleApiKeyInput() {
  state.apiKey = DOM.apiKeyInput.value.trim();
  storage.setApiKey(state.apiKey);
  updateApiKeyStatus();
  updateAnalyzeButton();
}

function updateApiKeyStatus() {
  if (state.apiKey) {
    DOM.apiKeyStatus.textContent = 'Saved ✓';
    DOM.apiKeyStatus.className = 'text-xs text-emerald-500 dark:text-emerald-400';
  } else {
    DOM.apiKeyStatus.textContent = '';
  }
}

function togglePasswordVisibility() {
  const currentType = DOM.apiKeyInput.type;
  DOM.apiKeyInput.type = currentType === 'password' ? 'text' : 'password';
}

// ============================================================
// CHARACTER COUNTER
// ============================================================
function updateCharCount() {
  const text = DOM.textInput.value;
  const charLen = text.length;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  
  let displayText = charLen === 1 ? '1 character' : `${charLen.toLocaleString()} characters`;
  if (charLen > 0 && wordCount > 0) {
    displayText += ` (${wordCount.toLocaleString()} words)`;
  }
  
  DOM.charCount.textContent = displayText;
  
  if (charLen > 0 && charLen < 50) {
    DOM.charCount.classList.add('text-amber-500');
    DOM.charCount.classList.remove('text-gray-500', 'dark:text-gray-400');
  } else {
    DOM.charCount.classList.remove('text-amber-500');
    DOM.charCount.classList.add('text-gray-500', 'dark:text-gray-400');
  }
  
  updateAnalyzeButton();
}

function updateAnalyzeButton() {
  const hasText = DOM.textInput.value.trim().length > 0;
  const hasApiKey = state.apiKey.length > 0;
  DOM.analyzeBtn.disabled = !hasText || !hasApiKey || state.isLoading;
}

// ============================================================
// UI RENDERERS
// ============================================================
function showLoading() {
  state.isLoading = true;
  DOM.analyzeBtn.classList.add('opacity-50');
  DOM.analyzeBtn.disabled = true;
  DOM.btnText.textContent = 'Analyzing...';
  DOM.loadingSpinner.classList.remove('hidden');
}

function hideLoading() {
  state.isLoading = false;
  DOM.analyzeBtn.classList.remove('opacity-50');
  DOM.btnText.textContent = 'Analyze Text';
  DOM.loadingSpinner.classList.add('hidden');
  updateAnalyzeButton();
}

function showError(message) {
  DOM.errorText.textContent = message;
  DOM.errorMessage.classList.remove('hidden');
}

function hideError() {
  DOM.errorMessage.classList.add('hidden');
}

function renderResult(result) {
  state.lastResult = result;
  
  const probability = Math.max(0, Math.min(100, Math.round(result.probability)));
  
  let verdictText = result.verdict;
  let badgeBg = 'bg-amber-500';
  let percentageColor = 'text-amber-500';
  let progressGradient = 'progress-gradient-uncertain';
  
  if (probability >= 66) {
    badgeBg = 'bg-red-500';
    percentageColor = 'text-red-500';
    progressGradient = 'progress-gradient-ai';
    verdictText = 'Likely AI-Generated';
  } else if (probability <= 35) {
    badgeBg = 'bg-emerald-500';
    percentageColor = 'text-emerald-500';
    progressGradient = 'progress-gradient-human';
    verdictText = 'Likely Human-Written';
  }
  
  DOM.verdictBadge.textContent = verdictText;
  DOM.verdictBadge.className = `inline-flex items-center px-4 py-1.5 rounded-full text-sm font-bold ${badgeBg} text-white`;
  
  DOM.percentage.textContent = `${probability}%`;
  DOM.percentage.className = `text-5xl font-extrabold ${percentageColor}`;
  
  DOM.confidenceFill.className = `h-full rounded-full transition-all duration-1000 ease-out ${progressGradient}`;
  
  setTimeout(() => {
    DOM.confidenceFill.style.width = `${probability}%`;
  }, 50);
  
  DOM.confidenceLabel.textContent = `${probability}%`;
  DOM.explanation.textContent = result.explanation || 'No explanation provided.';
  
  DOM.resultSection.classList.remove('hidden');
  DOM.resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideResult() {
  DOM.resultSection.classList.add('hidden');
  DOM.confidenceFill.style.width = '0%';
  state.lastResult = null;
}

// ============================================================
// API CALL
// ============================================================
async function analyzeText(text, apiKey) {
  const prompt = DETECTION_PROMPT.replace('{TEXT}', text);
  
  const response = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, topP: 0.8, maxOutputTokens: 2048 }
    })
  });
  
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const status = response.status;
    if (status === 400) throw new Error('Bad request. Check your API key and try again.');
    if (status === 401 || status === 403) throw new Error('Invalid API key. Get a new key from aistudio.google.com');
    if (status === 429) throw new Error('Rate limit hit. Wait 1 minute and try again.');
    throw new Error(errData?.error?.message || `API error (${status})`);
  }
  
  const data = await response.json();
  const candidates = data?.candidates;
  if (!candidates || candidates.length === 0) {
    throw new Error('AI could not analyze this text. Content may be blocked.');
  }
  
  const rawContent = candidates[0]?.content?.parts?.[0]?.text;
  if (!rawContent) {
    throw new Error('Empty response from API. Try again.');
  }
  
  const parsed = extractJson(rawContent);
  if (!parsed || !validateParsed(parsed)) {
    console.error('Parse error:', rawContent);
    throw new Error('Could not parse AI response. Try a shorter text.');
  }
  
  return parsed;
}

function extractJson(raw) {
  let text = raw.trim();
  try { return JSON.parse(text); } catch {}
  
  const patterns = [/```json\s*([\s\S]*?)```/i, /```\s*([\s\S]*?)```/];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) { try { return JSON.parse(match[1].trim()); } catch {} }
  }
  
  const structured = text.match(/\{\s*"probability"\s*:\s*(\d+(?:\.\d+)?)\s*,\s*"verdict"\s*:\s*"([^"]+)"\s*,\s*"explanation"\s*:\s*"([^"]+)"\s*\}/s);
  if (structured) {
    return { probability: parseFloat(structured[1]), verdict: structured[2], explanation: structured[3] };
  }
  
  const bare = text.match(/\{[\s\S]*?\}/);
  if (bare) { try { return JSON.parse(bare[0]); } catch {} }
  
  return null;
}

function validateParsed(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (typeof obj.probability !== 'number' || Number.isNaN(obj.probability)) return false;
  if (typeof obj.explanation !== 'string') return false;
  return true;
}

// ============================================================
// ACTIONS
// ============================================================
async function analyze() {
  if (state.isLoading) return;
  hideError();
  
  const apiKey = state.apiKey || DOM.apiKeyInput.value.trim();
  if (!apiKey) {
    showError('Please enter your Google AI Studio API key.');
    return;
  }
  
  if (!state.apiKey && apiKey) {
    state.apiKey = apiKey;
    storage.setApiKey(apiKey);
    updateApiKeyStatus();
  }
  
  const rawText = DOM.textInput.value.trim();
  if (!rawText) {
    showError('Please paste some text to analyze.');
    return;
  }
  
  const text = rawText.length > MAX_CHARS ? rawText.slice(0, MAX_CHARS) : rawText;
  const wasTruncated = rawText.length > MAX_CHARS;
  
  showLoading();
  
  try {
    let result = await analyzeText(text, apiKey);
    if (wasTruncated) {
      result.explanation += ' (Text truncated to 30,000 chars.)';
    }
    renderResult(result);
  } catch (error) {
    showError(error.message || 'An unexpected error occurred.');
  } finally {
    hideLoading();
  }
}

function copyResult() {
  if (!state.lastResult) return;
  
  const result = state.lastResult;
  const probability = Math.max(0, Math.min(100, Math.round(result.probability)));
  let verdictText = result.verdict;
  if (probability >= 66) verdictText = 'Likely AI-Generated';
  else if (probability <= 35) verdictText = 'Likely Human-Written';
  else verdictText = 'Uncertain';
  
  const text = `AI Text Detector Result

Score: ${probability}% likelihood of AI generation
Verdict: ${verdictText}

Explanation: ${result.explanation}`;
  
  navigator.clipboard.writeText(text).then(() => {
    DOM.copyText.textContent = 'Copied ✓';
    setTimeout(() => { DOM.copyText.textContent = 'Copy Result'; }, 2000);
  }).catch(() => {
    showError('Could not copy to clipboard.');
  });
}

function clearAll() {
  DOM.textInput.value = '';
  updateCharCount();
  hideResult();
  hideError();
  DOM.textInput.focus();
}

// ============================================================
// EVENT LISTENERS
// ============================================================
function bindEvents() {
  DOM.themeToggle.addEventListener('click', toggleTheme);
  DOM.apiKeyInput.addEventListener('input', handleApiKeyInput);
  DOM.apiKeyInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') DOM.textInput.focus(); });
  DOM.togglePassword.addEventListener('click', togglePasswordVisibility);
  DOM.textInput.addEventListener('input', updateCharCount);
  DOM.textInput.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !DOM.analyzeBtn.disabled) analyze(); });
  DOM.analyzeBtn.addEventListener('click', analyze);
  DOM.copyBtn.addEventListener('click', copyResult);
  DOM.clearBtn.addEventListener('click', clearAll);
}

// ============================================================
// INIT
// ============================================================
function init() {
  initTheme();
  loadApiKey();
  updateCharCount();
  bindEvents();
}

document.addEventListener('DOMContentLoaded', init);
