/**
 * Cola de reintentos en IndexedDB para el checklist: si una respuesta o foto no se
 * puede subir (mala señal en la sucursal), se guarda aquí y sobrevive aunque se
 * cierre la pestaña o el navegador — se reintenta sola al recuperar conexión o al
 * volver a abrir la app.
 */
const DB_NAME = "pcp-checklist-offline";
const DB_VERSION = 1;
const STORE = "pending-items";

export type PendingItem = {
  key: string; // `${evaluationId}:${itemId}`
  evaluationId: string;
  itemId: string;
  value: 0 | 1;
  comment?: string;
  /** Foto ya subida en un intento anterior (se conserva al reintentar solo el texto). */
  photoUrl?: string;
  /** Foto todavía sin subir — se reintenta la subida junto con la respuesta. */
  photoBlob?: Blob;
  photoExt?: string;
  updatedAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB no disponible"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function pendingKey(evaluationId: string, itemId: string) {
  return `${evaluationId}:${itemId}`;
}

export async function savePending(item: PendingItem): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function removePending(key: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function listPendingForEvaluation(evaluationId: string): Promise<PendingItem[]> {
  const db = await openDb();
  const items = await new Promise<PendingItem[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as PendingItem[]) ?? []);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return items.filter((i) => i.evaluationId === evaluationId);
}
