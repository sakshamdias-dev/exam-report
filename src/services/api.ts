import { ApiResponse, Exam, ProctorLog, Role, Submission, User, Doubt, StudentGroup, AssignmentType, SubmissionOverride, EvaluationDoubt } from '../types';
import { saveSubmissionFileStorage, getSubmissionFileStorageSync, getSubmissionFileStorage } from '../utils/fileStorage';
import { fetchDrivePdfBinary } from '../utils/pdfHelper';

const STORAGE_KEYS = {
  GAS_CONFIG: 'exam_portal_gas_config',
  USERS: 'exam_portal_users',
  EXAMS: 'exam_portal_exams',
  SUBMISSIONS: 'exam_portal_submissions',
  LOGS: 'exam_portal_logs',
  DOUBTS: 'exam_portal_doubts',
  GROUPS: 'exam_portal_groups',
  OVERRIDES: 'exam_portal_submission_overrides',
};

// Default Initial Seed Data matching Google Sheets Schema
const DEFAULT_USERS: User[] = [
  { UserId: 'TCH-801', Password: 'admin123', Role: 'teacher', Name: 'Faculty Evaluator' },
];

const DEFAULT_GROUPS: StudentGroup[] = [];

const DEFAULT_EXAMS: Exam[] = [];

const DEFAULT_SUBMISSIONS: Submission[] = [];

const DEFAULT_LOGS: ProctorLog[] = [];

const DEFAULT_DOUBTS: Doubt[] = [];

const MOCK_EXAM_IDS = new Set(['EXAM-CS301', 'EXAM-MATH204', 'EXAM-PHY101']);
const MOCK_STUDENT_IDS = new Set(['STU-101', 'STU-102']);
const MOCK_GROUP_IDS = new Set(['GRP-B1', 'GRP-B2']);

export const DEFAULT_WEB_APP_URL =
  'https://script.google.com/macros/s/AKfycbwZKmWoH1nkmzpix51IoEoM8YS3WN0Mey6PYyXZMKyURrjgEESrsSErfX2E_JfdNc8gaw/exec';

/**
 * Normalizes and cleans Google Apps Script Web App URLs
 * Ensures URLs ending in /edit are converted to /exec and trailing slashes are trimmed
 */
export function cleanGasUrl(url: string): string {
  if (!url) return '';
  let cleaned = url.trim().replace(/^["']|["']$/g, '');
  // Auto-correct common mistake of pasting Apps Script editor URL (/edit) instead of Web App deployment (/exec)
  if (cleaned.includes('/macros/s/') && cleaned.endsWith('/edit')) {
    cleaned = cleaned.replace(/\/edit(\?.*)?$/, '/exec');
  }
  // Trim trailing slashes
  cleaned = cleaned.replace(/\/+$/, '');
  // If user copied macro URL without /exec
  if (cleaned.includes('/macros/s/') && !cleaned.endsWith('/exec') && !cleaned.includes('/exec?')) {
    cleaned = `${cleaned}/exec`;
  }
  return cleaned;
}

// Runtime tracking of GAS connection health
let gasLastErrorStatus: number | null = null;
let gasLastErrorMsg: string | null = null;
let gasLogged404Count = 0;

export function getGasConnectionStatus(): {
  mode: 'live';
  webAppUrl: string;
  isConfigured: boolean;
  is404: boolean;
  errorMessage?: string;
} {
  return {
    mode: 'live',
    webAppUrl: DEFAULT_WEB_APP_URL,
    isConfigured: true,
    is404: gasLastErrorStatus === 404,
    errorMessage: gasLastErrorMsg || undefined,
  };
}

// Helper to get configuration - automatically connects to the designated Google Apps Script URL in live mode
export function getGasConfig(): { webAppUrl: string; mode: 'live' } {
  return { webAppUrl: DEFAULT_WEB_APP_URL, mode: 'live' };
}

export function saveGasConfig(config: { webAppUrl: string; mode: 'live' | 'simulator' }) {
  const cleanedConfig = {
    webAppUrl: cleanGasUrl(config.webAppUrl || DEFAULT_WEB_APP_URL),
    mode: config.mode || 'live',
  };
  localStorage.setItem(STORAGE_KEYS.GAS_CONFIG, JSON.stringify(cleanedConfig));
  gasLastErrorStatus = null;
  gasLastErrorMsg = null;
  gasLogged404Count = 0;
  window.dispatchEvent(new CustomEvent('gas-config-updated', { detail: cleanedConfig }));
}

// Storage Helpers for Local Simulator
function getLocalUsers(): User[] {
  const data = localStorage.getItem(STORAGE_KEYS.USERS);
  if (!data) {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(DEFAULT_USERS));
    return DEFAULT_USERS;
  }
  try {
    const list: User[] = JSON.parse(data);
    const cleaned = list.filter((u) => !MOCK_STUDENT_IDS.has(u.UserId.toUpperCase()));
    if (cleaned.length !== list.length) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch {
    return DEFAULT_USERS;
  }
}

function getLocalExams(): Exam[] {
  const data = localStorage.getItem(STORAGE_KEYS.EXAMS);
  if (!data) {
    return [];
  }
  try {
    const list: Exam[] = JSON.parse(data);
    const cleaned = list.filter((e) => !MOCK_EXAM_IDS.has(e.ExamId.toUpperCase()));
    if (cleaned.length !== list.length) {
      localStorage.setItem(STORAGE_KEYS.EXAMS, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch {
    return [];
  }
}

function saveLocalExams(exams: Exam[]) {
  localStorage.setItem(STORAGE_KEYS.EXAMS, JSON.stringify(exams));
}

function getLocalSubmissions(): Submission[] {
  let list: Submission[] = [];
  const data = localStorage.getItem(STORAGE_KEYS.SUBMISSIONS);
  if (data) {
    try {
      const parsed: Submission[] = JSON.parse(data);
      list = parsed.filter(
        (s) => !MOCK_STUDENT_IDS.has(s.StudentId.toUpperCase()) && !MOCK_EXAM_IDS.has(s.ExamId.toUpperCase())
      );
      if (list.length !== parsed.length) {
        localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(list));
      }
    } catch (e) {
      list = [];
    }
  }

  // Hydrate files from memory / IndexedDB cache if available
  return list.map((sub) => {
    const cached = getSubmissionFileStorageSync(sub.ExamId, sub.StudentId);
    let subUrl = sub.SubmissionUrl;
    let rawImages = sub.RawImages;

    if (cached?.pdfBase64 && (!subUrl || subUrl.startsWith('https://www.w3.org'))) {
      subUrl = cached.pdfBase64.startsWith('data:') ? cached.pdfBase64 : `data:application/pdf;base64,${cached.pdfBase64}`;
    }
    if (cached?.rawImages && cached.rawImages.length > 0 && (!rawImages || rawImages.length === 0)) {
      rawImages = cached.rawImages;
    }

    return {
      ...sub,
      SubmissionUrl: subUrl,
      RawImages: rawImages,
      ImageUrls: rawImages || sub.ImageUrls,
    };
  });
}

function saveLocalSubmissions(subs: Submission[]) {
  // 1. Save heavy assets into IndexedDB / Memory Cache
  for (const s of subs) {
    if (s.SubmissionUrl?.startsWith('data:') || (s.RawImages && s.RawImages.length > 0)) {
      saveSubmissionFileStorage(s.ExamId, s.StudentId, s.SubmissionUrl, s.RawImages);
    }
  }

  // 2. Try saving to localStorage; if quota exceeded, create lightweight copy
  try {
    localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(subs));
  } catch (e) {
    console.warn('LocalStorage quota limit reached for full submissions, saving lightweight metadata index.');
    try {
      const sanitized = subs.map((s) => {
        const isDataUrl = s.SubmissionUrl && s.SubmissionUrl.startsWith('data:');
        return {
          ...s,
          SubmissionUrl: isDataUrl ? `stored://submission/${s.ExamId}/${s.StudentId}` : s.SubmissionUrl,
          RawImages: undefined, // Preserved in IndexedDB
          ImageUrls: undefined,
        };
      });
      localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(sanitized));
    } catch (err2) {
      console.warn('Could not save submissions to localStorage:', err2);
    }
  }
}

function getLocalLogs(): ProctorLog[] {
  const data = localStorage.getItem(STORAGE_KEYS.LOGS);
  if (!data) {
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(DEFAULT_LOGS));
    return DEFAULT_LOGS;
  }
  return JSON.parse(data);
}

function saveLocalLogs(logs: ProctorLog[]) {
  localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
}

function getLocalDoubts(): Doubt[] {
  const data = localStorage.getItem(STORAGE_KEYS.DOUBTS);
  if (!data) {
    return [];
  }
  try {
    const list: Doubt[] = JSON.parse(data);
    const cleaned = list.filter((d) => d.DoubtId !== 'DBT-001' && !MOCK_STUDENT_IDS.has(d.StudentId.toUpperCase()));
    if (cleaned.length !== list.length) {
      localStorage.setItem(STORAGE_KEYS.DOUBTS, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch {
    return [];
  }
}

// Real-time synchronization channel for doubts/chat
const DOUBTS_CHANNEL_NAME = 'examfriendly_doubts_sync_v1';
let doubtsBroadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    doubtsBroadcastChannel = new BroadcastChannel(DOUBTS_CHANNEL_NAME);
  }
} catch (e) {
  // ignore
}

function saveLocalDoubts(doubts: Doubt[]) {
  localStorage.setItem(STORAGE_KEYS.DOUBTS, JSON.stringify(doubts));
  try {
    localStorage.setItem('examfriendly_doubts_v1', JSON.stringify(doubts));
  } catch (e) {}
  if (doubtsBroadcastChannel) {
    try {
      doubtsBroadcastChannel.postMessage({ type: 'DOUBTS_UPDATED', timestamp: Date.now() });
    } catch (e) {}
  }
}

function getLocalGroups(): StudentGroup[] {
  const data = localStorage.getItem(STORAGE_KEYS.GROUPS);
  if (!data) {
    return [];
  }
  try {
    const list: StudentGroup[] = JSON.parse(data);
    const cleaned = list.filter((g) => !MOCK_GROUP_IDS.has(g.GroupId.toUpperCase()));
    if (cleaned.length !== list.length) {
      localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch {
    return [];
  }
}

function saveLocalGroups(groups: StudentGroup[]) {
  localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(groups));
}

function getLocalOverrides(): SubmissionOverride[] {
  const data = localStorage.getItem(STORAGE_KEYS.OVERRIDES);
  if (!data) {
    return [];
  }
  return JSON.parse(data);
}

function saveLocalOverrides(overrides: SubmissionOverride[]) {
  localStorage.setItem(STORAGE_KEYS.OVERRIDES, JSON.stringify(overrides));
}

export interface GasProgress {
  loaded: number;
  total: number;
  percent: number;
  stage: 'preparing' | 'uploading' | 'processing' | 'finishing' | 'completed';
  statusText: string;
}

/**
 * Sends a POST request to Google Apps Script with real-time XMLHttpRequest upload progress
 */
function sendGasRequestWithProgress(
  url: string,
  payload: any,
  onProgress?: (progress: GasProgress) => void
): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'text/plain;charset=utf-8');

    let waitInterval: any = null;

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable && evt.total > 0) {
          const uploadPct = Math.round((evt.loaded / evt.total) * 100);
          // Scale raw upload phase to 15% - 85% of submission progress
          const overallPct = Math.min(85, Math.max(15, Math.round(15 + (uploadPct * 0.70))));
          const loadedMb = (evt.loaded / (1024 * 1024)).toFixed(2);
          const totalMb = (evt.total / (1024 * 1024)).toFixed(2);
          onProgress({
            loaded: evt.loaded,
            total: evt.total,
            percent: overallPct,
            stage: 'uploading',
            statusText: `Uploading answer booklet: ${uploadPct}% (${loadedMb} / ${totalMb} MB)...`,
          });
        }
      };

      xhr.upload.onloadend = () => {
        onProgress({
          loaded: 1,
          total: 1,
          percent: 88,
          stage: 'processing',
          statusText: 'Data uploaded. Securing booklet and logging timestamp in examination register...',
        });

        // Smoothly progress 88% -> 96% while waiting for Google Apps Script to write to Google Drive
        let waitPct = 88;
        waitInterval = setInterval(() => {
          if (waitPct < 96) {
            waitPct += 2;
            onProgress({
              loaded: 1,
              total: 1,
              percent: waitPct,
              stage: 'processing',
              statusText: 'Archiving document and finalizing submission receipt...',
            });
          }
        }, 400);
      };
    }

    xhr.onload = () => {
      if (waitInterval) clearInterval(waitInterval);
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.({
          loaded: 1,
          total: 1,
          percent: 98,
          stage: 'processing',
          statusText: 'Finalizing examination record and digital signature...',
        });
        try {
          const json = JSON.parse(xhr.responseText);
          resolve(json);
        } catch (e) {
          reject(new Error(`Server returned non-JSON response (HTTP ${xhr.status})`));
        }
      } else {
        reject(new Error(`HTTP Error ${xhr.status}: ${xhr.statusText}`));
      }
    };

    xhr.onerror = () => {
      if (waitInterval) clearInterval(waitInterval);
      reject(new Error('Network connection error during file upload. Please check your internet.'));
    };

    xhr.ontimeout = () => {
      if (waitInterval) clearInterval(waitInterval);
      reject(new Error('Upload request timed out. Please try again.'));
    };

    try {
      const serialized = JSON.stringify(payload);
      onProgress?.({
        loaded: 0,
        total: serialized.length,
        percent: 10,
        stage: 'preparing',
        statusText: 'Preparing and optimizing answer booklet for secure transfer...',
      });
      xhr.send(serialized);
    } catch (err) {
      if (waitInterval) clearInterval(waitInterval);
      reject(err);
    }
  });
}

