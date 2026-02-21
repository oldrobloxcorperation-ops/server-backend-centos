/**
 * CentOS Web — Proxy Backend  (server.js)
 * ─────────────────────────────────────────
 * Enhanced: Full audio/video support, range-request seeking,
 *           complete navigation/redirect containment.
 *
 * Vercel-compatible: exports `app` as the default export.
 * For local dev, the bottom of the file calls app.listen()
 * only when run directly (not imported by Vercel).
 */

const express  = require('express');
const axios    = require('axios');
const cors     = require('cors');
const cheerio  = require('cheerio');
const https    = require('https');
const http     = require('http');

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*', methods: ['GET','POST','OPTIONS','HEAD'] }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// Root route
app.get('/', (req, res) => {
  const host = req.get('host');
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Content-Security-Policy', 'frame-ancestors *');
  res.removeHeader('X-Frame-Options');
  res.send('<!DOCTYPE html><html><head>'
    + '<meta charset="UTF-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>CentOS Search</title>'
    + '<style>'
    + '*{margin:0;padding:0;box-sizing:border-box}'
    + 'html,body{height:100%}'
    + 'body{font-family:"Segoe UI",system-ui,sans-serif;background:#0a0a18;color:#f0f0f5;display:flex;flex-direction:column;}'
    + '.page{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;gap:32px}'
    + '.brand{display:flex;flex-direction:column;align-items:center;gap:10px}'
    + '.brand-icon{font-size:3.5rem;line-height:1}'
    + '.brand-name{font-size:2.4rem;font-weight:800;letter-spacing:-0.5px;'
    + '  background:linear-gradient(135deg,#6c8eff 0%,#a78bfa 50%,#4ce8a0 100%);'
    + '  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}'
    + '.brand-tag{font-size:13px;color:rgba(255,255,255,0.35);letter-spacing:0.05em}'
    + '.search-box{width:100%;max-width:580px;display:flex;flex-direction:column;gap:12px}'
    + '.search-row{display:flex;gap:0;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:32px;overflow:hidden;transition:border-color 0.2s,box-shadow 0.2s}'
    + '.search-row:focus-within{border-color:rgba(108,142,255,0.6);box-shadow:0 0 0 3px rgba(108,142,255,0.12)}'
    + '.search-inp{flex:1;background:transparent;border:none;padding:14px 22px;color:#fff;font-size:16px;outline:none}'
    + '.search-inp::placeholder{color:rgba(255,255,255,0.3)}'
    + '.search-btn{background:linear-gradient(135deg,#6c8eff,#a78bfa);border:none;padding:12px 24px;color:#fff;font-size:14px;font-weight:600;cursor:pointer;border-radius:0 32px 32px 0;white-space:nowrap;transition:opacity 0.2s}'
    + '.search-btn:hover{opacity:0.85}'
    + '.quick-links{display:flex;flex-wrap:wrap;justify-content:center;gap:8px}'
    + '.ql{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.09);border-radius:20px;padding:6px 14px;font-size:12px;color:rgba(255,255,255,0.45);cursor:pointer;transition:all 0.2s;text-decoration:none}'
    + '.ql:hover{background:rgba(108,142,255,0.15);border-color:rgba(108,142,255,0.4);color:#6c8eff}'
    + '.footer{padding:16px;text-align:center;font-size:11px;color:rgba(255,255,255,0.15)}'
    + '.status{display:inline-flex;align-items:center;gap:5px}'
    + '.dot{width:6px;height:6px;border-radius:50%;background:#4ce8a0;box-shadow:0 0 6px #4ce8a0}'
    + '</style>'
    + '</head><body>'
    + '<div class="page">'
    + '  <div class="brand">'
    + '    <span class="brand-icon">&#x2B21;</span>'
    + '    <span class="brand-name">CentOS Search</span>'
    + '    <span class="brand-tag">Private &bull; Fast &bull; Proxied</span>'
    + '  </div>'
    + '  <div class="search-box">'
    + '    <form class="search-row" id="sf">'
    + '      <input class="search-inp" id="qi" placeholder="Search the web or enter a URL..." autofocus autocomplete="off" spellcheck="false"/>'
    + '      <button class="search-btn" type="submit">Search</button>'
    + '    </form>'
    + '    <div class="quick-links">'
    + '      <a class="ql" data-url="https://youtube.com">YouTube</a>'
    + '      <a class="ql" data-url="https://reddit.com">Reddit</a>'
    + '      <a class="ql" data-url="https://github.com">GitHub</a>'
    + '      <a class="ql" data-url="https://twitter.com">Twitter / X</a>'
    + '      <a class="ql" data-url="https://wikipedia.org">Wikipedia</a>'
    + '      <a class="ql" data-url="https://twitch.tv">Twitch</a>'
    + '      <a class="ql" data-url="https://instagram.com">Instagram</a>'
    + '      <a class="ql" data-url="https://discord.com">Discord</a>'
    + '    </div>'
    + '  </div>'
    + '</div>'
    + '<div class="footer"><span class="status"><span class="dot"></span> Online</span> &mdash; CentOS Web Proxy</div>'
    + '<script>'
    + 'var HOST="' + host + '";'
    + 'function navTo(u){try{window.parent.postMessage({type:"centos-nav",url:u},"*")}catch(e){}setTimeout(function(){if(window.parent===window)window.location.href=u;},80);}'
    + 'document.getElementById("sf").addEventListener("submit",function(e){'
    + '  e.preventDefault();'
    + '  var v=document.getElementById("qi").value.trim();'
    + '  if(!v)return;'
    + '  if(/^https?:\\/\\//.test(v)||(/^[\\w-]+\\.\\w{2,}/.test(v)&&!v.includes(" "))){' 
    + '    var url=(/^https?:\\/\\//.test(v)?v:"https://"+v);'
    + '    navTo("https://"+HOST+"/proxy?url="+encodeURIComponent(url));'
    + '  } else {'
    + '    navTo("https://"+HOST+"/search?q="+encodeURIComponent(v)+"&page=1");'
    + '  }'
    + '});'
    + 'document.addEventListener("click",function(e){'
    + '  var a=e.target.closest("a[data-url]");'
    + '  if(!a)return;'
    + '  e.preventDefault();'
    + '  navTo("https://"+HOST+"/proxy?url="+encodeURIComponent(a.getAttribute("data-url")));'
    + '});'
    + '<\/script>'
    + '</body></html>'
  );
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', server: 'CentOS Web Proxy', port: PORT });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function resolveUrl(base, rel) {
  if (!rel) return '';
  if (/^(data:|javascript:|mailto:|tel:)/.test(rel)) return rel;
  if (rel.startsWith('//')) return 'https:' + rel;
  try { return new URL(rel, base).href; } catch { return rel; }
}
function makeProxyUrl(targetUrl, host) {
  if (!targetUrl || /^(javascript:|data:|#|blob:)/.test(targetUrl)) return targetUrl;
  if (targetUrl.includes('/proxy?url=')) return targetUrl; // already proxied
  return `https://${host}/proxy?url=${encodeURIComponent(targetUrl)}`;
}
function rewriteCss(css, base, host) {
  if (!css) return css;
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (_, q, u) => {
    const abs = resolveUrl(base, u.trim());
    if (!abs || abs.startsWith('data:')) return `url(${q}${u}${q})`;
    return `url("${makeProxyUrl(abs, host)}")`;
  });
}

// ─── Injected JS — runs inside every proxied HTML page ────────────────────────
// Intercepts: fetch, XHR, history, location.href, window.open,
//             link clicks, form submits, dynamic <script>/<link>,
//             service worker registration, meta-refresh,
//             document.createElement for iframes/scripts,
//             EventSource (SSE), MediaSource segment fetches.
function injectedJs(pageUrl, host) {
  const P = 'https://' + host + '/proxy?url=';
  return `<script>
(function(){
  var P=${JSON.stringify(P)}, B=${JSON.stringify(pageUrl)};

  function safeResolve(u){
    if(!u) return null;
    var s=String(u);
    if(/^(javascript:|data:|blob:|#|mailto:|tel:)/.test(s)) return null;
    if(/^https?:\\/\\//.test(s)) return s;
    if(s.startsWith('//')) return 'https:'+s;
    if(B && /^https?:\\/\\//.test(B)){ try{ return new URL(s,B).href; }catch(e){ return null; } }
    return null;
  }

  function toProxy(u){
    var r=safeResolve(u); if(!r) return null;
    if(r.includes('/proxy?url=')) return r;
    return P+encodeURIComponent(r);
  }

  function navTo(url){
    var r=safeResolve(url); if(!r) return;
    var proxied=P+encodeURIComponent(r);
    try{ window.parent.postMessage({type:'centos-nav',url:proxied},'*'); }catch(e){}
    if(window.parent===window) window.location.href=proxied;
  }

  // ── Block service workers (they can escape the proxy) ──
  if(navigator.serviceWorker){
    try{
      navigator.serviceWorker.register=function(){ return Promise.resolve(); };
      navigator.serviceWorker.getRegistrations=function(){ return Promise.resolve([]); };
    }catch(e){}
  }

  // ── Fetch: proxy all HTTP/HTTPS ──
  var _f=window.fetch;
  window.fetch=function(r,o){
    try{
      if(typeof r==='string'&&/^https?:/.test(r)&&!r.includes('/proxy?url=')) r=P+encodeURIComponent(r);
      else if(r&&typeof r==='object'&&r.url&&/^https?:/.test(r.url)&&!r.url.includes('/proxy?url=')){
        r=new Request(P+encodeURIComponent(r.url),r);
      }
    }catch(e){}
    return _f.call(this,r,o);
  };

  // ── XHR ──
  var _x=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(m,u){
    try{ if(typeof u==='string'&&/^https?:/.test(u)&&!u.includes('/proxy?url=')) u=P+encodeURIComponent(u); }catch(e){}
    return _x.apply(this,arguments);
  };

  // ── EventSource (SSE) ──
  if(window.EventSource){
    var _ES=window.EventSource;
    window.EventSource=function(url,cfg){
      if(typeof url==='string'&&/^https?:/.test(url)&&!url.includes('/proxy?url='))
        url=P+encodeURIComponent(url);
      return new _ES(url,cfg);
    };
    window.EventSource.prototype=_ES.prototype;
  }

  // ── WebSocket: direct (ws/wss) — NOT proxied, goes straight through user's network ──
  // window.WebSocket is intentionally left untouched.

  // ── window.open ──
  var _open=window.open;
  window.open=function(url,target,features){
    if(url&&typeof url==='string'&&!/^(javascript:|data:|#|blob:)/.test(url)){
      var r=safeResolve(url);
      if(r) return _open.call(this,P+encodeURIComponent(r),'_blank',features);
    }
    return _open.apply(this,arguments);
  };

  // ── Webpack public path patch ──
  try{
    if(typeof __webpack_require__!=='undefined'&&__webpack_require__.p){
      var op=__webpack_require__.p;
      var ap=safeResolve(op)||op;
      __webpack_require__.p=P+encodeURIComponent(ap.endsWith('/')?ap:ap+'/');
    }
  }catch(e){}

  // ── history ──
  var _push=history.pushState, _repl=history.replaceState;
  function interceptState(u){
    if(!u) return false;
    var r=safeResolve(u); if(!r) return false;
    navTo(r); return true;
  }
  history.pushState=function(s,t,u){ if(u&&interceptState(u)) return; return _push.apply(this,arguments); };
  history.replaceState=function(s,t,u){ if(u&&interceptState(u)) return; return _repl.apply(this,arguments); };

  // ── location.href / assign / replace ──
  function interceptLoc(u){ var r=safeResolve(u); if(!r) return false; navTo(r); return true; }
  try{
    var _ld=Object.getOwnPropertyDescriptor(Location.prototype,'href');
    if(_ld&&_ld.set){
      Object.defineProperty(Location.prototype,'href',{ get:_ld.get, set:function(u){ if(interceptLoc(u)) return; _ld.set.call(this,u); } });
    }
    Location.prototype.assign=function(u){ if(interceptLoc(u)) return; window.location.href=u; };
    Location.prototype.replace=function(u){ if(interceptLoc(u)) return; if(_ld&&_ld.set) _ld.set.call(this,u); };
  }catch(e){}

  // ── document.createElement — intercept dynamically created iframes, scripts, audio, video ──
  var _dce=document.createElement.bind(document);
  document.createElement=function(tag){
    var el=_dce(tag);
    var t=String(tag).toLowerCase();
    if(t==='iframe'||t==='frame'){
      var srcDesc=Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype,'src') ||
                  Object.getOwnPropertyDescriptor(Element.prototype,'src');
      try{
        Object.defineProperty(el,'src',{
          get:function(){ return srcDesc?srcDesc.get.call(this):this.getAttribute('src'); },
          set:function(v){
            var r=safeResolve(v);
            var val=r?P+encodeURIComponent(r):v;
            if(srcDesc&&srcDesc.set) srcDesc.set.call(this,val); else this.setAttribute('src',val);
          }
        });
      }catch(e){}
    }
    if(t==='script'){
      var sSrc=Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype,'src');
      try{
        Object.defineProperty(el,'src',{
          get:function(){ return sSrc?sSrc.get.call(this):''; },
          set:function(v){
            var r=safeResolve(v);
            var val=(r&&!r.includes('/proxy?url='))?P+encodeURIComponent(r):v;
            if(sSrc&&sSrc.set) sSrc.set.call(this,val);
          }
        });
      }catch(e){}
    }
    if(t==='audio'||t==='video'){
      try{
        var mSrc=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'src');
        Object.defineProperty(el,'src',{
          get:function(){ return mSrc?mSrc.get.call(this):''; },
          set:function(v){
            if(v&&typeof v==='string'&&/^https?:/.test(v)&&!v.includes('/proxy?url=')){
              v=P+encodeURIComponent(v);
            }
            if(mSrc&&mSrc.set) mSrc.set.call(this,v); else el.setAttribute('src',v);
          }
        });
      }catch(e){}
    }
    return el;
  };

  // ── Link clicks ──
  document.addEventListener('click',function(e){
    var a=e.target.closest('a'); if(!a) return;
    var h=a.getAttribute('href');
    if(!h||/^(#|javascript:|mailto:|tel:)/.test(h)) return;
    e.preventDefault(); e.stopPropagation();
    var r=safeResolve(h); if(r) navTo(r);
  },true);

  // ── Form submits ──
  document.addEventListener('submit',function(e){
    var f=e.target, m=(f.method||'GET').toUpperCase();
    var action=f.getAttribute('action');
    if(m==='GET'){
      e.preventDefault();
      var base=safeResolve(action||B); if(!base) return;
      navTo(base+'?'+new URLSearchParams(new FormData(f)));
    } else if(m==='POST'){
      e.preventDefault();
      var base2=safeResolve(action||B); if(!base2) return;
      var fd=new FormData(f);
      fetch(P+encodeURIComponent(base2),{ method:'POST', body:fd })
        .then(r=>r.text()).then(html=>{ document.open(); document.write(html); document.close(); })
        .catch(()=>{});
    }
  },true);

  // ── MutationObserver — dynamically injected tags ──
  try{
    new MutationObserver(function(muts){
      muts.forEach(function(m){
        m.addedNodes.forEach(function(node){
          if(!node.tagName) return;
          var tag=node.tagName.toUpperCase();
          if(tag==='SCRIPT'&&node.src&&/^https?:/.test(node.src)&&!node.src.includes('/proxy?url='))
            node.src=P+encodeURIComponent(node.src);
          if(tag==='LINK'&&node.href&&/^https?:/.test(node.href)&&!node.href.includes('/proxy?url='))
            node.href=P+encodeURIComponent(node.href);
          if((tag==='IMG'||tag==='SOURCE')&&node.src&&/^https?:/.test(node.src)&&!node.src.includes('/proxy?url='))
            node.src=P+encodeURIComponent(node.src);
          if((tag==='AUDIO'||tag==='VIDEO')&&node.src&&/^https?:/.test(node.src)&&!node.src.includes('/proxy?url='))
            node.src=P+encodeURIComponent(node.src);
          if((tag==='IFRAME'||tag==='FRAME')&&node.src&&/^https?:/.test(node.src)&&!node.src.includes('/proxy?url='))
            node.src=P+encodeURIComponent(node.src);
          // Lazy-load data-src attributes
          ['data-src','data-lazy','data-original','data-lazy-src'].forEach(function(attr){
            var v=node.getAttribute&&node.getAttribute(attr);
            if(v&&/^https?:/.test(v)) node.setAttribute(attr,P+encodeURIComponent(v));
          });
        });
      });
    }).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['src','href','data-src']});
  }catch(e){}

  // ── HTMLMediaElement.prototype.load / src setter ──
  // Intercept direct .src assignments on <audio> and <video> after parse
  try{
    var mProto=HTMLMediaElement.prototype;
    var mSrcDesc=Object.getOwnPropertyDescriptor(mProto,'src');
    if(mSrcDesc&&mSrcDesc.set){
      Object.defineProperty(mProto,'src',{
        get:mSrcDesc.get,
        set:function(v){
          if(v&&typeof v==='string'&&/^https?:/.test(v)&&!v.includes('/proxy?url='))
            v=P+encodeURIComponent(v);
          mSrcDesc.set.call(this,v);
        },
        configurable:true
      });
    }
  }catch(e){}

  // ── HTMLImageElement src ──
  try{
    var iSrcDesc=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
    if(iSrcDesc&&iSrcDesc.set){
      Object.defineProperty(HTMLImageElement.prototype,'src',{
        get:iSrcDesc.get,
        set:function(v){
          if(v&&typeof v==='string'&&/^https?:/.test(v)&&!v.includes('/proxy?url='))
            v=P+encodeURIComponent(v);
          iSrcDesc.set.call(this,v);
        },
        configurable:true
      });
    }
  }catch(e){}

})();
<\/script>`;
}

// ─── Search helpers ───────────────────────────────────────────────────────────
async function fetchTavily(q) {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new Error('TAVILY_API_KEY not set');
  const resp = await axios.post(
    'https://api.tavily.com/search',
    { api_key: key, query: q, num_results: 50 },
    { timeout: 10000, httpsAgent, validateStatus: () => true,
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' } }
  );
  if (resp.status !== 200) {
    const errMsg = (resp.data && resp.data.message) || JSON.stringify(resp.data || {}).substring(0, 200);
    throw new Error('Tavily HTTP ' + resp.status + ': ' + errMsg);
  }
  const items = (resp.data && resp.data.results) || [];
  return items.map(r => ({ title: r.title||'', href: r.url||'', snippet: r.content||'', displayUrl: r.url||'' }))
              .filter(r => r.href);
}

async function fetchWiby(q) {
  const resp = await axios.get('https://wiby.me/json/?q=' + encodeURIComponent(q),
    { timeout: 10000, httpsAgent, validateStatus: () => true, headers: { 'Accept': 'application/json', 'User-Agent': UA } });
  let data = resp.data;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch(e) { return []; }
  }
  if (!data) return [];
  const items = Array.isArray(data) ? data : (data.results || []);
  return items.map(r => ({ title: r.Title||r.title||r.URL||r.url||'', href: r.URL||r.url||'',
                            snippet: r.Snippet||r.snippet||r.Description||r.description||'', displayUrl: r.URL||r.url||'' }))
              .filter(r => r.href);
}

// ─── Search endpoint ──────────────────────────────────────────────────────────
app.get('/search', async (req, res) => {
  const q    = req.query.q;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const PER  = 10;
  if (!q) return res.status(400).send('Missing ?q=');
  const host = req.get('host');
  const esc  = s => String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  let allResults = [], source = '';
  try {
    if (process.env.TAVILY_API_KEY) {
      try { allResults = await fetchTavily(q); source = 'Tavily'; } catch(e) { console.warn('[SEARCH] Tavily failed:', e.message); }
    }
    if (!allResults.length) {
      try { allResults = await fetchWiby(q); source = 'Wiby'; } catch(e) { console.warn('[SEARCH] Wiby failed:', e.message); }
    }

    const totalPages = Math.max(1, Math.ceil(allResults.length / PER));
    const safePage   = Math.min(page, totalPages);
    const results    = allResults.slice((safePage - 1) * PER, safePage * PER);

    var resultsHtml = results.length
      ? results.map(r =>
          '<div class="result">'
          + '<div class="result-url">' + esc(r.displayUrl) + '</div>'
          + '<div class="result-title"><a href="#" data-url="' + esc(r.href) + '">' + esc(r.title) + '</a></div>'
          + '<div class="result-snippet">' + esc(r.snippet) + '</div>'
          + '</div>').join('')
      : '<div class="no-results">No results found.<br><br>'
        + 'To enable full web search, set <code>TAVILY_API_KEY</code> in your environment variables.<br>'
        + 'Get a free key (no card) at <a href="https://app.tavily.com" style="color:#6c8eff">app.tavily.com</a>'
        + '</div>';

    var pagerHtml = '';
    if (totalPages > 1) {
      pagerHtml += '<div class="pager">';
      if (safePage > 1) pagerHtml += '<a class="page-btn" data-page="' + (safePage-1) + '">&laquo; Prev</a>';
      for (var p = Math.max(1,safePage-2); p <= Math.min(totalPages,safePage+2); p++) {
        pagerHtml += p===safePage
          ? '<span class="page-btn page-cur">'+p+'</span>'
          : '<a class="page-btn" data-page="'+p+'">'+p+'</a>';
      }
      if (safePage < totalPages) pagerHtml += '<a class="page-btn" data-page="' + (safePage+1) + '">Next &raquo;</a>';
      pagerHtml += '</div>';
    }

    var html = '<!DOCTYPE html><html><head>'
      + '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
      + '<title>' + esc(q) + ' — CentOS Search</title>'
      + '<style>'
      + '*{margin:0;padding:0;box-sizing:border-box}'
      + 'body{font-family:"Segoe UI",system-ui,sans-serif;background:#0d0d1c;color:#f0f0f5;min-height:100vh;padding-bottom:60px}'
      + '.topbar{background:rgba(10,10,25,0.97);border-bottom:1px solid rgba(255,255,255,0.08);padding:12px 24px;display:flex;align-items:center;gap:14px;position:sticky;top:0;z-index:99}'
      + '.logo{color:#6c8eff;font-size:18px;font-weight:700;white-space:nowrap}'
      + '.search-form{display:flex;flex:1;gap:8px;max-width:600px}'
      + '.search-inp{flex:1;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:22px;padding:8px 18px;color:#fff;font-size:14px;outline:none}'
      + '.search-inp:focus{border-color:rgba(108,142,255,0.6);background:rgba(108,142,255,0.08)}'
      + '.search-btn{background:#6c8eff;border:none;border-radius:22px;padding:8px 18px;color:#fff;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap}'
      + '.search-btn:hover{opacity:0.85}'
      + '.results{max-width:660px;margin:28px auto;padding:0 24px}'
      + '.result-count{font-size:13px;color:rgba(255,255,255,0.35);margin-bottom:20px}'
      + '.result{margin-bottom:28px;cursor:pointer}'
      + '.result:hover .result-title a{text-decoration:underline}'
      + '.result-url{font-size:12px;color:#4ce8a0;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      + '.result-title{font-size:18px;font-weight:500;margin-bottom:6px}'
      + '.result-title a{color:#6c8eff;text-decoration:none}'
      + '.result-snippet{font-size:14px;color:rgba(240,240,245,0.65);line-height:1.6}'
      + '.no-results{text-align:center;padding:60px 20px;color:rgba(255,255,255,0.35);font-size:15px}'
      + '.no-results code{background:rgba(255,255,255,0.06);padding:2px 7px;border-radius:4px;font-size:13px;color:#6c8eff}'
      + '.pager{display:flex;justify-content:center;gap:6px;margin-top:32px;flex-wrap:wrap}'
      + '.page-btn{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:#f0f0f5;padding:7px 14px;border-radius:8px;font-size:13px;cursor:pointer;text-decoration:none;user-select:none}'
      + '.page-btn:hover{background:rgba(108,142,255,0.2);border-color:rgba(108,142,255,0.5)}'
      + '.page-cur{background:rgba(108,142,255,0.25);border-color:rgba(108,142,255,0.6);color:#6c8eff;font-weight:700;cursor:default}'
      + '.powered{text-align:center;font-size:11px;color:rgba(255,255,255,0.15);margin-top:20px}'
      + '</style></head><body>'
      + '<div class="topbar">'
      + '<span class="logo">&#x2B21; CentOS Search</span>'
      + '<form class="search-form" id="sf">'
      + '<input class="search-inp" id="qi" value="' + esc(q) + '" placeholder="Search the web..."/>'
      + '<button class="search-btn" type="submit">Search</button>'
      + '</form></div>'
      + '<div class="results">'
      + '<div class="result-count">' + allResults.length + ' result' + (allResults.length!==1?'s':'') + (totalPages>1?' &mdash; Page '+safePage+' of '+totalPages:'') + ' for &ldquo;<strong>' + esc(q) + '</strong>&rdquo;</div>'
      + resultsHtml + pagerHtml
      + '<div class="powered">' + (source?'Powered by '+esc(source):'CentOS Web Proxy') + ' &middot; Routed through CentOS Web</div>'
      + '</div>'
      + '<script>'
      + 'var HOST="' + host + '";var Q=' + JSON.stringify(q) + ';'
      + 'function navTo(u){try{window.parent.postMessage({type:"centos-nav",url:u},"*")}catch(e){}setTimeout(function(){window.location.href=u;},80);}'
      + 'document.getElementById("sf").addEventListener("submit",function(e){'
      + '  e.preventDefault();var v=document.getElementById("qi").value.trim();if(!v)return;'
      + '  navTo("https://"+HOST+"/search?q="+encodeURIComponent(v)+"&page=1");'
      + '});'
      + 'document.addEventListener("click",function(e){'
      + '  var card=e.target.closest(".result");if(!card)return;e.preventDefault();'
      + '  var link=card.querySelector("a[data-url]");'
      + '  if(link){navTo("https://"+HOST+"/proxy?url="+encodeURIComponent(link.getAttribute("data-url")));}'
      + '});'
      + 'document.addEventListener("click",function(e){'
      + '  var btn=e.target.closest("a.page-btn");if(!btn)return;e.preventDefault();'
      + '  var pg=btn.getAttribute("data-page");'
      + '  if(pg)navTo("https://"+HOST+"/search?q="+encodeURIComponent(Q)+"&page="+pg);'
      + '});'
      + '<\/script></body></html>';

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Access-Control-Allow-Origin', '*');
    res.removeHeader('X-Frame-Options');
    res.set('Content-Security-Policy', 'frame-ancestors *');
    res.send(html);
  } catch(err) {
    console.error('[SEARCH] Unhandled error:', err.message);
    const esc2 = s => String(s).replace(/</g,'&lt;').replace(/>/g,'&gt;');
    res.status(200).set('Content-Type', 'text/html').send(
      '<html><body style="background:#0d0d1c;color:#fff;font-family:system-ui;padding:40px;text-align:center">'
      + '<h2 style="color:#6c8eff">Search error</h2>'
      + '<p style="color:rgba(255,255,255,0.5);margin-top:12px">' + esc2(err.message) + '</p>'
      + '</body></html>'
    );
  }
});

// ─── Proxy: HEAD (for range-request pre-flight from <video> / HLS players) ────
app.head('/proxy', async (req, res) => {
  const raw = req.query.url;
  if (!raw) return res.status(400).end();
  try {
    const upstream = await axios.head(raw, {
      timeout: 10000, maxRedirects: 8, validateStatus: () => true, httpsAgent,
      headers: { 'User-Agent': UA, 'Accept': '*/*' }
    });
    const ct = upstream.headers['content-type'] || 'application/octet-stream';
    const cl = upstream.headers['content-length'];
    const ar = upstream.headers['accept-ranges'];
    BLOCKED_HEADERS.forEach(h => res.removeHeader(h));
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', '*');
    res.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
    res.set('Content-Security-Policy', 'frame-ancestors *');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    if (ct)  res.set('Content-Type', ct);
    if (cl)  res.set('Content-Length', cl);
    if (ar)  res.set('Accept-Ranges', ar);
    res.status(upstream.status).end();
  } catch(e) { res.status(502).end(); }
});

// Headers to always strip from upstream
const BLOCKED_HEADERS = [
  'x-frame-options',
  'content-security-policy',
  'content-security-policy-report-only',
  'cross-origin-embedder-policy',
  'cross-origin-opener-policy',
  'cross-origin-resource-policy',
  'permissions-policy',
  'x-content-type-options',
  'strict-transport-security',
];

// ─── Proxy: GET (main) ────────────────────────────────────────────────────────
app.get('/proxy', async (req, res) => {
  const raw = req.query.url;
  if (!raw) return res.status(400).send('Missing ?url=');
  let target;
  try { target = new URL(raw); } catch { return res.status(400).send('Invalid URL'); }
  if (/^(localhost|127\.|192\.168\.|10\.|::1)/.test(target.hostname))
    return res.status(403).send('Private network access blocked');

  const host      = req.get('host');
  const rangeHdr  = req.headers['range']; // for video seeking

  try {
    // ── For media files that need range-request streaming ──────────────────
    if (rangeHdr) {
      // Pipe through a ranged request — important for video seeking
      const upHeaders = { 'User-Agent': UA, 'Range': rangeHdr, 'Accept': '*/*',
                          'Referer': target.origin, 'Origin': target.origin };
      const upstream = await axios.get(raw, {
        responseType: 'arraybuffer', timeout: 30000, maxRedirects: 8,
        validateStatus: () => true, httpsAgent, headers: upHeaders,
      });
      const ct  = upstream.headers['content-type']  || 'application/octet-stream';
      const cr  = upstream.headers['content-range'];
      const cl  = upstream.headers['content-length'];
      const ar  = upstream.headers['accept-ranges'];
      BLOCKED_HEADERS.forEach(h => res.removeHeader(h));
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Headers', '*');
      res.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
      res.set('Cross-Origin-Resource-Policy', 'cross-origin');
      res.set('Content-Type', ct);
      if (cr) res.set('Content-Range', cr);
      if (cl) res.set('Content-Length', cl);
      if (ar) res.set('Accept-Ranges', ar);
      return res.status(upstream.status).send(upstream.data);
    }

    // ── Regular request ────────────────────────────────────────────────────
    const upstream = await axios.get(raw, {
      responseType: 'arraybuffer', timeout: 20000, maxRedirects: 8, validateStatus: () => true, httpsAgent,
      headers: {
        'User-Agent':      UA,
        'Accept':          'text/html,application/xhtml+xml,*/*;q=0.9',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer':         target.origin,
        'Origin':          target.origin,
      },
    });
    const ct = upstream.headers['content-type'] || '';

    BLOCKED_HEADERS.forEach(h => res.removeHeader(h));
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
    res.set('Access-Control-Allow-Headers', '*');
    res.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
    res.set('Content-Security-Policy', 'frame-ancestors *');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.set('Cross-Origin-Embedder-Policy', 'unsafe-none');

    // ── Binary / media passthrough (with Accept-Ranges so browser can seek) ──
    if (/^(image|font)\/|octet-stream/.test(ct)) {
      res.set('Content-Type', ct);
      res.set('Cache-Control', 'public, max-age=86400');
      return res.send(upstream.data);
    }

    // ── Audio / Video — always set Accept-Ranges so seek works ──────────────
    if (/^(video|audio)\//.test(ct)) {
      const cl = upstream.headers['content-length'];
      res.set('Content-Type', ct);
      res.set('Accept-Ranges', 'bytes');
      if (cl) res.set('Content-Length', cl);
      res.set('Cache-Control', 'public, max-age=3600');
      return res.send(upstream.data);
    }

    // ── PDF passthrough ──────────────────────────────────────────────────────
    if (/pdf/.test(ct)) {
      res.set('Content-Type', ct);
      return res.send(upstream.data);
    }

    const body = upstream.data.toString('utf-8');

    // ── CSS ──────────────────────────────────────────────────────────────────
    if (ct.includes('css')) {
      res.set('Content-Type', 'text/css; charset=utf-8');
      return res.send(rewriteCss(body, raw, host));
    }

    // ── JavaScript ──────────────────────────────────────────────────────────
    if (ct.includes('javascript') || ct.includes('ecmascript') || ct.includes('x-javascript')) {
      res.set('Content-Type', ct);
      const jsRewritten = body.replace(
        /(["`])(https?:\/\/[^"`\s]{8,})(["`])/g,
        (match, q1, url, q2) => {
          if (url.startsWith('data:') || url.includes('/proxy?url=')) return match;
          return q1 + makeProxyUrl(url, host) + q2;
        }
      );
      return res.send(jsRewritten);
    }

    // ── HLS / DASH manifests ─────────────────────────────────────────────────
    // .m3u8 playlists reference .ts segment URLs — rewrite them
    if (ct.includes('mpegurl') || ct.includes('x-mpegurl') || raw.includes('.m3u8')) {
      res.set('Content-Type', ct || 'application/vnd.apple.mpegurl');
      const rewritten = body.replace(/^(https?:\/\/.+)$/gm, line => makeProxyUrl(line.trim(), host))
                            .replace(/^([^#][^\r\n]*)$/gm, line => {
                              const t = line.trim();
                              if (!t || t.startsWith('#')) return line;
                              const abs = resolveUrl(raw, t);
                              if (abs && !abs.includes('/proxy?url=')) return makeProxyUrl(abs, host);
                              return line;
                            });
      return res.send(rewritten);
    }

    // ── DASH MPD manifest ─────────────────────────────────────────────────────
    if (ct.includes('dash+xml') || raw.includes('.mpd')) {
      res.set('Content-Type', ct || 'application/dash+xml');
      const rewritten = body.replace(/(BaseURL|initialization|media|href)="([^"]+)"/g, (match, attr, url) => {
        const abs = resolveUrl(raw, url);
        if (!abs || abs.includes('/proxy?url=')) return match;
        return `${attr}="${makeProxyUrl(abs, host)}"`;
      });
      return res.send(rewritten);
    }

    // ── HTML ─────────────────────────────────────────────────────────────────
    if (ct.includes('html') || ct.includes('xhtml')) {
      const $ = cheerio.load(body, { decodeEntities: false });

      // Strip security meta tags
      $('meta[http-equiv="Content-Security-Policy"]').remove();
      $('meta[http-equiv="content-security-policy"]').remove();
      $('meta[http-equiv="X-Frame-Options"]').remove();
      $('meta[http-equiv="x-frame-options"]').remove();
      $('meta[http-equiv="Cross-Origin-Embedder-Policy"]').remove();
      $('meta[http-equiv="Cross-Origin-Opener-Policy"]').remove();

      // Rewrite meta refresh redirects to stay in proxy
      $('meta[http-equiv="refresh"]').each((_, el) => {
        const content = $(el).attr('content') || '';
        const match   = content.match(/^(\d+)(?:;\s*url=(.+))?$/i);
        if (match && match[2]) {
          const abs = resolveUrl(raw, match[2].trim());
          if (abs) $(el).attr('content', match[1] + '; url=' + makeProxyUrl(abs, host));
        }
      });

      $('base').remove();
      $('head').prepend(`<base href="${raw}">`);

      const rw = (el, attr) => {
        const v = $(el).attr(attr); if (!v) return;
        const abs = resolveUrl(raw, v);
        if (abs && !/^(javascript:|data:|#|mailto:|tel:|blob:)/.test(abs)) $(el).attr(attr, makeProxyUrl(abs, host));
      };

      $('a[href]').each((_,el)        => rw(el,'href'));
      $('link[href]').each((_,el)     => rw(el,'href'));
      $('script[src]').each((_,el)    => rw(el,'src'));
      $('script[type="module"][src]').each((_,el) => rw(el,'src'));
      $('link[rel="modulepreload"]').each((_,el)  => rw(el,'href'));
      $('link[rel="preload"]').each((_,el)        => rw(el,'href'));
      $('link[rel="prefetch"]').each((_,el)       => rw(el,'href'));

      // Import maps
      $('script[type="importmap"]').each((_,el) => {
        try {
          const map = JSON.parse($(el).html() || '{}');
          if (map.imports) Object.keys(map.imports).forEach(k => {
            const abs = resolveUrl(raw, map.imports[k]);
            if (abs) map.imports[k] = makeProxyUrl(abs, host);
          });
          if (map.scopes) Object.keys(map.scopes).forEach(scope => {
            Object.keys(map.scopes[scope]).forEach(k => {
              const abs = resolveUrl(raw, map.scopes[scope][k]);
              if (abs) map.scopes[scope][k] = makeProxyUrl(abs, host);
            });
          });
          $(el).html(JSON.stringify(map));
        } catch(e) {}
      });

      // Images
      $('img[src]').each((_,el) => rw(el,'src'));
      $('img[srcset], source[srcset]').each((_,el) => {
        const s = $(el).attr('srcset') || '';
        $(el).attr('srcset', s.split(',').map(p => {
          const [u, sz] = p.trim().split(/\s+/);
          return makeProxyUrl(resolveUrl(raw, u), host) + (sz ? ' '+sz : '');
        }).join(', '));
      });

      // Lazy-load data attributes
      ['data-src','data-lazy','data-original','data-lazy-src'].forEach(attr => {
        $(`[${attr}]`).each((_,el) => {
          const v = $(el).attr(attr); if (!v) return;
          const abs = resolveUrl(raw, v);
          if (abs && /^https?:/.test(abs)) $(el).attr(attr, makeProxyUrl(abs, host));
        });
      });

      // Frames
      $('iframe[src], frame[src]').each((_,el) => rw(el,'src'));

      // ── Audio / Video — rewrite all src, poster, data-* ──────────────────
      $('video[src], audio[src], source[src]').each((_,el) => rw(el,'src'));
      $('video[poster]').each((_,el) => rw(el,'poster'));
      $('track[src]').each((_,el) => rw(el,'src')); // subtitles

      // Forms
      $('form[action]').each((_,el) => rw(el,'action'));

      // Inline CSS
      $('[style]').each((_,el) => $(el).attr('style', rewriteCss($(el).attr('style'), raw, host)));
      $('style').each((_,el) => $(el).html(rewriteCss($(el).html(), raw, host)));

      // Inline script: rewrite absolute URLs in string literals
      $('script:not([src])').each((_,el) => {
        const code = $(el).html() || '';
        const rewritten = code.replace(
          /(["`])(https?:\/\/[^"`\s]{8,})(["`])/g,
          (match, q1, url, q2) => {
            if (url.startsWith('data:') || url.includes('/proxy?url=')) return match;
            return q1 + makeProxyUrl(url, host) + q2;
          }
        );
        $(el).html(rewritten);
      });

      // ── Proxy bar + injected JS ──────────────────────────────────────────
      $('body').prepend(`
        <div id="_centos_bar" style="position:fixed;top:0;left:0;right:0;height:28px;z-index:2147483647;background:rgba(8,8,18,0.96);backdrop-filter:blur(16px);border-bottom:1px solid rgba(108,142,255,0.2);display:flex;align-items:center;padding:0 12px;gap:8px;font:600 11px/1 system-ui,sans-serif;letter-spacing:0.05em;">
          <span style="color:#6c8eff">⬡ PROXY</span>
          <span style="background:rgba(76,232,160,0.12);color:#4ce8a0;padding:1px 7px;border-radius:8px;border:1px solid rgba(76,232,160,0.25);font-size:10px">SECURE</span>
          <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:rgba(255,255,255,0.35);font-weight:400">${raw}</span>
          <a href="https://${host}/proxy?url=${encodeURIComponent(raw)}" style="color:rgba(108,142,255,0.6);text-decoration:none" title="Reload">↻</a>
          <a href="${raw}" target="_blank" style="color:rgba(255,255,255,0.25);text-decoration:none" title="Open original">↗</a>
        </div>
        <div style="height:28px"></div>
        ${injectedJs(raw, host)}
      `);

      // Allow media autoplay
      $('video,audio').each((_,el) => {
        $(el).attr('crossorigin', 'anonymous');
      });

      res.set('Content-Type', 'text/html; charset=utf-8');
      return res.send($.html());
    }

    // ── Fallback ─────────────────────────────────────────────────────────────
    res.set('Content-Type', ct || 'text/plain');
    res.send(body);

  } catch (err) {
    console.error(`[PROXY] ${raw} ->`, err.message);
    const code = err.code === 'ECONNREFUSED' ? 502 : err.code === 'ETIMEDOUT' ? 504 : 500;
    res.status(code).send(`Proxy error: ${err.message}`);
  }
});

// ─── Proxy: POST ──────────────────────────────────────────────────────────────
app.post('/proxy', async (req, res) => {
  const raw = req.query.url;
  if (!raw) return res.status(400).send('Missing ?url=');
  try {
    const r = await axios.post(raw, req.body, {
      timeout: 15000, validateStatus: () => true, httpsAgent,
      headers: { 'User-Agent': UA, 'Content-Type': req.get('content-type') || 'application/x-www-form-urlencoded' }
    });
    BLOCKED_HEADERS.forEach(h => res.removeHeader(h));
    res.set('Content-Type',  r.headers['content-type'] || 'text/html');
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Content-Security-Policy', 'frame-ancestors *');
    res.send(r.data);
  } catch (e) { res.status(500).send(e.message); }
});

// ─── OPTIONS pre-flight ───────────────────────────────────────────────────────
app.options('/proxy', (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, HEAD, OPTIONS');
  res.set('Access-Control-Allow-Headers', '*');
  res.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
  res.status(204).end();
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use(function(err, req, res, next) {
  console.error('[UNHANDLED]', err.message);
  res.status(200).set('Content-Type', 'text/plain').send('Error: ' + err.message);
});

// Export for Vercel (serverless)
module.exports = app;

// Local dev only
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n  ⬡  CentOS Web Proxy — Enhanced Edition`);
    console.log(`  ──────────────────────────────────────────`);
    console.log(`  ✓  Running  ->  http://localhost:${PORT}`);
    console.log(`  ✓  Health   ->  http://localhost:${PORT}/health`);
    console.log(`  ✓  Example  ->  http://localhost:${PORT}/proxy?url=https://example.com`);
    console.log(`  ✓  Video    ->  https://yourhost/proxy?url=https://some-video-site.com\n`);
  });
}
