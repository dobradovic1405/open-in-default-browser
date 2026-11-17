const { marked } = require('marked');

// Pure helpers that build the HTML pages. No dependency on VS Code, so they can be unit tested.

// Injected into served HTML pages: reloads the page whenever the server reports a file change.
// Short polls instead of a permanent connection: browsers allow only about 6 open connections per host,
// so long-lived connections would block new tabs.
const RELOAD_SNIPPET =
  "<script>(function(){var page;try{page=decodeURIComponent(location.pathname);}catch(e){page=location.pathname;}var start=null,force=null;function tick(){fetch('/__poll?page='+encodeURIComponent(page),{cache:'no-store'}).then(function(r){return r.json();}).then(function(d){if(start===null){start=d.version;force=d.force;}else if(d.version!==start||d.force!==force){location.reload();}}).catch(function(){}).then(function(){setTimeout(tick,1000);});}tick();})();</script>";

const PAGE_STYLE = `
:root { color-scheme: light dark; --bg: #ffffff; --fg: #1f2328; --muted: #656d76; --code: #f6f8fa; --border: #d0d7de; }
@media (prefers-color-scheme: dark) { :root { --bg: #0d1117; --fg: #e6edf3; --muted: #8d96a0; --code: #161b22; --border: #30363d; } }
html, body { margin: 0; height: 100%; background: var(--bg); color: var(--fg); }
body { font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.markdown { max-width: 900px; margin: 2rem auto; padding: 0 1.25rem; }
.markdown img { max-width: 100%; }
.markdown table { border-collapse: collapse; }
.markdown td, .markdown th { border: 1px solid var(--border); padding: 0.4rem 0.6rem; }
pre { background: var(--code); padding: 1rem; margin: 1rem; overflow: auto; border-radius: 6px; font: 13px/1.5 ui-monospace, SFMono-Regular, Consolas, monospace; }
.markdown pre code { font: inherit; }
.fit { display: block; max-width: calc(100% - 2rem); margin: 2rem auto; }
.full { position: fixed; inset: 0; width: 100%; height: 100%; border: 0; }
`;

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function withReload(html, reload) {
  if (!reload) {
    return html;
  }
  return html.includes('</body>') ? html.replace('</body>', RELOAD_SNIPPET + '</body>') : html + RELOAD_SNIPPET;
}

/**
 * Adds a <title> if the HTML has none. Without one, the browser shows the URL as the tab title,
 * and the file could not be matched to its window later.
 */
function withTitle(html, name) {
  if (/<title[\s>]/i.test(html)) {
    return html;
  }
  const tag = `<title>${escapeHtml(name)}</title>`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (match) => match + tag);
  }
  return tag + html;
}

function wrapPage(name, body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(name)}</title>
<style>${PAGE_STYLE}</style>
</head>
<body>
${body}
</body>
</html>`;
}

function prettyJson(text) {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

/** Builds the page for a Markdown, JSON, XML, SVG or PDF file. */
function bodyFor(ext, name, rawUrl, text) {
  switch (ext) {
    case '.md':
      return `<article class="markdown">${marked.parse(text)}</article>`;
    case '.json':
      return `<pre>${escapeHtml(prettyJson(text))}</pre>`;
    case '.xml':
    case '.xsd':
      return `<pre>${escapeHtml(text)}</pre>`;
    case '.svg':
      return `<img class="fit" src="${rawUrl}" alt="${escapeHtml(name)}">`;
    case '.pdf':
      return `<embed class="full" src="${rawUrl}" type="application/pdf">`;
    default:
      return `<pre>${escapeHtml(text)}</pre>`;
  }
}

module.exports = { RELOAD_SNIPPET, PAGE_STYLE, escapeHtml, withReload, withTitle, wrapPage, prettyJson, bodyFor };
