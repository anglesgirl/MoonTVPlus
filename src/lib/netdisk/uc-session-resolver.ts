import { getEffectiveNetDiskConfig, netdiskOwnerKey } from './effective-config';
import { listUCShareVideos } from './uc.client';
import {
  createUCNetdiskSession,
  getUCNetdiskSession,
  parseUCNetdiskId,
  refreshUCNetdiskSession,
} from './uc-session-cache';

export async function resolveUCSession(id: string, username?: string) {
  const netdiskConfig = await getEffectiveNetDiskConfig(username);
  const ucConfig = netdiskConfig?.UC;
  if (!ucConfig?.Enabled || !ucConfig.Cookie) {
    throw new Error('UC网盘未配置或未启用');
  }

  const ownerKey = netdiskOwnerKey('UC', ucConfig);

  let session = refreshUCNetdiskSession(id, ownerKey) || getUCNetdiskSession(id, ownerKey);
  if (!session) {
    const payload = parseUCNetdiskId(id);
    const result = await listUCShareVideos(payload.shareUrl, ucConfig.Cookie, payload.passcode || '');
    session = createUCNetdiskSession(
      {
        title: result.title,
        shareUrl: payload.shareUrl,
        passcode: payload.passcode,
        shareId: result.shareId,
        shareToken: result.shareToken,
        files: result.files,
      },
      ownerKey
    );
  }

  if (!session) {
    throw new Error('UC网盘播放信息恢复失败');
  }

  return {
    session,
    cookie: ucConfig.Cookie,
    token: ucConfig.Token || '',
    savePath: ucConfig.SavePath || '/',
    ownerKey,
  };
}
