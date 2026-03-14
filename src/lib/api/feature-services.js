import {
  cachedCommand,
  clearCommandCache,
  invalidateCommandCache,
  invokeCommand,
} from '../http-client.js'

const service = Object.freeze({
  getServicesStatus: (force = false) => force ? invokeCommand('get_services_status') : cachedCommand('get_services_status', {}, 3000),
  startService: (label) => {
    invalidateCommandCache('get_services_status')
    return invokeCommand('start_service', { label })
  },
  stopService: (label) => {
    invalidateCommandCache('get_services_status')
    return invokeCommand('stop_service', { label })
  },
  restartService: (label) => {
    invalidateCommandCache('get_services_status')
    return invokeCommand('restart_service', { label })
  },
  guardianStatus: () => invokeCommand('guardian_status'),
})

const config = Object.freeze({
  getVersionInfo: () => cachedCommand('get_version_info', {}, 30000),
  readOpenclawConfig: () => cachedCommand('read_openclaw_config'),
  writeOpenclawConfig: (config) => {
    invalidateCommandCache('read_openclaw_config')
    return invokeCommand('write_openclaw_config', { config })
  },
  readMcpConfig: () => cachedCommand('read_mcp_config'),
  writeMcpConfig: (config) => {
    invalidateCommandCache('read_mcp_config')
    return invokeCommand('write_mcp_config', { config })
  },
  reloadGateway: () => invokeCommand('reload_gateway'),
  restartGateway: () => invokeCommand('restart_gateway'),
  listOpenclawVersions: (source = 'chinese') => invokeCommand('list_openclaw_versions', { source }),
  upgradeOpenclaw: (source = 'chinese', version = null) => invokeCommand('upgrade_openclaw', { source, version }),
  uninstallOpenclaw: (cleanConfig = false) => invokeCommand('uninstall_openclaw', { cleanConfig }),
  installGateway: () => invokeCommand('install_gateway'),
  uninstallGateway: () => invokeCommand('uninstall_gateway'),
  getNpmRegistry: () => cachedCommand('get_npm_registry', {}, 30000),
  setNpmRegistry: (registry) => {
    invalidateCommandCache('get_npm_registry')
    return invokeCommand('set_npm_registry', { registry })
  },
  testModel: (baseUrl, apiKey, modelId, apiType = null) => invokeCommand('test_model', { baseUrl, apiKey, modelId, apiType }),
  listRemoteModels: (baseUrl, apiKey, apiType = null) => invokeCommand('list_remote_models', { baseUrl, apiKey, apiType }),
  patchModelVision: () => invokeCommand('patch_model_vision'),
  checkQiniuSetup: () => invokeCommand('check_qiniu_setup'),
  saveQiniuEnv: (apiKey, model) => invokeCommand('save_qiniu_env', { apiKey: apiKey || '', model }),
})

const agents = Object.freeze({
  listAgents: () => cachedCommand('list_agents'),
  addAgent: (name, model, workspace) => {
    invalidateCommandCache('list_agents')
    return invokeCommand('add_agent', { name, model, workspace: workspace || null })
  },
  deleteAgent: (id) => {
    invalidateCommandCache('list_agents')
    return invokeCommand('delete_agent', { id })
  },
  updateAgentIdentity: (id, name, emoji) => {
    invalidateCommandCache('list_agents')
    return invokeCommand('update_agent_identity', { id, name, emoji })
  },
  updateAgentModel: (id, model) => {
    invalidateCommandCache('list_agents')
    return invokeCommand('update_agent_model', { id, model })
  },
  backupAgent: (id) => invokeCommand('backup_agent', { id }),
})

const logs = Object.freeze({
  readLogTail: (logName, lines = 100) => cachedCommand('read_log_tail', { logName, lines }, 5000),
  searchLog: (logName, query, maxResults = 50) => invokeCommand('search_log', { logName, query, maxResults }),
})

