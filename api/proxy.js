
export const config = {
  api: {
    bodyParser: false, // BẮT BUỘC để Janitor stream được
  },
};

export default async function handler(req, res) {
  res.setHeader(\'Access-Control-Allow-Origin\', \'*\');
  res.setHeader(\'Access-Control-Allow-Methods\', \'GET, POST, PUT, DELETE, OPTIONS\');
  res.setHeader(\'Access-Control-Allow-Headers\', \'*\');

  if (req.method === \'OPTIONS\') return res.status(200).end();

  // Lấy path sau /api/proxy
  let rawPath = req.url.replace(\'/api/proxy\', \'\').split(\'?\')[0];
  if (!rawPath) rawPath = \'/\';
  let cleanPath = rawPath.replace(/\/v1\/v1/g, \'/v1\');

  // FAKE TEST - GỘP CẢ 2 CODE
  if (req.method === \'GET\') {
    if (cleanPath === \'/\' || cleanPath === \'/v1\' || cleanPath === \'/v1/\' || cleanPath.includes(\'/chat/completions\')) {
      return res.status(200).json({ status: \'online\', message: \'Proxy Active\' });
    }
    if (cleanPath.includes(\'/models\')) {
      return res.status(200).json({
        object: \'list\',
        data: [
          { id: \'gpt-4o\', object: \'model\', created: 1700000000, owned_by: \'system\' },
          { id: \'gpt-4-turbo\', object: \'model\', created: 1700000000, owned_by: \'system\' },
          { id: \'claude-3-5-sonnet\', object: \'model\', created: 1700000000, owned_by: \'system\' }
        ]
      });
    }
  }

  if (!cleanPath.startsWith(\'/v1\') && cleanPath !== \'/\') {
    cleanPath = \'/v1\' + cleanPath;
  }

  const TARGET_HOST = \'api.freetheai.org\';
  const targetUrl = `https://${TARGET_HOST}${cleanPath}`;

  try {
    const headers = {};
    headers[\'User-Agent\'] = \'Mozilla/5.0\';
    headers[\'Accept\'] = req.headers[\'accept\'] || \'*/*\';
    headers[\'Host\'] = TARGET_HOST;
    if (req.headers[\'authorization\']) headers[\'Authorization\'] = req.headers[\'authorization\'];
    else headers[\'Authorization\'] = \'Bearer free\';
    if (req.headers[\'content-type\']) headers[\'Content-Type\'] = req.headers[\'content-type\'];

    // Đọc body thô
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.method !== \'GET\' && req.method !== \'HEAD\' ? body : undefined,
    });

    res.status(response.status);
    response.headers.forEach((v, k) => {
      if (![\'content-encoding\', \'content-length\'].includes(k.toLowerCase())) {
        res.setHeader(k, v);
      }
    });
    res.setHeader(\'Access-Control-Allow-Origin\', \'*\');

    // Pipe stream - QUAN TRỌNG CHO JANITOR
    if (response.body) {
      for await (const chunk of response.body) res.write(chunk);
      return res.end();
    } else {
      const text = await response.text();
      return res.send(text);
    }
  } catch (e) {
    return res.status(500).json({ error: \'Proxy failed\', message: e.message });
  }
}
