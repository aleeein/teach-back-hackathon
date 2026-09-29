# TeachBack

Learn it by teaching it. Byte is an AI student that only knows what you teach it. When Byte gets a question wrong, TeachBack shows you the exact sentence you taught that caused it.

Hackathon prototype for the University of Melbourne FEIT Hackathon 2026 (Untapped challenge). Not an official Untapped or SFIA product.

## What's in this folder

| File | What it does |
|---|---|
| `public/index.html` | The whole app: screens, Byte, courses, rewards, Demo mode. Runs in the browser. |
| `server.mjs` | A tiny web server. Serves the page and forwards AI requests. |
| `ai.mjs` | The only file that talks to an AI model (Claude API or Ollama). |
| `scripts/check-ai.mjs` | `npm run check`: one test call to confirm your AI setup works. |
| `.env.example` | Settings template. You copy it to `.env` and add your key. |
| `.gitignore` | Stops `.env` (your key) from ever being uploaded to GitHub. |

No `npm install` is needed. Everything uses built-in Node.js features.

## How it works

```
Browser (public/index.html)
   │  POST /api/llm  { system, user, schema }
   ▼
server.mjs  ──►  ai.mjs  ──►  Claude API  or  Ollama on your computer
   ▲                              │
   └──────── one JSON object ◄────┘
```

The browser never sees your API key. The key stays in `.env` on your computer, and only `server.mjs` reads it.

The AI never grades alone. The AI writes Byte's notes and answers, but code in `index.html` then checks every note quotes your exact words, every answer cites a note, and scores follow fixed rules.

## Setup

### 1. Install Node.js

Download the LTS version from https://nodejs.org and install it. Then open a terminal (Terminal on Mac, PowerShell on Windows) and check:

```
node --version
```

You need v18 or newer.

### 2. Put the project somewhere sensible

Unzip `teachback-prototype.zip` into a folder, for example `Documents/teachback-prototype`. In the terminal, go into it:

```
cd Documents/teachback-prototype
```

### 3. Try it with no AI at all (Demo mode)

```
npm start
```

Open http://localhost:3000. You'll see a banner saying Byte can't reach an AI model. Click **Use Demo mode**. Byte now uses scripted rules, so you can click through the whole app. Press `Ctrl+C` in the terminal to stop the server.

### 4. Connect a real AI

Copy the settings file:

```
cp .env.example .env          # Mac / Linux
copy .env.example .env        # Windows
```

Then open `.env` in a text editor and pick one option.

**Option A: Claude API.** Best quality, costs a little per use.
1. Sign in at https://console.anthropic.com, add some credit under Billing, and create a key under API keys.
2. In `.env`, set `AI_PROVIDER=anthropic` and paste the key after `ANTHROPIC_API_KEY=`.
3. Haiku (the default model) is fast and cheap for testing.

**Option B: Ollama.** Free, private, runs entirely on your computer.
1. Install Ollama from https://ollama.com.
2. Download a model: `ollama pull qwen2.5:7b` (about 5 GB; needs roughly 8 GB of free RAM).
3. In `.env`, set `AI_PROVIDER=ollama`.
4. Small local models are slower and make more mistakes. Expect more "Couldn't verify" results than with Claude.

### 5. Check the connection

```
npm run check
```

You should see `Works (… ms). The model said: …`. If not, the message says what's wrong (see Troubleshooting).

### 6. Run it for real

```
npm start
```

Open http://localhost:3000. The banner should be gone. Teach Byte something in the phishing course and it will use the real model. Turn Demo mode off in **Profile → Presenting** if you turned it on earlier.

## Put it on GitHub

Keep the repository **private** during the hackathon: the challenge material is for hackathon use only.

1. Install Git from https://git-scm.com.
2. On https://github.com, click **New repository**, name it `teachback`, choose **Private**, and don't add a README (you already have one).
3. In the project folder, run:

```
git init
git add .
git commit -m "TeachBack prototype"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/teachback.git
git push -u origin main
```

4. Before pushing, run `git status` and check that `.env` is **not** listed. `.gitignore` should keep it out. If `.env` ever reaches GitHub, delete that key in the Anthropic Console straight away and create a new one.

Teammates then run `git clone …`, create their own `.env`, and use `npm start`.

## Where to change things

All of these are in `public/index.html`. Search for the name in quotes.

| To change | Search for |
|---|---|
| Phishing lesson cards | `var LESSON = [` |
| Questions Byte is tested on | `var BYTE_QUESTIONS = {` |
| How Byte's answers are marked | `var BYTE_RUBRIC = {` |
| Warm-up and final questions | `var LEARNER_QUESTIONS = {` |
| The SFIA sample course | `var SFIA_COURSE = {` |
| Course list | `var CATALOGUE = [` |
| Badges and XP | `function progress()` |
| Certificate | `function certificateHtml` |
| Skills passport | `function passportHtml` |
| Demo mode rules | `var DEMO_RULES = {` |
| AI instructions for note-taking | `// lib/extract.js` |

The file was bundled from separate modules. The `// lib/...` comments mark where each original module starts, which makes it easy to split into files later.

## Troubleshooting

| Message | Fix |
|---|---|
| `Claude API: invalid x-api-key` | The key in `.env` is wrong or has spaces. Copy it again. |
| `Claude API: … credit balance` | Add credit in the Anthropic Console under Billing. |
| `Couldn't reach the AI service (ECONNREFUSED)` with Ollama | Start the Ollama app, then try again. |
| `Ollama: model … not found` | Run `ollama pull qwen2.5:7b` (or whatever `OLLAMA_MODEL` says). |
| Lots of "Couldn't verify" results | The model isn't following instructions well. Use a larger model. |
| `EADDRINUSE` | Port 3000 is taken. Set `PORT=3001` in `.env`. |
| Page shows the banner even though `npm run check` works | Restart `npm start` after editing `.env`. |
| Mic button missing | Voice input only works in Chrome or Edge. |

## Safety notes

- The server only listens on your own computer (`127.0.0.1`), so nobody else on your Wi-Fi can use it or your key.
- With the Claude API, the text you teach Byte and any material you upload goes to Anthropic. With Ollama, nothing leaves your computer.
- Progress is saved in your browser's local storage, not on the server.
