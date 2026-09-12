/** Shared DilYum API client */
const API_BASE =
  process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1';

export function getApiBase() {
  return API_BASE;
}

function networkErrorMessage() {
  return 'Unable to reach DilYum services. Please check your internet connection and try again.';
}

export async function apiRequest(path, options = {}) {
  const { headers: optionHeaders, body, ...rest } = options;
  const isFormData =
    typeof FormData !== 'undefined' && body instanceof FormData;

  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(optionHeaders || {}),
  };
  // Browser must set multipart boundary for FormData
  if (isFormData) {
    delete headers['Content-Type'];
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...rest,
      headers,
      body,
    });
  } catch {
    const err = new Error(networkErrorMessage());
    err.code = 'NETWORK';
    throw err;
  }

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
      typeof data?.message === 'object' && data?.message?.message
        ? data.message.message
        : Array.isArray(data?.message)
          ? data.message.join(', ')
          : data?.message ||
            (res.status === 401
              ? 'Invalid email or password.'
              : res.status === 403
                ? 'You do not have permission to do that.'
                : res.status === 404
                  ? 'The requested resource was not found.'
                  : res.status >= 500
                    ? 'Something went wrong on the server. Please try again.'
                    : 'Request failed.');
    const err = new Error(
      typeof message === 'string' ? message : 'Request failed.',
    );
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
                : res.status >= 500
                  ? 'SERVER'
                  : 'ERROR';
    err.status = res.status;
    err.data = typeof data?.message === 'object' ? data.message : data;
    throw err;
  }

  return data;
}
