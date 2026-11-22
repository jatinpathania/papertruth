import { spawnSync } from 'node:child_process';

export const DEV_PORTS = [Number(process.env.PORT) || 5000, 5173, 4173];

export function pidsOnPort(port) {
  const pids = new Set();
  if (process.platform === 'win32') {
    const result = spawnSync('netstat', ['-ano'], { encoding: 'utf8' });
    for (const line of (result.stdout || '').split(/\r?\n/)) {
      const match = line.trim().match(/^TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)$/i);
      if (match && Number(match[1]) === port) pids.add(Number(match[2]));
    }
  } else {
    const result = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' });
    for (const line of (result.stdout || '').split(/\r?\n/)) {
      if (line.trim()) pids.add(Number(line.trim()));
    }
  }
  return [...pids].filter((pid) => Number.isFinite(pid) && pid !== process.pid);
}

export function killTree(pid) {
  if (process.platform === 'win32') {
    return spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' }).status === 0;
  }
  try {
    process.kill(pid, 'SIGTERM');
    return true;
  } catch {
    return false;
  }
}

// `node --watch` re-spawns the real server under a new pid, so killing only the
// pids we recorded can leave a grandchild holding the port. Sweeping the ports
// afterwards is what actually guarantees a clean stop.
export function freePorts(ports = DEV_PORTS, { onKill } = {}) {
  let freed = 0;
  for (const port of ports) {
    for (const pid of pidsOnPort(port)) {
      const killed = killTree(pid);
      if (killed) freed += 1;
      onKill?.(pid, port, killed);
    }
  }
  return freed;
}
