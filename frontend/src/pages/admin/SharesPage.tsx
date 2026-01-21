import { useEffect, useMemo, useState } from "react";
import { api, type Album, type Share, type Subfolder } from "../../lib/api";
import { Button } from "../../ui/button";
import { Input, Select } from "../../ui/input";
import { useToast } from "../../ui/toast";

export function SharesPage() {
  const { push } = useToast();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [subfolders, setSubfolders] = useState<Subfolder[]>([]);
  const [albumId, setAlbumId] = useState("");
  const [subfolderId, setSubfolderId] = useState<string | "ALL">("ALL");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [share, setShare] = useState<Share | null>(null);

  useEffect(() => {
    api.admin
      .listAlbums()
      .then((a) => {
        setAlbums(a);
        if (a[0]) setAlbumId(a[0].id);
      })
      .catch((e) => push({ title: "Failed to load albums", body: String(e.message || e) }));
  }, [push]);

  useEffect(() => {
    if (!albumId) return;
    setShare(null);
    setSubfolderId("ALL");
    api.admin
      .listSubfolders(albumId)
      .then((s) => setSubfolders(s))
      .catch((e) => push({ title: "Failed to load subfolders", body: String(e.message || e) }));
  }, [albumId, push]);

  const scopeText = useMemo(() => {
    if (subfolderId === "ALL") return "All subfolders (album aggregate)";
    const sf = subfolders.find((s) => s.id === subfolderId);
    return sf ? `Subfolder: ${sf.name}` : "Subfolder";
  }, [subfolderId, subfolders]);

  async function create() {
    const pw = password.trim();
    if (!albumId) {
      push({ title: "Select an album" });
      return;
    }
    if (pw.length < 4) {
      push({ title: "Password too short", body: "Use at least 4 characters." });
      return;
    }
    setCreating(true);
    try {
      const created = await api.admin.createShare(albumId, subfolderId === "ALL" ? null : subfolderId, pw);
      setShare(created);
      push({ title: "Share link created", body: scopeText });
    } catch (e: any) {
      push({ title: "Share create failed", body: String(e?.message || e) });
    } finally {
      setCreating(false);
    }
  }

  async function copyUrl() {
    if (!share?.url) return;
    try {
      await navigator.clipboard.writeText(share.url);
      push({ title: "Copied", body: "Share URL copied to clipboard." });
    } catch {
      push({ title: "Copy failed", body: "Your browser blocked clipboard access." });
    }
  }

  return (
    <div className="pf-page">
      <h1 className="pf-h1">Send to client</h1>
      <div className="pf-subtitle">Generate a secure client link with a manual password. Links use absolute URLs for predictable sharing.</div>

      <div className="pf-panel pf-panel--flat" style={{ marginTop: 16 }}>
        <div style={{ padding: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div className="pf-label">Album</div>
            <Select value={albumId} onChange={(e) => setAlbumId(e.target.value)}>
              <option value="" disabled>
                Select album…
              </option>
              {albums.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <div className="pf-label">Scope</div>
            <Select value={subfolderId} onChange={(e) => setSubfolderId(e.target.value as any)} disabled={!albumId}>
              <option value="ALL">All</option>
              {subfolders.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div style={{ padding: 14, borderTop: "1px solid var(--border)", display: "grid", gridTemplateColumns: "1fr 160px", gap: 12 }}>
          <div>
            <div className="pf-label">Password</div>
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter a password the client will use"
              type="password"
              autoComplete="new-password"
            />
            <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              {scopeText}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "flex-end" }}>
            <Button variant="primary" onClick={create} disabled={creating}>
              {creating ? "Creating…" : "Create link"}
            </Button>
          </div>
        </div>
      </div>

      {share ? (
        <div className="pf-panel pf-panel--flat" style={{ marginTop: 14 }}>
          <div style={{ padding: 14, borderBottom: "1px solid var(--border)" }}>
            <div className="pf-label">Share URL</div>
            <div className="muted" style={{ fontSize: 12 }}>
              This is the client link. The password is validated server-side and never stored in plaintext.
            </div>
          </div>
          <div style={{ padding: 14, display: "grid", gridTemplateColumns: "1fr 120px", gap: 12 }}>
            <Input value={share.url} readOnly spellCheck={false} />
            <Button variant="primary" onClick={copyUrl}>
              Copy
            </Button>
          </div>
          <div style={{ padding: "0 14px 14px" }} className="muted">
            <div style={{ fontSize: 12 }}>
              Expires: {share.expires_at ? new Date(share.expires_at).toLocaleString() : "Never"}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

