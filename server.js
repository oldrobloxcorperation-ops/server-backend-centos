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
  var _f=window.fetch;
  window.fetch=function(r,o){ if(typeof r==='string'&&/^https?:/.test(r)) r=P+encodeURIComponent(r); return _f(r,o); };
  var _x=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(m,u){ if(/^https?:/.test(u)) u=P+encodeURIComponent(u); return _x.apply(this,arguments); };
  document.addEventListener('click',function(e){
    var a=e.target.closest('a'); if(!a) return;
    var h=a.getAttribute('href');
    if(!h||/^(#|javascript:|mailto:|tel:)/.test(h)) return;
    e.preventDefault();
    try{ window.location.href=P+encodeURIComponent(new URL(h,B).href); }catch{}
  },true);
  document.addEventListener('submit',function(e){
    var f=e.target, m=(f.method||'GET').toUpperCase();
    if(m!=='GET') return;
    e.preventDefault();
    var abs; try{ abs=new URL(f.action||B,B).href; }catch{ abs=f.action||B; }
    window.location.href=P+encodeURIComponent(abs+'?'+new URLSearchParams(new FormData(f)));
  },true);
})();
<\/script>`;
}

// Main proxy endpoint
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
      headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,*/*;q=0.9', 'Accept-Language': 'en-US,en;q=0.9', 'Accept-Encoding': 'gzip, deflate, br', 'Referer': target.origin },
    });
    const ct = upstream.headers['content-type'] || '';
    res.set('Access-Control-Allow-Origin', '*');
    res.set('X-Frame-Options', 'ALLOWALL');
    res.removeHeader('Content-Security-Policy');

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
      $('meta[http-equiv="X-Frame-Options"]').remove();
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
    const r = await axios.post(raw, req.body, { timeout: 15000, validateStatus: () => true, headers: { 'User-Agent': UA, 'Content-Type': req.get('content-type') || 'application/x-www-form-urlencoded' } });
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
