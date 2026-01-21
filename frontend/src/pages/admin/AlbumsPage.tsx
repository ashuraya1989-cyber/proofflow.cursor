import { useEffect, useMemo, useState } from "react";
import { api, type Album, type Image, type Subfolder } from "../../lib/api";
import { adminMedia } from "../../lib/media";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Modal } from "../../ui/modal";
import { useToast } from "../../ui/toast";

type ViewerState = { open: boolean; idx: number };

export function AlbumsPage() {
  const { push } = useToast();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [subfolders, setSubfolders] = useState<Subfolder[]>([]);
  const [images, setImages] = useState<Image[]>([]);
  const [albumId, setAlbumId] = useState<string>("");
  const [subfolderId, setSubfolderId] = useState<string | null>(null);
  const [newAlbumName, setNewAlbumName] = useState("");
  const [newSubName, setNewSubName] = useState("");
  const [loading, setLoading] = useState(false);
  const [viewer, setViewer] = useState<ViewerState>({ open: false, idx: 0 });

  const activeImage = images[viewer.idx];

  const scopeLabel = useMemo(() => {
    if (!subfolderId) return "All";
    const sf = subfolders.find((s) => s.id === subfolderId);
    return sf?.name ?? "Subfolder";
  }, [subfolderId, subfolders]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    api.admin
      .listAlbums()
      .then((a) => {
        if (!live) return;
        setAlbums(a);
        if (!albumId && a[0]) setAlbumId(a[0].id);
      })
      .catch((e) => push({ title: "Failed to load albums", body: String(e.message || e) }))
      .finally(() => setLoading(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!albumId) return;
    let live = true;
    setSubfolderId(null);
    setImages([]);
    api.admin
      .listSubfolders(albumId)
      .then((s) => {
        if (!live) return;
        setSubfolders(s);
      })
      .catch((e) => push({ title: "Failed to load subfolders", body: String(e.message || e) }));
    return () => {
      live = false;
    };
  }, [albumId, push]);

  useEffect(() => {
    if (!albumId) return;
    let live = true;
    api.admin
      .listImages(albumId, subfolderId)
      .then((imgs) => {
        if (!live) return;
        setImages(imgs);
      })
      .catch((e) => push({ title: "Failed to load images", body: String(e.message || e) }));
    return () => {
      live = false;
    };
  }, [albumId, subfolderId, push]);

  async function onCreateAlbum() {
    const name = newAlbumName.trim();
    if (!name) return;
    try {
      const created = await api.admin.createAlbum(name);
      setAlbums((a) => [created, ...a]);
      setNewAlbumName("");
      setAlbumId(created.id);
      push({ title: "Album created", body: created.name });
    } catch (e: any) {
      push({ title: "Album create failed", body: String(e?.message || e) });
    }
  }

  async function onCreateSubfolder() {
    const name = newSubName.trim();
    if (!name || !albumId) return;
    try {
      const created = await api.admin.createSubfolder(albumId, name);
      setSubfolders((s) => [created, ...s]);
      setNewSubName("");
      push({ title: "Subfolder created", body: created.name });
    } catch (e: any) {
      push({ title: "Subfolder create failed", body: String(e?.message || e) });
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
    <div className="pf-page">
      <h1 className="pf-h1">Albums</h1>
      <div className="pf-subtitle">Browse by album and subfolder. “All” aggregates subfolders without creating a root.</div>

      <div className="pf-split" style={{ marginTop: 16 }}>
        <div className="pf-panel pf-panel--flat">
          <div style={{ padding: 14 }}>
            <div className="pf-label">Create album</div>
            <div className="row">
              <Input value={newAlbumName} onChange={(e) => setNewAlbumName(e.target.value)} placeholder="Album name" />
              <Button variant="primary" onClick={onCreateAlbum}>
                Create
              </Button>
            </div>
          </div>

          <div style={{ padding: 14, borderTop: "1px solid var(--border)" }}>
            <div className="pf-label">Albums</div>
            <div className="pf-miniList" style={{ maxHeight: "52vh", overflow: "auto", paddingRight: 2 }}>
              {albums.map((a) => (
                <div
                  key={a.id}
                  className={["pf-miniItem", albumId === a.id ? "pf-miniItem--active" : ""].join(" ")}
                  onClick={() => setAlbumId(a.id)}
                >
                  <div className="pf-miniTitle">{a.name}</div>
                  <div className="pf-miniMeta">{new Date(a.created_at).toLocaleString()}</div>
                </div>
              ))}
              {loading && albums.length === 0 ? <div className="muted">Loading…</div> : null}
              {!loading && albums.length === 0 ? <div className="muted">No albums yet.</div> : null}
            </div>
          </div>
        </div>

        <div>
          <div className="pf-panel pf-panel--flat">
            <div style={{ padding: 14, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <div className="pf-label">Create subfolder (in selected album)</div>
                <Input value={newSubName} onChange={(e) => setNewSubName(e.target.value)} placeholder="Subfolder name" />
              </div>
              <Button variant="primary" onClick={onCreateSubfolder} disabled={!albumId}>
                Create
              </Button>
            </div>

            <div style={{ padding: 14, borderTop: "1px solid var(--border)" }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div>
                  <div className="pf-label">Subfolders</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    View scope: <span style={{ color: "var(--text)" }}>{scopeLabel}</span>
                  </div>
                </div>
                <Button variant="ghost" onClick={() => setSubfolderId(null)} disabled={!albumId || subfolderId === null}>
                  All
                </Button>
              </div>
              <div className="pf-miniList" style={{ marginTop: 10, maxHeight: 190, overflow: "auto", paddingRight: 2 }}>
                {subfolders.map((s) => (
                  <div
                    key={s.id}
                    className={["pf-miniItem", subfolderId === s.id ? "pf-miniItem--active" : ""].join(" ")}
                    onClick={() => setSubfolderId(s.id)}
                  >
                    <div className="pf-miniTitle">{s.name}</div>
                    <div className="pf-miniMeta">{new Date(s.created_at).toLocaleString()}</div>
                  </div>
                ))}
                {albumId && subfolders.length === 0 ? <div className="muted">No subfolders yet.</div> : null}
              </div>
            </div>
          </div>

          <div className="pf-panel pf-panel--flat" style={{ marginTop: 14 }}>
            <div style={{ padding: 14, borderBottom: "1px solid var(--border)" }} className="row">
              <div style={{ flex: 1 }}>
                <div className="pf-label">Images</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {images.length} items
                </div>
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                Click a thumbnail to preview
              </div>
            </div>
            <div style={{ padding: 14 }}>
              {images.length === 0 ? (
                <div className="muted">No images in this scope yet.</div>
              ) : (
                <div className="pf-grid pf-grid--thumbs">
                  {images.map((img, idx) => (
                    <div key={img.id} className="pf-thumb" onClick={() => openViewer(idx)} title={img.filename}>
                      <img
                        src={adminMedia(img.thumb_url)}
                        alt={img.filename}
                        loading="lazy"
                        draggable={false}
                        style={{ background: "rgba(255,255,255,0.02)" }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

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
                {activeImage.width}×{activeImage.height}
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
                  href={adminMedia(activeImage.image_url)}
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
                src={adminMedia(activeImage.preview_url || activeImage.image_url)}
                alt={activeImage.filename}
                style={{
                  display: "block",
                  width: "100%",
                  height: "auto",
                  maxHeight: "62vh",
                  objectFit: "contain",
                  background: "rgba(255,255,255,0.02)"
                }}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

