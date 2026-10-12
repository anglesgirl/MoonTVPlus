import { NextRequest, NextResponse } from 'next/server';
import { validateProxyUrlServerSide } from '@/lib/server/ssrf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_REDIRECTS = 5;
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/**
 * 媒体分片防盗链代理（m4s/ts/mp4）：服务器带 Referer 拉流，流式回传播放器。
 * GET /api/m4s-proxy?url=<encodeURIComponent(分片URL)>&referer=<encodeURIComponent(referer)>
 * 由 m3u8-proxy 重写后的清单引用；同源请求，无跨域问题。
 * 安全：每跳都经 validateProxyUrlServerSide 校验（DNS 解析 + 拒绝内网），防 SSRF。
 * 支持 Range 请求（hls.js/播放器拖动进度条），流式透传不整片载入内存。
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const target = searchParams.get('url');
    const referer = searchParams.get('referer') || '';

    if (!target) {
      return NextResponse.json({ error: '缺少 url 参数' }, { status: 400 });
    }

    let currentUrl: string;
    try {
      currentUrl = new URL(target).toString();
    } catch {
      return NextResponse.json({ error: '无效的 url' }, { status: 400 });
    }

    const range = request.headers.get('range');

    for (let i = 0; i <= MAX_REDIRECTS; i++) {
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
          ...(range ? { Range: range } : {}),
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(60000),
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
          return new NextResponse(resp.body, {
            status: resp.status,
            headers: passthroughHeaders(resp.headers),
          });
        }
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      return new NextResponse(resp.body, {
        status: resp.status,
        headers: passthroughHeaders(resp.headers),
      });
    }

    return NextResponse.json({ error: '重定向次数超限' }, { status: 502 });
  } catch (error) {
    const name = (error as Error)?.name;
    console.error('[m4s-proxy] 代理失败:', error);
    if (name === 'TimeoutError') {
      return NextResponse.json({ error: '上游请求超时' }, { status: 504 });
    }
    return NextResponse.json({ error: '代理请求失败' }, { status: 502 });
  }
}

function passthroughHeaders(headers: Headers): Headers {
  const h = new Headers(headers);
  // fetch 已自动解压 body，删除压缩/长度头防止客户端重复解压或长度不匹配
  h.delete('content-encoding');
  h.delete('content-length');
  h.set('Access-Control-Allow-Origin', '*');
  h.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  h.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, Content-Type');
  // 分片是 VOD 静态资源，允许浏览器/CDN 缓存（重复播放/多用户命中，减少回源）
  h.set('Cache-Control', 'public, max-age=86400');
  return h;
}
