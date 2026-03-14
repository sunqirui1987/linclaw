/**
 * LinClaw entrypoint
 */
import { startLinclawApp } from './app/bootstrap.js'
import { installGlobalLoginHook } from './app/startup-ui.js'
import { initTheme } from './lib/theme.js'

import './style/variables.css'
import './style/reset.css'
import './style/layout.css'
import './style/components.css'
import './style/pages.css'
import './style/chat.css'
import './style/agents.css'
import './style/debug.css'
import './style/assistant.css'
import './style/ai-drawer.css'

initTheme()
installGlobalLoginHook()

const sidebar = document.getElementById('sidebar')
const content = document.getElementById('content')

startLinclawApp({ sidebar, content })
