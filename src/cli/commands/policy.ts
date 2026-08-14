import inquirer from 'inquirer';
import chalk from 'chalk';
import Table from 'cli-table3';
import { loadPolicies, savePolicies, PolicyEngine } from '../../policy/policyEngine.js';

export async function policyCommand(
  action?: string,
  chainArg?: string,
  val1?: string,
  val2?: string
): Promise<void> {
  const policy = loadPolicies();

  if (action === 'list' || (!action && !chainArg)) {
    renderPolicyTable();
    return;
  }

  if (action === 'set-limit' && chainArg && val1) {
    const maxPerTx = parseFloat(val1);
    const daily = val2 ? parseFloat(val2) : undefined;
    PolicyEngine.setSpendLimits(chainArg, maxPerTx, daily);
    console.log(chalk.green(`\n✅ Spend limits updated for ${chainArg.toUpperCase()}: Max/Tx = ${maxPerTx}, Daily = ${daily ?? 'unchanged'}\n`));
    return;
  }

  if (action === 'whitelist' && chainArg && val1) {
    PolicyEngine.addWhitelist(chainArg, val1);
    console.log(chalk.green(`\n✅ Address ${val1} added to ${chainArg.toUpperCase()} WHITELIST.\n`));
    return;
  }

  if (action === 'blacklist' && chainArg && val1) {
    PolicyEngine.addBlacklist(chainArg, val1);
    console.log(chalk.green(`\n✅ Address ${val1} added to ${chainArg.toUpperCase()} BLACKLIST.\n`));
    return;
  }

  if (action === 'toggle') {
    policy.enabled = !policy.enabled;
    savePolicies(policy);
    console.log(chalk.green(`\n✅ Policy Guardrails are now ${policy.enabled ? chalk.bold.green('ENABLED') : chalk.bold.red('DISABLED')}.\n`));
    return;
  }

  // Interactive Menu
  const { choice } = await inquirer.prompt([
    {
      type: 'list',
      name: 'choice',
      message: '🛡️ Policy Guardrails & Spend Limits:',
      choices: [
        { name: '📋 View Active Policies & Spend Limits', value: 'list' },
        { name: '⚙️ Set Spend Limit (Max Spend Per Tx / Daily Cap)', value: 'limit' },
        { name: '🛡️ Add Address to Whitelist', value: 'whitelist' },
        { name: '🚫 Add Address to Blacklist', value: 'blacklist' },
        { name: `${policy.enabled ? '🔴 Disable' : '🟢 Enable'} Policy Guardrails`, value: 'toggle' },
      ],
    },
  ]);

  if (choice === 'list') {
    renderPolicyTable();
  } else if (choice === 'toggle') {
    policy.enabled = !policy.enabled;
    savePolicies(policy);
    console.log(chalk.green(`\n✅ Policy Guardrails are now ${policy.enabled ? chalk.bold.green('ENABLED') : chalk.bold.red('DISABLED')}.\n`));
  } else if (choice === 'limit') {
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'chain',
        message: 'Select Chain:',
        choices: ['eth', 'sol', 'btc', 'trx'],
      },
      {
        type: 'input',
        name: 'maxPerTx',
        message: 'Enter Max Spend Per Transaction:',
        validate: (v: string) => (!isNaN(parseFloat(v)) && parseFloat(v) > 0 ? true : 'Enter valid number.'),
      },
      {
        type: 'input',
        name: 'daily',
        message: 'Enter 24-Hour Rolling Spend Limit:',
        validate: (v: string) => (!isNaN(parseFloat(v)) && parseFloat(v) > 0 ? true : 'Enter valid number.'),
      },
    ]);
    PolicyEngine.setSpendLimits(answers.chain, parseFloat(answers.maxPerTx), parseFloat(answers.daily));
    console.log(chalk.green(`\n✅ Limits updated for ${answers.chain.toUpperCase()}!\n`));
  } else if (choice === 'whitelist') {
    const answers = await inquirer.prompt([
      { type: 'list', name: 'chain', message: 'Select Chain:', choices: ['eth', 'sol', 'btc', 'trx'] },
      { type: 'input', name: 'address', message: 'Enter approved recipient address to Whitelist:' },
    ]);
    PolicyEngine.addWhitelist(answers.chain, answers.address.trim());
    console.log(chalk.green(`\n✅ Address added to Whitelist!\n`));
  } else if (choice === 'blacklist') {
    const answers = await inquirer.prompt([
      { type: 'list', name: 'chain', message: 'Select Chain:', choices: ['eth', 'sol', 'btc', 'trx'] },
      { type: 'input', name: 'address', message: 'Enter malicious/blocked recipient address to Blacklist:' },
    ]);
    PolicyEngine.addBlacklist(answers.chain, answers.address.trim());
    console.log(chalk.green(`\n✅ Address added to Blacklist!\n`));
  }
}

function renderPolicyTable(): void {
  const policy = loadPolicies();

  console.log(
    chalk.bold.white(
      `\n🛡️ Policy Guardrails Status: ${policy.enabled ? chalk.green.bold('ACTIVE (PROTECTED)') : chalk.red.bold('DISABLED')}`
    )
  );
  console.log(chalk.gray(`Strict Mode: ${policy.strictMode ? 'Enabled' : 'Disabled'}\n`));

  const table = new Table({
    head: [
      chalk.cyan.bold('Chain'),
      chalk.cyan.bold('Max Spend / Tx'),
      chalk.cyan.bold('24h Daily Limit'),
      chalk.cyan.bold('Whitelisted Addrs'),
      chalk.cyan.bold('Blacklisted Addrs'),
    ],
    style: { head: [], border: ['gray'] },
  });

  for (const [chain, cPolicy] of Object.entries(policy.chains)) {
    table.push([
      chalk.bold.yellow(chain.toUpperCase()),
      chalk.white(cPolicy.maxSpendPerTx ? `${cPolicy.maxSpendPerTx} ${chain.toUpperCase()}` : 'Unlimited'),
      chalk.white(cPolicy.dailySpendLimit ? `${cPolicy.dailySpendLimit} ${chain.toUpperCase()}` : 'Unlimited'),
      chalk.green(cPolicy.whitelistAddresses?.length ? `${cPolicy.whitelistAddresses.length} address(es)` : 'None (Open)'),
      chalk.red(cPolicy.blacklistAddresses?.length ? `${cPolicy.blacklistAddresses.length} address(es)` : 'None'),
    ]);
  }

  console.log(table.toString());
  console.log('');
}
