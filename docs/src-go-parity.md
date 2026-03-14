# LinClaw `src-go` 命令文档

## 1. 目标

`src-go` 提供 Web 模式下的完整命令实现，通过 `/__api/*` 契约与前端通信。

## 2. 目录映射

| 模块 | Go 文件 | 说明 |
| --- | --- | --- |
| 配置 | `config.go` | 配置读写、安装探测、备份、Node/Git 检查 |
| 服务 | `service.go` | 服务状态与守护接口 |
| 日志 | `logs.go` | 日志读取与搜索 |
| 记忆 | `memory.go` | 记忆文件与 ZIP 导出 |
| Agent | `agent.go` | Agent 列表、增删、备份 |
| 助手 | `assistant.go` | 文件、命令、端口、图片、联网工具 |
| 消息 | `messaging.go` | 消息渠道配置 |
| Skills | `skills.go` | Skills 命令占位与兼容返回 |
| 扩展 | `extensions.go` | cftunnel / ClawApp 状态与占位操作 |
| 设备 | `device.go` | 设备密钥与 connect frame |
| 配对 | `pairing.go` | 自动配对与 CLI 配对命令 |
| 更新 | `update.go` | 热更新检查、下载、回滚、状态 |
| 认证 | `auth.go` | Web 登录、cookie、密码保护 |
| 云 | `cloud.go` | 实例切换、部署模式、Docker 命令占位 |

## 3. 当前已落地的能力

- `/__api/health` 和 `/__api/commands`
- `auth_*` 登录、登出、密码修改、无密码模式
- `read/write_openclaw_config`、`read/write_panel_config`、`read/write_mcp_config`
- `check_installation`、`check_node`、`check_git`、`scan_node_paths`
- `list/create/restore/delete_backup`
- `get_services_status`、`guardian_status`
- `read_log_tail`、`search_log`
- `list/read/write/delete/export_memory_*`
- `list/add/delete/update/backup_agent`
- `assistant_*` 文件、命令、端口、图片、联网工具
- `read/save/remove/toggle/list messaging`
- `create_connect_frame`、`auto_pair_device`、`check_pairing_status`
- `check/download/rollback/status frontend update`
- `instance_*`、`get_deploy_mode`、`get_deploy_config`
- 静态资源服务与 `/ws` Gateway 代理
