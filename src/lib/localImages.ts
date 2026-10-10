// Generated images live only in this browser (IndexedDB) — never in D1 or R2 (spec §14).

export type LocalImage = {
  id: string // generationId
  projectId: string
  blob: Blob
  width: number
  height: number
  prompt: string
  createdAt: string
}

const DB_NAME = 'pixo-images'
const STORE = 'images'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const s = req.result.createObjectStore(STORE, { keyPath: 'id' })
      s.createIndex('projectId', 'projectId')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const r = fn(t.objectStore(STORE))
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
    t.oncomplete = () => db.close()
  })
}

export const saveLocalImage = (img: LocalImage) => tx('readwrite', (s) => s.put(img))
export const deleteLocalImage = (id: string) => tx('readwrite', (s) => s.delete(id))
export const getLocalImage = (id: string) => tx<LocalImage | undefined>('readonly', (s) => s.get(id))
export async function listLocalImages(projectId?: string): Promise<LocalImage[]> {
  const all = await tx<LocalImage[]>('readonly', (s) => (projectId ? s.index('projectId').getAll(projectId) : s.getAll()))
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
export const localImagesAvailable = () => typeof indexedDB !== 'undefined'
