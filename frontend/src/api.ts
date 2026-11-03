let csrfToken = "";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function setCsrf(token: string) {
  csrfToken = token;
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  if (options.method && !["GET", "HEAD"].includes(options.method))
    headers.set("X-CSRF-TOKEN", csrfToken);
  const response = await fetch(`/api${path}`, {
    ...options,
    headers,
    credentials: "same-origin",
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(
      response.status,
      data?.message ??
        (response.status === 429
          ? "操作过于频繁，请稍后重试"
          : "请求失败，请重试"),
    );
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
export const send = <T>(path: string, data?: unknown, method = "POST") =>
  api<T>(path, {
    method,
    body: data === undefined ? undefined : JSON.stringify(data),
  });
