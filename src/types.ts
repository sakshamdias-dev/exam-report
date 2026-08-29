export type Role = 'student' | 'teacher';

export interface User {
  UserId: string;
  Password?: string;
  Role: Role;
  Name: string;
}

export interface StudentGroup {
  GroupId: string;
  Name: string;
  Description?: string;
  StudentIds: string[]; // List of candidate UserIds (Roll numbers)
  CreatedAt: string;
}

export type AssignmentType = 'ALL' | 'GROUPS' | 'STUDENTS';

export interface Exam {
  ExamId: string;
  StartTime: string; // ISO string or YYYY-MM-DDTHH:mm
  EndTime: string;   // ISO string or YYYY-MM-DDTHH:mm
  QPUrl: string;     // Google Drive link or base64/blob
  CreatedAt: string;
  Subject?: string;
  TotalMarks?: number;
  AssignmentType?: AssignmentType; // 'ALL' | 'GROUPS' | 'STUDENTS'
  AssignedGroups?: string[];       // Array of GroupIds
  AssignedStudents?: string[];     // Array of StudentIds (UserIds)
}

export interface Paper {
  PaperId: string;
  ExamId: string;
  Subject: string;
  TotalMarks: number;
  FileUrl: string;
}

export interface Submission {
  StudentId: string;
  ExamId: string;
  SubmissionUrl: string;
  SubmittedAt: string;
  GradedUrl?: string;
  Score?: number | string;
  Feedback?: string;
  StudentName?: string;
}

export interface ProctorLog {
  Timestamp: string;
  ExamId: string;
  StudentId: string;
  ActionType: 'TAB_SWITCH' | 'WINDOW_BLUR' | 'FULLSCREEN_EXIT' | 'COPY_PASTE_ATTEMPT' | 'DEVTOOLS_OPEN' | 'WEBCAM_LOST' | 'EXAM_START' | 'EXAM_SUBMIT';
  Details: string;
}

export interface Doubt {
  DoubtId: string;
  StudentId: string;
  ExamId: string;
  Question: string;
  Answer?: string;
  Status: 'OPEN' | 'ANSWERED';
  CreatedAt: string;
  StudentName?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface GasConnectionConfig {
  webAppUrl: string;
  mode: 'live' | 'simulator';
  lastTested?: string;
  status: 'connected' | 'error' | 'untested' | 'simulated';
}
