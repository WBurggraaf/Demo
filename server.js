const http = require("http");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = __dirname;
const port = Number(process.env.PORT || 3000);

function killProcessOnPort(portNum) {
  try {
    if (process.platform === "win32") {
      const output = execSync(`netstat -ano | findstr :${portNum}`, { encoding: "utf-8" });
      const pid = output.trim().split(/\s+/).pop();
      if (pid && pid !== "PID") {
        execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
      }
    } else {
      execSync(`lsof -ti:${portNum} | xargs kill -9`, { stdio: "ignore" });
    }
  } catch (e) {
    // Port likely not in use, that's fine
  }
}

async function startServer() {
  return new Promise((resolve) => {
    const tryListen = () => {
      server.once("listening", () => {
        console.log(`ChatSim running at http://localhost:${port}/chatsim.html`);
        resolve();
      });

      server.once("error", (err) => {
        if (err.code === "EADDRINUSE") {
          console.log(`Port ${port} is in use, killing previous process...`);
          server.removeAllListeners("error");
          server.removeAllListeners("listening");
          killProcessOnPort(port);
          setTimeout(tryListen, 500);
        } else {
          throw err;
        }
      });

      server.listen(port);
    };

    tryListen();
  });
}

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".wdp": "application/octet-stream"
};

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const requested = decoded === "/" ? "/chatsim.html" : decoded;
  const fullPath = path.normalize(path.join(root, requested));
  return fullPath.startsWith(root) ? fullPath : null;
}

const server = http.createServer((req, res) => {
  const filePath = safePath(req.url || "/");
  if (!filePath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (statErr, stats) => {
    if (statErr || !stats.isFile()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    fs.createReadStream(filePath).pipe(res);
  });
});

startServer();
