#!/usr/bin/env node
/**
 * Vigia da verificação da empresa na Meta (business 241132993237012).
 * Roda 4x/dia via launchd; quando o status sair de "pending", notifica no macOS.
 * Auto-remove o launchd quando aprovado (não fica rodando para sempre).
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const env = {};
for (const line of readFileSync(join(__dir, '.env'), 'utf8').split('\n')) {
  if (line.startsWith('#') || !line.includes('=')) continue;
  const [k, ...v] = line.split('=');
  env[k.trim()] = v.join('=').trim();
}

const BIZ = '241132993237012';
const resp = await fetch(`https://graph.facebook.com/v25.0/${BIZ}?fields=verification_status&access_token=${env.LONG_LIVED_USER_TOKEN}`);
const d = await resp.json();
const status = d.verification_status || ('erro: ' + JSON.stringify(d.error || d));
const agora = new Date().toLocaleString('pt-BR');
console.log(`[${agora}] verification_status = ${status}`);

const statusPath = join(__dir, 'verificacao_status.txt');
const anterior = existsSync(statusPath) ? readFileSync(statusPath, 'utf8').trim() : '';
writeFileSync(statusPath, status);

if (status !== 'pending' && status !== anterior) {
  const msg = status === 'verified'
    ? 'Empresa VERIFICADA na Meta! Diga ao Claude: empresa verificada'
    : `Verificação mudou para: ${status}`;
  try {
    execSync(`osascript -e 'display notification "${msg}" with title "🏢 Meta Business" sound name "Glass"'`);
  } catch {}
  if (status === 'verified' || status === 'rejected' || status === 'failed') {
    try { execSync('launchctl unload ~/Library/LaunchAgents/com.amgomes.meta.verificacao.plist'); } catch {}
    console.log('launchd do vigia descarregado (status final atingido)');
  }
}
