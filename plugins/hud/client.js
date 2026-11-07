/**
 * DSH HUD V0.5.17: keep Windows HUD input from blocking window startup.
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
    const VERSION = '0.5.17';
    let nativeSessionSnapshot = { capturedAt:'', sessions:[] };
    // User-triggered checks do not use Host settings as a command queue.
    const REFRESH_MS = 5 * 60_000;
    const INSTALL_PENDING_KEY = 'dsh-hud-install-pending';
    const INSTALL_WAIT_MS = 90_000;
    const INSTALL_STALE_MS = 120_000;
    const POLICY_WAIT_MS = 12_000;
    const POLICY_TIMED_OUT = Symbol('policy-timeout');
    // DSH serializes mutations per form and does not expose cancellation.
    // Keep a timed-out wire call single-flight even if this page remounts.
    const policyWrites = new WeakMap();
    function readPending() {
      try {
        const raw=window.sessionStorage?.getItem(INSTALL_PENDING_KEY);
        const row=raw?JSON.parse(raw):null;
        return row && /^@local\/[a-z0-9-]+$/.test(row.name||'') &&
          /^\d+\.\d+\.\d+$/.test(row.version||'') &&
          Number.isFinite(row.startedAt) ? row : null;
      } catch { return null; }
    }
    function persistPending(row) {
      try {
        if (row) window.sessionStorage?.setItem(INSTALL_PENDING_KEY,JSON.stringify(row));
        else window.sessionStorage?.removeItem(INSTALL_PENDING_KEY);
      } catch { /* Browser restrictions do not block in-memory progress. */ }
    }
    function transportDiagnostic(error, t) {
      const detail=String(error?.message||error||'unknown').slice(0,320);
      if (/HTTP (404|405)|\/hud-native\/(open|status|prepare-install).*HTTP/i.test(detail))
        return t('hostMismatch')+' '+detail;
      return detail;
    }

    const dictionaries = {
      zh: {
        workspaceTitle:'HUD 工作台',workspaceNav:'HUD 导航',overview:'总览',sessionTab:'会话',
        enterHud:'打开独立 HUD 窗口',returnDSH:'返回 DSH',componentCenter:'组件中心',
        nativeOpening:'正在启动独立 HUD 窗口…',nativeFailed:'独立 HUD 启动失败，请确认正在使用 Windows DSH Desktop。',
        nativeTimeout:'独立 HUD 启动超时；可以点击重试。',nativeDescription:'Windows 无边框独立窗口 · 进入后隐藏 DSH · 返回时恢复 DSH',
        hostMismatch:'当前 DSH Host 未加载此版本的 HUD 服务（HTTP 405/404）。请完全退出 DSH Desktop 后重新启动；仅刷新网页不够。',
        hostVersionMismatch:'运行中的 HUD Host 与组件中心版本不一致，请完整重启 DSH 以激活更新。',
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
        sourceUnavailable:'公开仓库状态尚未确认，请检查网络并重试。',
        sourceNetworkError:'无法读取 GitHub 公开版本清单；请检查网络/CORS 并重试（不能据此认定仓库为 Private）。',
        sourceChecking: '正在读取公开组件清单…', noComponents: '当前没有可用的仓库组件',
        sourceHeading:'版本源状态',checkNow:'检查更新',checkingNow:'扫描版本源…',checkQueued:'正在查询公开 GitHub 更新源…',
        checkTimeout:'检查超时：DSH 更新服务未响应，可以点击重试并查看日志',checkIdle:'手动触发云端版本扫描',
        automaticScan:'后台检查',
        checkSuccess:'版本检查完成',checkPartial:'部分通道检查不完整',checkFailed:'版本检查失败',
        checkAt:'检查时间',checkCanonical:'当前源：dsh-hud-plugin',checkLegacy:'当前源：旧地址兼容',
        checkTip:'直接读取公开 GitHub 版本清单；不写入 DSH 配置，也不安装版本。',
        installed: '已安装', notInstalled: '未安装', current: '当前', released: '正式版',
        unstable: '试验版', notPublished: '未发布', update: '更新', install: '安装',
        latest: '已是最新', unavailable: '暂无可安装的新版本', queued: '已确认，准备安装…',
        installing: '正在校验并安装…', failed: '安装失败或未能验证版本，请查看 DSH 日志',
        restart: '已写入安装，必须重启 DSH 才能生效', succeeded: 'DSH 已确认安装版本',
        installSubmitting:'DSH 官方插件管理器正在安装…',
        installUnconfirmed:'安装结果尚未确认。请检查 DSH 插件清单或重启应用；不要重复提交同一版本。',
        installChecking:'安装调用已返回，正在核对实际版本与运行中的 Host…',
        prepareFailed:'安装包验证或提交失败：',
        legacyStale:'旧版遗留的安装队列状态已经失效；以实际安装清单为准。',
        autoAttempt:'后台自动安装已提交；请核对安装版本与 Host 状态。',
        autoFailed:'后台自动安装失败，请查看 DSH Host 日志；符合重试条件时会再次尝试。',
        autoUnconfirmed:'后台自动安装结果未确认，请先检查 DSH 插件状态，避免重复安装。',
        autoCancelled:'后台自动安装已取消，不会自动重新提交。',
        resetPending:'清除未确认记录（请先核对 DSH 插件状态）',
        confirm: '确认', cancel: '取消',
        confirmText: '只安装仓库对应通道中经过校验的 .tgz。更新期间 DSH 可能要求重启。',
        allowUnstable: '接收试验版更新', allowUnstableHelp: '默认关闭。开启后可以手动安装 unstable 中的试验包。',
        autoUpdate: '自动更新正式版', autoUpdateHelp: '默认关闭。定期检测已安装组件；仅自动安装 released 中版本更高的正式包，不自动安装新组件。',
        autoUnstable: '自动更新试验版', autoUnstableHelp: '独立的额外授权；只有同时开启上述两个选项才会自动安装 unstable 包。存在不稳定风险。',
        preview: '聊天窗口 HUD 预览', previewHelp: '默认关闭；可避免状态文字与标题栏、聊天输入区重叠。',
        noToken: '无需 GitHub Token · 仅下载公开通道中登记的安装包',
        policySaved:'更新策略已保存到 DSH 配置。',policySaving:'正在保存更新策略…',
        policyReady:'DSH 设置可写',policyNotReady:'DSH HUD 配置暂不可写，设置不会生效。',
        policyFailed:'保存更新策略失败或结果未确认：',
        policyTimeout:'更新策略保存超时，结果尚未确认。请先检查 DSH 配置；原请求结束后可重试。',
        policyPending:'上一次更新策略保存仍未结束，未重复提交；请检查 DSH 配置或重新启动 DSH。',
        policyHelp:'请检查 HUD Host 和 DSH 原生插件配置。若仍无法保存，可通过官方离线安装方式升级。',
      },
      en: {
        workspaceTitle:'HUD Workspace',workspaceNav:'HUD navigation',overview:'Overview',sessionTab:'Sessions',
        enterHud:'Open independent HUD window',returnDSH:'Return to DSH',componentCenter:'Component Center',
        nativeOpening:'Starting native HUD window…',nativeFailed:'Unable to open the HUD window. Windows DSH Desktop is required.',
        nativeTimeout:'Native HUD startup timed out; you can retry.',nativeDescription:'Frameless Windows HUD · DSH is hidden on entry and restored on return',
        hostMismatch:'The running DSH Host has not loaded this HUD service (HTTP 405/404). Completely quit and reopen DSH Desktop; refreshing the page is insufficient.',
        hostVersionMismatch:'Running HUD Host and Component Center versions differ. Restart DSH to activate the update.',
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
        sourceUnavailable:'Public source has not been verified; check the network and retry.',
        sourceNetworkError:'Could not read public GitHub metadata. Check network/CORS and retry; this does not imply the repository is private.',
        sourceChecking: 'Checking the public component index…', noComponents: 'No repository components are available',
        sourceHeading:'Repository status',checkNow:'Check updates',checkingNow:'Scanning channels…',checkQueued:'Reading public GitHub release metadata…',
        checkTimeout:'Check timed out: DSH update service did not respond. Retry or inspect logs.',checkIdle:'Check public channels now',
        automaticScan:'Background check',
        checkSuccess:'Update check completed',checkPartial:'Some release channels could not be checked',
        checkFailed:'Update check failed',checkAt:'Checked at',checkCanonical:'Source: dsh-hud-plugin',
        checkLegacy:'Source: legacy compatibility',checkTip:'Direct public GitHub metadata read, no DSH settings write or installation.',
        installed: 'Installed', notInstalled: 'Not installed', current: 'Current', released: 'Released',
        unstable: 'Unstable', notPublished: 'Not published', update: 'Update', install: 'Install',
        latest: 'Up to date', unavailable: 'No installable new version', queued: 'Update confirmed and queued…',
        installing: 'Verifying and installing…', failed: 'Install failed or version could not be verified; check DSH logs',
        restart: 'Install saved; restart DSH to activate', succeeded: 'DSH confirmed the installed version',
        installSubmitting:'Installing with the official DSH Plugin Manager…',
        installUnconfirmed:'Install status is unconfirmed. Check DSH Plugins or restart; do not resubmit the same version.',
        installChecking:'Install returned; checking actual version and running Host…',
        prepareFailed:'Archive verification or install submission failed:',
        legacyStale:'Ignoring an obsolete queued install from an older HUD; installed inventory is authoritative.',
        autoAttempt:'An automatic install was submitted; verify the installed and running Host versions.',
        autoFailed:'Automatic install failed. Check Host logs; eligible failures will be retried.',
        autoUnconfirmed:'Automatic install outcome is unconfirmed. Check DSH Plugins before retrying.',
        autoCancelled:'Automatic installation was cancelled and will not be resubmitted.',
        resetPending:'Clear unconfirmed record (check DSH Plugins first)',
        confirm: 'Confirm', cancel: 'Cancel',
        confirmText: 'Only SHA-256-verified channel packages are installed. A DSH restart may be required.',
        allowUnstable: 'Allow experimental updates', allowUnstableHelp: 'Off by default; enables manual updates from unstable.',
        autoUpdate: 'Automatic released updates', autoUpdateHelp: 'Off by default. Automatically update existing installed components from released; never installs new components.',
        autoUnstable: 'Automatically install unstable updates', autoUnstableHelp: 'Additional explicit opt-in, effective only with both options above; experimental risk.',
        preview: 'HUD chat-window preview', previewHelp: 'Off by default to avoid overlapping window chrome and chat input.',
        noToken: 'No GitHub Token · Only indexed public installable archives',
        policySaved:'Update preferences saved by DSH.',policySaving:'Saving update preferences…',
        policyReady:'DSH settings writable',policyNotReady:'HUD configuration is not writable; changes cannot take effect.',
        policyFailed:'Update preference save failed or its outcome is unconfirmed:',
        policyTimeout:'Saving update preferences timed out; the outcome is unconfirmed. Check DSH settings and retry after the original request settles.',
        policyPending:'The previous update preference save is still pending; no duplicate was submitted. Check DSH settings or restart DSH.',
        policyHelp:'Check that the HUD Host and native DSH plugin configuration are available; use the official offline installation path if needed.',
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


    // V0.5.6: a release check is a READ, not a profile configuration edit.
    // DSH configForms.mutate(...) is an authenticated settings persistence
    // operation, not an RPC transport for transient commands. Keep installs
    // in the Host; only public, fixed GitHub metadata is read here.
    const PUBLIC_ROOT = 'https://raw.githubusercontent.com/OttoBlues/dsh-hud-plugin/main/plugins';
    const VERSION_RE = /^\d+\.\d+\.\d+$/;
    const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
    const PACKAGE_RE = /^@local\/[a-z0-9][a-z0-9-]{0,63}$/;
    const HASH_RE = /^[a-f0-9]{64}$/i;
    const COMMIT_RE = /^[a-f0-9]{40}$/i;
    async function publicJson(path) {
      // path is derived only from our own fixed names or validated slugs.
      if (!/^(index\.json|[a-z0-9][a-z0-9-]{0,63}\/(unstable|released)\/index\.json)$/.test(path)) {
        throw new Error('Unsafe component index path.');
      }
      if (typeof fetch !== 'function') throw new Error('Browser fetch is unavailable.');
      const response=await fetch(PUBLIC_ROOT+'/'+path,{
        method:'GET',mode:'cors',redirect:'error',credentials:'omit',
        cache:'no-store',signal:AbortSignal.timeout(14_000),
      });
      if (!response.ok) throw new Error(path+': HTTP '+response.status);
      const body=await response.text();
      if(body.length>100_000)throw new Error(path+': index exceeded size limit.');
      return JSON.parse(body);
    }
    function publicRelease(value,component,channel){
      if(value?.schema!==1 || value.component!==component.id ||
         value.package!==component.name || value.channel!==channel ||
         !Array.isArray(value.releases) || value.releases.length>128) {
        throw new Error(component.id+'/'+channel+': invalid channel.');
      }
      if(value.latest===null && value.releases.length===0)return null;
      if(typeof value.latest!=='string'||!VERSION_RE.test(value.latest)){
        throw new Error(component.id+'/'+channel+': invalid version.');
      }
      const results=value.releases.filter(x=>x?.version===value.latest);
      if(results.length!==1)throw new Error(component.id+'/'+channel+': ambiguous latest.');
      const item=results[0],file='v'+item.version+'/local-dsh-'+component.id+'-'+item.version+'.tgz';
      if(item.file!==file||!HASH_RE.test(item.sha256||'')||
         !COMMIT_RE.test(item.sourceCommit||'')){
        throw new Error(component.id+'/'+channel+': invalid archive facts.');
      }
      if(channel==='released' &&
        (item.acceptance?.decision!=='approved'||!/^U\d{2,3}$/.test(item.acceptance?.check||''))){
        throw new Error(component.id+'/released: missing acceptance.');
      }
      if(channel==='unstable' &&
        (item.test?.result!=='success'||!/^\d+$/.test(item.test?.ciRun||''))){
        throw new Error(component.id+'/unstable: missing green CI.');
      }
      return {channel,version:item.version,file,sha256:item.sha256.toLowerCase(),
        commit:item.sourceCommit.toLowerCase()};
    }
    async function checkPublicReleases(){
      const root=await publicJson('index.json');
      if(root?.schema!==1||!Array.isArray(root.components)||root.components.length>32) {
        throw new Error('Invalid repository component index.');
      }
      const names=new Set(),ids=new Set(),problems=[];
      const components=await Promise.all(root.components.map(async component=>{
        if(!SLUG_RE.test(component?.id||'')||!PACKAGE_RE.test(component?.name||'')||
          typeof component.title!=='string'||component.title.length<1||component.title.length>90||
          typeof component.description!=='string'||component.description.length>300||
          names.has(component.name)||ids.has(component.id)){
          throw new Error('Invalid component registry row.');
        }
        names.add(component.name);ids.add(component.id);
        const results=await Promise.all(['released','unstable'].map(async channel=>{
          try { return publicRelease(await publicJson(component.id+'/'+channel+'/index.json'),
            component,channel); }
          catch(error){problems.push(component.id+'/'+channel+': '+
            String(error?.message||'request failed').slice(0,110));return null;}
        }));
        return {id:component.id,name:component.name,title:component.title,
          description:component.description,released:results[0],unstable:results[1]};
      }));
      return {catalog:JSON.stringify({schema:3,source:'public',components}),
        state:problems.length?'partial':'success',
        error:problems.join(' | ').slice(0,450)};
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


    // HUD cockpit visuals are intentionally isolated from the native DSH
    // Component Center. All angled edges use fixed CSS pixels, never a
    // stretched SVG viewport (the v0.5.1 distortion regression).
    const V = {
      cyan:'#6dcbd2',electric:'#6dcbd2',amber:'#d2af7a',
      line:'#6dcbd2',stroke:'#6dcbd2',panel:'#142b3a',
      background:'#071522',text:'#e6f1f4',muted:'#a8bdc6',
      cut:'polygon(12px 0,calc(100% - 12px) 0,100% 12px,100% calc(100% - 12px),calc(100% - 12px) 100%,12px 100%,0 calc(100% - 12px),0 12px)',
      innerCut:'polygon(11px 0,calc(100% - 11px) 0,100% 11px,100% calc(100% - 11px),calc(100% - 11px) 100%,11px 100%,0 calc(100% - 11px),0 11px)',
      outer:'#6dcbd2',inner:'#142b3a',
    };
    function cockpitPanel(tag,attributes,...children) {
      // A solid 2px metallic housing encloses a lower recessed information
      // cavity. Nested CSS cuts share a 45-degree / fixed-pixel geometry.
      // No percent-based SVG perimeter drawing; no duplicated corner paths.
      const userStyle=attributes.style||{};
      return h(tag,{...attributes,'data-hud-cockpit-panel':true,
        style:{position:'relative',isolation:'isolate',overflow:'hidden',
          borderRadius:0,boxSizing:'border-box',
          ...userStyle,clipPath:V.cut,border:0,
          background:V.outer}},
        h('span',{'aria-hidden':true,'data-hud-panel-liner':true,
          style:{position:'absolute',inset:1,clipPath:V.innerCut,
            pointerEvents:'none',background:V.panel,zIndex:0}}),
        h('div',{style:{position:'relative',zIndex:1}},...children));
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
      const panel = {background:V.panel};
      const pill = (label,onClick,primary=false, extra={}) => h('button',{
        type:'button',onClick,...extra,style:{font:'inherit',fontSize:13,fontWeight:600,
          color:primary?V.background:V.text,
          background:primary?V.line:V.panel,
          border:outline,borderRadius:0,
          clipPath:'polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,10px 100%,0 calc(100% - 10px))',
          letterSpacing:'.06em',padding:'11px 17px',cursor:'pointer',minHeight:42,...extra.style}},label);
      const metric = (key,value,foot) => cockpitPanel('div',{key,
        style:{...panel,padding:'18px 23px',minWidth:140,flex:'1 1 150px'}},
        h('div',{style:{fontSize:10,color:hue,letterSpacing:'.16em',
          fontFamily:'Consolas,monospace'}},'// '+key),
        h('strong',{style:{display:'block',fontSize:33,marginTop:12,
          fontWeight:600,fontVariantNumeric:'tabular-nums',letterSpacing:'.04em'}},value),
        h('div',{style:{height:1,width:48,background:V.line,margin:'9px 0 8px'}}),
        h('div',{style:{fontSize:12,color:muted,marginTop:5}},foot));
      const sessionRow = row => h('div',{key:row.id,'data-hud-session-id':String(row.id),
        style:{display:'flex',gap:12,alignItems:'center',justifyContent:'space-between',
          padding:'12px 0',borderBottom:'1px solid '+V.line}},
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
          backgroundColor:V.background,
          color:V.text,fontFamily:'system-ui, sans-serif',
          pointerEvents:'auto',overflowY:'auto',overflowX:'hidden'}},
        h('div',{style:{maxWidth:1640,margin:'0 auto',
          padding:'30px clamp(16px,3vw,52px) 40px',boxSizing:'border-box',
          minHeight:'100%',display:'flex',flexWrap:'wrap',gap:25}},
          h('nav',{'aria-label':t('workspaceNav'),
            style:{width:176,flex:'1 1 155px',maxWidth:185,display:'flex',flexDirection:'column',
              gap:12,borderRight:'1px solid '+V.line,padding:'18px 20px 17px 13px',
              background:V.background}} ,
            h('div',{style:{padding:'4px 7px 29px'}},
              h('div',{style:{fontSize:29,fontWeight:800,letterSpacing:'.20em',
                color:hue}},'HUD'),
              h('div',{style:{height:1,background:V.line,
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
            h('div',{'data-hud-header-rule':true,
              style:{height:1,width:'100%',
                background:V.line}}),
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
            cockpitPanel('section',{style:{...panel,padding:'clamp(23px,3vw,42px)',
              background:V.inner}},
              h('div',{style:{display:'flex',gap:11,alignItems:'center'}},
                h('span',{style:{width:8,height:8,borderRadius:'50%',
                  background:V.line,display:'inline-block'}}),
                h('span',{style:{fontSize:12,color:hue,letterSpacing:'0.12em'}},
                  t('liveStatus'))),
              h('h2',{style:{fontSize:'clamp(26px,3.1vw,41px)',lineHeight:1.2,
                margin:'22px 0 12px',fontWeight:580,position:'relative',
                textShadow:'none'}},t('heroTitle')),
              h('div',{style:{fontSize:14,color:V.muted,lineHeight:1.7,
                maxWidth:650}},t('heroHelp'))),
            h('div',{style:{display:'flex',flexWrap:'wrap',gap:15}},
              metric(t('sessionCount'),String(rows.length),t('fromDSH')),
              metric(t('runningCount'),String(active),t('realtime')),
              metric(t('viewMode'),'HUD',t('switchable'))),
            h('div',{style:{display:'grid',
              gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,320px),1fr))',gap:18}},
              cockpitPanel('section',{style:{...panel,padding:'22px 25px',minHeight:195}},
                h('div',{style:{fontSize:12,color:hue,letterSpacing:'.10em'}},
                  tab==='overview'?t('currentSession'):t('sessionTab')),
                h('h3',{style:{fontSize:21,margin:'18px 0 9px',fontWeight:560}},
                  selected?.title || (rows.length?t('noCurrent'):t('noSessions'))),
                h('p',{style:{color:muted,fontSize:13,lineHeight:1.65,
                  maxWidth:510,margin:'0 0 18px'}},
                  tab==='overview'?t('currentHelp'):t('sessionsHelp')),
                pill(t('openConversation'),onExit,false,
                  {'data-hud-open-conversation':true})),
              cockpitPanel('section',{style:{...panel,padding:'22px 25px',minHeight:195}},
                h('div',{style:{display:'flex',alignItems:'center',
                  justifyContent:'space-between',gap:12}},
                  h('h3',{style:{fontSize:16,fontWeight:570,margin:0,color:hue}},
                    tab==='overview'?t('recentSessions'):t('allSessions')),
                  h('span',{style:{color:muted,fontSize:11}},String(rows.length))),
                rows.length?h('div',{style:{marginTop:8}},...rows.slice(0,tab==='overview'?5:12).map(sessionRow)):
                  h('p',{style:{color:muted,fontSize:13,marginTop:21}},
                    t('noSessions')))),
            h('footer',{style:{marginTop:'auto',borderTop:'1px solid '+V.line,
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
        // Private, bounded, read-only data sent to the native window on entry.
        // No account credentials, conversation content, session IDs or paths.
        nativeSessionSnapshot = {
          capturedAt:new Date().toISOString(),
          sessions:(Array.isArray(sessions?.ids)?sessions.ids:[]).slice(0,16).map(id=>{
            const session=sessions?.byId?.[id] || {};
            const state=typeof statuses?.get==='function'?statuses.get(id):null;
            return {
              title:(typeof session.displayTitle==='string' && session.displayTitle.trim()
                ? session.displayTitle : t('untitledSession')).slice(0,100),
              running:(state?.running ?? session.running)===true,
            };
          }),
        };
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
        // No floating HUD launcher inside native DSH; the Component Center
        // is the sole entry point. Optional read-only preview remains safe.
        return children.length ? h(React.Fragment,null,...children) : null;
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
        const [pending,setPending] = React.useState(readPending());
        const [installNote,setInstallNote] = React.useState('');
        const [hostHealth,setHostHealth] = React.useState({status:'checking',version:'',autoState:'',autoError:'',scanAt:''});
        const [inventoryReady,setInventoryReady] = React.useState(false);
        const [now,setNow] = React.useState(Date.now());
        const installAttempt = React.useRef(false);
        const [error, setError] = React.useState('');
        const [requestingCheck, setRequestingCheck] = React.useState(false);
        const checkAttempt = React.useRef(false);
        const [policySaving,setPolicySaving] = React.useState(false);
        const [policyDraft,setPolicyDraft] = React.useState({});
        const [policyError,setPolicyError] = React.useState('');
        const [policyNotice,setPolicyNotice] = React.useState('');
        const policyAttempt = React.useRef(false);
        const [nativeLaunching,setNativeLaunching] = React.useState(false);
        const [nativeFailure,setNativeFailure] = React.useState('');
        const nativeAttempt = React.useRef(false);
        const [localCatalog,setLocalCatalog] = React.useState(null);
        const [directCheck,setDirectCheck] = React.useState({
          state:'checking',at:'',error:'',
        });
        React.useEffect(() => {
          let alive = true;
          async function refreshInstalled() {
            try {
              const response = await ctx.remote.pluginManager.listBundles();
              if (alive && response.ok && Array.isArray(response.value)) {
                setBundles(response.value);setInventoryReady(true);
              }
            } catch { /* Missing Host inventory must not fabricate installations. */ }
          }
          void refreshInstalled();
          const timer = setInterval(() => { void refreshInstalled(); }, 5_000);
          return () => { alive = false; clearInterval(timer); };
        }, []);

        React.useEffect(() => {
          let alive=true;
          const probe=async()=>{
            const controller=new AbortController();
            const timeout=setTimeout(()=>controller.abort(),4_000);
            try {
              const result=await ctx.connection.rpc.call('/api','hud-native.status',{},controller.signal);
              if (!alive) return;
              if (result?.ok && typeof result.value?.hostVersion==='string') {
                setHostHealth({status:result.value.hostVersion===VERSION?'ready':'mismatch',
                  version:result.value.hostVersion,autoState:result.value.autoState||'',
                  autoError:result.value.autoError||'',scanAt:result.value.scanAt||''});
              } else setHostHealth({status:'unavailable',version:'',autoState:'',autoError:'',scanAt:'',
                error:result?.error?.message||'Host status RPC unavailable'});
            } catch (e) {
              if (alive) setHostHealth({status:'unavailable',version:'',autoState:'',autoError:'',scanAt:'',
                error:String(e?.message||e).slice(0,220)});
            } finally {clearTimeout(timeout);}
          };
          void probe();
          const timer=setInterval(()=>{void probe();},30_000);
          return ()=>{alive=false;clearInterval(timer);};
        }, []);
        React.useEffect(()=>{
          const timer=setInterval(()=>setNow(Date.now()),4_000);
          return ()=>clearInterval(timer);
        },[]);
        React.useEffect(()=>{
          if (!pending || !inventoryReady || hostHealth.status!=='ready') return;
          const actual=bundles.find(x=>x.installed && x.name===pending.name);
          if (actual?.version===pending.version && pending.name==='@local/dsh-hud' &&
            hostHealth.version===VERSION) {
            persistPending(null);setPending(null);setInstallNote(t('succeeded'));
          } else if (actual?.version===pending.version && pending.name!=='@local/dsh-hud') {
            persistPending(null);setPending(null);setInstallNote(t('succeeded'));
          }
        },[inventoryReady,bundles,hostHealth.status,hostHealth.version,pending?.name,pending?.version]);
        const values = snapshot.value || {};
        const catalog = parseCatalog(localCatalog ?? values.catalog);
        const known = [...catalog.components];
        if (!known.some(x => x.name === '@local/dsh-hud')) {
          known.unshift({ id: 'hud', name:'@local/dsh-hud', title:'DSH HUD',
            description:'DSH HUD · OttoBlues/dsh-hud-plugin component center', released:null, unstable:null });
        }
        const installedByName = new Map(bundles.filter(x => x.installed).map(x => [x.name,x]));
        if (!inventoryReady && !installedByName.has('@local/dsh-hud')) {
          installedByName.set('@local/dsh-hud', { name:'@local/dsh-hud',
            installed:true, version:VERSION, provisional:true });
        }
        // DSH owns the component center's light/dark theme. Brand accent
        // does not replace the surrounding native management visual language.
        const surface={padding:'18px 22px',borderRadius:12,
          border:'1px solid var(--border-color,rgba(105,118,138,.22))',
          background:'var(--surface-secondary,rgba(115,131,152,.035))',
          marginTop:14};
        const tiny={fontSize:12,color:'var(--text-secondary,#777)'};
        const subtle={fontSize:13,color:'var(--text-secondary,#777)',opacity:.85};
        const actionStyle=disabled=>({
          borderRadius:8,padding:'8px 15px',fontSize:13,
          border:'1px solid var(--border-color,rgba(105,118,138,.27))',
          fontFamily:'inherit',color:'inherit',
          background:'var(--surface-primary,transparent)',
          cursor:disabled?'not-allowed':'pointer',opacity:disabled?.5:1,
        });
        const btn = (label,onClick,disabled=false) =>
          h('button',{type:'button',onClick,disabled,style:actionStyle(disabled)},label);
        const policyValue=field=>Object.prototype.hasOwnProperty.call(policyDraft,field)
          ? policyDraft[field]===true : values[field]===true;
        const writePolicy=async ops=>{
          if(policyAttempt.current)return;
          if(policyWrites.has(form)){
            setPolicyError(t('policyPending'));setPolicyNotice('');
            return;
          }
          const current=form.getSnapshot();
          if(current.writable!==true){
            setPolicyError(t('policyNotReady')+' ('+String(current.status)+
              ', writable='+String(current.writable)+') '+t('policyHelp'));
            setPolicyNotice('');
            return;
          }
          policyAttempt.current=true;
          setPolicySaving(true);setPolicyNotice('');setPolicyError('');
          const optimistic={};
          for(const op of ops)if(op.op==='set'&&op.path.length===1)optimistic[op.path[0]]=op.value;
          setPolicyDraft(previous=>({...previous,...optimistic}));
          let timer;
          try{
            const mutation=Promise.resolve().then(()=>form.mutate(ops));
            policyWrites.set(form,mutation);
            mutation.then(()=>policyWrites.delete(form),()=>policyWrites.delete(form));
            const accepted=await Promise.race([
              mutation,
              new Promise(resolve=>{timer=setTimeout(()=>resolve(POLICY_TIMED_OUT),POLICY_WAIT_MS);}),
            ]);
            if(accepted===POLICY_TIMED_OUT){setPolicyError(t('policyTimeout'));return;}
            if(accepted!==true)throw new Error('Settings mutate was not accepted by DSH Host.');
            setPolicyNotice(t('policySaved'));
          }catch(cause){
            const state=form.getSnapshot();
            setPolicyError(t('policyFailed')+' '+String(cause?.message||cause).slice(0,180)+
              ' (status='+String(state.status)+', writable='+String(state.writable)+')');
          }finally{
            clearTimeout(timer);
            setPolicyDraft({});setPolicySaving(false);policyAttempt.current=false;
          }
        };
        const toggle = (label,help,checked,change,disabled=false,dataName) =>
          h('div',{style:{padding:'12px 0',opacity:disabled?.55:1}},
            h('label',{style:{display:'flex',gap:11,alignItems:'center',fontSize:14,cursor:'pointer'}},
              h('input',{type:'checkbox',checked:checked===true,disabled,
                'data-hud-setting':dataName,style:{accentColor:'var(--accent-color,#4f9ab1)',width:16,height:16},
                onChange:e=>{void change(e.target.checked);}}),
              label),
            h('div',{style:{...tiny,marginLeft:27,marginTop:5}},help));
        const launchNativeHud = async () => {
          if (nativeAttempt.current) return;
          nativeAttempt.current = true;
          setNativeLaunching(true);
          setNativeFailure('');
          const abort = new AbortController();
          const timeout = setTimeout(() => abort.abort(), 55_000);
          try {
            // Transient RPC: never write a launch nonce into ConfigForms.
            // WPF returns READY only after the new window has rendered and
            // the correct DSH Desktop window has been hidden.
            const outcome = await ctx.connection.rpc.call('/api', 'hud-native.open', {
              snapshot:JSON.stringify(nativeSessionSnapshot),
              language:t('returnDSH')==='Return to DSH'?'en':'zh',
            }, abort.signal);
            if (!outcome?.ok) {
              const code=String(outcome?.error?.code || 'hud/no-response');
              const message=String(outcome?.error?.message || 'No Host acknowledgement');
              throw new Error(code+': '+message);
            }
            if (outcome.value?.state !== 'open') throw new Error('Host did not report native READY.');
            try { ctx.layout.selectPanel(null); } catch { /* HUD window remains usable. */ }
          } catch (cause) {
            const detail=transportDiagnostic(cause,t);
            setNativeFailure(abort.signal.aborted?t('nativeTimeout'):
              detail.startsWith(t('hostMismatch'))?detail:t('nativeFailed')+' '+detail);
          } finally {
            clearTimeout(timeout);
            nativeAttempt.current = false;
            setNativeLaunching(false);
          }
        };
        const queue = async (component,candidate) => {
          if(installAttempt.current)return;
          installAttempt.current=true;
          setSaving(true);setError('');setInstallNote('');
          let submitted=false;
          const ctrl=new AbortController();
          const timer=setTimeout(()=>ctrl.abort(),33_000);
          try {
            // Verify the indexed SHA and commit in the Host, but execute pnpm
            // in DSH's own stable Plugin Manager, outside the HUD plugin fiber.
            const prepared=await ctx.connection.rpc.call('/api','hud-native.prepare-install',{
              id:component.id,name:component.name,version:candidate.version,
              channel:candidate.channel,
            },ctrl.signal);
            if(!prepared?.ok)throw new Error(
              String(prepared?.error?.code||'hud/prepare-rejected')+': '+
              String(prepared?.error?.message||'No verified artifact received'));
            const facts=prepared.value||{};
            if(facts.name!==component.name || facts.version!==candidate.version ||
              facts.sha256!==candidate.sha256 || facts.channel!==candidate.channel ||
              typeof facts.path!=='string'||facts.path.length>1024) {
              throw new Error('Verified artifact metadata did not match the approved release.');
            }
            const record={name:component.name,version:candidate.version,
              channel:candidate.channel,startedAt:Date.now(),stage:'installing',
              requestId:'hud-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)};
            setPending(record);persistPending(record);setConfirm('');
            submitted=true;
            clearTimeout(timer);
            const installation=ctx.remote.pluginManager.installBundle(facts.path,{
              enabled:true,saveExact:true,requestId:record.requestId,
            });
            // The Client may hot-reload during the install; a lost callback
            // never means pnpm failed. Do not cancel a live DSH operation.
            let installationTimeout;
            const outcome=await Promise.race([
              installation,
              new Promise(resolve=>{
                installationTimeout=setTimeout(()=>resolve({timedOut:true}),INSTALL_WAIT_MS);
              }),
            ]);
            clearTimeout(installationTimeout);
            if(outcome?.timedOut) {
              const next={...record,stage:'unconfirmed'};
              setPending(next);persistPending(next);
              setInstallNote(t('installUnconfirmed'));
            } else if(!outcome?.ok) {
              throw new Error(String(outcome?.error?.message||'Plugin Manager did not respond'));
            } else {
              const result=outcome.value||{};
              if(result.application==='failed'||result.application==='cancelled') {
                // An authoritative Plugin Manager refusal is a FAILURE, not an
                // "unknown" install that keeps blocking future versions.
                const reason=String(result.error?.diagnostic||result.error?.code||
                  result.packageResult?.output||'Plugin Manager refused installation').slice(0,300);
                setPending(null);persistPending(null);
                setError(t('prepareFailed')+' '+reason);
                return;
              }
              if(!['applied','restart-required'].includes(result.application)) {
                throw new Error('Unknown installation outcome: '+String(result.application));
              }
              if(result.version && result.version!==candidate.version) {
                throw new Error('DSH installed an unexpected version: '+result.version);
              }
              const next={...record,stage:result.application==='restart-required'
                ?'restart-required':'verifying'};
              setPending(next);persistPending(next);
              setInstallNote(t(result.application==='restart-required'?'restart':'installChecking'));
            }
          }catch(cause){
            const message=transportDiagnostic(cause,t);
            if(submitted){
              // Install may already have committed while the old UI was
              // detached. The inventory/restart check must decide its fate.
              const next={...(readPending()||{name:component.name,version:candidate.version,
                channel:candidate.channel,startedAt:Date.now()}),stage:'unconfirmed'};
              setPending(next);persistPending(next);
              setInstallNote(t('installUnconfirmed')+' '+message);
            }else setError(t('prepareFailed')+' '+message);
          }finally{
            clearTimeout(timer);
            installAttempt.current=false;
            setSaving(false);
          }
        };

        const checkState=directCheck.state;
        const busyCheck=requestingCheck;
        const lastChecked=directCheck.at ?
          new Date(directCheck.at).toLocaleTimeString(undefined,
            {hour:'2-digit',minute:'2-digit',second:'2-digit'}) : '';
        const backgroundAt=hostHealth.scanAt||values.scanAt;
        const lastBackgroundCheck=typeof backgroundAt==='string' &&
          !Number.isNaN(Date.parse(backgroundAt)) ?
          new Date(backgroundAt).toLocaleTimeString(undefined,
            {hour:'2-digit',minute:'2-digit'}) : '';
        const requestCheck=async()=>{
          if(checkAttempt.current)return;
          checkAttempt.current=true;
          setRequestingCheck(true);
          setDirectCheck({state:'checking',at:'',error:''});
          setError('');
          try{
            const found=await checkPublicReleases();
            setLocalCatalog(found.catalog);
            setDirectCheck({state:found.state,at:new Date().toISOString(),
              error:found.error});
          }catch(error){
            // Never show a stale catalog as a freshly checked release index.
            setLocalCatalog('{"schema":3,"source":"unavailable","components":[]}');
            setDirectCheck({state:'failed',at:new Date().toISOString(),
              error:'Public GitHub read failed (network, CORS or index): '+
                String(error?.message||'unknown').slice(0,240)});
          }finally{
            checkAttempt.current=false;
            setRequestingCheck(false);
          }
        };
        // Scan publicly on mount: Host config availability must not decide
        // whether a GitHub repository can be read anonymously.
        React.useEffect(()=>{void requestCheck();},[]);
        const checkLabel=checkState==='checking'?t('checkingNow')
          :checkState==='success'?t('checkSuccess')
          :checkState==='partial'?t('checkPartial')
          :checkState==='failed'?t('checkFailed'):t('checkIdle');
        const originLabel=checkState==='idle'||checkState==='checking'?'':t('checkCanonical');

        return h('main',{'data-dsh-hud-main':true,'data-hud-management-theme':'dsh-native',
          style:{boxSizing:'border-box',overflowY:'auto',height:'100%',
            padding:'36px max(28px, 4vw) 70px',fontFamily:'system-ui,sans-serif',
            background:'transparent',color:'inherit',width:'100%'}},
        h('div',{style:{maxWidth:980,margin:'0 auto'}},
          h('div',{style:{height:3,width:40,borderRadius:3,marginBottom:18,
            background:'#6dcbd2'}}),
          h('div',{style:{display:'flex',gap:16,alignItems:'center',
            justifyContent:'space-between',flexWrap:'wrap'}},
            h('h1',{style:{fontSize:25,margin:'0 0 7px',fontWeight:650}},t('title')),
            h('button',{type:'button','data-hud-enter-mode':true,
              disabled:nativeLaunching,
              onClick:()=>{void launchNativeHud();},
              style:{...actionStyle(nativeLaunching),
                fontWeight:600,borderColor:'rgba(72,165,179,.4)',
                background:'rgba(76,171,179,.09)'}},
              nativeLaunching?t('nativeOpening'):t('enterHud'))),
          h('p',{style:{...subtle,margin:0}},t('sub')),
          h('p',{'data-hud-native-description':true,style:{...subtle,margin:'7px 0 0'}},
            t('nativeDescription')),
          nativeFailure?h('p',{role:'alert','data-hud-native-error':true,
              style:{color:'#b84b4b',marginTop:9}},nativeFailure):null,
          hostHealth.status==='unavailable'||hostHealth.status==='mismatch'
            ?h('p',{role:'alert','data-hud-host-mismatch':true,
                style:{fontSize:13,color:'#b84b4b',margin:'8px 0'}},
              hostHealth.status==='mismatch'?t('hostVersionMismatch')+
                ' ('+hostHealth.version+' / '+VERSION+')':
                t('hostMismatch')+' '+String(hostHealth.error||'').slice(0,180))
            :null,
          hostHealth.autoState==='submitted'
            ?h('p',{role:'status','data-hud-auto-state':true,style:subtle},t('autoAttempt'))
            :hostHealth.autoState==='restart-required'
              ?h('p',{role:'status','data-hud-auto-state':true,style:subtle},t('restart'))
              :hostHealth.autoState==='cancelled'
                ?h('p',{role:'status','data-hud-auto-state':true,style:subtle},t('autoCancelled'))
              :hostHealth.autoState==='failed'||hostHealth.autoState==='unconfirmed'
              ?h('p',{role:'alert','data-hud-auto-state':true,style:subtle},
                    t(hostHealth.autoState==='failed'?'autoFailed':'autoUnconfirmed')+' '+String(hostHealth.autoError||''))
                :null,
          h('section',{'data-hud-check-panel':true,
            style:{...surface,padding:'20px 24px',marginTop:24}},
            h('div',{style:{display:'flex',gap:18,flexWrap:'wrap',
              alignItems:'center',justifyContent:'space-between'}},
              h('div',{style:{minWidth:200,flex:'1 1 330px'}},
                h('div',{style:{display:'flex',alignItems:'center',gap:9,fontSize:13,fontWeight:600}},
                  h('span',{'aria-hidden':true,style:{display:'inline-block',width:6,height:6,
                    borderRadius:'50%',background:'#48a5b2'}},''),t('sourceHeading')),
                h('div',{style:{marginTop:7,fontSize:13},
                  'data-hud-source':checkState==='checking'?'checking':
                    checkState==='failed'?'failed':catalog.source,role:'status'},
                  checkState==='checking'||checkState==='idle'?t('sourceChecking'):
                    checkState==='failed'?t('sourceNetworkError'):
                      catalog.source==='public'?t('sourceOK'):t('sourceUnavailable')),
                h('div',{'data-hud-check-state':checkState,role:'status',
                  style:{fontSize:12,marginTop:7,
                    color:checkState==='failed'||checkState==='partial'?'#ad722a':'var(--text-secondary,#777)'}},
                  checkLabel,
                  lastChecked?' · '+t('checkAt')+' '+lastChecked:'',
                  originLabel?' · '+originLabel:'',
                   lastBackgroundCheck?' · '+t('automaticScan')+' '+lastBackgroundCheck:'')),
              h('button',{type:'button','data-hud-check-button':true,
                disabled:busyCheck,onClick:()=>{void requestCheck();},
                style:{...actionStyle(busyCheck),minWidth:140,fontWeight:600}},
                busyCheck?t('checkingNow'):t('checkNow'))),
            h('div',{style:{...tiny,marginTop:13}},t('checkTip')),
            (checkState==='failed'||checkState==='partial') && directCheck.error
              ? h('div',{role:'alert','data-hud-check-error':true,
                  style:{fontSize:12,marginTop:10,color:'#a06e34',
                    padding:'10px 12px',background:'rgba(165,118,54,.065)',
                    borderLeft:'2px solid #c09b5f',
                    overflowWrap:'anywhere'}},directCheck.error)
              : null),

          h('section',{style:{marginTop:31}},
            h('h2',{style:{fontSize:18,margin:'0 0 8px',fontWeight:650}},t('section')),
            ...known.map(component=>{
              const installed = installedByName.get(component.name);
              const current = installed?.version || null;
              const stable = component.released || null;
              const experimental = values.allowUnstable === true ? component.unstable || null : null;
              const latest = experimental && (!stable || newer(experimental.version,stable.version))
                ? experimental : stable;
              const eligible = latest && newer(latest.version,current);
              const key = component.name + ':' + (latest?.version || '');
              const isPending = pending?.name===component.name &&
                pending?.version===latest?.version;
              const stale=isPending && now-pending.startedAt>INSTALL_STALE_MS;
              const pendingReady=isPending && current===pending.version && !installed?.provisional;
              const rightAction = isPending && !stale && !pendingReady
                ? h('span',{role:'status','data-hud-install-pending':true,style:tiny},
                    t(pending.stage==='restart-required'?'restart':
                      pending.stage==='unconfirmed'?'installUnconfirmed':'installSubmitting'))
                : isPending && pending.stage==='restart-required'
                  ? h('span',{role:'status','data-hud-install-restart':true,style:tiny},t('restart'))
                  : isPending && stale
                    ? h('button',{type:'button','data-hud-clear-pending':true,
                        style:actionStyle(false),onClick:()=>{
                          persistPending(null);setPending(null);setInstallNote('');
                        }},t('resetPending'))
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
                      h('strong',{style:{fontSize:15,fontWeight:600}},component.title),
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
            h('h2',{style:{fontSize:18,margin:'0 0 8px',fontWeight:650}},t('options')),
            h('div',{'data-hud-policy-health':true,role:'status',
              style:{...tiny,color:snapshot.writable===true?
                'var(--text-secondary,#777)':'#b84b4b',margin:'8px 0'}},
              snapshot.writable===true?t('policyReady'):
                t('policyNotReady')+' ('+String(snapshot.status)+
                  ', writable='+String(snapshot.writable)+')'),
            policySaving?h('p',{'data-hud-policy-saving':true,role:'status',style:tiny},
              t('policySaving')):null,
            policyError?h('p',{'data-hud-policy-error':true,role:'alert',
              style:{color:'#b84b4b',fontSize:13,margin:'8px 0'}},policyError):null,
            policyNotice?h('p',{'data-hud-policy-saved':true,role:'status',style:tiny},
              policyNotice):null,
            h('div',{style:surface},
              toggle(t('allowUnstable'),t('allowUnstableHelp'),policyValue('allowUnstable'),
                value=>writePolicy([{op:'set',path:['allowUnstable'],value},
                  ...(value?[]:[{op:'set',path:['autoUpdateUnstable'],value:false}])]),
                policySaving,'unstable'),
              toggle(t('autoUpdate'),t('autoUpdateHelp'),policyValue('autoUpdateEnabled'),
                value=>writePolicy([{op:'set',path:['autoUpdateEnabled'],value}]),
                policySaving,'auto'),
              toggle(t('autoUnstable'),t('autoUnstableHelp'),policyValue('autoUpdateUnstable'),
                value=>writePolicy([{op:'set',path:['autoUpdateUnstable'],value}]),
                policySaving || !policyValue('allowUnstable') || !policyValue('autoUpdateEnabled'),
                'auto-unstable'),
              toggle(t('preview'),t('previewHelp'),policyValue('overlayVisible'),
                value=>writePolicy([{op:'set',path:['overlayVisible'],value}]),
                policySaving,'preview')
            )
          ),
          error?h('p',{role:'alert',style:{color:'#b84b4b'}},error):null,
          installNote?h('p',{role:'status','data-hud-install-note':true,
              style:{fontSize:13}},installNote):null,
          pending && now-pending.startedAt>INSTALL_STALE_MS
            ?h('p',{role:'alert','data-hud-install-stale':true,style:subtle},
                t(pending.stage==='restart-required'?'restart':'installUnconfirmed')):null,
          ['queued','installing'].includes(values.updateStatus) && values.requestNonce
            ?h('p',{role:'status','data-hud-legacy-stale':true,style:subtle},t('legacyStale')):null,
          h('p',{style:{...tiny,marginTop:25}},t('noToken'))
        ));
      };
    }

    return {
      inject: ['slots','connection','locale','layout','uiSession','configForms','remote','remote.pluginManager'],
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
