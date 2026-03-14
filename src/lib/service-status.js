export const GATEWAY_SERVICE_LABEL = 'ai.openclaw.gateway'

export function findServiceByLabel(services, label) {
  if (!Array.isArray(services) || !services.length) return null
  return services.find(service => service?.label === label) || null
}

export function findGatewayService(services) {
  if (!Array.isArray(services) || !services.length) return null
  return findServiceByLabel(services, GATEWAY_SERVICE_LABEL) || services[0] || null
}

export function normalizeGatewayService(service) {
  return {
    label: service?.label || GATEWAY_SERVICE_LABEL,
    running: service?.running === true,
    pid: service?.pid ?? null,
    description: service?.description || 'OpenClaw Gateway',
    cli_installed: service ? service.cli_installed !== false : false,
  }
}

export function getGatewayServiceSnapshot(services) {
  return normalizeGatewayService(findGatewayService(services))
}
