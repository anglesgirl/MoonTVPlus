import { listPan115ShareVideos } from './pan115.client';
import { getEffectiveNetDiskConfig, netdiskOwnerKey } from './effective-config';
import {
  createPan115NetdiskSession,
  getPan115NetdiskSession,
  parsePan115NetdiskId,
  refreshPan115NetdiskSession,
} from './pan115-session-cache';

export async function resolvePan115Session(id: string, username?: string) {
  const netdiskConfig = await getEffectiveNetDiskConfig(username);
  const pan115Config = netdiskConfig?.Pan115;
  if (!pan115Config?.Enabled || !pan115Config.Cookie) {
    throw new Error('115网盘未配置或未启用');
  }

  const ownerKey = netdiskOwnerKey('Pan115', pan115Config);

  let session = refreshPan115NetdiskSession(id, ownerKey) || getPan115NetdiskSession(id, ownerKey);
  if (!session) {
    const payload = parsePan115NetdiskId(id);
    const result = await listPan115ShareVideos(payload.shareUrl, payload.passcode || '');
    session = createPan115NetdiskSession(
      {
        title: result.title,
        shareUrl: payload.shareUrl,
        passcode: payload.passcode,
        files: result.files,
      },
      ownerKey
    );
  }

  if (!session) {
    throw new Error('115网盘播放信息恢复失败');
  }

  return { session, cookie: pan115Config.Cookie, ownerKey };
}
