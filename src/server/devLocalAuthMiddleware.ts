import type { Connect, ViteDevServer } from "vite";

/**
 * Backend local (Vite) para POST /api/auth/dev-local.
 * Só é registado em configureServer (npm run dev) — não em preview/produção.
 * Fail-closed: credenciais ≠ K/K → 401.
 */
export function attachDevLocalAuthMiddleware(server: ViteDevServer): void {
  const handler: Connect.NextHandleFunction = (req, res, next) => {
    const url = req.url ?? "";
    const pathOnly = url.split("?")[0] ?? "";
    if (!pathOnly.startsWith("/api/auth/dev-local")) {
      next();
      return;
    }
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ status: "error", message: "Método não suportado" }));
      return;
    }

    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    req.on("end", () => {
      let body: { email?: unknown; password?: unknown } = {};
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        body = raw ? (JSON.parse(raw) as { email?: unknown; password?: unknown }) : {};
      } catch {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ status: "error", message: "JSON inválido" }));
        return;
      }
      const email = typeof body.email === "string" ? body.email.trim() : "";
      const password = typeof body.password === "string" ? body.password : "";
      if (email !== "K" || password !== "K") {
        res.statusCode = 401;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ status: "error", message: "Credenciais locais inválidas" }));
        return;
      }
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(
        JSON.stringify({
          status: "ok",
          localDev: true,
          token: "local-dev-token",
          user: {
            id: "local-user",
            username: "Khaled Local",
            role: "local-dev",
          },
          fullLocalDevAccess: true,
        })
      );
    });
  };

  server.middlewares.use(handler);
}
