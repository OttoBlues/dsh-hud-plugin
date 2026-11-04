/**
 * DSH HUD V0.5.0 development Client.
 * HUD is a DSH plugin with its own left sidebar panel; repo components are
 * managed inside that panel, not inside DSH's native Plugins management tab.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-hud',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const NS = 'dsh.hud';
    const PANEL = 'dsh-hud';
    const VERSION = '0.5.0';
    const REFRESH_MS = 5 * 60_000;

    const dictionaries = {
      zh: {
        workspaceTitle:'HUD 工作台',workspaceNav:'HUD 导航',overview:'总览',sessionTab:'会话',
        enterHud:'进入 HUD 模式',returnDSH:'返回 DSH',componentCenter:'组件中心',
        liveStatus:'实时状态',heroTitle:'专注于重要的任务',heroHelp:'HUD 主界面基于 DSH 当前会话显示真实的工作状态；操作和权限仍由原 DSH 控制。',
        sessionCount:'会话数量',runningCount:'运行中',viewMode:'显示模式',
        fromDSH:'由 DSH 提供',realtime:'实时状态',switchable:'随时可切换',
        currentSession:'当前会话',noCurrent:'未选择会话',noSessions:'暂无会话',
        recentSessions:'最近会话',allSessions:'所有会话',running:'进行中',idle:'空闲',
        untitledSession:'未命名会话',sessionReadOnly:'只读',currentHelp:'这里显示当前会话；点击下方按钮可返回原 DSH 继续对话。',
        sessionsHelp:'HUD 仅展示会话概况；会话切换与聊天输入仍在 DSH 中完成。',
        openConversation:'在 DSH 继续会话',readOnlyBoundary:'当前版本为 HUD 工作区预览 · 聊天输入、审批和任务操作请在 DSH 完成',
        previewStatus:'工作区预览',modeFailed:'HUD 模式切换失败，请重试',
        panel: 'HUD', title: 'HUD 组件中心', sub: 'OttoBlues/dsh-hud-plugin · 组件安装、版本和更新策略',
        section: '仓库组件', options: '更新策略', sourceOK: '公开仓库已连接',
        sourceUnavailable: '仓库版本源暂不可匿名访问：请将 GitHub 仓库设为 Public。',
        sourceChecking: '正在读取公开组件清单…', noComponents: '当前没有可用的仓库组件',
        installed: '已安装', notInstalled: '未安装', current: '当前', released: '正式版',
        unstable: '试验版', notPublished: '未发布', update: '更新', install: '安装',
        latest: '已是最新', unavailable: '暂无可安装的新版本', queued: '已确认，准备安装…',
        installing: '正在校验并安装…', failed: '安装失败或未能验证版本，请查看 DSH 日志',
        restart: '已完成安装，请重启 DSH', succeeded: '更新已安装',
        confirm: '确认', cancel: '取消',
        confirmText: '只安装仓库对应通道中经过校验的 .tgz。更新期间 DSH 可能要求重启。',
        allowUnstable: '接收试验版更新', allowUnstableHelp: '默认关闭。开启后可以手动安装 unstable 中的试验包。',
        autoUpdate: '自动更新正式版', autoUpdateHelp: '默认关闭。定期检测已安装组件；仅自动安装 released 中版本更高的正式包，不自动安装新组件。',
        autoUnstable: '自动更新试验版', autoUnstableHelp: '独立的额外授权；只有同时开启上述两个选项才会自动安装 unstable 包。存在不稳定风险。',
        preview: '聊天窗口 HUD 预览', previewHelp: '默认关闭；可避免状态文字与标题栏、聊天输入区重叠。',
        noToken: '无需 GitHub Token · 仅下载公开通道中登记的安装包',
      },
      en: {
        workspaceTitle:'HUD Workspace',workspaceNav:'HUD navigation',overview:'Overview',sessionTab:'Sessions',
        enterHud:'Enter HUD mode',returnDSH:'Return to DSH',componentCenter:'Component Center',
        liveStatus:'LIVE STATUS',heroTitle:'Stay focused on what matters',
        heroHelp:'A live HUD workspace powered by DSH session state. Commands and permissions stay in DSH.',
        sessionCount:'SESSIONS',runningCount:'RUNNING',viewMode:'VIEW MODE',
        fromDSH:'From DSH',realtime:'Live state',switchable:'Switch anytime',
        currentSession:'CURRENT SESSION',noCurrent:'No session selected',noSessions:'No sessions yet',
        recentSessions:'Recent sessions',allSessions:'All sessions',running:'Running',idle:'Idle',
        untitledSession:'Untitled session',sessionReadOnly:'Read-only',currentHelp:'Use the button below to continue this conversation in DSH.',
        sessionsHelp:'The HUD shows session status; session selection and input remain in DSH.',
        openConversation:'Continue in DSH',readOnlyBoundary:'HUD workspace preview · Use DSH for chat, approvals and task actions',
        previewStatus:'Workspace preview',modeFailed:'Could not change HUD mode. Try again.',
        panel: 'HUD', title: 'HUD Component Center', sub: 'OttoBlues/dsh-hud-plugin · Install, update and configure',
        section: 'Repository components', options: 'Update policy', sourceOK: 'Public repository connected',
        sourceUnavailable: 'Anonymous update source unavailable. Make the GitHub repository Public to enable direct updates.',
        sourceChecking: 'Checking the public component index…', noComponents: 'No repository components are available',
        installed: 'Installed', notInstalled: 'Not installed', current: 'Current', released: 'Released',
        unstable: 'Unstable', notPublished: 'Not published', update: 'Update', install: 'Install',
        latest: 'Up to date', unavailable: 'No installable new version', queued: 'Update confirmed and queued…',
        installing: 'Verifying and installing…', failed: 'Install failed or version could not be verified; check DSH logs',
        restart: 'Installed; restart DSH', succeeded: 'Component updated',
        confirm: 'Confirm', cancel: 'Cancel',
        confirmText: 'Only SHA-256-verified channel packages are installed. A DSH restart may be required.',
        allowUnstable: 'Allow experimental updates', allowUnstableHelp: 'Off by default; enables manual updates from unstable.',
        autoUpdate: 'Automatic released updates', autoUpdateHelp: 'Off by default. Automatically update existing installed components from released; never installs new components.',
        autoUnstable: 'Automatically install unstable updates', autoUnstableHelp: 'Additional explicit opt-in, effective only with both options above; experimental risk.',
        preview: 'HUD chat-window preview', previewHelp: 'Off by default to avoid overlapping window chrome and chat input.',
        noToken: 'No GitHub Token · Only indexed public installable archives',
      },
    };

    function newer(a, b) {
      if (!/^\d+\.\d+\.\d+$/.test(a || '')) return false;
      if (b == null || b === '') return true;
      if (!/^\d+\.\d+\.\d+$/.test(b)) return false;
      const left = a.split('.').map(Number), right = b.split('.').map(Number);
      for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] > right[i];
      return false;
    }

    function parseCatalog(value) {
      try {
        const data = JSON.parse(value || '{}');
        if (data.schema !== 3 || !Array.isArray(data.components) || data.components.length > 32) {
          return { source: 'unavailable', components: [] };
        }
        return {
          source: data.source === 'public' ? 'public' :
            data.source === 'checking' ? 'checking' : 'unavailable',
          components: data.components.filter(row =>
            /^[a-z0-9][a-z0-9-]*$/.test(row?.id || '') &&
            /^@local\/[a-z0-9-]+$/.test(row?.name || '') &&
            typeof row.title === 'string' && typeof row.description === 'string'),
        };
      } catch { return { source: 'unavailable', components: [] }; }
    }

    const overlayStyle = {
      fontFamily: 'system-ui,sans-serif', textShadow: '0 1px 5px rgba(0,0,0,.8)',
      pointerEvents: 'none', letterSpacing: '.025em',
    };
    function OverlayLabel({ title, body, side }) {
      return h('div', {
        style: { ...overlayStyle, position: 'absolute', ...side, color: '#96d3eb',
          fontSize: 11, maxWidth: 300, whiteSpace: 'nowrap', overflow: 'hidden',
          textOverflow: 'ellipsis' },
      }, h('strong', null, title), h('div', { style: { opacity: .83, marginTop: 4 } }, body));
    }


    // Full-frame in-app HUD. The DSH AppFrame stays mounted underneath:
    // no root-slot override, global DOM mutations or session navigation hacks.
    function HudWorkspace({t, sessions, statuses, onExit, onComponents, error}) {
      const [tab, setTab] = React.useState('overview');
      const [clock, setClock] = React.useState(new Date().toLocaleTimeString(undefined,
        {hour:'2-digit', minute:'2-digit'}));
      React.useEffect(() => {
        const timer = setInterval(() => setClock(new Date().toLocaleTimeString(undefined,
          {hour:'2-digit', minute:'2-digit'})), 30_000);
        return () => clearInterval(timer);
      }, []);

      const ids = Array.isArray(sessions?.ids) ? sessions.ids : [];
      const byId = sessions?.byId || {};
      const rows = ids.map(id => {
        const item = byId[id] || {};
        const status = typeof statuses?.get === 'function' ? statuses.get(id) : null;
        return {id, title:typeof item.displayTitle==='string' && item.displayTitle.trim()
          ? item.displayTitle : t('untitledSession'),
          running: (status?.running ?? item.running) === true,
          current:(item.retainedBy?.mainView || 0) > 0};
      });
      const active = rows.filter(row => row.running).length;
      const selected = rows.find(row => row.current);
      const hue = '#8be9e0', muted = '#9cb3c0';
      const outline = '1px solid rgba(141,222,225,.18)';
      const panel = {border:outline,borderRadius:18,background:'rgba(12,29,41,.86)',
        boxShadow:'0 12px 42px rgba(0,0,0,.18)'};
      const pill = (label,onClick,primary=false, extra={}) => h('button',{
        type:'button',onClick,...extra,style:{font:'inherit',fontSize:13,fontWeight:600,
          color:primary?'#0b222a':'#e7f5f8',background:primary?hue:'rgba(119,177,198,.10)',
          border:primary?'1px solid transparent':outline,borderRadius:11,
          padding:'11px 17px',cursor:'pointer',minHeight:42,...extra.style}},label);
      const metric = (key,value,foot) => h('div',{key,style:{...panel,padding:'17px 20px',
        minWidth:135,flex:'1 1 150px'}},
        h('div',{style:{fontSize:11,color:muted,letterSpacing:'0.09em'}},key),
        h('strong',{style:{display:'block',fontSize:29,marginTop:9,fontWeight:620}},value),
        h('div',{style:{fontSize:12,color:muted,marginTop:5}},foot));
      const sessionRow = row => h('div',{key:row.id,'data-hud-session-id':String(row.id),
        style:{display:'flex',gap:12,alignItems:'center',justifyContent:'space-between',
          padding:'12px 0',borderBottom:'1px solid rgba(141,222,225,.10)'}},
        h('div',{style:{minWidth:0,flex:1}},
          h('div',{style:{fontSize:14,overflow:'hidden',textOverflow:'ellipsis',
            whiteSpace:'nowrap',fontWeight:540}},row.title),
          h('div',{style:{fontSize:11,color:muted,marginTop:5}},
            row.current?t('currentSession'):t('sessionReadOnly'))),
        h('span',{style:{fontSize:11,color:row.running?hue:muted,
          whiteSpace:'nowrap'}},row.running?t('running'):t('idle')));

      return h('section',{
        role:'dialog','aria-modal':true,'aria-label':t('workspaceTitle'),
        tabIndex:0,'data-dsh-hud-workspace':true,'data-dsh-hud-version':VERSION,
        onKeyDown:e=>{if(e.key==='Escape'){e.stopPropagation?.();onExit();}},
        style:{position:'absolute',inset:0,zIndex:30,boxSizing:'border-box',
          background:'radial-gradient(ellipse at 80% 12%, #15384b 0%, transparent 45%), linear-gradient(140deg,#06141e,#091a26 60%,#102b33)',
          color:'#edf8fb',fontFamily:'system-ui, sans-serif',
          pointerEvents:'auto',overflowY:'auto',overflowX:'hidden'}},
        h('div',{style:{maxWidth:1600,margin:'0 auto',padding:'28px clamp(18px,3vw,54px) 38px',
          boxSizing:'border-box',minHeight:'100%',display:'flex',gap:28}},
          h('nav',{'aria-label':t('workspaceNav'),
            style:{width:145,flex:'0 0 145px',display:'flex',flexDirection:'column',
              gap:12,borderRight:'1px solid rgba(141,222,225,.12)',paddingRight:18}},
            h('div',{style:{fontSize:24,fontWeight:800,letterSpacing:'0.15em',
              color:hue,padding:'0 8px 28px'}},'HUD'),
            pill(t('overview'),()=>setTab('overview'),tab==='overview',
              {'data-hud-tab':'overview'}),
            pill(t('sessionTab'),()=>setTab('sessions'),tab==='sessions',
              {'data-hud-tab':'sessions'}),
            pill(t('componentCenter'),onComponents,false,
              {'data-hud-nav':'components'}),
            h('div',{style:{marginTop:'auto',paddingTop:35}},
              pill(t('returnDSH'),onExit,false,{'data-hud-nav':'dsh',
                style:{width:'100%'}}))),
          h('div',{style:{flex:1,minWidth:0,display:'flex',flexDirection:'column',gap:22}},
            h('header',{style:{display:'flex',alignItems:'center',gap:16,
              justifyContent:'space-between',flexWrap:'wrap'}},
              h('div',null,
                h('div',{style:{fontSize:11,letterSpacing:'0.13em',color:hue}},'DEEPSEEK HARNESS / HUD'),
                h('h1',{style:{fontSize:'clamp(25px,3vw,40px)',fontWeight:620,
                  letterSpacing:'-0.035em',margin:'8px 0 0'}},t('workspaceTitle'))),
              h('div',{style:{display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}},
                h('time',{style:{fontSize:24,letterSpacing:'-0.02em'},'data-hud-clock':true},clock),
                pill(t('returnDSH'),onExit,true,{'data-hud-exit':true}))),
            h('section',{style:{...panel,padding:'clamp(22px,3vw,38px)',
              background:'linear-gradient(110deg, rgba(23,67,80,.9),rgba(9,31,46,.9))'}},
              h('div',{style:{display:'flex',gap:11,alignItems:'center'}},
                h('span',{style:{width:8,height:8,borderRadius:'50%',
                  background:active>0?'#6ce0ba':hue,display:'inline-block'}}),
                h('span',{style:{fontSize:12,color:hue,letterSpacing:'0.12em'}},
                  t('liveStatus'))),
              h('h2',{style:{fontSize:'clamp(25px,3vw,38px)',lineHeight:1.2,
                margin:'18px 0 12px',fontWeight:590}},t('heroTitle')),
              h('div',{style:{fontSize:14,color:'#c1d6df',lineHeight:1.7,
                maxWidth:650}},t('heroHelp'))),
            h('div',{style:{display:'flex',flexWrap:'wrap',gap:15}},
              metric(t('sessionCount'),String(rows.length),t('fromDSH')),
              metric(t('runningCount'),String(active),t('realtime')),
              metric(t('viewMode'),'HUD',t('switchable'))),
            h('div',{style:{display:'grid',
              gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,320px),1fr))',gap:18}},
              h('section',{style:{...panel,padding:'20px 23px',minHeight:195}},
                h('div',{style:{fontSize:12,color:hue,letterSpacing:'.10em'}},
                  tab==='overview'?t('currentSession'):t('sessionTab')),
                h('h3',{style:{fontSize:21,margin:'18px 0 9px',fontWeight:560}},
                  selected?.title || (rows.length?t('noCurrent'):t('noSessions'))),
                h('p',{style:{color:muted,fontSize:13,lineHeight:1.65,
                  maxWidth:510,margin:'0 0 18px'}},
                  tab==='overview'?t('currentHelp'):t('sessionsHelp')),
                pill(t('openConversation'),onExit,false,
                  {'data-hud-open-conversation':true})),
              h('section',{style:{...panel,padding:'20px 23px',minHeight:195}},
                h('div',{style:{display:'flex',alignItems:'center',
                  justifyContent:'space-between',gap:12}},
                  h('h3',{style:{fontSize:16,fontWeight:570,margin:0}},
                    tab==='overview'?t('recentSessions'):t('allSessions')),
                  h('span',{style:{color:muted,fontSize:11}},String(rows.length))),
                rows.length?h('div',{style:{marginTop:8}},...rows.slice(0,tab==='overview'?5:12).map(sessionRow)):
                  h('p',{style:{color:muted,fontSize:13,marginTop:21}},
                    t('noSessions')))),
            h('footer',{style:{marginTop:'auto',borderTop:'1px solid rgba(141,222,225,.15)',
              paddingTop:20,display:'flex',gap:16,flexWrap:'wrap',
              alignItems:'center',justifyContent:'space-between'}},
              h('span',{style:{fontSize:12,color:muted}},t('readOnlyBoundary')),
              h('span',{style:{fontSize:11,color:hue}},'HUD '+VERSION+' · '+t('previewStatus'))),
            error?h('div',{role:'alert',style:{color:'#ffb5b5',fontSize:13}},error):null)));
    }

    function makeOverlay(ctx, form) {
      return function Overlay({ t, useSessions, useSessionStatus }) {
        const config = React.useSyncExternalStore(
          notify => form.subscribe(notify),
          () => form.getSnapshot(), () => form.getSnapshot());
        const [error,setError] = React.useState('');
        const values = config.value || {};
        const sessions = useSessions(x => x) || {ids:[],byId:{}};
        const statuses = useSessionStatus(x => x) || new Map();
        const isHud = values.hudMode === true;
        const setMode = async enabled => {
          setError('');
          try {
            const ok = await form.set('hudMode',enabled);
            if (ok === false) throw new Error('HUD config is unavailable');
            return true;
          } catch { setError(t('modeFailed')); return false; }
        };
        const showDSH = () => {
          void (async () => {
            if (!(await setMode(false))) return;
            try { ctx.layout.selectPanel(null); } catch { /* Keep DSH visible. */ }
          })();
        };
        const showComponents = () => {
          void (async () => {
            if (!(await setMode(false))) return;
            try { ctx.layout.selectPanel(PANEL); }
            catch { setError(t('modeFailed')); }
          })();
        };
        if (isHud) {
          return h(HudWorkspace,{t,sessions,statuses,onExit:showDSH,
            onComponents:showComponents,error});
        }
        const children = [];
        if (values.overlayVisible === true) {
          const ids = sessions.ids || [], selected = Object.values(sessions.byId || {})
            .find(row => (row.retainedBy?.mainView || 0) > 0);
          let running = 0;
          for (const id of ids) {
            if ((statuses.get(id)?.running ?? sessions.byId[id]?.running) === true) running++;
          }
          children.push(h('div', {
            key:'preview','data-dsh-hud-preview':'true',
            'data-dsh-hud-version':VERSION,
            style:{position:'absolute',inset:0,background:'transparent',
              overflow:'hidden',pointerEvents:'none'}
          },
            h(OverlayLabel,{title:t('panel'),body:t('current')+': '+
              (selected?.displayTitle || '—'),side:{top:90,left:365}}),
            h(OverlayLabel,{title:t('section'),body:ids.length+' · '+running,
              side:{top:90,right:32,textAlign:'right'}}),
            h(OverlayLabel,{title:'DSH',body:t('noToken'),
              side:{right:32,bottom:128,textAlign:'right'}})));
        }
        children.push(h('button',{key:'switcher',type:'button',
          'data-dsh-hud-switcher':true,'aria-label':t('enterHud'),
          onClick:()=>{void setMode(true);},
          style:{position:'absolute',top:76,right:16,zIndex:31,
            pointerEvents:'auto',fontFamily:'system-ui,sans-serif',fontSize:12,
            fontWeight:650,letterSpacing:'.08em',padding:'9px 13px',
            borderRadius:999,color:'#c8f7f1',border:'1px solid rgba(118,221,213,.35)',
            background:'rgba(12,34,45,.82)',boxShadow:'0 5px 14px rgba(0,0,0,.16)',
            cursor:'pointer'}},'↗ HUD'));
        if (error) children.push(h('div',{key:'error',role:'alert',
          style:{position:'absolute',top:118,right:16,
            color:'#efb2b2',background:'#2f181e',fontSize:12,padding:9,
            borderRadius:8,pointerEvents:'auto'}},error));
        return h(React.Fragment,null,...children);
      };
    }

    function HudIcon({ size }) {
      const edge = size || 20;
      return h('svg', { width: edge, height: edge, viewBox: '0 0 24 24',
        fill: 'none', stroke: 'currentColor', strokeWidth: 1.7,
        strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
      h('rect', { x: 3.5, y: 4.5, width: 17, height: 15, rx: 3 }),
      h('path', { d: 'M7 12h2.6l1.6-3 2 6 1.5-3H17' }));
    }

    function makeMainPage(ctx, form) {
      return function HudMain({ t }) {
        const snapshot = React.useSyncExternalStore(
          cb => form.subscribe(cb),
          () => form.getSnapshot(), () => form.getSnapshot());
        const [bundles, setBundles] = React.useState([]);
        const [confirm, setConfirm] = React.useState('');
        const [saving, setSaving] = React.useState(false);
        const [error, setError] = React.useState('');
        React.useEffect(() => {
          let alive = true;
          async function refreshInstalled() {
            try {
              const response = await ctx.remote.pluginManager.listBundles();
              if (alive && response.ok && Array.isArray(response.value)) setBundles(response.value);
            } catch { /* Missing Host inventory must not fabricate installations. */ }
          }
          void refreshInstalled();
          const timer = setInterval(() => { void refreshInstalled(); }, REFRESH_MS);
          return () => { alive = false; clearInterval(timer); };
        }, []);

        const values = snapshot.value || {};
        const catalog = parseCatalog(values.catalog);
        const known = [...catalog.components];
        if (!known.some(x => x.name === '@local/dsh-hud')) {
          known.unshift({ id: 'hud', name:'@local/dsh-hud', title:'DSH HUD',
            description:'DSH HUD · OttoBlues/dsh-hud-plugin component center', released:null, unstable:null });
        }
        const installedByName = new Map(bundles.filter(x => x.installed).map(x => [x.name,x]));
        if (!installedByName.has('@local/dsh-hud')) {
          installedByName.set('@local/dsh-hud', { name:'@local/dsh-hud',
            installed:true, version:VERSION });
        }
        const surface = { padding: '18px 20px', borderRadius: 12,
          border:'1px solid rgba(110,125,145,.18)', marginTop: 13 };
        const tiny = { fontSize: 12, color:'var(--text-secondary, #777)' };
        const subtle = { fontSize: 13, opacity: .7 };
        const actionStyle = disabled => ({
          borderRadius: 8, padding: '8px 16px', fontSize: 13,
          border: '1px solid rgba(100,110,120,.24)',
          color:'inherit', background:'transparent',
          cursor:disabled?'not-allowed':'pointer', opacity:disabled?.5:1,
        });
        const btn = (label,onClick,disabled=false) =>
          h('button',{type:'button',onClick,disabled,style:actionStyle(disabled)},label);
        const toggle = (label,help,checked,change,disabled=false,dataName) =>
          h('div',{style:{padding:'12px 0',opacity:disabled?.55:1}},
            h('label',{style:{display:'flex',gap:11,alignItems:'center',fontSize:14,cursor:'pointer'}},
              h('input',{type:'checkbox',checked:checked===true,disabled,
                'data-hud-setting': dataName,
                onChange:e=>{void change(e.target.checked);}}),
              label),
            h('div',{style:{...tiny,marginLeft:27,marginTop:5}},help));
        const queue = async (component,candidate) => {
          setSaving(true); setError('');
          try {
            const result = await form.mutate([
              {op:'set',path:['requestComponent'],value:component.name},
              {op:'set',path:['requestVersion'],value:candidate.version},
              {op:'set',path:['requestChannel'],value:candidate.channel},
              {op:'set',path:['requestNonce'],value:String(Date.now())},
              {op:'set',path:['updateStatus'],value:'queued'},
            ]);
            if (!result) setError(t('failed'));
            else setConfirm('');
          } catch { setError(t('failed')); }
          finally {setSaving(false);}
        };

        return h('main',{'data-dsh-hud-main':true,
          style:{boxSizing:'border-box',overflowY:'auto',height:'100%',
            padding:'36px max(28px, 4vw) 70px',fontFamily:'system-ui,sans-serif',
            color:'inherit',width:'100%'}},
        h('div',{style:{maxWidth:940,margin:'0 auto'}},
          h('div',{style:{display:'flex',gap:16,alignItems:'center',
            justifyContent:'space-between',flexWrap:'wrap'}},
            h('h1',{style:{fontSize:25,margin:'0 0 7px',fontWeight:650}},t('title')),
            h('button',{type:'button','data-hud-enter-mode':true,
              onClick:()=>{void form.set('hudMode',true);},
              style:{fontSize:13,borderRadius:10,padding:'10px 16px',
                background:'#133a47',color:'#d6fff8',border:'1px solid #589f9d',
                cursor:'pointer'}},t('enterHud'))),
          h('p',{style:{...subtle,margin:0}},t('sub')),
          h('div',{style:{marginTop:24,fontSize:12,opacity:.7},
            'data-hud-source':catalog.source,role:'status'},
            catalog.source === 'public'?t('sourceOK'):
              catalog.source==='checking'?t('sourceChecking'):t('sourceUnavailable')),

          h('section',{style:{marginTop:30}},
            h('h2',{style:{fontSize:18,margin:0}},t('section')),
            ...known.map(component=>{
              const installed = installedByName.get(component.name);
              const current = installed?.version || null;
              const stable = component.released || null;
              const experimental = values.allowUnstable === true ? component.unstable || null : null;
              const latest = experimental && (!stable || newer(experimental.version,stable.version))
                ? experimental : stable;
              const eligible = latest && newer(latest.version,current);
              const key = component.name + ':' + (latest?.version || '');
              const isPending = values.requestComponent === component.name &&
                values.requestVersion === latest?.version &&
                (values.updateStatus === 'queued' || values.updateStatus === 'installing') &&
                !!values.requestNonce;
              const rightAction = isPending
                ? h('span',{role:'status',style:tiny},
                    t(values.updateStatus==='installing'?'installing':'queued'))
                : eligible
                  ? confirm===key
                    ? h(React.Fragment,null,
                        h('span',{style:{...tiny,maxWidth:245}},t('confirmText')),
                        btn(t('cancel'),()=>setConfirm(''),saving),
                        btn(t('confirm'),()=>{void queue(component,latest);},saving))
                    : btn(installed?t('update'):t('install'),()=>setConfirm(key),saving)
                  : h('span',{style:tiny},latest?t('latest'):t('unavailable'));
              return h('div',{key:component.name,style:surface,
                'data-hud-component':component.name},
                h('div',{style:{display:'flex',gap:15,alignItems:'center',
                  justifyContent:'space-between',flexWrap:'wrap'}},
                  h('div',{style:{flex:'1 1 300px',minWidth:175}},
                    h('div',{style:{display:'flex',alignItems:'center',gap:9}},
                      h('strong',{style:{fontSize:15}},component.title),
                      h('span',{style:tiny},installed?t('installed'):t('notInstalled'))),
                    h('p',{style:{...tiny,margin:'5px 0 9px'}},component.description),
                    h('div',{style:tiny},
                      t('current')+': '+(current||'—')+
                      '   ·   '+t('released')+': '+(stable?.version||'—')+
                      (values.allowUnstable===true?
                        '   ·   '+t('unstable')+': '+(experimental?.version||'—'):''))
                  ),
                  h('div',{style:{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}},
                    rightAction)
                )
              );
            }),
            known.length===0?h('p',{style:tiny},t('noComponents')):null
          ),

          h('section',{style:{marginTop:36}},
            h('h2',{style:{fontSize:18,margin:'0 0 4px'}},t('options')),
            h('div',{style:surface},
              toggle(t('allowUnstable'),t('allowUnstableHelp'),values.allowUnstable,
                async value=>{
                  await form.mutate([{op:'set',path:['allowUnstable'],value},
                    ...(value?[]:[{op:'set',path:['autoUpdateUnstable'],value:false}])]);
                },false,'unstable'),
              toggle(t('autoUpdate'),t('autoUpdateHelp'),values.autoUpdateEnabled,
                value=>form.set('autoUpdateEnabled',value),false,'auto'),
              toggle(t('autoUnstable'),t('autoUnstableHelp'),values.autoUpdateUnstable,
                value=>form.set('autoUpdateUnstable',value),
                values.allowUnstable!==true || values.autoUpdateEnabled!==true,'auto-unstable'),
              toggle(t('preview'),t('previewHelp'),values.overlayVisible,
                value=>form.set('overlayVisible',value),false,'preview')
            )
          ),
          error?h('p',{role:'alert',style:{color:'#b84b4b'}},error):null,
          values.updateStatus==='failed'?h('p',{role:'alert',style:{color:'#b84b4b'}},t('failed')):
          values.updateStatus==='restart-required'?h('p',{role:'status'},t('restart')):
          values.updateStatus==='installed'?h('p',{role:'status'},t('succeeded')):null,
          h('p',{style:{...tiny,marginTop:25}},t('noToken'))
        ));
      };
    }

    return {
      inject: ['slots','locale','layout','uiSession','configForms','remote','remote.pluginManager'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS,dictionaries),'hud: locale');
        const form = ctx.configForms.get('dsh-hud');
        ctx.slots.inject('shell.overlay',() => ctx.slots.register({
          name:'shell.overlay',id:'dsh-hud.preview',order:100,locale:NS,
        },makeOverlay(ctx,form)));

        // This is a *DSH plugin panel*, not a 'plugins.tab' child.
        ctx.slots.inject('main',()=>ctx.slots.register({
          name:'main',key:PANEL,id:PANEL,locale:NS,
        },makeMainPage(ctx,form)));
        ctx.slots.inject('sidebar.panellist',()=>ctx.slots.register({
          name:'sidebar.panellist',id:PANEL,order:5,locale:NS,
          label:()=>ctx.locale.bind(NS)('panel'),
        },HudIcon));
      },
    };
  },
});
