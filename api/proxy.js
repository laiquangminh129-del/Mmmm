export const config = {
  runtime: 'edge', // Sử dụng Vercel Edge Runtime chống Timeout & hỗ trợ Streaming
};

export default async function handler(req) {
  // 1. Xử lý CORS Preflight
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

  // Lấy nguyên vẹn chuỗi đường dẫn gốc từ $1
  let rawPath = url.searchParams.get('path') || '';
  if (!rawPath.startsWith('/')) {
    rawPath = '/' + rawPath;
  }

  // Khử trùng lặp /v1/v1 nếu client gửi nhầm
  let cleanPath = rawPath.replace(/\/v1\/v1/g, '/v1');

  // 2. Trả về phản hồi giả lập cho các request GET kiểm tra (Ping / Models) từ Lorebary
  if (req.method === 'GET') {
    if (cleanPath === '/' || cleanPath === '/v1' || cleanPath === '/v1/') {
      return new Response(JSON.stringify({ status: 'online', message: 'Proxy Active' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    if (cleanPath.includes('/models')) {
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

  // Tự động bổ sung /v1 nếu chưa có
  if (!cleanPath.startsWith('/v1') && cleanPath !== '/') {
    cleanPath = '/v1' + cleanPath;
  }

  const TARGET_HOST = 'api.freetheai.org';
  const targetUrl = `https://${TARGET_HOST}${cleanPath}`;

  try {
    // 3. Header giả dạng hợp lệ
    const headers = new Headers();
    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    headers.set('Accept', 'application/json, text/event-stream, */*');
    headers.set('Content-Type', req.headers.get('content-type') || 'application/json');
    headers.set('Host', TARGET_HOST);

    if (req.headers.has('authorization')) {
      headers.set('Authorization', req.headers.get('authorization'));
    } else {
      headers.set('Authorization', 'Bearer free');
    }

    const fetchOptions = {
      method: req.method,
      headers: headers,
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      fetchOptions.body = req.body;
    }

    // 4. Chuyển tiếp tới đúng URL https://api.freetheai.org/v1/chat/completions
    const response = await fetch(targetUrl, fetchOptions);

    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', '*');
    responseHeaders.set('Access-Control-Allow-Headers', '*');

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: { code: 500, message: 'Proxy forwarding error: ' + error.message } }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
