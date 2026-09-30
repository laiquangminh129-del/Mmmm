export default async function handler(req, res) {
  // ==========================================
  // CORS
  // ==========================================

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, PATCH, DELETE, OPTIONS'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    '*'
  );

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // ==========================================
  // XÁC ĐỊNH PATH
  // ==========================================

  let path = req.url || '/';

  // Loại /api/proxy khỏi URL
  path = path.replace(/^\/api\/proxy/, '');

  // Loại query string
  path = path.split('?')[0];

  if (!path || path === '') {
    path = '/';
  }

  // Chống /v1/v1
  path = path.replace(
    /^\/v1\/v1/,
    '/v1'
  );

  // Nếu chỉ gửi /chat/completions
  // thì tự thêm /v1
  if (
    path !== '/' &&
    !path.startsWith('/v1/')
  ) {
    path = '/v1' + path;
  }

  // ==========================================
  // HEALTH CHECK
  // ==========================================

  if (
    req.method === 'GET' &&
    (
      path === '/' ||
      path === '/v1' ||
      path === '/v1/'
    )
  ) {
    return res.status(200).json({
      status: 'online',
      message: 'OpenAI Compatible Proxy Active'
    });
  }

  // ==========================================
  // MODELS
  // ==========================================

  if (
    req.method === 'GET' &&
    path === '/v1/models'
  ) {
    try {
      const response = await fetch(
        'https://api.freetheai.org/v1/models',
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',

            ...(req.headers.authorization
              ? {
                  'Authorization':
                    req.headers.authorization
                }
              : {})
          }
        }
      );

      const data = await response.text();

      res.setHeader(
        'Content-Type',
        response.headers.get(
          'content-type'
        ) || 'application/json'
      );

      return res
        .status(response.status)
        .send(data);

    } catch (error) {
      return res.status(500).json({
        error: {
          message: error.message
        }
      });
    }
  }

  // ==========================================
  // FREETHEAI TARGET
  // ==========================================

  const targetUrl =
    `https://api.freetheai.org${path}`;

  try {
    // ========================================
    // HEADERS
    // ========================================

    const headers = {
      'Accept':
        req.headers.accept ||
        'application/json, text/event-stream, */*',

      'Content-Type':
        req.headers['content-type'] ||
        'application/json',

      'User-Agent':
        'OpenAI-Compatible-Proxy/1.0'
    };

    // QUAN TRỌNG:
    // chuyển API KEY từ LoreBary -> Vercel
    // -> FreeTheAI

    if (req.headers.authorization) {
      headers['Authorization'] =
        req.headers.authorization;
    }

    if (req.headers['x-api-key']) {
      headers['x-api-key'] =
        req.headers['x-api-key'];
    }

    // ========================================
    // BODY
    // ========================================

    let body;

    if (
      req.method !== 'GET' &&
      req.method !== 'HEAD'
    ) {
      if (
        typeof req.body === 'string'
      ) {
        body = req.body;
      } else if (
        req.body !== undefined &&
        req.body !== null
      ) {
        body = JSON.stringify(req.body);
      }
    }

    // ========================================
    // SEND TO FREETHEAI
    // ========================================

    const response = await fetch(
      targetUrl,
      {
        method: req.method,
        headers,
        body
      }
    );

    // ========================================
    // COPY RESPONSE HEADERS
    // ========================================

    const contentType =
      response.headers.get(
        'content-type'
      );

    if (contentType) {
      res.setHeader(
        'Content-Type',
        contentType
      );
    }

    const cacheControl =
      response.headers.get(
        'cache-control'
      );

    if (cacheControl) {
      res.setHeader(
        'Cache-Control',
        cacheControl
      );
    }

    // ========================================
    // STREAM RESPONSE
    // ========================================

    if (response.body) {

      res.statusCode =
        response.status;

      const reader =
        response.body.getReader();

      try {

        while (true) {

          const {
            done,
            value
          } = await reader.read();

          if (done) {
            break;
          }

          res.write(
            Buffer.from(value)
          );
        }

      } finally {
        res.end();
      }

      return;
    }

    // ========================================
    // NON-STREAM RESPONSE
    // ========================================

    const data =
      await response.text();

    return res
      .status(response.status)
      .send(data);

  } catch (error) {

    console.error(
      'Proxy Error:',
      error
    );

    return res.status(500).json({
      error: {
        type: 'proxy_error',
        message:
          error.message ||
          'Failed to connect to FreeTheAI'
      }
    });
  }
}
