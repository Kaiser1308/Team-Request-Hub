import { createClient } from "@/lib/supabase/client";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL!;

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail || `API error: ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

async function getAuthHeaders() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new ApiError(401, "Unauthorized");
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  };
}

async function getAuthHeadersForText() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new ApiError(401, "Unauthorized");
  }

  return {
    Authorization: `Bearer ${session.access_token}`,
  };
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...headers, ...options?.headers },
  });

  if (!res.ok) {
    let detail = `API error: ${res.status}`;
    try {
      const body = await res.json();
      if (body?.detail) {
        detail = body.detail;
      }
    } catch {
      // response body is not JSON
    }
    throw new ApiError(res.status, detail);
  }

  return res.json() as Promise<T>;
}

export async function apiFetchText(path: string, options?: RequestInit): Promise<string> {
  const headers = await getAuthHeadersForText();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...headers, ...options?.headers },
  });

  if (!res.ok) {
    let detail = `API error: ${res.status}`;
    try {
      const body = await res.json();
      if (body?.detail) {
        detail = body.detail;
      }
    } catch {
      // response body is not JSON
    }
    throw new ApiError(res.status, detail);
  }

  return res.text();
}
