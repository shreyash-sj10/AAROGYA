/**
 * Frees TCP listen ports before dev start (avoids EADDRINUSE from stale nodemon/node).
 * Usage: node scripts/free-listen-port.js [port ...]
 * Default ports: process.env.PORT, then 5000 and 5001.
 */
const { execSync } = require("child_process");

function parsePorts(argv) {
  const fromArgs = argv
    .map((p) => Number(p))
    .filter((n) => Number.isInteger(n) && n > 0 && n < 65536);
  if (fromArgs.length > 0) {
    return [...new Set(fromArgs)];
  }
  const envPort = Number(process.env.PORT);
  const ports = [];
  if (Number.isInteger(envPort) && envPort > 0) {
    ports.push(envPort);
  }
  ports.push(5000, 5001);
  return [...new Set(ports)];
}

function pidsOnPortWindows(port) {
  try {
    const out = execSync(`netstat -ano | findstr ":${port}"`, { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] });
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      if (!/LISTENING/i.test(line)) continue;
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && /^\d+$/.test(pid) && pid !== "0") {
        pids.add(pid);
      }
    }
    return [...pids];
  } catch {
    return [];
  }
}

function pidsOnPortUnix(port) {
  try {
    const out = execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t`, { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] });
    return out
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((pid) => /^\d+$/.test(pid));
  } catch {
    return [];
  }
}

function killPid(pid) {
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
    } else {
      execSync(`kill -9 ${pid}`, { stdio: "ignore" });
    }
    return true;
  } catch {
    return false;
  }
}

function freePort(port) {
  const pids = process.platform === "win32" ? pidsOnPortWindows(port) : pidsOnPortUnix(port);
  if (pids.length === 0) {
    return;
  }
  for (const pid of pids) {
    if (killPid(pid)) {
      console.log(`[free-listen-port] freed :${port} (PID ${pid})`);
    }
  }
}

const ports = parsePorts(process.argv.slice(2));
for (const port of ports) {
  freePort(port);
}
