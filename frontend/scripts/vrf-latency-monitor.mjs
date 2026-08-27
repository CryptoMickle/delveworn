#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  createPublicClient,
  getAddress,
  http,
  parseAbi,
} from 'viem';
import { riseTestnet } from 'viem/chains';

const RPC_URL = process.env.RPC_URL || 'https://testnet.riselabs.xyz';
const DEFAULT_GAME = '0xf05236F00434B94EDC847dcf8391a8172a5EbE40';
const DEFAULT_PROBE = '0xeb9aE3ab74b1B43B484f414129f0ECeC8462aCCd';
const POLL_MS = Number(process.env.VRF_MONITOR_POLL_MS || 250);

function readDungeonAddress() {
  if (process.env.GAME_ADDRESS) return process.env.GAME_ADDRESS;

  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    const text = fs.readFileSync(envPath, 'utf8');
    const match = text.match(/^NEXT_PUBLIC_DUNGEON_ADDRESS=(.+)$/m);
    if (match?.[1]) return match[1].trim().replace(/^['"]|['"]$/g, '');
  } catch {
    // Fall back to the known test deployment below.
  }

  return DEFAULT_GAME;
}

const GAME = getAddress(readDungeonAddress());
const PROBE = getAddress(process.env.PROBE_ADDRESS || DEFAULT_PROBE);

const gameAbi = parseAbi([
  'event RandomnessRequested(address indexed player, uint256 indexed requestId, uint8 kind, uint32 numberCount)',
  'event RandomnessFulfilled(address indexed player, uint256 indexed requestId, uint8 kind)',
  'event RandomnessRetried(address indexed player, uint256 indexed oldRequestId, uint256 indexed newRequestId, uint8 kind)',
]);

const probeAbi = parseAbi([
  'function pendingRequestId() view returns (uint256)',
  'function lastRequestedAt() view returns (uint256)',
  'function lastFulfilledRequestId() view returns (uint256)',
  'function lastFulfilledAt() view returns (uint256)',
]);

const client = createPublicClient({
  chain: riseTestnet,
  transport: http(RPC_URL),
  pollingInterval: POLL_MS,
  cacheTime: 0,
});

const kindNames = new Map([
  [0, 'None'],
  [1, 'Monster'],
  [2, 'Attack'],
  [3, 'Storm'],
  [4, 'Potion'],
]);

const startedAt = Date.now();
const rows = new Map();
const seenLogs = new Set();
const probeRows = new Map();
let shuttingDown = false;
let unwatchRequested;
let unwatchFulfilled;
let unwatchRetried;
let probeTimer;

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputPath = path.resolve(process.cwd(), `vrf-latency-${stamp}.csv`);

function seconds(ms) {
  return (ms / 1000).toFixed(3);
}

function isoFromUnixSeconds(value) {
  if (value === null || value === undefined) return '';
  return new Date(Number(value) * 1000).toISOString();
}

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[index];
}

function gameCompletedRows() {
  return [...rows.values()].filter((r) => r.fulfillObservedAtMs !== null);
}

