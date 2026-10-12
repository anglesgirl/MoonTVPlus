// @ts-nocheck 该文件含原样提取的混淆解密代码（无类型标注），跳过类型检查避免 strict 编译失败
// movy.sx 浏览器端扫描（play 页兜底用）
// 用途：MoonTVPlus 服务器（甲骨文）访问 api.wecollege.net 被风控时，
//       resolvePlayUrl 服务器端失败 → 前端用浏览器（家用 IP）扫 movy：
//       seed + miami/sources（CORS 全放行）→ 解密 → m3u8，再经 /api/m3u8-proxy 播放。
// 注意：m3u8（moon.zenoak.top）有防盗链需代理；分片（stormhive.top）无防盗链播放器直连。

// ---- 浏览器 ofetch（CORS 已由服务端放行）----
function toQueryString(obj) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    sp.append(k, v);
  }
  return sp.toString();
}
async function ofetchJson(url, params) {
  const qs = toQueryString(params);
  const res = await fetch(url + (qs ? '?' + qs : ''));
  if (!res.ok) { const err = new Error('HTTP ' + res.status); err.response = { status: res.status }; throw err; }
  return res.json();
}
async function ofetchText(url, params) {
  const qs = toQueryString(params);
  const res = await fetch(url + (qs ? '?' + qs : ''));
  if (!res.ok) { const err = new Error('HTTP ' + res.status); err.response = { status: res.status }; throw err; }
  return res.text();
}

// ---- movy 8311 解密核心（原样提取自 movy_source.js，仅 ofetch 已替换为浏览器版）----
let s = new Map;
  function n(e) { return new URL(e).origin }
  async function d(e, a) {
    let d = n(e), l = `${d}|${a}`, i = Date.now(), r = s.get(l);
    if (r && r.expiresAt - 5e3 > i) return r.seed;
    let o = await ofetchJson(`${d}/seed`, { mediaId: a }), u = o.ttlMs ?? 3e4;
    return s.set(l, { seed: o.seed, expiresAt: i + u }), o.seed
  }
  let l = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174], i = [109, 118, 109, 49], r = e => (e * (e + 1) & 1) == 0;
  function o(e) { return e >>>= 0, e ^= e >>> 16, e = Math.imul(e, 0x85ebca6b) >>> 0, e ^= e >>> 13, e = Math.imul(e, 0xc2b2ae35) >>> 0, (e ^= e >>> 16) >>> 0 }
  function u(e, a) { return (e >>>= 0, 0 == (a &= 31)) ? e >>> 0 : (e << a | e >>> 32 - a) >>> 0 }
  async function c(e, a, c, b) {
    if (void 0 === c) throw Error("mediaId is required to decode sources");
    let g = async () => {
      let s = await d(e, c);
      return function (e, a, t) {
        var s;
        let n = function (e) {
          let a = e.replace(/-/g, "+").replace(/_/g, "/").padEnd(4 * Math.ceil(e.length / 4), "=");
          if ("function" == typeof atob) { let e = atob(a), t = new Uint8Array(e.length); for (let a = 0; a < e.length; a++) t[a] = e.charCodeAt(a); return t }
          // @ts-ignore 浏览器环境走上方 atob 分支，此 Buffer 兜底仅无 atob 环境使用
          return new Uint8Array(globalThis.Buffer.from(a, "base64"))
        }(e), d = function (e, a, t) {
          let s = function (e, a) {
            let t;
            if (((t = e.length) * (t + 1) & 1) == 1) return { S: function (e) {
              let a = Array(256);
              for (let e = 0; e < 256; e++) a[e] = e;
              let t = 0;
              for (let s = 0; s < 256; s++) { t = t + a[s] + e.charCodeAt(s % e.length) & 255; let n = a[s]; a[s] = a[t], a[t] = n }
              return a
            }(e), acc: function (e) {
              let a = 0x67452301;
              for (let t = 0; t < e.length; t++) a = u((a ^ Math.imul(e.charCodeAt(t), l[15 & t])) >>> 0, 5);
              return o(a)
            }(e) };
            let s = Array(61), n = o(function (e) {
              let a = 0x811c9dc5;
              for (let t = 0; t < e.length; t++) a = Math.imul(a ^ e.charCodeAt(t), 0x1000193) >>> 0;
              return o(a)
            }(e) ^ o(a >>> 0 ^ 0x9e3779b9)) >>> 0;
            for (let e = 0; e < 8; e++) if (r(e)) { let a = n % 61; n = u(n + 0x9e3779b9 >>> 0, 7 + (7 & e)), s[a] = (n ^ o(n)) >>> 0, n = o(n + a >>> 0) } else s[e] = l[15 & e];
            return { S: s, acc: o(0xa5a5a5a5 ^ n) >>> 0 }
          }(e, a), n = new Uint8Array(t), d = 0;
          for (let e = 0; e < t;) {
            let a = function (e, a) {
              var t, s;
              let n = e.S, d = e.acc, l = d % 61, i = 0 - Number(l in n), r = n[l] >>> 0, c = Math.imul(0x9e3779b9, a + 1) >>> 0, b = (((t = d) ^ (s = (r ^ c) >>> 0)) >>> 0 | (t & s & i) >>> 0) >>> 0;
              return d = o((b = (u(b + d >>> 0, 31 & l) ^ u(d, 31 & Math.imul(l, 7))) >>> 0) + 0x9e3779b9 >>> 0), n[l] = d >>> 0, e.acc = d, d >>> 0
            }(s, d++);
            n[e++] = 255 & a, e < t && (n[e++] = a >>> 8 & 255), e < t && (n[e++] = a >>> 16 & 255), e < t && (n[e++] = a >>> 24 & 255)
          }
          return n
        }(a, t, n.length);
        for (let e = 0; e < n.length; e++) n[e] ^= d[e];
        for (let e = 0; e < i.length; e++) if (n[e] !== i[e]) throw Error("decrypt failed: bad seed or tampered payload");
        return s = n.subarray(i.length), "u" > typeof TextDecoder ? new TextDecoder("utf-8").decode(s) : // @ts-ignore 浏览器有 TextDecoder，恒走上方分支
        globalThis.Buffer.from(s).toString("utf8")
      }(await ofetchText(e, { ...a, enc: "2", seed: s }), s, c)
    };
    try { return await g() } catch (a) {
      var p;
      if (401 === ((null == a || null == (p = a.response) ? void 0 : p.status) ?? (null == a ? void 0 : a.status))) return s.delete(`${n(e)}|${c}`), await g();
      throw a
    }
  }
