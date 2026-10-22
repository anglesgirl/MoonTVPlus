import { listPan123ShareVideos } from './pan123.client';
import { getEffectiveNetDiskConfig, netdiskOwnerKey } from './effective-config';
import {
  createPan123NetdiskSession,
  getPan123NetdiskSession,
  parsePan123NetdiskId,
  refreshPan123NetdiskSession,
} from './pan123-session-cache';

export async function resolvePan123Session(id: string, username?: string) {
  const netdiskConfig = await getEffectiveNetDiskConfig(username);
  const pan123Config = netdiskConfig?.Pan123;
  if (!pan123Config?.Enabled || !pan123Config.Account || !pan123Config.Password) {
    throw new Error('123网盘未配置或未启用');
  }

  const ownerKey = netdiskOwnerKey('Pan123', pan123Config);

  let session = refreshPan123NetdiskSession(id, ownerKey) || getPan123NetdiskSession(id, ownerKey);
  if (!session) {
    const payload = parsePan123NetdiskId(id);
    const result = await listPan123ShareVideos(payload.shareUrl, payload.passcode || '');
    session = createPan123NetdiskSession(
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
    throw new Error('123网盘播放信息恢复失败');
  }

  return {
    session,
    account: pan123Config.Account,
    password: pan123Config.Password,
    ownerKey,
  };
}
