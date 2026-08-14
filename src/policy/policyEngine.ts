import fs from 'fs';
import path from 'path';
import os from 'os';

export interface ChainPolicy {
  maxSpendPerTx?: number;      // Maximum spend allowed per transaction (in native token or USD)
  dailySpendLimit?: number;    // Maximum spend allowed within a 24-hour rolling window
  whitelistAddresses?: string[]; // Allowed recipient addresses (if set, non-whitelisted are blocked)
  blacklistAddresses?: string[]; // Blocked recipient addresses
  allowedTokens?: string[];    // Whitelisted token symbols/contracts
  autoApproveBelow?: number;   // Optional micro-transaction auto-approval threshold (e.g. 0.001)
}

export interface PolicyConfig {
  enabled: boolean;
  strictMode: boolean; // If true, only whitelisted addresses/actions are allowed
  chains: Record<string, ChainPolicy>;
  spentToday: Record<string, Array<{ amount: number; timestamp: number }>>;
}

const POLICY_FILE = path.join(os.homedir(), '.mcw', 'policies.json');

const DEFAULT_POLICY: PolicyConfig = {
  enabled: true,
  strictMode: false,
  chains: {
    btc: { maxSpendPerTx: 0.1, dailySpendLimit: 0.5 },
    eth: { maxSpendPerTx: 0.5, dailySpendLimit: 2.0 },
    sol: { maxSpendPerTx: 5.0, dailySpendLimit: 20.0 },
    trx: { maxSpendPerTx: 500, dailySpendLimit: 2000 },
  },
  spentToday: {},
};

export function loadPolicies(): PolicyConfig {
  try {
    if (fs.existsSync(POLICY_FILE)) {
      const data = JSON.parse(fs.readFileSync(POLICY_FILE, 'utf8'));
      return { ...DEFAULT_POLICY, ...data, chains: { ...DEFAULT_POLICY.chains, ...data.chains } };
    }
  } catch {}
  return DEFAULT_POLICY;
}

export function savePolicies(config: PolicyConfig): void {
  const dir = path.dirname(POLICY_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  fs.writeFileSync(POLICY_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export interface PolicyCheckResult {
  allowed: boolean;
  reason?: string;
  violations?: string[];
}

export class PolicyEngine {
  /**
   * Validate a proposed transaction against local policy guardrails
   */
  static validateTransaction(
    chain: string,
    recipient: string,
    amount: string | number,
    tokenSymbol?: string
  ): PolicyCheckResult {
    const policy = loadPolicies();
    if (!policy.enabled) {
      return { allowed: true };
    }

    const chainPolicy = policy.chains[chain.toLowerCase()] || {};
    const parsedAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    const violations: string[] = [];

    const isMatch = (addr1: string, addr2: string) =>
      chain.toLowerCase() === 'sol' ? addr1 === addr2 : addr1.toLowerCase() === addr2.toLowerCase();

    // 1. Blacklist check
    if (chainPolicy.blacklistAddresses && chainPolicy.blacklistAddresses.length > 0) {
      const isBlacklisted = chainPolicy.blacklistAddresses.some((b) => isMatch(b, recipient));
      if (isBlacklisted) {
        violations.push(`Recipient ${recipient} is on the security BLACKLIST.`);
      }
    }

    // 2. Whitelist check (Strict mode or whitelist set)
    if (chainPolicy.whitelistAddresses && chainPolicy.whitelistAddresses.length > 0) {
      const isWhitelisted = chainPolicy.whitelistAddresses.some((w) => isMatch(w, recipient));
      if (!isWhitelisted) {
        violations.push(`Recipient ${recipient} is not on the approved WHITELIST.`);
      }
    } else if (policy.strictMode) {
      violations.push(`Strict Mode active: No whitelist defined for chain ${chain.toUpperCase()}.`);
    }

    // 3. Max Spend Per Transaction
    if (chainPolicy.maxSpendPerTx !== undefined && parsedAmount > chainPolicy.maxSpendPerTx) {
      violations.push(
        `Amount ${parsedAmount} exceeds maximum allowed per transaction (${chainPolicy.maxSpendPerTx} ${tokenSymbol || chain.toUpperCase()}).`
      );
    }

    // 4. Daily Rolling Spend Limit
    if (chainPolicy.dailySpendLimit !== undefined) {
      const now = Date.now();
      const cutoff = now - 24 * 60 * 60 * 1000;
      const history = (policy.spentToday[chain.toLowerCase()] || []).filter((h) => h.timestamp > cutoff);
      const currentSpent = history.reduce((sum, h) => sum + h.amount, 0);

      if (currentSpent + parsedAmount > chainPolicy.dailySpendLimit) {
        violations.push(
          `Transaction would exceed 24-hour rolling limit (${chainPolicy.dailySpendLimit} ${tokenSymbol || chain.toUpperCase()}). Current 24h spend: ${currentSpent.toFixed(4)}.`
        );
      }
    }

    if (violations.length > 0) {
      return {
        allowed: false,
        reason: violations.join(' '),
        violations,
      };
    }

    return { allowed: true };
  }

  /**
   * Record a completed transaction to track rolling spend limits
   */
  static recordSpend(chain: string, amount: string | number): void {
    const policy = loadPolicies();
    const parsedAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    const now = Date.now();
    const cutoff = now - 24 * 60 * 60 * 1000;

    const list = (policy.spentToday[chain.toLowerCase()] || []).filter((h) => h.timestamp > cutoff);
    list.push({ amount: parsedAmount, timestamp: now });
    policy.spentToday[chain.toLowerCase()] = list;

    savePolicies(policy);
  }

  /**
   * Add address to whitelist
   */
  static addWhitelist(chain: string, address: string): void {
    const policy = loadPolicies();
    const c = chain.toLowerCase();
    policy.chains[c] = policy.chains[c] || {};
    policy.chains[c].whitelistAddresses = policy.chains[c].whitelistAddresses || [];
    if (!policy.chains[c].whitelistAddresses!.includes(address)) {
      policy.chains[c].whitelistAddresses!.push(address);
    }
    savePolicies(policy);
  }

  /**
   * Add address to blacklist
   */
  static addBlacklist(chain: string, address: string): void {
    const policy = loadPolicies();
    const c = chain.toLowerCase();
    policy.chains[c] = policy.chains[c] || {};
    policy.chains[c].blacklistAddresses = policy.chains[c].blacklistAddresses || [];
    if (!policy.chains[c].blacklistAddresses!.includes(address)) {
      policy.chains[c].blacklistAddresses!.push(address);
    }
    savePolicies(policy);
  }

  /**
   * Set spend limit
   */
  static setSpendLimits(chain: string, maxPerTx?: number, dailyLimit?: number): void {
    const policy = loadPolicies();
    const c = chain.toLowerCase();
    policy.chains[c] = policy.chains[c] || {};
    if (maxPerTx !== undefined) policy.chains[c].maxSpendPerTx = maxPerTx;
    if (dailyLimit !== undefined) policy.chains[c].dailySpendLimit = dailyLimit;
    savePolicies(policy);
  }
}