function writeCsv() {
  const header = [
    'source',
    'request_id',
    'kind',
    'player',
    'status',
    'request_block',
    'request_chain_time',
    'fulfill_block',
    'fulfill_chain_time',
    'chain_latency_s',
    'observer_latency_s',
    'request_tx',
    'fulfill_tx',
    'retry_from_request_id',
  ];

  const lines = [header.join(',')];

  for (const r of [...rows.values()].sort((a, b) => Number(a.requestId - b.requestId))) {
    const chainLatency =
      r.requestChainTs !== null && r.fulfillChainTs !== null
        ? Number(r.fulfillChainTs - r.requestChainTs)
        : '';
    const observerLatency =
      r.requestObservedAtMs !== null && r.fulfillObservedAtMs !== null
        ? ((r.fulfillObservedAtMs - r.requestObservedAtMs) / 1000).toFixed(3)
        : '';

    lines.push([
      'RiseDungeon',
      r.requestId.toString(),
      r.kindName,
      r.player,
      r.status,
      r.requestBlock?.toString() ?? '',
      isoFromUnixSeconds(r.requestChainTs),
      r.fulfillBlock?.toString() ?? '',
      isoFromUnixSeconds(r.fulfillChainTs),
      chainLatency,
      observerLatency,
      r.requestTx ?? '',
      r.fulfillTx ?? '',
      r.retryFrom?.toString() ?? '',
    ].map(csvEscape).join(','));
  }

  for (const r of [...probeRows.values()].sort((a, b) => Number(a.requestId - b.requestId))) {
    const chainLatency =
      r.requestChainTs !== null && r.fulfillChainTs !== null
        ? Number(r.fulfillChainTs - r.requestChainTs)
        : '';

    lines.push([
      'VRFProbe',
      r.requestId.toString(),
      'Probe',
      PROBE,
      r.fulfillChainTs !== null ? 'fulfilled' : 'pending',
      '',
      isoFromUnixSeconds(r.requestChainTs),
      '',
      isoFromUnixSeconds(r.fulfillChainTs),
      chainLatency,
      '',
      '',
      '',
      '',
    ].map(csvEscape).join(','));
  }

  fs.writeFileSync(outputPath, `${lines.join('\n')}\n`);
}

function printSummary() {
  const completed = gameCompletedRows();
  const chain = completed
    .filter((r) => r.requestChainTs !== null && r.fulfillChainTs !== null)
    .map((r) => Number(r.fulfillChainTs - r.requestChainTs));
  const observed = completed
    .filter((r) => r.requestObservedAtMs !== null && r.fulfillObservedAtMs !== null)
    .map((r) => (r.fulfillObservedAtMs - r.requestObservedAtMs) / 1000);

  console.log('\n--- RiseDungeon VRF summary ---');
  console.log(`Requests seen: ${rows.size}`);
  console.log(`Fulfilled:     ${completed.length}`);
  console.log(`Still pending: ${[...rows.values()].filter((r) => r.status === 'pending').length}`);
  console.log(`Invalidated by retry: ${[...rows.values()].filter((r) => r.status === 'retried').length}`);

  if (chain.length) {
    const avg = chain.reduce((a, b) => a + b, 0) / chain.length;
    console.log(`Chain latency: avg ${avg.toFixed(1)}s · median ${percentile(chain, 0.5).toFixed(1)}s · p95 ${percentile(chain, 0.95).toFixed(1)}s · max ${Math.max(...chain).toFixed(1)}s`);
  }

  if (observed.length) {
    const avg = observed.reduce((a, b) => a + b, 0) / observed.length;
    console.log(`Monitor-observed latency: avg ${avg.toFixed(1)}s · median ${percentile(observed, 0.5).toFixed(1)}s · p95 ${percentile(observed, 0.95).toFixed(1)}s · max ${Math.max(...observed).toFixed(1)}s`);
  }

  const probeCompleted = [...probeRows.values()].filter((r) => r.fulfillChainTs !== null);
  if (probeRows.size) {
    console.log(`VRFProbe: ${probeCompleted.length}/${probeRows.size} observed requests fulfilled.`);
  }

  console.log(`CSV: ${outputPath}`);
}

async function blockTimestamp(blockNumber) {
  const block = await client.getBlock({ blockNumber });
  return block.timestamp;
}

function logKey(log) {
  return `${log.transactionHash ?? '0x'}:${log.logIndex ?? -1}`;
}

