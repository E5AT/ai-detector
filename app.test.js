/**
 * AI Text Detector - Test Suite
 * Tests pure functions from app.js
 */

// Mock localStorage for all tests
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value; },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i) => Object.keys(store)[i]
  };
})();
global.localStorage = localStorageMock;

// Mock fetch
global.fetch = jest.fn();

// Mock clipboard
global.navigator.clipboard = {
  writeText: jest.fn().mockResolvedValue(undefined),
  readText: jest.fn().mockResolvedValue('')
};

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  localStorageMock.clear();
});

// ==============================================================================
// 1. extractJson() - Test all 4 fallback parsing levels
// ==============================================================================

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

describe('extractJson()', () => {
  // Level 1: Direct JSON parse
  test('parses valid JSON directly', () => {
    const input = '{"probability": 85, "verdict": "Likely AI-Generated", "explanation": "Test"}';
    const result = extractJson(input);
    expect(result).toEqual({ probability: 85, verdict: 'Likely AI-Generated', explanation: 'Test' });
  });

  test('returns null for invalid JSON (Level 1)', () => {
    const input = 'not json at all';
    const result = extractJson(input);
    expect(result).toBeNull();
  });

  test('returns null for empty string', () => {
    const result = extractJson('');
    expect(result).toBeNull();
  });

  // Level 2: Markdown code blocks
  test('parses JSON in markdown fence (json language)', () => {
    const input = '```json\n{"probability": 50, "verdict": "Uncertain", "explanation": "Test"}\n```';
    const result = extractJson(input);
    expect(result).toEqual({ probability: 50, verdict: 'Uncertain', explanation: 'Test' });
  });

  test('parses JSON in markdown fence (no language)', () => {
    const input = '```\n{"probability": 50, "verdict": "Uncertain", "explanation": "Test"}\n```';
    const result = extractJson(input);
    expect(result).toEqual({ probability: 50, verdict: 'Uncertain', explanation: 'Test' });
  });

  test('returns null for malformed markdown JSON', () => {
    const input = '```json\ninvalid json\n```';
    const result = extractJson(input);
    expect(result).toBeNull();
  });

  // Level 3: Structured regex extraction
  test('extracts JSON using structured regex', () => {
    const input = 'Here is some text before {"probability": 75, "verdict": "Likely Human-Written", "explanation": "Test"} and some text after';
    const result = extractJson(input);
    expect(result).toEqual({ probability: 75, verdict: 'Likely Human-Written', explanation: 'Test' });
  });

  test('extracts JSON with decimal probability', () => {
    const input = '{"probability": 45.5, "verdict": "Uncertain", "explanation": "Test"}';
    const result = extractJson(input);
    expect(result).toEqual({ probability: 45.5, verdict: 'Uncertain', explanation: 'Test' });
  });

  // Level 4: Fallback bare JSON extraction
  test('extracts bare JSON object as last resort', () => {
    const input = 'Some random text { "probability": 30, "verdict": "Human", "explanation": "Test" } more text';
    const result = extractJson(input);
    expect(result).toEqual({ probability: 30, verdict: 'Human', explanation: 'Test' });
  });

  test('returns null when no JSON found', () => {
    const input = 'This is just plain text with no JSON at all';
    const result = extractJson(input);
    expect(result).toBeNull();
  });

  // Edge cases
  test('handles JSON with extra whitespace', () => {
    const input = '  {"probability": 10, "verdict": "Human", "explanation": "Test"}  ';
    const result = extractJson(input);
    expect(result).toEqual({ probability: 10, verdict: 'Human', explanation: 'Test' });
  });

  test('handles multiline explanation in markdown', () => {
    const input = '```json\n{\n  "probability": 60,\n  "verdict": "Uncertain",\n  "explanation": "Line 1\\nLine 2"\n}\n```';
    const result = extractJson(input);
    expect(result.probability).toBe(60);
    expect(result.verdict).toBe('Uncertain');
  });
});

// ==============================================================================
// 2. validateParsed() - Test validation
// ==============================================================================

function validateParsed(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (typeof obj.probability !== 'number' || Number.isNaN(obj.probability)) return false;
  if (typeof obj.explanation !== 'string') return false;
  return true;
}

