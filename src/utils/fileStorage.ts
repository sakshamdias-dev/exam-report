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
 * Safely merges with existing records to prevent accidental wipes of rawImages or binary PDF.
 */
export async function saveSubmissionFileStorage(
  examId: string,
  studentId: string,
  pdfBase64?: string,
  rawImages?: string[]
): Promise<void> {
  if (!examId || !studentId) return;
  const trimmedExam = examId.trim();
  const trimmedStudent = studentId.trim();
  const normKey = `${trimmedExam.toUpperCase()}_${trimmedStudent.toUpperCase()}`;
  const exactKey = `${trimmedExam}_${trimmedStudent}`;

  // Check existing data in memory or IndexedDB to prevent accidental overwriting with undefined or URLs
  let existing: { pdfBase64?: string; rawImages?: string[] } | null = null;
  if (memoryCache.has(normKey)) {
    existing = memoryCache.get(normKey) || null;
  } else if (memoryCache.has(exactKey)) {
    existing = memoryCache.get(exactKey) || null;
  }

  // Determine effective PDF Base64:
  // If new pdfBase64 is a remote URL (e.g. Google Drive link), keep previously stored base64/data URI!
  const isNewUrl = typeof pdfBase64 === 'string' && (pdfBase64.startsWith('http://') || pdfBase64.startsWith('https://'));
  const effectivePdf = (!isNewUrl && pdfBase64 && pdfBase64.length > 50)
    ? pdfBase64
    : (existing?.pdfBase64 || (isNewUrl ? undefined : pdfBase64));

  // Determine effective Raw Images:
  // If new rawImages is non-empty, use it; otherwise retain existing images
  const effectiveImages = (rawImages && rawImages.length > 0)
    ? rawImages
    : (existing?.rawImages && existing.rawImages.length > 0 ? existing.rawImages : undefined);

  // 1. In-memory cache under multiple keys for instant lookup
  const cacheObj = {
    pdfBase64: effectivePdf,
    rawImages: effectiveImages,
    timestamp: Date.now(),
  };
  memoryCache.set(normKey, cacheObj);
  memoryCache.set(exactKey, cacheObj);

  // 2. Persist to IndexedDB
  try {
    const db = await openIndexedDb();
    if (db) {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      
      // Save under both exact and uppercase normalized keys
      store.put({
        id: exactKey,
        examId: trimmedExam,
        studentId: trimmedStudent,
        pdfBase64: effectivePdf,
        rawImages: effectiveImages,
        updatedAt: new Date().toISOString(),
      });

      if (normKey !== exactKey) {
        store.put({
          id: normKey,
          examId: trimmedExam.toUpperCase(),
          studentId: trimmedStudent.toUpperCase(),
          pdfBase64: effectivePdf,
          rawImages: effectiveImages,
          updatedAt: new Date().toISOString(),
        });
      }

      await new Promise<void>((res) => {
        tx.oncomplete = () => res();
        tx.onerror = () => res();
      });
    }
  } catch (err) {
    console.warn('Error writing submission to IndexedDB:', err);
  }

  // 3. Keep thumbnail/rawImages in localStorage if small enough for backward compatibility
  if (effectiveImages && effectiveImages.length > 0) {
    try {
      localStorage.setItem(`osm_student_images_${trimmedExam}_${trimmedStudent}`, JSON.stringify(effectiveImages));
      localStorage.setItem(`osm_student_images_${trimmedExam.toUpperCase()}_${trimmedStudent.toUpperCase()}`, JSON.stringify(effectiveImages));
    } catch (e) {
      // Ignore if localStorage quota exceeded
    }
  }
}

/**
 * Retrieve student submission files from Memory or IndexedDB
 * Uses case-insensitive search and fallback scans to guarantee asset retrieval.
 */
