export const config = {
  runtime: 'edge', // Bật Vercel Edge Runtime để stream trực tiếp và chống Timeout
};

export default async function handler(req) {
  // 1. Cấu hình CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    });
  }

  const url = new URL(req.url);
  let subPath = url.pathname.replace('/api/proxy', '');
  if (!subPath) subPath = '/';
  subPath = subPath.replace(/\/v1\/v1/g, '/v1');

  // 2. Giả lập phản hồi kiểm tra từ Lorebary
  if (req.method === 'GET') {
    if (subPath === '/' || subPath === '/v1' || subPath === '/v1/' || subPath.includes('/chat/completions')) {
      return new Response(JSON.stringify({ status: 'online', message: 'OpenAI Compatible API Proxy Active' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    if (subPath.includes('/models')) {
      return new Response(JSON.stringify({
        object: 'list',
        data: [
          { id: 'gpt-4o', object: 'model', created: 1700000000, owned_by: 'system' },
          { id: 'gpt-4-turbo', object: 'model', created: 1700000000, owned_by: 'system' },
          { id: 'claude-3-5-sonnet', object: 'model', created: 1700000000, owned_by: 'system' }
        ]
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  }

  if (!subPath.startsWith('/v1') && subPath !== '/') {
    subPath = '/v1' + subPath;
  }

  const TARGET_HOST = 'api.freetheai.org';
  const targetUrl = `https://${TARGET_HOST}${subPath}${url.search}`;

  try {
    // 3. Giả dạng Header để FreeTheAI không phát hiện
    const headers = new Headers();
    headers.set('user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36');
    headers.set('accept', '*/*');
    headers.set('host', TARGET_HOST);

    if (req.headers.has('authorization')) {
      headers.set('authorization', req.headers.get('authorization'));
    }
    if (req.headers.has('content-type')) {
      headers.set('content-type', req.headers.get('content-type'));
    }

    const fetchOptions = {
      method: req.method,
      headers: headers,
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      fetchOptions.body = req.body;
    }

    // 4. Chuyển tiếp request và đẩy Stream trực tiếp về Lorebary
    const response = await fetch(targetUrl, fetchOptions);

    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', '*');
    responseHeaders.set('Access-Control-Allow-Headers', '*');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Proxy failed', message: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
