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
app.get('/', (_req, res) => {
  res.send(`<!DOCTYPE html><html><head><title>CentOS Web Proxy</title></head><body style="font-family:system-ui;background:#08080f;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:12px">
    <span style="font-size:2rem">⬡</span>
    <h2 style="margin:0;color:#6c8eff">CentOS Web Proxy</h2>
    <span style="color:#4ce8a0;background:rgba(76,232,160,0.1);padding:4px 14px;border-radius:8px;border:1px solid rgba(76,232,160,0.25)">Online</span>
    <p style="color:rgba(255,255,255,0.35);font-size:13px">Use <code style="color:#6c8eff">/proxy?url=https://example.com</code> to browse</p>
  </body></html>`);
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
  return `<script>
(function(){
  var P='https://${host}/proxy?url=', B='${pageUrl}';

  function safeResolve(u){
    if(!u) return null;
    var s=String(u);
    // Already absolute
    if(/^https?:\/\//.test(s)) return s;
    // Relative — resolve against base
    if(B && /^https?:\/\//.test(B)){
      try{ return new URL(s,B).href; }catch{ return null; }
    }
    return null;
  }

  function navTo(url){
    try{ window.parent.postMessage({type:'centos-nav',url:url},'*'); }catch{}
  }

  // Intercept fetch
  var _f=window.fetch;
  window.fetch=function(r,o){ if(typeof r==='string'&&/^https?:/.test(r)) r=P+encodeURIComponent(r); return _f(r,o); };

  // Intercept XHR
  var _x=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(m,u){ if(/^https?:/.test(u)) u=P+encodeURIComponent(u); return _x.apply(this,arguments); };

  // Intercept history.pushState / replaceState
  var _push=history.pushState, _repl=history.replaceState;
  function interceptState(u){
    var resolved=safeResolve(u);
    if(!resolved) return false;
    navTo(resolved); return true;
  }
  history.pushState=function(s,t,u){ if(interceptState(u)) return; return _push.apply(this,arguments); };
  history.replaceState=function(s,t,u){ if(interceptState(u)) return; return _repl.apply(this,arguments); };

  // Intercept window.location.href setter, assign, replace
  function interceptLoc(u){
    var resolved=safeResolve(u);
    if(!resolved) return false;
    navTo(resolved); return true;
  }
  try{
    var _ld=Object.getOwnPropertyDescriptor(Location.prototype,'href');
    Object.defineProperty(Location.prototype,'href',{
      get:_ld.get,
      set:function(u){ if(interceptLoc(u)) return; _ld.set.call(this,u); }
    });
    var _la=Location.prototype.assign;
    Location.prototype.assign=function(u){ if(interceptLoc(u)) return; _la.call(this,u); };
    var _lr=Location.prototype.replace;
    Location.prototype.replace=function(u){ if(interceptLoc(u)) return; _lr.call(this,u); };
  }catch(e){}

  // Intercept link clicks
  document.addEventListener('click',function(e){
    var a=e.target.closest('a'); if(!a) return;
    var h=a.getAttribute('href');
    if(!h||/^(#|javascript:|mailto:|tel:)/.test(h)) return;
    e.preventDefault();
    var resolved=safeResolve(h);
    if(resolved) navTo(resolved);
  },true);

  // Intercept form submits
  document.addEventListener('submit',function(e){
    var f=e.target, m=(f.method||'GET').toUpperCase();
    if(m!=='GET') return;
    e.preventDefault();
    var resolved=safeResolve(f.action||B);
    if(!resolved) return;
    navTo(resolved+'?'+new URLSearchParams(new FormData(f)));
  },true);
})();
<\/script>`;
}

// Search endpoint — fetches Bing results server-side, rewrites links through proxy
app.get('/search', async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).send('Missing ?q=');
  const host = req.get('host');

  try {
    const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(q)}&setlang=en`;
    const upstream = await axios.get(searchUrl, {
      timeout: 15000, httpsAgent, validateStatus: () => true,
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.9',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
      }
    });

    const $ = cheerio.load(upstream.data.toString('utf-8'));

    // Extract Bing search results
    const results = [];
    $('#b_results .b_algo').each((_, el) => {
      const titleEl = $(el).find('h2 a');
      const title = titleEl.text().trim();
      const href = titleEl.attr('href');
      const snippet = $(el).find('.b_caption p').text().trim();
      const displayUrl = $(el).find('cite').text().trim();
      if (title && href && /^https?:/.test(href)) {
        results.push({ title, href, snippet, displayUrl });
      }
    });

    // Build clean results page
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${q} — CentOS Search</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',system-ui,sans-serif;background:#0d0d1c;color:#f0f0f5;min-height:100vh;padding-bottom:40px}
    .topbar{background:rgba(10,10,25,0.97);border-bottom:1px solid rgba(255,255,255,0.08);padding:12px 24px;display:flex;align-items:center;gap:14px;position:sticky;top:0;z-index:99}
    .logo{color:#6c8eff;font-size:18px;font-weight:700;white-space:nowrap;text-decoration:none}
    .search-form{display:flex;flex:1;gap:8px;max-width:600px}
    .search-inp{flex:1;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:22px;padding:8px 18px;color:#fff;font-size:14px;outline:none}
    .search-inp:focus{border-color:rgba(108,142,255,0.6);background:rgba(108,142,255,0.08)}
    .search-btn{background:#6c8eff;border:none;border-radius:22px;padding:8px 18px;color:#fff;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap}
    .search-btn:hover{opacity:0.85}
    .results{max-width:660px;margin:28px auto;padding:0 24px}
    .result-count{font-size:13px;color:rgba(255,255,255,0.35);margin-bottom:20px}
    .result{margin-bottom:28px}
    .result-url{font-size:12px;color:#4ce8a0;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .result-title{font-size:18px;font-weight:500;margin-bottom:6px}
    .result-title a{color:#6c8eff;text-decoration:none}
    .result-title a:hover{text-decoration:underline}
    .result-snippet{font-size:14px;color:rgba(240,240,245,0.65);line-height:1.6}
    .no-results{text-align:center;padding:60px 20px;color:rgba(255,255,255,0.35);font-size:15px}
    .powered{text-align:center;font-size:11px;color:rgba(255,255,255,0.15);margin-top:40px}
  </style>
</head>
<body>
  <div class="topbar">
    <span class="logo">⬡ CentOS Search</span>
    <form class="search-form" onsubmit="doSearch(event)">
      <input class="search-inp" id="q" value="${q.replace(/"/g,'&quot;')}" placeholder="Search the web…"/>
      <button class="search-btn" type="submit">Search</button>
    </form>
  </div>
  <div class="results">
    <div class="result-count">${results.length} results for "<strong>${q}</strong>"</div>
    ${results.length ? results.map(r => `
      <div class="result">
        <div class="result-url">${r.displayUrl || r.href}</div>
        <div class="result-title"><a href="https://${host}/proxy?url=${encodeURIComponent(r.href)}" onclick="navigate(event,'${encodeURIComponent(r.href)}')">${r.title}</a></div>
        <div class="result-snippet">${r.snippet}</div>
      </div>`).join('') : `<div class="no-results">No results found. Try a different search.</div>`}
    <div class="powered">Powered by Bing · Routed through CentOS Web Proxy</div>
  </div>
  <script>
    function doSearch(e){
      e.preventDefault();
      var q=document.getElementById('q').value.trim();
      if(!q) return;
      try{ window.parent.postMessage({type:'centos-nav',url:'https://${host}/search?q='+encodeURIComponent(q)},'*'); }catch{}
    }
    function navigate(e,encodedUrl){
      e.preventDefault();
      try{ window.parent.postMessage({type:'centos-nav',url:'https://${host}/proxy?url='+encodedUrl},'*'); }catch{}
    }
  </script>
</body>
</html>`;

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Access-Control-Allow-Origin', '*');
    res.removeHeader('X-Frame-Options');
    res.set('Content-Security-Policy', 'frame-ancestors *');
    res.send(html);
  } catch (err) {
    console.error('[SEARCH]', err.message);
    res.status(500).send(`Search error: ${err.message}`);
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

    // Strip ALL headers that could cause framing/CORS issues
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
      return res.send(body);
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
