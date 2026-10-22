import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getEffectiveNetDiskConfig, netdiskOwnerKey } from '@/lib/netdisk/effective-config';
import { getPan123PlayInfo, listPan123ShareVideos } from '@/lib/netdisk/pan123.client';
import {
  createPan123NetdiskSession,
  getPan123NetdiskSession,
  parsePan123NetdiskId,
  refreshPan123NetdiskSession,
} from '@/lib/netdisk/pan123-session-cache';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo?.username) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('id') || searchParams.get('session');
    const episodeIndexRaw = searchParams.get('episodeIndex');
    const format = searchParams.get('format');
    const quality = searchParams.get('quality') || '';
    if (!sessionId || episodeIndexRaw == null) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 });
    }

    const episodeIndex = Number.parseInt(episodeIndexRaw, 10);
    if (!Number.isInteger(episodeIndex) || episodeIndex < 0) {
      return NextResponse.json({ error: '无效的 episodeIndex' }, { status: 400 });
    }

    const netdiskConfig = await getEffectiveNetDiskConfig(authInfo.username);
    const pan123Config = netdiskConfig?.Pan123;
    if (!pan123Config?.Enabled || !pan123Config.Account || !pan123Config.Password) {
      return NextResponse.json({ error: '123网盘未配置或未启用' }, { status: 400 });
    }

    const ownerKey = netdiskOwnerKey('Pan123', pan123Config);

    let session = refreshPan123NetdiskSession(sessionId, ownerKey) || getPan123NetdiskSession(sessionId, ownerKey);
    if (!session) {
      const payload = parsePan123NetdiskId(sessionId);
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

    const file = session.files[episodeIndex];
    if (!file) {
      return NextResponse.json({ error: '播放文件不存在' }, { status: 404 });
    }

    const playInfo = await getPan123PlayInfo(file, pan123Config.Account, pan123Config.Password);
    refreshPan123NetdiskSession(sessionId, ownerKey);
    const selectedUrl = playInfo.qualities.find((item) => item.name === quality)?.url || playInfo.url;

    if (format === 'json') {
      return NextResponse.json({
        url: selectedUrl,
        headers: {},
        qualities: playInfo.qualities,
      });
    }

    return NextResponse.redirect(selectedUrl);
  } catch (error) {
    console.error('[netdisk-123][play] error', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取播放地址失败' },
      { status: 500 }
    );
  }
}
