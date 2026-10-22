import { base58Decode, base58Encode } from '@/lib/utils';

export interface UCNetdiskSessionFile {
  fid: string;
  name: string;
  size?: number;
  shareFidToken?: string;
  pdirFid?: string;
}

export interface UCNetdiskSession {
  id: string;
  provider: 'uc';
  title: string;
  shareUrl: string;
  passcode?: string;
  shareId: string;
  shareToken: string;
  files: UCNetdiskSessionFile[];
  savedFileIds: Record<string, string>;
  playFolderFid?: string;
  playFolderPath?: string;
  createdAt: number;
  expiresAt: number;
}

const TTL_MS = 30 * 60 * 1000;
const sessionStore = new Map<string, UCNetdiskSession>();

/** scope = 凭证 ownerKey；不同网盘账号的 session 严格隔离，防串号 */
function storeKey(id: string, scope?: string): string {
  return scope ? `${scope}:${id}` : id;
}

export function buildUCNetdiskId(input: { shareUrl: string; passcode?: string }) {
  return base58Encode(JSON.stringify({ shareUrl: input.shareUrl, passcode: input.passcode || '' }));
}

export function parseUCNetdiskId(id: string): { shareUrl: string; passcode?: string } {
  try {
    const decoded = base58Decode(id);
    const parsed = JSON.parse(decoded);
    if (!parsed?.shareUrl || typeof parsed.shareUrl !== 'string') {
      throw new Error('invalid uc netdisk id');
    }
    return {
      shareUrl: parsed.shareUrl,
      passcode: typeof parsed.passcode === 'string' ? parsed.passcode : '',
    };
  } catch {
    throw new Error('无效的UC网盘播放 ID');
  }
}

function pruneExpiredSessions() {
  const now = Date.now();
  for (const [key, value] of Array.from(sessionStore.entries())) {
    if (value.expiresAt <= now) sessionStore.delete(key);
  }
}

export function createUCNetdiskSession(
  input: {
    title: string;
    shareUrl: string;
    passcode?: string;
    shareId: string;
    shareToken: string;
    files: UCNetdiskSessionFile[];
  },
  scope?: string
): UCNetdiskSession {
  pruneExpiredSessions();
  const now = Date.now();
  const id = buildUCNetdiskId({ shareUrl: input.shareUrl, passcode: input.passcode });
  const session: UCNetdiskSession = {
    id,
    provider: 'uc',
    title: input.title,
    shareUrl: input.shareUrl,
    passcode: input.passcode,
    shareId: input.shareId,
    shareToken: input.shareToken,
    files: input.files,
    savedFileIds: {},
    createdAt: now,
    expiresAt: now + TTL_MS,
  };
  sessionStore.set(storeKey(id, scope), session);
  return session;
}

export function getUCNetdiskSession(id: string, scope?: string): UCNetdiskSession | null {
  pruneExpiredSessions();
  const key = storeKey(id, scope);
  const session = sessionStore.get(key);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessionStore.delete(key);
    return null;
  }
  return session;
}

export function refreshUCNetdiskSession(id: string, scope?: string): UCNetdiskSession | null {
  const session = getUCNetdiskSession(id, scope);
  if (!session) return null;
  session.expiresAt = Date.now() + TTL_MS;
  sessionStore.set(storeKey(id, scope), session);
  return session;
}
