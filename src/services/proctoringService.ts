import { LiveProctorStream, ProctorCommand } from '../types';
import { executeGasAction } from './api';
import { 
  tursoUpsertStream, 
  tursoFetchLiveStreams, 
  tursoSendCommand, 
  tursoGetStudentCommands, 
  tursoDeleteStudentSession,
  tursoPurgeExamSessionData,
  getTursoConfig 
} from './tursoService';

// Real-time synchronization channel for cross-tab, student-to-teacher proctoring
const PROCTOR_CHANNEL_NAME = 'examfriendly_live_proctoring_v1';
const STREAMS_STORAGE_KEY = 'examfriendly_live_streams_v1';
const COMMANDS_STORAGE_KEY = 'examfriendly_proctor_commands_v1';

let broadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel(PROCTOR_CHANNEL_NAME);
  }
} catch (e) {
  console.warn('BroadcastChannel not available, using storage events', e);
}

/**
 * Mobile Device Detection
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i;
  const isTouch = navigator.maxTouchPoints && navigator.maxTouchPoints > 2;
  const isSmallScreen = window.innerWidth <= 768;
  return mobileRegex.test(ua) || (isTouch && isSmallScreen);
}

/**
 * Screen Sharing Capability Check
 * Mobile browsers typically throw NotAllowedError or don't support getDisplayMedia
 */
export function supportsDisplayMedia(): boolean {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices) return false;
  if (isMobileDevice()) return false; // Mobile OS restricts screen sharing in standard browsers
  return typeof navigator.mediaDevices.getDisplayMedia === 'function';
}

/**
 * Generates a standard Google Meet room URL for exams
 */
export function generateGoogleMeetLink(prefix = 'exf'): string {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const rand = (len: number) => Array.from({ length: len }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  return `https://meet.google.com/${prefix}-${rand(4)}-${rand(3)}`;
}

/**
 * Helper to open Google Meet in pop-out or split-screen friendly window
 */
export function openGoogleMeetPopout(meetUrl: string, title = 'ExamFriendly Google Meet Invigilation Hall'): Window | null {
  if (!meetUrl) return null;
  const width = Math.min(1024, window.screen.availWidth - 100);
  const height = Math.min(720, window.screen.availHeight - 100);
  const left = Math.max(0, (window.screen.availWidth - width) / 2);
  const top = Math.max(0, (window.screen.availHeight - height) / 2);

  return window.open(
    meetUrl,
    '_blank',
    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
  );
}

/**
 * Captures a lightweight JPEG snapshot from an HTMLVideoElement
 */
export function captureVideoFrame(
  video: HTMLVideoElement | null,
  maxWidth = 320,
  maxHeight = 240,
  quality = 0.5
): string | null {
  if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
    return null;
  }

  try {
    const canvas = document.createElement('canvas');
    let width = video.videoWidth;
    let height = video.videoHeight;

    if (width > maxWidth) {
      height = Math.round((height * maxWidth) / width);
      width = maxWidth;
    }
    if (height > maxHeight) {
      width = Math.round((width * maxHeight) / height);
      height = maxHeight;
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', quality);
  } catch (err) {
    console.error('Frame capture error:', err);
    return null;
  }
}

/**
 * Audio VU Meter Helper using Web Audio API
 */
export class AudioMeter {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private dataArray: Uint8Array | null = null;
  private isDestroyed = false;

  constructor(stream: MediaStream) {
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass && stream.getAudioTracks().length > 0) {
        this.audioCtx = new AudioCtxClass();
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 64;
        this.analyser.smoothingTimeConstant = 0.3;
        this.source = this.audioCtx.createMediaStreamSource(stream);
        this.source.connect(this.analyser);
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      }
    } catch (e) {
      console.warn('AudioMeter initialization failed:', e);
    }
  }

  public getVolumeLevel(): number {
    if (this.isDestroyed || !this.analyser || !this.dataArray) return 0;
    try {
      this.analyser.getByteFrequencyData(this.dataArray);
      let sum = 0;
      for (let i = 0; i < this.dataArray.length; i++) {
        sum += this.dataArray[i];
      }
      const avg = sum / this.dataArray.length;
      // Map 0 - 128 to 0 - 100%
      return Math.min(100, Math.round((avg / 128) * 100));
    } catch (e) {
      return 0;
    }
  }

  public destroy() {
    this.isDestroyed = true;
    try {
      if (this.source) this.source.disconnect();
      if (this.audioCtx && this.audioCtx.state !== 'closed') {
        this.audioCtx.close();
      }
    } catch (e) {
      // ignore
    }
  }
}