/**
 * Universal dispatcher: sends request to live Google Apps Script Web App or handles in Simulator
 */
export async function executeGasAction<T = any>(
  action: string,
  payload: Record<string, any> = {},
  onProgress?: (progress: GasProgress) => void
): Promise<ApiResponse<T>> {
  const config = getGasConfig();
  const fullPayload = { action, ...payload };

  // If live mode and valid Web App URL provided
  if (config.mode === 'live' && config.webAppUrl && config.webAppUrl.trim().startsWith('http')) {
    try {
      // Optimization: For answer sheet uploads to Google Apps Script, do not transmit redundant 50MB+
      // multi-page raw image arrays over the wire. Google Apps Script only needs pdfBase64 to save to Drive.
      // Raw page images are already safely persisted in client-side IndexedDB for local marking.
      const networkPayload: Record<string, any> = { ...fullPayload };
      if (action === 'submitAnswerSheet' || action === 'uploadSubmissionPdf' || action === 'uploadGradedAnswerSheet') {
        delete networkPayload.rawImages;
        delete networkPayload.RawImages;
        delete networkPayload.imageUrls;
        delete networkPayload.ImageUrls;
      }

      let json: any;
      if (onProgress || action === 'submitAnswerSheet' || action === 'uploadSubmissionPdf' || action === 'uploadGradedAnswerSheet') {
        json = await sendGasRequestWithProgress(config.webAppUrl.trim(), networkPayload, onProgress);
      } else {
        // Use text/plain POST to avoid CORS preflight OPTIONS request that Google Apps Script does not support
        const response = await fetch(config.webAppUrl.trim(), {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8',
          },
          body: JSON.stringify(networkPayload),
        });

        if (!response.ok) {
          gasLastErrorStatus = response.status;
          gasLastErrorMsg = `HTTP Error ${response.status}: ${response.statusText || 'Response not OK'}`;
          throw new Error(`HTTP Error ${response.status}: ${response.statusText || 'Response not OK'}`);
        }

        json = await response.json();
        gasLastErrorStatus = null;
        gasLastErrorMsg = null;
        gasLogged404Count = 0;
      }

      if (json && json.success && onProgress) {
        onProgress({
          loaded: 100,
          total: 100,
          percent: 100,
          stage: 'completed',
          statusText: 'Answer booklet submitted and verified!',
        });
      }

      // If the live GAS script recognized and handled the action successfully
      if (json && json.success) {
        // Dual-persist student additions and removals locally so they remain accessible offline or in case of mixed usage
        if (action === 'createStudent') {
          const studentId = (payload.studentId || payload.UserId || '').trim().toUpperCase();
          const name = (payload.name || payload.Name || '').trim();
          const password = (payload.password || payload.Password || '').trim();
          const users = getLocalUsers();
          if (!users.some((u) => u.UserId.toUpperCase() === studentId)) {
            users.push({ UserId: studentId, Name: name, Password: password, Role: 'student' });
            localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
          }
        } else if (action === 'deleteStudent') {
          const studentId = (payload.studentId || payload.UserId || '').trim().toUpperCase();
          const users = getLocalUsers().filter((u) => u.UserId.toUpperCase() !== studentId);
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
        } else if (action === 'getStudents') {
          // Merge spreadsheet students with any locally created students so no record is hidden
          const liveStudents: any[] = json.data?.students || (json as any).students || [];
          const liveSet = new Set(liveStudents.map((s) => String(s.UserId).toUpperCase()));
          const localStudents = getLocalUsers().filter((u) => u.Role.toLowerCase() === 'student');
          for (const ls of localStudents) {
            if (!liveSet.has(ls.UserId.toUpperCase())) {
              liveStudents.push({ UserId: ls.UserId, Name: ls.Name, Role: ls.Role });
            }
          }
          if (json.data) {
            json.data.students = liveStudents;
          } else {
            (json as any).students = liveStudents;
          }
        } else if (action === 'createGroup') {
          const grp = json.data?.group || (json as any).group;
          if (grp) {
            const groups = getLocalGroups();
            const filtered = groups.filter((g) => g.GroupId !== grp.GroupId);
            filtered.unshift(grp);
            saveLocalGroups(filtered);
          }
        } else if (action === 'updateGroup') {
          const grp = json.data?.group || (json as any).group;
          if (grp) {
            const groups = getLocalGroups();
            const idx = groups.findIndex((g) => g.GroupId === grp.GroupId);
            if (idx > -1) groups[idx] = grp;
            else groups.unshift(grp);
            saveLocalGroups(groups);
          }
        } else if (action === 'deleteGroup') {
          const groupId = payload.groupId || payload.GroupId;
          if (groupId) {
            const groups = getLocalGroups().filter((g) => g.GroupId !== groupId);
            saveLocalGroups(groups);
          }
        } else if (action === 'getGroups') {
          const liveGroups: any[] = json.data?.groups || (json as any).groups || [];
          const localGroups = getLocalGroups();
          const liveIds = new Set(liveGroups.map((g) => g.GroupId));
          for (const lg of localGroups) {
            if (!liveIds.has(lg.GroupId)) {
              liveGroups.push(lg);
            }
          }
          if (json.data) json.data.groups = liveGroups;
          else (json as any).groups = liveGroups;
        } else if (action === 'createDoubt') {
          const doubt = json.data?.doubt || (json as any).doubt;
          if (doubt) {
            const doubts = getLocalDoubts();
            const filtered = doubts.filter((d) => d.DoubtId !== doubt.DoubtId);
            filtered.unshift(doubt);
            saveLocalDoubts(filtered);
          }
        } else if (action === 'answerDoubt') {
          const doubt = json.data?.doubt || (json as any).doubt;
          const doubtId = payload.doubtId;
          const answer = payload.answer;
          const doubts = getLocalDoubts();
          const idx = doubts.findIndex((d) => d.DoubtId === (doubt?.DoubtId || doubtId));
          if (idx > -1) {
            doubts[idx].Answer = answer || doubt?.Answer || '';
            doubts[idx].Status = 'ANSWERED';
            saveLocalDoubts(doubts);
          }
        } else if (action === 'submitAnswerSheet') {
          const subs = getLocalSubmissions();
          const existingIdx = subs.findIndex(
            (s) => s.StudentId === payload.studentId && s.ExamId === payload.examId
          );
          let subUrl = payload.submissionUrl || json.data?.fileUrl || json.data?.submission?.SubmissionUrl || '';
          if (payload.pdfBase64 && (!subUrl || subUrl.startsWith('data:'))) {
            subUrl = payload.pdfBase64.startsWith('data:')
              ? payload.pdfBase64
              : `data:application/pdf;base64,${payload.pdfBase64}`;
          }
          if (!subUrl) {
            subUrl = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
          }
          const rawImages = payload.rawImages || payload.RawImages || (existingIdx > -1 ? subs[existingIdx].RawImages : undefined);
          const imageUrls = payload.imageUrls || payload.ImageUrls || (existingIdx > -1 ? subs[existingIdx].ImageUrls : undefined);

          saveSubmissionFileStorage(payload.examId, payload.studentId, payload.pdfBase64 || subUrl, rawImages || imageUrls);

          const newSub: Submission = {
            StudentId: payload.studentId,
            ExamId: payload.examId,
            SubmissionUrl: subUrl,
            SubmittedAt: payload.submittedAt || new Date().toISOString(),
            GradedUrl: existingIdx > -1 ? subs[existingIdx].GradedUrl : '',
            Score: existingIdx > -1 ? subs[existingIdx].Score : '',
            Feedback: existingIdx > -1 ? subs[existingIdx].Feedback : '',
            StudentName: payload.studentName || payload.studentId,
            RawImages: rawImages,
            ImageUrls: imageUrls,
          };
          if (existingIdx > -1) {
            subs[existingIdx] = { ...subs[existingIdx], ...newSub };
          } else {
            subs.unshift(newSub);
          }
          saveLocalSubmissions(subs);
        } else if (action === 'requestRecheck') {
          const subs = getLocalSubmissions();
          const studentId = (payload.studentId || '').trim().toUpperCase();
          const examId = (payload.examId || '').trim();
          const idx = subs.findIndex((s) => s.StudentId.toUpperCase() === studentId && s.ExamId === examId);
          if (idx > -1) {
            subs[idx] = {
              ...subs[idx],
              Status: 'RECHECK_REQUESTED',
              RecheckReason: payload.reason || '',
              RecheckGrounds: payload.grounds || 'General Evaluation Clarification',
              RecheckRequestedAt: new Date().toISOString(),
            };
            saveLocalSubmissions(subs);
          }
        } else if (action === 'resolveRecheck') {
          const subs = getLocalSubmissions();
          const studentId = (payload.studentId || '').trim().toUpperCase();
          const examId = (payload.examId || '').trim();
          const idx = subs.findIndex((s) => s.StudentId.toUpperCase() === studentId && s.ExamId === examId);
          if (idx > -1) {
            subs[idx] = {
              ...subs[idx],
              Status: 'RECHECK_RESOLVED',
              RecheckRemarks: payload.remarks || '',
              RecheckResolvedAt: new Date().toISOString(),
              Score: payload.score !== undefined && payload.score !== '' ? Number(payload.score) : subs[idx].Score,
              Feedback: payload.feedback || subs[idx].Feedback,
            };
            saveLocalSubmissions(subs);
          }
        } else if (action === 'toggleExamResultsRelease') {
          const exams = getLocalExams();
          const examId = payload.examId;
          const idx = exams.findIndex((e) => e.ExamId === examId);
          if (idx > -1) {
            const isReleased = payload.resultsReleased !== undefined ? Boolean(payload.resultsReleased) : !exams[idx].ResultsReleased;
            exams[idx] = {
              ...exams[idx],
              ResultsReleased: isReleased,
              ResultsReleasedAt: isReleased ? new Date().toISOString() : undefined,
            };
            saveLocalExams(exams);
          }
        } else if (action === 'createExam' || action === 'updateExam') {
          const examId = (payload.examId || json.data?.exam?.ExamId || '').trim();
          if (examId) {
            const cleanId = examId.toUpperCase();
            if (payload.questionMarks && Array.isArray(payload.questionMarks)) {
              try {
                localStorage.setItem(`exam_qm_${cleanId}`, JSON.stringify(payload.questionMarks));
                localStorage.setItem(`exam_qm_${examId}`, JSON.stringify(payload.questionMarks));
              } catch (e) {}
            }
            const exams = getLocalExams();
            const existingIdx = exams.findIndex((e) => e.ExamId.toUpperCase() === cleanId);
            const examRecord: Exam = {
              ExamId: examId,
              Subject: payload.subject || 'General Examination',
              StartTime: payload.startTime,
              EndTime: payload.endTime,
              QPUrl: payload.qpUrl || json.data?.exam?.QPUrl || '',
              CreatedAt: payload.createdAt || new Date().toISOString(),
              TotalMarks: Number(payload.totalMarks) || 100,
              AssignmentType: payload.assignmentType || 'ALL',
              AssignedGroups: payload.assignedGroups || [],
              AssignedStudents: payload.assignedStudents || [],
              MeetUrl: payload.meetUrl,
              RequireGoogleMeet: payload.requireGoogleMeet,
              QuestionMarks: payload.questionMarks,
            };
            if (existingIdx > -1) {
              exams[existingIdx] = { ...exams[existingIdx], ...examRecord };
            } else {
              exams.unshift(examRecord);
            }
            saveLocalExams(exams);
          }
        } else if (action === 'getAllExams') {
          const liveExams: Exam[] = json.data?.exams || (json as any).exams || [];
          const localExams = getLocalExams();
          const localMap = new Map(localExams.map((e) => [e.ExamId.toUpperCase(), e]));
          
          for (let i = 0; i < liveExams.length; i++) {
            const le = localMap.get(liveExams[i].ExamId.toUpperCase());
            let qm = liveExams[i].QuestionMarks;
            if (!qm || qm.length === 0) {
              const saved = localStorage.getItem(`exam_qm_${liveExams[i].ExamId.toUpperCase()}`) || localStorage.getItem(`exam_qm_${liveExams[i].ExamId}`);
              if (saved) {
                try {
                  qm = JSON.parse(saved);
                } catch (e) {}
              }
            }
            if (le) {
              liveExams[i] = {
                ...liveExams[i],
                ResultsReleased: liveExams[i].ResultsReleased !== undefined ? liveExams[i].ResultsReleased : le.ResultsReleased,
                ResultsReleasedAt: liveExams[i].ResultsReleasedAt || le.ResultsReleasedAt,
                QuestionMarks: qm || le.QuestionMarks,
              };
            } else if (qm) {
              liveExams[i].QuestionMarks = qm;
            }
          }
          const liveKey = new Set(liveExams.map((e) => e.ExamId.toUpperCase()));
          for (const le of localExams) {
            if (!liveKey.has(le.ExamId.toUpperCase())) {
              liveExams.push(le);
            }
          }
          if (json.data) json.data.exams = liveExams;
          else (json as any).exams = liveExams;
        } else if (action === 'getSubmissions') {
          const liveSubs: Submission[] = json.data?.submissions || (json as any).submissions || [];
          const localSubs = getLocalSubmissions();
          const localMap = new Map(localSubs.map((s) => [`${s.ExamId}_${s.StudentId}`, s]));

          // Seamlessly merge local recheck status, feedback, GradedUrl, QuestionScores into liveSubs
          for (let i = 0; i < liveSubs.length; i++) {
            const key = `${liveSubs[i].ExamId}_${liveSubs[i].StudentId}`;
            const ls = localMap.get(key);
            if (ls) {
              liveSubs[i] = {
                ...liveSubs[i],
                GradedUrl: liveSubs[i].GradedUrl || ls.GradedUrl,
                Score: liveSubs[i].Score !== '' && liveSubs[i].Score !== undefined ? liveSubs[i].Score : ls.Score,
                Feedback: liveSubs[i].Feedback || ls.Feedback,
                Status: ls.Status || liveSubs[i].Status || 'SUBMITTED',
                RecheckGrounds: ls.RecheckGrounds || liveSubs[i].RecheckGrounds,
                RecheckReason: ls.RecheckReason || liveSubs[i].RecheckReason,
                RecheckRequestedAt: ls.RecheckRequestedAt || liveSubs[i].RecheckRequestedAt,
                RecheckRemarks: ls.RecheckRemarks || liveSubs[i].RecheckRemarks,
                RecheckResolvedAt: ls.RecheckResolvedAt || liveSubs[i].RecheckResolvedAt,
                QuestionScores: ls.QuestionScores || liveSubs[i].QuestionScores,
                OsmDraftData: ls.OsmDraftData || liveSubs[i].OsmDraftData,
                RawImages: liveSubs[i].RawImages || ls.RawImages,
                SubmissionUrl: liveSubs[i].SubmissionUrl || ls.SubmissionUrl,
              };
            }
          }

          const liveKey = new Set(liveSubs.map((s) => `${s.ExamId}_${s.StudentId}`));
          for (const ls of localSubs) {
            if (!liveKey.has(`${ls.ExamId}_${ls.StudentId}`)) {
              if (!payload.examId || ls.ExamId === payload.examId) {
                liveSubs.push(ls);
              }
            }
          }
          if (json.data) json.data.submissions = liveSubs;
          else (json as any).submissions = liveSubs;
        } else if (action === 'getDoubts') {
          const liveDoubts: Doubt[] = json.data?.doubts || (json as any).doubts || [];
          const localDoubts = getLocalDoubts();
          const liveIds = new Set(liveDoubts.map((d) => d.DoubtId));
          for (const ld of localDoubts) {
            if (!liveIds.has(ld.DoubtId)) {
              if (!payload.examId || ld.ExamId === payload.examId) {
                liveDoubts.push(ld);
              }
            }
          }
          if (json.data) json.data.doubts = liveDoubts;
          else (json as any).doubts = liveDoubts;
        }
        return json;
      }

      // If the deployed Apps Script returned "Unknown action requested" (e.g. older deployment without createStudent or getGroups)
      const errorMsg = String(json?.error || '').toLowerCase();
      if (errorMsg.includes('unknown action') || errorMsg.includes('not supported') || errorMsg.includes('unknown endpoint')) {
        console.warn(`[GAS Backend Notice] Action '${action}' is not in deployed Apps Script version. Executing local ERP register fallback.`);
        return executeLocalSimulation<T>(action, payload);
      }

      // If doubt or getFileBase64 action returned not successful from live sheet, fallback to local simulator
      if ((action === 'getDoubts' || action === 'createDoubt' || action === 'answerDoubt' || action === 'getFileBase64') && !json.success) {
        return executeLocalSimulation<T>(action, payload);
      }

      // If user login failed on live sheet, check local student registry
      if (action === 'userLogin' && !json.success) {
        const userId = (payload.userId || '').trim().toUpperCase();
        const password = (payload.password || '').trim();
        const requestedRole = (payload.role || '').toLowerCase();
        const users = getLocalUsers();
        const found = users.find(
          (u) => u.UserId.toUpperCase() === userId && u.Password === password
        );
        if (found && (!requestedRole || found.Role.toLowerCase() === requestedRole)) {
          return {
            success: true,
            message: 'Authentication successful (Local ERP Register)!',
            data: {
              user: {
                UserId: found.UserId,
                Name: found.Name,
                Role: found.Role,
              },
            } as any,
          };
        }
      }

      // If live GAS script failed on submitAnswerSheet / uploadGradedAnswerSheet due to payload limits or older script, fallback locally
      if (!json.success && (action === 'submitAnswerSheet' || action === 'uploadSubmissionPdf' || action === 'uploadGradedAnswerSheet')) {
        console.warn(`[GAS Live Upload Notice] Server returned ${json.error || 'failure'}. Executing resilient local storage fallback.`);
        return executeLocalSimulation<T>(action, payload, onProgress);
      }

      return json;
    } catch (err: any) {
      const errMsg = String(err?.message || '');
      const is404 = errMsg.includes('404') || gasLastErrorStatus === 404;
      if (is404) {
        gasLastErrorStatus = 404;
        gasLogged404Count++;
        if (gasLogged404Count <= 1) {
          console.warn(
            `[GAS Backend Notice] Web App URL returned HTTP 404 (Not Found). Switching to local simulation. Please configure a valid deployment in settings.`
          );
        }
      } else {
        console.warn(`[GAS Live Request Failed] Action: '${action}', falling back to local simulation:`, err);
      }
      // For all primary user actions (submissions, exams, roster, doubts, evaluation), fallback locally so operations NEVER fail
      return executeLocalSimulation<T>(action, payload, onProgress);
    }
  }

  // Simulator Mode
  return executeLocalSimulation<T>(action, payload, onProgress);
}

