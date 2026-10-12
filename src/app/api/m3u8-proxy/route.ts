import { NextRequest, NextResponse } from 'next/server';
import { validateProxyUrlServerSide } from '@/lib/server/ssrf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_REDIRECTS = 5;
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

function corsHeaders(headers: Headers): Headers {
  const h = new Headers(headers);
  // fetch 已自动解压 body，删除压缩/长度头防止客户端重复解压或长度不匹配
  h.delete('content-encoding');
  h.delete('content-length');
  h.set('Access-Control-Allow-Origin', '*');
  h.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  return h;
}

/**
 * 重写 m3u8 内容中的媒体 URL 为同源代理地址。
 * 背景：源站分片（stormhive.top）带 Referer 防盗链，播放器直连无合法 Referer 会被 403 拒绝；
 * 统一改走本服务的代理路由，由服务器带 Referer 拉流，播放器侧为同源请求，绕过防盗链与 CORS 双重限制。
 * - 分片/init 资源（.m4s/.ts/.mp4）→ /api/m4s-proxy（二进制流式转发）
 * - 子 m3u8 清单 → /api/m3u8-proxy/index.m3u8（嵌套代理，保持 .m3u8 特征供播放器识别 HLS）
 */
function rewriteMediaUrlsToProxy(text: string, referer: string): string {
  let out = text.replace(
    /https?:\/\/[^\s"']+?\.(?:m4s|ts|mp4)[^\s"']*/g,
    (match) =>
      `/api/m4s-proxy?url=${encodeURIComponent(match)}&referer=${encodeURIComponent(referer)}`
  );
  out = out.replace(
    /https?:\/\/[^\s"']+?\.m3u8[^\s"']*/g,
    (match) =>
      `/api/m3u8-proxy/index.m3u8?url=${encodeURIComponent(match)}&referer=${encodeURIComponent(referer)}`
  );
  return out;
}

/**
 * 通用 m3u8 防盗链代理（服务端带 Referer 拉流，回传播放器）
 * GET /api/m3u8-proxy?url=<encodeURIComponent(m3u8)>&referer=<encodeURIComponent(referer)>
 * 供脚本源 resolvePlayUrl 返回代理地址使用；同源请求，无跨域问题。
 * 安全：每跳都经 validateProxyUrlServerSide 校验（DNS 解析 + 拒绝内网），防 SSRF。
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
          return new NextResponse(resp.body, {
            status: resp.status,
            headers: corsHeaders(resp.headers),
          });
        }
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      // m3u8 清单：读全文并重写分片/子清单 URL 为同源代理（绕防盗链+CORS）
      const contentType = resp.headers.get('content-type') || '';
      if (/mpegurl|m3u8/i.test(contentType)) {
        const text = await resp.text();
        const rewritten = rewriteMediaUrlsToProxy(text, referer);
        return new NextResponse(rewritten, {
          status: resp.status,
          headers: corsHeaders(resp.headers),
        });
      }

      // 二进制/其他：流式透传
      return new NextResponse(resp.body, {
        status: resp.status,
        headers: corsHeaders(resp.headers),
      });
    }

    return NextResponse.json({ error: '重定向次数超限' }, { status: 502 });
  } catch (error) {
    const name = (error as Error)?.name;
    console.error('[m3u8-proxy] 代理失败:', error);
    if (name === 'TimeoutError') {
      return NextResponse.json({ error: '上游请求超时' }, { status: 504 });
    }
    return NextResponse.json({ error: '代理请求失败' }, { status: 502 });
  }
}
