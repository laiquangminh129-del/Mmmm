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
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const url = new URL(req.url);

  // Path được truyền từ vercel.json
  let path = url.searchParams.get('path') || '/';

  if (!path.startsWith('/')) {
    path = '/' + path;
  }

  // =========================
  // CLEAN PATH
  // =========================

  // /v1/v1/chat/completions
  // -> /v1/chat/completions
  path = path.replace(/^\/v1\/v1/, '/v1');

  // Xóa // dư thừa
  path = path.replace(/\/{2,}/g, '/');

  // Tự thêm /v1 nếu client gửi:
  // /chat/completions
  if (
    path !== '/' &&
    !path.startsWith('/v1/')
  ) {
    path = '/v1' + path;
  }

  // =========================
  // LOCAL TEST ENDPOINT
  // =========================

  if (req.method === 'GET') {
    if (
      path === '/' ||
      path === '/v1' ||
      path === '/v1/'
    ) {
      return jsonResponse({
        status: 'online',
        message: 'Vercel FreeTheAI Proxy Active',
      });
    }
  }

  // =========================
  // TARGET
  // =========================

  const targetUrl =
    `https://api.freetheai.org${path}`;

  try {
    // =========================
    // FORWARD HEADERS
    // =========================

    const headers = new Headers();

    headers.set(
      'Accept',
      req.headers.get('accept') ||
        'application/json, text/event-stream, */*'
    );

    // Content-Type
    const contentType =
      req.headers.get('content-type');

    if (contentType) {
      headers.set('Content-Type', contentType);
    } else {
      headers.set(
        'Content-Type',
        'application/json'
      );
    }

    // Authorization
    const authorization =
      req.headers.get('authorization');

    if (authorization) {
      headers.set(
        'Authorization',
        authorization
      );
    }

    // Một số client gửi API key bằng x-api-key
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
    // REQUEST UPSTREAM
    // =========================

    const upstreamResponse = await fetch(
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
      new Headers(upstreamResponse.headers);

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
      upstreamResponse.body,
      {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
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
// JSON HELPER
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
