import { spawn } from 'node:child_process'

const extraArgs = process.argv.slice(2)
const command = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const env = { ...process.env }

if (!env.LINCLAW_GO_API_TARGET) {
  env.LINCLAW_GO_API_TARGET = 'http://127.0.0.1:43187'
}

const child = spawn(command, ['vite', ...extraArgs], {
  stdio: 'inherit',
  env,
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 0)
})

child.on('error', (error) => {
  console.error('[run-vite] failed to start vite:', error)
  process.exit(1)
})