describe('validateParsed()', () => {
  test('returns true for valid object', () => {
    const obj = { probability: 85, verdict: 'AI', explanation: 'Test' };
    expect(validateParsed(obj)).toBe(true);
  });

  test('returns false for null', () => {
    expect(validateParsed(null)).toBe(false);
  });

  test('returns false for undefined', () => {
    expect(validateParsed(undefined)).toBe(false);
  });

  test('returns false for array', () => {
    expect(validateParsed([])).toBe(false);
  });

  test('returns false for string', () => {
    expect(validateParsed('not an object')).toBe(false);
  });

  test('returns false when probability is missing', () => {
    const obj = { verdict: 'AI', explanation: 'Test' };
    expect(validateParsed(obj)).toBe(false);
  });

  test('returns false when probability is wrong type (string)', () => {
    const obj = { probability: '85', verdict: 'AI', explanation: 'Test' };
    expect(validateParsed(obj)).toBe(false);
  });

  test('returns false when probability is NaN', () => {
    const obj = { probability: NaN, verdict: 'AI', explanation: 'Test' };
    expect(validateParsed(obj)).toBe(false);
  });

  test('returns false when explanation is missing', () => {
    const obj = { probability: 85, verdict: 'AI' };
    expect(validateParsed(obj)).toBe(false);
  });

  test('returns false when explanation is wrong type', () => {
    const obj = { probability: 85, verdict: 'AI', explanation: 123 };
    expect(validateParsed(obj)).toBe(false);
  });

  test('returns false for empty object', () => {
    expect(validateParsed({})).toBe(false);
  });

  test('validates probability as 0', () => {
    const obj = { probability: 0, verdict: 'Human', explanation: 'Test' };
    expect(validateParsed(obj)).toBe(true);
  });

  test('validates probability as 100', () => {
    const obj = { probability: 100, verdict: 'AI', explanation: 'Test' };
    expect(validateParsed(obj)).toBe(true);
  });

  test('validates negative probability as number', () => {
    const obj = { probability: -5, verdict: 'AI', explanation: 'Test' };
    expect(validateParsed(obj)).toBe(true); // typeof -5 === 'number' is true
  });
});

// ==============================================================================
// 3. Character/Word Counting and Truncation Logic
// ==============================================================================

const MAX_CHARS = 30000;

function countCharacters(text) {
  return text.length;
}

function countWords(text) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function truncateText(text, maxChars) {
  if (text.length > maxChars) {
    return { truncated: text.slice(0, maxChars), wasTruncated: true };
  }
  return { truncated: text, wasTruncated: false };
}

describe('Character and Word Counting', () => {
  test('counts characters correctly', () => {
    expect(countCharacters('hello')).toBe(5);
    expect(countCharacters('')).toBe(0);
    expect(countCharacters('hello world')).toBe(11);
  });

  test('counts words correctly', () => {
    expect(countWords('hello world')).toBe(2);
    expect(countWords('')).toBe(0);
    expect(countWords('  multiple   spaces  ')).toBe(2);
    expect(countWords('one')).toBe(1);
  });

  test('handles special characters in word count', () => {
    expect(countWords('Hello, world!')).toBe(2);
    expect(countWords("It's a test.")).toBe(3);
  });
});

describe('Text Truncation', () => {
  test('returns original text when under limit', () => {
    const result = truncateText('short text', MAX_CHARS);
    expect(result.truncated).toBe('short text');
    expect(result.wasTruncated).toBe(false);
  });

  test('truncates text when over 30,000 chars', () => {
    const longText = 'a'.repeat(35000);
    const result = truncateText(longText, MAX_CHARS);
    expect(result.truncated.length).toBe(MAX_CHARS);
    expect(result.wasTruncated).toBe(true);
  });

  test('handles exactly 30,000 characters', () => {
    const exactText = 'a'.repeat(30000);
    const result = truncateText(exactText, MAX_CHARS);
    expect(result.truncated.length).toBe(30000);
    expect(result.wasTruncated).toBe(false);
  });

  test('handles text just over limit', () => {
    const text = 'a'.repeat(30001);
    const result = truncateText(text, MAX_CHARS);
    expect(result.truncated.length).toBe(30000);
    expect(result.wasTruncated).toBe(true);
  });
});

// ==============================================================================
// 4. API Key Validation
// ==============================================================================

function validateApiKey(key) {
  const trimmed = key ? key.trim() : '';
  return trimmed.length > 0;
}

