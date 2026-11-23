import { realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Pi's normalizePath and resolvePath, with the options used by resolveToCwd.
const unicodeSpaces = /[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g;
function normalizePath(input, options = {}) {
  let normalized = options.trim ? input.trim() : input;
  if (options.normalizeUnicodeSpaces) normalized = normalized.replace(unicodeSpaces, ' ');
  if (options.stripAtPrefix && normalized.startsWith('@')) normalized = normalized.slice(1);
  if (process.platform === 'win32' && normalized.startsWith('/') && !normalized.startsWith('//') && !normalized.includes('\\')) {
    const match = normalized.match(/^\/(?:mnt\/|cygdrive\/)?([a-z])(?:\/(.*))?$/i);
    if (match) normalized = `${match[1].toUpperCase()}:\\${match[2]?.replaceAll('/', '\\') ?? ''}`;
  }
  if (options.expandTilde ?? true) {
    const home = options.homeDir ?? homedir();
    if (normalized === '~') return home;
    if (normalized.startsWith('~/') || (process.platform === 'win32' && normalized.startsWith('~\\'))) return join(home, normalized.slice(2));
  }
  if (/^file:\/\//.test(normalized)) return fileURLToPath(normalized);
  return normalized;
}
function resolveToCwd(input, cwd) {
  const normalized = normalizePath(input, { normalizeUnicodeSpaces: true, stripAtPrefix: true });
  const base = normalizePath(cwd);
  return isAbsolute(normalized) ? resolve(normalized) : resolve(base, normalized);
}
function inside(target, root) {
  const rel = relative(root, target);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}
export function guardToolCall(event, ctx, protocolDir) {
  if (!['read', 'grep', 'find', 'ls'].includes(event.toolName)) return;
  try {
    const target = realpathSync(resolveToCwd(event.input.path ?? ctx.cwd, ctx.cwd));
    const cwd = realpathSync(ctx.cwd);
    const protocol = realpathSync(protocolDir);
    if ((!inside(target, cwd) && !inside(target, protocol)) ||
        normalizePath(target, { normalizeUnicodeSpaces: true, stripAtPrefix: true }) !== target) {
      return { block: true, reason: 'Read-only aside cannot access this path.' };
    }
    event.input.path = target;
  } catch {
    return { block: true, reason: 'Read-only aside cannot resolve this path.' };
  }
}
export default function (pi) {
  const protocolDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../protocol');
  pi.on('tool_call', (event, ctx) => guardToolCall(event, ctx, protocolDir));
}