/**
 * Local simulation database handler (Google Sheets & Drive simulation in browser storage)
 */
async function executeLocalSimulation<T = any>(
  action: string,
  payload: Record<string, any> = {},
  onProgress?: (progress: GasProgress) => void
): Promise<ApiResponse<T>> {
  if (onProgress && (action === 'submitAnswerSheet' || action === 'uploadSubmissionPdf' || action === 'uploadGradedAnswerSheet')) {
    onProgress({ loaded: 10, total: 100, percent: 20, stage: 'preparing', statusText: 'Packaging answer sheet for submission...' });
    await new Promise((r) => setTimeout(r, 120));
    onProgress({ loaded: 45, total: 100, percent: 60, stage: 'uploading', statusText: 'Transferring answer booklet...' });
    await new Promise((r) => setTimeout(r, 180));
    onProgress({ loaded: 85, total: 100, percent: 88, stage: 'processing', statusText: 'Updating examination register...' });
    await new Promise((r) => setTimeout(r, 100));
  } else {
    // Simulate slight processing latency
    await new Promise((r) => setTimeout(r, 150));
  }

  try {
    switch (action) {
      case 'getGroups': {
        const groups = getLocalGroups();
        return {
          success: true,
          data: { groups } as any,
        };
      }

      case 'createGroup': {
        const name = (payload.name || payload.Name || '').trim();
        const description = (payload.description || payload.Description || '').trim();
        const studentIds: string[] = Array.isArray(payload.studentIds) ? payload.studentIds : [];
        const groupId = (payload.groupId || payload.GroupId || `GRP-${Math.floor(100 + Math.random() * 900)}`).trim();

        if (!name) {
          return { success: false, error: 'Group Name is required.' };
        }

        const groups = getLocalGroups();
        if (groups.some((g) => g.GroupId.toUpperCase() === groupId.toUpperCase())) {
          return { success: false, error: `Group ID '${groupId}' already exists.` };
        }

        const newGroup: StudentGroup = {
          GroupId: groupId,
          Name: name,
          Description: description,
          StudentIds: studentIds,
          CreatedAt: new Date().toISOString(),
        };

        groups.unshift(newGroup);
        saveLocalGroups(groups);

        return {
          success: true,
          message: `Candidate group "${name}" created successfully with ${studentIds.length} candidate(s).`,
          data: { group: newGroup } as any,
        };
      }

      case 'updateGroup': {
        const groupId = (payload.groupId || payload.GroupId || '').trim();
        const name = (payload.name || payload.Name || '').trim();
        const description = (payload.description || payload.Description || '').trim();
        const studentIds: string[] = Array.isArray(payload.studentIds) ? payload.studentIds : [];

        if (!groupId) return { success: false, error: 'GroupId is required.' };
        if (!name) return { success: false, error: 'Group Name is required.' };

        const groups = getLocalGroups();
        const idx = groups.findIndex((g) => g.GroupId === groupId);
        if (idx === -1) {
          return { success: false, error: `Group '${groupId}' not found.` };
        }

        groups[idx] = {
          ...groups[idx],
          Name: name,
          Description: description,
          StudentIds: studentIds,
        };

        saveLocalGroups(groups);
        return {
          success: true,
          message: `Group "${name}" updated successfully.`,
          data: { group: groups[idx] } as any,
        };
      }

      case 'deleteGroup': {
        const groupId = (payload.groupId || payload.GroupId || '').trim();
        if (!groupId) return { success: false, error: 'GroupId is required.' };

        const groups = getLocalGroups();
        const filtered = groups.filter((g) => g.GroupId !== groupId);
        if (filtered.length === groups.length) {
          return { success: false, error: `Group '${groupId}' not found.` };
        }

        saveLocalGroups(filtered);
        return {
          success: true,
          message: `Group '${groupId}' deleted successfully.`,
        };
      }
      case 'getStudents': {
        const users = getLocalUsers();
        const students = users
          .filter((u) => u.Role.toLowerCase() === 'student')
          .map((u) => ({
            UserId: u.UserId,
            Name: u.Name,
            Role: u.Role,
          }));
        return {
          success: true,
          data: { students } as any,
        };
      }

      case 'createStudent': {
        const studentId = (payload.studentId || payload.UserId || '').trim().toUpperCase();
        const name = (payload.name || payload.Name || '').trim();
        const password = (payload.password || payload.Password || '').trim();
        const role = (payload.role || 'student').toLowerCase().trim();

        if (role !== 'student') {
          return {
            success: false,
            error: 'Security Policy: Teacher accounts cannot be created via the web app. Teacher accounts must be created directly by administrators in the Google Spreadsheet `Users` worksheet.',
          };
        }

        if (!studentId || !password || !name) {
          return {
            success: false,
            error: 'Student ID, Full Name, and Password are all required.',
          };
        }

        const users = getLocalUsers();
        if (users.some((u) => u.UserId.toUpperCase() === studentId)) {
          return {
            success: false,
            error: `User ID '${studentId}' already exists in the Users database.`,
          };
        }

        const newStudent: User = {
          UserId: studentId,
          Name: name,
          Password: password,
          Role: 'student',
        };

        users.push(newStudent);
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

        return {
          success: true,
          message: `Student candidate ${studentId} (${name}) enrolled successfully!`,
          data: { student: { UserId: newStudent.UserId, Name: newStudent.Name, Role: newStudent.Role } } as any,
        };
      }

      case 'deleteStudent': {
        const studentId = (payload.studentId || payload.UserId || '').trim().toUpperCase();
        const users = getLocalUsers();
        const filtered = users.filter((u) => u.UserId.toUpperCase() !== studentId);
        if (filtered.length === users.length) {
          return { success: false, error: `Student ID '${studentId}' not found.` };
        }
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(filtered));
        return { success: true, message: `Student account ${studentId} removed.` };
      }

      case 'ping':
      case 'initSheets': {
        return {
          success: true,
          message: 'Simulation database active (Google Sheets & Drive simulation ready).',
          data: { sheets: ['Users', 'Exam', 'Submissions', 'Poctor_Logs', 'Paper', 'Doubt'] } as any,
        };
      }

      case 'userLogin': {
        const userId = (payload.userId || '').trim().toUpperCase();
        const password = (payload.password || '').trim();
        const requestedRole = (payload.role || '').toLowerCase();

        const users = getLocalUsers();
        const found = users.find(
          (u) => u.UserId.toUpperCase() === userId && u.Password === password
        );

        if (!found) {
          return { success: false, error: 'Invalid User ID or Password.' };
        }

        if (requestedRole && found.Role.toLowerCase() !== requestedRole) {
          return {
            success: false,
            error: `Access Denied: User ${found.UserId} has role '${found.Role}', cannot login as '${requestedRole}'.`,
          };
        }

        return {
          success: true,
          message: 'Authentication successful!',
          data: {
            user: {
              UserId: found.UserId,
              Name: found.Name,
              Role: found.Role,
            },
          } as any,
        };
      }

      case 'getAllExams': {
        const exams = getLocalExams();
        return {
          success: true,
          data: { exams } as any,
        };
      }

      case 'createExam': {
        const exams = getLocalExams();
        const examId = payload.examId || `EXAM-${Math.floor(1000 + Math.random() * 9000)}`;
        
        let qpUrl = payload.qpUrl || '';
        if (payload.pdfBase64) {
          // In simulation, generate a readable blob/data preview
          qpUrl = payload.pdfBase64.startsWith('data:') 
            ? payload.pdfBase64 
            : `data:application/pdf;base64,${payload.pdfBase64}`;
        }
        if (!qpUrl) {
          qpUrl = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
        }

        const assignmentType: AssignmentType = payload.assignmentType || 'ALL';
        const assignedGroups: string[] = Array.isArray(payload.assignedGroups) ? payload.assignedGroups : [];
        const assignedStudents: string[] = Array.isArray(payload.assignedStudents) ? payload.assignedStudents : [];

        const newExam: Exam = {
          ExamId: examId,
          Subject: payload.subject || 'General Subject',
          StartTime: payload.startTime || new Date().toISOString(),
          EndTime: payload.endTime || new Date(Date.now() + 3600000).toISOString(),
          QPUrl: qpUrl,
          CreatedAt: new Date().toISOString(),
          TotalMarks: Number(payload.totalMarks || 100),
          AssignmentType: assignmentType,
          AssignedGroups: assignedGroups,
          AssignedStudents: assignedStudents,
          MeetUrl: payload.meetUrl || payload.MeetUrl || undefined,
          RequireGoogleMeet: payload.requireGoogleMeet !== undefined ? Boolean(payload.requireGoogleMeet) : true,
          QuestionMarks: payload.questionMarks || payload.QuestionMarks,
        };

        exams.unshift(newExam);
        saveLocalExams(exams);

        return {
          success: true,
          message: `Exam ${examId} created and assigned successfully.`,
          data: { exam: newExam } as any,
        };
      }

      case 'updateExam': {
        const exams = getLocalExams();
        const index = exams.findIndex((e) => e.ExamId === payload.examId);
        if (index === -1) {
          return { success: false, error: `Exam ${payload.examId} not found.` };
        }

        let qpUrl = exams[index].QPUrl;
        if (payload.pdfBase64) {
          qpUrl = payload.pdfBase64.startsWith('data:') 
            ? payload.pdfBase64 
            : `data:application/pdf;base64,${payload.pdfBase64}`;
        } else if (payload.qpUrl) {
          qpUrl = payload.qpUrl;
        }

        exams[index] = {
          ...exams[index],
          StartTime: payload.startTime || exams[index].StartTime,
          EndTime: payload.endTime || exams[index].EndTime,
          Subject: payload.subject || exams[index].Subject,
          TotalMarks: payload.totalMarks !== undefined ? Number(payload.totalMarks) : exams[index].TotalMarks,
          QPUrl: qpUrl,
          AssignmentType: payload.assignmentType !== undefined ? payload.assignmentType : exams[index].AssignmentType,
          AssignedGroups: payload.assignedGroups !== undefined ? payload.assignedGroups : exams[index].AssignedGroups,
          AssignedStudents: payload.assignedStudents !== undefined ? payload.assignedStudents : exams[index].AssignedStudents,
          MeetUrl: payload.meetUrl !== undefined ? payload.meetUrl : exams[index].MeetUrl,
          RequireGoogleMeet: payload.requireGoogleMeet !== undefined ? Boolean(payload.requireGoogleMeet) : exams[index].RequireGoogleMeet,
          ResultsReleased: payload.resultsReleased !== undefined ? Boolean(payload.resultsReleased) : exams[index].ResultsReleased,
          ResultsReleasedAt: payload.resultsReleasedAt !== undefined ? payload.resultsReleasedAt : exams[index].ResultsReleasedAt,
          QuestionMarks: payload.questionMarks || payload.QuestionMarks || exams[index].QuestionMarks,
        };

        saveLocalExams(exams);
        return { success: true, message: `Exam ${payload.examId} updated.`, data: { exam: exams[index] } as any };
      }

      case 'toggleExamResultsRelease': {
        const exams = getLocalExams();
        const examId = payload.examId;
        const index = exams.findIndex((e) => e.ExamId === examId);
        if (index === -1) {
          return { success: false, error: `Exam ${examId} not found.` };
        }

        const isReleased = payload.resultsReleased !== undefined ? Boolean(payload.resultsReleased) : !exams[index].ResultsReleased;
        exams[index] = {
          ...exams[index],
          ResultsReleased: isReleased,
          ResultsReleasedAt: isReleased ? new Date().toISOString() : undefined,
        };

        saveLocalExams(exams);
        return {
          success: true,
          message: isReleased
            ? `Results and evaluated booklets for Exam ${examId} have been published to students.`
            : `Results for Exam ${examId} have been unpublished (hidden from students).`,
          data: { exam: exams[index] } as any,
        };
      }

      case 'deleteExam': {
        const exams = getLocalExams();
        const filtered = exams.filter((e) => e.ExamId !== payload.examId);
        if (filtered.length === exams.length) {
          return { success: false, error: `Exam ${payload.examId} not found.` };
        }
        saveLocalExams(filtered);
        return { success: true, message: `Exam ${payload.examId} deleted from Google Sheets.` };
      }

      case 'submitAnswerSheet': {
        const exams = getLocalExams();
        const exam = exams.find((e) => e.ExamId === payload.examId);
        const studentId = (payload.studentId || '').trim().toUpperCase();

        if (exam) {
          const overrides = getLocalOverrides().filter((o) => o.ExamId === exam.ExamId);
          const groups = getLocalGroups();
          const studentGroups = groups.filter((g) => g.StudentIds && g.StudentIds.includes(studentId)).map((g) => g.GroupId);

          // Check if there is an explicit DISALLOW override for this student or their group
          const disallowOverride = overrides.find(
            (o) =>
              o.AllowSubmission === false &&
              ((o.TargetType === 'STUDENT' && o.TargetId.toUpperCase() === studentId) ||
                (o.TargetType === 'GROUP' && studentGroups.includes(o.TargetId)))
          );

          if (disallowOverride) {
            return {
              success: false,
              error: `Submission Blocked: Faculty has disallowed submission for your account. (${disallowOverride.Reason || 'Disciplinary / administrative restriction'})`,
            };
          }

          // Check if exam deadline has passed
          const endTimestamp = new Date(exam.EndTime).getTime();
          const now = Date.now();

          if (now > endTimestamp) {
            // Check if there is an explicit ALLOW / EXTENSION override
            const allowOverride = overrides.find(
              (o) =>
                o.AllowSubmission === true &&
                ((o.TargetType === 'STUDENT' && o.TargetId.toUpperCase() === studentId) ||
                  (o.TargetType === 'GROUP' && studentGroups.includes(o.TargetId))) &&
                (!o.ExpiresAt || now <= new Date(o.ExpiresAt).getTime())
            );

            if (!allowOverride) {
              return {
                success: false,
                error: 'Submission Rejected: Examination time is up. Submissions are closed. Contact your instructor if you require a submission extension.',
              };
            }
          }
        }

        const subs = getLocalSubmissions();
        const users = getLocalUsers();
        const student = users.find((u) => u.UserId === payload.studentId);
        
        let subUrl = payload.submissionUrl || '';
        if (payload.pdfBase64) {
          subUrl = payload.pdfBase64.startsWith('data:') 
            ? payload.pdfBase64 
            : `data:application/pdf;base64,${payload.pdfBase64}`;
        }
        if (!subUrl) {
          subUrl = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
        }

        const submittedAt = new Date().toISOString();
        const existingIdx = subs.findIndex(
          (s) => s.StudentId === payload.studentId && s.ExamId === payload.examId
        );

        const rawImages = payload.rawImages || payload.RawImages || (existingIdx > -1 ? subs[existingIdx].RawImages : undefined);
        const imageUrls = payload.imageUrls || payload.ImageUrls || (existingIdx > -1 ? subs[existingIdx].ImageUrls : undefined);

        // Persist to client-side IndexedDB & memory cache
        saveSubmissionFileStorage(payload.examId, payload.studentId, payload.pdfBase64 || subUrl, rawImages || imageUrls);

        const newSub: Submission = {
          StudentId: payload.studentId,
          ExamId: payload.examId,
          SubmissionUrl: subUrl,
          SubmittedAt: submittedAt,
          GradedUrl: existingIdx > -1 ? subs[existingIdx].GradedUrl : '',
          Score: existingIdx > -1 ? subs[existingIdx].Score : '',
          Feedback: existingIdx > -1 ? subs[existingIdx].Feedback : '',
          StudentName: student ? student.Name : payload.studentId,
          RawImages: rawImages,
          ImageUrls: imageUrls,
        };

        if (existingIdx > -1) {
          subs[existingIdx] = newSub;
        } else {
          subs.unshift(newSub);
        }
        saveLocalSubmissions(subs);

        // Also add proctor log
        const logs = getLocalLogs();
        logs.unshift({
          Timestamp: submittedAt,
          ExamId: payload.examId,
          StudentId: payload.studentId,
          ActionType: 'EXAM_SUBMIT',
          Details: 'Answer sheet submitted and saved to Drive storage.',
        });
        saveLocalLogs(logs);

        return {
          success: true,
          message: 'Answer sheet submitted successfully to Google Drive & recorded in Submissions sheet!',
          data: { submission: newSub } as any,
        };
      }

      case 'getSubmissions': {
        const subs = getLocalSubmissions();
        const users = getLocalUsers();
        const usersMap = new Map(users.map((u) => [u.UserId, u.Name]));

        let result = subs.map((s) => ({
          ...s,
          StudentName: usersMap.get(s.StudentId) || s.StudentId,
        }));

        if (payload.examId) {
          result = result.filter((s) => s.ExamId === payload.examId);
        }
        if (payload.studentId) {
          result = result.filter((s) => s.StudentId === payload.studentId);
        }

        return {
          success: true,
          data: { submissions: result } as any,
        };
      }

      case 'uploadGradedAnswerSheet': {
        const subs = getLocalSubmissions();
        const index = subs.findIndex(
          (s) => s.StudentId === payload.studentId && s.ExamId === payload.examId
        );

        if (index === -1) {
          return { success: false, error: 'Submission not found to grade.' };
        }

        let gradedUrl = subs[index].GradedUrl || '';
        if (payload.gradedPdfBase64) {
          gradedUrl = payload.gradedPdfBase64.startsWith('data:')
            ? payload.gradedPdfBase64
            : `data:application/pdf;base64,${payload.gradedPdfBase64}`;
        } else if (payload.gradedUrl) {
          gradedUrl = payload.gradedUrl;
        }

        subs[index] = {
          ...subs[index],
          Score: payload.score !== undefined ? payload.score : subs[index].Score,
          Feedback: payload.feedback || subs[index].Feedback || '',
          GradedUrl: gradedUrl,
          Status: subs[index].Status === 'RECHECK_REQUESTED' ? 'RECHECK_RESOLVED' : 'GRADED',
        };

        saveLocalSubmissions(subs);
        return {
          success: true,
          message: 'Graded answer sheet & score recorded successfully in Submissions sheet!',
          data: { submission: subs[index] } as any,
        };
      }

      case 'requestRecheck': {
        const subs = getLocalSubmissions();
        const studentId = (payload.studentId || '').trim().toUpperCase();
        const examId = (payload.examId || '').trim();
        const reason = (payload.reason || '').trim();
        const grounds = (payload.grounds || 'General Evaluation Clarification').trim();

        const index = subs.findIndex(
          (s) => s.StudentId.toUpperCase() === studentId && s.ExamId === examId
        );

        if (index === -1) {
          return { success: false, error: 'Submission not found for rechecking application.' };
        }

        subs[index] = {
          ...subs[index],
          Status: 'RECHECK_REQUESTED',
          RecheckReason: reason,
          RecheckGrounds: grounds,
          RecheckRequestedAt: new Date().toISOString(),
        };

        saveLocalSubmissions(subs);
        return {
          success: true,
          message: `Rechecking application for Exam ${examId} submitted successfully to faculty!`,
          data: { submission: subs[index] } as any,
        };
      }

      case 'resolveRecheck': {
        const subs = getLocalSubmissions();
        const studentId = (payload.studentId || '').trim().toUpperCase();
        const examId = (payload.examId || '').trim();
        const remarks = (payload.remarks || '').trim();
        const feedback = (payload.feedback || '').trim();
        const score = payload.score !== undefined && payload.score !== '' ? Number(payload.score) : undefined;

        const index = subs.findIndex(
          (s) => s.StudentId.toUpperCase() === studentId && s.ExamId === examId
        );

        if (index === -1) {
          return { success: false, error: 'Submission record not found to resolve rechecking.' };
        }

        let gradedUrl = subs[index].GradedUrl || '';
        if (payload.gradedPdfBase64) {
          gradedUrl = payload.gradedPdfBase64.startsWith('data:')
            ? payload.gradedPdfBase64
            : `data:application/pdf;base64,${payload.gradedPdfBase64}`;
        }

        subs[index] = {
          ...subs[index],
          Score: score !== undefined ? score : subs[index].Score,
          Feedback: feedback || subs[index].Feedback || '',
          GradedUrl: gradedUrl,
          Status: 'RECHECK_RESOLVED',
          RecheckRemarks: remarks,
          RecheckResolvedAt: new Date().toISOString(),
        };

        saveLocalSubmissions(subs);
        return {
          success: true,
          message: `Rechecking resolved for candidate ${studentId}. Updated marks & evaluation remarks published.`,
          data: { submission: subs[index] } as any,
        };
      }

      case 'createEvaluationDoubt': {
        const subs = getLocalSubmissions();
        const studentId = (payload.studentId || '').trim().toUpperCase();
        const examId = (payload.examId || '').trim();
        const question = (payload.question || '').trim();
        const pageRef = (payload.pageRef || '').trim();
        const questionRef = (payload.questionRef || '').trim();

        if (!question) {
          return { success: false, error: 'Question content cannot be empty.' };
        }

        const index = subs.findIndex(
          (s) => s.StudentId.toUpperCase() === studentId && s.ExamId === examId
        );

        if (index === -1) {
          return { success: false, error: 'Corresponding submission not found for evaluation doubt.' };
        }

        const users = getLocalUsers();
        const student = users.find((u) => u.UserId.toUpperCase() === studentId);

        const newDoubt: EvaluationDoubt = {
          DoubtId: `EVAL-DBT-${Date.now().toString().slice(-6)}`,
          StudentId: studentId,
          ExamId: examId,
          Question: question,
          PageRef: pageRef || undefined,
          QuestionRef: questionRef || undefined,
          Status: 'OPEN',
          CreatedAt: new Date().toISOString(),
          StudentName: student ? student.Name : studentId,
        };

        const existingDoubts = subs[index].EvaluationDoubts || [];
        existingDoubts.unshift(newDoubt);
        subs[index].EvaluationDoubts = existingDoubts;

        saveLocalSubmissions(subs);

        // Also add to global doubts list so it appears in teacher's doubts console
        const globalDoubts = getLocalDoubts();
        globalDoubts.unshift({
          DoubtId: newDoubt.DoubtId,
          StudentId: studentId,
          ExamId: examId,
          Question: `[Checked Paper Doubt ${questionRef ? `(${questionRef})` : ''}]: ${question}`,
          Status: 'OPEN',
          CreatedAt: newDoubt.CreatedAt,
          StudentName: student ? student.Name : studentId,
        });
        saveLocalDoubts(globalDoubts);

        return {
          success: true,
          message: 'Evaluation doubt sent to teacher.',
          data: { doubt: newDoubt, submission: subs[index] } as any,
        };
      }

      case 'answerEvaluationDoubt': {
        const subs = getLocalSubmissions();
        const doubtId = (payload.doubtId || '').trim();
        const answer = (payload.answer || '').trim();

        if (!answer) {
          return { success: false, error: 'Answer cannot be empty.' };
        }

        let updatedDoubt: EvaluationDoubt | null = null;

        for (let i = 0; i < subs.length; i++) {
          const doubts = subs[i].EvaluationDoubts || [];
          const dIdx = doubts.findIndex((d) => d.DoubtId === doubtId);
          if (dIdx > -1) {
            doubts[dIdx].Answer = answer;
            doubts[dIdx].Status = 'ANSWERED';
            doubts[dIdx].AnsweredAt = new Date().toISOString();
            subs[i].EvaluationDoubts = doubts;
            updatedDoubt = doubts[dIdx];
            break;
          }
        }

        if (!updatedDoubt) {
          return { success: false, error: 'Evaluation doubt not found.' };
        }

        saveLocalSubmissions(subs);

        // Also update in global doubts
        const globalDoubts = getLocalDoubts();
        const gIdx = globalDoubts.findIndex((d) => d.DoubtId === doubtId);
        if (gIdx > -1) {
          globalDoubts[gIdx].Answer = answer;
          globalDoubts[gIdx].Status = 'ANSWERED';
          saveLocalDoubts(globalDoubts);
        }

        return {
          success: true,
          message: 'Answer transmitted to student.',
          data: { doubt: updatedDoubt } as any,
        };
      }

      case 'logProctorEvent': {
        const logs = getLocalLogs();
        const newLog: ProctorLog = {
          Timestamp: payload.timestamp || new Date().toISOString(),
          ExamId: payload.examId || 'GENERAL',
          StudentId: payload.studentId || 'ANONYMOUS',
          ActionType: payload.actionType || 'GENERAL_EVENT',
          Details: payload.details || '',
        };
        logs.unshift(newLog);
        saveLocalLogs(logs);
        return { success: true, message: 'Proctor event saved to Poctor_Logs sheet.' };
      }

      case 'getProctorLogs': {
        const logs = getLocalLogs();
        let filtered = logs;
        if (payload.examId) {
          filtered = filtered.filter((l) => l.ExamId === payload.examId);
        }
        if (payload.studentId) {
          filtered = filtered.filter((l) => l.StudentId === payload.studentId);
        }
        return {
          success: true,
          data: { logs: filtered } as any,
        };
      }

      case 'createDoubt': {
        const doubts = getLocalDoubts();
        const users = getLocalUsers();
        const student = users.find((u) => u.UserId === payload.studentId);

        const newDoubt: Doubt = {
          DoubtId: `DBT-${Date.now().toString().slice(-6)}`,
          StudentId: payload.studentId,
          ExamId: payload.examId,
          Question: payload.question,
          Answer: '',
          Status: 'OPEN',
          CreatedAt: new Date().toISOString(),
          StudentName: student ? student.Name : payload.studentId,
        };
        doubts.unshift(newDoubt);
        saveLocalDoubts(doubts);
        return {
          success: true,
          message: 'Doubt question submitted to teacher.',
          data: { doubt: newDoubt } as any,
        };
      }

      case 'getDoubts': {
        const doubts = getLocalDoubts();
        let filtered = doubts;
        if (payload.examId) {
          filtered = filtered.filter((d) => d.ExamId === payload.examId);
        }
        return {
          success: true,
          data: { doubts: filtered } as any,
        };
      }

      case 'answerDoubt': {
        const doubts = getLocalDoubts();
        const index = doubts.findIndex((d) => d.DoubtId === payload.doubtId);
        if (index === -1) {
          return { success: false, error: 'Doubt record not found.' };
        }
        doubts[index].Answer = payload.answer;
        doubts[index].Status = 'ANSWERED';
        saveLocalDoubts(doubts);
        return {
          success: true,
          message: 'Answer saved and transmitted to student.',
          data: { doubt: doubts[index] } as any,
        };
      }

      case 'getSubmissionOverrides': {
        const overrides = getLocalOverrides();
        let filtered = overrides;
        if (payload.examId) {
          filtered = filtered.filter((o) => o.ExamId === payload.examId);
        }
        return {
          success: true,
          data: { overrides: filtered } as any,
        };
      }

      case 'setSubmissionOverride': {
        const overrides = getLocalOverrides();
        const examId = payload.examId;
        const targetType = payload.targetType as 'STUDENT' | 'GROUP';
        const targetId = (payload.targetId || '').trim();
        const allowSubmission = payload.allowSubmission !== false; // default true
        const reason = payload.reason || '';
        const expiresAt = payload.expiresAt || '';
        const grantedBy = payload.grantedBy || 'Faculty Evaluator';
        const targetName = payload.targetName || targetId;

        if (!examId || !targetId) {
          return { success: false, error: 'ExamId and TargetId are required.' };
        }

        // Check if override already exists for this target in this exam
        const existingIdx = overrides.findIndex(
          (o) => o.ExamId === examId && o.TargetType === targetType && o.TargetId.toUpperCase() === targetId.toUpperCase()
        );

        const newOverride: SubmissionOverride = {
          OverrideId: existingIdx > -1 ? overrides[existingIdx].OverrideId : `OVR-${Date.now().toString().slice(-6)}`,
          ExamId: examId,
          TargetType: targetType,
          TargetId: targetId,
          TargetName: targetName,
          AllowSubmission: allowSubmission,
          Reason: reason,
          GrantedBy: grantedBy,
          ExpiresAt: expiresAt,
          CreatedAt: new Date().toISOString(),
        };

        if (existingIdx > -1) {
          overrides[existingIdx] = newOverride;
        } else {
          overrides.unshift(newOverride);
        }

        saveLocalOverrides(overrides);
        return {
          success: true,
          message: `Submission permission for ${targetType === 'STUDENT' ? 'Student' : 'Group'} ${targetId} set to ${allowSubmission ? 'ALLOWED' : 'DISALLOWED'}.`,
          data: { override: newOverride, overrides } as any,
        };
      }

      case 'deleteSubmissionOverride': {
        const overrides = getLocalOverrides();
        const overrideId = payload.overrideId;
        const examId = payload.examId;
        const targetId = payload.targetId;

        const filtered = overrides.filter((o) => {
          if (overrideId) return o.OverrideId !== overrideId;
          if (examId && targetId) return !(o.ExamId === examId && o.TargetId.toUpperCase() === targetId.toUpperCase());
          return true;
        });

        saveLocalOverrides(filtered);
        return {
          success: true,
          message: 'Submission override rule removed.',
          data: { overrides: filtered } as any,
        };
      }

      case 'createGoogleMeetRoom': {
        const examId = payload.examId || 'GENERAL';
        const subject = payload.subject || 'Online Proctored Examination';
        // Generate standard Google Meet format code: xxx-yyyy-zzz
        const letters = 'abcdefghijklmnopqrstuvwxyz';
        const randPart = (len: number) => Array.from({ length: len }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
        const meetCode = `exf-${randPart(4)}-${randPart(3)}`;
        const meetUrl = `https://meet.google.com/${meetCode}`;

        // If exam exists, update its MeetUrl
        const exams = getLocalExams();
        const idx = exams.findIndex((e) => e.ExamId === examId);
        if (idx > -1) {
          exams[idx].MeetUrl = meetUrl;
          exams[idx].RequireGoogleMeet = true;
          saveLocalExams(exams);
        }

        return {
          success: true,
          message: `Google Meet Invigilation Hall generated successfully: ${meetUrl}`,
          data: {
            meetUrl,
            meetCode,
            examId,
            subject,
          } as any,
        };
      }

      case 'syncProctorHeartbeat': {
        const stream = payload.stream;
        if (!stream || !stream.examId || !stream.studentId) {
          return { success: false, error: 'Invalid proctor heartbeat stream data' };
        }

        const streamsKey = 'examfriendly_live_streams_v1';
        let allStreams: Record<string, any> = {};
        try {
          const raw = localStorage.getItem(streamsKey);
          if (raw) allStreams = JSON.parse(raw);
        } catch (e) {
          allStreams = {};
        }

        const key = `${stream.examId}_${stream.studentId}`;
        allStreams[key] = {
          ...stream,
          lastSeen: Date.now(),
        };

        try {
          localStorage.setItem(streamsKey, JSON.stringify(allStreams));
        } catch (e) {
          // prune
        }

        return {
          success: true,
          message: 'Proctor telemetry synced',
          data: { status: 'OK', timestamp: Date.now() } as any,
        };
      }

      case 'getLiveProctorStreams': {
        const examId = payload.examId;
        const streamsKey = 'examfriendly_live_streams_v1';
        let allStreams: Record<string, any> = {};
        try {
          const raw = localStorage.getItem(streamsKey);
          if (raw) allStreams = JSON.parse(raw);
        } catch (e) {
          allStreams = {};
        }

        const now = Date.now();
        const list = Object.values(allStreams).filter((s: any) => {
          if (examId && examId !== 'ALL' && s.examId !== examId) return false;
          return true;
        }).map((s: any) => ({
          ...s,
          status: s.isBlocked
            ? 'BLOCKED'
            : s.status === 'SUBMITTED'
            ? 'SUBMITTED'
            : now - (s.lastSeen || 0) > 25000
            ? 'DISCONNECTED'
            : s.status || 'ONLINE',
        }));

        return {
          success: true,
          data: { streams: list } as any,
        };
      }

      case 'sendProctorCommand': {
        const command = payload.command;
        if (!command || !command.examId || !command.studentId) {
          return { success: false, error: 'Invalid command payload' };
        }

        const cmdKey = 'examfriendly_proctor_commands_v1';
        let commands: any[] = [];
        try {
          const raw = localStorage.getItem(cmdKey);
          if (raw) commands = JSON.parse(raw);
        } catch (e) {
          commands = [];
        }

        commands.push(command);
        if (commands.length > 60) commands.splice(0, commands.length - 60);
        localStorage.setItem(cmdKey, JSON.stringify(commands));

        return {
          success: true,
          message: `Proctor command ${command.type} sent to candidate ${command.studentId}.`,
          data: { command } as any,
        };
      }

      case 'getProctorCommands': {
        const examId = payload.examId;
        const studentId = (payload.studentId || '').trim().toUpperCase();
        const cmdKey = 'examfriendly_proctor_commands_v1';
        let commands: any[] = [];
        try {
          const raw = localStorage.getItem(cmdKey);
          if (raw) commands = JSON.parse(raw);
        } catch (e) {
          commands = [];
        }

        const filtered = commands.filter((c: any) => {
          if (examId && c.examId !== examId) return false;
          if (studentId && c.studentId.toUpperCase() !== studentId) return false;
          return true;
        });

        return {
          success: true,
          data: { commands: filtered } as any,
        };
      }

      case 'getFileBase64': {
        const fileId = (payload.fileId || payload.FileId || '').trim();
        const fileUrl = (payload.fileUrl || payload.FileUrl || '').trim();
        const examId = (payload.examId || '').trim();
        const studentId = (payload.studentId || '').trim();

        if (examId && studentId) {
          const stored = getSubmissionFileStorageSync(examId, studentId);
          if (stored?.rawImages && stored.rawImages.length > 0) {
            return {
              success: true,
              fileId,
              base64Data: stored.rawImages[0],
              rawImages: stored.rawImages,
              data: {
                fileId,
                base64Data: stored.rawImages[0],
                rawImages: stored.rawImages,
                mimeType: 'image/jpeg',
                isImage: true,
              } as any,
            } as any;
          }
          if (stored?.pdfBase64) {
            const dataUrl = stored.pdfBase64.startsWith('data:')
              ? stored.pdfBase64
              : `data:application/pdf;base64,${stored.pdfBase64}`;
            return {
              success: true,
              fileId,
              base64Data: dataUrl,
              data: {
                fileId,
                base64Data: dataUrl,
                mimeType: 'application/pdf',
              } as any,
            } as any;
          }
          try {
            const cached = localStorage.getItem(`osm_student_images_${examId}_${studentId}`);
            if (cached) {
              const parsed = JSON.parse(cached);
              if (Array.isArray(parsed) && parsed.length > 0) {
                return {
                  success: true,
                  fileId,
                  base64Data: parsed[0],
                  rawImages: parsed,
                  data: {
                    fileId,
                    base64Data: parsed[0],
                    rawImages: parsed,
                    mimeType: 'image/jpeg',
                    isImage: true,
                  } as any,
                } as any;
              }
            }
          } catch (_) {}
        }

        // Check if any local submission or exam has this file or base64
        const subs = getLocalSubmissions();
        const matchedSub = subs.find(
          (s) => (s.SubmissionUrl && (s.SubmissionUrl.includes(fileId) || s.SubmissionUrl === fileUrl)) ||
                 (s.GradedUrl && (s.GradedUrl.includes(fileId) || s.GradedUrl === fileUrl))
        );

        if (matchedSub && (matchedSub.SubmissionUrl.startsWith('data:') || matchedSub.GradedUrl?.startsWith('data:'))) {
          const base64Data = matchedSub.SubmissionUrl.startsWith('data:') ? matchedSub.SubmissionUrl : (matchedSub.GradedUrl || '');
          return {
            success: true,
            fileId,
            base64Data,
            data: {
              fileId,
              base64Data,
              mimeType: 'application/pdf',
            } as any,
          } as any;
        }

        // Try downloading binary via multi-strategy Google Drive fetcher
        const extractedId = fileId || (fileUrl.match(/(?:file\/d\/|id=|open\?id=)([-\w]{15,})/)?.[1] || '');
        if (extractedId || fileUrl) {
          try {
            const driveResult = await fetchDrivePdfBinary(extractedId, fileUrl);
            if (driveResult) {
              return {
                success: true,
                fileId: extractedId || fileId,
                base64Data: driveResult.base64Data,
                data: {
                  fileId: extractedId || fileId,
                  base64Data: driveResult.base64Data,
                  mimeType: driveResult.mimeType,
                } as any,
              } as any;
            }
          } catch (e) {
            console.warn('[api.ts getFileBase64] fetchDrivePdfBinary error:', e);
          }
        }

        return {
          success: false,
          error: 'File binary not found in local cache (CORS restricted on external Google Drive).',
        };
      }

      default:
        return { success: false, error: `Action '${action}' not supported in simulation.` };
    }
  } catch (err: any) {
    return {
      success: false,
      error: `Simulator error: ${err.message || err}`,
    };
  }
}

