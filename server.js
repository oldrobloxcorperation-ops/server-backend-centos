/**
 * CentOS Web — Proxy Backend  (server.js)
 * ─────────────────────────────────────────
 * Vercel-compatible: exports `app` as the default export.
 * For local dev, the bottom of the file calls app.listen()
 * only when run directly (not imported by Vercel).
 */

const express  = require('express');
const axios    = require('axios');
const cors     = require('cors');
const cheerio  = require('cheerio');
const https    = require('https');

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*', methods: ['GET','POST','OPTIONS'] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
    // Search form: if it looks like a URL go straight to proxy, otherwise search
    + 'document.getElementById("sf").addEventListener("submit",function(e){'
    + '  e.preventDefault();'
    + '  var v=document.getElementById("qi").value.trim();'
    + '  if(!v)return;'
    + '  if(/^https?:\\/\\//.test(v)||(/^[\\w-]+\\.\\w{2,}/.test(v)&&!v.includes(" "))){' // URL detection
    + '    var url=(/^https?:\\/\\//.test(v)?v:"https://"+v);'
    + '    navTo("https://"+HOST+"/proxy?url="+encodeURIComponent(url));'
    + '  } else {'
    + '    navTo("https://"+HOST+"/search?q="+encodeURIComponent(v)+"&page=1");'
    + '  }'
    + '});'
    // Quick link clicks
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

// Health check — frontend polls this for the green badge
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', server: 'CentOS Web Proxy', port: PORT });
});

