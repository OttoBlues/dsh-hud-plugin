/**
 * DSH HUD v0.3.1 development: safer in-app update confirmation and lifecycle.
 * The browser never sees GitHub credentials or executes installers. The
 * Host anonymously verifies approved public GitHub archives and installs via
 * the official DSH pluginManager; a private repository remains unavailable.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-hud',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const NS = 'dsh.hud';
    const CURRENT_VERSION = '0.3.1';
    const RETRY_BUNDLES_MS = 5 * 60_000;
    const dictionaries = {
      zh: {
        sessionTitle: '会话活动 / SESSIONS',
        count: '会话', runningCount: '运行中', pendingCount: '待处理',
        systemTitle: 'DSH / HUD', systemDetail: '时间 · 天气 · 系统状态待接入',
        messageTitle: '最近消息 / LATEST', messageDetail: '实时消息待接入',
        current: '当前会话', noSelected: '尚未选中会话',
        running: '执行中', idle: '空闲', passive: '只读，不影响原会话',
        nativeHint: '桌面透明/鼠标穿透仍需 Windows 原生窗口',
        componentTab: '组件', componentTitle: '组件与更新', checking: '仅检查 released 已发布版；试验版需要自行开启',
        unstableToggle: '允许试验版更新（默认关闭）', unstableNote: '仅显示 unstable 中的测试包；仍需逐项点击确认。',
        unstableVersion: '试验版', stableVersion: '正式版',
        currentVersion: '当前版本', latestVersion: '可用版本',
        alreadyLatest: '已是最新', unavailable: '尚未取得可信版本清单',
        needsSetup: '更新源尚未就绪', update: '更新', cancel: '取消',
        confirm: '确认更新', confirmText: '确认后由 DSH 安装经过校验的发布包；更新可能需要重启 DSH。',
        restartRequired: '已安装，重启 DSH 生效', installedOK: '更新已安装', failedUpdate: '更新未完成，请检查仓库是否公开及 DSH 日志',
        queued: '已确认更新，正在交给 DSH 安装',
        requesting: '提交更新请求中…', requestFailed: '请求未保存，请重试',
        installing: '正在校验和安装…',
        preview: '聊天窗口 HUD 预览', previewDesc: '关闭后不会在聊天内容和标题栏上叠加状态文字。',
        noBundles: '未找到对应的 DSH 组件', installed: '已安装',
      },
      en: {
        sessionTitle: 'SESSION ACTIVITY',
        count: 'Sessions', runningCount: 'Running', pendingCount: 'Needs action',
        systemTitle: 'DSH / HUD', systemDetail: 'Time/weather/system data not connected',
        messageTitle: 'LATEST', messageDetail: 'Live messages not connected',
        current: 'Current session', noSelected: 'No session selected',
        running: 'Running', idle: 'Idle', passive: 'Read-only status',
        nativeHint: 'Native desktop overlay requires an Electron window layer',
        componentTab: 'Components', componentTitle: 'Components & updates',
        checking: 'Only released versions are shown by default',
        unstableToggle: 'Allow experimental updates (off by default)',
        unstableNote: 'Shows unstable test packages; each install still requires confirmation.',
        unstableVersion: 'Unstable', stableVersion: 'Released',
        currentVersion: 'Installed', latestVersion: 'Available',
        alreadyLatest: 'Up to date', unavailable: 'Trusted update catalog unavailable',
        needsSetup: 'Update source not ready', update: 'Update', cancel: 'Cancel',
        confirm: 'Confirm update',
        confirmText: 'DSH installs the verified release after confirmation; a restart may be required.',
        restartRequired: 'Installed; restart DSH', installedOK: 'Update installed', failedUpdate: 'Update failed; check public repository access and DSH logs',
        queued: 'Update request confirmed and being processed by DSH',
        requesting: 'Saving update request…', requestFailed: 'Could not save request; retry',
        installing: 'Verifying and installing…',
        preview: 'Chat-window HUD preview',
        previewDesc: 'Off means no floating HUD text overlaps chats or window chrome.',
        noBundles: 'No matching DSH components found', installed: 'Installed',
      },
    };

    function newer(a, b) {
      if (!/^\d+\.\d+\.\d+$/.test(a) || !/^\d+\.\d+\.\d+$/.test(b)) return false;
      const left = a.split('.').map(Number);
      const right = b.split('.').map(Number);
      for (let i = 0; i < 3; i++) {
        if (left[i] !== right[i]) return left[i] > right[i];
      }
      return false;
    }

    function readCatalog(text) {
      try {
        const data = JSON.parse(text || '');
        if (data?.schema !== 2 || !Array.isArray(data.components)) return [];
        return data.components.filter(item =>
          typeof item.name === 'string' && /^@local\/[a-z0-9-]+$/.test(item.name) &&
          (item.channel === 'released' || item.channel === 'unstable') &&
          typeof item.version === 'string' && /^\d+\.\d+\.\d+$/.test(item.version));
      } catch {
        return [];
      }
    }

    const captionStyle = {
      fontFamily: 'system-ui, sans-serif',
      textShadow: '0 1px 6px rgba(0, 0, 0, .8)',
      pointerEvents: 'none',
      letterSpacing: '.03em',
    };
    function Corner({ place, title, detail, align = 'left' }) {
      return h('section', {
        style: { ...captionStyle, position: 'absolute', ...place,
          maxWidth: 'min(32vw, 315px)', textAlign: align, overflow: 'hidden' },
      }, h('div', { style: { color: '#9bdcf0', fontSize: 11, fontWeight: 600 } }, title),
      h('div', { style: { color: '#aac1cb', fontSize: 11, marginTop: 5, overflow: 'hidden',
        textOverflow: 'ellipsis' } }, detail));
    }

    function makeOverlay(form) {
      return function HudPreview({ t, useSessions, useSessionStatus }) {
        const config = React.useSyncExternalStore(
          callback => form.subscribe(callback),
          () => form.getSnapshot(),
          () => form.getSnapshot(),
        );
        const sessions = useSessions(value => value);
        const statuses = useSessionStatus(value => value);
        // Previous preview overlapped title bar and chat composer. Turned off
        // by default; the person may opt in from the Components tab.
        if (config.value?.overlayVisible !== true) return null;
        const ids = sessions.ids;
        const selected = Object.values(sessions.byId)
          .find(row => (row.retainedBy?.mainView ?? 0) > 0);
        let running = 0, pending = 0;
        for (const id of ids) {
          const state = statuses.get(id);
          if ((state?.running ?? sessions.byId[id]?.running) === true) running++;
          if (state?.pendingInteraction != null) pending++;
        }
        const detail = [t('count') + ' ' + ids.length, t('runningCount') + ' ' + running,
          t('pendingCount') + ' ' + pending].join(' · ');
        const current = selected === undefined ? t('noSelected') :
          t('current') + ': ' + selected.displayTitle;
        const active = selected !== undefined &&
          (statuses.get(selected.id)?.running ?? selected.running) === true;
        return h('div', {
          'aria-label': 'DSH HUD preview',
          'data-dsh-hud-preview': 'true',
          'data-dsh-hud-version': CURRENT_VERSION,
          style: { position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'transparent', overflow: 'hidden' },
        },
        h(Corner, { place: { top: 84, left: 355 },
          title: t('sessionTitle'), detail }),
        h(Corner, { place: { top: 84, right: 34 },
          title: t('systemTitle'), detail: t('systemDetail'), align: 'right' }),
        h(Corner, { place: { right: 34, bottom: 132 },
          title: t('messageTitle'), detail: t('messageDetail'), align: 'right' }),
        h('section', {
          style: { ...captionStyle, position: 'absolute', bottom: 126, left: '50%',
            transform: 'translateX(-50%)', maxWidth: 'min(60vw, 600px)',
            textAlign: 'center' },
        },
        h('div', { style: { color: '#9bdcf0', fontSize: 11,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, current),
        h('div', { style: { color: '#aac1cb', fontSize: 10, marginTop: 3 } },
          (active ? t('running') : t('idle')) + ' · ' + t('passive'))));
      };
    }

    function makeComponentTab(ctx, form) {
      return function ComponentUpdates({ t }) {
        const snapshot = React.useSyncExternalStore(
          callback => form.subscribe(callback),
          () => form.getSnapshot(),
          () => form.getSnapshot(),
        );
        const [bundles, setBundles] = React.useState([]);
        const [confirm, setConfirm] = React.useState(null);
        const [saving, setSaving] = React.useState(false);
        const [error, setError] = React.useState('');
        React.useEffect(() => {
          let active = true;
          async function fetchInstalled() {
            try {
              const response = await ctx.remote.pluginManager.listBundles();
              if (active && response.ok) setBundles(response.value);
            } catch {
              // Do not claim a version based on a failed inventory query.
            }
          }
          void fetchInstalled();
          const timer = setInterval(() => { void fetchInstalled(); }, RETRY_BUNDLES_MS);
          return () => { active = false; clearInterval(timer); };
        }, []);

        const value = snapshot.value || {};
        const components = readCatalog(value.catalog);
        const availableByName = new Map();
        for (const component of components) {
          if (component.channel === 'unstable' && value.allowUnstable !== true) continue;
          const current = availableByName.get(component.name);
          // A released candidate wins on version ties.
          if (current === undefined || newer(component.version, current.version) ||
              (component.version === current.version && component.channel === 'released')) {
            availableByName.set(component.name, component);
          }
        }
        const installed = bundles.filter(item => item.installed && item.name.startsWith('@local/'));
        // Show the currently running HUD even if inventory is still loading.
        if (!installed.some(item => item.name === '@local/dsh-hud')) {
          installed.unshift({ name: '@local/dsh-hud', version: CURRENT_VERSION, installed: true });
        }
        const button = (label, onClick, disabled) =>
          h('button', {
            type: 'button', onClick, disabled,
            style: {
              padding: '7px 13px', borderRadius: 7, border: '1px solid currentColor',
              background: 'transparent', color: 'inherit', cursor: disabled ? 'default' : 'pointer',
              opacity: disabled ? .5 : 1, fontSize: 12,
            },
          }, label);
        const itemStyle = {
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
          gap: 14, padding: '14px 0', borderBottom: '1px solid var(--border-subtle, rgba(128,128,128,.2))',
        };
        const request = async item => {
          setSaving(true);
          setError('');
          try {
            const success = await form.mutate([
              { op: 'set', path: ['requestComponent'], value: item.name },
              { op: 'set', path: ['requestVersion'], value: item.version },
              { op: 'set', path: ['requestChannel'], value: item.channel },
              { op: 'set', path: ['requestNonce'], value: String(Date.now()) },
              { op: 'set', path: ['updateStatus'], value: '' },
            ]);
            if (!success) setError(t('requestFailed'));
            else setConfirm(null);
          } catch {
            setError(t('requestFailed'));
          } finally {
            setSaving(false);
          }
        };
        return h('div', {
          'data-dsh-hud-components': 'true',
          style: { padding: '14px 18px', color: 'inherit', fontFamily: 'system-ui, sans-serif',
            width: '100%', boxSizing: 'border-box', maxWidth: 920, margin: '0 auto' },
        },
        h('h3', { style: { margin: '0 0 5px', fontSize: 17 } }, t('componentTitle')),
        h('p', { style: { fontSize: 12, opacity: .7, margin: '0 0 15px' } }, t('checking')),
        ...installed.map(row => {
          const latest = availableByName.get(row.name);
          const current = row.version || (row.name === '@local/dsh-hud' ? CURRENT_VERSION : '');
          const canUpdate = latest !== undefined && newer(latest.version, current);
          const pending = canUpdate &&
            value.requestComponent === row.name && value.requestVersion === latest.version &&
            value.requestChannel === latest.channel &&
            (value.updateStatus === 'installing' ||
              (value.updateStatus === '' && !!value.requestNonce));
          const name = row.name === '@local/dsh-hud' ? 'DSH HUD' : row.name;
          return h('div', { key: row.name, style: itemStyle },
            h('div', { style: { minWidth: 190, flex: '1 1 240px' } },
              h('strong', { style: { display: 'block', fontSize: 13 } }, name),
              h('div', { style: { fontSize: 11, opacity: .65, marginTop: 5 } },
                t('currentVersion') + ': ' + current + '   ·   ' +
                t('latestVersion') + ': ' + (latest?.version || '—') +
                (latest ? ' (' + (latest.channel === 'unstable' ? t('unstableVersion') : t('stableVersion')) + ')' : ''))),
            h('div', { style: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' } },
              pending
                ? h('span', { role: 'status', style: { fontSize: 12, opacity: .75 } },
                    t(value.updateStatus === 'installing' ? 'installing' : 'queued'))
                : !canUpdate
                  ? h('span', { style: { fontSize: 12, opacity: .7 } },
                      latest === undefined ? t('unavailable') : t('alreadyLatest'))
                  : confirm === row.name
                    ? h(React.Fragment, null,
                        h('span', { style: { fontSize: 11, opacity: .7, maxWidth: 260 } }, t('confirmText')),
                        button(t('cancel'), () => setConfirm(null), saving),
                        button(saving ? t('requesting') : t('confirm'), () => { void request(latest); }, saving))
                    : button('↑ ' + t('update'), () => setConfirm(row.name), saving)
            ));
        }),
        error ? h('div', { role: 'alert', style: { marginTop: 12, color: '#c65b5b' } }, error) : null,
        value.updateStatus === 'failed'
          ? h('p', { role: 'alert', style: { color: '#c65b5b', fontSize: 12 } }, t('failedUpdate'))
          : value.updateStatus === 'restart-required'
            ? h('p', { role: 'status', style: { fontSize: 12 } }, t('restartRequired'))
            : value.updateStatus === 'installed'
              ? h('p', { role: 'status', style: { fontSize: 12 } }, t('installedOK')) : null,
        h('div', { style: { marginTop: 18, paddingTop: 12, borderTop: '1px solid rgba(128,128,128,.22)' } },
          h('label', { style: { display: 'flex', alignItems: 'center', gap: 9, fontSize: 13 } },
            h('input', { type: 'checkbox', checked: value.allowUnstable === true,
              'data-hud-unstable-opt-in': 'true',
              onChange: event => { void form.set('allowUnstable', event.target.checked); } }),
            t('unstableToggle')),
          h('p', { style: { fontSize: 11, opacity: .68, marginTop: 7 } }, t('unstableNote'))),
        h('div', { style: { marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(128,128,128,.22)' } },
          h('label', { style: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 } },
            h('input', { type: 'checkbox', checked: value.overlayVisible === true,
              onChange: event => { void form.set('overlayVisible', event.target.checked); } }),
            t('preview')),
          h('p', { style: { fontSize: 11, opacity: .68, marginTop: 7 } }, t('previewDesc'))));
      };
    }

    return {
      inject: ['slots', 'locale', 'uiSession', 'configForms', 'remote', 'remote.pluginManager'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, dictionaries), 'hud: locale');
        const form = ctx.configForms.get('dsh-hud');
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay', id: 'dsh-hud.preview', order: 100, locale: NS,
        }, makeOverlay(form)));
        ctx.slots.inject('plugins.tab', () => ctx.slots.register({
          name: 'plugins.tab', id: 'dsh-hud.components',
          label: () => ctx.locale.bind(NS)('componentTab'),
          order: 20, locale: NS,
        }, makeComponentTab(ctx, form)));
      },
    };
  },
});
