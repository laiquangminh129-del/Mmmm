export default async function handler(req, res) {
  // Cấu hình CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const subPath = req.url.replace('/api/proxy', '');

  // 1. Chặn các đường dẫn Lorebary dùng để Ping test (/, /v1, /v1/)
  if (!subPath || subPath === '/' || subPath === '' || subPath === '/v1' || subPath === '/v1/') {
    return res.status(200).json({ status: 'online', message: 'OpenAI Compatible Proxy' });
  }

  // 2. Giả lập danh sách Models chuẩn OpenAI
  if (subPath.includes('/models')) {
    return res.status(200).json({
      object: "list",
      data: [
        { id: "gpt-4o", object: "model", created: 1700000000, owned_by: "system" },
        { id: "gpt-4-turbo", object: "model", created: 1700000000, owned_by: "system" },
        { id: "claude-3-5-sonnet", object: "model", created: 1700000000, owned_by: "system" }
      ]
    });
  }

  // 3. Chuyển tiếp request thực tế tới FreeTheAI
  const TARGET_HOST = 'api.freetheai.org';
  const targetUrl = `https://${TARGET_HOST}${subPath}`;

  try {
    const headers = {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'accept': '*/*',
      'host': TARGET_HOST
    };

    if (req.headers['authorization']) {
      headers['authorization'] = req.headers['authorization'];
    }
    if (req.headers['content-type']) {
      headers['content-type'] = req.headers['content-type'];
    }

    const fetchOptions = {
      method: req.method,
      headers: headers,
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      fetchOptions.body = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
    }

    const response = await fetch(targetUrl, fetchOptions);
    let data = await response.text();

    // 4. Xóa từ khóa nhận diện
    data = data.replaceAll('FreeTheAI', 'OpenAI')
               .replaceAll('freetheai', 'openai');

    const contentType = response.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }

    return res.status(response.status).send(data);
  } catch (error) {
    return res.status(500).json({ error: 'Proxy failed', message: error.message });
  }
}
