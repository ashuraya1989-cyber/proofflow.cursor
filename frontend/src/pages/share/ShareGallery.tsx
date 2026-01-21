import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api, type Image, type ShareMeta } from "../../lib/api";
import { shareMedia } from "../../lib/media";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Modal } from "../../ui/modal";
import { useToast } from "../../ui/toast";
import { getShareToken, setShareToken } from "../../lib/storage";

type ViewerState = { open: boolean; idx: number };

export function ShareGallery() {
  const { push } = useToast();
  const { shareId = "" } = useParams();

  const [meta, setMeta] = useState<ShareMeta | null>(null);
  const [images, setImages] = useState<Image[]>([]);
  const [password, setPassword] = useState("");
  const [phase, setPhase] = useState<"loading" | "password" | "gallery">("loading");
  const [viewer, setViewer] = useState<ViewerState>({ open: false, idx: 0 });

  const activeImage = images[viewer.idx];
  const title = useMemo(() => meta?.title ?? "Client gallery", [meta]);

  useEffect(() => {
    let live = true;
    setPhase("loading");
    api.shares
      .meta(shareId)
      .then((m) => {
        if (!live) return;
        setMeta(m);
        const existing = getShareToken(shareId);
        if (existing) {
          api.shares
            .listImages(shareId)
            .then((imgs) => {
              if (!live) return;
              setImages(imgs);
              setPhase("gallery");
            })
            .catch(() => setPhase("password"));
        } else {
          setPhase("password");
        }
      })
      .catch(() => {
        if (!live) return;
        setPhase("password");
        push({ title: "Link not found or expired" });
      });
    return () => {
      live = false;
    };
  }, [push, shareId]);

  async function unlock() {
    const pw = password.trim();
    if (pw.length < 4) {
      push({ title: "Password too short" });
      return;
    }
    try {
      const res = await api.shares.auth(shareId, pw);
      setShareToken(shareId, res.token);
      const imgs = await api.shares.listImages(shareId);
      setImages(imgs);
      setPhase("gallery");
      push({ title: "Unlocked", body: `${imgs.length} photos` });
    } catch {
      push({ title: "Invalid password or expired link" });
    }
  }

  function openViewer(idx: number) {
    setViewer({ open: true, idx });
  }

  function step(delta: number) {
    setViewer((v) => {
      const next = Math.max(0, Math.min(images.length - 1, v.idx + delta));
      return { ...v, idx: next };
    });
  }

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 40 }}>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontWeight: 650, fontSize: 16, letterSpacing: "-0.01em" }}>{title}</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            {meta?.mode === "single_subfolder" ? "A curated selection." : "All photos in this album."}
          </div>
        </div>
        <a href="/admin" className="pf-btn pf-btn--ghost">
          Admin
        </a>
      </div>

      {phase === "loading" ? (
        <div className="pf-panel pf-panel--flat" style={{ padding: 16 }}>
          <div className="muted">Loading…</div>
        </div>
      ) : null}

      {phase === "password" ? (
        <div className="pf-panel pf-panel--flat" style={{ padding: 16, maxWidth: 520 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>Enter password</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            This gallery is protected. Ask the sender for the password.
          </div>
          <div style={{ marginTop: 12 }}>
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="Password"
              autoComplete="current-password"
            />
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <Button variant="primary" onClick={unlock}>
              Unlock
            </Button>
          </div>
        </div>
      ) : null}

      {phase === "gallery" ? (
        <div className="pf-panel pf-panel--flat" style={{ padding: 16 }}>
          {images.length === 0 ? (
            <div className="muted">No images in this share.</div>
          ) : (
            <div className="pf-grid pf-grid--thumbs">
              {images.map((img, idx) => (
                <div key={img.id} className="pf-thumb" onClick={() => openViewer(idx)} title={img.filename}>
                  <img src={shareMedia(img.thumb_url, shareId)} alt={img.filename} loading="lazy" draggable={false} />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <Modal
        open={viewer.open}
        title={
          <div className="row" style={{ justifyContent: "space-between", width: "100%" }}>
            <div style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {activeImage?.filename || "Image"}
            </div>
            <span className="pf-kbd">
              {images.length ? viewer.idx + 1 : 0}/{images.length}
            </span>
          </div>
        }
        onClose={() => setViewer((v) => ({ ...v, open: false }))}
      >
        {!activeImage ? (
          <div className="muted">Nothing selected.</div>
        ) : (
          <div>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
              <div className="muted" style={{ fontSize: 12 }}>
                High quality view · {activeImage.width}×{activeImage.height}
              </div>
              <div className="row">
                <Button variant="ghost" onClick={() => step(-1)} disabled={viewer.idx <= 0}>
                  Prev
                </Button>
                <Button variant="ghost" onClick={() => step(1)} disabled={viewer.idx >= images.length - 1}>
                  Next
                </Button>
                <a
                  className="pf-btn pf-btn--primary"
                  href={shareMedia(activeImage.image_url, shareId)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open full
                </a>
              </div>
            </div>
            <div
              style={{
                borderRadius: 12,
                border: "1px solid var(--border)",
                overflow: "hidden",
                background: "rgba(255,255,255,0.02)"
              }}
            >
              <img
                src={shareMedia(activeImage.preview_url || activeImage.image_url, shareId)}
                alt={activeImage.filename}
                style={{
                  display: "block",
                  width: "100%",
                  height: "auto",
                  maxHeight: "62vh",
                  objectFit: "contain",
                  imageRendering: "auto"
                }}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

