import { base58Decode, base58Encode } from '@/lib/utils';

export interface QuarkNetdiskSessionFile {
  fid: string;
  name: string;
  size?: number;
  shareFidToken?: string;
  pdirFid?: string;
}

export interface QuarkPlayUrlCacheItem {
  name: string;
  url: string;
  priority: number;
}

export interface QuarkNetdiskSession {
  id: string;
  provider: 'quark';
  title: string;
  shareUrl: string;
  passcode?: string;
  shareId: string;
  shareToken: string;
  files: QuarkNetdiskSessionFile[];
  savedFileIds: Record<string, string>;
  playUrlCaches: Record<string, { urls: QuarkPlayUrlCacheItem[]; expiresAt: number }>;
  playFolderFid?: string;
  playFolderPath?: string;
  createdAt: number;
  expiresAt: number;
}

const TTL_MS = 30 * 60 * 1000;
const sessionStore = new Map<string, QuarkNetdiskSession>();

/** scope = 凭证 ownerKey；不同网盘账号的 session 严格隔离，防串号 */
function storeKey(id: string, scope?: string): string {
  return scope ? `${scope}:${id}` : id;
}

export function buildQuarkNetdiskId(input: { shareUrl: string; passcode?: string }): string {
  return base58Encode(
    JSON.stringify({
      shareUrl: input.shareUrl,
      passcode: input.passcode || '',
    })
  );
}

export function parseQuarkNetdiskId(id: string): { shareUrl: string; passcode?: string } {
  try {
    const decoded = base58Decode(id);
    const parsed = JSON.parse(decoded);
    if (!parsed?.shareUrl || typeof parsed.shareUrl !== 'string') {
      throw new Error('invalid quark netdisk id');
    }
    return {
      shareUrl: parsed.shareUrl,
      passcode: typeof parsed.passcode === 'string' ? parsed.passcode : '',
    };
  } catch {
    throw new Error('无效的夸克网盘播放 ID');
  }
}

function pruneExpiredSessions() {
  const now = Date.now();
  for (const [key, value] of Array.from(sessionStore.entries())) {
    if (value.expiresAt <= now) {
      sessionStore.delete(key);
    }
  }
}

export function createQuarkNetdiskSession(
  input: {
    title: string;
    shareUrl: string;
    passcode?: string;
    shareId: string;
    shareToken: string;
    files: QuarkNetdiskSessionFile[];
  },
  scope?: string
): QuarkNetdiskSession {
  pruneExpiredSessions();
  const now = Date.now();
  const id = buildQuarkNetdiskId({ shareUrl: input.shareUrl, passcode: input.passcode });
  const session: QuarkNetdiskSession = {
    id,
    provider: 'quark',
    title: input.title,
    shareUrl: input.shareUrl,
    passcode: input.passcode,
    shareId: input.shareId,
    shareToken: input.shareToken,
    files: input.files,
    savedFileIds: {},
    playUrlCaches: {},
    createdAt: now,
    expiresAt: now + TTL_MS,
  };
  sessionStore.set(storeKey(id, scope), session);
  return session;
}

export function getQuarkNetdiskSession(id: string, scope?: string): QuarkNetdiskSession | null {
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

export function refreshQuarkNetdiskSession(id: string, scope?: string): QuarkNetdiskSession | null {
  const session = getQuarkNetdiskSession(id, scope);
  if (!session) return null;
  session.expiresAt = Date.now() + TTL_MS;
  sessionStore.set(storeKey(id, scope), session);
  return session;
}
