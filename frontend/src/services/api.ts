const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";
export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("ear:token");
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (response.status === 401) { localStorage.removeItem("ear:token"); localStorage.removeItem("ear:user"); window.dispatchEvent(new Event("ear:unauthorized")); }
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string } | null;
    throw new ApiError(payload?.message || `Permintaan gagal (${response.status})`, response.status);
  }
  if (response.headers.get("content-type")?.includes("application/json")) return response.json() as Promise<T>;
  return response as T;
}
export function apiUrl(path: string) { return `${API_URL}${path}`; }
