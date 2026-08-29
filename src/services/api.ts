import { ApiResponse, Exam, ProctorLog, Role, Submission, User, Doubt, StudentGroup, AssignmentType } from '../types';

const STORAGE_KEYS = {
  GAS_CONFIG: 'exam_portal_gas_config',
  USERS: 'exam_portal_users',
  EXAMS: 'exam_portal_exams',
  SUBMISSIONS: 'exam_portal_submissions',
  LOGS: 'exam_portal_logs',
  DOUBTS: 'exam_portal_doubts',
  GROUPS: 'exam_portal_groups',
};

// Default Initial Seed Data matching Google Sheets Schema
const DEFAULT_USERS: User[] = [
  { UserId: 'TCH-801', Password: 'admin123', Role: 'teacher', Name: 'Head Teacher - Dr. Evelyn Vance' },
  { UserId: 'STU-101', Password: 'pass123', Role: 'student', Name: 'Demo Student - Alex Morgan' },
  { UserId: 'STU-102', Password: 'pass123', Role: 'student', Name: 'Student - Priya Sharma' },
];

const DEFAULT_GROUPS: StudentGroup[] = [
  {
    GroupId: 'GRP-B1',
    Name: 'Batch A - Morning Section',
    Description: 'Undergraduate candidates enrolled in Morning Lecture Schedule',
    StudentIds: ['STU-101', 'STU-102'],
    CreatedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    GroupId: 'GRP-B2',
    Name: 'Batch B - Honors Lab Group',
    Description: 'Honors candidates for specialized laboratory practical assessments',
    StudentIds: ['STU-101'],
    CreatedAt: new Date(Date.now() - 86400000 * 4).toISOString(),
  },
];

const DEFAULT_EXAMS: Exam[] = [
  {
    ExamId: 'EXAM-CS301',
    Subject: 'Advanced Data Structures & Algorithms',
    StartTime: new Date(Date.now() - 30 * 60000).toISOString(), // Started 30 mins ago
    EndTime: new Date(Date.now() + 90 * 60000).toISOString(),   // Ends in 90 mins
    QPUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    CreatedAt: new Date(Date.now() - 86400000).toISOString(),
    TotalMarks: 100,
    AssignmentType: 'ALL',
    AssignedGroups: [],
    AssignedStudents: [],
  },
  {
    ExamId: 'EXAM-MATH204',
    Subject: 'Multivariable Calculus & Differential Equations',
    StartTime: new Date(Date.now() + 120 * 60000).toISOString(), // Upcoming in 2 hours
    EndTime: new Date(Date.now() + 240 * 60000).toISOString(),
    QPUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    CreatedAt: new Date(Date.now() - 43200000).toISOString(),
    TotalMarks: 80,
    AssignmentType: 'GROUPS',
    AssignedGroups: ['GRP-B1'],
    AssignedStudents: [],
  },
  {
    ExamId: 'EXAM-PHY101',
    Subject: 'Classical Mechanics & Wave Dynamics',
    StartTime: new Date(Date.now() - 86400000 * 2).toISOString(), // Completed 2 days ago
    EndTime: new Date(Date.now() - 86400000 * 2 + 7200000).toISOString(),
    QPUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    CreatedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    TotalMarks: 75,
    AssignmentType: 'STUDENTS',
    AssignedGroups: [],
    AssignedStudents: ['STU-101', 'STU-102'],
  }
];

const DEFAULT_SUBMISSIONS: Submission[] = [
  {
    StudentId: 'STU-101',
    ExamId: 'EXAM-PHY101',
    SubmissionUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    SubmittedAt: new Date(Date.now() - 86400000 * 2 + 5400000).toISOString(),
    GradedUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    Score: 71,
    Feedback: 'Excellent derivation of harmonic oscillator equations. Minor algebra error in Q3.',
    StudentName: 'Demo Student - Alex Morgan'
  },
  {
    StudentId: 'STU-102',
    ExamId: 'EXAM-PHY101',
    SubmissionUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    SubmittedAt: new Date(Date.now() - 86400000 * 2 + 6000000).toISOString(),
    GradedUrl: '',
    Score: '',
    StudentName: 'Student - Priya Sharma'
  }
];

const DEFAULT_LOGS: ProctorLog[] = [
  {
    Timestamp: new Date(Date.now() - 25 * 60000).toISOString(),
    ExamId: 'EXAM-CS301',
    StudentId: 'STU-101',
    ActionType: 'EXAM_START',
    Details: 'Candidate entered examination room and agreed to proctoring policy.'
  },
  {
    Timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
    ExamId: 'EXAM-CS301',
    StudentId: 'STU-101',
    ActionType: 'WINDOW_BLUR',
    Details: 'Candidate switched focus away from active exam window for 3.2 seconds.'
  }
];

const DEFAULT_DOUBTS: Doubt[] = [
  {
    DoubtId: 'DBT-001',
    StudentId: 'STU-101',
    ExamId: 'EXAM-CS301',
    Question: 'Is memory complexity expected in Big-O notation for Question 2(b)?',
    Answer: 'Yes, please state both Time and Auxiliary Space Complexity.',
    Status: 'ANSWERED',
    CreatedAt: new Date(Date.now() - 18 * 60000).toISOString(),
    StudentName: 'Demo Student - Alex Morgan'
  }
];

const DEFAULT_WEB_APP_URL =
  'https://script.google.com/macros/s/AKfycbwZKmWoH1nkmzpix51IoEoM8YS3WN0Mey6PYyXZMKyURrjgEESrsSErfX2E_JfdNc8gaw/exec';

