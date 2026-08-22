/** Shared DilYum API client */
const API_BASE =
  process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1';

export function getApiBase() {
  return API_BASE;
}

export async function apiRequest(path, options = {}) {
  const { headers: optionHeaders, body, ...rest } = options;

  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    // Merge headers last so Content-Type is never wiped by auth-only headers
    headers: {
      'Content-Type': 'application/json',
      ...(optionHeaders || {}),
    },
    body,
  });

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!res.ok) {
    const message =
      (Array.isArray(data?.message) ? data.message.join(', ') : data?.message) ||
      'Request failed.';
    const err = new Error(message);
    err.code =
      res.status === 401
        ? 'UNAUTHORIZED'
        : res.status === 403
          ? 'FORBIDDEN'
          : res.status === 404
            ? 'NOT_FOUND'
            : res.status === 409
              ? 'CONFLICT'
              : res.status === 400
                ? 'VALIDATION'
                : 'ERROR';
    err.status = res.status;
    throw err;
  }

  return data;
}
