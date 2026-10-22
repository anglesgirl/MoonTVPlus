import { listBaiduShareVideos } from './baidu.client';
import {
  createBaiduNetdiskSession,
  getBaiduNetdiskSession,
  parseBaiduNetdiskId,
  refreshBaiduNetdiskSession,
} from './baidu-session-cache';
import { getEffectiveNetDiskConfig, netdiskOwnerKey } from './effective-config';

export async function resolveBaiduSession(id: string, username?: string) {
  const netdiskConfig = await getEffectiveNetDiskConfig(username);
  const baiduConfig = netdiskConfig?.Baidu;
  if (!baiduConfig?.Enabled || !baiduConfig.Cookie) {
    throw new Error('百度网盘未配置或未启用');
  }

  const ownerKey = netdiskOwnerKey('Baidu', baiduConfig);

  let session = refreshBaiduNetdiskSession(id, ownerKey) || getBaiduNetdiskSession(id, ownerKey);
  if (!session) {
    const payload = parseBaiduNetdiskId(id);
    const result = await listBaiduShareVideos(payload.shareUrl, baiduConfig.Cookie, payload.passcode || '');
    session = createBaiduNetdiskSession(
      {
        title: result.title,
        shareUrl: payload.shareUrl,
        passcode: payload.passcode,
        files: result.files,
        meta: result.meta,
        cookie: result.cookie,
      },
      ownerKey
    );
  }

  if (!session) {
    throw new Error('百度网盘播放信息恢复失败');
  }

  return { session, cookie: session.cookie || baiduConfig.Cookie, ownerKey };
}
