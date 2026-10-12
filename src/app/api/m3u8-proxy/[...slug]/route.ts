import { GET } from '../route';

// 动态段路由：/api/m3u8-proxy/<任意段>.m3u8?url=...&referer=...
// 目的：让代理 URL 带 .m3u8 路径，MoonTVPlus 播放器按扩展名识别为 HLS 流（isHlsPlaybackUrl），
// 否则 /api/m3u8-proxy?url=... 无扩展名会被当成普通视频，不拉分片导致黑屏。
// 复用主路由 GET 逻辑（其只依赖 searchParams 的 url/referer，与路径无关）。

export { GET };
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
