/**
 * DSH HUD V0.5.1 development Client: vector-interface HUD and manual refresh.
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
    const VERSION = '0.5.1';
    const REFRESH_MS = 5 * 60_000;

    const dictionaries = {
      zh: {
        workspaceTitle:'HUD 工作台',workspaceNav:'HUD 导航',overview:'总览',sessionTab:'会话',
        enterHud:'进入 HUD 模式',returnDSH:'返回 DSH',componentCenter:'组件中心',
        liveStatus:'信号接入 / 实时状态',heroTitle:'任务态势中心',heroHelp:'HUD 正从 DSH 的真实会话中读取运行态势。核心命令、对话与授权仍由原生 DSH 执行。',
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
        checkNow:'检查更新',checkingNow:'扫描版本源…',checkIdle:'手动触发云端版本扫描',
        checkSuccess:'版本检查完成',checkPartial:'部分通道检查不完整',checkFailed:'版本检查失败',
        checkAt:'检查时间',checkCanonical:'当前源：dsh-hud-plugin',checkLegacy:'当前源：旧地址兼容',
        checkTip:'仅重新读取公开组件索引与发布清单，不安装任何版本。',
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
        liveStatus:'LIVE SIGNAL / SESSION LINK',heroTitle:'MISSION CONTROL',
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
        checkNow:'Check updates',checkingNow:'Scanning channels…',checkIdle:'Check public channels now',
        checkSuccess:'Update check completed',checkPartial:'Some release channels could not be checked',
        checkFailed:'Update check failed',checkAt:'Checked at',checkCanonical:'Source: dsh-hud-plugin',
        checkLegacy:'Source: legacy compatibility',checkTip:'Read public release manifests now; no installation is triggered.',
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

    // Shared line-built panel treatment: no image assets, no invented status data.
    // Vector corner paths are decorative and cannot intercept input.
    const V = {
      cyan:'#77f5f0', electric:'#7dbfe4', amber:'#f1d59b',
      text:'#e8faff', muted:'#95b5c4', stroke:'rgba(105,235,242,.34)',
      inner:'rgba(5,21,32,.92)',
      cut:'polygon(13px 0,calc(100% - 13px) 0,100% 13px,100% calc(100% - 13px),calc(100% - 13px) 100%,13px 100%,0 calc(100% - 13px),0 13px)',
      background:'linear-gradient(rgba(83,216,231,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(83,216,231,.045) 1px,transparent 1px),radial-gradient(ellipse at 74% 16%,rgba(17,78,100,.55),transparent 55%),linear-gradient(145deg,#030c15,#081927 65%,#081721)',
      backgroundSize:'38px 38px,38px 38px,auto,auto',
    };
    function vectorTraces() {
      return h('svg',{'aria-hidden':true,'data-hud-traces':true,
        viewBox:'0 0 100 100',preserveAspectRatio:'none',
        style:{position:'absolute',inset:0,width:'100%',height:'100%',
          pointerEvents:'none',zIndex:0,overflow:'hidden'}},
        h('path',{d:'M 0 20 V 13 L 13 0 H 32 M 68 0 H 87 L 100 13 V 28 M 100 72 V 87 L 87 100 H 68 M 32 100 H 13 L 0 87 V 72',
          fill:'none',stroke:'rgba(119,245,240,.76)',strokeWidth:1.3,
          vectorEffect:'non-scaling-stroke'}),
        h('path',{d:'M 18 0 H 37 M 63 100 H 82 M 0 38 V 49 M 100 51 V 62',
          fill:'none',stroke:'rgba(125,191,228,.55)',strokeWidth:1,
          vectorEffect:'non-scaling-stroke'}));
    }
    function vectorFrame(tag, attributes, ...children) {
      return h(tag,{...attributes,'data-hud-vector-frame':true,
        style:{
          position:'relative',overflow:'hidden',borderRadius:0,
          clipPath:V.cut,border:'1px solid '+V.stroke,
          background:'linear-gradient(130deg,rgba(13,37,52,.95),'+V.inner+')',
          boxShadow:'inset 0 1px 0 rgba(131,236,241,.16),0 12px 35px rgba(0,4,14,.15)',
          ...attributes.style,
        }},
        vectorTraces(),
        ...children);
    }
    function scopeLines() {
      return h('svg',{'aria-hidden':true,'data-hud-scope':true,
        viewBox:'0 0 240 165',width:240,height:165,
        style:{position:'absolute',right:10,top:9,opacity:.25,pointerEvents:'none'}},
        h('circle',{cx:121,cy:82,r:57,stroke:V.cyan,fill:'none',strokeWidth:1}),
        h('circle',{cx:121,cy:82,r:35,stroke:V.electric,fill:'none',strokeWidth:1}),
        h('path',{d:'M 121 10 V 155 M 49 82 H 193 M 70 31 L 172 133 M 174 31 L 71 134',
          stroke:V.cyan,strokeWidth:0.8,fill:'none'}),
        h('path',{d:'M 121 82 L 169 49 M 118 78 H 124 V 86 H 118 Z',
          stroke:V.amber,strokeWidth:2,fill:'none'}));
    }

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
      const hue = V.cyan, muted = V.muted;
      const outline = '1px solid '+V.stroke;
      const panel = {background:'linear-gradient(115deg,rgba(8,36,49,.95),rgba(3,17,28,.93))',
        border:outline,boxShadow:'inset 0 0 20px rgba(18,78,103,.18)'};
      const pill = (label,onClick,primary=false, extra={}) => h('button',{
        type:'button',onClick,...extra,style:{font:'inherit',fontSize:13,fontWeight:600,
          color:primary?'#021921':V.text,
          background:primary?'linear-gradient(90deg,#58d9e4,#9ef7eb)':'rgba(8,43,56,.55)',
          border:primary?'1px solid rgba(130,250,247,.85)':outline,borderRadius:0,
          clipPath:'polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,10px 100%,0 calc(100% - 10px))',
          boxShadow:primary?'0 0 15px rgba(101,239,235,.20)':'inset 0 0 12px rgba(77,199,209,.1)',
          letterSpacing:'.06em',padding:'11px 17px',cursor:'pointer',minHeight:42,...extra.style}},label);
      const metric = (key,value,foot) => vectorFrame('div',{key,
        style:{...panel,padding:'18px 23px',minWidth:140,flex:'1 1 150px'}},
        h('div',{style:{fontSize:10,color:hue,letterSpacing:'.16em',
          fontFamily:'Consolas,monospace'}},'// '+key),
        h('strong',{style:{display:'block',fontSize:33,marginTop:12,
          fontWeight:600,fontVariantNumeric:'tabular-nums',letterSpacing:'.04em'}},value),
        h('div',{style:{height:1,width:48,background:V.cyan,margin:'9px 0 8px',opacity:.65}}),
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
          backgroundColor:'#030c15',backgroundImage:V.background,
          backgroundSize:V.backgroundSize,
          color:V.text,fontFamily:'system-ui, sans-serif',
          pointerEvents:'auto',overflowY:'auto',overflowX:'hidden'}},
        h('div',{style:{maxWidth:1640,margin:'0 auto',
          padding:'30px clamp(16px,3vw,52px) 40px',boxSizing:'border-box',
          minHeight:'100%',display:'flex',flexWrap:'wrap',gap:25}},
          h('nav',{'aria-label':t('workspaceNav'),
            style:{width:176,flex:'1 1 155px',maxWidth:185,display:'flex',flexDirection:'column',
              gap:12,borderRight:'1px solid rgba(141,222,225,.24)',paddingRight:18}},
            h('div',{style:{padding:'4px 7px 29px'}},
              h('div',{style:{fontSize:29,fontWeight:800,letterSpacing:'.20em',
                color:hue,textShadow:'0 0 14px rgba(98,239,242,.3)'}},'HUD'),
              h('div',{style:{height:1,background:'linear-gradient(90deg,#65e9ef,transparent)',
                margin:'13px 0 8px'}}),
              h('div',{style:{fontSize:9,color:muted,letterSpacing:'.14em',
                fontFamily:'Consolas,monospace'}},'VECTOR / INTERFACE')),
            pill(t('overview'),()=>setTab('overview'),tab==='overview',
              {'data-hud-tab':'overview'}),
            pill(t('sessionTab'),()=>setTab('sessions'),tab==='sessions',
              {'data-hud-tab':'sessions'}),
            pill(t('componentCenter'),onComponents,false,
              {'data-hud-nav':'components'}),
            h('div',{style:{marginTop:'auto',paddingTop:35}},
              pill(t('returnDSH'),onExit,false,{'data-hud-nav':'dsh',
                style:{width:'100%'}}))),
          h('div',{style:{flex:'5 1 460px',minWidth:0,display:'flex',flexDirection:'column',gap:20}},
            h('div',{'data-hud-vector-scanline':true,
              style:{height:2,width:'100%',
                background:'linear-gradient(90deg,#6ce9ea 0%,#6ce9ea 17%,transparent 17%,transparent 21%,rgba(108,233,234,.5) 21%,rgba(108,233,234,.5) 48%,transparent 48%)'}}),
            h('header',{style:{display:'flex',alignItems:'center',gap:16,
              justifyContent:'space-between',flexWrap:'wrap'}},
              h('div',null,
                h('div',{style:{fontSize:11,letterSpacing:'.18em',color:hue,
                  fontFamily:'Consolas,monospace'}},'DSH // VECTOR INTERFACE / 05'),
                h('h1',{style:{fontSize:'clamp(25px,3vw,40px)',fontWeight:620,
                  letterSpacing:'-0.035em',margin:'8px 0 0'}},t('workspaceTitle'))),
              h('div',{style:{display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}},
                h('time',{style:{fontSize:25,letterSpacing:'.05em',
                  fontFamily:'Consolas,monospace',color:hue},'data-hud-clock':true},clock),
                pill(t('returnDSH'),onExit,true,{'data-hud-exit':true}))),
            vectorFrame('section',{style:{...panel,padding:'clamp(23px,3vw,42px)',
              background:'linear-gradient(110deg, rgba(8,42,56,.94),rgba(2,19,30,.96))'}},
              scopeLines(),
              h('div',{style:{display:'flex',gap:11,alignItems:'center'}},
                h('span',{style:{width:8,height:8,borderRadius:'50%',
                  background:active>0?'#6ce0ba':hue,display:'inline-block'}}),
                h('span',{style:{fontSize:12,color:hue,letterSpacing:'0.12em'}},
                  t('liveStatus'))),
              h('h2',{style:{fontSize:'clamp(26px,3.1vw,41px)',lineHeight:1.2,
                margin:'22px 0 12px',fontWeight:580,position:'relative',
                textShadow:'0 0 12px rgba(88,220,235,.14)'}},t('heroTitle')),
              h('div',{style:{fontSize:14,color:'#c1d6df',lineHeight:1.7,
                maxWidth:650}},t('heroHelp'))),
            h('div',{style:{display:'flex',flexWrap:'wrap',gap:15}},
              metric(t('sessionCount'),String(rows.length),t('fromDSH')),
              metric(t('runningCount'),String(active),t('realtime')),
              metric(t('viewMode'),'HUD',t('switchable'))),
            h('div',{style:{display:'grid',
              gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,320px),1fr))',gap:18}},
              vectorFrame('section',{style:{...panel,padding:'22px 25px',minHeight:195}},
                h('div',{style:{fontSize:12,color:hue,letterSpacing:'.10em'}},
                  tab==='overview'?t('currentSession'):t('sessionTab')),
                h('h3',{style:{fontSize:21,margin:'18px 0 9px',fontWeight:560}},
                  selected?.title || (rows.length?t('noCurrent'):t('noSessions'))),
                h('p',{style:{color:muted,fontSize:13,lineHeight:1.65,
                  maxWidth:510,margin:'0 0 18px'}},
                  tab==='overview'?t('currentHelp'):t('sessionsHelp')),
                pill(t('openConversation'),onExit,false,
                  {'data-hud-open-conversation':true})),
              vectorFrame('section',{style:{...panel,padding:'22px 25px',minHeight:195}},
                h('div',{style:{display:'flex',alignItems:'center',
                  justifyContent:'space-between',gap:12}},
                  h('h3',{style:{fontSize:16,fontWeight:570,margin:0,color:hue}},
                    tab==='overview'?t('recentSessions'):t('allSessions')),
                  h('span',{style:{color:muted,fontSize:11}},String(rows.length))),
                rows.length?h('div',{style:{marginTop:8}},...rows.slice(0,tab==='overview'?5:12).map(sessionRow)):
                  h('p',{style:{color:muted,fontSize:13,marginTop:21}},
                    t('noSessions')))),
            h('footer',{style:{marginTop:'auto',borderTop:'1px solid rgba(141,222,225,.15)',
              paddingTop:20,display:'flex',gap:16,flexWrap:'wrap',
              alignItems:'center',justifyContent:'space-between'}},
              h('span',{style:{fontSize:12,color:muted}},t('readOnlyBoundary')),
              h('span',{style:{fontSize:11,color:hue,
                fontFamily:'Consolas,monospace',letterSpacing:'.08em'}},
                'HUD // '+VERSION+'  ·  '+t('previewStatus'))),
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
        const [requestingCheck, setRequestingCheck] = React.useState(false);
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
        const surface = {padding:'22px 25px',border:'1px solid '+V.stroke,
          background:'linear-gradient(125deg,rgba(11,35,48,.97),rgba(4,20,32,.96))',
          marginTop:16,boxShadow:'inset 0 0 18px rgba(23,82,96,.12)'};
        const tiny = {fontSize:12,color:V.muted};
        const subtle = {fontSize:13,color:V.muted,letterSpacing:'.025em'};
        const actionStyle = disabled => ({
          borderRadius:0,clipPath:V.cut,padding:'10px 18px',fontSize:13,
          border:'1px solid '+V.stroke,fontFamily:'inherit',letterSpacing:'.04em',
          color:V.cyan,background:'rgba(10,55,69,.48)',
          cursor:disabled?'not-allowed':'pointer',opacity:disabled?.5:1,
        });
        const btn = (label,onClick,disabled=false) =>
          h('button',{type:'button',onClick,disabled,style:actionStyle(disabled)},label);
        const toggle = (label,help,checked,change,disabled=false,dataName) =>
          h('div',{style:{padding:'12px 0',opacity:disabled?.55:1}},
            h('label',{style:{display:'flex',gap:11,alignItems:'center',fontSize:14,cursor:'pointer'}},
              h('input',{type:'checkbox',checked:checked===true,disabled,
                'data-hud-setting':dataName,style:{accentColor:V.cyan,width:16,height:16},
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


        const checkState = values.checkState || 'idle';
        const busyCheck = requestingCheck || !!values.checkNonce || checkState === 'checking';
        const lastChecked = typeof values.checkAt === 'string' && !Number.isNaN(Date.parse(values.checkAt))
          ? new Date(values.checkAt).toLocaleTimeString(undefined,
              {hour:'2-digit',minute:'2-digit',second:'2-digit'}) : '';
        const requestCheck = async () => {
          if (busyCheck) return;
          setRequestingCheck(true);setError('');
          try {
            const accepted = await form.mutate([
              {op:'set',path:['checkNonce'],value:String(Date.now())+'-'+Math.random().toString(36).slice(2)},
              {op:'set',path:['checkState'],value:'checking'},
              {op:'set',path:['checkError'],value:''},
            ]);
            if (accepted === false) throw new Error('The update check request was rejected.');
          } catch {
            setError(t('checkFailed'));
          } finally {
            setRequestingCheck(false);
          }
        };
        const checkLabel = checkState === 'checking' ? t('checkingNow')
          : checkState === 'success' ? t('checkSuccess')
          : checkState === 'partial' ? t('checkPartial')
          : checkState === 'failed' ? t('checkFailed') : t('checkIdle');
        const originLabel = values.checkOrigin === 'canonical' ? t('checkCanonical')
          : values.checkOrigin === 'legacy' ? t('checkLegacy') : '';

        return h('main',{'data-dsh-hud-main':true,'data-hud-visual':'vector-051',
          style:{boxSizing:'border-box',overflowY:'auto',height:'100%',
            padding:'36px max(20px, 3vw) 70px',fontFamily:'system-ui,sans-serif',
            backgroundColor:'#030c15',backgroundImage:V.background,
            backgroundSize:V.backgroundSize,color:V.text,width:'100%'}},
        h('div',{style:{maxWidth:1120,margin:'0 auto'}},
          h('div',{style:{height:2,width:'100%',marginBottom:23,
            background:'linear-gradient(90deg,#6becef 0%,#6becef 22%,transparent 22%,transparent 28%,rgba(90,214,232,.45) 28%,transparent 92%)'}}),
          h('div',{style:{display:'flex',gap:16,alignItems:'center',
            justifyContent:'space-between',flexWrap:'wrap'}},
            h('h1',{style:{fontSize:27,margin:'0 0 7px',fontWeight:630,
              letterSpacing:'.08em',color:V.text,
              textShadow:'0 0 15px rgba(100,228,238,.17)'}},t('title')),
            h('button',{type:'button','data-hud-enter-mode':true,
              onClick:()=>{void form.set('hudMode',true);},
              style:{...actionStyle(false),fontWeight:650,
                background:'rgba(15,72,88,.74)',color:V.cyan}},t('enterHud'))),
          h('p',{style:{...subtle,margin:0}},t('sub')),
          vectorFrame('section',{'data-hud-check-panel':true,
            style:{...surface,padding:'20px 24px',marginTop:24}},
            h('div',{style:{display:'flex',gap:18,flexWrap:'wrap',
              alignItems:'center',justifyContent:'space-between'}},
              h('div',{style:{minWidth:200,flex:'1 1 330px'}},
                h('div',{style:{fontFamily:'Consolas,monospace',
                  color:V.cyan,fontSize:11,letterSpacing:'.15em'}},
                  '02 // RELEASE CHANNEL SCAN'),
                h('div',{style:{marginTop:7,fontSize:13,color:V.text},
                  'data-hud-source':catalog.source,role:'status'},
                  catalog.source === 'public'?t('sourceOK'):
                    catalog.source==='checking'?t('sourceChecking'):t('sourceUnavailable')),
                h('div',{'data-hud-check-state':checkState,role:'status',
                  style:{fontSize:12,marginTop:7,
                    color:checkState==='failed'||checkState==='partial'?V.amber:V.muted}},
                  checkLabel,
                  lastChecked?' · '+t('checkAt')+' '+lastChecked:'',
                  originLabel?' · '+originLabel:'')),
              h('button',{type:'button','data-hud-check-button':true,
                disabled:busyCheck,onClick:()=>{void requestCheck();},
                style:{...actionStyle(busyCheck),minWidth:152,
                  background:busyCheck?'rgba(18,53,64,.55)':
                    'linear-gradient(90deg,rgba(21,110,125,.85),rgba(11,69,90,.83))',
                  fontWeight:650}},
                busyCheck?t('checkingNow'):t('checkNow'))),
            h('div',{style:{...tiny,marginTop:13}},t('checkTip')),
            (checkState==='failed'||checkState==='partial') && values.checkError
              ? h('div',{role:'alert','data-hud-check-error':true,
                  style:{fontSize:12,marginTop:10,color:V.amber,
                    padding:'10px 12px',background:'rgba(80,56,22,.28)',
                    borderLeft:'2px solid '+V.amber,
                    overflowWrap:'anywhere'}},values.checkError)
              : null),

          h('section',{style:{marginTop:31}},
            h('h2',{style:{fontSize:17,margin:'0 0 10px',color:V.cyan,
              letterSpacing:'.12em'}},t('section')),
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
              return vectorFrame('div',{key:component.name,style:surface,
                'data-hud-component':component.name},
                h('div',{style:{display:'flex',gap:15,alignItems:'center',
                  justifyContent:'space-between',flexWrap:'wrap'}},
                  h('div',{style:{flex:'1 1 300px',minWidth:175}},
                    h('div',{style:{display:'flex',alignItems:'center',gap:9}},
                      h('strong',{style:{fontSize:16,color:V.text,letterSpacing:'.02em'}},component.title),
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
            h('h2',{style:{fontSize:17,margin:'0 0 9px',color:V.cyan,
              letterSpacing:'.12em'}},t('options')),
            vectorFrame('div',{style:surface},
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
          h('p',{style:{...tiny,marginTop:25,fontFamily:'Consolas,monospace',
            letterSpacing:'.03em'}},'// '+t('noToken'))
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
