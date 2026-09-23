import { getSupabaseClient } from './supabaseClient';
import {
  User,
  Exam,
  StudentGroup,
  Submission,
  Doubt,
  ProctorLog,
  SubmissionOverride,
  EvaluationDoubt,
} from '../types';

/**
 * Maps Supabase exams row to the Exam frontend interface
 */
export function mapExamRow(row: any): Exam {
  return {
    ExamId: row.exam_id,
    Subject: row.subject || 'General Examination',
    TotalMarks: Number(row.total_marks) || 100,
    StartTime: row.start_time,
    EndTime: row.end_time,
    QPUrl: row.qp_url || '',
    AssignmentType: row.assignment_type || 'ALL',
    AssignedGroups: Array.isArray(row.assigned_groups) ? row.assigned_groups : [],
    AssignedStudents: Array.isArray(row.assigned_students) ? row.assigned_students : [],
    AllowLateSubmissions: row.allow_late_submissions ?? true,
    SubmissionOverrides: Array.isArray(row.submission_overrides) ? row.submission_overrides : [],
    MeetUrl: row.meet_url || '',
    RequireGoogleMeet: Boolean(row.require_google_meet),
    ResultsReleased: Boolean(row.results_released),
    ResultsReleasedAt: row.results_released_at || undefined,
    QuestionMarks: Array.isArray(row.question_marks) ? row.question_marks : undefined,
    CreatedAt: row.created_at || new Date().toISOString(),
  };
}

/**
 * Maps Supabase submissions row to the Submission frontend interface
 */
export function mapSubmissionRow(row: any): Submission {
  return {
    StudentId: row.student_id,
    ExamId: row.exam_id,
    SubmissionUrl: row.submission_url || '',
    SubmittedAt: row.submitted_at,
    GradedUrl: row.graded_url || '',
    Score: row.score !== null && row.score !== undefined ? Number(row.score) : '',
    Feedback: row.feedback || '',
    StudentName: row.student_name || row.student_id,
    Status: row.status || 'SUBMITTED',
    RecheckReason: row.recheck_reason || '',
    RecheckGrounds: row.recheck_grounds || '',
    RecheckRequestedAt: row.recheck_requested_at || undefined,
    RecheckRemarks: row.recheck_remarks || '',
    RecheckResolvedAt: row.recheck_resolved_at || undefined,
    QuestionScores: row.question_scores || {},
    OsmDraftData: row.osm_draft_data || '',
    CheckedAt: row.checked_at || undefined,
    EvaluatorId: row.evaluator_id || undefined,
  };
}

/**
 * Maps Supabase student_groups row to StudentGroup frontend interface
 */
export function mapGroupRow(row: any): StudentGroup {
  return {
    GroupId: row.group_id,
    Name: row.name,
    Description: row.description || '',
    StudentIds: Array.isArray(row.student_ids) ? row.student_ids : [],
    CreatedAt: row.created_at || new Date().toISOString(),
  };
}

/**
 * Maps Supabase doubts row to Doubt interface
 */
export function mapDoubtRow(row: any): Doubt {
  return {
    DoubtId: row.doubt_id,
    StudentId: row.student_id,
    ExamId: row.exam_id,
    Question: row.question,
    Answer: row.answer || '',
    Status: row.status || 'OPEN',
    CreatedAt: row.created_at || new Date().toISOString(),
    StudentName: row.student_name || row.student_id,
  };
}

// ----------------------------------------------------------------------------
// USER AUTHENTICATION & STUDENT MANAGEMENT
// ----------------------------------------------------------------------------