// Helper to get configuration
export function getGasConfig(): { webAppUrl: string; mode: 'live' | 'simulator' } {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.GAS_CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        webAppUrl: parsed.webAppUrl || DEFAULT_WEB_APP_URL,
        mode: parsed.mode || 'live',
      };
    }
  } catch (e) {
    console.error(e);
  }
  return { webAppUrl: DEFAULT_WEB_APP_URL, mode: 'live' };
}

export function saveGasConfig(config: { webAppUrl: string; mode: 'live' | 'simulator' }) {
  localStorage.setItem(STORAGE_KEYS.GAS_CONFIG, JSON.stringify(config));
}

// Storage Helpers for Local Simulator
function getLocalUsers(): User[] {
  const data = localStorage.getItem(STORAGE_KEYS.USERS);
  if (!data) {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(DEFAULT_USERS));
    return DEFAULT_USERS;
  }
  return JSON.parse(data);
}

function getLocalExams(): Exam[] {
  const data = localStorage.getItem(STORAGE_KEYS.EXAMS);
  if (!data) {
    localStorage.setItem(STORAGE_KEYS.EXAMS, JSON.stringify(DEFAULT_EXAMS));
    return DEFAULT_EXAMS;
  }
  return JSON.parse(data);
}

function saveLocalExams(exams: Exam[]) {
  localStorage.setItem(STORAGE_KEYS.EXAMS, JSON.stringify(exams));
}

function getLocalSubmissions(): Submission[] {
  const data = localStorage.getItem(STORAGE_KEYS.SUBMISSIONS);
  if (!data) {
    localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(DEFAULT_SUBMISSIONS));
    return DEFAULT_SUBMISSIONS;
  }
  return JSON.parse(data);
}

function saveLocalSubmissions(subs: Submission[]) {
  localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(subs));
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
    localStorage.setItem(STORAGE_KEYS.DOUBTS, JSON.stringify(DEFAULT_DOUBTS));
    return DEFAULT_DOUBTS;
  }
  return JSON.parse(data);
}

function saveLocalDoubts(doubts: Doubt[]) {
  localStorage.setItem(STORAGE_KEYS.DOUBTS, JSON.stringify(doubts));
}

function getLocalGroups(): StudentGroup[] {
  const data = localStorage.getItem(STORAGE_KEYS.GROUPS);
  if (!data) {
    localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(DEFAULT_GROUPS));
    return DEFAULT_GROUPS;
  }
  return JSON.parse(data);
}

function saveLocalGroups(groups: StudentGroup[]) {
  localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(groups));
}

/**
 * Universal dispatcher: sends request to live Google Apps Script Web App or handles in Simulator
 */
export async function executeGasAction<T = any>(action: string, payload: Record<string, any> = {}): Promise<ApiResponse<T>> {
  const config = getGasConfig();
  const fullPayload = { action, ...payload };

  // If live mode and valid Web App URL provided
  if (config.mode === 'live' && config.webAppUrl && config.webAppUrl.trim().startsWith('http')) {
    try {
      // Use text/plain POST to avoid CORS preflight OPTIONS request that Google Apps Script does not support
      const response = await fetch(config.webAppUrl.trim(), {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(fullPayload),
      });

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();

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
        }
        return json;
      }

      // If the deployed Apps Script returned "Unknown action requested" (e.g. older deployment without createStudent or getGroups)
      const errorMsg = String(json?.error || '').toLowerCase();
      if (errorMsg.includes('unknown action') || errorMsg.includes('not supported') || errorMsg.includes('unknown endpoint')) {
        console.warn(`[GAS Backend Notice] Action '${action}' is not in deployed Apps Script version. Executing local ERP register fallback.`);
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

      return json;
    } catch (err: any) {
      console.warn(`[GAS Live Request Failed] falling back to local simulation:`, err);
      // For student roster actions and groups, if network fails, execute locally so workflows are not blocked
      if (
        action === 'getStudents' ||
        action === 'createStudent' ||
        action === 'deleteStudent' ||
        action === 'userLogin' ||
        action === 'getGroups' ||
        action === 'createGroup' ||
        action === 'updateGroup' ||
        action === 'deleteGroup'
      ) {
        return executeLocalSimulation<T>(action, payload);
      }
      return {
        success: false,
        error: `Could not connect to Google Apps Script Web App: ${err.message || err}. (Tip: verify that Apps Script deployment 'Who has access' is set to 'Anyone').`,
      };
    }
  }

  // Simulator Mode
  return executeLocalSimulation<T>(action, payload);
}

/**
 * Local simulation database handler (Google Sheets & Drive simulation in browser storage)
 */
async function executeLocalSimulation<T = any>(action: string, payload: Record<string, any> = {}): Promise<ApiResponse<T>> {
  // Simulate slight processing latency
  await new Promise((r) => setTimeout(r, 200));

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
        };

        saveLocalExams(exams);
        return { success: true, message: `Exam ${payload.examId} updated.` };
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

        const newSub: Submission = {
          StudentId: payload.studentId,
          ExamId: payload.examId,
          SubmissionUrl: subUrl,
          SubmittedAt: submittedAt,
          GradedUrl: existingIdx > -1 ? subs[existingIdx].GradedUrl : '',
          Score: existingIdx > -1 ? subs[existingIdx].Score : '',
          Feedback: existingIdx > -1 ? subs[existingIdx].Feedback : '',
          StudentName: student ? student.Name : payload.studentId,
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
        };

        saveLocalSubmissions(subs);
        return {
          success: true,
          message: 'Graded answer sheet & score recorded successfully in Submissions sheet!',
          data: { submission: subs[index] } as any,
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
