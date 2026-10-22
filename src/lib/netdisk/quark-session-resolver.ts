import { listQuarkShareVideos } from './quark.client';
import type { QuarkPlayMode } from './quark.client';
import { getEffectiveNetDiskConfig, netdiskOwnerKey } from './effective-config';
import {
  createQuarkNetdiskSession,
  getQuarkNetdiskSession,
  parseQuarkNetdiskId,
  refreshQuarkNetdiskSession,
} from './quark-session-cache';

export async function resolveQuarkSession(id: string, username?: string) {
  const netdiskConfig = await getEffectiveNetDiskConfig(username);
  const quarkConfig = netdiskConfig?.Quark;
  if (!quarkConfig?.Enabled || !quarkConfig.Cookie) {
    throw new Error('夸克网盘未配置或未启用');
  }

  const ownerKey = netdiskOwnerKey('Quark', quarkConfig);

  let session = refreshQuarkNetdiskSession(id, ownerKey) || getQuarkNetdiskSession(id, ownerKey);
  if (!session) {
    const payload = parseQuarkNetdiskId(id);
    const result = await listQuarkShareVideos(payload.shareUrl, quarkConfig.Cookie, payload.passcode || '');
    session = createQuarkNetdiskSession(
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
    throw new Error('夸克网盘播放信息恢复失败');
  }

  const playMode: QuarkPlayMode = quarkConfig.PlayMode === 'direct_first' ? 'direct_first' : 'transcode_first';

  return {
    session,
    cookie: quarkConfig.Cookie,
    savePath: quarkConfig.SavePath || '/',
    playMode,
    multiThreadPlayback: Boolean(quarkConfig.MultiThreadPlayback),
    ownerKey,
  };
}
