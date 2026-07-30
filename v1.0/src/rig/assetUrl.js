/**
 * Resolve Mesh2Motion asset paths for hub (/v1.0/, /v1.01/) and standalone.
 *
 * Hub / Netlify: files live at /v1.0/static/animations|rigs/...
 * Standalone / Vite: publicDir serves them at /animations|rigs/...
 */
export function assetUrl(path) {
  const clean = String(path || "").replace(/^\//, "");
  if (typeof location !== "undefined") {
    const m = location.pathname.match(/^\/(v[\d.]+)(?:\/|$)/i);
    if (m) return `/${m[1]}/static/${clean}`;
  }
  return `/${clean}`;
}
