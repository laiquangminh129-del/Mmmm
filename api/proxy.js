export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  // =========================
  // CORS PREFLIGHT
  // =========================
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods':
          'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const url = new URL(req.url);

  // vercel.json sẽ truyền path vào đây
  let path = url.searchParams.get('path') || '/';

  if (!path.startsWith('/')) {
    path = '/' + path;
  }

  // =========================
  // CLEAN PATH
  // =========================

  // Chống /v1/v1
  path = path.replace(/^\/v1\/v1/, '/v1');

  // Xóa slash dư
  path = path.replace(/\/{2,}/g, '/');

  // =========================
  // LOCAL HEALTH CHECK
  // =========================

  if (
    req.method === 'GET' &&
    (
      path === '/' ||
      path === '/v1' ||
      path === '/v1/'
    )
  ) {
    return jsonResponse({
      status: 'online',
      message: 'Vercel FreeTheAI Proxy Active',
      target: 'https://api.freetheai.org',
    });
  }

  // =========================
  // TARGET FREETHEAI
  // =========================

  const targetUrl =
    `https://api.freetheai.org${path}`;

  try {
    // =========================
    // HEADERS
    // =========================

    const headers = new Headers();

    headers.set(
      'Accept',
      req.headers.get('accept') ||
      'application/json, text/event-stream, */*'
    );

    headers.set(
      'Content-Type',
      req.headers.get('content-type') ||
      'application/json'
    );

    // Forward Authorization
    const authorization =
      req.headers.get('authorization');

    if (authorization) {
      headers.set(
        'Authorization',
        authorization
      );
    }

    // Forward x-api-key nếu client dùng nó
    const apiKey =
      req.headers.get('x-api-key');

    if (apiKey) {
      headers.set('x-api-key', apiKey);
    }

    // =========================
    // BODY
    // =========================

    let body = undefined;

    if (
      req.method !== 'GET' &&
      req.method !== 'HEAD'
    ) {
      body = await req.arrayBuffer();
    }

    // =========================
    // FORWARD REQUEST
    // =========================

    const response = await fetch(
      targetUrl,
      {
        method: req.method,
        headers,
        body,
      }
    );

    // =========================
    // RESPONSE HEADERS
    // =========================

    const responseHeaders =
      new Headers(response.headers);

    responseHeaders.set(
      'Access-Control-Allow-Origin',
      '*'
    );

    responseHeaders.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    );

    responseHeaders.set(
      'Access-Control-Allow-Headers',
      '*'
    );

    responseHeaders.set(
      'Access-Control-Expose-Headers',
      '*'
    );

    // =========================
    // STREAM RESPONSE
    // =========================

    return new Response(
      response.body,
      {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      }
    );

  } catch (error) {
    return jsonResponse(
      {
        error: {
          type: 'proxy_error',
          message:
            error?.message ||
            'Failed to connect to FreeTheAI',
        },
      },
      500
    );
  }
}


// =========================
// JSON RESPONSE HELPER
// =========================

function jsonResponse(data, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods':
          'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    }
  );
}
