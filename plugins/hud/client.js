/**
 * HUD v0.2.0: browser-only, read-only view of the existing DSH Session
 * Controller. Does not retain Sessions, open histories, invoke commands,
 * create a second React root, or replace the shipped UI layout.
 *
 * Compatible API source (source-level contract checked 2026-11-04):
 *   packages/client/ui-session/src/client/index.ts
 *   packages/api/session-controller/src/client/sessions/service.ts
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-hud',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const NS = 'dsh.hud';
    const dictionaries = {
      zh: {
        sessionTitle: '会话活动 / SESSIONS',
        count: '会话',
        runningCount: '运行中',
        pendingCount: '待处理',
        systemTitle: 'DSH / HUD',
        systemDetail: '时间 · 天气 · 系统状态待接入',
        messageTitle: '最近消息 / LATEST',
        messageDetail: '实时消息待接入',
        current: '当前会话',
        noSelected: '尚未选中会话',
        running: '执行中',
        idle: '空闲',
        passive: '只读状态 · 不影响原会话',
        nativeHint: '透明置顶和鼠标穿透需 Windows 原生窗口层',
      },
      en: {
        sessionTitle: 'SESSION ACTIVITY',
        count: 'Sessions',
        runningCount: 'Running',
        pendingCount: 'Needs action',
        systemTitle: 'DSH / HUD',
        systemDetail: 'Time, weather and system status not connected',
        messageTitle: 'LATEST',
        messageDetail: 'Live messages not connected',
        current: 'Current session',
        noSelected: 'No session selected',
        running: 'Running',
        idle: 'Idle',
        passive: 'Read-only state · no Session changes',
        nativeHint: 'Desktop transparency and click-through require a native Windows window',
      },
    };

    const textStyle = {
      fontFamily: 'system-ui, sans-serif',
      textShadow: '0 1px 6px rgba(0, 0, 0, .8)',
      pointerEvents: 'none',
      letterSpacing: '.03em',
    };

    function Corner({ place, title, detail, align = 'left' }) {
      return h('section', {
        style: {
          ...textStyle,
          position: 'absolute',
          ...place,
          maxWidth: 'min(37vw, 365px)',
          textAlign: align,
          overflow: 'hidden',
        },
      },
      h('div', { style: { color: '#9bdcf0', fontSize: 11, fontWeight: 600 } }, title),
      h('div', {
        style: { color: '#aac1cb', fontSize: 11, marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis' },
      }, detail));
    }

    // Pure function, using the Host-projected catalog. Count only catalog IDs,
    // not fallback subagent rows, so the Session totals remain meaningful.
    function summarizeSessions(list, statuses) {
      const ids = list.ids;
      const byId = list.byId;
      let running = 0;
      let pending = 0;
      for (const id of ids) {
        const status = statuses.get(id);
        if ((status?.running ?? byId[id]?.running) === true) running += 1;
        if (status?.pendingInteraction !== undefined && status?.pendingInteraction !== null) pending += 1;
      }
      const selected = Object.values(byId).find(row => (row.retainedBy?.mainView ?? 0) > 0);
      const selectedStatus = selected === undefined ? undefined : statuses.get(selected.id);
      return {
        total: ids.length,
        running,
        pending,
        currentTitle: selected?.displayTitle,
        currentRunning: selected === undefined ? false : (selectedStatus?.running ?? selected.running) === true,
      };
    }

    function HudPreview({ t, useSessions, useSessionStatus }) {
      // Both are framework-provided selector hooks for the root-scoped Slot.
      // Subscribe once, no separate event polling or manual session lifetime.
      const sessions = useSessions(value => value);
      const statuses = useSessionStatus(value => value);
      const summary = summarizeSessions(sessions, statuses);
      const detail = [
        t('count') + ' ' + summary.total,
        t('runningCount') + ' ' + summary.running,
        t('pendingCount') + ' ' + summary.pending,
      ].join(' · ');
      const currentTitle = summary.currentTitle === undefined
        ? t('noSelected')
        : t('current') + ': ' + summary.currentTitle;
      const selectedState = summary.currentTitle === undefined
        ? t('passive')
        : (summary.currentRunning ? t('running') : t('idle')) + ' · ' + t('passive');

      return h('div', {
        'aria-label': 'DSH HUD preview',
        'data-dsh-hud-preview': 'true',
        'data-dsh-hud-version': '0.2.0',
        style: {
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
          background: 'transparent',
          isolation: 'isolate',
        },
      },
      h(Corner, { place: { top: 22, left: 26 }, title: t('sessionTitle'), detail }),
      h(Corner, {
        place: { top: 22, right: 26 }, title: t('systemTitle'),
        detail: t('systemDetail'), align: 'right',
      }),
      h(Corner, {
        place: { right: 26, bottom: 85 }, title: t('messageTitle'),
        detail: t('messageDetail'), align: 'right',
      }),
      h('section', {
        style: {
          ...textStyle,
          position: 'absolute',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          maxWidth: 'min(90vw, 680px)',
          overflow: 'hidden',
        },
      },
      h('div', {
        style: { color: '#9bdcf0', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
      }, currentTitle),
      h('div', { style: { color: '#aac1cb', fontSize: 10, marginTop: 4 } }, selectedState),
      h('div', { style: { color: '#829eaf', fontSize: 9, marginTop: 3 } }, t('nativeHint'))));
    }

    return {
      // uiSession supplies useSessions/useSessionStatus through global Slot props.
      inject: ['slots', 'locale', 'uiSession'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, dictionaries), 'hud: locale');
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: 'dsh-hud.preview',
          order: 100,
          locale: NS,
        }, HudPreview));
      },
    };
  },
});
