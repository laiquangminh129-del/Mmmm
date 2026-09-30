export default async function handler(req, res) {
  res.setHeader(\'Access-Control-Allow-Origin\', \'*\');
  res.setHeader(\'Access-Control-Allow-Methods\', \'GET, POST, PUT, DELETE, OPTIONS\');
  res.setHeader(\'Access-Control-Allow-Headers\', \'*\');
  if (req.method === \'OPTIONS\') return res.status(200).end();

  try {
    let rawPath = req.url.replace(\'/api/proxy\', \'\').split(\'?\')[0];
    if (!rawPath) rawPath = \'/\';
    let cleanPath = rawPath.replace(/\/v1\/v1/g, \'/v1\');

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

    if (!cleanPath.startsWith(\'/v1\') && cleanPath !== \'/\') cleanPath = \'/v1\' + cleanPath;
    
    const targetUrl = `https://api.freetheai.org${cleanPath}`;
    
    const headers = {
      \'Accept\': req.headers[\'accept\'] || \'*/*\',
      \'User-Agent\': \'Mozilla/5.0\',
      \'Authorization\': req.headers[\'authorization\'] || \'Bearer free\'
    };
    if (req.headers[\'content-type\']) headers[\'Content-Type\'] = req.headers[\'content-type\'];

    const body = req.method !== \'GET\' && req.method !== \'HEAD\' && req.body ? JSON.stringify(req.body) : undefined;

    const response = await fetch(targetUrl, { method: req.method, headers, body });
    const data = await response.text();
    
    res.setHeader(\'Access-Control-Allow-Origin\', \'*\');
    const ct = response.headers.get(\'content-type\');
    if (ct) res.setHeader(\'Content-Type\', ct);
    return res.status(response.status).send(data);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
