# ✉️ MailPilot AI

> **Autonomous, Intelligent Gmail Auto-Reply & 24/7 Inbox Copilot powered by Google Gemini.**

MailPilot AI monitors your Gmail inbox in real-time, triages incoming correspondence using Gemini intelligence, generates context-aware draft responses in your personal tone, and autonomously dispatches or stages replies according to granular safety rules.

---

## ✨ Features

- **🧠 Multimodal Gemini Triage Pipeline**: Analyzes incoming messages for urgency, category, sentiment, action items, dates, and sensitive disclosures with high precision.
- **⚡ 3 Operational Modes**:
  - **Autonomous Mode**: Sends replies directly without requiring manual confirmation.
  - **Review Queue (Human-in-the-Loop)**: Staged draft inbox with one-click approval, edits, or tone regeneration.
  - **Manual Mode**: Analyzes incoming emails and leaves replies purely to manual control.
- **🛡️ Enterprise Safety Guardrails**:
  - Out-of-the-box protection against confidential data leaks, phishing, prompt injection, and unauthorized financial/legal commitments.
  - Strict daily reply volume caps and recipient rate limits to prevent email looping.
- **⚙️ Custom Rules Builder**: Configure conditional triggers (sender domains, keywords, urgency levels, sentiment) to route leads, bypass automation, or switch response tones dynamically.
- **🎭 Personalized AI Voice**: Customize your greeting style, sign-off signature, working hours, and tone (friendly, concise, executive, diplomatic, or technical) with few-shot example emails.
- **🔄 24/7 Background Daemon**: Production-ready background polling worker with ready-to-run configurations for PM2, Docker, systemd, and serverless cron jobs.
- **👥 Multi-Account Switcher**: Seamlessly connect, switch, and monitor multiple Google accounts.

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js** (v18.x or v20.x+)
- **npm** or **bun**
- A **Gemini API Key** from [Google AI Studio](https://aistudio.google.com/)
- A **Google Cloud Project** with Gmail API enabled and OAuth 2.0 Web Client Credentials configured.

### 2. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/your-username/mailpilot-ai.git
cd mailpilot-ai
npm install
```

### 3. Environment Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Configure your environment variables:

```ini
# Google Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here

# Dev Server Port
PORT=3000

# Client-Side Google OAuth Configuration (Google Identity Services)
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

### 4. Running the Application

Start the full-stack server (Express backend + Vite client):

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## 🛠️ Architecture

```
├── server.ts               # Express backend orchestrating Gemini AI triage, Gmail sync, and daemon
├── server/
│   ├── db.ts               # Persistent state store for emails, rules, logs, and user preferences
│   ├── daemon.ts           # 24/7 autonomous background worker & polling engine
│   ├── gemini.ts           # Gemini 2.5 Flash analysis & response generation prompts
│   └── types.ts            # Core TypeScript models and interfaces
├── src/                    # Frontend React SPA (Tailwind CSS, Lucide icons)
│   ├── components/         # Dashboard, Inbox, Review Queue, Rules, Safety, Personality, & Hosting views
│   ├── services/           # Gmail API, Client OAuth, Toast engine, and backend fetch helpers
│   └── App.tsx             # Main application layout and navigation
└── public/                 # Static branding assets and icons
```

---

## 📦 Deployment Options

MailPilot includes built-in configurations in the **Hosting Daemon** tab:

### Running with PM2
```bash
npm run build
pm2 start dist/server.js --name "mailpilot-ai"
pm2 startup
pm2 save
```

### Running with Docker
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

---

## 🔒 Security & Privacy

- **Client-Side Authorization**: OAuth tokens are obtained client-side and authenticated over Bearer headers.
- **Zero Third-Party Training**: Your private email content is strictly processed within your isolated session and never shared.
- **One-Click Data Purge**: Wipe all cached messages, logs, and rules instantly under **Safety & Privacy**.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