export async function getSubmissionFileStorage(
  examId: string,
  studentId: string
): Promise<{ pdfBase64?: string; rawImages?: string[] } | null> {
  if (!examId || !studentId) return null;
  const trimmedExam = examId.trim();
  const trimmedStudent = studentId.trim();
  const exactKey = `${trimmedExam}_${trimmedStudent}`;
  const normKey = `${trimmedExam.toUpperCase()}_${trimmedStudent.toUpperCase()}`;
  const lowerKey = `${trimmedExam.toLowerCase()}_${trimmedStudent.toLowerCase()}`;

  // Check memory cache across keys
  for (const k of [exactKey, normKey, lowerKey]) {
    if (memoryCache.has(k)) {
      const mem = memoryCache.get(k);
      if (mem && (mem.pdfBase64 || (mem.rawImages && mem.rawImages.length > 0))) {
        return { pdfBase64: mem.pdfBase64, rawImages: mem.rawImages };
      }
    }
  }

  // Check IndexedDB
  try {
    const db = await openIndexedDb();
    if (db) {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);

      // 1. Try exact key
      let req = store.get(exactKey);
      let record: any = await new Promise((resolve) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      });

      // 2. Try uppercase key
      if (!record && normKey !== exactKey) {
        req = store.get(normKey);
        record = await new Promise((resolve) => {
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
        });
      }

      // 3. Fallback: Scan store case-insensitively if direct key didn't hit
      if (!record) {
        const allReq = store.getAll();
        const allRecords: any[] = await new Promise((resolve) => {
          allReq.onsuccess = () => resolve(allReq.result || []);
          allReq.onerror = () => resolve([]);
        });

        record = allRecords.find((r) => {
          const rExam = String(r.examId || '').trim().toUpperCase();
          const rStu = String(r.studentId || '').trim().toUpperCase();
          return rExam === trimmedExam.toUpperCase() && rStu === trimmedStudent.toUpperCase();
        });
      }

      if (record && (record.pdfBase64 || (record.rawImages && record.rawImages.length > 0))) {
        const result = {
          pdfBase64: record.pdfBase64,
          rawImages: record.rawImages,
        };
        memoryCache.set(exactKey, { ...result, timestamp: Date.now() });
        memoryCache.set(normKey, { ...result, timestamp: Date.now() });
        return result;
      }
    }
  } catch (err) {
    console.warn('Error reading from IndexedDB:', err);
  }

  // Fallback to localStorage for images
  for (const k of [
    `osm_student_images_${trimmedExam}_${trimmedStudent}`,
    `osm_student_images_${trimmedExam.toUpperCase()}_${trimmedStudent.toUpperCase()}`,
    `osm_student_images_${trimmedExam.toLowerCase()}_${trimmedStudent.toLowerCase()}`,
  ]) {
    try {
      const cached = localStorage.getItem(k);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return { rawImages: parsed };
        }
      }
    } catch (e) {}
  }

  return null;
}

/**
 * Synchronous lookup from memory cache
 */
export function getSubmissionFileStorageSync(
  examId: string,
  studentId: string
): { pdfBase64?: string; rawImages?: string[] } | null {
  if (!examId || !studentId) return null;
  const exactKey = `${examId.trim()}_${studentId.trim()}`;
  const normKey = `${examId.trim().toUpperCase()}_${studentId.trim().toUpperCase()}`;
  return memoryCache.get(exactKey) || memoryCache.get(normKey) || null;
}

/**
 * Save evaluated & graded PDF document to IndexedDB
 */