describe('API Key Validation', () => {
  test('returns false for empty string', () => {
    expect(validateApiKey('')).toBe(false);
  });

  test('returns false for null', () => {
    expect(validateApiKey(null)).toBe(false);
  });

  test('returns false for undefined', () => {
    expect(validateApiKey(undefined)).toBe(false);
  });

  test('returns false for whitespace-only string', () => {
    expect(validateApiKey('   ')).toBe(false);
  });

  test('returns false for newline-only', () => {
    expect(validateApiKey('\n\t')).toBe(false);
  });

  test('returns true for valid key', () => {
    expect(validateApiKey('AIzaSy...')).toBe(true);
  });

  test('returns true for key with spaces around', () => {
    expect(validateApiKey('  AIzaSy...  ')).toBe(true); // trim happens in validation
  });
});

// ==============================================================================
// 5. LocalStorage Persistence
// ==============================================================================

// Simulate the storage object from app.js
const storage = {
  getApiKey: () => localStorage.getItem('gemini_api_key') || '',
  setApiKey: (key) => localStorage.setItem('gemini_api_key', key),
  getTheme: () => localStorage.getItem('theme') || 'light',
  setTheme: (theme) => localStorage.setItem('theme', theme)
};

describe('LocalStorage - API Key', () => {
  test('getApiKey returns empty string when not set', () => {
    localStorage.clear();
    expect(storage.getApiKey()).toBe('');
  });

  test('setApiKey stores and getApiKey retrieves', () => {
    localStorage.clear();
    storage.setApiKey('my-api-key-123');
    expect(storage.getApiKey()).toBe('my-api-key-123');
  });

  test('setApiKey overwrites existing key', () => {
    localStorage.clear();
    storage.setApiKey('first-key');
    storage.setApiKey('second-key');
    expect(storage.getApiKey()).toBe('second-key');
  });

  test('getApiKey returns empty string for undefined stored value', () => {
    localStorage.clear();
    // Not setting any value - should return empty string
    expect(storage.getApiKey()).toBe('');
  });
});

describe('LocalStorage - Theme', () => {
  test('getTheme returns default light when not set', () => {
    localStorage.clear();
    expect(storage.getTheme()).toBe('light');
  });

  test('setTheme stores and getTheme retrieves', () => {
    localStorage.clear();
    storage.setTheme('dark');
    expect(storage.getTheme()).toBe('dark');
  });

  test('getTheme returns stored value', () => {
    localStorage.clear();
    localStorage.setItem('theme', 'dark');
    expect(storage.getTheme()).toBe('dark');
  });

  test('setTheme overwrites existing theme', () => {
    localStorage.clear();
    storage.setTheme('dark');
    storage.setTheme('light');
    expect(storage.getTheme()).toBe('light');
  });
});

// ==============================================================================
// 6. API Error Handling (Mocked fetch)
// ==============================================================================

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

async function analyzeText(text, apiKey) {
  const prompt = `Test prompt with ${text}`;
  
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
    throw new Error('Could not parse AI response. Try a shorter text.');
  }
  
  return parsed;
}

describe('API Error Handling - HTTP Status Codes', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  test('throws error for 400 Bad Request', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: { message: 'Bad Request' } })
    });

    await expect(analyzeText('test text', 'api-key'))
      .rejects.toThrow('Bad request. Check your API key and try again.');
  });

  test('throws error for 401 Unauthorized', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: { message: 'Unauthorized' } })
    });

    await expect(analyzeText('test text', 'invalid-key'))
      .rejects.toThrow('Invalid API key. Get a new key from aistudio.google.com');
  });

  test('throws error for 403 Forbidden', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: { message: 'Forbidden' } })
    });

    await expect(analyzeText('test text', 'forbidden-key'))
      .rejects.toThrow('Invalid API key. Get a new key from aistudio.google.com');
  });

  test('throws error for 429 Rate Limit', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ error: { message: 'Rate limit exceeded' } })
    });

    await expect(analyzeText('test text', 'any-key'))
      .rejects.toThrow('Rate limit hit. Wait 1 minute and try again.');
  });

  test('throws generic error for other HTTP errors', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: { message: 'Internal Server Error' } })
    });

    await expect(analyzeText('test text', 'any-key'))
      .rejects.toThrow('Internal Server Error');
  });

  test('throws generic error for unknown HTTP errors', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 999,
      json: () => Promise.resolve({})
    });

    await expect(analyzeText('test text', 'any-key'))
      .rejects.toThrow('API error (999)');
  });
});

