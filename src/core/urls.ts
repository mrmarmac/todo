/**
 * If `raw` is a bare URL (a single token, http/https or a leading `www.`),
 * return a link `href` plus a compact `label` for display; otherwise `null`.
 *
 * The label drops the protocol and a leading `www.`, keeping just the host, and
 * appends `/…` when the URL carries a path, query, or fragment — so
 * `https://www.governance.ai/post/x?ref=1` shows as `governance.ai/…`.
 */
export function parseUrl(raw: string): { href: string; label: string } | null {
  const text = raw.trim();
  // A task title with spaces is prose, not a link.
  if (text === '' || /\s/.test(text)) return null;

  const hasProtocol = /^https?:\/\//i.test(text);
  if (!hasProtocol && !/^www\./i.test(text)) return null;

  let url: URL;
  try {
    url = new URL(hasProtocol ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  const host = url.hostname.replace(/^www\./i, '');
  // Require a real domain (a dot), so "www.foo" or "http://localhost" don't pill.
  if (!host.includes('.')) return null;

  const hasPath = (url.pathname !== '' && url.pathname !== '/') || url.search !== '' || url.hash !== '';
  return { href: url.href, label: host + (hasPath ? '/…' : '') };
}