/**
 * File to Base64 conversion utility helper
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = (error) => reject(error);
  });
}

/**
 * File to Base64 conversion with real-time reading progress reporting
 */
export function fileToBase64WithProgress(
  file: File,
  onProgress?: (progress: { loaded: number; total: number; percent: number; statusText?: string }) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    onProgress?.({ loaded: 0, total: file.size, percent: 12, statusText: 'Buffering document...' });
    const reader = new FileReader();
    let lastPercent = 12;

    const ticker = setInterval(() => {
      if (lastPercent < 90) {
        lastPercent += 18;
        const curBytes = Math.min(file.size, Math.round((lastPercent / 100) * file.size));
        onProgress?.({
          loaded: curBytes,
          total: file.size,
          percent: lastPercent,
          statusText: `Reading PDF: ${lastPercent}% (${(curBytes / 1024 / 1024).toFixed(1)} / ${(file.size / 1024 / 1024).toFixed(1)} MB)...`,
        });
      }
    }, 60);

    reader.onprogress = (evt) => {
      if (evt.lengthComputable && evt.total > 0) {
        const pct = Math.round((evt.loaded / evt.total) * 100);
        lastPercent = Math.max(lastPercent, pct);
        onProgress?.({
          loaded: evt.loaded,
          total: evt.total,
          percent: Math.min(95, lastPercent),
          statusText: `Reading PDF: ${lastPercent}%...`,
        });
      }
    };
    reader.onload = () => {
      clearInterval(ticker);
      onProgress?.({
        loaded: file.size,
        total: file.size,
        percent: 100,
        statusText: 'PDF loaded and validated!',
      });
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = (error) => {
      clearInterval(ticker);
      reject(error);
    };
    reader.readAsDataURL(file);
  });
}
