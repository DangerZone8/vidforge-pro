import { createFileRoute } from "@tanstack/react-router";

// Allow-list to avoid being an open proxy.
const ALLOWED_HOSTS = new Set<string>([
  "www.soundhelix.com",
  "soundhelix.com",
]);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Content-Type",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
};

export const Route = createFileRoute("/api/public/audio-proxy")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const target = url.searchParams.get("url");
        if (!target) return new Response("Missing url", { status: 400, headers: CORS });

        let parsed: URL;
        try {
          parsed = new URL(target);
        } catch {
          return new Response("Invalid url", { status: 400, headers: CORS });
        }
        if (!ALLOWED_HOSTS.has(parsed.hostname)) {
          return new Response("Host not allowed", { status: 403, headers: CORS });
        }

        const range = request.headers.get("range");
        const upstream = await fetch(parsed.toString(), {
          headers: range ? { Range: range } : undefined,
        });

        const headers = new Headers(CORS);
        const contentType = upstream.headers.get("content-type") ?? "audio/mpeg";
        headers.set("Content-Type", contentType);
        const len = upstream.headers.get("content-length");
        if (len) headers.set("Content-Length", len);
        const cr = upstream.headers.get("content-range");
        if (cr) headers.set("Content-Range", cr);
        headers.set("Accept-Ranges", upstream.headers.get("accept-ranges") ?? "bytes");
        headers.set("Cache-Control", "public, max-age=86400");

        return new Response(upstream.body, { status: upstream.status, headers });
      },
    },
  },
});
