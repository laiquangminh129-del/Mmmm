export const config = {
  runtime: \'edge\',
};

export default async function handler(req) {
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
  let rawPath = url.pathname.replace(\'/api/proxy\', \'\');
  if (!rawPath) rawPath = \'/\';
  const queryString = url.search;
  let cleanPath = rawPath.replace(/\/v1\/v1/g, \'/v1\');

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

  if (!cleanPath.startsWith(\'/v1\') && cleanPath !== \'/\') {
    cleanPath = \'/v1\' + cleanPath;
  }

  const TARGET_HOST = \'api.freetheai.org\';
  const targetUrl = `https://${TARGET_HOST}${cleanPath}${queryString}`;

  try {
    // FIX LỖI 500: phải đọc body ra trước
    let body = undefined;
    if (req.method !== \'GET\' && req.method !== \'HEAD\') {
      body = await req.text();
    }

    const headers = new Headers();
    headers.set(\'Accept\', \'application/json, text/event-stream, */*\');
    if (req.headers.get(\'content-type\')) {
      headers.set(\'Content-Type\', req.headers.get(\'content-type\'));
    }
    headers.set(\'Authorization\', req.headers.get(\'authorization\') || \'Bearer free\');
    headers.set(\'User-Agent\', \'Mozilla/5.0\');

    // Đừng set Host thủ công nữa, fetch tự lo

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      body: body,
    });

    const responseHeaders = new Headers(response.headers);
    responseHeaders.set(\'Access-Control-Allow-Origin\', \'*\');
    responseHeaders.set(\'Access-Control-Allow-Methods\', \'*\');
    responseHeaders.set(\'Access-Control-Allow-Headers\', \'*\');

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: { message: error.message, stack: error.stack } }), {
      status: 500,
      headers: { \'Content-Type\': \'application/json\', \'Access-Control-Allow-Origin\': \'*\' }
    });
  }
           }
