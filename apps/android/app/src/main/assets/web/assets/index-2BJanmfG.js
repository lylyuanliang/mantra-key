(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const o of document.querySelectorAll('link[rel="modulepreload"]'))s(o);new MutationObserver(o=>{for(const i of o)if(i.type==="childList")for(const n of i.addedNodes)n.tagName==="LINK"&&n.rel==="modulepreload"&&s(n)}).observe(document,{childList:!0,subtree:!0});function a(o){const i={};return o.integrity&&(i.integrity=o.integrity),o.referrerPolicy&&(i.referrerPolicy=o.referrerPolicy),o.crossOrigin==="use-credentials"?i.credentials="include":o.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function s(o){if(o.ep)return;o.ep=!0;const i=a(o);fetch(o.href,i)}})();const Q="https://ghfast.top/",X="0.1.0",H={acceleratorPrefix:Q,version:X},B="lylyuanliang/mantra-key".trim(),M=H.acceleratorPrefix.trim(),O=H.version.trim();function V(t,e){if(!t||!e)return 0;const a=n=>n.replace(/^v/i,"").trim(),s=a(t).split(".").map(n=>parseInt(n,10)||0),o=a(e).split(".").map(n=>parseInt(n,10)||0),i=Math.max(s.length,o.length);for(let n=0;n<i;n++){const d=s[n]||0,r=o[n]||0;if(r>d)return 1;if(r<d)return-1}return 0}async function Z(t){if(!t)return null;const e=[`${M}https://github.com/${B}/releases/download/${t}/SHA256SUMS.txt`,`https://github.com/${B}/releases/download/${t}/SHA256SUMS.txt`];for(const a of e)try{const s=new AbortController,o=setTimeout(()=>s.abort(),3500),i=await fetch(a,{signal:s.signal});if(clearTimeout(o),i.ok){const n=await i.text(),d={};for(const r of n.split(/\r?\n/)){const u=r.trim();if(!u||u.startsWith("#"))continue;const l=u.split(/\s+/);if(l.length>=2){const c=l[0].toLowerCase(),p=l[1].replace(/^\*/,"");d[p]=c,p.includes("release")?d.release=c:p.includes("debug")&&(d.debug=c)}}return d}}catch{}return null}async function tt(t=!1){const e=Date.now(),s=(typeof window<"u"&&window.localStorage&&(window.localStorage.getItem("af_api_base")||window.localStorage.getItem("mk_debug_tunnel_url"))||"").replace(/\/+$/,""),o=s?`${s}/version.json?t=${e}`:null,i=[o,`https://ghfast.top/https://raw.githubusercontent.com/${B}/main/public/version.json?t=${e}`,`https://raw.githubusercontent.com/${B}/main/public/version.json?t=${e}`,`https://cdn.jsdelivr.net/gh/${B}@main/public/version.json?t=${e}`,typeof window<"u"?`/version.json?t=${e}`:null].filter(Boolean);let n=null;for(const h of i)try{const m=new AbortController,N=setTimeout(()=>m.abort(),4e3),y=await fetch(h,{signal:m.signal});if(clearTimeout(N),y.ok){const g=await y.json();if(g&&(g.version||g.versionTag)&&((!n||V(n.version||n.versionTag,g.version||g.versionTag)>0)&&(n=g),h===o||h.includes("ghfast.top")||h.includes("raw.githubusercontent.com")))break}}catch{}if(!n||!n.version&&!n.versionTag)throw new Error("网络连接超时或无法解析最新版本信息");const d=n.version||n.versionTag.replace(/^v/i,""),r=n.versionTag||`v${d}`,u=n.releaseDownloadUrl||`https://github.com/${B}/releases/download/${r}/mantra-key-${r}-release.apk`,l=n.debugDownloadUrl||`https://github.com/${B}/releases/download/${r}/mantra-key-${r}-debug.apk`,c=u.startsWith("http")?`${M}${u}`:u,p=l.startsWith("http")?`${M}${l}`:l,v=t?l:u,f=t?p:c,S=t?`mantra-key-${r}-debug.apk`:`mantra-key-${r}-release.apk`;let x=(n.releaseSha256||"").trim().toLowerCase(),C=(n.debugSha256||"").trim().toLowerCase();if(!x&&!C)try{const h=await Z(r);h&&(x=h.release||h[`mantra-key-${r}-release.apk`]||"",C=h.debug||h[`mantra-key-${r}-debug.apk`]||"")}catch{}const k=t?C:x;return{version:d,versionTag:r,title:n.title||`密诀 MantraKey ${r}`,changelog:n.changelog||"常规功能优化与性能稳定性提升。",publishedAt:n.publishedAt||new Date().toLocaleDateString("zh-CN"),assetName:S,assetSizeText:n.assetSizeText||"约 15 MB",downloadUrl:f,rawDownloadUrl:v,releaseDownloadUrl:c,debugDownloadUrl:p,rawReleaseDownloadUrl:u,rawDebugDownloadUrl:l,releaseSha256:x,debugSha256:C,sha256:k,htmlUrl:`https://github.com/${B}/releases/tag/${r}`}}const K="ABCDEFGHJKLMNPQRSTUVWXYZ",W="abcdefghijkmnopqrstuvwxyz",j="23456789",et="!@#$%^&*()-_=+[]{}|;:,.<>?",T=K+W+j+et,nt=K+W+j,st="0123456789",at="mantra_key_salt_universal_2026",L={"standard-16":{name:"16位标准",length:16,charset:T,description:"字母+数字+特殊符号 (16位)"},"secure-20":{name:"20位高强",length:20,charset:T,description:"字母+数字+特殊符号 (20位)"},"super-32":{name:"32位极高安全",length:32,charset:T,description:"特权/高密凭据 (32位)"},"alphanumeric-16":{name:"16位无符号",length:16,charset:nt,description:"仅字母与数字，适配限制特殊符号的旧网站"},"pin-6":{name:"6位PIN",length:6,charset:st,description:"纯数字 6 位 PIN 码"}};async function it(t){if(!t)return"";const e=new TextEncoder,a=await crypto.subtle.digest("SHA-256",e.encode(t));return Array.from(new Uint8Array(a)).map(o=>o.toString(16).padStart(2,"0")).join("").slice(0,8).toUpperCase()}async function ot(t,e=at){const a=new TextEncoder,s=await crypto.subtle.importKey("raw",a.encode(t),{name:"PBKDF2"},!1,["deriveBits"]),o=await crypto.subtle.deriveBits({name:"PBKDF2",salt:a.encode(e),iterations:1e5,hash:"SHA-256"},s,256);return new Uint8Array(o)}function rt(t,e,a){if(!e||a<=0||t.length===0)return"";const s=e.length,o=Math.floor(256/s)*s;let i="",n=0;for(;i.length<a&&n<t.length;){const d=t[n++];d<o&&(i+=e[d%s])}if(i.length<a){let d=0;for(;i.length<a;){const r=t[d%t.length];d++,r<o&&(i+=e[r%s])}}return i}async function ct(t,e,a="",s=1,o="standard-16"){if(!t.trim()||!e.trim())return"";const i=await ot(t),n=new TextEncoder,d=await crypto.subtle.importKey("raw",i,{name:"HKDF"},!1,["deriveBits"]),r=`mantra_v1:${e.toLowerCase().trim()}:${a.trim()}:${s}`,u=n.encode(r),l=await crypto.subtle.deriveBits({name:"HKDF",hash:"SHA-256",salt:new Uint8Array,info:u},d,512),c=new Uint8Array(l),p=L[o]||L["standard-16"];return rt(c,p.charset,p.length)}const F="mk_webdav_config",z="mk_local_manifest",G="mk_sync_status_info";function J(t){if(!t)return"";const e=t.trim();return/^https?:\/\/dav\.jianguoyun\.com\/dav\/?$/i.test(e)?"https://dav.jianguoyun.com/dav/mantra-key":e}function dt(){return{schemaVersion:1,canaryHash:"",domains:{},updatedAt:Date.now()}}function q(){try{const t=localStorage.getItem(F);if(t){const e=JSON.parse(t);return{...e,serverUrl:J(e.serverUrl||"")}}}catch{}return{serverUrl:"",username:"",password:"",remoteFileName:"mantra_sync.mkey"}}function Y(t){try{const e={...t,serverUrl:J(t.serverUrl)};localStorage.setItem(F,JSON.stringify(e))}catch{}}function D(){try{const t=localStorage.getItem(z);if(t)return JSON.parse(t)}catch{}return dt()}function _(t){try{localStorage.setItem(z,JSON.stringify(t))}catch{}}function lt(){try{const t=localStorage.getItem(G);if(t)return JSON.parse(t)}catch{}return{status:"idle",lastSyncTime:"",message:"尚未同步",syncedDomainsCount:Object.keys(D().domains).length}}function ut(t){try{localStorage.setItem(G,JSON.stringify(t))}catch{}}function pt(t,e,a=""){const s=D(),o=t.trim().toLowerCase();if(!o)return s;const i=Date.now(),n=s.domains[o];return s.domains[o]={canonicalDomain:o,displayName:a||(n==null?void 0:n.displayName)||o,rulePreset:e,accounts:(n==null?void 0:n.accounts)||{},updatedAt:i},s.updatedAt=i,_(s),s}function mt(t){const e=D(),a=t.trim().toLowerCase();return e.domains[a]&&(delete e.domains[a],e.updatedAt=Date.now(),_(e)),e}function yt(t,e){const a={schemaVersion:Math.max(t.schemaVersion||1,e.schemaVersion||1),canaryHash:(e.updatedAt>t.updatedAt?e.canaryHash:t.canaryHash)||t.canaryHash||e.canaryHash,domains:{...t.domains},updatedAt:Math.max(t.updatedAt||0,e.updatedAt||0,Date.now())};for(const[s,o]of Object.entries(e.domains||{})){const i=a.domains[s];if(!i)a.domains[s]=o;else{const n=o.updatedAt>i.updatedAt?o:i,d={...i.accounts};for(const[r,u]of Object.entries(o.accounts||{})){const l=d[r];l?(u.version>l.version||u.version===l.version&&u.updatedAt>l.updatedAt)&&(d[r]=u):d[r]=u}a.domains[s]={canonicalDomain:n.canonicalDomain,displayName:n.displayName||i.displayName,rulePreset:n.rulePreset||i.rulePreset,accounts:d,updatedAt:Math.max(i.updatedAt,o.updatedAt)}}}return a}async function ft(t,e){const a=new TextEncoder,s=a.encode(JSON.stringify(t));if(!e||!e.trim()){const c=new Uint8Array(3+s.length);return c[0]=77,c[1]=75,c[2]=0,c.set(s,3),c}const o=crypto.getRandomValues(new Uint8Array(16)),i=crypto.getRandomValues(new Uint8Array(12)),n=await crypto.subtle.importKey("raw",a.encode(e.trim()),{name:"PBKDF2"},!1,["deriveKey"]),d=await crypto.subtle.deriveKey({name:"PBKDF2",salt:o,iterations:1e5,hash:"SHA-256"},n,{name:"AES-GCM",length:256},!1,["encrypt"]),r=await crypto.subtle.encrypt({name:"AES-GCM",iv:i},d,s),u=new Uint8Array(r),l=new Uint8Array(31+u.length);return l[0]=77,l[1]=75,l[2]=1,l.set(o,3),l.set(i,19),l.set(u,31),l}async function P(t,e){if(t.length===0)throw new Error("同步数据为空");const a=new TextDecoder;if(t[0]===123||t[0]===91)return{manifest:JSON.parse(a.decode(t)),isEncrypted:!1};if(t.length<3||t[0]!==77||t[1]!==75)throw new Error("无效的同步信封格式魔数");const s=t[2];if(s===0){const o=a.decode(t.slice(3));return{manifest:JSON.parse(o),isEncrypted:!1}}if(s===1){if(!e||!e.trim()){const l=new Error("检测到云端文件已启用端到端加密，请输入同步加密密码");throw l.code="NEED_SYNC_PASSWORD",l}if(t.length<47)throw new Error("加密信封数据损坏: 字节长度不足");const o=t.slice(3,19),i=t.slice(19,31),n=t.slice(31),d=new TextEncoder,r=await crypto.subtle.importKey("raw",d.encode(e.trim()),{name:"PBKDF2"},!1,["deriveKey"]),u=await crypto.subtle.deriveKey({name:"PBKDF2",salt:o,iterations:1e5,hash:"SHA-256"},r,{name:"AES-GCM",length:256},!1,["decrypt"]);try{const l=await crypto.subtle.decrypt({name:"AES-GCM",iv:i},u,n);return{manifest:JSON.parse(a.decode(l)),isEncrypted:!0}}catch{const c=new Error("同步加密密码不匹配，无法解密云端数据");throw c.code="PASSWORD_MISMATCH",c}}throw new Error(`不支持的同步信封版本: 0x${s.toString(16)}`)}async function gt(t){let e=t.serverUrl.trim().replace(/\/+$/,"");if(!e)return{ok:!1,message:"WebDAV 服务器地址不能为空"};/^https?:\/\//i.test(e)||(e="https://"+e);const a="Basic "+btoa(`${t.username}:${t.password}`);try{const s=await fetch(e+"/",{method:"PROPFIND",headers:{Authorization:a,Depth:"0","Content-Type":"application/xml; charset=utf-8"},signal:AbortSignal.timeout(6e3)}).catch(async()=>fetch(e+"/",{method:"GET",headers:{Authorization:a},signal:AbortSignal.timeout(6e3)}));return s.status===401||s.status===403?{ok:!1,message:"认证失败: 用户名或密码/应用 Token 错误"}:s.status>=200&&s.status<400||s.status===207?{ok:!0,message:`连接成功 (HTTP ${s.status})`}:{ok:!1,message:`服务器返回状态异常: HTTP ${s.status}`}}catch(s){return{ok:!1,message:`网络连接异常: ${(s==null?void 0:s.message)||"无法访问该地址，请检查网络或 CORS 跨域"}`}}}async function vt(t,e){var k,h;const a=t||q();let s=a.serverUrl.trim().replace(/\/+$/,"");if(!s)return{ok:!1,message:"尚未配置 WebDAV 服务器地址",mergedCount:0};/^https?:\/\//i.test(s)||(s="https://"+s);const o=(a.remoteFileName||"mantra_sync.mkey").replace(/^\/+/,""),i=`${s}/${o}`,n="Basic "+btoa(`${a.username}:${a.password}`),d=D();let r=null,u=!1,l=a.syncPassword;try{const m=await fetch(i,{method:"GET",headers:{Authorization:n},signal:AbortSignal.timeout(8e3)});if(m.status===401||m.status===403)return{ok:!1,message:"WebDAV 认证失败，请检查用户名与应用密码",mergedCount:0};if(m.ok){const N=await m.arrayBuffer();if(N.byteLength>0){const y=new Uint8Array(N);try{const g=await P(y,l);r=g.manifest,u=g.isEncrypted}catch(g){if(g.code==="NEED_SYNC_PASSWORD"&&e){const w=await e();if(!w||!w.trim())return{ok:!1,message:"同步已取消：云端数据已加密，需要同步密码方可合并",mergedCount:0};l=w.trim(),a.syncPassword=l,Y(a);const b=await P(y,l);r=b.manifest,u=b.isEncrypted}else throw g}}}else if(m.status!==404)return{ok:!1,message:`获取远程同步文件失败: HTTP ${m.status}`,mergedCount:0}}catch(m){if((m==null?void 0:m.code)==="NEED_SYNC_PASSWORD"||(m==null?void 0:m.code)==="PASSWORD_MISMATCH"||(k=m==null?void 0:m.message)!=null&&k.includes("加密密码"))return{ok:!1,message:m.message,mergedCount:0};(h=m==null?void 0:m.message)!=null&&h.includes("404")||console.warn("[MantraKey Sync] 下载远程文件异常:",m)}let c=d;r&&(c=yt(d,r)),c.updatedAt=Date.now(),_(c);const p=await ft(c,l),v=!u&&!!l;try{const m=await fetch(i,{method:"PUT",headers:{Authorization:n,"Content-Type":"application/octet-stream"},body:p,signal:AbortSignal.timeout(1e4)});if(!m.ok&&m.status!==201&&m.status!==204)return{ok:!1,message:`回写同步信封至 WebDAV 失败: HTTP ${m.status}`,mergedCount:0}}catch(m){return{ok:!1,message:`回写至 WebDAV 失败: ${(m==null?void 0:m.message)||"网络连接超时"}`,mergedCount:0}}const f=Object.keys(c.domains).length,S=new Date().toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit",second:"2-digit"}),x=v?`同步成功并已自动安全升格为 AES-256-GCM 加密存储！合并 ${f} 个站点规则`:`同步成功！已自动合并 ${f} 个站点规则`;return ut({status:"success",lastSyncTime:S,message:x,syncedDomainsCount:f}),{ok:!0,message:x,mergedCount:f,upgradedToEncrypted:v}}function U(){const t=document.getElementById("app");!t||t.hasAttribute("data-mounted")||(t.setAttribute("data-mounted","true"),t.innerHTML=`
    <div class="mobile-container">
      <!-- 顶部品牌导航 -->
      <header class="app-header">
        <div class="brand-row">
          <div class="logo-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 14c-2.76 0-5-2.24-5-5s2.24-5 5-5c2.42 0 4.44 1.72 4.9 4h6.1l2 2-2 2h-2l-1 1-1-1h-2.1c-.46 2.28-2.48 4-4.9 4zm0-8C5.34 6 4 7.34 4 9s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
            </svg>
          </div>
          <div class="brand-info">
            <h1 class="brand-title">密诀</h1>
            <span class="brand-sub">零存储物理架构 · 确定性无状态密码引擎</span>
          </div>
          <span class="enclave-badge">ENCLAVE</span>
        </div>
      </header>

      <main class="app-main">
        <!-- 1. 核心主要功能置顶：确定性密码现场生成与派生 -->
        <section class="card crypto-card" id="card-generator">
          <div class="card-header">
            <span class="card-title">🔑 密码生成与现场派生</span>
            <span class="badge-dim">本地纯计算 · 零存储</span>
          </div>

          <div class="crypto-body">
            <!-- 主口令输入 -->
            <div class="input-group">
              <div class="input-header">
                <label class="input-label" for="input-mantra">主口令 (Master Mantra)</label>
                <span class="canary-tag" id="tag-canary" title="金丝雀防手抖校验码">校验码: --</span>
              </div>
              <div class="input-with-action">
                <input
                  type="password"
                  id="input-mantra"
                  class="cyber-input"
                  placeholder="输入您的唯一记忆口令..."
                  autocomplete="off"
                  value=""
                />
                <button type="button" class="btn-toggle-visibility" id="btn-toggle-pwd" title="点击显示明文">🙈</button>
              </div>
            </div>

            <!-- 目标站点/账户标识 -->
            <div class="input-group">
              <label class="input-label" for="input-domain">目标站点或账号标识</label>
              <input
                type="text"
                id="input-domain"
                class="cyber-input"
                placeholder="例如: github.com, weixin, 13800138000..."
                value=""
              />
              <div class="domain-chips">
                <span class="chip-item" data-val="github.com">GitHub</span>
                <span class="chip-item" data-val="google.com">Google</span>
                <span class="chip-item" data-val="alipay.com">支付宝</span>
                <span class="chip-item" data-val="wechat">微信</span>
                <span class="chip-item" data-val="apple.com">Apple ID</span>
              </div>
            </div>

            <!-- 规则预设选择 -->
            <div class="input-group">
              <label class="input-label">密码规则规格</label>
              <div class="preset-selector" id="preset-selector">
                <button type="button" class="preset-btn active" data-preset="standard-16">16位标准</button>
                <button type="button" class="preset-btn" data-preset="secure-20">20位高强</button>
                <button type="button" class="preset-btn" data-preset="super-32">32位极高</button>
                <button type="button" class="preset-btn" data-preset="alphanumeric-16">无符号</button>
                <button type="button" class="preset-btn" data-preset="pin-6">6位PIN</button>
              </div>
            </div>

            <!-- 派生结果卡片 -->
            <div class="derived-result-box">
              <div class="derived-meta">
                <span class="derived-label">计算派生密码</span>
                <span class="derived-strength" id="text-rule-desc">字母+数字+特殊符号 (16位)</span>
              </div>
              <div class="derived-output-row">
                <span class="derived-val" id="text-derived-pwd" style="color: #64748b; font-size: 13px;">等待输入主口令与目标站点...</span>
                <div style="display: flex; gap: 6px; align-items: center;">
                  <button type="button" class="btn-save-rule" id="btn-save-rule" title="保存此规则至多端同步清单">
                    📌 记住规则
                  </button>
                  <button type="button" class="btn-copy-pwd" id="btn-copy-pwd" title="一键复制" disabled>
                    📋 复制
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- 2. WebDAV 多端端到端加密同步面板 (E2EE + CRDT) -->
        <section class="card sync-card" id="card-webdav-sync">
          <div class="card-header">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="card-title">🌐 WebDAV 多端加密同步</span>
              <span class="sync-status-tag" id="badge-sync-status">未同步</span>
            </div>
            <button type="button" class="btn-toggle-card" id="btn-toggle-sync-config">⚙️ 配置</button>
          </div>

          <div class="sync-body">
            <!-- 同步摘要与立即同步行 -->
            <div class="sync-summary-row">
              <div class="sync-info-col">
                <span class="sync-sub-title">端到端 AES-256-GCM 密文同步</span>
                <span class="sync-last-time" id="text-sync-last-time">上次同步: 尚未同步</span>
              </div>
              <button type="button" class="btn-sync-now" id="btn-sync-now">
                🔄 立即双向同步
              </button>
            </div>

            <!-- WebDAV 配置表单 (折叠面板) -->
            <div class="sync-config-form" id="sync-config-form" style="display: none;">
              <div class="input-group">
                <label class="input-label" for="input-webdav-url">WebDAV 服务器根地址</label>
                <input
                  type="text"
                  id="input-webdav-url"
                  class="cyber-input"
                  placeholder="例如: https://dav.jianguoyun.com/dav/mantra-key"
                  value=""
                />
              </div>

              <div class="sync-form-row">
                <div class="input-group" style="flex: 1;">
                  <label class="input-label" for="input-webdav-user">用户名 / 账号</label>
                  <input
                    type="text"
                    id="input-webdav-user"
                    class="cyber-input"
                    placeholder="WebDAV 账号"
                    value=""
                  />
                </div>

                <div class="input-group" style="flex: 1;">
                  <label class="input-label" for="input-webdav-pass">应用密码 / Token</label>
                  <input
                    type="password"
                    id="input-webdav-pass"
                    class="cyber-input"
                    placeholder="应用独立密码"
                    value=""
                  />
                </div>
              </div>

              <div class="input-group">
                <label class="input-label" for="input-webdav-file">远程密文文件名</label>
                <input
                  type="text"
                  id="input-webdav-file"
                  class="cyber-input"
                  placeholder="mantra_sync.mkey"
                  value="mantra_sync.mkey"
                />
              </div>

              <div class="input-group">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <label class="input-label" for="input-webdav-sync-pass">同步加密密码 (可选端到端 E2EE)</label>
                  <span style="font-size: 11px; color: var(--text-dim);">留空存明文 · 填写享金融级加密</span>
                </div>
                <div class="input-with-action">
                  <input
                    type="password"
                    id="input-webdav-sync-pass"
                    class="cyber-input"
                    placeholder="可留空，或输入独立同步密码..."
                    value=""
                  />
                  <button type="button" class="btn-toggle-visibility" id="btn-toggle-sync-pass" title="显隐密码">🙈</button>
                </div>
              </div>

              <div class="sync-actions-row">
                <button type="button" class="btn-secondary" id="btn-test-webdav">
                  ⚡ 测试连通性
                </button>
                <button type="button" class="btn-secondary" id="btn-save-webdav">
                  💾 保存配置
                </button>
              </div>

              <div class="sync-hint-box">
                💡 <strong>独立同步加密保障：</strong>支持设置独立同步加密密码。若填写，清单在本地使用 AES-256-GCM 强加密后再上传至云端；若留空，则以明文信封存储。多端支持无缝平滑自适应合并与升格。
              </div>
            </div>

            <!-- 已同步规则清单折叠区 -->
            <div class="synced-rules-section">
              <div class="synced-rules-header" id="btn-toggle-rules-list">
                <span class="synced-rules-title">📑 已保存的站点规则清单 (<span id="count-synced-rules">0</span>)</span>
                <span class="synced-rules-arrow" id="arrow-rules-list">▼</span>
              </div>
              <div class="synced-rules-list" id="synced-rules-list" style="display: none;">
                <!-- 动态渲染站点规则项 -->
              </div>
            </div>
          </div>
        </section>

        <!-- 2. 系统注入服务状态面板 -->
        <section class="card status-card">
          <div class="card-header">
            <span class="card-title">📱 系统注入服务状态</span>
            <button type="button" class="btn-help-guide" id="btn-open-onboarding">📖 开启指引说明</button>
          </div>

          <div class="service-item">
            <div class="service-meta">
              <div class="service-title-row">
                <span class="service-name">系统级自动填充服务 (AutofillService)</span>
                <span class="service-status-badge checking" id="badge-autofill">检测中...</span>
              </div>
              <div class="service-desc">适配标准网页与常规 App 账号密码框自动浮动建议，免切屏复制</div>
            </div>
            <button type="button" class="btn-service" id="btn-open-autofill-settings">去设置 ➔</button>
          </div>

          <div class="service-item">
            <div class="service-meta">
              <div class="service-title-row">
                <span class="service-name">辅助穿透输入法 (PenetrationIME)</span>
                <span class="service-status-badge checking" id="badge-ime">检测中...</span>
              </div>
              <div class="service-desc">100% 击穿银行、证券等金融 App 防填充与自绘安全键盘</div>
            </div>
            <button type="button" class="btn-service" id="btn-open-ime-settings">去设置 ➔</button>
          </div>
        </section>

        <!-- 3. 在线更新卡片 (GitHub Releases) -->
        <section class="card update-card" id="update-card">
          <div class="card-header">
            <span class="card-title">🚀 版本与在线更新</span>
            <span class="update-status" id="update-status-badge">就绪</span>
          </div>

          <div class="update-body">
            <div class="version-compare-row">
              <div class="ver-col">
                <span class="ver-label">当前运行版本</span>
                <span class="ver-val" id="text-current-ver">v${O}</span>
              </div>
              <div class="ver-arrow">➔</div>
              <div class="ver-col">
                <span class="ver-label">线上最新版本</span>
                <span class="ver-val" id="text-latest-ver">检测中...</span>
              </div>
            </div>

            <!-- 检测到更新时的详情区域 -->
            <div class="update-detail-box" id="update-detail-box" style="display: none;">
              <div class="release-title" id="text-release-title"></div>
              <div class="release-notes" id="text-release-notes"></div>
              <div class="download-progress-row" id="download-progress-row" style="display: none;">
                <div class="progress-bar-bg">
                  <div class="progress-bar-fill" id="update-progress-fill" style="width: 0%;"></div>
                </div>
                <div class="progress-text" id="update-progress-text">0%</div>
              </div>
              <button type="button" class="btn-update-action" id="btn-action-update">
                ⚡ 立即下载并安装新版本
              </button>
            </div>

            <button type="button" class="btn-check-update" id="btn-check-update">
              🔄 检查线上更新 (GitHub Releases)
            </button>
          </div>
        </section>
      </main>

      <footer class="app-footer">
        <span>密诀 MantraKey · 移动端端侧中枢</span>
        <span>无明文存储 · 安全确定性</span>
      </footer>

      <!-- 4. 初次启动引导 / 权限配置说明模态弹窗 -->
      <div class="onboarding-overlay" id="onboarding-overlay" style="display: none;">
        <div class="onboarding-modal">
          <div class="onboarding-header">
            <div class="onboarding-title">🛡️ 密诀 Android 权限与注入配置指引</div>
            <button type="button" class="btn-close-onboarding" id="btn-close-onboarding">✕</button>
          </div>

          <div class="onboarding-content">
            <div class="guide-item">
              <div class="guide-q">Q: 为什么要开启「系统级自动填充服务」？</div>
              <div class="guide-a">
                <strong>免切屏、免复制：</strong>在任意网页或 App 账号密码框点击时，Android 系统将自动弹出密诀安全气泡，一键派生填充。<br/>
                <strong>物理级隐私安全：</strong>密诀是纯本地计算、零网络传输，不会保存您的明文密码，开启系统填充既便捷又杜绝剪贴板被其他应用窥探窃取的风险。
              </div>
              <button type="button" class="btn-guide-action" id="btn-guide-autofill">前往系统设置开启自动填充 ➔</button>
            </div>

            <div class="guide-item">
              <div class="guide-q">Q: 为什么要开启「辅助穿透输入法」？</div>
              <div class="guide-a">
                <strong>攻克银行与金融 App 防御：</strong>国内各大手机银行、证券投资、政务类 App 普遍禁用了系统自动填充，并弹出自绘防截屏键盘，导致常规密码软件全部失效。<br/>
                <strong>无坚不摧的安全注入：</strong>密诀专属辅助键盘直接将安全派生密码嵌入在键盘上层。遇到强防御 App 时，只需在输入法选择器中切换到密诀键盘，即可一键将生成的密码打穿并注入输入框！
              </div>
              <button type="button" class="btn-guide-action" id="btn-guide-ime">前往输入法设置开启穿透键盘 ➔</button>
            </div>
          </div>

          <div class="onboarding-footer">
            <button type="button" class="btn-confirm-onboarding" id="btn-confirm-onboarding">
              ✅ 我已知晓，开启安全体验
            </button>
          </div>
        </div>
      </div>

      <!-- 就地同步加密密码输入弹窗 (当检测到云端加密而本地未配置时触发) -->
      <div id="sync-pass-modal-overlay" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 10000; align-items: center; justify-content: center; backdrop-filter: blur(4px);">
        <div style="background: #111827; border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 12px; padding: 20px; width: 90%; max-width: 380px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
            <span style="font-size: 20px;">🔐</span>
            <h3 style="margin: 0; font-size: 16px; color: #fff; font-weight: 600;">云端数据已加密</h3>
          </div>
          <p style="font-size: 13px; color: #94a3b8; line-height: 1.5; margin-bottom: 16px;">
            检测到 WebDAV 云端备份已启用端到端加密（0x01 密文信封），请输入同步加密密码以完成数据解密与双向合并：
          </p>
          <div class="input-group" style="margin-bottom: 20px;">
            <input
              type="password"
              id="modal-sync-pass-input"
              class="cyber-input"
              placeholder="输入此云端备份的同步加密密码..."
              style="width: 100%; box-sizing: border-box;"
            />
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button type="button" class="btn-secondary" id="btn-modal-sync-cancel" style="padding: 8px 16px; font-size: 13px;">取消</button>
            <button type="button" class="btn-primary" id="btn-modal-sync-confirm" style="padding: 8px 18px; font-size: 13px; background: linear-gradient(135deg, #10b981 0%, #00f0ff 100%); color: #0b0f17; font-weight: 600; border: none; border-radius: 6px;">确认解密并保存</button>
          </div>
        </div>
      </div>
    </div>
  `,bt(),wt(),ht(),xt(),Et())}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",U):U();function bt(){const t=document.getElementById("input-mantra"),e=document.getElementById("input-domain"),a=document.getElementById("btn-toggle-pwd"),s=document.getElementById("tag-canary"),o=document.getElementById("text-derived-pwd"),i=document.getElementById("text-rule-desc"),n=document.getElementById("btn-copy-pwd"),d=document.getElementById("btn-save-rule"),r=document.getElementById("preset-selector"),u=document.querySelectorAll(".chip-item");let l="standard-16";async function c(){if(!t||!e||!o)return;const p=t.value||"",v=e.value||"";if(s)if(p.trim()){const f=await it(p);s.textContent=`校验码: ${f}`}else s.textContent="校验码: --";if(!p.trim()||!v.trim()){!p.trim()&&!v.trim()?o.textContent="等待输入主口令与目标站点...":p.trim()?o.textContent="等待输入目标标识...":o.textContent="等待输入主口令...",o.style.color="#64748b",n&&(n.disabled=!0);return}try{const f=await ct(p,v,"",1,l);o.textContent=f,o.style.color="#00f0ff",n&&(n.disabled=!1)}catch(f){o.textContent="派生失败: "+((f==null?void 0:f.message)||"未知错误"),o.style.color="#ef4444",n&&(n.disabled=!0)}}t==null||t.addEventListener("input",c),e==null||e.addEventListener("input",()=>{const p=(e.value||"").trim().toLowerCase(),v=D();if(p&&v.domains[p]){const f=v.domains[p].rulePreset;f&&L[f]&&f!==l&&(l=f,r==null||r.querySelectorAll(".preset-btn").forEach(S=>{S.getAttribute("data-preset")===f?S.classList.add("active"):S.classList.remove("active")}),i&&(i.textContent=L[f].description+" (已匹配保存规则)"))}c()}),a==null||a.addEventListener("click",()=>{t&&(t.type==="password"?(t.type="text",a.textContent="👁️",a.title="点击隐藏口令"):(t.type="password",a.textContent="🙈",a.title="点击显示明文"))}),d==null||d.addEventListener("click",()=>{var v;const p=((e==null?void 0:e.value)||"").trim();if(!p){alert("请先输入目标站点或账号标识（例如 github.com）");return}pt(p,l),d.textContent="✅ 已记住！",(v=window.__refreshWebDAVRulesList)==null||v.call(window),setTimeout(()=>{d.textContent="📌 记住规则"},1500)}),u.forEach(p=>{p.addEventListener("click",()=>{const v=p.getAttribute("data-val");if(v&&e){e.value=v;const f=D(),S=v.toLowerCase();if(f.domains[S]){const x=f.domains[S].rulePreset;x&&L[x]&&(l=x,r==null||r.querySelectorAll(".preset-btn").forEach(C=>{C.getAttribute("data-preset")===x?C.classList.add("active"):C.classList.remove("active")}),i&&(i.textContent=L[x].description+" (已匹配保存规则)"))}c()}})}),r==null||r.addEventListener("click",p=>{const v=p.target,f=v.getAttribute("data-preset");f&&L[f]&&(l=f,r.querySelectorAll(".preset-btn").forEach(S=>S.classList.remove("active")),v.classList.add("active"),i&&(i.textContent=L[f].description),c())}),n==null||n.addEventListener("click",async()=>{const p=o==null?void 0:o.textContent;if(!(!p||p.includes("...")||p.includes("失败")||p.includes("等待")))try{await navigator.clipboard.writeText(p),n.textContent="✅ 已复制！",n.classList.add("copied"),setTimeout(()=>{n.textContent="📋 复制",n.classList.remove("copied")},1500)}catch{alert("已派生密码: "+p)}}),c()}function wt(){const t=document.getElementById("btn-toggle-sync-config"),e=document.getElementById("sync-config-form"),a=document.getElementById("btn-sync-now"),s=document.getElementById("badge-sync-status"),o=document.getElementById("text-sync-last-time"),i=document.getElementById("input-webdav-url"),n=document.getElementById("input-webdav-user"),d=document.getElementById("input-webdav-pass"),r=document.getElementById("input-webdav-file"),u=document.getElementById("input-webdav-sync-pass"),l=document.getElementById("btn-toggle-sync-pass"),c=document.getElementById("btn-test-webdav"),p=document.getElementById("btn-save-webdav"),v=document.getElementById("btn-toggle-rules-list"),f=document.getElementById("synced-rules-list"),S=document.getElementById("arrow-rules-list"),x=document.getElementById("count-synced-rules");document.getElementById("input-mantra");function C(y){const g=(y||"").trim();return/^https?:\/\/dav\.jianguoyun\.com\/dav\/?$/i.test(g)?"https://dav.jianguoyun.com/dav/mantra-key":g}const k=q();i&&(i.value=k.serverUrl||"https://dav.jianguoyun.com/dav/mantra-key"),n&&(n.value=k.username||""),d&&(d.value=k.password||""),r&&(r.value=k.remoteFileName||"mantra_sync.mkey"),u&&(u.value=k.syncPassword||""),l==null||l.addEventListener("click",()=>{if(!u)return;const y=u.type==="password";u.type=y?"text":"password",l.textContent=y?"👀":"🙈"}),i==null||i.addEventListener("blur",()=>{i.value&&(i.value=C(i.value))});function h(){const y=lt(),g=D(),w=Object.keys(g.domains||{}).length;x&&(x.textContent=String(w)),o&&(o.textContent=y.lastSyncTime?`上次同步: ${y.lastSyncTime}`:"上次同步: 尚未同步"),s&&(s.className="sync-status-tag "+(y.status||"idle"),y.status==="success"?s.textContent="🟢 已同步":y.status==="syncing"?s.textContent="🔄 同步中...":y.status==="error"?s.textContent="🔴 同步失败":s.textContent=k.serverUrl?"⚪ 待同步":"⚪ 未配置")}function m(){if(!f)return;const y=D(),g=Object.keys(y.domains||{});if(x&&(x.textContent=String(g.length)),g.length===0){f.innerHTML=`
        <div style="font-size: 11px; color: #64748b; text-align: center; padding: 10px 0;">
          暂无已记录站点规则。在上方计算派生密码后，点击「📌 记住规则」即可加入多端同步清单。
        </div>
      `;return}f.innerHTML=g.sort().map(w=>{const b=y.domains[w];return`
          <div class="rule-item-row" data-domain="${b.canonicalDomain}">
            <div style="display: flex; align-items: center;">
              <span class="rule-item-domain">${b.canonicalDomain}</span>
              <span class="rule-item-preset">${b.rulePreset}</span>
            </div>
            <button type="button" class="btn-del-rule" data-del="${b.canonicalDomain}" title="从同步清单移除">✕</button>
          </div>
        `}).join(""),f.querySelectorAll(".btn-del-rule").forEach(w=>{w.addEventListener("click",b=>{b.stopPropagation();const A=w.getAttribute("data-del");A&&(mt(A),m(),h())})})}window.__refreshWebDAVRulesList=()=>{m(),h()},t==null||t.addEventListener("click",()=>{if(!e)return;const y=e.style.display==="none";e.style.display=y?"flex":"none",t&&(t.textContent=y?"✕ 收起":"⚙️ 配置")}),v==null||v.addEventListener("click",()=>{if(!f||!S)return;const y=f.style.display==="none";f.style.display=y?"flex":"none",S.textContent=y?"▲":"▼"}),p==null||p.addEventListener("click",()=>{var g,w,b,A;const y={serverUrl:C((i==null?void 0:i.value)||""),username:((g=n==null?void 0:n.value)==null?void 0:g.trim())||"",password:((w=d==null?void 0:d.value)==null?void 0:w.trim())||"",remoteFileName:((b=r==null?void 0:r.value)==null?void 0:b.trim())||"mantra_sync.mkey",syncPassword:((A=u==null?void 0:u.value)==null?void 0:A.trim())||""};Y(y),h(),p&&(p.textContent="✅ 已保存配置！",setTimeout(()=>p.textContent="💾 保存配置",1500))}),c==null||c.addEventListener("click",async()=>{var g,w,b,A,I;const y={serverUrl:((g=i==null?void 0:i.value)==null?void 0:g.trim())||"",username:((w=n==null?void 0:n.value)==null?void 0:w.trim())||"",password:((b=d==null?void 0:d.value)==null?void 0:b.trim())||"",remoteFileName:((A=r==null?void 0:r.value)==null?void 0:A.trim())||"mantra_sync.mkey",syncPassword:((I=u==null?void 0:u.value)==null?void 0:I.trim())||""};c&&(c.textContent="⏳ 正在探测...");try{const E=await gt(y);alert(E.ok?`✅ ${E.message}`:`❌ ${E.message}`)}catch(E){alert(`❌ 探测异常: ${(E==null?void 0:E.message)||"未知错误"}`)}finally{c&&(c.textContent="⚡ 测试连通性")}});function N(){return new Promise(y=>{const g=document.getElementById("sync-pass-modal-overlay"),w=document.getElementById("modal-sync-pass-input"),b=document.getElementById("btn-modal-sync-cancel"),A=document.getElementById("btn-modal-sync-confirm");if(!g||!w){const $=prompt("检测到云端文件已加密，请输入同步加密密码：");y($||"");return}w.value="",g.style.display="flex",w.focus();const I=()=>{g.style.display="none",b==null||b.removeEventListener("click",E),A==null||A.removeEventListener("click",R)},E=()=>{I(),y("")},R=()=>{const $=w.value.trim();I(),y($)};b==null||b.addEventListener("click",E),A==null||A.addEventListener("click",R)})}a==null||a.addEventListener("click",async()=>{var g,w,b,A,I;const y={serverUrl:((g=i==null?void 0:i.value)==null?void 0:g.trim())||"",username:((w=n==null?void 0:n.value)==null?void 0:w.trim())||"",password:((b=d==null?void 0:d.value)==null?void 0:b.trim())||"",remoteFileName:((A=r==null?void 0:r.value)==null?void 0:A.trim())||"mantra_sync.mkey",syncPassword:((I=u==null?void 0:u.value)==null?void 0:I.trim())||""};if(!y.serverUrl){e&&(e.style.display="flex"),alert("请先在「⚙️ 配置」中填入您的 WebDAV 服务器地址与账号密码");return}s&&(s.className="sync-status-tag syncing",s.textContent="🔄 同步中..."),a&&(a.textContent="⏳ 同步中...");try{const E=await vt(y,N);E.upgradedToEncrypted&&u&&(u.value=y.syncPassword||""),h(),m(),alert(E.ok?`🎉 ${E.message}`:`⚠️ 同步未完成: ${E.message}`)}catch(E){alert(`❌ 同步发生异常: ${(E==null?void 0:E.message)||"未知错误"}`),h()}finally{a&&(a.textContent="🔄 立即双向同步"),h()}}),h(),m()}function ht(){const t=document.getElementById("btn-open-autofill-settings"),e=document.getElementById("btn-open-ime-settings"),a=document.getElementById("badge-autofill"),s=document.getElementById("badge-ime");function o(){const c=typeof window<"u"?window.MantraNative:null;a&&(c!=null&&c.isAutofillEnabled?c.isAutofillEnabled()?(a.textContent="🟢 运行中",a.className="service-status-badge active"):(a.textContent="⚠️ 未开启",a.className="service-status-badge inactive"):(a.textContent="系统管理",a.className="service-status-badge checking")),s&&(c!=null&&c.isImeEnabled?c.isImeEnabled()?(s.textContent="🟢 已就绪",s.className="service-status-badge active"):(s.textContent="⚠️ 未开启",s.className="service-status-badge inactive"):(s.textContent="系统管理",s.className="service-status-badge checking"))}typeof window<"u"&&(window.onMantraResume=()=>{o()}),t==null||t.addEventListener("click",()=>{var c;typeof window<"u"&&((c=window.MantraNative)!=null&&c.openAutofillSettings)?window.MantraNative.openAutofillSettings():alert("请前往 Android 系统设置 -> 辅助功能 / 自动填充服务 中启用「密诀」")}),e==null||e.addEventListener("click",()=>{var c;typeof window<"u"&&((c=window.MantraNative)!=null&&c.openImeSettings)?window.MantraNative.openImeSettings():alert("请前往 Android 系统设置 -> 语言与输入法 中勾选并激活「密诀辅助键盘」")});const i=document.getElementById("btn-open-onboarding"),n=document.getElementById("onboarding-overlay"),d=document.getElementById("btn-close-onboarding"),r=document.getElementById("btn-confirm-onboarding"),u=document.getElementById("btn-guide-autofill"),l=document.getElementById("btn-guide-ime");i==null||i.addEventListener("click",()=>{n&&(n.style.display="flex")}),d==null||d.addEventListener("click",()=>{n&&(n.style.display="none")}),r==null||r.addEventListener("click",()=>{var c;n&&(n.style.display="none"),localStorage.setItem("mk_onboarding_guided","true"),typeof window<"u"&&((c=window.MantraNative)!=null&&c.setFirstLaunchCompleted)&&window.MantraNative.setFirstLaunchCompleted()}),u==null||u.addEventListener("click",()=>{var c;typeof window<"u"&&((c=window.MantraNative)!=null&&c.openAutofillSettings)&&window.MantraNative.openAutofillSettings()}),l==null||l.addEventListener("click",()=>{var c;typeof window<"u"&&((c=window.MantraNative)!=null&&c.openImeSettings)&&window.MantraNative.openImeSettings()}),o()}function Et(){const t=typeof window<"u"?window.MantraNative:null;(t!=null&&t.isFirstLaunch?t.isFirstLaunch():!localStorage.getItem("mk_onboarding_guided"))&&!localStorage.getItem("mk_onboarding_guided")&&setTimeout(()=>{const a=document.getElementById("onboarding-overlay");a&&(a.style.display="flex")},600)}function xt(){const t=document.getElementById("btn-check-update"),e=document.getElementById("text-latest-ver"),a=document.getElementById("update-status-badge"),s=document.getElementById("update-detail-box"),o=document.getElementById("text-release-title"),i=document.getElementById("text-release-notes"),n=document.getElementById("btn-action-update");let d=null;async function r(){if(!(!e||!a)){e.textContent="检查中...",a.textContent="检测中",a.className="update-status checking";try{d=await tt(!1),e.textContent=d.versionTag,V(O,d.version)>0?(a.textContent="发现新版本",a.className="update-status has-update",s&&o&&i&&(s.style.display="flex",o.textContent=`${d.title} (${d.assetSizeText})`,i.textContent=d.changelog)):(a.textContent="已是最新",a.className="update-status latest",s&&(s.style.display="none"))}catch{e.textContent="检测超时",a.textContent="离线/超时",a.className="update-status error"}}}t==null||t.addEventListener("click",r),setTimeout(r,1e3),n==null||n.addEventListener("click",()=>{var l;if(!d)return;const u=d.downloadUrl;if(typeof window<"u"&&((l=window.MantraNative)!=null&&l.downloadAndInstallApk)){window.MantraNative.downloadAndInstallApk(u,d.versionTag,d.sha256);return}window.open(u,"_blank")}),typeof window<"u"&&(window.onMantraDownloadProgress=u=>{const l=document.getElementById("download-progress-row"),c=document.getElementById("update-progress-fill"),p=document.getElementById("update-progress-text");if(l&&c&&p){l.style.display="flex";const v=Math.max(0,Math.min(100,u.percent||0));c.style.width=`${v}%`,p.textContent=`${v}% (${u.message||""})`}})}