const memory = Object.freeze({
  listMemoryFiles: (category, agentId) => cachedCommand('list_memory_files', { category, agentId: agentId || null }),
  readMemoryFile: (path, agentId) => cachedCommand('read_memory_file', { path, agentId: agentId || null }, 5000),
  writeMemoryFile: (path, content, category, agentId) => {
    invalidateCommandCache('list_memory_files', 'read_memory_file')
    return invokeCommand('write_memory_file', { path, content, category: category || 'memory', agentId: agentId || null })
  },
  deleteMemoryFile: (path, agentId) => {
    invalidateCommandCache('list_memory_files')
    return invokeCommand('delete_memory_file', { path, agentId: agentId || null })
  },
  exportMemoryZip: (category, agentId) => invokeCommand('export_memory_zip', { category, agentId: agentId || null }),
})

const messaging = Object.freeze({
  readPlatformConfig: (platform) => invokeCommand('read_platform_config', { platform }),
  saveMessagingPlatform: (platform, form) => {
    invalidateCommandCache('list_configured_platforms', 'read_platform_config')
    return invokeCommand('save_messaging_platform', { platform, form })
  },
  removeMessagingPlatform: (platform) => {
    invalidateCommandCache('list_configured_platforms', 'read_platform_config')
    return invokeCommand('remove_messaging_platform', { platform })
  },
  toggleMessagingPlatform: (platform, enabled) => {
    invalidateCommandCache('list_configured_platforms')
    return invokeCommand('toggle_messaging_platform', { platform, enabled })
  },
  verifyBotToken: (platform, form) => invokeCommand('verify_bot_token', { platform, form }),
  listConfiguredPlatforms: () => cachedCommand('list_configured_platforms', {}, 5000),
  getChannelPluginStatus: (pluginId) => invokeCommand('get_channel_plugin_status', { pluginId }),
  installQqbotPlugin: () => invokeCommand('install_qqbot_plugin'),
  installChannelPlugin: (packageName, pluginId) => invokeCommand('install_channel_plugin', { packageName, pluginId }),
})

const panel = Object.freeze({
  readPanelConfig: () => invokeCommand('read_panel_config'),
  writePanelConfig: (config) => invokeCommand('write_panel_config', { config }),
})

const environment = Object.freeze({
  checkInstallation: () => cachedCommand('check_installation', {}, 60000),
  initOpenclawConfig: () => {
    invalidateCommandCache('check_installation')
    return invokeCommand('init_openclaw_config')
  },
  checkNode: () => cachedCommand('check_node', {}, 60000),
  installNodeRuntime: (version = '') => {
    invalidateCommandCache('check_node')
    return invokeCommand('install_node_runtime', version ? { version } : {})
  },
  checkNodeAtPath: (nodeDir) => invokeCommand('check_node_at_path', { nodeDir }),
  scanNodePaths: () => invokeCommand('scan_node_paths'),
  saveCustomNodePath: (nodeDir) => invokeCommand('save_custom_node_path', { nodeDir }).then((result) => {
    invalidateCommandCache('check_node')
    invokeCommand('invalidate_path_cache').catch(() => {})
    return result
  }),
  invalidatePathCache: () => invokeCommand('invalidate_path_cache'),
  checkGit: () => cachedCommand('check_git', {}, 60000),
  autoInstallGit: () => invokeCommand('auto_install_git'),
  configureGitHttps: () => invokeCommand('configure_git_https'),
  getDeployConfig: () => cachedCommand('get_deploy_config'),
  getDeployMode: () => cachedCommand('get_deploy_mode', {}, 60000),
  checkPanelUpdate: () => invokeCommand('check_panel_update'),
  writeEnvFile: (path, config) => invokeCommand('write_env_file', { path, config }),
  readEnvFile: (path) => invokeCommand('read_env_file', { path: path || '~/.openclaw/.env' }),
})

const backups = Object.freeze({
  listBackups: () => cachedCommand('list_backups'),
  createBackup: () => {
    invalidateCommandCache('list_backups')
    return invokeCommand('create_backup')
  },
  restoreBackup: (name) => invokeCommand('restore_backup', { name }),
  deleteBackup: (name) => {
    invalidateCommandCache('list_backups')
    return invokeCommand('delete_backup', { name })
  },
})

