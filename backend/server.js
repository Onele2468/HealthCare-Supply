import http from "node:http";
import { configDotenv } from "dotenv";

configDotenv({ path: ".env" });

const requestedPort = Number(process.env.PORT || 3000);
const port = Number.isFinite(requestedPort) ? requestedPort : 3000;

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "backend", supabaseUrl: process.env.SUPABASE_URL || null }));
    return;
  }

  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ status: "ok", message: "Backend is running", env: process.env.NODE_ENV || "development" }));
});

server.on("error", (error) => {
  if (error && typeof error === "object" && "code" in error && error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Please stop the other process or set PORT to another value.`);
    process.exit(1);
  }
  throw error;
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
