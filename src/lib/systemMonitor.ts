import os from "os";
import http from "http";
import fs from "fs";

export interface DockerContainerInfo {
  id: string;
  names: string[];
  image: string;
  state: string; // 'running', 'exited', etc.
  status: string; // e.g. 'Up 2 hours'
  created: number;
}

export interface SystemStatus {
  timestamp: string;
  hostname: string;
  platform: string;
  uptimeHours: number;
  memory: {
    totalMb: number;
    usedMb: number;
    freeMb: number;
    percentUsed: number;
  };
  cpu: {
    model: string;
    cores: number;
    loadAvg: number[]; // 1m, 5m, 15m
  };
  docker: {
    available: boolean;
    socketPath: string;
    containersCount: number;
    runningCount: number;
    containers: DockerContainerInfo[];
    error?: string;
  };
}

const DEFAULT_SOCKET_PATHS = [
  "/var/run/docker.sock",
  process.env.DOCKER_SOCK || "",
].filter(Boolean);

export function findDockerSocket(): string | null {
  for (const p of DEFAULT_SOCKET_PATHS) {
    try {
      if (fs.existsSync(p)) {
        return p;
      }
    } catch {}
  }
  return null;
}

export async function fetchDockerContainers(socketPath: string): Promise<DockerContainerInfo[]> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        socketPath,
        path: "/containers/json?all=1",
        method: "GET",
        headers: { Host: "localhost" },
        timeout: 3000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const list = JSON.parse(data);
              const containers: DockerContainerInfo[] = list.map((c: any) => ({
                id: (c.Id || "").slice(0, 12),
                names: (c.Names || []).map((n: string) => n.replace(/^\//, "")),
                image: c.Image || "",
                state: c.State || "unknown",
                status: c.Status || "",
                created: c.Created || 0,
              }));
              resolve(containers);
            } catch (err: any) {
              reject(err);
            }
          } else {
            reject(new Error(`Docker API HTTP ${res.statusCode}: ${data}`));
          }
        });
      }
    );

    req.on("error", (err) => reject(err));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Docker socket request timed out"));
    });
    req.end();
  });
}

export async function getSystemStatus(): Promise<SystemStatus> {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const cpus = os.cpus();

  const socketPath = findDockerSocket();
  let dockerAvailable = false;
  let containers: DockerContainerInfo[] = [];
  let dockerError: string | undefined;

  if (socketPath) {
    try {
      containers = await fetchDockerContainers(socketPath);
      dockerAvailable = true;
    } catch (err: any) {
      dockerError = err.message;
    }
  } else {
    dockerError = "Docker socket (/var/run/docker.sock) bulunamadı veya erişilemez";
  }

  const runningCount = containers.filter((c) => c.state === "running").length;

  return {
    timestamp: new Date().toISOString(),
    hostname: os.hostname(),
    platform: `${os.type()} ${os.release()}`,
    uptimeHours: Math.round((os.uptime() / 3600) * 10) / 10,
    memory: {
      totalMb: Math.round(totalMem / (1024 * 1024)),
      usedMb: Math.round(usedMem / (1024 * 1024)),
      freeMb: Math.round(freeMem / (1024 * 1024)),
      percentUsed: Math.round((usedMem / totalMem) * 100),
    },
    cpu: {
      model: cpus[0]?.model || "Unknown",
      cores: cpus.length,
      loadAvg: os.loadavg().map((l) => Math.round(l * 100) / 100),
    },
    docker: {
      available: dockerAvailable,
      socketPath: socketPath || "/var/run/docker.sock",
      containersCount: containers.length,
      runningCount,
      containers,
      error: dockerError,
    },
  };
}