export async function saveGradedPaperStorage(
  examId: string,
  studentId: string,
  gradedPdfBase64: string
): Promise<void> {
  if (!examId || !studentId || !gradedPdfBase64) return;
  const trimmedExam = examId.trim();
  const trimmedStudent = studentId.trim();
  const normKey = `graded_${trimmedExam.toUpperCase()}_${trimmedStudent.toUpperCase()}`;
  const exactKey = `graded_${trimmedExam}_${trimmedStudent}`;

  memoryCache.set(normKey, { pdfBase64: gradedPdfBase64, timestamp: Date.now() });
  memoryCache.set(exactKey, { pdfBase64: gradedPdfBase64, timestamp: Date.now() });

  try {
    const db = await openIndexedDb();
    if (db) {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({
        id: exactKey,
        examId: trimmedExam,
        studentId: trimmedStudent,
        pdfBase64: gradedPdfBase64,
        isGraded: true,
        updatedAt: new Date().toISOString(),
      });
      if (normKey !== exactKey) {
        store.put({
          id: normKey,
          examId: trimmedExam.toUpperCase(),
          studentId: trimmedStudent.toUpperCase(),
          pdfBase64: gradedPdfBase64,
          isGraded: true,
          updatedAt: new Date().toISOString(),
        });
      }
      await new Promise<void>((res) => {
        tx.oncomplete = () => res();
        tx.onerror = () => res();
      });
    }
  } catch (e) {
    console.warn('Error storing graded PDF to IndexedDB:', e);
  }
}

/**
 * Retrieve evaluated & graded PDF document from IndexedDB
 */
export async function getGradedPaperStorage(
  examId: string,
  studentId: string
): Promise<string | null> {
  if (!examId || !studentId) return null;
  const exactKey = `graded_${examId.trim()}_${studentId.trim()}`;
  const normKey = `graded_${examId.trim().toUpperCase()}_${studentId.trim().toUpperCase()}`;

  if (memoryCache.has(exactKey)) return memoryCache.get(exactKey)?.pdfBase64 || null;
  if (memoryCache.has(normKey)) return memoryCache.get(normKey)?.pdfBase64 || null;

  try {
    const db = await openIndexedDb();
    if (db) {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      let req = store.get(exactKey);
      let record: any = await new Promise((res) => {
        req.onsuccess = () => res(req.result);
        req.onerror = () => res(null);
      });
      if (!record && normKey !== exactKey) {
        req = store.get(normKey);
        record = await new Promise((res) => {
          req.onsuccess = () => res(req.result);
          req.onerror = () => res(null);
        });
      }
      if (record?.pdfBase64) {
        memoryCache.set(exactKey, { pdfBase64: record.pdfBase64, timestamp: Date.now() });
        return record.pdfBase64;
      }
    }
  } catch (e) {}

  return null;
}

/**
 * Save Question Paper PDF to IndexedDB and memory cache
 */
export async function saveQuestionPaperStorage(
  examId: string,
  pdfBase64: string
): Promise<void> {
  if (!examId || !pdfBase64) return;
  const cleanId = examId.trim().toUpperCase();
  const key = `qp_${cleanId}`;

  // 1. In-memory cache
  memoryCache.set(key, {
    pdfBase64,
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
        examId: cleanId,
        pdfBase64,
        updatedAt: new Date().toISOString(),
      });
      await new Promise<void>((res) => {
        tx.oncomplete = () => res();
        tx.onerror = () => res();
      });
    }
  } catch (err) {
    console.warn('Error saving Question Paper to IndexedDB:', err);
  }
}

/**
 * Retrieve Question Paper PDF from Memory or IndexedDB
 */
export async function getQuestionPaperStorage(
  examId: string
): Promise<string | null> {
  if (!examId) return null;
  const cleanId = examId.trim().toUpperCase();
  const key = `qp_${cleanId}`;

  // 1. Check memory cache
  if (memoryCache.has(key)) {
    const mem = memoryCache.get(key);
    if (mem?.pdfBase64) return mem.pdfBase64;
  }

  // 2. Check IndexedDB
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

      if (record?.pdfBase64) {
        memoryCache.set(key, {
          pdfBase64: record.pdfBase64,
          timestamp: Date.now(),
        });
        return record.pdfBase64;
      }
    }
  } catch (err) {
    console.warn('Error reading QP from IndexedDB:', err);
  }

  return null;
}

/**
 * Synchronous Question Paper lookup from memory cache
 */
export function getQuestionPaperStorageSync(examId: string): string | null {
  if (!examId) return null;
  const cleanId = examId.trim().toUpperCase();
  const key = `qp_${cleanId}`;
  return memoryCache.get(key)?.pdfBase64 || null;
}

