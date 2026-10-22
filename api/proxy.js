
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, Accept"
  );

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  try {
    const apiKey = process.env.FREETHEAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: {
          message: "Missing FREETHEAI_API_KEY environment variable"
        }
      });
    }

    let path = req.query.path;

    if (Array.isArray(path)) path = path[0];

    if (typeof path !== "string" || !path.startsWith("/")) {
      return res.status(400).json({
        error: { message: "Invalid proxy path" }
      });
    }

    // Prevent forwarding to arbitrary external hosts.
    path = path.split("?")[0];

    // Normalize duplicated version prefixes.
    path = path.replace(/^\/v1\/v1(?=\/|$)/, "/v1");

    // Accept /models and /chat/completions as well.
    if (!path.startsWith("/v1/") && path !== "/v1") {
      path = "/v1" + (path === "/" ? "" : path);
    }

    const targetUrl = new URL(
      "https://api.freetheai.org" + path
    );

    // Preserve query parameters except the internal routing parameter.
    for (const [key, value] of Object.entries(req.query)) {
      if (key === "path") continue;

      for (const item of Array.isArray(value) ? value : [value]) {
        if (item !== undefined) {
          targetUrl.searchParams.append(key, String(item));
        }
      }
    }

    const headers = {
      Authorization: `Bearer ${apiKey}`,
      Accept: req.headers.accept || "application/json"
    };

    if (req.headers["content-type"]) {
      headers["Content-Type"] = req.headers["content-type"];
    }

    const init = {
      method: req.method,
      headers
    };

    if (!["GET", "HEAD"].includes(req.method)) {
      init.body =
        typeof req.body === "string"
          ? req.body
          : req.body == null
            ? undefined
            : JSON.stringify(req.body);
    }

    const upstream = await fetch(targetUrl, init);
    const responseText = await upstream.text();

    res.status(upstream.status);

    const contentType = upstream.headers.get("content-type");
    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }

    return res.send(responseText);
  } catch (error) {
    console.error("Proxy error:", error);

    return res.status(502).json({
      error: {
        message: "Proxy upstream request failed"
      }
    });
  }
}
