export default async function handler(req, res) {
  // Cấu hình CORS mở hoàn toàn
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const TARGET_HOST = 'api.freetheai.org';
  const subPath = req.url.replace('/api/proxy', '');

  // Trả về 200 OK khi Lorebary ping kiểm tra trang chủ
  if (!subPath || subPath === '/' || subPath === '') {
    return res.status(200).json({ status: 'online', message: 'OpenAI Compatible Proxy' });
  }

  const targetUrl = `https://${TARGET_HOST}${subPath}`;

  try {
    const headers = {};
    for (const [key, value] of Object.entries(req.headers)) {
      const lower = key.toLowerCase();
      if (
        lower !== 'host' &&
        lower !== 'referer' &&
        lower !== 'content-length' &&
        !lower.startsWith('x-vercel-')
      ) {
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
    const data = await response.text();

    const contentType = response.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }

    return res.status(response.status).send(data);
  } catch (error) {
    return res.status(500).json({ error: 'Proxy failed', message: error.message });
  }
}