/**
 * Storage helpers
 */
function getAllStoredStreams(): Record<string, LiveProctorStream> {
  try {
    const raw = localStorage.getItem(STREAMS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStoredStreams(streams: Record<string, LiveProctorStream>) {
  try {
    localStorage.setItem(STREAMS_STORAGE_KEY, JSON.stringify(streams));
  } catch (e) {
    // Quota exceeded: trim old streams
    try {
      const now = Date.now();
      const pruned: Record<string, LiveProctorStream> = {};
      for (const [k, v] of Object.entries(streams)) {
        if (now - v.lastSeen < 60000) {
          // Drop snapshot data to save space if needed
          pruned[k] = { ...v, cameraFrame: undefined, screenFrame: undefined };
        }
      }
      localStorage.setItem(STREAMS_STORAGE_KEY, JSON.stringify(pruned));
    } catch {
      // ignore
    }
  }
}

// Last cloud sync throttle tracker
let lastGasCloudSyncTime = 0;

/**
 * Publishes a live stream state update from a candidate
 */
export function publishCandidateStream(stream: LiveProctorStream) {
  const all = getAllStoredStreams();
  all[`${stream.examId}_${stream.studentId}`] = {
    ...stream,
    lastSeen: Date.now(),
  };
  saveStoredStreams(all);

  const payload = { type: 'STREAM_UPDATE', stream };
  if (broadcastChannel) {
    broadcastChannel.postMessage(payload);
  }

  // 1. FAST PATH: Edge sync directly to Turso DB (sub-millisecond / edge connection)
  tursoUpsertStream(stream).catch((err) => {
    // silently catch if offline
  });

  // 2. SLOW BACKUP PATH: Throttled sync to Google Apps Script backend if Turso is not active
  const tursoCfg = getTursoConfig();
  if (!tursoCfg.isConfigured) {
    const now = Date.now();
    if (now - lastGasCloudSyncTime > 2500) {
      lastGasCloudSyncTime = now;
      executeGasAction('syncProctorHeartbeat', { stream }).catch(() => {
        // ignore transient network glitch
      });
    }
  }
}

/**
 * Completely erases a candidate's session data from Turso database and local storage upon exam completion/exit
 */
export async function eraseStudentSessionData(examId: string, studentId: string) {
  const normStudentId = studentId.trim().toUpperCase();
  const key = `${examId}_${normStudentId}`;
  
  // 1. Remove from local storage
  const all = getAllStoredStreams();
  delete all[key];
  delete all[`${examId}_${studentId}`];
  saveStoredStreams(all);

  // 2. Remove commands for student
  try {
    const raw = localStorage.getItem(COMMANDS_STORAGE_KEY);
    if (raw) {
      const commands: ProctorCommand[] = JSON.parse(raw);
      const filtered = commands.filter(
        (c) => !(c.examId === examId && c.studentId.trim().toUpperCase() === normStudentId)
      );
      localStorage.setItem(COMMANDS_STORAGE_KEY, JSON.stringify(filtered));
    }
  } catch (e) {
    // ignore
  }

  // 3. Post ERASE message across tabs
  if (broadcastChannel) {
    broadcastChannel.postMessage({
      type: 'STREAM_ERASE',
      examId,
      studentId: normStudentId,
    });
  }

  // 4. Delete session from Turso DB
  await tursoDeleteStudentSession(examId, normStudentId);
}

/**
 * Erases all proctoring session records for an entire exam from Turso database and local state
 */
export async function eraseExamAllSessionsData(examId: string) {
  const all = getAllStoredStreams();
  for (const key of Object.keys(all)) {
    if (all[key].examId === examId) {
      delete all[key];
    }
  }
  saveStoredStreams(all);

  try {
    const raw = localStorage.getItem(COMMANDS_STORAGE_KEY);
    if (raw) {
      const commands: ProctorCommand[] = JSON.parse(raw);
      const filtered = commands.filter((c) => c.examId !== examId);
      localStorage.setItem(COMMANDS_STORAGE_KEY, JSON.stringify(filtered));
    }
  } catch (e) {
    // ignore
  }

  if (broadcastChannel) {
    broadcastChannel.postMessage({
      type: 'STREAM_ERASE_ALL',
      examId,
    });
  }

  await tursoPurgeExamSessionData(examId);
}

/**
 * Marks a student as disconnected or submitted
 */
export function disconnectCandidateStream(examId: string, studentId: string, reason: 'SUBMITTED' | 'DISCONNECTED') {
  const all = getAllStoredStreams();
  const key = `${examId}_${studentId}`;
  if (all[key]) {
    all[key].status = reason;
    all[key].lastSeen = Date.now();
    saveStoredStreams(all);
  }

  const payload = { type: 'STREAM_DISCONNECT', examId, studentId, reason };
  if (broadcastChannel) {
    broadcastChannel.postMessage(payload);
  }

  const disconnectStream: LiveProctorStream = {
    examId,
    studentId,
    studentName: all[key]?.studentName || studentId,
    status: reason,
    lastSeen: Date.now(),
    isBlocked: false,
    audioLevel: 0,
    deviceType: 'DESKTOP',
    isMobile: false,
    isScreenSharing: false,
    isCameraActive: false,
    isMicActive: false,
    warningCount: 0,
  };

  tursoUpsertStream(disconnectStream).catch(() => {});

  const tursoCfg = getTursoConfig();
  if (!tursoCfg.isConfigured) {
    executeGasAction('syncProctorHeartbeat', { stream: disconnectStream }).catch(() => {});
  }
}

/**
 * Get all active streams, filtered by examId if provided
 */
export function getLiveStreams(examId?: string): LiveProctorStream[] {
  const all = getAllStoredStreams();
  const now = Date.now();
  const list: LiveProctorStream[] = [];

  for (const stream of Object.values(all)) {
    if (examId && examId !== 'ALL' && stream.examId !== examId) continue;
    // Mark as away/offline if no heartbeat for 25 seconds
    const isStale = now - stream.lastSeen > 25000;
    const finalStream: LiveProctorStream = {
      ...stream,
      status: stream.isBlocked
        ? 'BLOCKED'
        : stream.status === 'SUBMITTED'
        ? 'SUBMITTED'
        : isStale
        ? 'DISCONNECTED'
        : stream.status,
    };
    list.push(finalStream);
  }

  return list.sort((a, b) => b.lastSeen - a.lastSeen);
}

/**
 * Subscribe to stream updates (Teacher view) with local + Turso edge polling
 */
export function subscribeToLiveStreams(callback: (streams: LiveProctorStream[]) => void): () => void {
  let isSubscribed = true;
  let lastStreamJson = '';

  const notify = () => {
    if (!isSubscribed) return;
    const current = getLiveStreams();
    // Compare serialised stream list to avoid triggering state updates when data hasn't changed
    const currentJson = JSON.stringify(current);
    if (currentJson !== lastStreamJson) {
      lastStreamJson = currentJson;
      callback(current);
    }
  };

  // Poll Turso Edge DB at rapid ~500ms intervals for real-time video/audio feeds
  const syncFromTurso = async () => {
    if (!isSubscribed) return;
    try {
      const tursoStreams = await tursoFetchLiveStreams();
      if (!isSubscribed) return;
      if (tursoStreams && tursoStreams.length >= 0) {
        const local = getAllStoredStreams();
        let changed = false;

        for (const ts of tursoStreams) {
          const key = `${ts.examId}_${ts.studentId}`;
          if (!local[key] || (ts.lastSeen && ts.lastSeen >= (local[key].lastSeen || 0))) {
            local[key] = ts;
            changed = true;
          }
        }

        if (changed) {
          saveStoredStreams(local);
          notify();
        }
      }
    } catch (e) {
      // ignore
    }
  };

  // Fallback slow poll for GAS backend if Turso is not configured
  const syncFromGasCloud = async () => {
    if (!isSubscribed) return;
    const tursoCfg = getTursoConfig();
    if (tursoCfg.isConfigured) return; // Turso is active, skip slow GAS polling

    try {
      const res = await executeGasAction('getLiveProctorStreams', {});
      if (!isSubscribed) return;
      if (res.success && (res.data?.streams || (res as any).streams)) {
        const cloudStreams: LiveProctorStream[] = res.data?.streams || (res as any).streams || [];
        const local = getAllStoredStreams();
        let changed = false;

        for (const cs of cloudStreams) {
          const key = `${cs.examId}_${cs.studentId}`;
          if (!local[key] || (cs.lastSeen && cs.lastSeen > (local[key].lastSeen || 0))) {
            local[key] = cs;
            changed = true;
          }
        }

        if (changed) {
          saveStoredStreams(local);
          notify();
        }
      }
    } catch (e) {
      // ignore
    }
  };

  const handleMessage = (event: MessageEvent) => {
    if (
      event.data &&
      (event.data.type === 'STREAM_UPDATE' ||
        event.data.type === 'STREAM_DISCONNECT' ||
        event.data.type === 'PROCTOR_COMMAND' ||
        event.data.type === 'STREAM_ERASE' ||
        event.data.type === 'STREAM_ERASE_ALL')
    ) {
      notify();
    }
  };

  const handleStorage = (e: StorageEvent) => {
    if (e.key === STREAMS_STORAGE_KEY || e.key === COMMANDS_STORAGE_KEY) {
      notify();
    }
  };

  if (broadcastChannel) {
    broadcastChannel.addEventListener('message', handleMessage);
  }
  window.addEventListener('storage', handleStorage);

  // Rapid edge sync intervals
  const localInterval = setInterval(notify, 1000);
  const tursoInterval = setInterval(syncFromTurso, 600);
  const gasInterval = setInterval(syncFromGasCloud, 4000);

  // Initial immediate calls
  notify();
  syncFromTurso();
  syncFromGasCloud();

  return () => {
    isSubscribed = false;
    if (broadcastChannel) {
      broadcastChannel.removeEventListener('message', handleMessage);
    }
    window.removeEventListener('storage', handleStorage);
    clearInterval(localInterval);
    clearInterval(tursoInterval);
    clearInterval(gasInterval);
  };
}

/**
 * Teacher sends command: BLOCK, UNBLOCK, WARN
 */
export function sendProctorCommand(cmd: ProctorCommand) {
  try {
    const raw = localStorage.getItem(COMMANDS_STORAGE_KEY);
    const commands: ProctorCommand[] = raw ? JSON.parse(raw) : [];
    commands.push(cmd);
    // Keep last 50 commands
    if (commands.length > 50) commands.splice(0, commands.length - 50);
    localStorage.setItem(COMMANDS_STORAGE_KEY, JSON.stringify(commands));
  } catch (e) {
    console.error('Error storing proctor command:', e);
  }

  // Also update stored stream state immediately
  const all = getAllStoredStreams();
  const key = `${cmd.examId}_${cmd.studentId}`;
  if (all[key]) {
    if (cmd.type === 'BLOCK') {
      all[key].isBlocked = true;
      all[key].blockedReason = cmd.reason || 'Blocked for unfair means by proctor';
      all[key].blockedAt = cmd.timestamp;
      all[key].status = 'BLOCKED';
    } else if (cmd.type === 'UNBLOCK') {
      all[key].isBlocked = false;
      all[key].blockedReason = undefined;
      all[key].blockedAt = undefined;
      all[key].status = 'ONLINE';
    } else if (cmd.type === 'WARN') {
      all[key].activeWarning = cmd.warningText;
      all[key].warningCount = (all[key].warningCount || 0) + 1;
    }
    saveStoredStreams(all);
  }

  const payload = { type: 'PROCTOR_COMMAND', command: cmd };
  if (broadcastChannel) {
    broadcastChannel.postMessage(payload);
  }

  // Edge dispatch to Turso in real-time
  tursoSendCommand(cmd).catch((e) => {
    console.error('Turso command dispatch error:', e);
  });

  // Slow cloud dispatch fallback
  const tursoCfg = getTursoConfig();
  if (!tursoCfg.isConfigured) {
    executeGasAction('sendProctorCommand', { command: cmd }).catch(() => {});
  }
}

/**
 * Candidate listens for commands targeted to them (BLOCK / WARN / UNBLOCK)
 */
export function subscribeToStudentCommands(
  examId: string,
  studentId: string,
  onCommand: (cmd: ProctorCommand) => void
): () => void {
  const normStudentId = studentId.trim().toUpperCase();

  const checkCommand = (cmd: ProctorCommand) => {
    if (
      cmd.examId === examId &&
      cmd.studentId.trim().toUpperCase() === normStudentId
    ) {
      onCommand(cmd);
    }
  };

  // Poll Turso for instant command delivery
  const pollTursoCommands = async () => {
    try {
      const commands = await tursoGetStudentCommands(examId, normStudentId);
      if (commands && commands.length > 0) {
        const latest = commands[0];
        checkCommand(latest);
      }
    } catch {
      // ignore
    }
  };

  // Poll GAS cloud backend for teacher commands (fallback)
  const pollGasCommands = async () => {
    const tursoCfg = getTursoConfig();
    if (tursoCfg.isConfigured) return;

    try {
      const res = await executeGasAction('getProctorCommands', { examId, studentId: normStudentId });
      if (res.success && (res.data?.commands || (res as any).commands)) {
        const commands: ProctorCommand[] = res.data?.commands || (res as any).commands || [];
        if (commands.length > 0) {
          const latest = commands[commands.length - 1];
          checkCommand(latest);
        }
      }
    } catch (e) {
      // ignore
    }
  };

  const handleMessage = (event: MessageEvent) => {
    if (event.data && event.data.type === 'PROCTOR_COMMAND' && event.data.command) {
      checkCommand(event.data.command);
    }
  };

  const handleStorage = (e: StorageEvent) => {
    if (e.key === COMMANDS_STORAGE_KEY && e.newValue) {
      try {
        const commands: ProctorCommand[] = JSON.parse(e.newValue);
        if (commands.length > 0) {
          const latest = commands[commands.length - 1];
          checkCommand(latest);
        }
      } catch {
        // ignore
      }
    }
  };

  if (broadcastChannel) {
    broadcastChannel.addEventListener('message', handleMessage);
  }
  window.addEventListener('storage', handleStorage);

  const tursoInterval = setInterval(pollTursoCommands, 600);
  const gasInterval = setInterval(pollGasCommands, 3000);

  // Check if already blocked in storage on mount
  const all = getAllStoredStreams();
  const key = `${examId}_${normStudentId}`;
  if (all[key] && all[key].isBlocked) {
    checkCommand({
      commandId: 'initial_blocked',
      type: 'BLOCK',
      examId,
      studentId: normStudentId,
      reason: all[key].blockedReason || 'Blocked by proctor',
      timestamp: all[key].blockedAt || new Date().toISOString(),
    });
  }

  // Initial command checks
  pollTursoCommands();
  pollGasCommands();

  return () => {
    if (broadcastChannel) {
      broadcastChannel.removeEventListener('message', handleMessage);
    }
    window.removeEventListener('storage', handleStorage);
    clearInterval(tursoInterval);
    clearInterval(gasInterval);
  };
}
