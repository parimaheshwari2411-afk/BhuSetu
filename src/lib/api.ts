const TOKEN_KEY = "bhusetu_token";

export type UserRole = "CITIZEN" | "SURVEYOR" | "REGISTRAR";

export type SessionUser = {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  eKycVerified?: boolean;
  walletAddress?: string;
  token?: string;
};

const API_BASE = import.meta.env.VITE_API_URL || "/api/v1";

function authHeaders(): HeadersInit {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseJson(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || body.message || `Request failed (${response.status})`);
  }
  return body;
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function apiGet(path: string) {
  return parseJson(
    await fetch(`${API_BASE}${path}`, {
      headers: { ...authHeaders() },
    })
  );
}

export async function apiPost(path: string, payload: unknown) {
  return parseJson(
    await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify(payload),
    })
  );
}

export async function apiPostForm(path: string, form: FormData) {
  return parseJson(
    await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { ...authHeaders() },
      body: form,
    })
  );
}

export async function login(email: string, password: string) {
  const body = await apiPost("/auth/login", { email, password });
  const token = body.data?.token as string;
  const user = body.data?.user as SessionUser;
  setStoredToken(token);
  return { token, user };
}

export async function register(payload: {
  fullName: string;
  email: string;
  password: string;
  phoneNumber?: string;
  role: UserRole;
}) {
  const body = await apiPost("/auth/register", payload);
  const token = (body.data?.token as string) || "";
  if (token) setStoredToken(token);
  return body.data as SessionUser & { token?: string };
}

export async function fetchMe() {
  const body = await apiGet("/auth/me");
  return body.data as SessionUser;
}

export async function fetchParcelsSpatial() {
  const body = await apiGet("/parcels/spatial");
  return body.data as {
    type: "FeatureCollection";
    features: Array<{
      id: string;
      properties: Record<string, unknown>;
      geometry: { type: string; coordinates: number[][][] };
    }>;
  };
}

export async function createParcel(payload: unknown) {
  return apiPost("/parcels", payload);
}

export async function fetchParcels() {
  return apiGet("/parcels?pageSize=50");
}

export async function fetchTransfers() {
  return apiGet("/transfers?pageSize=50");
}

export async function createTransfer(form: FormData) {
  return apiPostForm("/transfers", form);
}

export async function approveTransfer(id: string) {
  return apiPost(`/transfers/${id}/approve`, {});
}

export async function fetchPendingTransfers() {
  return apiGet("/admin/pending-transfers");
}

export async function approveAdminTransfer(transactionId: string) {
  return apiPost("/admin/approve-transfer", { transactionId });
}

export async function fetchAdminStats() {
  return apiGet("/admin/statistics");
}
