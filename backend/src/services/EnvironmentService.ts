import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir, platform, arch } from 'node:os'
import { join } from 'node:path'
import type { EnvCheckResult } from '../types/index.js'
import { OPENCLAW_EXECUTABLE_CANDIDATES, OPENCLAW_PACKAGE_CANDIDATES } from './OpenClawConfig.js'

function execCommand(command: string): string | null {
  try {
    return execSync(command, { 
      encoding: 'utf8', 
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000 
    }).trim()
  } catch {
    return null
  }
}

function resolveOpenClawStateDir(): string {
  return process.env.OPENCLAW_STATE_DIR || join(homedir(), '.openclaw')
}

function resolveCommandPath(command: string): string | null {
  const result = execCommand(`which ${command}`) || execCommand(`where ${command}`)
  if (!result) return null
  return result.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || null
}

function readVersionFromPackageJson(packagePath: string): string | null {
  const packageJsonPath = join(packagePath, 'package.json')
  if (!existsSync(packageJsonPath)) return null
  try {
    const data = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version?: unknown }
    return typeof data.version === 'string' && data.version.trim() ? data.version.trim() : null
  } catch {
    return null
  }
}

function getGlobalOpenClawPackageInfo(): {
  version: string | null
  packagePath: string | null
  packageName: string | null
} {
  const globalRoot = execCommand('npm root -g')
  if (!globalRoot) {
    return { version: null, packagePath: null, packageName: null }
  }

  for (const packageName of OPENCLAW_PACKAGE_CANDIDATES) {
    const packagePath = join(globalRoot, packageName)
    if (!existsSync(packagePath)) {
      continue
    }

    return {
      version: readVersionFromPackageJson(packagePath),
      packagePath,
      packageName,
    }
  }

  return { version: null, packagePath: null, packageName: null }
}

function resolveGlobalOpenClawBinaryPath(): string | null {
  const prefix = execCommand('npm config get prefix')
  if (!prefix || prefix === 'undefined' || prefix === 'null') {
    return null
  }

  const candidates: string[] = []
  for (const executable of OPENCLAW_EXECUTABLE_CANDIDATES) {
    const executableCandidates =
      process.platform === 'win32'
        ? [join(prefix, `${executable}.cmd`), join(prefix, executable)]
        : [join(prefix, 'bin', executable), join(prefix, executable)]
    candidates.push(...executableCandidates)
  }

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate
    }
  }

  return null
}

function getOpenClawExecutableCandidates(): string[] {
  const candidates: string[] = []

  for (const executable of OPENCLAW_EXECUTABLE_CANDIDATES) {
    const commandPath = resolveCommandPath(executable)
    if (commandPath) {
      candidates.push(commandPath)
    }
  }

  const localCandidates: string[] = []
  for (const executable of OPENCLAW_EXECUTABLE_CANDIDATES) {
    const executableCandidates =
      process.platform === 'win32'
        ? [
            join(resolveOpenClawStateDir(), 'bin', `${executable}.cmd`),
            join(resolveOpenClawStateDir(), 'bin', executable),
          ]
        : [join(resolveOpenClawStateDir(), 'bin', executable)]
    localCandidates.push(...executableCandidates)
  }

  for (const candidate of localCandidates) {
    if (existsSync(candidate)) {
      candidates.push(candidate)
    }
  }

  const globalBinary = resolveGlobalOpenClawBinaryPath()
  if (globalBinary) {
    candidates.push(globalBinary)
  }

  return Array.from(new Set(candidates))
}

function getOpenClawVersion(executable: string): string | null {
  return execCommand(`"${executable}" --version`) || execCommand(`"${executable}" version`)
}

export function findOpenClawExecutable(): string | null {
  for (const candidate of getOpenClawExecutableCandidates()) {
    if (getOpenClawVersion(candidate)) {
      return candidate
    }
  }
  return null
}

function getNodeInfo(): EnvCheckResult['node'] {
  const version = execCommand('node --version')
  if (!version) {
    return { installed: false, version: null, path: null }
  }
  
  const nodePath = resolveCommandPath('node')
  return {
    installed: true,
    version: version.replace(/^v/, ''),
    path: nodePath,
  }
}

function getNpmInfo(): EnvCheckResult['npm'] {
  const version = execCommand('npm --version')
  return {
    installed: !!version,
    version,
  }
}

function getPnpmInfo(): EnvCheckResult['pnpm'] {
  const version = execCommand('pnpm --version')
  return {
    installed: !!version,
    version,
  }
}

function getOpenClawInfo(): EnvCheckResult['openclaw'] {
  const executable = findOpenClawExecutable()
  if (executable) {
    const version = getOpenClawVersion(executable)

    return {
      installed: true,
      version,
      path: executable,
    }
  }

  const candidates = getOpenClawExecutableCandidates()
  const globalPkg = getGlobalOpenClawPackageInfo()
  if (globalPkg.packagePath || candidates.length > 0) {
    return {
      installed: false,
      version: globalPkg.version,
      path: candidates[0] || globalPkg.packagePath,
    }
  }

  return { installed: false, version: null, path: null }
}

function getOSInfo(): EnvCheckResult['os'] {
  const plat = platform()
  return {
    platform: plat as 'darwin' | 'win32' | 'linux',
    arch: arch(),
  }
}

export function checkEnvironment(): EnvCheckResult {
  return {
    node: getNodeInfo(),
    npm: getNpmInfo(),
    pnpm: getPnpmInfo(),
    openclaw: getOpenClawInfo(),
    os: getOSInfo(),
  }
}

export function getNodeInstallGuide(plat: string): { platform: string; instructions: string[] } {
  const instructions: string[] = []
  
  switch (plat) {
    case 'darwin':
      instructions.push(
        '方式一：使用 Homebrew（推荐）',
        'brew install node',
        '',
        '方式二：使用 nvm',
        'curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash',
        'nvm install --lts',
        '',
        '方式三：官网下载',
        'https://nodejs.org/zh-cn/download/'
      )
      break
    case 'win32':
      instructions.push(
        '方式一：官网下载安装包（推荐）',
        'https://nodejs.org/zh-cn/download/',
        '下载 Windows Installer (.msi) 并运行安装',
        '',
        '方式二：使用 winget',
        'winget install OpenJS.NodeJS.LTS',
        '',
        '方式三：使用 Chocolatey',
        'choco install nodejs-lts'
      )
      break
    case 'linux':
      instructions.push(
        '方式一：使用包管理器',
        '# Ubuntu/Debian',
        'curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -',
        'sudo apt-get install -y nodejs',
        '',
        '# CentOS/RHEL/Fedora',
        'curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash -',
        'sudo yum install -y nodejs',
        '',
        '方式二：使用 nvm',
        'curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash',
        'nvm install --lts'
      )
      break
    default:
      instructions.push(
        '请访问 Node.js 官网下载适合您系统的安装包：',
        'https://nodejs.org/zh-cn/download/'
      )
  }
  
  return { platform: plat, instructions }
}
