export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  try {
    res.setHeader(\'Access-Control-Allow-Origin\', \'*\');
    res.setHeader(\'Access-Control-Allow-Methods\', \'GET, POST, PUT, DELETE, OPTIONS\');
    res.setHeader(\'Access-Control-Allow-Headers\', \'*\');

    if (req.method === \'OPTIONS\') return res.status(200).end();

    // FIX 500: Tự nhận diện cả 2 kiểu rewrite ?path= và /api/proxy
    let rawPath = "";
    if (req.query && req.query.path) {
      rawPath = req.query.path;
      if (Array.isArray(rawPath)) rawPath = rawPath[0];
    } else {
      rawPath = req.url.replace(\'/api/proxy\', \'\').split(\'?\')[0];
    }
    if (!rawPath) rawPath = \'/\';
    if (!rawPath.startsWith(\'/\')) rawPath = \'/\' + rawPath;

    // FIX 500: Regex chuẩn
    let cleanPath = rawPath.replace(/\/v1\/v1/g, \'/v1\');

    // Fake test cho Lorebarry + Janitor - ĐÂY LÀ DÒNG QUAN TRỌNG FIX NOT FOUND
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

    // Đọc body thô để không gãy stream của Janitor
    let body;
    if (req.method !== \'GET\' && req.method !== \'HEAD\') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      body = Buffer.concat(chunks);
      if (body.length === 0) body = undefined;
    }

    const headers = {};
    headers[\'Accept\'] = req.headers[\'accept\'] || \'*/*\';
    headers[\'User-Agent\'] = \'Mozilla/5.0\';
    // Không set Host cứng, để fetch tự set
    if (req.headers[\'authorization\']) headers[\'Authorization\'] = req.headers[\'authorization\'];
    else headers[\'Authorization\'] = \'Bearer free\';
    if (req.headers[\'content-type\']) headers[\'Content-Type\'] = req.headers[\'content-type\'];

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
    });

    res.status(response.status);
    response.headers.forEach((v, k) => {
      if (![\'content-encoding\', \'content-length\', \'content-type\'].includes(k.toLowerCase())) {
        res.setHeader(k, v);
      }
    });
    const ct = response.headers.get(\'content-type\');
    if (ct) res.setHeader(\'Content-Type\', ct);
    res.setHeader(\'Access-Control-Allow-Origin\', \'*\');

    // Pipe stream - bắt buộc cho Janitor
    if (response.body) {
      for await (const chunk of response.body) res.write(chunk);
      return res.end();
    } else {
      const text = await response.text();
      return res.send(text);
    }

  } catch (e) {
    console.error(e);
    // Trả chi tiết lỗi để m biết tại sao 500
    return res.status(500).json({ error: \'Proxy failed\', message: e.message, stack: e.stack });
  }
}
