import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getAvailableApiSites } from '@/lib/config';
import { resolveTVBoxBridgeSites } from '@/lib/tvbox-bridge.server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);
  // 游客模式：未登录也可访问，username 为 undefined 时按游客规则过滤资源站

  try {
    const specialOnly = request.nextUrl.searchParams.get('special') === '1';
    // TVBox 桥接是登录用户功能，游客不走此分支
    if (
      authInfo?.username &&
      request.nextUrl.searchParams.get('type') === 'tvbox'
    ) {
      const sites = await resolveTVBoxBridgeSites(
        authInfo.username,
        specialOnly
      );
      return NextResponse.json({
        sources: sites.map((site) => ({
          key: site.key,
          name: site.name,
          api: '',
        })),
      });
    }
    const apiSites = await getAvailableApiSites(authInfo?.username, specialOnly);

    return NextResponse.json({
      sources: apiSites.map((site) => ({
        key: site.key,
        name: site.name,
        api: site.api,
      })),
    });
  } catch (error) {
    console.error('Failed to get available API sites:', error);
    return NextResponse.json(
      { error: 'Failed to load sources' },
      { status: 500 }
    );
  }
}