async function onRequested(logs) {
  for (const log of logs) {
    const key = logKey(log);
    if (seenLogs.has(key)) continue;
    seenLogs.add(key);

    const requestId = log.args.requestId;
    const kind = Number(log.args.kind);
    const observedAt = Date.now();

    const existing = rows.get(requestId.toString());
    const row = existing ?? {
      requestId,
      player: log.args.player,
      kind,
      kindName: kindNames.get(kind) ?? `Kind${kind}`,
      numberCount: Number(log.args.numberCount),
      status: 'pending',
      requestBlock: log.blockNumber ?? null,
      requestChainTs: null,
      requestObservedAtMs: observedAt,
      requestTx: log.transactionHash ?? '',
      fulfillBlock: null,
      fulfillChainTs: null,
      fulfillObservedAtMs: null,
      fulfillTx: '',
      retryFrom: null,
    };

    row.requestObservedAtMs ??= observedAt;
    row.requestBlock ??= log.blockNumber ?? null;
    row.requestTx ||= log.transactionHash ?? '';
    rows.set(requestId.toString(), row);

    try {
      if (log.blockNumber !== null && log.blockNumber !== undefined) {
        row.requestChainTs = await blockTimestamp(log.blockNumber);
      }
    } catch (error) {
      console.warn(`[WARN] Could not fetch request block timestamp for ${requestId}:`, error?.message ?? error);
    }

    console.log(
      `[REQUEST]   #${requestId} ${row.kindName} · ${row.numberCount} number(s) · player ${String(row.player).slice(0, 8)}… · block ${row.requestBlock ?? '?'}`
    );
    writeCsv();
  }
}

async function onFulfilled(logs) {
  for (const log of logs) {
    const key = logKey(log);
    if (seenLogs.has(key)) continue;
    seenLogs.add(key);

    const requestId = log.args.requestId;
    const observedAt = Date.now();
    let row = rows.get(requestId.toString());

    if (!row) {
      const kind = Number(log.args.kind);
      row = {
        requestId,
        player: log.args.player,
        kind,
        kindName: kindNames.get(kind) ?? `Kind${kind}`,
        numberCount: '',
        status: 'fulfilled',
        requestBlock: null,
        requestChainTs: null,
        requestObservedAtMs: null,
        requestTx: '',
        fulfillBlock: log.blockNumber ?? null,
        fulfillChainTs: null,
        fulfillObservedAtMs: observedAt,
        fulfillTx: log.transactionHash ?? '',
        retryFrom: null,
      };
      rows.set(requestId.toString(), row);
    }

    row.status = 'fulfilled';
    row.fulfillObservedAtMs = observedAt;
    row.fulfillBlock = log.blockNumber ?? null;
    row.fulfillTx = log.transactionHash ?? '';

    try {
      if (log.blockNumber !== null && log.blockNumber !== undefined) {
        row.fulfillChainTs = await blockTimestamp(log.blockNumber);
      }
    } catch (error) {
      console.warn(`[WARN] Could not fetch fulfillment block timestamp for ${requestId}:`, error?.message ?? error);
    }

    const chainLatency =
      row.requestChainTs !== null && row.fulfillChainTs !== null
        ? Number(row.fulfillChainTs - row.requestChainTs)
        : null;
    const observedLatency =
      row.requestObservedAtMs !== null
        ? observedAt - row.requestObservedAtMs
        : null;

    console.log(
      `[FULFILLED] #${requestId} ${row.kindName}` +
        `${chainLatency !== null ? ` · on-chain ${chainLatency}s` : ''}` +
        `${observedLatency !== null ? ` · monitor ${seconds(observedLatency)}s` : ''}` +
        ` · block ${row.fulfillBlock ?? '?'}`
    );
    console.log('            If the game UI is still waiting now, the remaining delay is frontend/RPC propagation rather than VRF fulfillment.');

    writeCsv();

    if (gameCompletedRows().length % 5 === 0) {
      printSummary();
    }
  }
}

async function onRetried(logs) {
  for (const log of logs) {
    const key = logKey(log);
    if (seenLogs.has(key)) continue;
    seenLogs.add(key);

    const oldId = log.args.oldRequestId;
    const newId = log.args.newRequestId;
    const oldRow = rows.get(oldId.toString());
    if (oldRow && oldRow.status === 'pending') oldRow.status = 'retried';

    const newRow = rows.get(newId.toString());
    if (newRow) newRow.retryFrom = oldId;

    console.log(`[RETRY]     #${oldId} invalidated → #${newId}`);
    writeCsv();
  }
}

let lastProbePending = null;
let lastProbeFulfilled = null;

