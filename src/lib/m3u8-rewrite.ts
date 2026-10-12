/**
 * m3u8 重写与缓存 key 工具（浏览器端 movy-browser-scan 与服务器端路由共用，算法必须保持一致）
 */

/**
 * 重写 m3u8 内容中的媒体 URL 为同源代理地址。
 * 实测结论：分片（stormhive.top 的 m4s/ts/mp4）无 Referer 防盗链且带 CORS（access-control-allow-origin: *），
 * 播放器（hls.js/video）可跨域直连 → **分片保持原始绝对 URL 不改写**，省服务器带宽。
 * 仅子 m3u8 清单有防盗链（moon.zenoak.top 需 Referer）→ 重写为 /api/m3u8-proxy/index.m3u8（嵌套代理）。
 */
export function rewriteMediaUrlsToProxy(text: string, referer: string): string {
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
