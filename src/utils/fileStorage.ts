/**
 * Resilient client-side storage for large exam assets (PDFs, multi-page image scans)
 * using IndexedDB with in-memory caching fallback.
 * Prevents LocalStorage QuotaExceededError and eliminates CORS network errors.
 */

const DB_NAME = 'ExamFriendly_Storage_v1';
const DB_VERSION = 1;
const STORE_NAME = 'submission_files';

// In-memory cache for ultra-fast synchronous lookup
const memoryCache = new Map<string, { pdfBase64?: string; rawImages?: string[]; timestamp: number }>();

function openIndexedDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }

    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: any) => {
        const db = event.target?.result as IDBDatabase;
        if (db && !db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = (event: any) => {
        resolve(event.target?.result as IDBDatabase);
      };

      request.onerror = () => {
        console.warn('IndexedDB failed to open, using memory cache fallback.');
        resolve(null);
      };
    } catch (e) {
      console.warn('IndexedDB not supported or restricted in environment:', e);
      resolve(null);
    }
  });
}

/**
 * Save student submission PDF and Raw Page Images
 */
export async function saveSubmissionFileStorage(
  examId: string,
  studentId: string,
  pdfBase64?: string,
  rawImages?: string[]
): Promise<void> {
  const key = `${examId}_${studentId}`;
  
  // 1. In-memory cache
  memoryCache.set(key, {
    pdfBase64,
    rawImages,
    timestamp: Date.now(),
  });

  // 2. Persist to IndexedDB
  try {
    const db = await openIndexedDb();
    if (db) {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({
        id: key,
        examId,
        studentId,
        pdfBase64,
        rawImages,
        updatedAt: new Date().toISOString(),
      });
      await new Promise<void>((res) => {
        tx.oncomplete = () => res();
        tx.onerror = () => res();
      });
    }
  } catch (err) {
    console.warn('Error writing submission to IndexedDB:', err);
  }

  // 3. Keep thumbnail/rawImages in localStorage if small enough for backward compatibility
  if (rawImages && rawImages.length > 0) {
    try {
      localStorage.setItem(`osm_student_images_${examId}_${studentId}`, JSON.stringify(rawImages));
    } catch (e) {
      // Ignore if localStorage quota exceeded
    }
  }
}

/**
 * Retrieve student submission files from Memory or IndexedDB
 */
export async function getSubmissionFileStorage(
  examId: string,
  studentId: string
): Promise<{ pdfBase64?: string; rawImages?: string[] } | null> {
  const key = `${examId}_${studentId}`;

  // Check memory cache first
  if (memoryCache.has(key)) {
    const mem = memoryCache.get(key);
    if (mem && (mem.pdfBase64 || (mem.rawImages && mem.rawImages.length > 0))) {
      return { pdfBase64: mem.pdfBase64, rawImages: mem.rawImages };
    }
  }

  // Check IndexedDB
  try {
    const db = await openIndexedDb();
    if (db) {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);

      const record: any = await new Promise((resolve) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      });

      if (record) {
        memoryCache.set(key, {
          pdfBase64: record.pdfBase64,
          rawImages: record.rawImages,
          timestamp: Date.now(),
        });
        return {
          pdfBase64: record.pdfBase64,
          rawImages: record.rawImages,
        };
      }
    }
  } catch (err) {
    console.warn('Error reading from IndexedDB:', err);
  }

  // Fallback to localStorage for images
  try {
    const cached = localStorage.getItem(`osm_student_images_${examId}_${studentId}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return { rawImages: parsed };
      }
    }
  } catch (e) {}

  return null;
}

/**
 * Synchronous lookup from memory cache
 */
export function getSubmissionFileStorageSync(
  examId: string,
  studentId: string
): { pdfBase64?: string; rawImages?: string[] } | null {
  const key = `${examId}_${studentId}`;
  if (memoryCache.has(key)) {
    return memoryCache.get(key) || null;
  }
  return null;
}
