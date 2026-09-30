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
  
  // Lấy đường dẫn gốc được truyền từ vercel.json
  let subPath = url.searchParams.get('__path') || url.pathname;
  url.searchParams.delete('__path'); // Xóa param ẩn để không làm bẩn URL sang FreeTheAI

  // Chuẩn hóa subPath
  subPath = subPath.replace('/api/proxy', '');
  if (!subPath) subPath = '/';
  subPath = subPath.replace(/\/v1\/v1/g, '/v1');

  // 2. Trả về phản hồi giả lập cho các request GET kiểm tra/ping từ Lorebary
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

  // Đảm bảo đường dẫn luôn chứa /v1
  if (!subPath.startsWith('/v1') && subPath !== '/') {
    subPath = '/v1' + subPath;
  }

  const TARGET_HOST = 'api.freetheai.org';
  const queryString = url.search ? url.search : '';
  const targetUrl = `https://${TARGET_HOST}${subPath}${queryString}`;

  try {
    // 3. Tái tạo Header sạch gửi tới FreeTheAI
    const headers = new Headers();
    headers.set('user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    headers.set('accept', 'application/json, text/event-stream, */*');
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

    // 4. Chuyển tiếp request và Stream kết quả trực tiếp về
    const response = await fetch(targetUrl, fetchOptions);

    const responseHeaders = new Headers();
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', '*');
    responseHeaders.set('Access-Control-Allow-Headers', '*');

    const contentType = response.headers.get('content-type');
    if (contentType) {
      responseHeaders.set('Content-Type', contentType);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: { code: 500, message: 'Proxy forwarding failed: ' + error.message } }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