// Helpers
function resolveUrl(base, rel) {
  if (!rel) return '';
  if (/^(data:|javascript:|mailto:|tel:)/.test(rel)) return rel;
  if (rel.startsWith('//')) return 'https:' + rel;
  try { return new URL(rel, base).href; } catch { return rel; }
}
function makeProxyUrl(targetUrl, host) {
  if (!targetUrl || /^(javascript:|data:|#)/.test(targetUrl)) return targetUrl;
  return `https://${host}/proxy?url=${encodeURIComponent(targetUrl)}`;
}
function rewriteCss(css, base, host) {
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (_, q, u) => {
    const abs = resolveUrl(base, u.trim());
    if (!abs || abs.startsWith('data:')) return `url(${q}${u}${q})`;
    return `url("${makeProxyUrl(abs, host)}")`;
  });
}
function injectedJs(pageUrl, host) {
  const P = 'https://' + host + '/proxy?url=';
  return '<script>\n(function(){\n'
    + '  var P="' + P + '", B=' + JSON.stringify(pageUrl) + ';\n'
    + '\n'
    + '  function safeResolve(u){\n'
    + '    if(!u) return null;\n'
    + '    var s=String(u);\n'
    + '    if(/^https?:\\/\\//.test(s)) return s;\n'
    + '    if(B && /^https?:\\/\\//.test(B)){ try{ return new URL(s,B).href; }catch(e){ return null; } }\n'
    + '    return null;\n'
    + '  }\n'
    + '\n'
    + '  function navTo(url){ try{ window.parent.postMessage({type:"centos-nav",url:url},"*"); }catch(e){} }\n'
    + '\n'
    + '  // Fetch\n'
    + '  var _f=window.fetch;\n'
    + '  window.fetch=function(r,o){\n'
    + '    if(r && typeof r==="string" && /^https?:/.test(r)) r=P+encodeURIComponent(r);\n'
    + '    else if(r && typeof r==="object" && r.url && /^https?:/.test(r.url)) r=new Request(P+encodeURIComponent(r.url),r);\n'
    + '    return _f.call(this,r,o);\n'
    + '  };\n'
    + '\n'
    + '  // XHR\n'
    + '  var _x=XMLHttpRequest.prototype.open;\n'
    + '  XMLHttpRequest.prototype.open=function(m,u){ if(typeof u==="string"&&/^https?:/.test(u)) u=P+encodeURIComponent(u); return _x.apply(this,arguments); };\n'
    + '\n'
    + '  // Webpack public path patch (CRA / Next.js chunk loading)\n'
    + '  try{ if(typeof __webpack_require__!=="undefined" && __webpack_require__.p){ var op=__webpack_require__.p; var ap=safeResolve(op)||op; __webpack_require__.p=P+encodeURIComponent(ap.endsWith("/")?ap:ap+"/"); } }catch(e){}\n'
    + '\n'
    + '  // history (React Router)\n'
    + '  var _push=history.pushState, _repl=history.replaceState;\n'
    + '  function interceptState(u){ if(!u) return false; var r=safeResolve(u); if(!r) return false; navTo(r); return true; }\n'
    + '  history.pushState=function(s,t,u){ if(u&&interceptState(u)) return; return _push.apply(this,arguments); };\n'
    + '  history.replaceState=function(s,t,u){ if(u&&interceptState(u)) return; return _repl.apply(this,arguments); };\n'
    + '\n'
    + '  // location.href\n'
    + '  function interceptLoc(u){ var r=safeResolve(u); if(!r) return false; navTo(r); return true; }\n'
    + '  try{\n'
    + '    var _ld=Object.getOwnPropertyDescriptor(Location.prototype,"href");\n'
    + '    Object.defineProperty(Location.prototype,"href",{ get:_ld.get, set:function(u){ if(interceptLoc(u)) return; _ld.set.call(this,u); } });\n'
    + '    Location.prototype.assign=function(u){ if(interceptLoc(u)) return; window.location.href=u; };\n'
    + '    Location.prototype.replace=function(u){ if(interceptLoc(u)) return; _ld.set.call(this,u); };\n'
    + '  }catch(e){}\n'
    + '\n'
    + '  // Link clicks\n'
    + '  document.addEventListener("click",function(e){\n'
    + '    var a=e.target.closest("a"); if(!a) return;\n'
    + '    var h=a.getAttribute("href");\n'
    + '    if(!h||/^(#|javascript:|mailto:|tel:)/.test(h)) return;\n'
    + '    e.preventDefault();\n'
    + '    var r=safeResolve(h); if(r) navTo(r);\n'
    + '  },true);\n'
    + '\n'
    + '  // Form submits\n'
    + '  document.addEventListener("submit",function(e){\n'
    + '    var f=e.target, m=(f.method||"GET").toUpperCase();\n'
    + '    if(m!=="GET") return;\n'
    + '    e.preventDefault();\n'
    + '    var r=safeResolve(f.action||B); if(!r) return;\n'
    + '    navTo(r+"?"+new URLSearchParams(new FormData(f)));\n'
    + '  },true);\n'
    + '\n'
    + '  // MutationObserver — catch dynamically injected <script src> / <link href> (React chunk loading)\n'
    + '  try{\n'
    + '    new MutationObserver(function(muts){\n'
    + '      muts.forEach(function(m){\n'
    + '        m.addedNodes.forEach(function(node){\n'
    + '          if(node.tagName==="SCRIPT"&&node.src&&/^https?:/.test(node.src)&&!node.src.includes("/proxy?url=")) node.src=P+encodeURIComponent(node.src);\n'
    + '          if(node.tagName==="LINK"&&node.href&&/^https?:/.test(node.href)&&!node.href.includes("/proxy?url=")) node.href=P+encodeURIComponent(node.href);\n'
    + '        });\n'
    + '      });\n'
    + '    }).observe(document.documentElement,{childList:true,subtree:true});\n'
    + '  }catch(e){}\n'
    + '\n'
    + '})();\n'
    + '<\/script>';
}

// ─── Search ───────────────────────────────────────────────────────────────────
// Public SearXNG instances block datacenter/Vercel IPs at the network level.
// Instead we use two real APIs:
//
//  1. Brave Search API  — best quality; free tier 2k req/month
//     Sign up at https://brave.com/search/api/ and set BRAVE_SEARCH_KEY env var.
//
//  2. Marginalia Search API — totally free, no key, works from any IP.
//     Smaller indie-web index but returns real JSON results with no auth.
//     https://api.search.marginalia.nu/search/<query>
// ─────────────────────────────────────────────────────────────────────────────

async function fetchTavily(q) {
  // Tavily Search API -- 1000 free searches/month, email signup only, no card ever.
  // Sign up at https://app.tavily.com → copy your API key
  // Set TAVILY_API_KEY in your Vercel environment variables.
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new Error('TAVILY_API_KEY not set');

  const resp = await axios.post(
    'https://api.tavily.com/search',
    { api_key: key, query: q, num_results: 50 },  // fetch max so we can paginate client-side
    {
      timeout: 10000, httpsAgent, validateStatus: () => true,
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    }
  );

  if (resp.status !== 200) {
    const errMsg = (resp.data && resp.data.message) || (resp.data && resp.data.error) || JSON.stringify(resp.data || {}).substring(0, 200);
    throw new Error('Tavily HTTP ' + resp.status + ': ' + errMsg);
  }

  const items = (resp.data && resp.data.results) || [];
  return items.map(function(r) {
    return {
      title:      r.title || '',
      href:       r.url   || '',
      snippet:    r.content || '',
      displayUrl: r.url   || '',
    };
  }).filter(function(r) { return r.href; });
}


async function fetchWiby(q) {
  const resp = await axios.get(
    'https://wiby.me/json/?q=' + encodeURIComponent(q),
    {
      timeout: 10000, httpsAgent, validateStatus: () => true,
      headers: { 'Accept': 'application/json', 'User-Agent': UA },
    }
  );
  // Guard against non-JSON responses (Wiby sometimes returns an HTML error page)
  let data = resp.data;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch(e) {
      console.warn('[SEARCH] Wiby returned non-JSON:', data.substring(0, 100));
      return [];
    }
  }
  if (!data) return [];
  const items = Array.isArray(data) ? data : (data.results || []);
  return items.map(function(r) {
    return {
      title:      r.Title || r.title || r.URL || r.url || '',
      href:       r.URL   || r.url   || '',
      snippet:    r.Snippet || r.snippet || r.Description || r.description || '',
      displayUrl: r.URL   || r.url   || '',
    };
  }).filter(function(r) { return r.href; });
}

