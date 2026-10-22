/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { assertBaiduCookieHeaderSafe, normalizeBaiduCookie } from '@/lib/netdisk/baidu.client';
import {
  assertMobileAuthorizationHeaderSafe,
  normalizeMobileAuthorization,
} from '@/lib/netdisk/mobile.client';
import {
  normalizePan123Account,
  normalizePan123Password,
  validatePan123Credentials,
} from '@/lib/netdisk/pan123.client';
import { assertPan115CookieHeaderSafe, normalizePan115Cookie, validatePan115Cookie } from '@/lib/netdisk/pan115.client';
import {
  assertQuarkCookieHeaderSafe,
  normalizeQuarkCookie,
  validateQuarkCookieReadable,
} from '@/lib/netdisk/quark.client';
import { normalizeTianyiAccount, normalizeTianyiPassword, validateTianyiCredentials } from '@/lib/netdisk/tianyi.client';
import {
  assertUCCookieHeaderSafe,
  normalizeUCCookie,
  validateUCCookieReadable,
} from '@/lib/netdisk/uc.client';
import {
  getUserNetDiskConfig,
  saveUserNetDiskConfig,
  type NetDiskConfigData,
} from '@/lib/netdisk/effective-config';

export const runtime = 'nodejs';

function isLocalStorageMode() {
  return (process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage') === 'localstorage';
}

/** GET - 获取当前用户自己的网盘配置 */
export async function GET(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo?.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const config = await getUserNetDiskConfig(authInfo.username);
    return NextResponse.json({ config: config || {} });
  } catch (error) {
    console.error('[User NetDisk] 读取失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '读取失败' },
      { status: 500 }
    );
  }
}

/** POST - 保存/校验当前用户自己的网盘配置（action: save | validate） */
export async function POST(request: NextRequest) {
  if (isLocalStorageMode()) {
    return NextResponse.json(
      { error: '本地存储模式不支持个人网盘配置' },
      { status: 400 }
    );
  }

  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo?.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, Quark, Mobile, Baidu, Tianyi, Pan123, UC, Pan115, provider } = body;

    if (action === 'save') {
      const config: NetDiskConfigData = {
        Quark: {
          Enabled: Boolean(Quark?.Enabled),
          Cookie: Quark?.Cookie ? assertQuarkCookieHeaderSafe(Quark.Cookie) : '',
          SavePath: Quark?.SavePath || '/',
          PlayMode: Quark?.PlayMode === 'direct_first' ? 'direct_first' : 'transcode_first',
          MultiThreadPlayback: Boolean(Quark?.MultiThreadPlayback),
        },
        Mobile: {
          Enabled: Boolean(Mobile?.Enabled),
          Authorization: Mobile?.Authorization
            ? assertMobileAuthorizationHeaderSafe(Mobile.Authorization)
            : '',
        },
        Baidu: {
          Enabled: Boolean(Baidu?.Enabled),
          Cookie: Baidu?.Cookie ? assertBaiduCookieHeaderSafe(Baidu.Cookie) : '',
        },
        Tianyi: {
          Enabled: Boolean(Tianyi?.Enabled),
          Account: Tianyi?.Account ? normalizeTianyiAccount(Tianyi.Account) : '',
          Password: Tianyi?.Password ? normalizeTianyiPassword(Tianyi.Password) : '',
        },
        Pan123: {
          Enabled: Boolean(Pan123?.Enabled),
          Account: Pan123?.Account ? normalizePan123Account(Pan123.Account) : '',
          Password: Pan123?.Password ? normalizePan123Password(Pan123.Password) : '',
        },
        UC: {
          Enabled: Boolean(UC?.Enabled),
          Cookie: UC?.Cookie ? assertUCCookieHeaderSafe(UC.Cookie) : '',
          Token: UC?.Token ? String(UC.Token).trim() : '',
          SavePath: UC?.SavePath || '/',
        },
        Pan115: {
          Enabled: Boolean(Pan115?.Enabled),
          Cookie: Pan115?.Cookie ? assertPan115CookieHeaderSafe(Pan115.Cookie) : '',
        },
      };

      await saveUserNetDiskConfig(authInfo.username, config);
      return NextResponse.json({ success: true, message: '保存成功' });
    }

    if (action === 'validate') {
      if (provider === 'mobile') {
        if (!Mobile?.Authorization) {
          return NextResponse.json({ error: '请先填写移动云盘 Authorization' }, { status: 400 });
        }
        normalizeMobileAuthorization(Mobile.Authorization);
        return NextResponse.json({ success: true, message: '移动云盘 Authorization 格式正常' });
      }
      if (provider === 'baidu') {
        if (!Baidu?.Cookie) {
          return NextResponse.json({ error: '请先填写百度网盘 Cookie' }, { status: 400 });
        }
        normalizeBaiduCookie(Baidu.Cookie);
        return NextResponse.json({ success: true, message: '百度网盘 Cookie 格式正常' });
      }
      if (provider === 'tianyi') {
        if (!Tianyi?.Account || !Tianyi?.Password) {
          return NextResponse.json({ error: '请先填写天翼云盘账号和密码' }, { status: 400 });
        }
        await validateTianyiCredentials(
          normalizeTianyiAccount(Tianyi.Account),
          normalizeTianyiPassword(Tianyi.Password)
        );
        return NextResponse.json({ success: true, message: '天翼云盘账号密码可用' });
      }
      if (provider === 'pan123') {
        if (!Pan123?.Account || !Pan123?.Password) {
          return NextResponse.json({ error: '请先填写123网盘账号和密码' }, { status: 400 });
        }
        await validatePan123Credentials(
          normalizePan123Account(Pan123.Account),
          normalizePan123Password(Pan123.Password)
        );
        return NextResponse.json({ success: true, message: '123网盘账号密码可用' });
      }
      if (provider === 'uc') {
        if (!UC?.Cookie) {
          return NextResponse.json({ error: '请先填写UC Cookie' }, { status: 400 });
        }
        await validateUCCookieReadable(normalizeUCCookie(UC.Cookie));
        return NextResponse.json({ success: true, message: 'UC Cookie 可读' });
      }
      if (provider === 'pan115') {
        if (!Pan115?.Cookie) {
          return NextResponse.json({ error: '请先填写115 Cookie' }, { status: 400 });
        }
        await validatePan115Cookie(normalizePan115Cookie(Pan115.Cookie));
        return NextResponse.json({ success: true, message: '115 Cookie 格式正常' });
      }

      if (!Quark?.Cookie) {
        return NextResponse.json({ error: '请先填写夸克 Cookie' }, { status: 400 });
      }
      await validateQuarkCookieReadable(normalizeQuarkCookie(Quark.Cookie));
      return NextResponse.json({ success: true, message: '夸克cookie正常' });
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (error) {
    console.error('[User NetDisk] 操作失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '操作失败' },
      { status: 500 }
    );
  }
}
