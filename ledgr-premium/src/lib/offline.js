/** Offline write queue — localStorage-backed with retry */

const QUEUE_KEY = 'ledgr_offline_queue'
const MAX_RETRIES = 8

function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
  } catch {
    return []
  }
}

function saveQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

export function enqueue(operation) {
  const queue = getQueue()
  queue.push({
    id: crypto.randomUUID(),
    ...operation,
    retries: 0,
    createdAt: new Date().toISOString(),
  })
  saveQueue(queue)
}

export async function flushQueue(supabase) {
  const queue = getQueue()
  if (!queue.length) return { flushed: 0, failed: 0 }

  let flushed = 0
  let failed = 0
  const remaining = []

  for (const op of queue) {
    try {
      const { table, type, data, match } = op
      let result

      if (type === 'insert') {
        result = await supabase.from(table).insert(data)
      } else if (type === 'update') {
        result = await supabase.from(table).update(data).match(match)
      } else if (type === 'delete') {
        result = await supabase.from(table).delete().match(match)
      }

      if (result?.error) throw result.error
      flushed++
    } catch (err) {
      op.retries++
      if (op.retries < MAX_RETRIES && isTransportError(err)) {
        remaining.push(op)
      } else {
        failed++
        console.error('Offline queue item permanently failed:', op, err)
      }
    }
  }

  saveQueue(remaining)
  return { flushed, failed }
}

function isTransportError(err) {
  if (!err) return false
  if (err.message?.includes('Failed to fetch')) return true
  if (err.message?.includes('NetworkError')) return true
  if (err.code === 'PGRST301') return false // auth error, don't retry
  return false
}

let syncInterval = null

export function startAutoSync(supabase, intervalMs = 30000) {
  stopAutoSync()
  syncInterval = setInterval(() => {
    if (navigator.onLine) flushQueue(supabase)
  }, intervalMs)

  window.addEventListener('online', () => flushQueue(supabase))
}

export function stopAutoSync() {
  if (syncInterval) {
    clearInterval(syncInterval)
    syncInterval = null
  }
}

export function queueSize() {
  return getQueue().length
}