// ─── Search endpoint ──────────────────────────────────────────────────────────
app.get('/search', async (req, res) => {
  const q    = req.query.q;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const PER  = 10;

  if (!q) return res.status(400).send('Missing ?q=');
  const host = req.get('host');
  const esc  = s => String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  let allResults = [];
  let source = '';

  try {
    if (process.env.TAVILY_API_KEY) {
      try {
        allResults = await fetchTavily(q);
        source = 'Tavily';
        console.log('[SEARCH] ' + allResults.length + ' results from Tavily');
      } catch(e) { console.warn('[SEARCH] Tavily failed:', e.message); }
    }

    if (!allResults.length) {
      try {
        allResults = await fetchWiby(q);
        source = 'Wiby';
        console.log('[SEARCH] ' + allResults.length + ' results from Wiby');
      } catch(e) { console.warn('[SEARCH] Wiby failed:', e.message); }
    }

    // Paginate
    const totalPages = Math.max(1, Math.ceil(allResults.length / PER));
    const safePage   = Math.min(page, totalPages);
    const results    = allResults.slice((safePage - 1) * PER, safePage * PER);

    // Build results HTML
    var resultsHtml = '';
    if (results.length) {
      resultsHtml = results.map(function(r) {
        return '<div class="result">'
          + '<div class="result-url">' + esc(r.displayUrl) + '</div>'
          + '<div class="result-title"><a href="#" data-url="' + esc(r.href) + '">' + esc(r.title) + '</a></div>'
          + '<div class="result-snippet">' + esc(r.snippet) + '</div>'
          + '</div>';
      }).join('');
    } else {
      resultsHtml = '<div class="no-results">No results found.<br><br>'
        + 'To enable full web search, set <code>TAVILY_API_KEY</code> in your environment variables.<br>'
        + 'Get a free key (no card) at <a href="https://app.tavily.com" style="color:#6c8eff">app.tavily.com</a>'
        + '</div>';
    }

    // Build pagination HTML
    var pagerHtml = '';
    if (totalPages > 1) {
      pagerHtml += '<div class="pager">';
      // Prev
      if (safePage > 1) {
        pagerHtml += '<a class="page-btn" data-page="' + (safePage - 1) + '">&laquo; Prev</a>';
      }
      // Page numbers — show window of 5 around current page
      var pStart = Math.max(1, safePage - 2);
      var pEnd   = Math.min(totalPages, safePage + 2);
      for (var p = pStart; p <= pEnd; p++) {
        if (p === safePage) {
          pagerHtml += '<span class="page-btn page-cur">' + p + '</span>';
        } else {
          pagerHtml += '<a class="page-btn" data-page="' + p + '">' + p + '</a>';
        }
      }
      // Next
      if (safePage < totalPages) {
        pagerHtml += '<a class="page-btn" data-page="' + (safePage + 1) + '">Next &raquo;</a>';
      }
      pagerHtml += '</div>';
    }

    var poweredBy  = source ? 'Powered by ' + esc(source) : 'CentOS Web Proxy';
    var countLabel = allResults.length + ' result' + (allResults.length !== 1 ? 's' : '');
    var pageLabel  = totalPages > 1 ? ' &mdash; Page ' + safePage + ' of ' + totalPages : '';

    var html = '<!DOCTYPE html><html><head>'
      + '<meta charset="UTF-8">'
      + '<meta name="viewport" content="width=device-width,initial-scale=1">'
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
      + '<div class="result-count">' + countLabel + pageLabel + ' for &ldquo;<strong>' + esc(q) + '</strong>&rdquo;</div>'
      + resultsHtml
      + pagerHtml
      + '<div class="powered">' + poweredBy + ' &middot; Routed through CentOS Web</div>'
      + '</div>'
      + '<script>'
      + 'var HOST="' + host + '";'
      + 'var Q=' + JSON.stringify(q) + ';'
      + 'function navTo(u){'
      + '  try{window.parent.postMessage({type:"centos-nav",url:u},"*")}catch(e){}'
      + '  setTimeout(function(){window.location.href=u;},80);'
      + '}'
      // Search form
      + 'document.getElementById("sf").addEventListener("submit",function(e){'
      + '  e.preventDefault();'
      + '  var v=document.getElementById("qi").value.trim();'
      + '  if(!v)return;'
      + '  navTo("https://"+HOST+"/search?q="+encodeURIComponent(v)+"&page=1");'
      + '});'
      // Result clicks — open in proxy
      + 'document.addEventListener("click",function(e){'
      + '  var card=e.target.closest(".result");'
      + '  if(!card)return;'
      + '  e.preventDefault();'
      + '  var link=card.querySelector("a[data-url]");'
      + '  if(link){navTo("https://"+HOST+"/proxy?url="+encodeURIComponent(link.getAttribute("data-url")));}'
      + '});'
      // Pagination clicks
      + 'document.addEventListener("click",function(e){'
      + '  var btn=e.target.closest("a.page-btn");'
      + '  if(!btn)return;'
      + '  e.preventDefault();'
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
    res.status(200).set('Content-Type', 'text/html').send(
      '<html><body style="background:#0d0d1c;color:#fff;font-family:system-ui;padding:40px;text-align:center">'
      + '<h2 style="color:#6c8eff">Search error</h2>'
      + '<p style="color:rgba(255,255,255,0.5);margin-top:12px">' + esc(err.message) + '</p>'
      + '</body></html>'
    );
  }
});

