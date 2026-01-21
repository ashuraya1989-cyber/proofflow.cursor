import { NavLink, Route, Routes } from "react-router-dom";
import { Button } from "../../ui/button";
import { useTheme } from "../../ui/theme";
import { Input } from "../../ui/input";
import { useEffect, useMemo, useState } from "react";
import { getAdminToken, setAdminToken } from "../../lib/storage";
import { AlbumsPage } from "./AlbumsPage";
import { UploadPage } from "./UploadPage";
import { SharesPage } from "./SharesPage";

export function AdminShell() {
  const { theme, toggle } = useTheme();
  const [token, setToken] = useState(() => getAdminToken());
  const [tokenDraft, setTokenDraft] = useState(token);

  useEffect(() => {
    setTokenDraft(token);
  }, [token]);

  const tokenState = useMemo(() => {
    if (!token) return { label: "Not set", color: "var(--warn)" };
    return { label: "Set", color: "var(--success)" };
  }, [token]);

  return (
    <div className="pf-appShell">
      <aside className="pf-side">
        <div className="pf-brand">
          <div className="pf-brandTitle">ProofFlow</div>
          <span className="pf-kbd">Admin</span>
        </div>
        <nav className="pf-nav" aria-label="Admin navigation">
          <NavLink to="/admin" end>
            Albums
          </NavLink>
          <NavLink to="/admin/upload">Bulk upload</NavLink>
          <NavLink to="/admin/shares">Send to client</NavLink>
        </nav>
        <div style={{ marginTop: 16 }} className="pf-panel pf-panel--flat">
          <div style={{ padding: 12 }}>
            <div className="pf-label">Admin token</div>
            <Input
              value={tokenDraft}
              onChange={(e) => setTokenDraft(e.target.value)}
              placeholder="X-Admin-Token"
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
            />
            <div className="row" style={{ justifyContent: "space-between", marginTop: 10 }}>
              <div className="muted" style={{ fontSize: 12 }}>
                Status: <span style={{ color: tokenState.color }}>{tokenState.label}</span>
              </div>
              <Button
                variant="primary"
                onClick={() => {
                  const next = tokenDraft.trim();
                  setAdminToken(next);
                  setToken(next);
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      </aside>

      <main className="pf-main">
        <div className="pf-topbar">
          <div className="row">
            <div className="muted" style={{ fontSize: 13 }}>
              Calm, stable admin tooling.
            </div>
          </div>
          <div className="row">
            <Button variant="ghost" onClick={toggle}>
              Theme: {theme}
            </Button>
          </div>
        </div>

        <Routes>
          <Route path="/" element={<AlbumsPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/shares" element={<SharesPage />} />
        </Routes>
      </main>
    </div>
  );
}

