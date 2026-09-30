export const config = {
  runtime: \'edge\',
};

export default async function handler(req) {
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
  let rawPath = url.searchParams.get(\'path\') || \'/\';
  if (!rawPath.startsWith(\'/\')) rawPath = \'/\' + rawPath;
  
  let cleanPath = rawPath.replace(/\/v1\/v1/g, \'/v1\');

  // Fake cho LoreBary test
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

  if (!cleanPath.startsWith(\'/v1\') && cleanPath !== \'/\') {
    cleanPath = \'/v1\' + cleanPath;
  }

  const TARGET_HOST = \'api.freetheai.org\';
  const targetUrl = `https://${TARGET_HOST}${cleanPath}`;

  try {
    const headers = new Headers();
    headers.set(\'Accept\', \'*/*\');
    headers.set(\'Content-Type\', req.headers.get(\'content-type\') || \'application/json\');
    
    // Fix lỗi 500: Không set Host trên Edge
    if (req.headers.get(\'authorization\')) {
      headers.set(\'Authorization\', req.headers.get(\'authorization\'));
    } else {
      headers.set(\'Authorization\', \'Bearer free\');
    }

    // Fix lỗi 500: Edge không cho stream trực tiếp, phải đọc text trước
    let body = undefined;
    if (req.method !== \'GET\' && req.method !== \'HEAD\') {
      body = await req.text();
    }

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      body: body,
    });

    // Forward stream về cho Janitor
    const resHeaders = new Headers(response.headers);
    resHeaders.set(\'Access-Control-Allow-Origin\', \'*\');
    
    return new Response(response.body, {
      status: response.status,
      headers: resHeaders,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { \'Content-Type\': \'application/json\', \'Access-Control-Allow-Origin\': \'*\' }
    });
  }
}