app.get('/proxy', async (req, res) => {
  const raw = req.query.url;
  if (!raw) return res.status(400).send('Missing ?url=');
  let target;
  try { target = new URL(raw); } catch { return res.status(400).send('Invalid URL'); }
  if (/^(localhost|127\.|192\.168\.|10\.|::1)/.test(target.hostname))
    return res.status(403).send('Private network access blocked');

  const host = req.get('host');
  try {
    const upstream = await axios.get(raw, {
      responseType: 'arraybuffer', timeout: 20000, maxRedirects: 8, validateStatus: () => true,
      httpsAgent,
      headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,*/*;q=0.9', 'Accept-Language': 'en-US,en;q=0.9', 'Accept-Encoding': 'gzip, deflate, br', 'Referer': target.origin },
    });
    const ct = upstream.headers['content-type'] || '';

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
    BLOCKED_HEADERS.forEach(h => res.removeHeader(h));

    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', '*');
    res.set('Content-Security-Policy', 'frame-ancestors *');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.set('Cross-Origin-Embedder-Policy', 'unsafe-none');

    if (/^(image|video|audio|font)\/|pdf|octet-stream/.test(ct)) {
      res.set('Content-Type', ct);
      res.set('Cache-Control', 'public, max-age=86400');
      return res.send(upstream.data);
    }
    const body = upstream.data.toString('utf-8');

    if (ct.includes('css')) {
      res.set('Content-Type', 'text/css; charset=utf-8');
      return res.send(rewriteCss(body, raw, host));
    }
    if (ct.includes('javascript') || ct.includes('ecmascript')) {
      res.set('Content-Type', ct);
      // Rewrite absolute URLs in JS bundles (webpack publicPath, Vite asset imports)
      // so chunk fetches and API calls go through the proxy automatically
      const jsRewritten = body.replace(
        /(["\`])(https?:\/\/[^"'\`\s]{8,})(["\`])/g,
        function(match, q1, url, q2) {
          if (url.startsWith('data:') || url.includes('/proxy?url=')) return match;
          return q1 + makeProxyUrl(url, host) + q2;
        }
      );
      return res.send(jsRewritten);
    }
    if (ct.includes('html') || ct.includes('xhtml')) {
      const $ = cheerio.load(body, { decodeEntities: false });
      $('meta[http-equiv="Content-Security-Policy"]').remove();
      $('meta[http-equiv="content-security-policy"]').remove();
      $('meta[http-equiv="X-Frame-Options"]').remove();
      $('meta[http-equiv="x-frame-options"]').remove();
      $('meta[http-equiv="Cross-Origin-Embedder-Policy"]').remove();
      $('meta[http-equiv="Cross-Origin-Opener-Policy"]').remove();
      $('base').remove();
      $('head').prepend(`<base href="${raw}">`);

      const rw = (el, attr) => {
        const v = $(el).attr(attr); if (!v) return;
        const abs = resolveUrl(raw, v);
        if (abs && !/^(javascript:|data:|#|mailto:|tel:)/.test(abs)) $(el).attr(attr, makeProxyUrl(abs, host));
      };
      $('a[href]').each((_, el) => rw(el, 'href'));
      $('link[href]').each((_, el) => rw(el, 'href'));
      $('script[src]').each((_, el) => rw(el, 'src'));
      $('script[type="module"][src]').each((_, el) => rw(el, 'src'));
      $('link[rel="modulepreload"]').each((_, el) => rw(el, 'href'));
      $('link[rel="preload"]').each((_, el) => rw(el, 'href'));
      // Rewrite import maps so dynamic import() calls resolve through proxy
      $('script[type="importmap"]').each((_, el) => {
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
      $('img[src]').each((_, el) => rw(el, 'src'));
      $('img[srcset], source[srcset]').each((_, el) => {
        const s = $(el).attr('srcset') || '';
        $(el).attr('srcset', s.split(',').map(p => {
          const [u, sz] = p.trim().split(/\s+/);
          return makeProxyUrl(resolveUrl(raw, u), host) + (sz ? ' '+sz : '');
        }).join(', '));
      });
      $('iframe[src], frame[src]').each((_, el) => rw(el, 'src'));
      $('video[src], audio[src], source[src]').each((_, el) => rw(el, 'src'));
      $('form[action]').each((_, el) => rw(el, 'action'));
      $('[style]').each((_, el) => $(el).attr('style', rewriteCss($(el).attr('style'), raw, host)));
      $('style').each((_, el) => $(el).html(rewriteCss($(el).html(), raw, host)));

      $('body').prepend(`
        <div style="position:fixed;top:0;left:0;right:0;height:28px;z-index:2147483647;background:rgba(8,8,18,0.96);backdrop-filter:blur(16px);border-bottom:1px solid rgba(108,142,255,0.2);display:flex;align-items:center;padding:0 12px;gap:8px;font:600 11px/1 system-ui,sans-serif;letter-spacing:0.05em;">
          <span style="color:#6c8eff">⬡ PROXY</span>
          <span style="background:rgba(76,232,160,0.12);color:#4ce8a0;padding:1px 7px;border-radius:8px;border:1px solid rgba(76,232,160,0.25);font-size:10px">SECURE</span>
          <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:rgba(255,255,255,0.35);font-weight:400">${raw}</span>
          <a href="https://${host}/proxy?url=${encodeURIComponent(raw)}" style="color:rgba(108,142,255,0.6);text-decoration:none" title="Reload">↻</a>
          <a href="${raw}" target="_blank" style="color:rgba(255,255,255,0.25);text-decoration:none" title="Open original">↗</a>
        </div>
        <div style="height:28px"></div>
        ${injectedJs(raw, host)}
      `);

      res.set('Content-Type', 'text/html; charset=utf-8');
      return res.send($.html());
    }
    res.set('Content-Type', ct || 'text/plain');
    res.send(body);
  } catch (err) {
    console.error(`[PROXY] ${raw} ->`, err.message);
    const code = err.code === 'ECONNREFUSED' ? 502 : err.code === 'ETIMEDOUT' ? 504 : 500;
    res.status(code).send(`Proxy error: ${err.message}`);
  }
});

app.post('/proxy', async (req, res) => {
  const raw = req.query.url;
  if (!raw) return res.status(400).send('Missing ?url=');
  try {
    const r = await axios.post(raw, req.body, { timeout: 15000, validateStatus: () => true, httpsAgent, headers: { 'User-Agent': UA, 'Content-Type': req.get('content-type') || 'application/x-www-form-urlencoded' } });
    res.set('Content-Type', r.headers['content-type'] || 'text/html');
    res.set('Access-Control-Allow-Origin', '*');
    res.send(r.data);
  } catch (e) { res.status(500).send(e.message); }
});


// Global error handler — catches any unhandled Express errors and returns 200
// instead of crashing the serverless function with a 500
app.use(function(err, req, res, next) {
  console.error('[UNHANDLED]', err.message);
  res.status(200).set('Content-Type', 'text/plain').send('Error: ' + err.message);
});

// Export for Vercel (serverless)
module.exports = app;

// Local dev only — Vercel never reaches this
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n  ⬡  CentOS Web Proxy`);
    console.log(`  ────────────────────────────────`);
    console.log(`  ✓  Running  ->  http://localhost:${PORT}`);
    console.log(`  ✓  Health   ->  http://localhost:${PORT}/health`);
    console.log(`  ✓  Example  ->  http://localhost:${PORT}/proxy?url=https://example.com\n`);
  });
}
