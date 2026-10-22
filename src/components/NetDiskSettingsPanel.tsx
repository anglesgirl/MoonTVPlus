'use client';

import { HardDrive, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { type ReactNode, useCallback, useEffect, useState } from 'react';

interface NetDiskSettingsPanelProps {
  isOpen: boolean;
  mounted: boolean;
  onClose: () => void;
}

type ProviderKey =
  | 'quark'
  | 'mobile'
  | 'baidu'
  | 'tianyi'
  | 'pan123'
  | 'uc'
  | 'pan115';

interface QuarkNetDiskConfig {
  Enabled: boolean;
  Cookie: string;
  SavePath: string;
  PlayMode: 'direct_first' | 'transcode_first';
  MultiThreadPlayback: boolean;
}

interface MobileNetDiskConfig {
  Enabled: boolean;
  Authorization: string;
}

interface BaiduNetDiskConfig {
  Enabled: boolean;
  Cookie: string;
}

interface TianyiNetDiskConfig {
  Enabled: boolean;
  Account: string;
  Password: string;
}

interface Pan123NetDiskConfig {
  Enabled: boolean;
  Account: string;
  Password: string;
}

interface UCNetDiskConfig {
  Enabled: boolean;
  Cookie: string;
  Token: string;
  SavePath: string;
}

interface Pan115NetDiskConfig {
  Enabled: boolean;
  Cookie: string;
}

interface NetDiskConfigData {
  Quark?: Partial<QuarkNetDiskConfig>;
  Mobile?: Partial<MobileNetDiskConfig>;
  Baidu?: Partial<BaiduNetDiskConfig>;
  Tianyi?: Partial<TianyiNetDiskConfig>;
  Pan123?: Partial<Pan123NetDiskConfig>;
  UC?: Partial<UCNetDiskConfig>;
  Pan115?: Partial<Pan115NetDiskConfig>;
}

type Feedback = { type: 'success' | 'error'; message: string } | null;

function Toggle({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <button
      type='button'
      role='switch'
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-offset-gray-900 ${
        checked ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

const inputClassName =
  'w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 transition-colors placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900 dark:text-white';

const labelClassName =
  'mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300';

function ProviderSection({
  title,
  description,
  chipClassName,
  enabled,
  toggleDisabled,
  onToggle,
  children,
  validateLabel,
  validateDisabled,
  validating,
  onValidate,
  feedback,
}: {
  title: string;
  description: string;
  chipClassName: string;
  enabled: boolean;
  toggleDisabled?: boolean;
  onToggle: () => void;
  children: ReactNode;
  validateLabel: string;
  validateDisabled: boolean;
  validating: boolean;
  onValidate: () => void;
  feedback: Feedback;
}) {
  return (
    <section className='rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800'>
      <div className='mb-4 flex items-start gap-3'>
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${chipClassName}`}
        >
          <HardDrive className='h-5 w-5' />
        </div>
        <div className='min-w-0 flex-1'>
          <h4 className='text-base font-semibold text-gray-900 dark:text-gray-100'>
            {title}
          </h4>
          <p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
            {description}
          </p>
        </div>
        <Toggle
          checked={enabled}
          disabled={toggleDisabled}
          label={`切换${title}`}
          onChange={onToggle}
        />
      </div>

      <div className='space-y-4'>{children}</div>

      <button
        type='button'
        onClick={onValidate}
        disabled={validateDisabled}
        className='mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-blue-300 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/30'
      >
        {validating ? (
          <>
            <span className='h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent' />
            <span>校验中...</span>
          </>
        ) : (
          validateLabel
        )}
      </button>

      {feedback ? (
        <p
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={`mt-2 text-xs ${
            feedback.type === 'success'
              ? 'text-green-600 dark:text-green-400'
              : 'text-red-600 dark:text-red-400'
          }`}
        >
          {feedback.message}
        </p>
      ) : null}
    </section>
  );
}

export function NetDiskSettingsPanel({
  isOpen,
  mounted,
  onClose,
}: NetDiskSettingsPanelProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState<'success' | 'error' | null>(
    null
  );
  const [validatingProvider, setValidatingProvider] =
    useState<ProviderKey | null>(null);
  const [validateFeedback, setValidateFeedback] = useState<
    Partial<Record<ProviderKey, Feedback>>
  >({});

  // 夸克网盘
  const [quarkEnabled, setQuarkEnabled] = useState(false);
  const [quarkCookie, setQuarkCookie] = useState('');
  const [quarkSavePath, setQuarkSavePath] = useState('/');
  const [quarkPlayMode, setQuarkPlayMode] = useState<
    'direct_first' | 'transcode_first'
  >('transcode_first');
  const [quarkMultiThreadPlayback, setQuarkMultiThreadPlayback] =
    useState(false);
  // 移动云盘
  const [mobileEnabled, setMobileEnabled] = useState(false);
  const [mobileAuthorization, setMobileAuthorization] = useState('');
  // 百度网盘
  const [baiduEnabled, setBaiduEnabled] = useState(false);
  const [baiduCookie, setBaiduCookie] = useState('');
  // 天翼云盘
  const [tianyiEnabled, setTianyiEnabled] = useState(false);
  const [tianyiAccount, setTianyiAccount] = useState('');
  const [tianyiPassword, setTianyiPassword] = useState('');
  // 123网盘
  const [pan123Enabled, setPan123Enabled] = useState(false);
  const [pan123Account, setPan123Account] = useState('');
  const [pan123Password, setPan123Password] = useState('');
  // UC网盘
  const [ucEnabled, setUcEnabled] = useState(false);
  const [ucCookie, setUcCookie] = useState('');
  const [ucToken, setUcToken] = useState('');
  const [ucSavePath, setUcSavePath] = useState('/');
  // 115网盘
  const [pan115Enabled, setPan115Enabled] = useState(false);
  const [pan115Cookie, setPan115Cookie] = useState('');

  const applyConfig = useCallback((config: NetDiskConfigData) => {
    const quark = config.Quark;
    setQuarkEnabled(quark?.Enabled || false);
    setQuarkCookie(quark?.Cookie || '');
    setQuarkSavePath(quark?.SavePath || '/');
    setQuarkPlayMode(
      quark?.PlayMode === 'direct_first' ? 'direct_first' : 'transcode_first'
    );
    setQuarkMultiThreadPlayback(Boolean(quark?.MultiThreadPlayback));

    const mobile = config.Mobile;
    setMobileEnabled(mobile?.Enabled || false);
    setMobileAuthorization(mobile?.Authorization || '');

    const baidu = config.Baidu;
    setBaiduEnabled(baidu?.Enabled || false);
    setBaiduCookie(baidu?.Cookie || '');

    const tianyi = config.Tianyi;
    setTianyiEnabled(tianyi?.Enabled || false);
    setTianyiAccount(tianyi?.Account || '');
    setTianyiPassword(tianyi?.Password || '');

    const pan123 = config.Pan123;
    setPan123Enabled(pan123?.Enabled || false);
    setPan123Account(pan123?.Account || '');
    setPan123Password(pan123?.Password || '');

    const uc = config.UC;
    setUcEnabled(uc?.Enabled || false);
    setUcCookie(uc?.Cookie || '');
    setUcToken(uc?.Token || '');
    setUcSavePath(uc?.SavePath || '/');

    const pan115 = config.Pan115;
    setPan115Enabled(pan115?.Enabled || false);
    setPan115Cookie(pan115?.Cookie || '');
  }, []);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setStatusMessage('');
    setStatusType(null);
    setValidateFeedback({});
    try {
      const response = await fetch('/api/user/netdisk');
      if (response.ok) {
        const data = await response.json();
        applyConfig((data.config || {}) as NetDiskConfigData);
      } else {
        const data = await response.json().catch(() => ({}));
        setStatusMessage(data.error || '加载网盘配置失败');
        setStatusType('error');
      }
    } catch (error) {
      console.error('加载网盘配置失败:', error);
      setStatusMessage('加载网盘配置失败，请重试');
      setStatusType('error');
    } finally {
      setLoading(false);
    }
  }, [applyConfig]);

  useEffect(() => {
    if (isOpen && mounted) {
      void loadConfig();
    }
  }, [isOpen, mounted, loadConfig]);

  const buildValidateBody = (provider: ProviderKey) => {
    switch (provider) {
      case 'quark':
        return {
          action: 'validate',
          provider: 'quark',
          Quark: { Cookie: quarkCookie, SavePath: quarkSavePath },
        };
      case 'mobile':
        return {
          action: 'validate',
          provider: 'mobile',
          Mobile: { Authorization: mobileAuthorization },
        };
      case 'baidu':
        return {
          action: 'validate',
          provider: 'baidu',
          Baidu: { Cookie: baiduCookie },
        };
      case 'tianyi':
        return {
          action: 'validate',
          provider: 'tianyi',
          Tianyi: { Account: tianyiAccount, Password: tianyiPassword },
        };
      case 'pan123':
        return {
          action: 'validate',
          provider: 'pan123',
          Pan123: { Account: pan123Account, Password: pan123Password },
        };
      case 'uc':
        return {
          action: 'validate',
          provider: 'uc',
          UC: { Cookie: ucCookie, Token: ucToken, SavePath: ucSavePath },
        };
      case 'pan115':
        return {
          action: 'validate',
          provider: 'pan115',
          Pan115: { Cookie: pan115Cookie },
        };
    }
  };

  const validateFallbackMessages: Record<ProviderKey, string> = {
    quark: '夸克 Cookie 可读',
    mobile: '移动云盘验证头格式正常',
    baidu: '百度网盘 Cookie 格式正常',
    tianyi: '天翼云盘账号密码可用',
    pan123: '123网盘账号密码可用',
    uc: 'UC Cookie 可读',
    pan115: '115 Cookie 格式正常',
  };

  const handleValidate = async (provider: ProviderKey) => {
    setValidatingProvider(provider);
    setValidateFeedback((prev) => ({ ...prev, [provider]: null }));
    try {
      const response = await fetch('/api/user/netdisk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildValidateBody(provider)),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '校验失败');
      }
      setValidateFeedback((prev) => ({
        ...prev,
        [provider]: {
          type: 'success',
          message: data.message || validateFallbackMessages[provider],
        },
      }));
    } catch (error) {
      setValidateFeedback((prev) => ({
        ...prev,
        [provider]: {
          type: 'error',
          message: error instanceof Error ? error.message : '校验失败',
        },
      }));
    } finally {
      setValidatingProvider(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setStatusMessage('');
    setStatusType(null);
    try {
      const response = await fetch('/api/user/netdisk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          Quark: {
            Enabled: quarkEnabled,
            Cookie: quarkCookie,
            SavePath: quarkSavePath,
            PlayMode: quarkPlayMode,
            MultiThreadPlayback: quarkMultiThreadPlayback,
          },
          Mobile: {
            Enabled: mobileEnabled,
            Authorization: mobileAuthorization,
          },
          Baidu: {
            Enabled: baiduEnabled,
            Cookie: baiduCookie,
          },
          Tianyi: {
            Enabled: tianyiEnabled,
            Account: tianyiAccount,
            Password: tianyiPassword,
          },
          Pan123: {
            Enabled: pan123Enabled,
            Account: pan123Account,
            Password: pan123Password,
          },
          UC: {
            Enabled: ucEnabled,
            Cookie: ucCookie,
            Token: ucToken,
            SavePath: ucSavePath,
          },
          Pan115: {
            Enabled: pan115Enabled,
            Cookie: pan115Cookie,
          },
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '保存失败');
      }

      setStatusMessage('保存成功！');
      setStatusType('success');
      setTimeout(() => {
        setStatusMessage('');
        setStatusType(null);
      }, 3000);
    } catch (error) {
      console.error('保存网盘配置失败:', error);
      setStatusMessage(
        error instanceof Error ? error.message : '保存失败，请重试'
      );
      setStatusType('error');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <>
      <div
        className='fixed inset-0 z-[1000] bg-black/50 backdrop-blur-sm'
        onClick={onClose}
        onTouchMove={(e) => e.preventDefault()}
        onWheel={(e) => e.preventDefault()}
        style={{ touchAction: 'none' }}
      />

      <div className='fixed left-1/2 top-1/2 z-[1001] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-gray-900'>
        <div
          className='max-h-[85vh] overflow-y-auto p-6'
          data-panel-content
          onTouchMove={(e) => e.stopPropagation()}
          style={{ touchAction: 'auto' }}
        >
          <div className='mb-6 flex items-start justify-between gap-4'>
            <div>
              <div className='mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300'>
                <HardDrive className='h-5 w-5' />
              </div>
              <h3 className='text-xl font-bold text-gray-900 dark:text-gray-100'>
                我的网盘
              </h3>
              <p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
                填写并启用后，网盘播放优先用你自己的账号；未填写的网盘自动使用站长配置。
              </p>
            </div>
            <button
              onClick={onClose}
              className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:hover:bg-gray-800'
              aria-label='关闭我的网盘设置'
            >
              <X className='h-5 w-5' />
            </button>
          </div>

          {loading ? (
            <div className='space-y-4' aria-live='polite'>
              <div className='animate-pulse rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800'>
                <div className='mb-3 h-5 w-28 rounded bg-gray-200 dark:bg-gray-700' />
                <div className='h-10 rounded bg-gray-200 dark:bg-gray-700' />
              </div>
              <div className='animate-pulse rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800'>
                <div className='mb-3 h-5 w-32 rounded bg-gray-200 dark:bg-gray-700' />
                <div className='h-16 rounded bg-gray-200 dark:bg-gray-700' />
              </div>
              <p className='text-center text-sm text-gray-500 dark:text-gray-400'>
                加载中...
              </p>
            </div>
          ) : (
            <>
              <div className='space-y-4'>
                {/* 夸克网盘 */}
                <ProviderSection
                  title='夸克网盘'
                  description='开启后，网盘搜索中的夸克资源会优先使用你的账号播放和转存'
                  chipClassName='bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300'
                  enabled={quarkEnabled}
                  toggleDisabled={saving}
                  onToggle={() => setQuarkEnabled(!quarkEnabled)}
                  validateLabel='校验夸克配置'
                  validateDisabled={
                    !quarkEnabled ||
                    !quarkCookie ||
                    validatingProvider !== null ||
                    saving
                  }
                  validating={validatingProvider === 'quark'}
                  onValidate={() => void handleValidate('quark')}
                  feedback={validateFeedback.quark ?? null}
                >
                  <div>
                    <label className={labelClassName}>Cookie</label>
                    <textarea
                      value={quarkCookie}
                      onChange={(e) => setQuarkCookie(e.target.value)}
                      disabled={!quarkEnabled || saving}
                      rows={5}
                      placeholder='粘贴夸克网盘 Cookie'
                      className={inputClassName}
                    />
                  </div>
                  <div>
                    <label className={labelClassName}>转存位置</label>
                    <input
                      type='text'
                      value={quarkSavePath}
                      onChange={(e) => setQuarkSavePath(e.target.value)}
                      disabled={!quarkEnabled || saving}
                      placeholder='/影视/正式转存'
                      className={inputClassName}
                    />
                  </div>
                  <div>
                    <label className={labelClassName}>播放方式</label>
                    <select
                      value={quarkPlayMode}
                      onChange={(e) =>
                        setQuarkPlayMode(
                          e.target.value === 'direct_first'
                            ? 'direct_first'
                            : 'transcode_first'
                        )
                      }
                      disabled={!quarkEnabled || saving}
                      className={inputClassName}
                    >
                      <option value='direct_first'>直链优先</option>
                      <option value='transcode_first'>转码优先</option>
                    </select>
                    <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                      直链优先会优先使用原画下载地址；转码优先会优先使用夸克转码播放地址。
                    </p>
                  </div>
                  <div className='flex items-center justify-between gap-4 rounded-xl bg-white p-3 dark:bg-gray-900/70'>
                    <div>
                      <h5 className='text-sm font-medium text-gray-800 dark:text-gray-200'>
                        多线程播放
                      </h5>
                      <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                        开启后，代理会把播放器请求的 Range 拆分并发拉取。
                      </p>
                    </div>
                    <Toggle
                      checked={quarkMultiThreadPlayback}
                      disabled={!quarkEnabled || saving}
                      label='切换夸克多线程播放'
                      onChange={() =>
                        setQuarkMultiThreadPlayback(!quarkMultiThreadPlayback)
                      }
                    />
                  </div>
                </ProviderSection>

                {/* 移动云盘 */}
                <ProviderSection
                  title='移动云盘'
                  description='开启后，网盘搜索中的移动云盘资源会优先使用你的账号播放'
                  chipClassName='bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-300'
                  enabled={mobileEnabled}
                  toggleDisabled={saving}
                  onToggle={() => setMobileEnabled(!mobileEnabled)}
                  validateLabel='校验移动云盘验证头'
                  validateDisabled={
                    !mobileEnabled ||
                    !mobileAuthorization ||
                    validatingProvider !== null ||
                    saving
                  }
                  validating={validatingProvider === 'mobile'}
                  onValidate={() => void handleValidate('mobile')}
                  feedback={validateFeedback.mobile ?? null}
                >
                  <div>
                    <label className={labelClassName}>验证头</label>
                    <textarea
                      value={mobileAuthorization}
                      onChange={(e) => setMobileAuthorization(e.target.value)}
                      disabled={!mobileEnabled || saving}
                      rows={5}
                      placeholder='粘贴移动云盘验证头'
                      className={inputClassName}
                    />
                  </div>
                </ProviderSection>

                {/* 百度网盘 */}
                <ProviderSection
                  title='百度网盘'
                  description='开启后，网盘搜索中的百度网盘资源会优先使用你的账号播放'
                  chipClassName='bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-300'
                  enabled={baiduEnabled}
                  toggleDisabled={saving}
                  onToggle={() => setBaiduEnabled(!baiduEnabled)}
                  validateLabel='校验百度网盘 Cookie'
                  validateDisabled={
                    !baiduEnabled ||
                    !baiduCookie ||
                    validatingProvider !== null ||
                    saving
                  }
                  validating={validatingProvider === 'baidu'}
                  onValidate={() => void handleValidate('baidu')}
                  feedback={validateFeedback.baidu ?? null}
                >
                  <div>
                    <label className={labelClassName}>Cookie</label>
                    <textarea
                      value={baiduCookie}
                      onChange={(e) => setBaiduCookie(e.target.value)}
                      disabled={!baiduEnabled || saving}
                      rows={5}
                      placeholder='粘贴百度网盘 Cookie'
                      className={inputClassName}
                    />
                  </div>
                </ProviderSection>

                {/* 天翼云盘 */}
                <ProviderSection
                  title='天翼云盘'
                  description='开启后，网盘搜索中的天翼云盘资源会优先使用你的账号播放'
                  chipClassName='bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300'
                  enabled={tianyiEnabled}
                  toggleDisabled={saving}
                  onToggle={() => setTianyiEnabled(!tianyiEnabled)}
                  validateLabel='校验天翼云盘账号密码'
                  validateDisabled={
                    !tianyiEnabled ||
                    !tianyiAccount ||
                    !tianyiPassword ||
                    validatingProvider !== null ||
                    saving
                  }
                  validating={validatingProvider === 'tianyi'}
                  onValidate={() => void handleValidate('tianyi')}
                  feedback={validateFeedback.tianyi ?? null}
                >
                  <div className='rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300'>
                    使用天翼云盘前，请先关闭账号的设备锁，否则可能无法登录。
                  </div>
                  <div>
                    <label className={labelClassName}>账号</label>
                    <input
                      type='text'
                      value={tianyiAccount}
                      onChange={(e) => setTianyiAccount(e.target.value)}
                      disabled={!tianyiEnabled || saving}
                      placeholder='手机号 / 邮箱 / 天翼账号'
                      className={inputClassName}
                    />
                  </div>
                  <div>
                    <label className={labelClassName}>密码</label>
                    <input
                      type='password'
                      value={tianyiPassword}
                      onChange={(e) => setTianyiPassword(e.target.value)}
                      disabled={!tianyiEnabled || saving}
                      placeholder='输入天翼云盘密码'
                      className={inputClassName}
                    />
                  </div>
                </ProviderSection>

                {/* 123网盘 */}
                <ProviderSection
                  title='123网盘'
                  description='开启后，网盘搜索中的123网盘资源会优先使用你的账号播放'
                  chipClassName='bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-300'
                  enabled={pan123Enabled}
                  toggleDisabled={saving}
                  onToggle={() => setPan123Enabled(!pan123Enabled)}
                  validateLabel='校验123网盘账号密码'
                  validateDisabled={
                    !pan123Enabled ||
                    !pan123Account ||
                    !pan123Password ||
                    validatingProvider !== null ||
                    saving
                  }
                  validating={validatingProvider === 'pan123'}
                  onValidate={() => void handleValidate('pan123')}
                  feedback={validateFeedback.pan123 ?? null}
                >
                  <div>
                    <label className={labelClassName}>账号</label>
                    <input
                      type='text'
                      value={pan123Account}
                      onChange={(e) => setPan123Account(e.target.value)}
                      disabled={!pan123Enabled || saving}
                      placeholder='输入123网盘账号'
                      className={inputClassName}
                    />
                  </div>
                  <div>
                    <label className={labelClassName}>密码</label>
                    <input
                      type='password'
                      value={pan123Password}
                      onChange={(e) => setPan123Password(e.target.value)}
                      disabled={!pan123Enabled || saving}
                      placeholder='输入123网盘密码'
                      className={inputClassName}
                    />
                  </div>
                </ProviderSection>

                {/* UC网盘 */}
                <ProviderSection
                  title='UC网盘'
                  description='开启后，网盘搜索中的UC网盘资源会优先使用你的账号播放'
                  chipClassName='bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-300'
                  enabled={ucEnabled}
                  toggleDisabled={saving}
                  onToggle={() => setUcEnabled(!ucEnabled)}
                  validateLabel='校验UC配置'
                  validateDisabled={
                    !ucEnabled ||
                    !ucCookie ||
                    validatingProvider !== null ||
                    saving
                  }
                  validating={validatingProvider === 'uc'}
                  onValidate={() => void handleValidate('uc')}
                  feedback={validateFeedback.uc ?? null}
                >
                  <div>
                    <label className={labelClassName}>Cookie</label>
                    <textarea
                      value={ucCookie}
                      onChange={(e) => setUcCookie(e.target.value)}
                      disabled={!ucEnabled || saving}
                      rows={5}
                      placeholder='粘贴 UC 网盘 Cookie'
                      className={inputClassName}
                    />
                  </div>
                  <div>
                    <label className={labelClassName}>
                      Open API Token（可选）
                    </label>
                    <input
                      type='text'
                      value={ucToken}
                      onChange={(e) => setUcToken(e.target.value)}
                      disabled={!ucEnabled || saving}
                      placeholder='可选，填写后优先尝试原画地址'
                      className={inputClassName}
                    />
                  </div>
                  <div>
                    <label className={labelClassName}>临时转存位置</label>
                    <input
                      type='text'
                      value={ucSavePath}
                      onChange={(e) => setUcSavePath(e.target.value)}
                      disabled={!ucEnabled || saving}
                      placeholder='/影视/UC临时转存'
                      className={inputClassName}
                    />
                  </div>
                </ProviderSection>

                {/* 115网盘 */}
                <ProviderSection
                  title='115网盘'
                  description='开启后，网盘搜索中的115网盘资源会优先使用你的账号播放'
                  chipClassName='bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300'
                  enabled={pan115Enabled}
                  toggleDisabled={saving}
                  onToggle={() => setPan115Enabled(!pan115Enabled)}
                  validateLabel='校验115 Cookie'
                  validateDisabled={
                    !pan115Enabled ||
                    !pan115Cookie ||
                    validatingProvider !== null ||
                    saving
                  }
                  validating={validatingProvider === 'pan115'}
                  onValidate={() => void handleValidate('pan115')}
                  feedback={validateFeedback.pan115 ?? null}
                >
                  <div>
                    <label className={labelClassName}>Cookie</label>
                    <textarea
                      value={pan115Cookie}
                      onChange={(e) => setPan115Cookie(e.target.value)}
                      disabled={!pan115Enabled || saving}
                      rows={5}
                      placeholder='粘贴115网盘 Cookie'
                      className={inputClassName}
                    />
                  </div>
                </ProviderSection>
              </div>

              <button
                onClick={() => void handleSave()}
                disabled={saving}
                className='mt-[10px] flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-blue-400 dark:focus:ring-offset-gray-900 dark:disabled:bg-blue-500'
              >
                {saving ? (
                  <>
                    <span className='h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent' />
                    <span>保存中...</span>
                  </>
                ) : (
                  '保存网盘设置'
                )}
              </button>

              {statusMessage ? (
                <p
                  role={statusType === 'error' ? 'alert' : 'status'}
                  className={`text-center text-xs ${
                    statusType === 'success'
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {statusMessage}
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}
