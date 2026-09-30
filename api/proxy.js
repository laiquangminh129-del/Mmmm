export const config = {
  runtime: \'edge\',
};

export default async function handler(req) {
  // 1. Xử lý CORS
  if (req.method === \'OPTIONS\') {
    return new Response(null, {
      status: 200,
      headers: {
        \'Access-Control-Allow-Origin\': \'*\',
        \'Access-Control-Allow-Methods\': \'GET, POST, PUT, DELETE, OPTIONS\',
        \'Access-Control-Allow-Headers\': \'*\',
      },
    });
  }

  const url = new URL(req.url);
  
  // Lấy path từ rewrite ?path=$1
  let rawPath = url.searchParams.get(\'path\') || \'/\';
  if (!rawPath.startsWith(\'/\')) rawPath = \'/\' + rawPath;
  
  // Lấy query gốc trừ param `path` để forward tiếp
  const searchParams = new URLSearchParams(url.searchParams);
  searchParams.delete(\'path\');
  const queryString = searchParams.toString() ? `?${searchParams.toString()}` : \'\';

  let cleanPath = rawPath.replace(/\/v1\/v1/g, \'/v1\');

  // 2. Fake response cho LoreBary test
  if (req.method === \'GET\') {
    if (cleanPath === \'/\' || cleanPath === \'/v1\' || cleanPath === \'/v1/\') {
      return new Response(JSON.stringify({ status: \'online\', message: \'Proxy Active\' }), {
        status: 200,
        headers: { \'Content-Type\': \'application/json\', \'Access-Control-Allow-Origin\': \'*\' }
      });
    }
    if (cleanPath.includes(\'/models\')) {
      return new Response(JSON.stringify({
        object: \'list\',
        data: [
          { id: \'gpt-4o\', object: \'model\', created: 1700000000, owned_by: \'system\' },
          { id: \'gpt-4-turbo\', object: \'model\', created: 1700000000, owned_by: \'system\' },
          { id: \'claude-3-5-sonnet\', object: \'model\', created: 1700000000, owned_by: \'system\' }
        ]
      }), { status: 200, headers: { \'Content-Type\': \'application/json\', \'Access-Control-Allow-Origin\': \'*\' } });
    }
  }

  // Tự bổ sung /v1 nếu thiếu
  if (!cleanPath.startsWith(\'/v1\') && cleanPath !== \'/\') {
    cleanPath = \'/v1\' + cleanPath;
  }

  const TARGET_HOST = \'api.freetheai.org\';
  const targetUrl = `https://${TARGET_HOST}${cleanPath}${queryString}`;

  try {
    const headers = new Headers();
    headers.set(\'User-Agent\', \'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\');
    headers.set(\'Accept\', \'application/json, text/event-stream, */*\');
    if (req.headers.get(\'content-type\')) headers.set(\'Content-Type\', req.headers.get(\'content-type\'));
    
    // Giữ Authorization gốc, nếu không có thì dùng free
    if (req.headers.has(\'authorization\')) {
      headers.set(\'Authorization\', req.headers.get(\'authorization\'));
    } else {
      headers.set(\'Authorization\', \'Bearer free\');
    }

    const fetchOptions = {
      method: req.method,
      headers: headers,
      duplex: \'half\', // BẮT BUỘC cho streaming trên Edge
    };

    if (req.method !== \'GET\' && req.method !== \'HEAD\' && req.body) {
      fetchOptions.body = req.body;
    }

    const response = await fetch(targetUrl, fetchOptions);

    // Forward stream trực tiếp, không dùng response.text()
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set(\'Access-Control-Allow-Origin\', \'*\');
    responseHeaders.set(\'Access-Control-Allow-Methods\', \'*\');
    responseHeaders.set(\'Access-Control-Allow-Headers\', \'*\');

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: { code: 500, message: \'Proxy forwarding error: \' + error.message } }), {
      status: 500,
      headers: { \'Content-Type\': \'application/json\', \'Access-Control-Allow-Origin\': \'*\' }
    });
  }
    }