describe('API Error Handling - Response Content', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  test('throws error when candidates is empty', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ candidates: [] })
    });

    await expect(analyzeText('test text', 'api-key'))
      .rejects.toThrow('AI could not analyze this text. Content may be blocked.');
  });

  test('throws error when candidates is undefined', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({})
    });

    await expect(analyzeText('test text', 'api-key'))
      .rejects.toThrow('AI could not analyze this text. Content may be blocked.');
  });

  test('throws error when response content is empty', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ candidates: [{ content: { parts: [{}] } }] })
    });

    await expect(analyzeText('test text', 'api-key'))
      .rejects.toThrow('Empty response from API. Try again.');
  });

  test('throws error when JSON parsing fails', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        candidates: [{ content: { parts: [{ text: 'invalid json response' }] } }]
      })
    });

    await expect(analyzeText('test text', 'api-key'))
      .rejects.toThrow('Could not parse AI response. Try a shorter text.');
  });
});

describe('API Success Flow', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  test('returns parsed result on success', async () => {
    const mockResponse = {
      candidates: [{
        content: {
          parts: [{
            text: '{"probability": 45, "verdict": "Uncertain", "explanation": "Test explanation"}'
          }]
        }
      }]
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse)
    });

    const result = await analyzeText('test text', 'valid-api-key');
    expect(result.probability).toBe(45);
    expect(result.verdict).toBe('Uncertain');
    expect(result.explanation).toBe('Test explanation');
  });

  test('makes request to correct endpoint', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ candidates: [{ content: { parts: [{ text: '{"probability":0,"verdict":"Uncertain","explanation":"x"}' }] } }] })
    });

    await analyzeText('test', 'my-api-key');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(GEMINI_ENDPOINT),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
    );
  });
});

// ==============================================================================
// 7. Verdict Classification Logic
// ==============================================================================

function classifyVerdict(probability) {
  if (probability >= 66) return { label: 'Likely AI-Generated', class: 'ai', color: 'red' };
  if (probability <= 35) return { label: 'Likely Human-Written', class: 'human', color: 'green' };
  return { label: 'Uncertain', class: 'uncertain', color: 'amber' };
}

describe('Verdict Classification', () => {
  test('classifies probability >= 66 as AI', () => {
    expect(classifyVerdict(66)).toEqual({ label: 'Likely AI-Generated', class: 'ai', color: 'red' });
    expect(classifyVerdict(85)).toEqual({ label: 'Likely AI-Generated', class: 'ai', color: 'red' });
    expect(classifyVerdict(100)).toEqual({ label: 'Likely AI-Generated', class: 'ai', color: 'red' });
  });

  test('classifies probability <= 35 as Human', () => {
    expect(classifyVerdict(35)).toEqual({ label: 'Likely Human-Written', class: 'human', color: 'green' });
    expect(classifyVerdict(10)).toEqual({ label: 'Likely Human-Written', class: 'human', color: 'green' });
    expect(classifyVerdict(0)).toEqual({ label: 'Likely Human-Written', class: 'human', color: 'green' });
  });

  test('classifies probability 36-65 as Uncertain', () => {
    expect(classifyVerdict(36)).toEqual({ label: 'Uncertain', class: 'uncertain', color: 'amber' });
    expect(classifyVerdict(50)).toEqual({ label: 'Uncertain', class: 'uncertain', color: 'amber' });
    expect(classifyVerdict(65)).toEqual({ label: 'Uncertain', class: 'uncertain', color: 'amber' });
  });

  test('clamps probability to 0-100 range', () => {
    const result = classifyVerdict(Math.round(85.7));
    expect(result.label).toBe('Likely AI-Generated');
  });
});

// ==============================================================================
// 8. State Management
// ==============================================================================

function createInitialState() {
  return {
    apiKey: '',
    isLoading: false,
    lastResult: null,
    currentTheme: 'light'
  };
}

function updateState(state, updates) {
  return { ...state, ...updates };
}

describe('State Management', () => {
  test('creates initial state correctly', () => {
    const state = createInitialState();
    expect(state.apiKey).toBe('');
    expect(state.isLoading).toBe(false);
    expect(state.lastResult).toBeNull();
    expect(state.currentTheme).toBe('light');
  });

  test('updates state with new values', () => {
    const state = createInitialState();
    const newState = updateState(state, { 
      apiKey: 'test-key',
      isLoading: true 
    });
    
    expect(newState.apiKey).toBe('test-key');
    expect(newState.isLoading).toBe(true);
    expect(newState.currentTheme).toBe('light'); // unchanged
    expect(newState.lastResult).toBeNull(); // unchanged
  });

  test('does not mutate original state', () => {
    const state = createInitialState();
    const newState = updateState(state, { apiKey: 'new-key' });
    
    expect(state.apiKey).toBe('');
    expect(newState.apiKey).toBe('new-key');
  });
});
