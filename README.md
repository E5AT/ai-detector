# AI Text Detector

A web application that uses Google's Gemini 2.5 Flash API to analyze text and determine whether it was written by AI or a human. The detector provides a probability score, verdict, and explanation.

## Features

- **AI Detection**: Analyzes text using Gemini 2.5 Flash to determine likelihood of AI generation
- **Probability Score**: Displays a 0-100% confidence score with visual progress bar
- **Verdict System**: Three-tier verdict (Likely AI-Generated, Likely Human-Written, Uncertain)
- **Dark/Light Theme**: Toggle between light and dark modes
- **API Key Management**: Securely stores API key in localStorage
- **Character Counter**: Real-time character and word count with validation
- **Copy Results**: One-click copy of analysis results to clipboard
- **Responsive Design**: Works on desktop and mobile devices

## Getting a Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated API key
5. Paste it into the AI Text Detector interface

Gemini 2.5 Flash was chosen for its generous free tier — no paid subscription required for personal use.

## Usage

No installation required. Just open `index.html` in a browser:

1. Enter your Gemini API key in the input field
2. Paste or type the text you want to analyze
3. Click "Analyze Text" to get results

Or serve it with a local server:

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve .
```

### Keyboard Shortcuts

- `Ctrl+Enter` (or `Cmd+Enter` on Mac): Analyze text

## Project Structure

```
ai-detector/
├── index.html      # Frontend UI with Tailwind CSS
├── app.js          # Application logic and API calls
├── app.test.js     # Jest test suite (67 tests)
├── package.json    # Dependencies and scripts
└── node_modules/   # Installed packages
```

## Running Tests

```bash
npm install
npm test
```

All 67 tests pass, covering:

- JSON extraction from API responses (4 parsing levels)
- Response validation
- Theme initialization and toggling
- API key storage and retrieval
- Character counting logic
- Error handling

## Technical Details

- **Frontend**: Vanilla JavaScript with Tailwind CSS (via CDN)
- **API**: Google Gemini 2.5 Flash (`generateContent` endpoint)
- **Testing**: Jest with jsdom environment
- **Max Text Length**: 30,000 characters (auto-truncated with notification)
- **Storage**: localStorage for API key and theme preference

## License

MIT
