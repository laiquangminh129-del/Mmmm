export const config = {
  runtime: 'edge', // Bật Edge Runtime chống Timeout & hỗ trợ Streaming trực tiếp
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
  
  // SỬA LỖI NUỐT ĐƯỜNG DẪN: Ghép lại toàn bộ mảng path bị Vercel tách rời
  const pathSegments = url.searchParams.getAll('path');
  let targetPath = pathSegments.length > 0 ? pathSegments.join('/') : '';

  if (!targetPath) {
    targetPath = url.pathname.replace('/api/proxy', '').replace(/^\//, '');
  }

  // Chuẩn hóa loại bỏ trùng lặp v1
  targetPath = targetPath.replace(/^v1\/v1/, 'v1');

  // 2. Trả về phản hồi giả lập cho các request GET kiểm tra (Ping / Models) từ Lorebary
  if (req.method === 'GET') {
    if (!targetPath || targetPath === 'v1' || targetPath === 'v1/') {
      return new Response(JSON.stringify({ status: 'online', message: 'Proxy Active' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    if (targetPath.includes('models')) {
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

  // Tự động bổ sung v1/ nếu chưa có
  if (!targetPath.startsWith('v1') && targetPath !== '') {
    targetPath = 'v1/' + targetPath;
  }

  const TARGET_HOST = 'api.freetheai.org';
  const targetUrl = `https://${TARGET_HOST}/${targetPath}`;

  try {
    // 3. Đọc dữ liệu Body an toàn
    let bodyText = null;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      bodyText = await req.text();
      try {
        if (bodyText) {
          const parsed = JSON.parse(bodyText);
          if (!parsed.model || parsed.model.trim() === '') {
            parsed.model = 'gpt-4o';
          }
          bodyText = JSON.stringify(parsed);
        }
      } catch (e) {
        // Dữ liệu không phải JSON thì giữ nguyên
      }
    }

    // 4. Giả dạng Header hợp lệ
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
      body: bodyText,
    };

    // 5. Chuyển tiếp request tới đúng URL https://api.freetheai.org/v1/chat/completions
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
      headers: responseHeaders,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: { code: 500, message: 'Proxy forwarding error: ' + error.message } }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
