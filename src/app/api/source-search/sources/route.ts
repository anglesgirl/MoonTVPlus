import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getAvailableApiSites } from '@/lib/config';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);
  // 游客模式：未登录也可访问，username 为 undefined 时按游客规则过滤资源站

  try {
    const specialOnly = request.nextUrl.searchParams.get('special') === '1';
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
