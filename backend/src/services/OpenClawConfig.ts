const DEFAULT_INSTALL_TARGET = 'git+https://github.com/BytePioneer-AI/openclaw-china.git'
const DEFAULT_PACKAGE_CANDIDATES = ['openclaw-china', 'openclaw']
const DEFAULT_EXECUTABLE_CANDIDATES = ['openclaw', 'openclaw-china']

function parseList(value: string | undefined, fallback: string[]): string[] {
  const raw = value?.trim()
  if (!raw) return [...fallback]
  const list = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  return list.length > 0 ? list : [...fallback]
}

export const OPENCLAW_INSTALL_TARGET =
  process.env.OPENCLAW_INSTALL_TARGET?.trim() || DEFAULT_INSTALL_TARGET

export const OPENCLAW_INSTALL_COMMAND = `npm install -g ${OPENCLAW_INSTALL_TARGET}`

export const OPENCLAW_PACKAGE_CANDIDATES = parseList(
  process.env.OPENCLAW_PACKAGE_CANDIDATES,
  DEFAULT_PACKAGE_CANDIDATES
)

export const OPENCLAW_EXECUTABLE_CANDIDATES = parseList(
  process.env.OPENCLAW_EXECUTABLE_CANDIDATES,
  DEFAULT_EXECUTABLE_CANDIDATES
)
