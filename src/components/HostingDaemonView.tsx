import React, { useState, useEffect } from 'react';
import {
  Server,
  Terminal,
  Cpu,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Zap,
  Globe,
  ShieldCheck,
  Clock,
  Play,
  Pause,
  Power,
  Activity,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { api } from '../services/api.js';

interface HostingDaemonViewProps {
  user?: any;
  token?: string | null;
  onRefreshAll?: () => void;
}

export const HostingDaemonView: React.FC<HostingDaemonViewProps> = ({
  user,
  token,
  onRefreshAll,
}) => {
  const [daemonStatus, setDaemonStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [togglingWorker, setTogglingWorker] = useState(false);
  const [triggerFeedback, setTriggerFeedback] = useState<string | null>(null);
  const [activeDeployTab, setActiveDeployTab] = useState<'pm2' | 'docker' | 'systemd' | 'cloud'>('pm2');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const data = await api.getWorkerStatus();
      setDaemonStatus(data);
    } catch (err) {
      console.warn('Failed to fetch daemon status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleToggleWorker = async () => {
    if (togglingWorker) return;
    setTogglingWorker(true);
    const isCurrentlyRunning = Boolean(daemonStatus?.running);
    try {
      if (isCurrentlyRunning) {
        const res = await api.stopWorker();
        setDaemonStatus(res.status);
        setTriggerFeedback('24/7 background worker paused.');
      } else {
        const res = await api.startWorker();
        setDaemonStatus(res.status);
        setTriggerFeedback('24/7 background worker active and polling.');
      }
      setTimeout(() => setTriggerFeedback(null), 4000);
    } catch (err: any) {
      setTriggerFeedback(`Worker toggle error: ${err.message}`);
    } finally {
      setTogglingWorker(false);
    }
  };

  const handleTriggerPoll = async () => {
    setTriggering(true);
    setTriggerFeedback(null);
    try {
      const res = await api.triggerWorkerPoll();
      setDaemonStatus(res.status);
      setTriggerFeedback(
        `Success! Daemon polled Gmail: ${res.processedCount} messages checked, ${res.repliesDispatched} auto-replies dispatched.`
      );
      if (onRefreshAll) onRefreshAll();
    } catch (err: any) {
      setTriggerFeedback(`Manual trigger error: ${err.message}`);
    } finally {
      setTriggering(false);
    }
  };

  const formatUptime = (seconds?: number) => {
    if (!seconds && seconds !== 0) return 'Just started';
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  const pm2Script = `# 1. Clone repository from GitHub
git clone <YOUR_GITHUB_REPO_URL> mailpilot
cd mailpilot

# 2. Install dependencies & compile frontend build
npm install
npm run build

# 3. Install PM2 process manager globally
npm install -g pm2

# 4. Start MailPilot with auto-restart daemon
pm2 start npm --name "mailpilot" -- run start

# 5. Enable PM2 to boot automatically on server restart
pm2 startup
pm2 save

# 6. Check daemon status & live logs anytime
pm2 status
pm2 logs mailpilot`;

  const dockerfileSnippet = `# Dockerfile for 24/7 Always-On MailPilot
FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start"]`;

  const dockerComposeSnippet = `# docker-compose.yml
version: '3.8'
services:
  mailpilot:
    build: .
    restart: always
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - NODE_ENV=production
      - GEMINI_API_KEY=\${GEMINI_API_KEY}
    volumes:
      - ./data:/app/data`;

  const systemdSnippet = `[Unit]
Description=MailPilot AI 24/7 Background Daemon
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/mailpilot
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target`;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <Server className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              24/7 Background Daemon & Deployment Guide
            </h1>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
            MailPilot runs a persistent server daemon in Node.js that checks your Gmail inbox every 45 seconds,
            analyzes inbound emails with Gemini, and dispatches thread-aware replies autonomously—even when your browser is closed.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-750 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh State</span>
          </button>

          <button
            onClick={handleToggleWorker}
            disabled={togglingWorker}
            className={`px-3.5 py-2 rounded-xl font-bold text-xs shadow-xs flex items-center gap-1.5 transition-all duration-300 cursor-pointer active:scale-95 disabled:opacity-50 ${
              daemonStatus?.running
                ? 'border border-amber-300 dark:border-amber-700/80 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50'
                : 'border border-emerald-300 dark:border-emerald-700/80 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
            }`}
          >
            {togglingWorker ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : daemonStatus?.running ? (
              <Pause className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>{daemonStatus?.running ? 'Pause Worker' : 'Resume Worker'}</span>
          </button>

          <button
            onClick={handleTriggerPoll}
            disabled={triggering}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            {triggering ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span>{triggering ? 'Polling Gmail...' : 'Run Daemon Poll Now'}</span>
          </button>
        </div>
      </div>

      {triggerFeedback && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{triggerFeedback}</span>
        </div>
      )}

      {daemonStatus?.lastError && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Daemon Warning:</strong> {daemonStatus.lastError}
            </span>
          </div>
          <span className="text-[11px] text-amber-700 dark:text-amber-300 shrink-0 font-medium">
            Click "Connect Gmail" in the top bar to refresh credentials.
          </span>
        </div>
      )}

      {/* Live Daemon Status Dashboard Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Daemon State with Micro-Animation Toggle */}
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 shadow-xs transition-all hover:border-slate-300 dark:hover:border-slate-600">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-2">
            <span>Daemon State</span>
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                  daemonStatus?.running
                    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)] animate-daemon-pulse'
                    : 'bg-slate-400 opacity-60'
                }`}
              />
              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                {daemonStatus?.running ? 'Online' : 'Paused'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between mt-1">
            <div className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="transition-all duration-300">
                {daemonStatus?.running ? 'Active & Polling' : 'Worker Paused'}
              </span>
            </div>

            {/* Micro-Animated Toggle Pill Button */}
            <button
              onClick={handleToggleWorker}
              disabled={togglingWorker}
              title={daemonStatus?.running ? 'Click to Pause 24/7 Worker' : 'Click to Activate 24/7 Worker'}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:opacity-50 ${
                daemonStatus?.running ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-600'
              }`}
            >
              <span className="sr-only">Toggle 24/7 Daemon</span>
              <span
                className={`pointer-events-none flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-md transform transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                  daemonStatus?.running ? 'translate-x-5 text-emerald-600' : 'translate-x-0 text-slate-400'
                }`}
              >
                {togglingWorker ? (
                  <RefreshCw className="w-3 h-3 animate-spin text-slate-500" />
                ) : daemonStatus?.running ? (
                  <Power className="w-3 h-3 text-emerald-600" />
                ) : (
                  <Pause className="w-3 h-3 text-slate-400" />
                )}
              </span>
            </button>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 flex items-center justify-between">
            <span>Interval: Every <span className="font-mono tabular-nums">{daemonStatus?.pollIntervalSeconds || 45}s</span></span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              {daemonStatus?.running ? 'Autonomous' : 'Standby'}
            </span>
          </p>
        </div>

        {/* Server Process Uptime */}
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-2">
            <span>Server Uptime</span>
            <Clock className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white font-mono tabular-nums">
            {formatUptime(daemonStatus?.uptimeSeconds)}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Completed <span className="font-mono tabular-nums">{daemonStatus?.totalCycles || 0}</span> polling cycles
          </p>
        </div>

        {/* Autonomous Dispatches */}
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-2">
            <span>Auto-Dispatched</span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
            {daemonStatus?.totalRepliesDispatched || 0}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Replies sent without manual approval
          </p>
        </div>

        {/* Token Source & Persistence */}
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-2">
            <span>Persistence & Auth</span>
            <ShieldCheck className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            {daemonStatus?.hasToken ? (
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>Token Synchronized</span>
              </span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                <span>Sign In Required</span>
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Saved in local database storage
          </p>
        </div>
      </div>

      {/* Persistence Architecture Explanation */}
      <div className="bg-gradient-to-br from-indigo-50/80 via-white to-slate-50 dark:from-slate-800/80 dark:via-slate-850 dark:to-slate-900 border border-indigo-100 dark:border-slate-700 rounded-2xl p-6 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-2">
          <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span>How Refresh & 24/7 Continuous Execution Works</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 text-xs">
          <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
            <div className="font-semibold text-slate-900 dark:text-white mb-1 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[10px] font-bold">1</span>
              <span>Local Token Persistence</span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              When you log in, your Gmail credentials and authorization session are automatically preserved in browser storage and synchronized with the backend database. Refreshing the browser tab will never reset your session.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
            <div className="font-semibold text-slate-900 dark:text-white mb-1 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] font-bold">2</span>
              <span>Node.js Server Daemon</span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              Instead of relying on the browser to poll, a native background daemon runs inside Node.js every 45s. It inspects unread messages, triggers Gemini AI analysis, and sends replies directly via the Gmail API.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
            <div className="font-semibold text-slate-900 dark:text-white mb-1 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400 flex items-center justify-center text-[10px] font-bold">3</span>
              <span>Zero-Tab Autonomous Operation</span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              You can safely close all browser windows or turn off your workstation. Once deployed on a VPS or cloud service, the server continues answering emails around the clock without interruption.
            </p>
          </div>
        </div>
      </div>

      {/* GitHub 24/7 Deployment Instructions */}
      <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Deploy from GitHub to Run 24/7 Always</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Choose your target environment to keep MailPilot active 24/7 without manual restarts.
            </p>
          </div>

          {/* Deploy Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-750 p-1 rounded-xl">
            <button
              onClick={() => setActiveDeployTab('pm2')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeDeployTab === 'pm2'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              PM2 (VPS / Droplet)
            </button>
            <button
              onClick={() => setActiveDeployTab('docker')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeDeployTab === 'docker'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Docker
            </button>
            <button
              onClick={() => setActiveDeployTab('cloud')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeDeployTab === 'cloud'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Cloud (Render / Railway)
            </button>
            <button
              onClick={() => setActiveDeployTab('systemd')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeDeployTab === 'systemd'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Systemd Service
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeDeployTab === 'pm2' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Run continuously on any Linux server (DigitalOcean, AWS EC2, Hetzner, GCP):
              </span>
              <button
                onClick={() => handleCopy('pm2', pm2Script)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 transition cursor-pointer"
              >
                {copiedKey === 'pm2' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'pm2' ? 'Copied' : 'Copy Commands'}</span>
              </button>
            </div>
            <pre className="p-4 rounded-xl bg-slate-900 text-emerald-400 font-mono text-xs overflow-x-auto border border-slate-800 leading-relaxed">
              {pm2Script}
            </pre>
          </div>
        )}

        {activeDeployTab === 'docker' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Containerized deployment using Docker & Docker Compose:
              </span>
              <button
                onClick={() => handleCopy('docker', `${dockerfileSnippet}\n\n${dockerComposeSnippet}`)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 transition cursor-pointer"
              >
                {copiedKey === 'docker' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'docker' ? 'Copied' : 'Copy Docker Config'}</span>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Dockerfile</p>
                <pre className="p-3.5 rounded-xl bg-slate-900 text-cyan-300 font-mono text-xs overflow-x-auto border border-slate-800">
                  {dockerfileSnippet}
                </pre>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">docker-compose.yml</p>
                <pre className="p-3.5 rounded-xl bg-slate-900 text-amber-300 font-mono text-xs overflow-x-auto border border-slate-800">
                  {dockerComposeSnippet}
                </pre>
              </div>
            </div>
          </div>
        )}

        {activeDeployTab === 'cloud' && (
          <div className="space-y-4 text-xs">
            <p className="text-slate-600 dark:text-slate-300">
              When deploying to PaaS platforms like <strong>Render</strong>, <strong>Railway</strong>, or <strong>Fly.io</strong>:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 space-y-2">
                <span className="font-bold text-slate-900 dark:text-white">Build & Start Settings</span>
                <div className="space-y-1 text-slate-700 dark:text-slate-300">
                  <p><strong>Build Command:</strong> <code className="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded font-mono">npm install && npm run build</code></p>
                  <p><strong>Start Command:</strong> <code className="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded font-mono">npm run start</code></p>
                  <p><strong>Port:</strong> <code className="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded font-mono">3000</code> (or read from <code className="font-mono">process.env.PORT</code>)</p>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 space-y-2">
                <span className="font-bold text-slate-900 dark:text-white">Required Environment Variables</span>
                <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-1">
                  <li><code className="font-mono">GEMINI_API_KEY</code> — Your Google Gemini API key.</li>
                  <li><code className="font-mono">NODE_ENV</code> — Set to <code className="font-mono">production</code>.</li>
                  <li><code className="font-mono">PORT</code> — Port 3000.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeDeployTab === 'systemd' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Native systemd service configuration (<code className="font-mono">/etc/systemd/system/mailpilot.service</code>):
              </span>
              <button
                onClick={() => handleCopy('systemd', systemdSnippet)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 transition cursor-pointer"
              >
                {copiedKey === 'systemd' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'systemd' ? 'Copied' : 'Copy Service Config'}</span>
              </button>
            </div>
            <pre className="p-4 rounded-xl bg-slate-900 text-indigo-300 font-mono text-xs overflow-x-auto border border-slate-800 leading-relaxed">
              {systemdSnippet}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
