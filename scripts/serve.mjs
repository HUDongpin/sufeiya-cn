import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const port = Number.parseInt(process.env.SUFEIYA_PORT || "4173", 10);
const host = process.env.SUFEIYA_HOST || "127.0.0.1";

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".webp", "image/webp"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".xml", "application/xml; charset=utf-8"],
]);

const resolveRequest = async (pathname) => {
  const decoded = decodeURIComponent(pathname);
  const relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const safeRelative = normalize(relative).replace(/^(\.\.(\/|\\|$))+/, "");
  let candidate = join(root, safeRelative);

  try {
    const details = await stat(candidate);
    if (details.isDirectory()) candidate = join(candidate, "index.html");
    return candidate;
  } catch {
    const publicCandidate = join(root, "public", safeRelative);
    try {
      const publicDetails = await stat(publicCandidate);
      if (publicDetails.isFile()) return publicCandidate;
    } catch {
      // Continue to extensionless HTML resolution below.
    }
    if (!extname(candidate)) {
      const htmlCandidate = `${candidate}.html`;
      try {
        await stat(htmlCandidate);
        return htmlCandidate;
      } catch {
        return join(root, "404.html");
      }
    }
    return join(root, "404.html");
  }
};

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || "/", `http://${request.headers.host || host}`);
    const filePath = await resolveRequest(requestUrl.pathname);
    const body = await readFile(filePath);
    const isNotFound = filePath.endsWith("404.html") && requestUrl.pathname !== "/404";

    response.writeHead(isNotFound ? 404 : 200, {
      "Content-Type": contentTypes.get(extname(filePath)) || "application/octet-stream",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(body);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(`Local server error: ${error.message}`);
  }
});

server.listen(port, host, () => {
  process.stdout.write(`Sufeiya website: http://${host}:${port}\n`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
