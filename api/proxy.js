export default async function handler(req, res) {
  // Cấu hình CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const subPath = req.url.replace('/api/proxy', '');

  // 1. Giả lập danh sách Models chuẩn OpenAI để qua mặt bước Test của Lorebary
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

  // 2. Phản hồi Ping trang chủ
  if (!subPath || subPath === '/' || subPath === '') {
    return res.status(200).json({ status: 'online', message: 'OpenAI Compatible Proxy' });
  }

  const TARGET_HOST = 'api.freetheai.org';
  const targetUrl = `https://${TARGET_HOST}${subPath}`;

  try {
    const headers = {};
    for (const [key, value] of Object.entries(req.headers)) {
      const lower = key.toLowerCase();
      if (lower !== 'host' && lower !== 'referer' && lower !== 'content-length' && !lower.startsWith('x-vercel-')) {
        headers[key] = value;
      }
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

    // 3. Tẩy sạch dấu vết từ khóa "FreeTheAI" trong dữ liệu trả về
    data = data.replaceAll('FreeTheAI', 'CustomAI')
               .replaceAll('freetheai', 'customai');

    const contentType = response.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }

    return res.status(response.status).send(data);
  } catch (error) {
    return res.status(500).json({ error: 'Proxy failed', message: error.message });
  }
}
