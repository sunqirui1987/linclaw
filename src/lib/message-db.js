/**
 * 本地消息存储 - IndexedDB
 * 从 clawapp 移植，适配 LinClaw
 */

const DB_NAME = 'linclaw-messages'
const DB_VERSION = 1
const STORE_NAME = 'messages'
const STORE_SESSIONS = 'sessions'

let _db = null

function openDB() {
  return new Promise((resolve, reject) => {
    if (_db) return resolve(_db)
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => { _db = request.result; resolve(_db) }
    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const msgStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        msgStore.createIndex('sessionKey', 'sessionKey', { unique: false })
        msgStore.createIndex('timestamp', 'timestamp', { unique: false })
        msgStore.createIndex('sessionKey_timestamp', ['sessionKey', 'timestamp'], { unique: false })
      }
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        db.createObjectStore(STORE_SESSIONS, { keyPath: 'sessionKey' })
      }
    }
  })
}

export async function saveMessage(message) {
  if (!message || !message.id) return
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put({
      id: message.id,
      sessionKey: message.sessionKey || '',
      role: message.role || 'assistant',
      content: message.content || message.text || '',
      timestamp: message.timestamp || Date.now(),
      sync: true
    })
  } catch (e) {
    console.error('[db] saveMessage error:', e)
  }
}

export async function saveMessages(messages) {
  if (!messages?.length) return
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    messages.forEach(msg => {
      if (!msg.id) return
      store.put({
        id: msg.id,
        sessionKey: msg.sessionKey || '',
        role: msg.role || 'assistant',
        content: msg.content || msg.text || '',
        timestamp: msg.timestamp || Date.now(),
        sync: true
      })
    })
  } catch (e) {
    console.error('[db] saveMessages error:', e)
  }
}

export async function getLocalMessages(sessionKey, limit = 200) {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const index = tx.objectStore(STORE_NAME).index('sessionKey_timestamp')
      const range = IDBKeyRange.bound([sessionKey, 0], [sessionKey, Date.now() + 1])
      const messages = []
      const request = index.openCursor(range, 'prev')
      request.onsuccess = (event) => {
        const cursor = event.target.result
        if (cursor && messages.length < limit) { messages.push(cursor.value); cursor.continue() }
      }
      tx.oncomplete = () => resolve(messages.reverse())
      tx.onerror = () => resolve([])
    })
  } catch (e) {
    console.error('[db] getLocalMessages error:', e)
    return []
  }
}

export async function clearSessionMessages(sessionKey) {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const request = tx.objectStore(STORE_NAME).index('sessionKey').openCursor(sessionKey)
    request.onsuccess = (event) => {
      const cursor = event.target.result
      if (cursor) { cursor.delete(); cursor.continue() }
    }
  } catch (e) {
    console.error('[db] clearSessionMessages error:', e)
  }
}

export function isStorageAvailable() {
  try { return 'indexedDB' in window && !!indexedDB } catch { return false }
}
