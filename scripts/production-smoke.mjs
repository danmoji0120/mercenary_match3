import { spawn } from 'node:child_process';
import net from 'node:net';
import { io } from 'socket.io-client';

const port = await new Promise((resolve, reject) => { const probe = net.createServer(); probe.once('error', reject); probe.listen(0, '127.0.0.1', () => { const address = probe.address(); const value = typeof address === 'object' && address ? address.port : 0; probe.close(() => resolve(value)) }) });
const baseUrl = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['apps/server/dist/index.js'], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: 'production', PORT: String(port), CLIENT_ORIGIN: '', ENABLE_TEST_API: 'true' }, stdio: ['ignore', 'pipe', 'pipe'] });
let output = ''; child.stdout.on('data', (chunk) => { output += chunk.toString() }); child.stderr.on('data', (chunk) => { output += chunk.toString() });
const deadline = Date.now() + 12_000;
let ready = false;
while (Date.now() < deadline) { try { const response = await fetch(`${baseUrl}/health`); if (response.ok) { ready = true; break } } catch { /* server is still starting */ } if (child.exitCode !== null) break; await new Promise((resolve) => setTimeout(resolve, 100)) }
if (!ready) { child.kill(); throw new Error(`Production server did not become ready\n${output}`) }

const health = await fetch(`${baseUrl}/health`); if (!health.ok) throw new Error(`Health failed: ${health.status}\n${output}`);
const healthBody = await health.json(); if (healthBody.status !== 'ok' || !healthBody.clientReady) throw new Error(`Invalid health: ${JSON.stringify(healthBody)}`);
const index = await fetch(`${baseUrl}/`), html = await index.text(); if (!index.ok || !html.includes('id="root"')) throw new Error('React index was not served');
const assetPath = html.match(/(?:src|href)="(\/assets\/[^"]+)"/)?.[1]; if (!assetPath || !(await fetch(`${baseUrl}${assetPath}`)).ok) throw new Error('Vite asset was not served');
if ((await fetch(`${baseUrl}/assets/does-not-exist.js`)).status !== 404) throw new Error('Missing asset did not return 404');
if (!(await fetch(`${baseUrl}/battle/client-route`)).ok) throw new Error('SPA fallback failed');

const once = (socket, name, timeout = 3_000) => new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error(`Socket event timeout: ${name}`)), timeout); socket.once(name, (value) => { clearTimeout(timer); resolve(value) }) });
const first = io(baseUrl), second = io(baseUrl), botClient = io(baseUrl);
await Promise.all([once(first, 'session'), once(second, 'session'), once(botClient, 'session')]);
const firstFound = once(first, 'matchFound'), secondFound = once(second, 'matchFound'); first.emit('queueJoin', {}); second.emit('queueJoin', {}); const [a, b] = await Promise.all([firstFound, secondFound]); if (a.battleId !== b.battleId) throw new Error('Production clients did not match together');
const botSnapshot = once(botClient, 'stateSnapshot'); botClient.emit('queueJoin', { immediateBot: true }); const botBattle = await botSnapshot; if (!botBattle.opponent.isBot) throw new Error('Production bot battle failed');
let debugEnded = false; botClient.once('battleEnded', () => { debugEnded = true }); botClient.emit('debugCommand', { action: 'win' }); await new Promise((resolve) => setTimeout(resolve, 150));
if (debugEnded || botBattle.phase === 'FINISHED') throw new Error('Production debug command was accepted');
for (const socket of [first, second, botClient]) socket.close();

child.kill('SIGTERM');
const exit = await Promise.race([new Promise((resolve) => child.once('exit', (code, signal) => resolve({ code, signal }))), new Promise((_, reject) => setTimeout(() => reject(new Error('Production server did not terminate')), 8_000))]);
if (!output.includes('staticClient=true')) throw new Error(`Startup diagnostics missing\n${output}`);
console.log(JSON.stringify({ health: healthBody, assetPath, matchedBattleId: a.battleId, botBattleId: botBattle.battleId, exit }, null, 2));
