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

export interface SubmissionOverride {
  OverrideId: string;
  ExamId: string;
  TargetType: 'STUDENT' | 'GROUP';
  TargetId: string; // StudentId or GroupId
  TargetName?: string;
  AllowSubmission: boolean; // true = allow/extend submission, false = disallow/block submission
  Reason?: string;
  GrantedBy?: string;
  ExpiresAt?: string; // Optional custom extended deadline ISO string
  CreatedAt: string;
}

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
  AllowLateSubmissions?: boolean;
  SubmissionOverrides?: SubmissionOverride[];
  MeetUrl?: string;                // Google Meet invigilation room URL
  RequireGoogleMeet?: boolean;     // Whether candidate must connect to Google Meet
  ResultsReleased?: boolean;       // Whether grades & checked PDFs are released/published to students
  ResultsReleasedAt?: string;
}

export interface Paper {
  PaperId: string;
  ExamId: string;
  Subject: string;
  TotalMarks: number;
  FileUrl: string;
}

export interface EvaluationDoubt {
  DoubtId: string;
  StudentId: string;
  ExamId: string;
  Question: string;
  Answer?: string;
  Status: 'OPEN' | 'ANSWERED';
  CreatedAt: string;
  AnsweredAt?: string;
  PageRef?: string;
  QuestionRef?: string;
  StudentName?: string;
}

export interface Submission {
  StudentId: string;
  ExamId: string;
  SubmissionUrl: string;
  SubmittedAt: string;
  GradedUrl?: string; // Checked PDF booklet url or data URI
  Score?: number | string;
  Feedback?: string;
  StudentName?: string;
  Status?: 'SUBMITTED' | 'GRADED' | 'RECHECK_REQUESTED' | 'RECHECK_RESOLVED';
  RecheckReason?: string;
  RecheckGrounds?: string;
  RecheckRequestedAt?: string;
  RecheckRemarks?: string;
  RecheckResolvedAt?: string;
  EvaluationDoubts?: EvaluationDoubt[];
  CheckedAt?: string;
  EvaluatorId?: string;
  QuestionScores?: Record<string, number>;
  OsmDraftData?: string; // Serialized OSM annotations draft
  RawImages?: string[]; // Direct list of page image data URIs (converted from student photos)
  ImageUrls?: string[]; // Direct list of page image URLs
}

export interface LiveProctorStream {
  studentId: string;
  studentName: string;
  examId: string;
  cameraFrame?: string; // base64 jpeg snapshot
  screenFrame?: string; // base64 jpeg snapshot
  audioLevel: number;   // 0 - 100%
  deviceType: 'DESKTOP' | 'MOBILE' | 'TABLET';
  isMobile: boolean;
  isScreenSharing: boolean;
  isCameraActive: boolean;
  isMicActive: boolean;
  isBlocked: boolean;
  blockedReason?: string;
  blockedAt?: string;
  warningCount: number;
  lastSeen: number;     // epoch ms
  status: 'ONLINE' | 'AWAY' | 'DISCONNECTED' | 'BLOCKED' | 'SUBMITTED';
  activeWarning?: string;
  violationsList?: { timestamp: string; action: string; details: string }[];
  meetJoined?: boolean;
  meetUrl?: string;
}

export interface ProctorCommand {
  commandId: string;
  type: 'BLOCK' | 'UNBLOCK' | 'WARN';
  examId: string;
  studentId: string;
  reason?: string;
  warningText?: string;
  timestamp: string;
}

export interface ProctorLog {
  Timestamp: string;
  ExamId: string;
  StudentId: string;
  ActionType: 'TAB_SWITCH' | 'WINDOW_BLUR' | 'FULLSCREEN_EXIT' | 'COPY_PASTE_ATTEMPT' | 'DEVTOOLS_OPEN' | 'WEBCAM_LOST' | 'SCREENSHARE_STOPPED' | 'BLOCKED_BY_TEACHER' | 'UNBLOCKED_BY_TEACHER' | 'WARNING_ISSUED' | 'EXAM_START' | 'EXAM_SUBMIT';
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
