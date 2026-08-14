import fs from 'fs';
import path from 'path';
import os from 'os';
import { NetworkMode } from '../config/chains.js';

export interface HistoryEntry {
  id: string;
  type: 'send' | 'token_send' | 'swap' | 'simulate' | 'safe_proposal' | 'faucet';
  chain: string;
  networkMode: NetworkMode;
  txHash?: string;
  fromAddress?: string;
  toAddress?: string;
  amount?: string;
  symbol?: string;
  status: 'submitted' | 'confirmed' | 'simulated' | 'failed' | 'queued';
  agentMemo?: string;
  explorerUrl?: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

const HISTORY_FILE = path.join(os.homedir(), '.mcw', 'history.json');

export class HistoryManager {
  static loadHistory(): HistoryEntry[] {
    try {
      if (fs.existsSync(HISTORY_FILE)) {
        return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
      }
    } catch {}
    return [];
  }

  static saveHistory(entries: HistoryEntry[]): void {
    const dir = path.dirname(HISTORY_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(entries, null, 2), { mode: 0o600 });
  }

  static logTransaction(entry: Omit<HistoryEntry, 'id' | 'timestamp'>): HistoryEntry {
    const history = this.loadHistory();
    const newEntry: HistoryEntry = {
      ...entry,
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
    };

    history.unshift(newEntry);
    // Keep last 1000 entries
    if (history.length > 1000) {
      history.length = 1000;
    }

    this.saveHistory(history);
    return newEntry;
  }

  static getHistory(options?: {
    chain?: string;
    networkMode?: NetworkMode;
    limit?: number;
    type?: string;
  }): HistoryEntry[] {
    let history = this.loadHistory();

    if (options?.chain) {
      history = history.filter((h) => h.chain.toLowerCase() === options.chain!.toLowerCase());
    }
    if (options?.networkMode) {
      history = history.filter((h) => h.networkMode === options.networkMode);
    }
    if (options?.type) {
      history = history.filter((h) => h.type === options.type);
    }
    if (options?.limit) {
      history = history.slice(0, options.limit);
    }

    return history;
  }
}
