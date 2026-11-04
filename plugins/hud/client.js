/**
 * DeepSeek Harness Client module, using the current Cordis browser loader format.
 * Preview ONLY: the overlay is inside DSH's window, not a desktop-wide HUD.
 * No DOM scraping, global events, timers, native Electron APIs, or fake session data.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-hud',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const NS = 'dsh.hud';
    const dictionaries = {
      zh: {
        taskTitle: '待办 / TASKS',
        pendingTask: '任务状态待接入',
        systemTitle: 'DSH / HUD',
        systemDetail: '时间 · 天气 · 系统状态待接入',
        messageTitle: '最近消息 / LATEST',
        messageDetail: '会话消息待接入',
        silent: '静默模式 · 界面预览',
        nativeHint: '透明置顶和鼠标穿透需 Windows 原生窗口层',
      },
      en: {
        taskTitle: 'TASKS',
        pendingTask: 'Task status not connected',
        systemTitle: 'DSH / HUD',
        systemDetail: 'Time, weather, and system status not connected',
        messageTitle: 'LATEST',
        messageDetail: 'Conversation events not connected',
        silent: 'Silent mode · interface preview',
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
          maxWidth: 'min(36vw, 340px)',
          textAlign: align,
        },
      },
      h('div', {
        style: { color: '#9bdcf0', fontSize: 11, fontWeight: 600 },
      }, title),
      h('div', {
        style: { color: '#aac1cb', fontSize: 11, marginTop: 5 },
      }, detail));
    }

    function HudPreview({ t }) {
      return h('div', {
        'aria-label': 'DSH HUD preview',
        'data-dsh-hud-preview': 'true',
        style: {
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
          background: 'transparent',
          isolation: 'isolate',
        },
      },
      h(Corner, { place: { top: 22, left: 26 }, title: t('taskTitle'), detail: t('pendingTask') }),
      h(Corner, { place: { top: 22, right: 26 }, title: t('systemTitle'), detail: t('systemDetail'), align: 'right' }),
      h(Corner, { place: { right: 26, bottom: 85 }, title: t('messageTitle'), detail: t('messageDetail'), align: 'right' }),
      h('section', {
        style: {
          ...textStyle,
          position: 'absolute',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          whiteSpace: 'nowrap',
          maxWidth: '92vw',
        },
      },
      h('div', { style: { color: '#9bdcf0', fontSize: 12 } }, t('silent')),
      h('div', { style: { color: '#aac1cb', fontSize: 10, marginTop: 4 } }, t('nativeHint'))));
    }

    return {
      inject: ['slots', 'locale'],
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
