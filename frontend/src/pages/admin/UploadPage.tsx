import { useEffect, useMemo, useState } from "react";
import { api, type Album, type Subfolder } from "../../lib/api";
import { uploadSingleImage } from "../../lib/upload";
import { Button } from "../../ui/button";
import { Input, Select } from "../../ui/input";
import { Progress } from "../../ui/progress";
import { useToast } from "../../ui/toast";

type UploadItem = {
  id: string;
  file: File;
  progress: number;
  status: "queued" | "uploading" | "success" | "error";
  message?: string;
};

export function UploadPage() {
  const { push } = useToast();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [subfolders, setSubfolders] = useState<Subfolder[]>([]);
  const [albumId, setAlbumId] = useState<string>("");
  const [subfolderId, setSubfolderId] = useState<string>("");
  const [items, setItems] = useState<UploadItem[]>([]);
  const [busy, setBusy] = useState(false);

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
    setSubfolderId("");
    api.admin
      .listSubfolders(albumId)
      .then((s) => {
        setSubfolders(s);
        if (s[0]) setSubfolderId(s[0].id);
      })
      .catch((e) => push({ title: "Failed to load subfolders", body: String(e.message || e) }));
  }, [albumId, push]);

  const summary = useMemo(() => {
    const total = items.length;
    const ok = items.filter((i) => i.status === "success").length;
    const err = items.filter((i) => i.status === "error").length;
    return { total, ok, err };
  }, [items]);

  function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const next: UploadItem[] = Array.from(files).map((file) => ({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      file,
      progress: 0,
      status: "queued"
    }));
    setItems((prev) => [...next, ...prev]);
  }

  async function runUpload() {
    if (!albumId || !subfolderId) {
      push({ title: "Select an album and subfolder" });
      return;
    }
    const pending = items.filter((i) => i.status === "queued" || i.status === "error");
    if (pending.length === 0) {
      push({ title: "Nothing to upload" });
      return;
    }
    setBusy(true);
    push({ title: "Upload started", body: `${pending.length} file(s)` });

    const concurrency = 3;
    let idx = 0;
    let ok = 0;
    let err = 0;

    const worker = async () => {
      while (idx < pending.length) {
        const current = pending[idx++];
        setItems((prev) =>
          prev.map((x) => (x.id === current.id ? { ...x, status: "uploading", progress: 0, message: undefined } : x))
        );
        const result = await uploadSingleImage({
          albumId,
          subfolderId,
          file: current.file,
          onProgress: (pct) =>
            setItems((prev) => prev.map((x) => (x.id === current.id ? { ...x, progress: pct } : x)))
        });
        if (result.ok) {
          ok += 1;
          setItems((prev) =>
            prev.map((x) => (x.id === current.id ? { ...x, status: "success", progress: 100 } : x))
          );
        } else {
          err += 1;
          setItems((prev) =>
            prev.map((x) => (x.id === current.id ? { ...x, status: "error", message: result.error } : x))
          );
        }
      }
    };

    await Promise.all(Array.from({ length: concurrency }).map(() => worker()));
    setBusy(false);
    push({
      title: "Upload finished",
      body: `${ok} success, ${err} errors`
    });
  }

  return (
    <div className="pf-page">
      <h1 className="pf-h1">Bulk upload</h1>
      <div className="pf-subtitle">Per-file progress with clear success/error feedback. Files are stored as originals + generated thumbnails.</div>

      <div className="pf-panel pf-panel--flat" style={{ marginTop: 16 }}>
        <div style={{ padding: 14, display: "grid", gridTemplateColumns: "1fr 1fr 180px", gap: 12 }}>
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
            <div className="pf-label">Subfolder</div>
            <Select value={subfolderId} onChange={(e) => setSubfolderId(e.target.value)}>
              <option value="" disabled>
                Select subfolder…
              </option>
              {subfolders.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <div className="pf-label">Add files</div>
            <Input type="file" multiple accept="image/*" onChange={(e) => addFiles(e.target.files)} />
          </div>
        </div>
        <div style={{ padding: 14, borderTop: "1px solid var(--border)" }} className="row">
          <Button variant="primary" onClick={runUpload} disabled={busy}>
            {busy ? "Uploading…" : "Start upload"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => setItems((prev) => prev.filter((i) => i.status !== "success"))}
            disabled={busy || items.every((i) => i.status !== "success")}
          >
            Clear successes
          </Button>
          <div className="muted" style={{ fontSize: 12 }}>
            {summary.total} queued · {summary.ok} success · {summary.err} errors
          </div>
        </div>
      </div>

      <div className="pf-panel pf-panel--flat" style={{ marginTop: 14 }}>
        <div style={{ padding: 14, borderBottom: "1px solid var(--border)" }}>
          <div className="pf-label">Upload queue</div>
          <div className="muted" style={{ fontSize: 12 }}>
            Each file uploads independently (resilient to single-file failures).
          </div>
        </div>
        <div style={{ padding: 14, display: "grid", gap: 10 }}>
          {items.length === 0 ? <div className="muted">Add some images to begin.</div> : null}
          {items.map((it) => (
            <div
              key={it.id}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: 12,
                background: "rgba(255,255,255,0.03)"
              }}
            >
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {it.file.name}
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {(it.file.size / (1024 * 1024)).toFixed(2)} MB · {it.status}
                    {it.message ? ` · ${it.message}` : ""}
                  </div>
                </div>
                {it.status === "error" ? (
                  <Button
                    variant="ghost"
                    onClick={() => setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, status: "queued" } : x)))}
                    disabled={busy}
                  >
                    Retry
                  </Button>
                ) : null}
              </div>
              <div style={{ marginTop: 10 }}>
                <Progress value={it.status === "success" ? 100 : it.progress} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