// ---- 工具 ----
export function b64urlDecode(str) {
  const b64 = String(str).replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64.padEnd(4 * Math.ceil(b64.length / 4), '=');
  return decodeURIComponent(atob(padded).split('').map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''));
}

// 判断一个裸 URL 是否为 movy 的 base64url id（search/detail 未包装成 play URL 时播放器会直接拿到它）
export function isMovyBareId(value) {
  if (!value || value.startsWith('/') || value.startsWith('http')) return false;
  try {
    const meta = JSON.parse(b64urlDecode(value));
    return (
      typeof meta.tmdbId === 'number' &&
      (meta.mediaType === 'movie' || meta.mediaType === 'tv') &&
      Boolean(meta.title || meta.titleEn)
    );
  } catch {
    return false;
  }
}

// ---- 浏览器端扫描入口：playUrl(base64url) → 最佳 m3u8 URL ----
export async function movyBrowserScan(playUrlValue) {
  const meta = JSON.parse(b64urlDecode(playUrlValue));
  const tmdbId = meta.tmdbId;
  const origin = 'https://api.wecollege.net';
  const base = { mediaId: tmdbId, tmdbId, mediaType: meta.mediaType === 'tv' ? 'tv' : 'movie', year: meta.year || '', enc: '2' };
  // 复用原版 c()（内部自动取 seed 并解密）
  let raw;
  try {
    raw = await c(origin + '/miami/sources', { ...base, title: encodeURIComponent(meta.title || '') }, tmdbId);
  } catch (e) {
    if (meta.titleEn && meta.titleEn !== meta.title) {
      raw = await c(origin + '/miami/sources', { ...base, title: encodeURIComponent(meta.titleEn) }, tmdbId);
    } else throw e;
  }
  const data = JSON.parse(raw);
  const rank = { '2160p': 4, '1080p': 3, '720p': 2, '480p': 1 };
  const best = [...(data.sources || [])].sort((a, b) => (rank[b.quality] || 0) - (rank[a.quality] || 0))[0];
  if (!best) throw new Error('no playable source');
  return best.url;
}
