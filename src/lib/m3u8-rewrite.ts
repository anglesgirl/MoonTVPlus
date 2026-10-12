/**
 * m3u8 重写与缓存 key 工具（浏览器端 movy-browser-scan 与服务器端路由共用，算法必须保持一致）
 */

/**
 * 重写 m3u8 内容中的媒体 URL 为同源代理地址。
 * 实测结论：部分源站分片域名（如 stormhive.top）无防盗链可直连，但另一些（如 noblekite.top）
 * 开启 Referer 防盗链；且浏览器 Referrer-Policy: no-referrer + Referer 为禁改头（forbidden header），
 * 播放器无法带合法 Referer 直连分片。统一改走代理由服务器带 Referer 拉流，100% 可控。
 * - 分片/init 资源（.m4s/.ts/.mp4）→ /api/m4s-proxy（二进制流式转发 + CDN 缓存头）
 * - 子 m3u8 清单 → /api/m3u8-proxy/index.m3u8（嵌套代理，保持 .m3u8 特征供播放器识别 HLS）
 */
export function rewriteMediaUrlsToProxy(text: string, referer: string): string {
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
 * 只重写子 m3u8 清单（分片保持直连）。用于分片无防盗链的场景（省服务器带宽）。
 */
export function rewriteNestedPlaylistsOnly(text: string, referer: string): string {
  return text.replace(
    /https?:\/\/[^\s"']+?\.m3u8[^\s"']*/g,
    (match) =>
      `/api/m3u8-proxy/index.m3u8?url=${encodeURIComponent(match)}&referer=${encodeURIComponent(referer)}`
  );
}

/** 纯 JS 确定性哈希（djb2，32 位，36 进制短串），用于 m3u8 缓存 key / 静态地址 */
export function djb2Hash(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}
