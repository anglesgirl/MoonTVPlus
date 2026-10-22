import { createHash } from 'crypto';

import type { AdminConfig } from '@/lib/admin.types';
import { getConfig } from '@/lib/config';
import { getStorage } from '@/lib/db';

export type NetDiskConfigData = NonNullable<AdminConfig['NetDiskConfig']>;
export type NetDiskProviderKey = keyof NetDiskConfigData;

export const NETDISK_PROVIDERS: NetDiskProviderKey[] = [
  'Quark',
  'Mobile',
  'Baidu',
  'Tianyi',
  'Pan123',
  'UC',
  'Pan115',
];

/** 取某个网盘配置条目的凭证标识字符串（空串 = 未配置凭证） */
export function netdiskCredentialOf(
  provider: NetDiskProviderKey,
  entry: NetDiskConfigData[NetDiskProviderKey] | undefined
): string {
  if (!entry) return '';
  switch (provider) {
    case 'Quark':
    case 'Baidu':
    case 'Pan115':
      return (entry as { Cookie?: string }).Cookie || '';
    case 'Mobile':
      return (entry as { Authorization?: string }).Authorization || '';
    case 'Tianyi':
    case 'Pan123': {
      const e = entry as { Account?: string; Password?: string };
      return e.Account ? `${e.Account}:${e.Password || ''}` : '';
    }
    case 'UC':
      return (entry as { Cookie?: string }).Cookie || '';
    default:
      return '';
  }
}

/**
 * 凭证的稳定哈希，用作 session 缓存的隔离维度：
 * 同一凭证（无论站长配置还是用户自填）共享缓存，不同凭证严格隔离，防串号。
 */
export function netdiskOwnerKey(
  provider: NetDiskProviderKey,
  entry: NetDiskConfigData[NetDiskProviderKey] | undefined
): string {
  const credential = netdiskCredentialOf(provider, entry);
  if (!credential) return 'none';
  return createHash('sha256').update(credential).digest('hex').slice(0, 16);
}

/** 读取用户个人网盘配置（存储层不支持时返回 null） */
export async function getUserNetDiskConfig(
  username: string
): Promise<NetDiskConfigData | null> {
  try {
    const storage = getStorage();
    if (storage.getUserNetDiskConfig) {
      return await storage.getUserNetDiskConfig(username);
    }
  } catch (error) {
    console.error('[NetDisk] 读取用户网盘配置失败:', error);
  }
  return null;
}

/** 保存用户个人网盘配置（存储层不支持时抛错） */
export async function saveUserNetDiskConfig(
  username: string,
  config: NetDiskConfigData
): Promise<void> {
  const storage = getStorage();
  if (!storage.setUserNetDiskConfig) {
    throw new Error('当前存储方式不支持保存个人网盘配置');
  }
  await storage.setUserNetDiskConfig(username, config);
}

/**
 * 计算某用户实际生效的网盘配置：
 * 每个网盘独立合并——用户自填且启用了带凭证的配置优先，否则回落站长全局配置。
 */
export async function getEffectiveNetDiskConfig(
  username?: string
): Promise<NetDiskConfigData> {
  const adminConfig = await getConfig();
  const adminNetDisk: NetDiskConfigData = adminConfig.NetDiskConfig || {};
  if (!username) return adminNetDisk;

  const userNetDisk = await getUserNetDiskConfig(username);
  if (!userNetDisk) return adminNetDisk;

  const merged: NetDiskConfigData = { ...adminNetDisk };
  for (const provider of NETDISK_PROVIDERS) {
    applyUserEntry(merged, provider, userNetDisk);
  }
  return merged;
}

function applyUserEntry<K extends NetDiskProviderKey>(
  merged: NetDiskConfigData,
  provider: K,
  userNetDisk: NetDiskConfigData
): void {
  const userEntry = userNetDisk[provider];
  if (userEntry?.Enabled && netdiskCredentialOf(provider, userEntry)) {
    merged[provider] = userEntry;
  }
}
