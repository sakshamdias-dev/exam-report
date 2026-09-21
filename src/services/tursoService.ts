import { createClient, Client } from '@libsql/client/web';
import { LiveProctorStream, ProctorCommand } from '../types';

export interface TursoConfig {
  url: string;
  authToken: string;
  isConfigured: boolean;
  lastLatencyMs?: number;
}

const STORAGE_KEY = 'examfriendly_turso_config_v1';

// Default / fallback Turso config from environment variables if present
export function getTursoConfig(): TursoConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.url) {
        return {
          url: parsed.url.trim(),
          authToken: (parsed.authToken || '').trim(),
          isConfigured: !!parsed.url.trim(),
        };
      }
    }
  } catch (e) {
    console.warn('Error reading Turso config from localStorage', e);
  }

  const metaEnv = (import.meta as any).env || {};
  const envUrl = (metaEnv.VITE_TURSO_DATABASE_URL || '').trim();
  const envToken = (metaEnv.VITE_TURSO_AUTH_TOKEN || '').trim();

  return {
    url: envUrl,
    authToken: envToken,
    isConfigured: !!envUrl,
  };
}

export function saveTursoConfig(url: string, authToken: string) {
  const config = {
    url: url.trim(),
    authToken: authToken.trim(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  // Reset cached client instance so next call re-initializes
  cachedClient = null;
  schemaInitialized = false;
}

export function clearTursoConfig() {
  localStorage.removeItem(STORAGE_KEY);
  cachedClient = null;
  schemaInitialized = false;
}

let cachedClient: Client | null = null;
let schemaInitialized = false;

/**
 * Normalizes URL for @libsql/client (supports libsql:// or https://)
 */
function normalizeTursoUrl(url: string): string {
  let cleaned = url.trim();
  if (!cleaned) return '';
  // @libsql/client/web supports https:// or libsql:// (which it connects via https/ws)
  return cleaned;
}

/**
 * Gets or creates the active Turso libSQL client
 */
export function getTursoClient(): Client | null {
  const config = getTursoConfig();
  if (!config.isConfigured || !config.url) {
    return null;
  }

  if (cachedClient) {
    return cachedClient;
  }

  try {
    const normalizedUrl = normalizeTursoUrl(config.url);
    cachedClient = createClient({
      url: normalizedUrl,
      authToken: config.authToken || undefined,
    });
    return cachedClient;
  } catch (err) {
    console.error('Failed to create Turso client:', err);
    return null;
  }
}

/**
 * Bootstraps the SQLite tables in Turso for ultra-fast proctoring
 */
export async function ensureTursoSchema(): Promise<boolean> {
  if (schemaInitialized) return true;
  const client = getTursoClient();
  if (!client) return false;

  try {
    await client.batch([
      `CREATE TABLE IF NOT EXISTS live_proctor_streams (
        stream_id TEXT PRIMARY KEY,
        exam_id TEXT NOT NULL,
        student_id TEXT NOT NULL,
        student_name TEXT,
        camera_frame TEXT,
        screen_frame TEXT,
        audio_level INTEGER DEFAULT 0,
        device_type TEXT,
        is_mobile INTEGER DEFAULT 0,
        is_screen_sharing INTEGER DEFAULT 0,
        is_camera_active INTEGER DEFAULT 0,
        is_mic_active INTEGER DEFAULT 0,
        is_blocked INTEGER DEFAULT 0,
        blocked_reason TEXT,
        warning_count INTEGER DEFAULT 0,
        active_warning TEXT,
        status TEXT DEFAULT 'ONLINE',
        violations_json TEXT,
        meet_joined INTEGER DEFAULT 0,
        meet_url TEXT,
        last_seen INTEGER NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE INDEX IF NOT EXISTS idx_streams_exam_seen ON live_proctor_streams (exam_id, last_seen);`,
      `CREATE TABLE IF NOT EXISTS proctor_commands (
        command_id TEXT PRIMARY KEY,
        exam_id TEXT NOT NULL,
        student_id TEXT NOT NULL,
        type TEXT NOT NULL,
        reason TEXT,
        warning_text TEXT,
        timestamp TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE INDEX IF NOT EXISTS idx_commands_student ON proctor_commands (exam_id, student_id);`,
      `CREATE TABLE IF NOT EXISTS proctor_audit_logs (
        log_id TEXT PRIMARY KEY,
        exam_id TEXT NOT NULL,
        student_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        details TEXT,
        timestamp TEXT NOT NULL
      );`
    ], 'write');

    schemaInitialized = true;
    return true;
  } catch (err) {
    console.warn('Failed to ensure Turso schema:', err);
    return false;
  }
}

/**
 * Tests connection to a Turso database and measures round-trip latency
 */
export async function testTursoConnection(url: string, authToken: string): Promise<{ success: boolean; latencyMs: number; error?: string }> {
  const startTime = performance.now();
  try {
    const tempClient = createClient({
      url: normalizeTursoUrl(url),
      authToken: authToken.trim() || undefined,
    });

    const res = await tempClient.execute('SELECT 1 AS ping;');
    const latencyMs = Math.round(performance.now() - startTime);

    if (res.rows && res.rows.length > 0) {
      return { success: true, latencyMs };
    }
    return { success: false, latencyMs, error: 'Empty query response' };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { success: false, latencyMs, error: err?.message || String(err) };
  }
}

/**
 * High-speed upsert of candidate video/audio stream into Turso
 */
export async function tursoUpsertStream(stream: LiveProctorStream): Promise<boolean> {
  const client = getTursoClient();
  if (!client) return false;

  await ensureTursoSchema();

  const streamId = `${stream.examId}_${stream.studentId}`;
  const now = stream.lastSeen || Date.now();
  const violationsJson = stream.violationsList ? JSON.stringify(stream.violationsList) : null;

  try {
    await client.execute({
      sql: `INSERT INTO live_proctor_streams (
        stream_id, exam_id, student_id, student_name,
        camera_frame, screen_frame, audio_level, device_type,
        is_mobile, is_screen_sharing, is_camera_active, is_mic_active,
        is_blocked, blocked_reason, warning_count, active_warning,
        status, violations_json, meet_joined, meet_url, last_seen
      ) VALUES (
        :stream_id, :exam_id, :student_id, :student_name,
        :camera_frame, :screen_frame, :audio_level, :device_type,
        :is_mobile, :is_screen_sharing, :is_camera_active, :is_mic_active,
        :is_blocked, :blocked_reason, :warning_count, :active_warning,
        :status, :violations_json, :meet_joined, :meet_url, :last_seen
      ) ON CONFLICT(stream_id) DO UPDATE SET
        student_name = excluded.student_name,
        camera_frame = COALESCE(excluded.camera_frame, live_proctor_streams.camera_frame),
        screen_frame = COALESCE(excluded.screen_frame, live_proctor_streams.screen_frame),
        audio_level = excluded.audio_level,
        device_type = excluded.device_type,
        is_mobile = excluded.is_mobile,
        is_screen_sharing = excluded.is_screen_sharing,
        is_camera_active = excluded.is_camera_active,
        is_mic_active = excluded.is_mic_active,
        is_blocked = excluded.is_blocked,
        blocked_reason = excluded.blocked_reason,
        warning_count = excluded.warning_count,
        active_warning = excluded.active_warning,
        status = excluded.status,
        violations_json = excluded.violations_json,
        meet_joined = excluded.meet_joined,
        meet_url = excluded.meet_url,
        last_seen = excluded.last_seen,
        updated_at = CURRENT_TIMESTAMP;`,
      args: {
        stream_id: streamId,
        exam_id: stream.examId,
        student_id: stream.studentId,
        student_name: stream.studentName || stream.studentId,
        camera_frame: stream.cameraFrame || null,
        screen_frame: stream.screenFrame || null,
        audio_level: stream.audioLevel || 0,
        device_type: stream.deviceType || 'DESKTOP',
        is_mobile: stream.isMobile ? 1 : 0,
        is_screen_sharing: stream.isScreenSharing ? 1 : 0,
        is_camera_active: stream.isCameraActive ? 1 : 0,
        is_mic_active: stream.isMicActive ? 1 : 0,
        is_blocked: stream.isBlocked ? 1 : 0,
        blocked_reason: stream.blockedReason || null,
        warning_count: stream.warningCount || 0,
        active_warning: stream.activeWarning || null,
        status: stream.status || 'ONLINE',
        violations_json: violationsJson,
        meet_joined: stream.meetJoined ? 1 : 0,
        meet_url: stream.meetUrl || null,
        last_seen: now,
      },
    });
    return true;
  } catch (err) {
    console.error('Turso stream upsert error:', err);
    return false;
  }
}

/**
 * Fetch all active streams from Turso with sub-millisecond querying
 */
export async function tursoFetchLiveStreams(examId?: string): Promise<LiveProctorStream[] | null> {
  const client = getTursoClient();
  if (!client) return null;

  await ensureTursoSchema();

  try {
    // Only return streams active within last 45 seconds (or marked blocked/submitted)
    const cutoff = Date.now() - 45000;
    let query = `SELECT * FROM live_proctor_streams WHERE last_seen > :cutoff`;
    const args: Record<string, any> = { cutoff };

    if (examId && examId !== 'ALL') {
      query += ` AND exam_id = :exam_id`;
      args.exam_id = examId;
    }

    query += ` ORDER BY last_seen DESC;`;

    const res = await client.execute({ sql: query, args });
    const streams: LiveProctorStream[] = [];

    const now = Date.now();
    for (const row of res.rows) {
      let violationsList: any[] | undefined = undefined;
      if (row.violations_json && typeof row.violations_json === 'string') {
        try {
          violationsList = JSON.parse(row.violations_json);
        } catch {
          // ignore
        }
      }

      const isBlocked = Number(row.is_blocked) === 1;
      const lastSeen = Number(row.last_seen);
      const isStale = now - lastSeen > 20000;

      const rawStatus = String(row.status || 'ONLINE') as any;
      const finalStatus = isBlocked
        ? 'BLOCKED'
        : rawStatus === 'SUBMITTED'
        ? 'SUBMITTED'
        : isStale
        ? 'DISCONNECTED'
        : rawStatus;

      streams.push({
        studentId: String(row.student_id),
        studentName: String(row.student_name || row.student_id),
        examId: String(row.exam_id),
        cameraFrame: row.camera_frame ? String(row.camera_frame) : undefined,
        screenFrame: row.screen_frame ? String(row.screen_frame) : undefined,
        audioLevel: Number(row.audio_level) || 0,
        deviceType: (row.device_type as any) || 'DESKTOP',
        isMobile: Number(row.is_mobile) === 1,
        isScreenSharing: Number(row.is_screen_sharing) === 1,
        isCameraActive: Number(row.is_camera_active) === 1,
        isMicActive: Number(row.is_mic_active) === 1,
        isBlocked,
        blockedReason: row.blocked_reason ? String(row.blocked_reason) : undefined,
        warningCount: Number(row.warning_count) || 0,
        activeWarning: row.active_warning ? String(row.active_warning) : undefined,
        status: finalStatus,
        violationsList,
        meetJoined: Number(row.meet_joined) === 1,
        meetUrl: row.meet_url ? String(row.meet_url) : undefined,
        lastSeen,
      });
    }

    return streams;
  } catch (err) {
    console.error('Turso fetch streams error:', err);
    return null;
  }
}

/**
 * Write a proctor command to Turso
 */
export async function tursoSendCommand(cmd: ProctorCommand): Promise<boolean> {
  const client = getTursoClient();
  if (!client) return false;

  await ensureTursoSchema();

  try {
    await client.execute({
      sql: `INSERT INTO proctor_commands (
        command_id, exam_id, student_id, type, reason, warning_text, timestamp
      ) VALUES (
        :command_id, :exam_id, :student_id, :type, :reason, :warning_text, :timestamp
      );`,
      args: {
        command_id: cmd.commandId || `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        exam_id: cmd.examId,
        student_id: cmd.studentId.trim().toUpperCase(),
        type: cmd.type,
        reason: cmd.reason || null,
        warning_text: cmd.warningText || null,
        timestamp: cmd.timestamp || new Date().toISOString(),
      },
    });

    // Also update stream record if blocking/unblocking
    const streamId = `${cmd.examId}_${cmd.studentId.trim().toUpperCase()}`;
    if (cmd.type === 'BLOCK') {
      await client.execute({
        sql: `UPDATE live_proctor_streams SET is_blocked = 1, blocked_reason = :reason, status = 'BLOCKED' WHERE stream_id = :stream_id;`,
        args: { stream_id: streamId, reason: cmd.reason || 'Blocked by teacher' },
      });
    } else if (cmd.type === 'UNBLOCK') {
      await client.execute({
        sql: `UPDATE live_proctor_streams SET is_blocked = 0, blocked_reason = NULL, status = 'ONLINE' WHERE stream_id = :stream_id;`,
        args: { stream_id: streamId },
      });
    }

    return true;
  } catch (err) {
    console.error('Turso send command error:', err);
    return false;
  }
}

/**
 * Poll latest commands for a candidate from Turso
 */
export async function tursoGetStudentCommands(examId: string, studentId: string): Promise<ProctorCommand[] | null> {
  const client = getTursoClient();
  if (!client) return null;

  await ensureTursoSchema();

  try {
    const normStudentId = studentId.trim().toUpperCase();
    const res = await client.execute({
      sql: `SELECT * FROM proctor_commands 
            WHERE exam_id = :exam_id AND UPPER(student_id) = :student_id 
            ORDER BY created_at DESC LIMIT 10;`,
      args: {
        exam_id: examId,
        student_id: normStudentId,
      },
    });

    const commands: ProctorCommand[] = [];
    for (const row of res.rows) {
      commands.push({
        commandId: String(row.command_id),
        examId: String(row.exam_id),
        studentId: String(row.student_id),
        type: String(row.type) as any,
        reason: row.reason ? String(row.reason) : undefined,
        warningText: row.warning_text ? String(row.warning_text) : undefined,
        timestamp: String(row.timestamp),
      });
    }

    return commands;
  } catch (err) {
    console.error('Turso get commands error:', err);
    return null;
  }
}

/**
 * Erase all session data (streams and commands) for a student from Turso DB when test ends
 */
export async function tursoDeleteStudentSession(examId: string, studentId: string): Promise<boolean> {
  const client = getTursoClient();
  if (!client) return false;

  await ensureTursoSchema();

  try {
    const streamId = `${examId}_${studentId.trim().toUpperCase()}`;
    const normStudentId = studentId.trim().toUpperCase();

    await client.batch([
      {
        sql: `DELETE FROM live_proctor_streams WHERE stream_id = :stream_id OR (exam_id = :exam_id AND UPPER(student_id) = :student_id);`,
        args: { stream_id: streamId, exam_id: examId, student_id: normStudentId },
      },
      {
        sql: `DELETE FROM proctor_commands WHERE exam_id = :exam_id AND UPPER(student_id) = :student_id;`,
        args: { exam_id: examId, student_id: normStudentId },
      },
    ], 'write');

    return true;
  } catch (err) {
    console.error('Error erasing session from Turso:', err);
    return false;
  }
}

/**
 * Erase all session data for an entire exam from Turso DB
 */
export async function tursoPurgeExamSessionData(examId: string): Promise<boolean> {
  const client = getTursoClient();
  if (!client) return false;

  await ensureTursoSchema();

  try {
    await client.batch([
      {
        sql: `DELETE FROM live_proctor_streams WHERE exam_id = :exam_id;`,
        args: { exam_id: examId },
      },
      {
        sql: `DELETE FROM proctor_commands WHERE exam_id = :exam_id;`,
        args: { exam_id: examId },
      },
    ], 'write');

    return true;
  } catch (err) {
    console.error('Error purging exam data from Turso:', err);
    return false;
  }
}