async function pollProbe() {
  try {
    const [pending, requestedAt, fulfilled, fulfilledAt] = await Promise.all([
      client.readContract({ address: PROBE, abi: probeAbi, functionName: 'pendingRequestId' }),
      client.readContract({ address: PROBE, abi: probeAbi, functionName: 'lastRequestedAt' }),
      client.readContract({ address: PROBE, abi: probeAbi, functionName: 'lastFulfilledRequestId' }),
      client.readContract({ address: PROBE, abi: probeAbi, functionName: 'lastFulfilledAt' }),
    ]);

    if (pending !== 0n && pending !== lastProbePending) {
      const row = probeRows.get(pending.toString()) ?? {
        requestId: pending,
        requestChainTs: requestedAt !== 0n ? requestedAt : null,
        fulfillChainTs: null,
      };
      row.requestChainTs = requestedAt !== 0n ? requestedAt : row.requestChainTs;
      probeRows.set(pending.toString(), row);
      console.log(`[PROBE REQ] #${pending} · chain time ${row.requestChainTs ? isoFromUnixSeconds(row.requestChainTs) : '?'}`);
      writeCsv();
    }

    if (fulfilled !== 0n && fulfilled !== lastProbeFulfilled) {
      const row = probeRows.get(fulfilled.toString()) ?? {
        requestId: fulfilled,
        requestChainTs: null,
        fulfillChainTs: null,
      };
      row.fulfillChainTs = fulfilledAt !== 0n ? fulfilledAt : null;
      probeRows.set(fulfilled.toString(), row);

      const latency =
        row.requestChainTs !== null && row.fulfillChainTs !== null
          ? Number(row.fulfillChainTs - row.requestChainTs)
          : null;
      console.log(`[PROBE OK]  #${fulfilled}${latency !== null ? ` · ${latency}s` : ''}`);
      writeCsv();
    }

    lastProbePending = pending;
    lastProbeFulfilled = fulfilled;
  } catch (error) {
    console.debug(`[PROBE] read delayed: ${error?.message ?? error}`);
  }
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${signal} received. Stopping monitor…`);
  try { unwatchRequested?.(); } catch {}
  try { unwatchFulfilled?.(); } catch {}
  try { unwatchRetried?.(); } catch {}
  if (probeTimer) clearInterval(probeTimer);
  writeCsv();
  printSummary();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('Ctrl+C'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

console.log('RISE Dungeon VRF latency monitor');
console.log(`RPC:   ${RPC_URL}`);
console.log(`Game:  ${GAME}`);
console.log(`Probe: ${PROBE}`);
console.log(`Poll:  ${POLL_MS} ms`);
console.log(`CSV:   ${outputPath}`);
console.log('');
console.log('Start this monitor, then play normally in the browser.');
console.log('It prints REQUEST and FULFILLED as they appear on-chain.');
console.log('Press Ctrl+C when you have enough samples (ideally 10–20).');
console.log('');

unwatchRequested = client.watchContractEvent({
  address: GAME,
  abi: gameAbi,
  eventName: 'RandomnessRequested',
  pollingInterval: POLL_MS,
  onLogs: (logs) => void onRequested(logs),
  onError: (error) => console.warn('[REQUEST watcher]', error?.message ?? error),
});

unwatchFulfilled = client.watchContractEvent({
  address: GAME,
  abi: gameAbi,
  eventName: 'RandomnessFulfilled',
  pollingInterval: POLL_MS,
  onLogs: (logs) => void onFulfilled(logs),
  onError: (error) => console.warn('[FULFILL watcher]', error?.message ?? error),
});

unwatchRetried = client.watchContractEvent({
  address: GAME,
  abi: gameAbi,
  eventName: 'RandomnessRetried',
  pollingInterval: POLL_MS,
  onLogs: (logs) => void onRetried(logs),
  onError: (error) => console.warn('[RETRY watcher]', error?.message ?? error),
});

await pollProbe();
probeTimer = setInterval(() => void pollProbe(), 1_000);

// Keep the process alive. The watchers and probe interval do the work.
await new Promise(() => {});