const extensions = Object.freeze({
  getCftunnelStatus: () => invokeCommand('get_cftunnel_status'),
  cftunnelAction: (action) => invokeCommand('cftunnel_action', { action }),
  getCftunnelLogs: (lines = 100) => invokeCommand('get_cftunnel_logs', { lines }),
  getClawappStatus: () => invokeCommand('get_clawapp_status'),
  installCftunnel: () => invokeCommand('install_cftunnel'),
  installClawapp: () => invokeCommand('install_clawapp'),
})

const device = Object.freeze({
  createConnectFrame: (nonce, gatewayToken) => invokeCommand('create_connect_frame', { nonce, gatewayToken }),
  autoPairDevice: () => invokeCommand('auto_pair_device'),
  checkPairingStatus: () => invokeCommand('check_pairing_status'),
  pairingListChannel: (channel) => invokeCommand('pairing_list_channel', { channel }),
  pairingApproveChannel: (channel, code, notify = false) => invokeCommand('pairing_approve_channel', { channel, code, notify }),
})

const assistant = Object.freeze({
  assistantExec: (command, cwd) => invokeCommand('assistant_exec', { command, cwd: cwd || null }),
  assistantReadFile: (path) => invokeCommand('assistant_read_file', { path }),
  assistantWriteFile: (path, content) => invokeCommand('assistant_write_file', { path, content }),
  assistantListDir: (path) => invokeCommand('assistant_list_dir', { path }),
  assistantSystemInfo: () => invokeCommand('assistant_system_info'),
  assistantListProcesses: (filter) => invokeCommand('assistant_list_processes', { filter: filter || null }),
  assistantCheckPort: (port) => invokeCommand('assistant_check_port', { port }),
  assistantWebSearch: (query, maxResults) => invokeCommand('assistant_web_search', { query, max_results: maxResults || 5 }),
  assistantFetchUrl: (url) => invokeCommand('assistant_fetch_url', { url }),
})

const skills = Object.freeze({
  skillsList: () => invokeCommand('skills_list'),
  skillsInfo: (name) => invokeCommand('skills_info', { name }),
  skillsCheck: () => invokeCommand('skills_check'),
  skillsInstallDep: (kind, spec) => invokeCommand('skills_install_dep', { kind, spec }),
  skillsClawHubSearch: (query) => invokeCommand('skills_clawhub_search', { query }),
  skillsClawHubInstall: (slug) => invokeCommand('skills_clawhub_install', { slug }),
})

const instances = Object.freeze({
  instanceList: () => cachedCommand('instance_list', {}, 10000),
  instanceAdd: (instance) => {
    invalidateCommandCache('instance_list')
    return invokeCommand('instance_add', instance)
  },
  instanceRemove: (id) => {
    invalidateCommandCache('instance_list')
    return invokeCommand('instance_remove', { id })
  },
  instanceSetActive: (id) => {
    invalidateCommandCache('instance_list')
    clearCommandCache()
    return invokeCommand('instance_set_active', { id })
  },
  instanceHealthCheck: (id) => invokeCommand('instance_health_check', { id }),
  instanceHealthAll: () => invokeCommand('instance_health_all'),
})

const updates = Object.freeze({
  checkFrontendUpdate: () => invokeCommand('check_frontend_update'),
  downloadFrontendUpdate: (url, expectedHash) => invokeCommand('download_frontend_update', { url, expectedHash: expectedHash || '' }),
  rollbackFrontendUpdate: () => invokeCommand('rollback_frontend_update'),
  getUpdateStatus: () => invokeCommand('get_update_status'),
})

const media = Object.freeze({
  ensureDataDir: () => invokeCommand('assistant_ensure_data_dir'),
  saveImage: (id, data) => invokeCommand('assistant_save_image', { id, data }),
  loadImage: (id) => invokeCommand('assistant_load_image', { id }),
  deleteImage: (id) => invokeCommand('assistant_delete_image', { id }),
})

export const featureServices = Object.freeze({
  service,
  config,
  agents,
  logs,
  memory,
  messaging,
  panel,
  environment,
  backups,
  extensions,
  device,
  assistant,
  skills,
  instances,
  updates,
  media,
})

export const api = Object.freeze(Object.assign({}, ...Object.values(featureServices)))
