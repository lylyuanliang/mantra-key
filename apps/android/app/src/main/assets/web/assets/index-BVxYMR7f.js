(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const o of document.querySelectorAll('link[rel="modulepreload"]'))n(o);new MutationObserver(o=>{for(const i of o)if(i.type==="childList")for(const s of i.addedNodes)s.tagName==="LINK"&&s.rel==="modulepreload"&&n(s)}).observe(document,{childList:!0,subtree:!0});function a(o){const i={};return o.integrity&&(i.integrity=o.integrity),o.referrerPolicy&&(i.referrerPolicy=o.referrerPolicy),o.crossOrigin==="use-credentials"?i.credentials="include":o.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function n(o){if(o.ep)return;o.ep=!0;const i=a(o);fetch(o.href,i)}})();const bt="https://ghproxy.net/",ht="0.1.1.202611241820",nt={acceleratorPrefix:bt,version:ht},j="lylyuanliang/mantra-key".trim(),Z=nt.acceleratorPrefix.trim(),at=nt.version.trim();function ot(t,e){if(!t||!e)return 0;const a=s=>s.replace(/^v/i,"").trim(),n=a(t).split(".").map(s=>parseInt(s,10)||0),o=a(e).split(".").map(s=>parseInt(s,10)||0),i=Math.max(n.length,o.length);for(let s=0;s<i;s++){const r=n[s]||0,l=o[s]||0;if(l>r)return 1;if(l<r)return-1}return 0}async function wt(t){if(!t)return null;const e=[`https://ghproxy.net/https://github.com/${j}/releases/download/${t}/SHA256SUMS.txt`,`https://gh-proxy.com/https://github.com/${j}/releases/download/${t}/SHA256SUMS.txt`,`https://mirror.ghproxy.com/https://github.com/${j}/releases/download/${t}/SHA256SUMS.txt`,`https://github.com/${j}/releases/download/${t}/SHA256SUMS.txt`];for(const a of e)try{const n=new AbortController,o=setTimeout(()=>n.abort(),3500),i=await fetch(a,{signal:n.signal});if(clearTimeout(o),i.ok){const s=await i.text(),r={};for(const l of s.split(/\r?\n/)){const u=l.trim();if(!u||u.startsWith("#"))continue;const c=u.split(/\s+/);if(c.length>=2){const d=c[0].toLowerCase(),p=c[1].replace(/^\*/,"");r[p]=d,p.includes("release")?r.release=d:p.includes("debug")&&(r.debug=d)}}return r}}catch{}return null}async function xt(t=!1){const e=Date.now(),n=(typeof window<"u"&&window.localStorage&&(window.localStorage.getItem("af_api_base")||window.localStorage.getItem("mk_debug_tunnel_url"))||"").replace(/\/+$/,""),o=n?`${n}/version.json?t=${e}`:null,i=[o,`https://ghproxy.net/https://raw.githubusercontent.com/${j}/main/public/version.json?t=${e}`,`https://gh-proxy.com/https://raw.githubusercontent.com/${j}/main/public/version.json?t=${e}`,`https://raw.githubusercontent.com/${j}/main/public/version.json?t=${e}`,`https://cdn.jsdelivr.net/gh/${j}@main/public/version.json?t=${e}`,typeof window<"u"?`/version.json?t=${e}`:null].filter(Boolean);let s=null;for(const E of i)try{const v=new AbortController,S=setTimeout(()=>v.abort(),4e3),B=await fetch(E,{signal:v.signal});if(clearTimeout(S),B.ok){const L=await B.json();if(L&&(L.version||L.versionTag)&&((!s||ot(s.version||s.versionTag,L.version||L.versionTag)>0)&&(s=L),E===o||E.includes("ghproxy.net")||E.includes("gh-proxy.com")||E.includes("raw.githubusercontent.com")))break}}catch{}if(!s||!s.version&&!s.versionTag)throw new Error("网络连接超时或无法解析最新版本信息");const r=s.version||s.versionTag.replace(/^v/i,""),l=s.versionTag||`v${r}`,u=s.releaseDownloadUrl||`https://github.com/${j}/releases/download/${l}/mantra-key-${l}-release.apk`,c=s.debugDownloadUrl||`https://github.com/${j}/releases/download/${l}/mantra-key-${l}-debug.apk`,d=u.startsWith("http")?`${Z}${u}`:u,p=c.startsWith("http")?`${Z}${c}`:c,b=t?c:u,g=t?p:d,A=t?`mantra-key-${l}-debug.apk`:`mantra-key-${l}-release.apk`;let C=(s.releaseSha256||"").trim().toLowerCase(),h=(s.debugSha256||"").trim().toLowerCase();if(!C&&!h)try{const E=await wt(l);E&&(C=E.release||E[`mantra-key-${l}-release.apk`]||"",h=E.debug||E[`mantra-key-${l}-debug.apk`]||"")}catch{}const w=t?h:C;return{version:r,versionTag:l,title:s.title||`密诀 MantraKey ${l}`,changelog:s.changelog||"常规功能优化与性能稳定性提升。",publishedAt:s.publishedAt||new Date().toLocaleDateString("zh-CN"),assetName:A,assetSizeText:s.assetSizeText||"约 15 MB",downloadUrl:g,rawDownloadUrl:b,releaseDownloadUrl:d,debugDownloadUrl:p,rawReleaseDownloadUrl:u,rawDebugDownloadUrl:c,releaseSha256:C,debugSha256:h,sha256:w,htmlUrl:`https://github.com/${j}/releases/tag/${l}`}}const it="ABCDEFGHJKLMNPQRSTUVWXYZ",rt="abcdefghijkmnopqrstuvwxyz",ct="23456789",Et="!@#$%^&*()-_=+[]{}|;:,.<>?",J=it+rt+ct+Et,At=it+rt+ct,St="0123456789",kt="mantra_key_salt_universal_2026",O={"standard-16":{name:"16位标准",length:16,charset:J,description:"字母+数字+特殊符号 (16位)"},"secure-20":{name:"20位高强",length:20,charset:J,description:"字母+数字+特殊符号 (20位)"},"super-32":{name:"32位极高安全",length:32,charset:J,description:"特权/高密凭据 (32位)"},"alphanumeric-16":{name:"16位无符号",length:16,charset:At,description:"仅字母与数字，适配限制特殊符号的旧网站"},"pin-6":{name:"6位PIN",length:6,charset:St,description:"纯数字 6 位 PIN 码"}};async function Ct(t){if(!t)return"";const e=new TextEncoder,a=await crypto.subtle.digest("SHA-256",e.encode(t));return Array.from(new Uint8Array(a)).map(o=>o.toString(16).padStart(2,"0")).join("").slice(0,8).toUpperCase()}async function $t(t,e=kt){const a=new TextEncoder,n=await crypto.subtle.importKey("raw",a.encode(t),{name:"PBKDF2"},!1,["deriveBits"]),o=await crypto.subtle.deriveBits({name:"PBKDF2",salt:a.encode(e),iterations:1e5,hash:"SHA-256"},n,256);return new Uint8Array(o)}function It(t,e,a){if(!e||a<=0||t.length===0)return"";const n=e.length,o=Math.floor(256/n)*n;let i="",s=0;for(;i.length<a&&s<t.length;){const r=t[s++];r<o&&(i+=e[r%n])}if(i.length<a){let r=0;for(;i.length<a;){const l=t[r%t.length];r++,l<o&&(i+=e[l%n])}}return i}async function Y(t,e,a="",n=1,o="standard-16"){if(!t.trim()||!e.trim())return"";const i=await $t(t),s=new TextEncoder,r=await crypto.subtle.importKey("raw",i,{name:"HKDF"},!1,["deriveBits"]),l=`mantra_v1:${e.toLowerCase().trim()}:${a.trim()}:${n}`,u=s.encode(l),c=await crypto.subtle.deriveBits({name:"HKDF",hash:"SHA-256",salt:new Uint8Array,info:u},r,512),d=new Uint8Array(c),p=O[o]||O["standard-16"];return It(d,p.charset,p.length)}const dt="mk_webdav_config",lt="mk_local_manifest",ut="mk_sync_status_info";function pt(t){if(!t)return"";const e=t.trim();return/^https?:\/\/dav\.jianguoyun\.com\/dav\/?$/i.test(e)?"https://dav.jianguoyun.com/dav/mantra-key":e}function Dt(){return{schemaVersion:1,canaryHash:"",domains:{},updatedAt:Date.now()}}function mt(){try{const t=localStorage.getItem(dt);if(t){const e=JSON.parse(t);return{...e,serverUrl:pt(e.serverUrl||"")}}}catch{}return{serverUrl:"",username:"",password:"",remoteFileName:"mantra_sync.mkey"}}function yt(t){try{const e={...t,serverUrl:pt(t.serverUrl)};localStorage.setItem(dt,JSON.stringify(e))}catch{}}function W(){try{const t=localStorage.getItem(lt);if(t)return JSON.parse(t)}catch{}return Dt()}function Q(t){try{localStorage.setItem(lt,JSON.stringify(t))}catch{}}function Bt(){try{const t=localStorage.getItem(ut);if(t)return JSON.parse(t)}catch{}return{status:"idle",lastSyncTime:"",message:"尚未同步",syncedDomainsCount:Object.keys(W().domains).length}}function Lt(t){try{localStorage.setItem(ut,JSON.stringify(t))}catch{}}function vt(t,e,a=""){const n=W(),o=t.trim().toLowerCase();if(!o)return n;const i=Date.now(),s=n.domains[o];return n.domains[o]={canonicalDomain:o,displayName:a||(s==null?void 0:s.displayName)||o,rulePreset:e,accounts:(s==null?void 0:s.accounts)||{},updatedAt:i},n.updatedAt=i,Q(n),n}function Nt(t){const e=W(),a=t.trim().toLowerCase();return e.domains[a]&&(delete e.domains[a],e.updatedAt=Date.now(),Q(e)),e}function Tt(t,e){const a={schemaVersion:Math.max(t.schemaVersion||1,e.schemaVersion||1),canaryHash:(e.updatedAt>t.updatedAt?e.canaryHash:t.canaryHash)||t.canaryHash||e.canaryHash,domains:{...t.domains},updatedAt:Math.max(t.updatedAt||0,e.updatedAt||0,Date.now())};for(const[n,o]of Object.entries(e.domains||{})){const i=a.domains[n];if(!i)a.domains[n]=o;else{const s=o.updatedAt>i.updatedAt?o:i,r={...i.accounts};for(const[l,u]of Object.entries(o.accounts||{})){const c=r[l];c?(u.version>c.version||u.version===c.version&&u.updatedAt>c.updatedAt)&&(r[l]=u):r[l]=u}a.domains[n]={canonicalDomain:s.canonicalDomain,displayName:s.displayName||i.displayName,rulePreset:s.rulePreset||i.rulePreset,accounts:r,updatedAt:Math.max(i.updatedAt,o.updatedAt)}}}return a}async function Mt(t,e){const a=new TextEncoder,n=a.encode(JSON.stringify(t));if(!e||!e.trim()){const d=new Uint8Array(3+n.length);return d[0]=77,d[1]=75,d[2]=0,d.set(n,3),d}const o=crypto.getRandomValues(new Uint8Array(16)),i=crypto.getRandomValues(new Uint8Array(12)),s=await crypto.subtle.importKey("raw",a.encode(e.trim()),{name:"PBKDF2"},!1,["deriveKey"]),r=await crypto.subtle.deriveKey({name:"PBKDF2",salt:o,iterations:1e5,hash:"SHA-256"},s,{name:"AES-GCM",length:256},!1,["encrypt"]),l=await crypto.subtle.encrypt({name:"AES-GCM",iv:i},r,n),u=new Uint8Array(l),c=new Uint8Array(31+u.length);return c[0]=77,c[1]=75,c[2]=1,c.set(o,3),c.set(i,19),c.set(u,31),c}async function tt(t,e){if(t.length===0)throw new Error("同步数据为空");const a=new TextDecoder;if(t[0]===123||t[0]===91)return{manifest:JSON.parse(a.decode(t)),isEncrypted:!1};if(t.length<3||t[0]!==77||t[1]!==75)throw new Error("无效的同步信封格式魔数");const n=t[2];if(n===0){const o=a.decode(t.slice(3));return{manifest:JSON.parse(o),isEncrypted:!1}}if(n===1){if(!e||!e.trim()){const c=new Error("检测到云端文件已启用端到端加密，请输入同步加密密码");throw c.code="NEED_SYNC_PASSWORD",c}if(t.length<47)throw new Error("加密信封数据损坏: 字节长度不足");const o=t.slice(3,19),i=t.slice(19,31),s=t.slice(31),r=new TextEncoder,l=await crypto.subtle.importKey("raw",r.encode(e.trim()),{name:"PBKDF2"},!1,["deriveKey"]),u=await crypto.subtle.deriveKey({name:"PBKDF2",salt:o,iterations:1e5,hash:"SHA-256"},l,{name:"AES-GCM",length:256},!1,["decrypt"]);try{const c=await crypto.subtle.decrypt({name:"AES-GCM",iv:i},u,s);return{manifest:JSON.parse(a.decode(c)),isEncrypted:!0}}catch{const d=new Error("同步加密密码不匹配，无法解密云端数据");throw d.code="PASSWORD_MISMATCH",d}}throw new Error(`不支持的同步信封版本: 0x${n.toString(16)}`)}async function G(t,e){const a=window.MantraNative||window.AlpineNative;if(a&&typeof a.nativeHttpRequest=="function"){let n="";if(e!=null&&e.body)if(e.body instanceof Uint8Array||e.body instanceof ArrayBuffer){const c=e.body instanceof Uint8Array?e.body:new Uint8Array(e.body);let d="";for(let p=0;p<c.length;p++)d+=String.fromCharCode(c[p]);n=btoa(d)}else typeof e.body=="string"&&(n=btoa(unescape(encodeURIComponent(e.body))));const o={};e!=null&&e.headers&&(e.headers instanceof Headers?e.headers.forEach((c,d)=>{o[d]=c}):Array.isArray(e.headers)?e.headers.forEach(([c,d])=>{o[c]=d}):Object.assign(o,e.headers));const i={url:t,method:((e==null?void 0:e.method)||"GET").toUpperCase(),headers:o,bodyBase64:n,timeoutMs:15e3},s=a.nativeHttpRequest(JSON.stringify(i)),r=JSON.parse(s);if(r.status===0&&!r.ok)throw new TypeError(`Failed to fetch (原生网络穿透代理异常: ${r.error||"Connection Failed"})`);const l=r.bodyBase64?atob(r.bodyBase64):"",u=new Uint8Array(l.length);for(let c=0;c<l.length;c++)u[c]=l.charCodeAt(c);return{status:r.status,statusText:r.statusText,ok:r.ok,headers:new Headers(r.headers||{}),arrayBuffer:async()=>u.buffer,text:async()=>new TextDecoder().decode(u),json:async()=>JSON.parse(new TextDecoder().decode(u))}}return fetch(t,e)}async function _t(t){let e=t.serverUrl.trim().replace(/\/+$/,"");if(!e)return{ok:!1,message:"WebDAV 服务器地址不能为空"};/^https?:\/\//i.test(e)||(e="https://"+e);const a="Basic "+btoa(`${t.username}:${t.password}`);try{const n=await G(e+"/",{method:"PROPFIND",headers:{Authorization:a,Depth:"0","Content-Type":"application/xml; charset=utf-8"},signal:AbortSignal.timeout(6e3)}).catch(async()=>G(e+"/",{method:"GET",headers:{Authorization:a},signal:AbortSignal.timeout(6e3)}));return n.status===401||n.status===403?{ok:!1,message:"认证失败: 用户名或密码/应用 Token 错误"}:n.status>=200&&n.status<400||n.status===207?{ok:!0,message:`连接成功 (HTTP ${n.status})`}:{ok:!1,message:`服务器返回状态异常: HTTP ${n.status}`}}catch(n){return{ok:!1,message:`网络连接异常: ${(n==null?void 0:n.message)||"无法访问该地址，请检查网络或 CORS 跨域"}`}}}async function Pt(t,e){var w,E;const a=t||mt();let n=a.serverUrl.trim().replace(/\/+$/,"");if(!n)return{ok:!1,message:"尚未配置 WebDAV 服务器地址",mergedCount:0};/^https?:\/\//i.test(n)||(n="https://"+n);const o=(a.remoteFileName||"mantra_sync.mkey").replace(/^\/+/,""),i=`${n}/${o}`,s="Basic "+btoa(`${a.username}:${a.password}`),r=W();let l=null,u=!1,c=a.syncPassword;try{const v=await G(i,{method:"GET",headers:{Authorization:s},signal:AbortSignal.timeout(8e3)});if(v.status===401||v.status===403)return{ok:!1,message:"WebDAV 认证失败，请检查用户名与应用密码",mergedCount:0};if(v.ok){const S=await v.arrayBuffer();if(S.byteLength>0){const B=new Uint8Array(S);try{const L=await tt(B,c);l=L.manifest,u=L.isEncrypted}catch(L){if(L.code==="NEED_SYNC_PASSWORD"&&e){const M=await e();if(!M||!M.trim())return{ok:!1,message:"同步已取消：云端数据已加密，需要同步密码方可合并",mergedCount:0};c=M.trim(),a.syncPassword=c,yt(a);const U=await tt(B,c);l=U.manifest,u=U.isEncrypted}else throw L}}}else if(v.status!==404)return{ok:!1,message:`获取远程同步文件失败: HTTP ${v.status}`,mergedCount:0}}catch(v){if((v==null?void 0:v.code)==="NEED_SYNC_PASSWORD"||(v==null?void 0:v.code)==="PASSWORD_MISMATCH"||(w=v==null?void 0:v.message)!=null&&w.includes("加密密码"))return{ok:!1,message:v.message,mergedCount:0};(E=v==null?void 0:v.message)!=null&&E.includes("404")||console.warn("[MantraKey Sync] 下载远程文件异常:",v)}let d=r;l&&(d=Tt(r,l)),d.updatedAt=Date.now(),Q(d);const p=await Mt(d,c),b=!u&&!!c;try{const v=await G(i,{method:"PUT",headers:{Authorization:s,"Content-Type":"application/octet-stream"},body:p,signal:AbortSignal.timeout(1e4)});if(!v.ok&&v.status!==201&&v.status!==204)return{ok:!1,message:`回写同步信封至 WebDAV 失败: HTTP ${v.status}`,mergedCount:0}}catch(v){return{ok:!1,message:`回写至 WebDAV 失败: ${(v==null?void 0:v.message)||"网络连接超时"}`,mergedCount:0}}const g=Object.keys(d.domains).length,A=new Date().toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit",second:"2-digit"}),C=b?`同步成功并已自动安全升格为 AES-256-GCM 加密存储！合并 ${g} 个站点规则`:`同步成功！已自动合并 ${g} 个站点规则`;return Lt({status:"success",lastSyncTime:A,message:C,syncedDomainsCount:g}),{ok:!0,message:C,mergedCount:g,upgradedToEncrypted:b}}function Rt(t){const u="-";function c(w,E,v){let S=0;for(w=v?Math.floor(w/700):w>>1,w+=Math.floor(w/E);w>35*26>>1;S+=36)w=Math.floor(w/35);return Math.floor(S+36*w/(w+38))}function d(w){return w-48<10?w-22:w-65<26?w-65:w-97<26?w-97:36}const p=[],b=t.lastIndexOf(u);let g=128,A=0,C=72;if(b>0)for(let w=0;w<b;++w)p.push(t.charCodeAt(w));let h=b>0?b+1:0;for(;h<t.length;){const w=A;let E=1;for(let S=36;;S+=36){if(h>=t.length)return t;const B=d(t.charCodeAt(h++));if(B>=36||B>Math.floor((2147483647-A)/E))return t;A+=B*E;const L=S<=C?1:S>=C+26?26:S-C;if(B<L)break;if(E>Math.floor(2147483647/(36-L)))return t;E*=36-L}const v=p.length+1;if(C=c(A-w,v,w===0),Math.floor(A/v)>2147483647-g)return t;g+=Math.floor(A/v),A%=v,p.splice(A++,0,g)}return String.fromCodePoint(...p)}function et(t){return!t||typeof t!="string"?"":t.split(".").map(e=>e.startsWith("xn--")?Rt(e.slice(4)):e).join(".")}function V(t,e=2500){const a=document.querySelector(".toast-container");a&&a.remove();const n=document.createElement("div");n.className="toast-container",n.textContent=t,document.body.appendChild(n),setTimeout(()=>{n.style.opacity="0",n.style.transition="opacity 0.25s ease",setTimeout(()=>n.remove(),250)},e)}function st(){const t=document.getElementById("app");!t||t.hasAttribute("data-mounted")||(t.setAttribute("data-mounted","true"),t.innerHTML=`
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

        <!-- 2. 已存站点与密码速查清单 (一等公民核心资产区) -->
        <section class="card vault-card" id="card-vault-list">
          <div class="card-header">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="card-title">📚 已存站点与密码速查</span>
              <span class="vault-count-badge" id="count-synced-rules">0</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <button type="button" class="btn-vault-header-action" id="btn-refresh-vault" title="刷新列表">🔄 刷新</button>
            </div>
          </div>

          <div class="vault-body">
            <!-- 实时快速搜索行 -->
            <div class="vault-search-row">
              <span class="vault-search-icon">🔍</span>
              <input
                type="text"
                id="input-vault-search"
                class="vault-search-input"
                placeholder="搜索域名、别名、用户名或规则..."
              />
              <button type="button" class="btn-clear-vault-search" id="btn-clear-vault-search" style="display: none;">✕</button>
            </div>

            <!-- 站点清单容器 (默认展开，触手可及) -->
            <div class="vault-sites-list" id="synced-rules-list">
              <!-- 动态渲染站点卡片 -->
            </div>
          </div>
        </section>

        <!-- 3. WebDAV 多端端到端加密同步面板 (E2EE + CRDT) -->
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
                <span class="ver-val" id="text-current-ver">v${at}</span>
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
  `,Ut(),Ht(),Ot(),Vt(),jt())}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",st):st();function Ut(){const t=document.getElementById("input-mantra"),e=document.getElementById("input-domain"),a=document.getElementById("btn-toggle-pwd"),n=document.getElementById("tag-canary"),o=document.getElementById("text-derived-pwd"),i=document.getElementById("text-rule-desc"),s=document.getElementById("btn-copy-pwd"),r=document.getElementById("btn-save-rule"),l=document.getElementById("preset-selector"),u=document.querySelectorAll(".chip-item");let c="standard-16";async function d(){if(!t||!e||!o)return;const p=t.value||"",b=e.value||"";if(n)if(p.trim()){const g=await Ct(p);n.textContent=`校验码: ${g}`}else n.textContent="校验码: --";if(!p.trim()||!b.trim()){!p.trim()&&!b.trim()?o.textContent="等待输入主口令与目标站点...":p.trim()?o.textContent="等待输入目标标识...":o.textContent="等待输入主口令...",o.style.color="#64748b",s&&(s.disabled=!0);return}try{const g=await Y(p,b,"",1,c);o.textContent=g,o.style.color="#00f0ff",s&&(s.disabled=!1)}catch(g){o.textContent="派生失败: "+((g==null?void 0:g.message)||"未知错误"),o.style.color="#ef4444",s&&(s.disabled=!0)}}t==null||t.addEventListener("input",d),e==null||e.addEventListener("input",()=>{const p=(e.value||"").trim().toLowerCase(),b=W();if(p&&b.domains[p]){const g=b.domains[p].rulePreset;g&&O[g]&&g!==c&&(c=g,l==null||l.querySelectorAll(".preset-btn").forEach(A=>{A.getAttribute("data-preset")===g?A.classList.add("active"):A.classList.remove("active")}),i&&(i.textContent=O[g].description+" (已匹配保存规则)"))}d()}),a==null||a.addEventListener("click",()=>{t&&(t.type==="password"?(t.type="text",a.textContent="👁️",a.title="点击隐藏口令"):(t.type="password",a.textContent="🙈",a.title="点击显示明文"))}),r==null||r.addEventListener("click",()=>{var b;const p=((e==null?void 0:e.value)||"").trim();if(!p){alert("请先输入目标站点或账号标识（例如 github.com）");return}vt(p,c),r.textContent="✅ 已记住！",(b=window.__refreshWebDAVRulesList)==null||b.call(window),setTimeout(()=>{r.textContent="📌 记住规则"},1500)}),u.forEach(p=>{p.addEventListener("click",()=>{const b=p.getAttribute("data-val");if(b&&e){e.value=b;const g=W(),A=b.toLowerCase();if(g.domains[A]){const C=g.domains[A].rulePreset;C&&O[C]&&(c=C,l==null||l.querySelectorAll(".preset-btn").forEach(h=>{h.getAttribute("data-preset")===C?h.classList.add("active"):h.classList.remove("active")}),i&&(i.textContent=O[C].description+" (已匹配保存规则)"))}d()}})}),l==null||l.addEventListener("click",p=>{const b=p.target,g=b.getAttribute("data-preset");g&&O[g]&&(c=g,l.querySelectorAll(".preset-btn").forEach(A=>A.classList.remove("active")),b.classList.add("active"),i&&(i.textContent=O[g].description),d())}),s==null||s.addEventListener("click",async()=>{const p=o==null?void 0:o.textContent;if(!(!p||p.includes("...")||p.includes("失败")||p.includes("等待")))try{await navigator.clipboard.writeText(p),s.textContent="✅ 已复制！",s.classList.add("copied"),setTimeout(()=>{s.textContent="📋 复制",s.classList.remove("copied")},1500)}catch{alert("已派生密码: "+p)}}),d()}function Ht(){const t=document.getElementById("btn-toggle-sync-config"),e=document.getElementById("sync-config-form"),a=document.getElementById("btn-sync-now"),n=document.getElementById("badge-sync-status"),o=document.getElementById("text-sync-last-time"),i=document.getElementById("input-webdav-url"),s=document.getElementById("input-webdav-user"),r=document.getElementById("input-webdav-pass"),l=document.getElementById("input-webdav-file"),u=document.getElementById("input-webdav-sync-pass"),c=document.getElementById("btn-toggle-sync-pass"),d=document.getElementById("btn-test-webdav"),p=document.getElementById("btn-save-webdav"),b=document.getElementById("btn-toggle-rules-list"),g=document.getElementById("synced-rules-list"),A=document.getElementById("arrow-rules-list"),C=document.getElementById("count-synced-rules"),h=document.getElementById("input-mantra");function w(x){const $=(x||"").trim();return/^https?:\/\/dav\.jianguoyun\.com\/dav\/?$/i.test($)?"https://dav.jianguoyun.com/dav/mantra-key":$}const E=mt();i&&(i.value=E.serverUrl||"https://dav.jianguoyun.com/dav/mantra-key"),s&&(s.value=E.username||""),r&&(r.value=E.password||""),l&&(l.value=E.remoteFileName||"mantra_sync.mkey"),u&&(u.value=E.syncPassword||""),c==null||c.addEventListener("click",()=>{if(!u)return;const x=u.type==="password";u.type=x?"text":"password",c.textContent=x?"👀":"🙈"}),i==null||i.addEventListener("blur",()=>{i.value&&(i.value=w(i.value))});function v(){const x=Bt(),$=W(),D=Object.keys($.domains||{}).length;C&&(C.textContent=String(D)),o&&(o.textContent=x.lastSyncTime?`上次同步: ${x.lastSyncTime}`:"上次同步: 尚未同步"),n&&(n.className="sync-status-tag "+(x.status||"idle"),x.status==="success"?n.textContent="🟢 已同步":x.status==="syncing"?n.textContent="🔄 同步中...":x.status==="error"?n.textContent="🔴 同步失败":n.textContent=E.serverUrl?"⚪ 待同步":"⚪ 未配置")}const S=document.getElementById("input-vault-search"),B=document.getElementById("btn-clear-vault-search"),L=document.getElementById("btn-refresh-vault");let M="";S==null||S.addEventListener("input",()=>{M=(S.value||"").trim().toLowerCase(),B&&(B.style.display=M?"block":"none"),U()}),B==null||B.addEventListener("click",()=>{S&&(S.value=""),M="",B&&(B.style.display="none"),U(),S==null||S.focus()}),L==null||L.addEventListener("click",()=>{U(),V("已刷新站点清单")});function U(){var T;if(!g)return;const x=W(),$=x.domains||{};let D=Object.keys($);if(C&&(C.textContent=String(D.length)),M&&(D=D.filter(m=>{const y=$[m];if(!y)return!1;const f=et(y.canonicalDomain).toLowerCase(),k=(y.canonicalDomain||"").toLowerCase(),I=(y.displayName||"").toLowerCase(),_=(y.rulePreset||"").toLowerCase(),P=Object.keys(y.accounts||{}).join(" ").toLowerCase();return f.includes(M)||k.includes(M)||I.includes(M)||_.includes(M)||P.includes(M)})),D.length===0){M?(g.innerHTML=`
          <div class="vault-empty-state">
            <span class="empty-icon">🔍</span>
            <div class="empty-title">未找到匹配站点</div>
            <div class="empty-text">没有与 "${M}" 匹配的域名或账号</div>
            <button type="button" class="btn-reset-search" id="btn-reset-search-empty">清空搜索词</button>
          </div>
        `,(T=document.getElementById("btn-reset-search-empty"))==null||T.addEventListener("click",()=>{S&&(S.value=""),M="",B&&(B.style.display="none"),U()})):g.innerHTML=`
          <div class="vault-empty-state">
            <span class="empty-icon">📂</span>
            <div class="empty-title">暂无已保存的站点与账号</div>
            <div class="empty-text">
              1. 在上方输入目标站点计算后点击「📌 记住规则」加入清单；<br/>
              2. 或在下方配置 WebDAV 一键双向同步即可同步全量密码库！
            </div>
          </div>
        `;return}g.innerHTML=D.sort((m,y)=>{const f=$[m];return($[y].updatedAt||0)-(f.updatedAt||0)}).map(m=>{const y=$[m],f=et(y.canonicalDomain),k=!!(y.displayName&&y.displayName!==y.canonicalDomain&&y.displayName!==f),I=k?y.displayName:f,_=k?f:f!==y.canonicalDomain?y.canonicalDomain:"",P=O[y.rulePreset]||O["standard-16"],q=(P==null?void 0:P.name)||y.rulePreset,R=Object.values(y.accounts||{}).filter(N=>!N.isDeleted),K=y.canonicalDomain.replace(/[^a-zA-Z0-9_-]/g,"_");let H="";if(R.length>0)H=R.map((N,F)=>{const z=`${K}_acc_${F}`;return`
              <div class="vault-account-row">
                <div class="acc-meta-left">
                  <span class="acc-user-badge">👤 ${N.username}</span>
                  <span class="acc-ver-badge">v${N.version||1}</span>
                </div>
                <div class="acc-actions-right">
                  <button type="button" class="btn-acc-action btn-load-to-panel" data-domain="${y.canonicalDomain}" data-user="${N.username}" data-preset="${y.rulePreset}" title="载入到上方主面板计算">
                    ⚡ 载入
                  </button>
                  <button type="button" class="btn-acc-action btn-copy-site-pwd" data-domain="${y.canonicalDomain}" data-user="${N.username}" data-ver="${N.version||1}" data-preset="${y.rulePreset}" data-title="${I}" title="直接计算并复制密码">
                    📋 复制密码
                  </button>
                  <button type="button" class="btn-acc-action btn-peek-site-pwd" data-target="peek-${z}" data-domain="${y.canonicalDomain}" data-user="${N.username}" data-ver="${N.version||1}" data-preset="${y.rulePreset}" title="查看计算密码">
                    👁️
                  </button>
                </div>
              </div>
              <div class="vault-peek-pwd-bar" id="peek-${z}" style="display: none;">
                <span class="peek-pwd-val">••••••••••••••••</span>
                <span class="peek-pwd-timer">5秒后自动隐蔽</span>
              </div>
            `}).join("");else{const N=`${K}_default`;H=`
            <div class="vault-account-row">
              <div class="acc-meta-left">
                <span class="acc-user-badge default-key">默认凭据 (未指定账号)</span>
              </div>
              <div class="acc-actions-right">
                <button type="button" class="btn-acc-action btn-load-to-panel" data-domain="${y.canonicalDomain}" data-user="" data-preset="${y.rulePreset}" title="载入到上方主面板计算">
                  ⚡ 载入
                </button>
                <button type="button" class="btn-acc-action btn-copy-site-pwd" data-domain="${y.canonicalDomain}" data-user="" data-ver="1" data-preset="${y.rulePreset}" data-title="${I}" title="直接计算并复制密码">
                  📋 复制密码
                </button>
                <button type="button" class="btn-acc-action btn-peek-site-pwd" data-target="peek-${N}" data-domain="${y.canonicalDomain}" data-user="" data-ver="1" data-preset="${y.rulePreset}" title="查看计算密码">
                  👁️
                </button>
              </div>
            </div>
            <div class="vault-peek-pwd-bar" id="peek-${N}" style="display: none;">
              <span class="peek-pwd-val">••••••••••••••••</span>
              <span class="peek-pwd-timer">5秒后自动隐蔽</span>
            </div>
          `}return`
          <div class="vault-site-card" data-domain="${y.canonicalDomain}">
            <div class="vault-site-header">
              <div class="vault-site-info">
                <div class="vault-site-title-row">
                  <span class="vault-site-name">${k?"🏷️ ":"🌐 "}${I}</span>
                  <button type="button" class="btn-edit-alias-inline" data-domain="${y.canonicalDomain}" data-name="${y.displayName||""}" title="修改站点别名/备注">✏️</button>
                </div>
                ${_?`<span class="vault-site-sub">🌐 ${_}</span>`:""}
              </div>
              <div class="vault-site-meta">
                <span class="vault-preset-pill">${q}</span>
                <button type="button" class="btn-del-site-rule" data-del="${y.canonicalDomain}" data-name="${I}" title="从清单移除">✕</button>
              </div>
            </div>
            <div class="vault-accounts-box">
              ${H}
            </div>
          </div>
        `}).join(""),g.querySelectorAll(".btn-load-to-panel").forEach(m=>{m.addEventListener("click",y=>{var I,_;y.stopPropagation();const f=m.getAttribute("data-domain")||"",k=m.getAttribute("data-preset")||"standard-16";inputDomain&&(inputDomain.value=f),O[k]&&(currentPreset=k,presetSelector==null||presetSelector.querySelectorAll(".preset-btn").forEach(P=>{P.getAttribute("data-preset")===k?P.classList.add("active"):P.classList.remove("active")}),textRuleDesc&&(textRuleDesc.textContent=O[k].description+" (已匹配站点规则)")),compute(),(I=document.getElementById("card-generator"))==null||I.scrollIntoView({behavior:"smooth"}),(_=h==null?void 0:h.value)!=null&&_.trim()?V(`已载入站点 [${f}]，密码已现场计算`):(h==null||h.focus(),V(`已载入站点 [${f}]，请输入主口令查看计算密码`))})}),g.querySelectorAll(".btn-copy-site-pwd").forEach(m=>{m.addEventListener("click",async y=>{var R,K;y.stopPropagation();const f=((R=h==null?void 0:h.value)==null?void 0:R.trim())||"",k=m.getAttribute("data-domain")||"",I=m.getAttribute("data-user")||"",_=parseInt(m.getAttribute("data-ver")||"1",10),P=m.getAttribute("data-preset")||"standard-16",q=m.getAttribute("data-title")||k;if(!f){(K=document.getElementById("card-generator"))==null||K.scrollIntoView({behavior:"smooth"}),h==null||h.focus(),V("💡 请先在上方输入您的主口令，即可一键复制密码");return}try{const H=m.textContent;m.textContent="⏳ 计算中...";const N=await Y(f,k,I,_,P);await navigator.clipboard.writeText(N),m.textContent="✅ 已复制！",m.classList.add("copied"),V(`🎉 已成功计算并复制 [${q}${I?` - ${I}`:""}] 的密码！`),setTimeout(()=>{m.textContent=H,m.classList.remove("copied")},2e3)}catch(H){V(`❌ 密码计算失败: ${(H==null?void 0:H.message)||"未知错误"}`)}})}),g.querySelectorAll(".btn-peek-site-pwd").forEach(m=>{m.addEventListener("click",async y=>{var K,H;y.stopPropagation();const f=((K=h==null?void 0:h.value)==null?void 0:K.trim())||"",k=m.getAttribute("data-domain")||"",I=m.getAttribute("data-user")||"",_=parseInt(m.getAttribute("data-ver")||"1",10),P=m.getAttribute("data-preset")||"standard-16",q=m.getAttribute("data-target")||"",R=document.getElementById(q);if(!f){(H=document.getElementById("card-generator"))==null||H.scrollIntoView({behavior:"smooth"}),h==null||h.focus(),V("💡 请先在上方输入您的主口令，即可查看密码");return}if(R){if(R.style.display!=="none"){R.style.display="none",m.textContent="👁️";return}try{const N=await Y(f,k,I,_,P),F=R.querySelector(".peek-pwd-val");F&&(F.textContent=N),R.style.display="flex",m.textContent="🙈";let z=5;const X=R.querySelector(".peek-pwd-timer"),gt=setInterval(()=>{z--,X&&(X.textContent=`${z}秒后自动隐蔽`),z<=0&&(clearInterval(gt),R.style.display="none",m.textContent="👁️",F&&(F.textContent="••••••••••••••••"))},1e3)}catch(N){V(`❌ 密码派生异常: ${(N==null?void 0:N.message)||"未知错误"}`)}}})}),g.querySelectorAll(".btn-edit-alias-inline").forEach(m=>{m.addEventListener("click",y=>{y.stopPropagation();const f=m.getAttribute("data-domain")||"",k=m.getAttribute("data-name")||"",I=window.prompt(`为站点 [${f}] 设置别名/备注名称:`,k);if(I!==null){const _=x.domains[f];_&&(vt(f,_.rulePreset,I.trim()),U(),v(),V(`✅ 已更新站点 [${f}] 的别名`))}})}),g.querySelectorAll(".btn-del-site-rule").forEach(m=>{m.addEventListener("click",y=>{y.stopPropagation();const f=m.getAttribute("data-del"),k=m.getAttribute("data-name")||f;f&&window.confirm(`确定要从清单中移除站点 [${k}] 吗？`)&&(Nt(f),U(),v(),V(`已移除站点 [${k}]`))})})}window.__refreshWebDAVRulesList=()=>{U(),v()},t==null||t.addEventListener("click",()=>{if(!e)return;const x=e.style.display==="none";e.style.display=x?"flex":"none",t&&(t.textContent=x?"✕ 收起":"⚙️ 配置")}),b==null||b.addEventListener("click",()=>{if(!g||!A)return;const x=g.style.display==="none";g.style.display=x?"flex":"none",A.textContent=x?"▲":"▼"}),p==null||p.addEventListener("click",()=>{var $,D,T,m;const x={serverUrl:w((i==null?void 0:i.value)||""),username:(($=s==null?void 0:s.value)==null?void 0:$.trim())||"",password:((D=r==null?void 0:r.value)==null?void 0:D.trim())||"",remoteFileName:((T=l==null?void 0:l.value)==null?void 0:T.trim())||"mantra_sync.mkey",syncPassword:((m=u==null?void 0:u.value)==null?void 0:m.trim())||""};yt(x),v(),p&&(p.textContent="✅ 已保存配置！",setTimeout(()=>p.textContent="💾 保存配置",1500))}),d==null||d.addEventListener("click",async()=>{var $,D,T,m,y;const x={serverUrl:(($=i==null?void 0:i.value)==null?void 0:$.trim())||"",username:((D=s==null?void 0:s.value)==null?void 0:D.trim())||"",password:((T=r==null?void 0:r.value)==null?void 0:T.trim())||"",remoteFileName:((m=l==null?void 0:l.value)==null?void 0:m.trim())||"mantra_sync.mkey",syncPassword:((y=u==null?void 0:u.value)==null?void 0:y.trim())||""};d&&(d.textContent="⏳ 正在探测...");try{const f=await _t(x);alert(f.ok?`✅ ${f.message}`:`❌ ${f.message}`)}catch(f){alert(`❌ 探测异常: ${(f==null?void 0:f.message)||"未知错误"}`)}finally{d&&(d.textContent="⚡ 测试连通性")}});function ft(){return new Promise(x=>{const $=document.getElementById("sync-pass-modal-overlay"),D=document.getElementById("modal-sync-pass-input"),T=document.getElementById("btn-modal-sync-cancel"),m=document.getElementById("btn-modal-sync-confirm");if(!$||!D){const I=prompt("检测到云端文件已加密，请输入同步加密密码：");x(I||"");return}D.value="",$.style.display="flex",D.focus();const y=()=>{$.style.display="none",T==null||T.removeEventListener("click",f),m==null||m.removeEventListener("click",k)},f=()=>{y(),x("")},k=()=>{const I=D.value.trim();y(),x(I)};T==null||T.addEventListener("click",f),m==null||m.addEventListener("click",k)})}a==null||a.addEventListener("click",async()=>{var $,D,T,m,y;const x={serverUrl:(($=i==null?void 0:i.value)==null?void 0:$.trim())||"",username:((D=s==null?void 0:s.value)==null?void 0:D.trim())||"",password:((T=r==null?void 0:r.value)==null?void 0:T.trim())||"",remoteFileName:((m=l==null?void 0:l.value)==null?void 0:m.trim())||"mantra_sync.mkey",syncPassword:((y=u==null?void 0:u.value)==null?void 0:y.trim())||""};if(!x.serverUrl){e&&(e.style.display="flex"),alert("请先在「⚙️ 配置」中填入您的 WebDAV 服务器地址与账号密码");return}n&&(n.className="sync-status-tag syncing",n.textContent="🔄 同步中..."),a&&(a.textContent="⏳ 同步中...");try{const f=await Pt(x,ft);f.upgradedToEncrypted&&u&&(u.value=x.syncPassword||""),v(),U(),alert(f.ok?`🎉 ${f.message}`:`⚠️ 同步未完成: ${f.message}`)}catch(f){alert(`❌ 同步发生异常: ${(f==null?void 0:f.message)||"未知错误"}`),v()}finally{a&&(a.textContent="🔄 立即双向同步"),v()}}),v(),U()}function Ot(){const t=document.getElementById("btn-open-autofill-settings"),e=document.getElementById("btn-open-ime-settings"),a=document.getElementById("badge-autofill"),n=document.getElementById("badge-ime");function o(){const d=typeof window<"u"?window.MantraNative:null;a&&(d!=null&&d.isAutofillEnabled?d.isAutofillEnabled()?(a.textContent="🟢 运行中",a.className="service-status-badge active"):(a.textContent="⚠️ 未开启",a.className="service-status-badge inactive"):(a.textContent="系统管理",a.className="service-status-badge checking")),n&&(d!=null&&d.isImeEnabled?d.isImeEnabled()?(n.textContent="🟢 已就绪",n.className="service-status-badge active"):(n.textContent="⚠️ 未开启",n.className="service-status-badge inactive"):(n.textContent="系统管理",n.className="service-status-badge checking"))}typeof window<"u"&&(window.onMantraResume=()=>{o()}),t==null||t.addEventListener("click",()=>{var d;typeof window<"u"&&((d=window.MantraNative)!=null&&d.openAutofillSettings)?window.MantraNative.openAutofillSettings():alert("请前往 Android 系统设置 -> 辅助功能 / 自动填充服务 中启用「密诀」")}),e==null||e.addEventListener("click",()=>{var d;typeof window<"u"&&((d=window.MantraNative)!=null&&d.openImeSettings)?window.MantraNative.openImeSettings():alert("请前往 Android 系统设置 -> 语言与输入法 中勾选并激活「密诀辅助键盘」")});const i=document.getElementById("btn-open-onboarding"),s=document.getElementById("onboarding-overlay"),r=document.getElementById("btn-close-onboarding"),l=document.getElementById("btn-confirm-onboarding"),u=document.getElementById("btn-guide-autofill"),c=document.getElementById("btn-guide-ime");i==null||i.addEventListener("click",()=>{s&&(s.style.display="flex")}),r==null||r.addEventListener("click",()=>{s&&(s.style.display="none")}),l==null||l.addEventListener("click",()=>{var d;s&&(s.style.display="none"),localStorage.setItem("mk_onboarding_guided","true"),typeof window<"u"&&((d=window.MantraNative)!=null&&d.setFirstLaunchCompleted)&&window.MantraNative.setFirstLaunchCompleted()}),u==null||u.addEventListener("click",()=>{var d;typeof window<"u"&&((d=window.MantraNative)!=null&&d.openAutofillSettings)&&window.MantraNative.openAutofillSettings()}),c==null||c.addEventListener("click",()=>{var d;typeof window<"u"&&((d=window.MantraNative)!=null&&d.openImeSettings)&&window.MantraNative.openImeSettings()}),o()}function jt(){const t=typeof window<"u"?window.MantraNative:null;(t!=null&&t.isFirstLaunch?t.isFirstLaunch():!localStorage.getItem("mk_onboarding_guided"))&&!localStorage.getItem("mk_onboarding_guided")&&setTimeout(()=>{const a=document.getElementById("onboarding-overlay");a&&(a.style.display="flex")},600)}function Vt(){const t=document.getElementById("btn-check-update"),e=document.getElementById("text-latest-ver"),a=document.getElementById("update-status-badge"),n=document.getElementById("update-detail-box"),o=document.getElementById("text-release-title"),i=document.getElementById("text-release-notes"),s=document.getElementById("btn-action-update");let r=null;async function l(){if(!(!e||!a)){e.textContent="检查中...",a.textContent="检测中",a.className="update-status checking";try{r=await xt(!1),e.textContent=r.versionTag,ot(at,r.version)>0?(a.textContent="发现新版本",a.className="update-status has-update",n&&o&&i&&(n.style.display="flex",o.textContent=`${r.title} (${r.assetSizeText})`,i.textContent=r.changelog)):(a.textContent="已是最新",a.className="update-status latest",n&&(n.style.display="none"))}catch{e.textContent="检测超时",a.textContent="离线/超时",a.className="update-status error"}}}t==null||t.addEventListener("click",l),setTimeout(l,1e3),s==null||s.addEventListener("click",()=>{var c;if(!r)return;const u=r.downloadUrl;if(typeof window<"u"&&((c=window.MantraNative)!=null&&c.downloadAndInstallApk)){window.MantraNative.downloadAndInstallApk(u,r.versionTag,r.sha256);return}window.open(u,"_blank")}),typeof window<"u"&&(window.onMantraDownloadProgress=u=>{const c=document.getElementById("download-progress-row"),d=document.getElementById("update-progress-fill"),p=document.getElementById("update-progress-text");if(c&&d&&p){c.style.display="flex";const b=Math.max(0,Math.min(100,u.percent||0));d.style.width=`${b}%`,p.textContent=`${b}% (${u.message||""})`}})}
