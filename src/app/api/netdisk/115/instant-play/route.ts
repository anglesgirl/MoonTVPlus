import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getEffectiveNetDiskConfig, netdiskOwnerKey } from '@/lib/netdisk/effective-config';
import { listPan115ShareVideos } from '@/lib/netdisk/pan115.client';
import { createPan115NetdiskSession } from '@/lib/netdisk/pan115-session-cache';
import { NETDISK_115_SOURCE } from '@/lib/netdisk/source';
import { hasFeaturePermission } from '@/lib/permissions';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo?.username) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    if (!(await hasFeaturePermission(authInfo.username, 'netdisk_temp_play'))) {
      return NextResponse.json({ error: '无权限使用临时播放' }, { status: 403 });
    }

    const { shareUrl, passcode, title } = await request.json();
    if (!shareUrl) {
      return NextResponse.json({ error: '分享链接不能为空' }, { status: 400 });
    }

    const netdiskConfig = await getEffectiveNetDiskConfig(authInfo.username);
    const pan115Config = netdiskConfig?.Pan115;
    if (!pan115Config?.Enabled || !pan115Config.Cookie) {
      return NextResponse.json({ error: '115网盘未配置或未启用' }, { status: 400 });
    }

    const result = await listPan115ShareVideos(shareUrl, passcode || '');
    const session = createPan115NetdiskSession(
      {
        title: title || result.title,
        shareUrl,
        passcode,
        files: result.files,
      },
      netdiskOwnerKey('Pan115', pan115Config)
    );

    return NextResponse.json({
      success: true,
      source: NETDISK_115_SOURCE,
      id: session.id,
      title: title || result.title,
      fileCount: result.files.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '立即播放失败' },
      { status: 500 }
    );
  }
}