export async function supabaseUserLogin(
  userId: string,
  password?: string,
  role?: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client not initialized' };

  try {
    const trimmedId = userId.trim();
    let query = client
      .from('users')
      .select('*')
      .ilike('user_id', trimmedId);

    if (role) {
      query = query.eq('role', role.toLowerCase());
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: 'User record not found in Supabase database.' };
    }

    // Check password if configured
    if (data.password && password && data.password.trim() !== password.trim()) {
      return { success: false, error: 'Invalid password. Please check your credentials.' };
    }

    return {
      success: true,
      user: {
        UserId: data.user_id,
        Name: data.name,
        Role: data.role,
        Password: data.password,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Login failed in Supabase' };
  }
}

export async function supabaseGetStudents(): Promise<{ success: boolean; students?: User[]; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client not initialized' };

  try {
    const { data, error } = await client
      .from('users')
      .select('user_id, name, role, password')
      .eq('role', 'student')
      .order('user_id', { ascending: true });

    if (error) return { success: false, error: error.message };

    const students: User[] = (data || []).map((row) => ({
      UserId: row.user_id,
      Name: row.name,
      Role: 'student',
      Password: row.password,
    }));

    return { success: true, students };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function supabaseCreateStudent(
  studentId: string,
  name: string,
  password?: string
): Promise<{ success: boolean; student?: User; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client not initialized' };

  try {
    const id = studentId.trim().toUpperCase();
    const payload = {
      user_id: id,
      name: name.trim(),
      password: (password || 'student123').trim(),
      role: 'student',
    };

    const { data, error } = await client
      .from('users')
      .upsert(payload, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    return {
      success: true,
      student: {
        UserId: data.user_id,
        Name: data.name,
        Role: 'student',
        Password: data.password,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function supabaseDeleteStudent(studentId: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client not initialized' };

  try {
    const { error } = await client
      .from('users')
      .delete()
      .eq('user_id', studentId.trim().toUpperCase());

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ----------------------------------------------------------------------------
// STUDENT GROUPS MANAGEMENT
// ----------------------------------------------------------------------------

export async function supabaseGetGroups(): Promise<{ success: boolean; groups?: StudentGroup[]; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client not initialized' };

  try {
    const { data, error } = await client
      .from('student_groups')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return { success: false, error: error.message };
    return { success: true, groups: (data || []).map(mapGroupRow) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function supabaseCreateGroup(
  group: Partial<StudentGroup>
): Promise<{ success: boolean; group?: StudentGroup; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client not initialized' };

  try {
    const groupId = group.GroupId || `GRP-${Date.now().toString(36).toUpperCase()}`;
    const payload = {
      group_id: groupId,
      name: group.Name || 'New Group',
      description: group.Description || '',
      student_ids: group.StudentIds || [],
      created_at: new Date().toISOString(),
    };

    const { data, error } = await client
      .from('student_groups')
      .insert(payload)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, group: mapGroupRow(data) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function supabaseUpdateGroup(
  group: Partial<StudentGroup> & { GroupId: string }
): Promise<{ success: boolean; group?: StudentGroup; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client not initialized' };

  try {
    const payload: any = {};
    if (group.Name !== undefined) payload.name = group.Name;
    if (group.Description !== undefined) payload.description = group.Description;
    if (group.StudentIds !== undefined) payload.student_ids = group.StudentIds;

    const { data, error } = await client
      .from('student_groups')
      .update(payload)
      .eq('group_id', group.GroupId)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, group: mapGroupRow(data) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function supabaseDeleteGroup(groupId: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client not initialized' };

  try {
    const { error } = await client.from('student_groups').delete().eq('group_id', groupId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ----------------------------------------------------------------------------
// EXAMS MANAGEMENT
// ----------------------------------------------------------------------------

export async function supabaseGetAllExams(): Promise<{ success: boolean; exams?: Exam[]; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client not initialized' };

  try {
    const { data, error } = await client
      .from('exams')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return { success: false, error: error.message };
    return { success: true, exams: (data || []).map(mapExamRow) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function supabaseCreateExam(exam: Partial<Exam>): Promise<{ success: boolean; exam?: Exam; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client not initialized' };

  try {
    const raw = exam as any;
    const examId = (raw.ExamId || raw.examId || raw.exam_id || `EXAM-${Date.now().toString(36).toUpperCase()}`).trim().toUpperCase();
    const subject = raw.Subject || raw.subject || 'General Examination';
    const totalMarks = Number(raw.TotalMarks ?? raw.totalMarks ?? raw.total_marks ?? 100) || 100;

    // Guaranteed NOT-NULL StartTime & EndTime
    let startTime = raw.StartTime || raw.startTime || raw.start_time;
    if (!startTime) {
      startTime = new Date().toISOString();
    } else {
      try {
        const d = new Date(startTime);
        startTime = isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
      } catch {
        startTime = new Date().toISOString();
      }
    }

    let endTime = raw.EndTime || raw.endTime || raw.end_time;
    if (!endTime) {
      endTime = new Date(Date.now() + 3 * 3600000).toISOString();
    } else {
      try {
        const d = new Date(endTime);
        endTime = isNaN(d.getTime()) ? new Date(Date.now() + 3 * 3600000).toISOString() : d.toISOString();
      } catch {
        endTime = new Date(Date.now() + 3 * 3600000).toISOString();
      }
    }

    const qpUrl = raw.QPUrl || raw.qpUrl || raw.qp_url || '';
    const assignmentType = raw.AssignmentType || raw.assignmentType || raw.assignment_type || 'ALL';
    const assignedGroups = Array.isArray(raw.AssignedGroups)
      ? raw.AssignedGroups
      : Array.isArray(raw.assignedGroups)
      ? raw.assignedGroups
      : Array.isArray(raw.assigned_groups)
      ? raw.assigned_groups
      : [];
    const assignedStudents = Array.isArray(raw.AssignedStudents)
      ? raw.AssignedStudents
      : Array.isArray(raw.assignedStudents)
      ? raw.assignedStudents
      : Array.isArray(raw.assigned_students)
      ? raw.assigned_students
      : [];
    const allowLateSubmissions = raw.AllowLateSubmissions ?? raw.allowLateSubmissions ?? raw.allow_late_submissions ?? true;
    const submissionOverrides = Array.isArray(raw.SubmissionOverrides)
      ? raw.SubmissionOverrides
      : Array.isArray(raw.submissionOverrides)
      ? raw.submissionOverrides
      : Array.isArray(raw.submission_overrides)
      ? raw.submission_overrides
      : [];
    const meetUrl = raw.MeetUrl || raw.meetUrl || raw.meet_url || '';
    const requireGoogleMeet = Boolean(raw.RequireGoogleMeet ?? raw.requireGoogleMeet ?? raw.require_google_meet);
    const resultsReleased = Boolean(raw.ResultsReleased ?? raw.resultsReleased ?? raw.results_released);
    const resultsReleasedAt = raw.ResultsReleasedAt || raw.resultsReleasedAt || raw.results_released_at || null;
    const questionMarks = Array.isArray(raw.QuestionMarks)
      ? raw.QuestionMarks
      : Array.isArray(raw.questionMarks)
      ? raw.questionMarks
      : Array.isArray(raw.question_marks)
      ? raw.question_marks
      : [];
    const createdAt = raw.CreatedAt || raw.createdAt || raw.created_at || new Date().toISOString();

    const payload = {
      exam_id: examId,
      subject,
      total_marks: totalMarks,
      start_time: startTime,
      end_time: endTime,
      qp_url: qpUrl,
      assignment_type: assignmentType,
      assigned_groups: assignedGroups,
      assigned_students: assignedStudents,
      allow_late_submissions: allowLateSubmissions,
      submission_overrides: submissionOverrides,
      meet_url: meetUrl,
      require_google_meet: requireGoogleMeet,
      results_released: resultsReleased,
      results_released_at: resultsReleasedAt,
      question_marks: questionMarks,
      created_at: createdAt,
    };

    const { data, error } = await client
      .from('exams')
      .upsert(payload, { onConflict: 'exam_id' })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, exam: mapExamRow(data) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function supabaseUpdateExam(
  exam: Partial<Exam> & { ExamId?: string; examId?: string }
): Promise<{ success: boolean; exam?: Exam; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client not initialized' };

  try {
    const raw = exam as any;
    const examId = (raw.ExamId || raw.examId || raw.exam_id || '').trim().toUpperCase();
    if (!examId) return { success: false, error: 'Exam ID is required for update' };

    const payload: any = {};
    if (raw.Subject !== undefined || raw.subject !== undefined) payload.subject = raw.Subject ?? raw.subject;
    if (raw.TotalMarks !== undefined || raw.totalMarks !== undefined) payload.total_marks = Number(raw.TotalMarks ?? raw.totalMarks);
    if (raw.StartTime !== undefined || raw.startTime !== undefined) {
      const st = raw.StartTime ?? raw.startTime;
      payload.start_time = new Date(st).toISOString();
    }
    if (raw.EndTime !== undefined || raw.endTime !== undefined) {
      const et = raw.EndTime ?? raw.endTime;
      payload.end_time = new Date(et).toISOString();
    }
    if (raw.QPUrl !== undefined || raw.qpUrl !== undefined) payload.qp_url = raw.QPUrl ?? raw.qpUrl;
    if (raw.AssignmentType !== undefined || raw.assignmentType !== undefined) payload.assignment_type = raw.AssignmentType ?? raw.assignmentType;
    if (raw.AssignedGroups !== undefined || raw.assignedGroups !== undefined) payload.assigned_groups = raw.AssignedGroups ?? raw.assignedGroups;
    if (raw.AssignedStudents !== undefined || raw.assignedStudents !== undefined) payload.assigned_students = raw.AssignedStudents ?? raw.assignedStudents;
    if (raw.AllowLateSubmissions !== undefined || raw.allowLateSubmissions !== undefined) payload.allow_late_submissions = raw.AllowLateSubmissions ?? raw.allowLateSubmissions;
    if (raw.SubmissionOverrides !== undefined || raw.submissionOverrides !== undefined) payload.submission_overrides = raw.SubmissionOverrides ?? raw.submissionOverrides;
    if (raw.MeetUrl !== undefined || raw.meetUrl !== undefined) payload.meet_url = raw.MeetUrl ?? raw.meetUrl;
    if (raw.RequireGoogleMeet !== undefined || raw.requireGoogleMeet !== undefined) payload.require_google_meet = Boolean(raw.RequireGoogleMeet ?? raw.requireGoogleMeet);
    if (raw.ResultsReleased !== undefined || raw.resultsReleased !== undefined) payload.results_released = Boolean(raw.ResultsReleased ?? raw.resultsReleased);
    if (raw.ResultsReleasedAt !== undefined || raw.resultsReleasedAt !== undefined) payload.results_released_at = raw.ResultsReleasedAt ?? raw.resultsReleasedAt;
    if (raw.QuestionMarks !== undefined || raw.questionMarks !== undefined) payload.question_marks = raw.QuestionMarks ?? raw.questionMarks;

    const { data, error } = await client
      .from('exams')
      .update(payload)
      .eq('exam_id', examId)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, exam: mapExamRow(data) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function supabaseDeleteExam(examId: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client not initialized' };

  try {
    const { error } = await client.from('exams').delete().eq('exam_id', examId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function supabaseToggleExamResultsRelease(
  examId: string,
  released: boolean
): Promise<{ success: boolean; exam?: Exam; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client not initialized' };

  try {
    const { data, error } = await client
      .from('exams')
      .update({
        results_released: released,
        results_released_at: released ? new Date().toISOString() : null,
      })
      .eq('exam_id', examId)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, exam: mapExamRow(data) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ----------------------------------------------------------------------------
// SUBMISSIONS & GRADING (Google Drive URLs Stored in Supabase)
// ----------------------------------------------------------------------------

export async function supabaseGetSubmissions(
  examId?: string,
  studentId?: string
): Promise<{ success: boolean; submissions?: Submission[]; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client not initialized' };

  try {
    let query = client.from('submissions').select('*').order('submitted_at', { ascending: false });

    if (examId) query = query.eq('exam_id', examId);
    if (studentId) query = query.ilike('student_id', studentId.trim());

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };

    return { success: true, submissions: (data || []).map(mapSubmissionRow) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function supabaseSaveSubmission(
  sub: Partial<Submission> & { StudentId: string; ExamId: string; SubmissionUrl: string }
): Promise<{ success: boolean; submission?: Submission; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client not initialized' };

  try {
    const payload = {
      student_id: sub.StudentId.trim().toUpperCase(),
      exam_id: sub.ExamId,
      submission_url: sub.SubmissionUrl, // Google Drive PDF URL
      submitted_at: sub.SubmittedAt || new Date().toISOString(),
      student_name: sub.StudentName || sub.StudentId,
      status: sub.Status || 'SUBMITTED',
      graded_url: sub.GradedUrl || '',
      score: sub.Score !== undefined && sub.Score !== '' ? Number(sub.Score) : null,
      feedback: sub.Feedback || '',
      question_scores: sub.QuestionScores || {},
      osm_draft_data: sub.OsmDraftData || '',
    };

    const { data, error } = await client
      .from('submissions')
      .upsert(payload, { onConflict: 'student_id,exam_id' })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, submission: mapSubmissionRow(data) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function supabaseUploadGradedAnswerSheet(payload: {
  studentId: string;
  examId: string;
  gradedUrl?: string;
  score?: number | string;
  feedback?: string;
  questionScores?: Record<string, number>;
  osmDraftData?: string;
  evaluatorId?: string;
}): Promise<{ success: boolean; submission?: Submission; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client not initialized' };

  try {
    const updateData: any = {
      status: 'GRADED',
      checked_at: new Date().toISOString(),
    };

    if (payload.gradedUrl) updateData.graded_url = payload.gradedUrl; // Google Drive PDF URL
    if (payload.score !== undefined && payload.score !== '') updateData.score = Number(payload.score);
    if (payload.feedback !== undefined) updateData.feedback = payload.feedback;
    if (payload.questionScores !== undefined) updateData.question_scores = payload.questionScores;
    if (payload.osmDraftData !== undefined) updateData.osm_draft_data = payload.osmDraftData;
    if (payload.evaluatorId) updateData.evaluator_id = payload.evaluatorId;

    const { data, error } = await client
      .from('submissions')
      .update(updateData)
      .eq('student_id', payload.studentId.trim().toUpperCase())
      .eq('exam_id', payload.examId)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, submission: mapSubmissionRow(data) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function supabaseRequestRecheck(payload: {
  studentId: string;
  examId: string;
  reason: string;
  grounds?: string;
}): Promise<{ success: boolean; submission?: Submission; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client not initialized' };

  try {
    const { data, error } = await client
      .from('submissions')
      .update({
        status: 'RECHECK_REQUESTED',
        recheck_reason: payload.reason,
        recheck_grounds: payload.grounds || 'General Evaluation Clarification',
        recheck_requested_at: new Date().toISOString(),
      })
      .eq('student_id', payload.studentId.trim().toUpperCase())
      .eq('exam_id', payload.examId)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, submission: mapSubmissionRow(data) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function supabaseResolveRecheck(payload: {
  studentId: string;
  examId: string;
  remarks: string;
  feedback?: string;
  score?: number | string;
  gradedUrl?: string;
}): Promise<{ success: boolean; submission?: Submission; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client not initialized' };

  try {
    const updateData: any = {
      status: 'RECHECK_RESOLVED',
      recheck_remarks: payload.remarks,
      recheck_resolved_at: new Date().toISOString(),
    };

    if (payload.feedback !== undefined) updateData.feedback = payload.feedback;
    if (payload.score !== undefined && payload.score !== '') updateData.score = Number(payload.score);
    if (payload.gradedUrl) updateData.graded_url = payload.gradedUrl;

    const { data, error } = await client
      .from('submissions')
      .update(updateData)
      .eq('student_id', payload.studentId.trim().toUpperCase())
      .eq('exam_id', payload.examId)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, submission: mapSubmissionRow(data) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ----------------------------------------------------------------------------
// DOUBTS & EVALUATION CLARIFICATIONS
// ----------------------------------------------------------------------------

export async function supabaseGetDoubts(examId?: string): Promise<{ success: boolean; doubts?: Doubt[]; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client not initialized' };

  try {
    let query = client.from('doubts').select('*').order('created_at', { ascending: false });
    if (examId) query = query.eq('exam_id', examId);

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, doubts: (data || []).map(mapDoubtRow) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function supabaseCreateDoubt(
  doubt: Partial<Doubt> & { StudentId: string; ExamId: string; Question: string }
): Promise<{ success: boolean; doubt?: Doubt; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client not initialized' };

  try {
    const doubtId = doubt.DoubtId || `DBT-${Date.now().toString(36).toUpperCase()}`;
    const payload = {
      doubt_id: doubtId,
      student_id: doubt.StudentId.trim().toUpperCase(),
      exam_id: doubt.ExamId,
      question: doubt.Question,
      answer: '',
      status: 'OPEN',
      student_name: doubt.StudentName || doubt.StudentId,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await client.from('doubts').insert(payload).select().single();
    if (error) return { success: false, error: error.message };
    return { success: true, doubt: mapDoubtRow(data) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function supabaseAnswerDoubt(
  doubtId: string,
  answer: string
): Promise<{ success: boolean; doubt?: Doubt; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client not initialized' };

  try {
    const { data, error } = await client
      .from('doubts')
      .update({
        answer: answer.trim(),
        status: 'ANSWERED',
        answered_at: new Date().toISOString(),
      })
      .eq('doubt_id', doubtId)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, doubt: mapDoubtRow(data) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ----------------------------------------------------------------------------
// PROCTOR AUDIT LOGS
// ----------------------------------------------------------------------------

export async function supabaseLogProctorEvent(event: {
  examId: string;
  studentId: string;
  actionType: string;
  details?: string;
}): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client not initialized' };

  try {
    const payload = {
      exam_id: event.examId,
      student_id: event.studentId.trim().toUpperCase(),
      action_type: event.actionType,
      details: event.details || '',
      timestamp: new Date().toISOString(),
    };

    const { error } = await client.from('proctor_logs').insert(payload);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function supabaseGetProctorLogs(
  examId?: string,
  studentId?: string
): Promise<{ success: boolean; logs?: ProctorLog[]; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client not initialized' };

  try {
    let query = client.from('proctor_logs').select('*').order('timestamp', { ascending: false }).limit(200);
    if (examId) query = query.eq('exam_id', examId);
    if (studentId) query = query.ilike('student_id', studentId.trim());

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };

    const logs: ProctorLog[] = (data || []).map((row) => ({
      Timestamp: row.timestamp,
      ExamId: row.exam_id,
      StudentId: row.student_id,
      ActionType: row.action_type,
      Details: row.details || '',
    }));

    return { success: true, logs };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ----------------------------------------------------------------------------
// SUBMISSION OVERRIDES (Extended Deadlines / Blocks)
// ----------------------------------------------------------------------------

export async function supabaseGetSubmissionOverrides(
  examId: string
): Promise<{ success: boolean; overrides?: SubmissionOverride[]; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client not initialized' };

  try {
    const { data, error } = await client
      .from('exams')
      .select('submission_overrides')
      .eq('exam_id', examId)
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    return { success: true, overrides: data?.submission_overrides || [] };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function supabaseSetSubmissionOverride(
  examId: string,
  override: SubmissionOverride
): Promise<{ success: boolean; overrides?: SubmissionOverride[]; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client not initialized' };

  try {
    const { data: examData, error: fetchErr } = await client
      .from('exams')
      .select('submission_overrides')
      .eq('exam_id', examId)
      .single();

    if (fetchErr) return { success: false, error: fetchErr.message };

    const existing: SubmissionOverride[] = examData?.submission_overrides || [];
    const filtered = existing.filter((o) => o.OverrideId !== override.OverrideId);
    filtered.unshift(override);

    const { error: updateErr } = await client
      .from('exams')
      .update({ submission_overrides: filtered })
      .eq('exam_id', examId);

    if (updateErr) return { success: false, error: updateErr.message };
    return { success: true, overrides: filtered };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function supabaseDeleteSubmissionOverride(
  examId: string,
  overrideId: string
): Promise<{ success: boolean; overrides?: SubmissionOverride[]; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client not initialized' };

  try {
    const { data: examData, error: fetchErr } = await client
      .from('exams')
      .select('submission_overrides')
      .eq('exam_id', examId)
      .single();

    if (fetchErr) return { success: false, error: fetchErr.message };

    const existing: SubmissionOverride[] = examData?.submission_overrides || [];
    const filtered = existing.filter((o) => o.OverrideId !== overrideId);

    const { error: updateErr } = await client
      .from('exams')
      .update({ submission_overrides: filtered })
      .eq('exam_id', examId);

    if (updateErr) return { success: false, error: updateErr.message };
    return { success: true, overrides: filtered };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
