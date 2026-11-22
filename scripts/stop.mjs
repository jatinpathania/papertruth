#!/usr/bin/env node

import { DEV_PORTS, freePorts } from './lib/ports.mjs';

const stopped = freePorts(DEV_PORTS, {
  onKill: (pid, port, killed) =>
    console.log(killed ? `stopped pid ${pid} on port ${port}` : `could not stop pid ${pid} on port ${port}`)
});

console.log(
  stopped === 0 ? 'nothing was listening — ports are already free' : `freed ${stopped} process(es)`
);
