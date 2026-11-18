import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { Modal } from "../common/Modal";
import { api, apiUrl } from "../../services/api";
export function DocumentViewer({ title, endpoint, onClose }: { title: string; endpoint: string; onClose: () => void }) {
  const [url, setUrl] = useState(""), [error, setError] = useState("");
  useEffect(() => { let objectUrl = ""; void api<Response>(endpoint).then((response) => response.blob()).then((blob) => { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); }).catch((e: Error) => setError(e.message)); return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); }; }, [endpoint]);
  const directUrl = apiUrl(endpoint);
  return <Modal title={title} onClose={onClose}><div className="document-frame">{error ? <div className="error-box">{error}</div> : url ? <iframe src={url} title={title} /> : <div className="loading-state">Memuat dokumen...</div>}<a className="button button-secondary" href={url || directUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Buka dokumen</a></div></Modal>;
}
