export const config = {
  runtime: \'edge\',
};

export default async function handler(req) {
  // 1. CORS Preflight
  if (req.method === \'OPTIONS\') {
    return new Response(null, {
      status: 204,
      headers: {
        \'Access-Control-Allow-Origin\': \'*\',
        \'Access-Control-Allow-Methods\': \'GET, POST, PUT, DELETE, OPTIONS\',
        \'Access-Control-Allow-Headers\': \'*\',
      },
    });
  }

  const url = new URL(req.url);
  // FIX QUAN TRỌNG: Lấy từ pathname chứ không phải searchParams
  let rawPath = url.pathname.replace(\'/api/proxy\', \'\');
  if (!rawPath) rawPath = \'/\';
  
  // Giữ lại query string gốc nếu có ?stream=true
  const queryString = url.search; 

  // Khử /v1/v1
  let cleanPath = rawPath.replace(/\/v1\/v1/g, \'/v1\');

  // 2. Fake GET cho LB và JAI test
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
      }), {
        status: 200,
        headers: { \'Content-Type\': \'application/json\', \'Access-Control-Allow-Origin\': \'*\' }
      });
    }
  }

  // Tự thêm /v1 nếu thiếu
  if (!cleanPath.startsWith(\'/v1\') && cleanPath !== \'/\') {
    cleanPath = \'/v1\' + cleanPath;
  }

  const TARGET_HOST = \'api.freetheai.org\';
  const targetUrl = `https://${TARGET_HOST}${cleanPath}${queryString}`;

  try {
    const headers = new Headers();
    headers.set(\'User-Agent\', \'Mozilla/5.0\');
    headers.set(\'Accept\', \'application/json, text/event-stream, */*\');
    
    const contentType = req.headers.get(\'content-type\');
    if (contentType) headers.set(\'Content-Type\', contentType);
    
    // Authorization
    if (req.headers.has(\'authorization\')) {
      headers.set(\'Authorization\', req.headers.get(\'authorization\'));
    } else {
      headers.set(\'Authorization\', \'Bearer free\');
    }

    const fetchOptions = {
      method: req.method,
      headers: headers,
      body: req.method !== \'GET\' && req.method !== \'HEAD\' ? req.body : undefined,
      duplex: \'half\',
    };

    const response = await fetch(targetUrl, fetchOptions);

    // FIX QUAN TRỌNG: Không dùng response.text() nữa, pipe stream trực tiếp
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set(\'Access-Control-Allow-Origin\', \'*\');
    responseHeaders.set(\'Access-Control-Allow-Methods\', \'*\');
    responseHeaders.set(\'Access-Control-Allow-Headers\', \'*\');

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: { message: \'Proxy error: \' + error.message } }), {
      status: 500,
      headers: { \'Content-Type\': \'application/json\', \'Access-Control-Allow-Origin\': \'*\' }
    });
  }
        }
