import { NextRequest, NextResponse } from 'next/server';
import { validateProxyUrlServerSide } from '@/lib/server/ssrf';
import { rewriteMediaUrlsToProxy } from '@/lib/m3u8-rewrite';
import { createRedisClient } from '@/lib/redis-node-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_REDIRECTS = 5;
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
// VOD 清单静态不变，长缓存（7 天）；命中后不再请求源站
const CACHE_TTL_SECONDS = 7 * 24 * 3600;

function getCache() {
  return createRedisClient(
    { url: process.env.REDIS_URL!, clientName: 'Redis' },
    Symbol.for('__MOONTV_REDIS_CLIENT__')
  );
}

/**
 * m3u8 缓存静态化路由：GET /api/m3u8-cache/<hash>.m3u8?src=<enc 源m3u8>&referer=<enc>
 * - 命中 redis 缓存：直接返回重写后的 m3u8（不请求源站）
 * - 未命中且有 src：服务器带 Referer 拉源站 → 重写分片为 m4s-proxy → 缓存 7 天 → 返回
 * - 未命中且无 src：404（首次播放需带 src 播种）
 * 播放器拿到的即真实 .m3u8 地址（hash 由源 m3u8 URL 确定性生成，同一片源地址恒定）。
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ hash: string }> }
) {
  try {
    const { hash: rawHash } = await params;
    const hash = rawHash.replace(/\.m3u8$/i, '');
    const src = request.nextUrl.searchParams.get('src');
    const referer = request.nextUrl.searchParams.get('referer') || '';

    if (!/^[0-9a-z]+$/.test(hash)) {
      return NextResponse.json({ error: '无效的 hash' }, { status: 400 });
    }

    const cacheKey = `m3u8:cache:v3:${hash}`;
    const cache = getCache();

    // 命中缓存：直接返回
    const cached = await cache.get(cacheKey);
    if (cached) {
      return new NextResponse(cached, {
        status: 200,
        headers: m3u8Headers(),
      });
    }

    // 未命中：需要 src 播种
    if (!src) {
      return NextResponse.json(
        { error: '缓存未命中且缺少 src 参数（首次需带 src 播种）' },
        { status: 404 }
      );
    }

    let currentUrl: string;
    try {
      currentUrl = new URL(src).toString();
    } catch {
      return NextResponse.json({ error: '无效的 src' }, { status: 400 });
    }

    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      // SSRF 防护：每跳都校验目标（含 DNS 解析，拒绝内网/私有地址/重绑定）
      if (!(await validateProxyUrlServerSide(currentUrl))) {
        return NextResponse.json(
          { error: '禁止访问内网或非法地址' },
          { status: 403 }
        );
      }

      const resp = await fetch(currentUrl, {
        headers: {
          ...(referer ? { Referer: referer } : {}),
          'User-Agent': UA,
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(20000),
      });

      // 手动跟随重定向，并对每一跳的 Location 重新校验
      if (resp.status >= 300 && resp.status < 400) {
        const location = resp.headers.get('location');
        await resp.body?.cancel();
        if (!location) {
          return NextResponse.json(
            { error: '重定向缺少 location' },
            { status: 502 }
          );
        }
        if (i === MAX_REDIRECTS) {
          return NextResponse.json(
            { error: '重定向次数超限' },
            { status: 502 }
          );
        }
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      if (!resp.ok) {
        return NextResponse.json(
          { error: `源站返回 ${resp.status}` },
          { status: 502 }
        );
      }

      const text = await resp.text();
      const rewritten = rewriteMediaUrlsToProxy(text, referer);

      // 缓存后返回（尽力缓存，失败不影响返回）
      try {
        await cache.setEx(cacheKey, CACHE_TTL_SECONDS, rewritten);
      } catch (cacheErr) {
        console.error('[m3u8-cache] 写入缓存失败:', cacheErr);
      }

      return new NextResponse(rewritten, {
        status: 200,
        headers: m3u8Headers(),
      });
    }

    return NextResponse.json({ error: '重定向次数超限' }, { status: 502 });
  } catch (error) {
    const name = (error as Error)?.name;
    console.error('[m3u8-cache] 失败:', error);
    if (name === 'TimeoutError') {
      return NextResponse.json({ error: '上游请求超时' }, { status: 504 });
    }
    return NextResponse.json({ error: '代理请求失败' }, { status: 502 });
  }
}

function m3u8Headers(): Headers {
  const h = new Headers();
  h.set('Content-Type', 'application/vnd.apple.mpegurl');
  h.set('Access-Control-Allow-Origin', '*');
  h.set('Cache-Control', 'public, max-age=86400');
  return h;
}
