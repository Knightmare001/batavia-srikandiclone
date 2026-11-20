import { Archive, Eye, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Badge } from "../../components/common/Badge";
import { DocumentViewer } from "../../components/pdf/DocumentViewer";
import { useDebounce } from "../../hooks/useDebounce";
import { api } from "../../services/api";
import type { ArchiveItem, PageInfo } from "../../types";
export function ArsipGlobalPage() {
  const [params, setParams] = useSearchParams(),
    [search, setSearch] = useState(params.get("search") || ""),
    [kind, setKind] = useState(params.get("jenis") || ""),
    [status, setStatus] = useState(""),
    [year, setYear] = useState(""),
    [month, setMonth] = useState("");
  const [items, setItems] = useState<ArchiveItem[]>([]),
    [page, setPage] = useState(1),
    [pagination, setPagination] = useState<PageInfo>({
      page: 1,
      limit: 10,
      total: 0,
      total_pages: 1,
    }),
    [error, setError] = useState(""),
    [preview, setPreview] = useState<ArchiveItem | null>(null);
  const term = useDebounce(search);
  useEffect(() => {
    const next = new URLSearchParams();
    if (term) next.set("search", term);
    if (kind) next.set("jenis", kind);
    setParams(next, { replace: true });
    const query = new URLSearchParams({ page: String(page), limit: "10" });
    if (term) query.set("search", term);
    if (kind) query.set("jenis", kind);
    if (status) query.set("status", status);
    if (year) query.set("tahun", year);
    if (month) query.set("bulan", month);
    void api<{ data: ArchiveItem[]; pagination: PageInfo }>(`/arsip?${query}`)
      .then((r) => {
        setItems(r.data);
        setPagination(r.pagination);
        setError("");
      })
      .catch((e: Error) => setError(e.message));
  }, [term, kind, status, year, month, page, setParams]);
  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">PUSAT DOKUMEN</span>
          <h1>Arsip & pencarian</h1>
          <p>Telusuri surat masuk dan keluar dalam satu daftar terpadu.</p>
        </div>
        <div className="heading-count">
          <Archive size={17} /> {pagination.total ?? 0} arsip
        </div>
      </div>
      <section className="panel filter-panel">
        <div className="search-field">
          <Search size={17} />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Cari nomor surat, perihal, pengirim atau tujuan"
          />
        </div>
        <div className="filter-row">
          <div className="filter-label">
            <SlidersHorizontal size={15} /> Filter
          </div>
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Semua jenis arsip</option>
            <option value="surat_masuk">Surat masuk</option>
            <option value="surat_keluar">Surat keluar</option>
          </select>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Semua status</option>
            <option>Draft</option>
            <option>Menunggu Kepala Sekolah</option>
            <option>Didisposisikan</option>
            <option>Selesai</option>
            <option>Tercatat</option>
          </select>
          <input
            className="year-input"
            value={year}
            onChange={(e) => {
              setYear(e.target.value);
              setPage(1);
            }}
            placeholder="Tahun"
            inputMode="numeric"
          />
          <select
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Semua bulan</option>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(2026, i).toLocaleString("id-ID", { month: "long" })}
              </option>
            ))}
          </select>
        </div>
      </section>
      {error && <div className="error-box">{error}</div>}
      <section className="panel table-panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nomor agenda</th>
                <th>Perihal</th>
                <th>Pihak terkait</th>
                <th>Tanggal</th>
                <th>Jenis</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={`${item.jenis_arsip}-${item.id}`}>
                  <td>
                    <strong className="table-primary">
                      {item.nomor_agenda}
                    </strong>
                    <small>
                      {item.nomor_surat || "Nomor surat belum tersedia"}
                    </small>
                  </td>
                  <td>{item.perihal}</td>
                  <td>{item.pihak_terkait}</td>
                  <td>
                    {new Date(`${item.tanggal}T00:00:00`).toLocaleDateString(
                      "id-ID",
                      { day: "numeric", month: "short", year: "numeric" },
                    )}
                  </td>
                  <td>
                    <Badge
                      tone={
                        item.jenis_arsip === "surat_masuk" ? "green" : "neutral"
                      }
                    >
                      {item.jenis_arsip === "surat_masuk" ? "Masuk" : "Keluar"}
                    </Badge>
                  </td>
                  <td>
                    <Badge
                      tone={
                        item.status === "Selesai" || item.status === "Tercatat"
                          ? "green"
                          : "amber"
                      }
                    >
                      {item.status}
                    </Badge>
                  </td>
                  <td>
                    <button
                      className="icon-button row-action"
                      data-tooltip="Pratinjau dokumen"
                      onClick={() => setPreview(item)}
                    >
                      <Eye size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && (
            <div className="empty-state">
              <Archive size={25} />
              <strong>Arsip tidak ditemukan</strong>
              <span>Coba ubah kata kunci atau filter pencarian.</span>
            </div>
          )}
        </div>
        <div className="pagination">
          <span>
            Halaman {page} dari {pagination.total_pages || 1}
          </span>
          <div>
            <button
              className="button button-secondary"
              disabled={page <= 1}
              onClick={() => setPage((v) => v - 1)}
            >
              Sebelumnya
            </button>
            <button
              className="button button-secondary"
              disabled={page >= (pagination.total_pages || 1)}
              onClick={() => setPage((v) => v + 1)}
            >
              Berikutnya
            </button>
          </div>
        </div>
      </section>
      {preview && (
        <DocumentViewer
          title={preview.nomor_agenda}
          endpoint={`/${preview.jenis_arsip === "surat_masuk" ? "surat-masuk" : "surat-keluar"}/${preview.id}/dokumen`}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
