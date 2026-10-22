import { getEffectiveNetDiskConfig, netdiskOwnerKey } from './effective-config';
import { listTianyiShareVideos } from './tianyi.client';
import {
  createTianyiNetdiskSession,
  getTianyiNetdiskSession,
  parseTianyiNetdiskId,
  refreshTianyiNetdiskSession,
} from './tianyi-session-cache';

export async function resolveTianyiSession(id: string, username?: string) {
  const netdiskConfig = await getEffectiveNetDiskConfig(username);
  const tianyiConfig = netdiskConfig?.Tianyi;
  if (!tianyiConfig?.Enabled || !tianyiConfig.Account || !tianyiConfig.Password) {
    throw new Error('天翼云盘未配置或未启用');
  }

  const ownerKey = netdiskOwnerKey('Tianyi', tianyiConfig);

  let session = refreshTianyiNetdiskSession(id, ownerKey) || getTianyiNetdiskSession(id, ownerKey);
  if (!session) {
    const payload = parseTianyiNetdiskId(id);
    const result = await listTianyiShareVideos(
      payload.shareUrl,
      tianyiConfig.Account,
      tianyiConfig.Password,
      payload.passcode || ''
    );
    session = createTianyiNetdiskSession(
      {
        title: result.title,
        shareUrl: payload.shareUrl,
        passcode: payload.passcode,
        shareId: result.shareId,
        shareMode: result.shareMode,
        isFolder: result.isFolder,
        accessCode: result.accessCode,
        files: result.files,
      },
      ownerKey
    );
  }

  if (!session) {
    throw new Error('天翼云盘播放信息恢复失败');
  }

  return {
    session,
    account: tianyiConfig.Account,
    password: tianyiConfig.Password,
    ownerKey,
  };
}
