/**
 * AIRWRITE AI Firebase Integration Service
 * Provides Firebase Auth, Firestore persistent cloud notebooks,
 * debounced auto-saving, local draft recovery, and storage.
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
} from 'firebase/firestore';
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';
import type {
  Project,
  UserSettings,
  WhiteboardPage,
  DrawingStroke,
  Classroom,
  ClassroomMember,
  ClassroomMaterial,
  ClassroomQuizSubmission,
  UserRole,
} from '../types';

// Check if Firebase config contains valid non-placeholder values
export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig &&
      firebaseConfig.projectId &&
      firebaseConfig.projectId !== 'remixed-project-id' &&
      firebaseConfig.apiKey &&
      firebaseConfig.apiKey !== 'AIzaSyAjFh57jBUOVsfFiOjknLMja3IqFbreiks_placeholder'
  );
}

// Initialize Firebase App singleton
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

/* CRITICAL: Use firestoreDatabaseId as required by the integration skill */
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Error Handling conforming to Firebase Integration Skill
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Validate Firestore connection on boot
 */
export async function testConnection(): Promise<{ connected: boolean; message?: string }> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return { connected: true };
  } catch (error: any) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or network unreachable.');
      return { connected: false, message: 'Firebase client is offline.' };
    }
    // Any other response (like permission denied or doc not found) confirms network path is live
    return { connected: true };
  }
}

// Run connection check
testConnection().catch((err) => console.warn('Initial connection probe completed:', err));

// --- USER PROFILE & AUTHENTICATION ---

export interface UserProfileData {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: 'student' | 'teacher' | 'educator' | 'admin';
}

/**
 * Register new user with email and password
 */
export async function registerWithEmail(
  email: string,
  pass: string,
  displayName: string,
  role: 'student' | 'teacher' | 'educator' = 'student'
): Promise<FirebaseUser> {
  const credential = await createUserWithEmailAndPassword(auth, email, pass);
  const user = credential.user;

  if (displayName) {
    await updateProfile(user, { displayName });
  }

  // Create initial user profile document in Firestore
  const userDocPath = `users/${user.uid}`;
  try {
    await setDoc(doc(db, 'users', user.uid), {
      id: user.uid,
      email: user.email || email,
      displayName: displayName || user.email?.split('@')[0] || 'Air-Writer',
      photoURL: user.photoURL || '',
      role,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, userDocPath);
  }

  return user;
}

/**
 * Sign in with email and password
 */
export async function loginWithEmail(email: string, pass: string): Promise<FirebaseUser> {
  const credential = await signInWithEmailAndPassword(auth, email, pass);
  return credential.user;
}

/**
 * Sign in with Google Popup
 */
export async function loginWithGoogle(): Promise<FirebaseUser> {
  const provider = new GoogleAuthProvider();
  const credential = await signInWithPopup(auth, provider);
  const user = credential.user;

  // Ensure user profile document exists
  const userDocPath = `users/${user.uid}`;
  try {
    const existing = await getDoc(doc(db, 'users', user.uid));
    if (!existing.exists()) {
      await setDoc(doc(db, 'users', user.uid), {
        id: user.uid,
        email: user.email || '',
        displayName: user.displayName || 'Air-Writer',
        photoURL: user.photoURL || '',
        role: 'student',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, userDocPath);
  }

  return user;
}

/**
 * Sign out
 */
export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Password Recovery
 */
export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

/**
 * Fetch user profile from Firestore
 */
export async function getUserProfile(userId: string): Promise<UserProfileData | null> {
  const path = `users/${userId}`;
  try {
    const snap = await getDoc(doc(db, 'users', userId));
    if (snap.exists()) {
      const data = snap.data();
      return {
        uid: data.id || userId,
        email: data.email || null,
        displayName: data.displayName || null,
        photoURL: data.photoURL || null,
        role: data.role || 'student',
      };
    }
    return null;
  } catch (err) {
    console.warn('Could not fetch user profile:', err);
    return null;
  }
}

/**
 * Update user display name and profile role
 */
export async function updateUserProfile(displayName: string, role?: 'student' | 'teacher' | 'educator'): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  await updateProfile(user, { displayName });

  const path = `users/${user.uid}`;
  try {
    await updateDoc(doc(db, 'users', user.uid), {
      displayName,
      ...(role ? { role } : {}),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

// --- CLOUD PROJECT & BOARD SYNCHRONIZATION ---

const DRAFTS_KEY = 'airwrite_local_drafts_v1';

export function getLocalDrafts(): Record<string, { project: Project; pendingCloudSync: boolean; lastAttempt: number }> {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveLocalDraft(project: Project, pendingCloudSync: boolean = false) {
  try {
    const drafts = getLocalDrafts();
    drafts[project.id] = {
      project,
      pendingCloudSync,
      lastAttempt: Date.now(),
    };
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  } catch (err) {
    console.warn('Failed to save local recovery draft:', err);
  }
}

export function clearLocalDraft(projectId: string) {
  try {
    const drafts = getLocalDrafts();
    delete drafts[projectId];
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  } catch (err) {
    console.warn('Failed to clear local recovery draft:', err);
  }
}

/**
 * Fetch all projects belonging to the authenticated user from Firestore
 */
export async function fetchUserProjectsFromCloud(userId: string): Promise<Project[]> {
  const path = 'projects';
  try {
    const q = query(collection(db, 'projects'), where('ownerId', '==', userId));
    const snapshot = await getDocs(q);

    const projectPromises = snapshot.docs.map(async (docSnap) => {
      const pData = docSnap.data();

      // Fetch boards for this project
      const boardsPath = 'boards';
      const bQuery = query(
        collection(db, 'boards'),
        where('projectId', '==', docSnap.id),
        where('ownerId', '==', userId)
      );
      const boardsSnap = await getDocs(bQuery);

      let pages: WhiteboardPage[] = boardsSnap.docs
        .map((bDoc) => {
          const bData = bDoc.data();
          return {
            id: bData.id || bDoc.id,
            title: bData.title || 'Page',
            background: bData.background || 'grid',
            strokes: bData.strokes || [],
            pageNumber: bData.pageNumber || 0,
          };
        })
        .sort((a, b) => ((a as any).pageNumber ?? 0) - ((b as any).pageNumber ?? 0));

      if (pages.length === 0) {
        pages = [{ id: `pg_${Date.now()}`, title: 'Page 1', background: 'grid', strokes: [] }];
      }

      return {
        id: pData.id || docSnap.id,
        title: pData.title || 'Untitled Whiteboard',
        description: pData.description || '',
        subject: pData.subject || 'General',
        template: pData.template || 'blank',
        tags: pData.tags || [],
        createdAt: typeof pData.createdAt === 'string' ? new Date(pData.createdAt).getTime() : pData.createdAt || Date.now(),
        updatedAt: typeof pData.updatedAt === 'string' ? new Date(pData.updatedAt).getTime() : pData.updatedAt || Date.now(),
        isStarred: Boolean(pData.isStarred),
        pages,
      } as Project;
    });

    const cloudProjects = await Promise.all(projectPromises);
    return cloudProjects;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

/**
 * Save project to Firestore (debounced or explicit)
 * Stores strokes as structured vector data.
 */
export async function saveProjectToCloud(project: Project, userId: string): Promise<void> {
  const projectDocPath = `projects/${project.id}`;

  try {
    // 1. Save Project Metadata
    await setDoc(doc(db, 'projects', project.id), {
      id: project.id,
      ownerId: userId,
      title: project.title,
      description: project.description || '',
      subject: project.subject,
      template: project.template || 'blank',
      tags: project.tags || [],
      isStarred: Boolean(project.isStarred),
      version: 1,
      createdAt: new Date(project.createdAt).toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 2. Save each board page with structured vector strokes
    for (let i = 0; i < project.pages.length; i++) {
      const page = project.pages[i];
      const boardDocPath = `boards/${page.id}`;
      await setDoc(doc(db, 'boards', page.id), {
        id: page.id,
        projectId: project.id,
        ownerId: userId,
        pageNumber: i,
        title: page.title || `Page ${i + 1}`,
        background: page.background || 'grid',
        strokes: page.strokes || [],
        updatedAt: new Date().toISOString(),
      });
    }

    // Clear pending local draft flag on successful cloud sync
    clearLocalDraft(project.id);
  } catch (err) {
    // Fall back to local draft recovery
    saveLocalDraft(project, true);
    handleFirestoreError(err, OperationType.WRITE, projectDocPath);
  }
}

/**
 * Rename project in Firestore
 */
export async function renameProjectInCloud(projectId: string, newTitle: string, userId: string): Promise<void> {
  const path = `projects/${projectId}`;
  try {
    await updateDoc(doc(db, 'projects', projectId), {
      title: newTitle,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

/**
 * Delete project and associated boards from Firestore
 */
export async function deleteProjectFromCloud(projectId: string, userId: string): Promise<void> {
  const path = `projects/${projectId}`;
  try {
    // Delete project doc
    await deleteDoc(doc(db, 'projects', projectId));

    // Delete child board docs
    const bQuery = query(
      collection(db, 'boards'),
      where('projectId', '==', projectId),
      where('ownerId', '==', userId)
    );
    const snap = await getDocs(bQuery);
    const deleteOps = snap.docs.map((d) => deleteDoc(doc(db, 'boards', d.id)));
    await Promise.all(deleteOps);

    clearLocalDraft(projectId);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

/**
 * Save user preferences to Firestore
 */
export async function saveUserPreferencesToCloud(userId: string, prefs: Partial<UserSettings>): Promise<void> {
  const path = `user_preferences/${userId}`;
  try {
    await setDoc(
      doc(db, 'user_preferences', userId),
      {
        id: userId,
        ownerId: userId,
        theme: 'dark',
        handTrackingSensitivity: prefs.pinchSensitivity ?? 0.05,
        pinchThreshold: prefs.pinchSensitivity ?? 0.05,
        strokeSmoothing: prefs.smoothingFactor ?? 0.35,
        autoSaveDelayMs: (prefs.autoSaveInterval ?? 15) * 1000,
        defaultSubject: 'Mathematics',
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Log AI Session / educational interaction to Firestore
 */
export async function logAISessionToCloud(
  userId: string,
  session: {
    task: string;
    projectId?: string;
    prompt?: string;
    summary: string;
    confidence?: number;
  }
): Promise<void> {
  const sessionId = `ai_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const path = `ai_sessions/${sessionId}`;
  try {
    await setDoc(doc(db, 'ai_sessions', sessionId), {
      id: sessionId,
      ownerId: userId,
      projectId: session.projectId || '',
      task: session.task,
      prompt: session.prompt || '',
      summary: session.summary,
      confidence: session.confidence ?? 0.95,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    // Non-blocking log, fail softly with console log
    console.warn('Could not record AI session in cloud:', err);
  }
}

/**
 * Upload exported file (PDF, PNG) to Firebase Storage
 */
export async function uploadExportedFile(
  userId: string,
  fileName: string,
  blob: Blob
): Promise<string> {
  try {
    const fileRef = ref(storage, `users/${userId}/exports/${fileName}`);
    const snapshot = await uploadBytes(fileRef, blob);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (err) {
    console.warn('Storage upload error, returning local blob URL:', err);
    return URL.createObjectURL(blob);
  }
}

// --- CLASSROOM ENVIRONMENT & COLLABORATION ---

function generateClassCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export interface CreateClassroomInput {
  name: string;
  subject: string;
  description?: string;
  teacherId: string;
  teacherName: string;
  allowStudentDraw?: boolean;
}

/**
 * Teacher creates a new digital classroom
 */
export async function createClassroomInCloud(
  nameOrOptions: string | CreateClassroomInput,
  subject?: string,
  description?: string,
  teacherId?: string,
  teacherName?: string
): Promise<Classroom> {
  let name = '';
  let subj = '';
  let desc = '';
  let tId = '';
  let tName = '';
  let allowDraw = false;

  const currentUid = auth.currentUser?.uid || '';
  const currentDisplayName = auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'Teacher';

  if (typeof nameOrOptions === 'object') {
    name = nameOrOptions.name;
    subj = nameOrOptions.subject;
    desc = nameOrOptions.description || 'Interactive Touchless AI Classroom';
    tId = nameOrOptions.teacherId || currentUid;
    tName = nameOrOptions.teacherName || currentDisplayName;
    allowDraw = Boolean(nameOrOptions.allowStudentDraw);
  } else {
    // If called with (teacherId, teacherName, name, subject, description)
    if (nameOrOptions === currentUid || (teacherId && currentUid && teacherId === currentUid)) {
      if (nameOrOptions === currentUid) {
        tId = nameOrOptions;
        tName = subject || currentDisplayName;
        name = description || 'Touchless Classroom';
        subj = teacherId || 'General';
        desc = teacherName || 'Interactive Touchless AI Classroom';
      } else {
        name = nameOrOptions;
        subj = subject || 'General';
        desc = description || 'Interactive Touchless AI Classroom';
        tId = teacherId || currentUid;
        tName = teacherName || currentDisplayName;
      }
    } else {
      name = nameOrOptions;
      subj = subject || 'General';
      desc = description || 'Interactive Touchless AI Classroom';
      tId = teacherId || currentUid;
      tName = teacherName || currentDisplayName;
    }
  }

  // Ensure tId is always valid
  if (!tId && currentUid) {
    tId = currentUid;
  }

  const classroomId = `cls_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const code = generateClassCode();
  const path = `classrooms/${classroomId}`;

  const initialMember: ClassroomMember = {
    uid: tId,
    displayName: tName,
    role: 'teacher',
    joinedAt: Date.now(),
    isOnline: true,
  };

  const newClassroom: Classroom = {
    id: classroomId,
    code,
    name,
    subject: subj,
    description: desc || 'Interactive Touchless AI Classroom',
    teacherId: tId,
    teacherName: tName,
    activeSlideIndex: 0,
    isLiveSession: false,
    allowStudentDraw: allowDraw,
    members: [initialMember],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  try {
    await setDoc(doc(db, 'classrooms', classroomId), {
      ...newClassroom,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return newClassroom;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

/**
 * Student joins a classroom using a 6-character code
 */
export async function joinClassroomByCode(
  code: string,
  user: FirebaseUser,
  role: UserRole = 'student'
): Promise<Classroom> {
  const cleanCode = code.trim().toUpperCase();
  const path = 'classrooms';

  try {
    const q = query(collection(db, 'classrooms'), where('code', '==', cleanCode));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      throw new Error(`No classroom found with code "${cleanCode}". Please verify code with your teacher.`);
    }

    const docSnap = snapshot.docs[0];
    const data = docSnap.data();

    const members: ClassroomMember[] = Array.isArray(data.members) ? data.members : [];
    const existingIndex = members.findIndex((m) => m.uid === user.uid);

    let updatedMembers: ClassroomMember[];
    if (existingIndex >= 0) {
      // Already a member, update online status
      updatedMembers = members.map((m) => (m.uid === user.uid ? { ...m, isOnline: true } : m));
    } else {
      updatedMembers = [
        ...members,
        {
          uid: user.uid,
          displayName: user.displayName || user.email?.split('@')[0] || 'Student',
          role,
          joinedAt: Date.now(),
          isOnline: true,
        },
      ];
    }

    await updateDoc(doc(db, 'classrooms', docSnap.id), {
      members: updatedMembers,
      updatedAt: new Date().toISOString(),
    });

    return {
      id: docSnap.id,
      code: data.code,
      name: data.name,
      subject: data.subject,
      description: data.description || '',
      teacherId: data.teacherId,
      teacherName: data.teacherName,
      activeBoardId: data.activeBoardId,
      activeSlideIndex: data.activeSlideIndex || 0,
      isLiveSession: Boolean(data.isLiveSession),
      allowStudentDraw: Boolean(data.allowStudentDraw),
      members: updatedMembers,
      createdAt: typeof data.createdAt === 'string' ? new Date(data.createdAt).getTime() : data.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
  } catch (err) {
    if (err instanceof Error && err.message.includes('No classroom found')) {
      throw err;
    }
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

/**
 * Fetch all classrooms where the user is either the teacher or an enrolled member
 */
export async function fetchClassroomsForUser(userId: string): Promise<Classroom[]> {
  const path = 'classrooms';
  try {
    const snapshot = await getDocs(collection(db, 'classrooms'));
    const classrooms: Classroom[] = [];

    for (const d of snapshot.docs) {
      const data = d.data();
      const members: ClassroomMember[] = Array.isArray(data.members) ? data.members : [];
      const isTeacher = data.teacherId === userId;
      const isEnrolled = members.some((m) => m.uid === userId);

      if (isTeacher || isEnrolled) {
        classrooms.push({
          id: d.id,
          code: data.code,
          name: data.name,
          subject: data.subject,
          description: data.description || '',
          teacherId: data.teacherId,
          teacherName: data.teacherName,
          activeBoardId: data.activeBoardId,
          activeSlideIndex: data.activeSlideIndex || 0,
          isLiveSession: Boolean(data.isLiveSession),
          allowStudentDraw: Boolean(data.allowStudentDraw),
          members,
          createdAt: typeof data.createdAt === 'string' ? new Date(data.createdAt).getTime() : data.createdAt || Date.now(),
          updatedAt: typeof data.updatedAt === 'string' ? new Date(data.updatedAt).getTime() : data.updatedAt || Date.now(),
        });
      }
    }

    return classrooms;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

/**
 * Realtime listener for active classroom state (presentation slide, live drawing permission, presence)
 */
export function listenToClassroom(
  classroomId: string,
  onUpdate: (classroom: Classroom) => void
): () => void {
  const path = `classrooms/${classroomId}`;
  return onSnapshot(
    doc(db, 'classrooms', classroomId),
    (docSnap) => {
      if (!docSnap.exists()) return;
      const data = docSnap.data();
      onUpdate({
        id: docSnap.id,
        code: data.code,
        name: data.name,
        subject: data.subject,
        description: data.description || '',
        teacherId: data.teacherId,
        teacherName: data.teacherName,
        activeBoardId: data.activeBoardId,
        activeSlideIndex: data.activeSlideIndex || 0,
        isLiveSession: Boolean(data.isLiveSession),
        allowStudentDraw: Boolean(data.allowStudentDraw),
        members: Array.isArray(data.members) ? data.members : [],
        createdAt: typeof data.createdAt === 'string' ? new Date(data.createdAt).getTime() : data.createdAt || Date.now(),
        updatedAt: typeof data.updatedAt === 'string' ? new Date(data.updatedAt).getTime() : data.updatedAt || Date.now(),
      });
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, path);
    }
  );
}

/**
 * Update live classroom presentation controls (Teacher Only)
 */
export async function updateClassroomLiveSession(
  classroomId: string,
  updates: {
    isLiveSession?: boolean;
    activeBoardId?: string;
    activeSlideIndex?: number;
    allowStudentDraw?: boolean;
  }
): Promise<void> {
  const path = `classrooms/${classroomId}`;
  try {
    await updateDoc(doc(db, 'classrooms', classroomId), {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

/**
 * Publish shared whiteboard or notes or quiz to classroom
 */
export async function publishMaterialToClassroom(
  classroomId: string,
  teacherId: string,
  material: {
    type: 'whiteboard' | 'lesson_notes' | 'quiz' | 'flashcards';
    title: string;
    description: string;
    content: any;
  }
): Promise<ClassroomMaterial> {
  const materialId = `mat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const path = `classrooms/${classroomId}/materials/${materialId}`;

  const newMaterial: ClassroomMaterial = {
    id: materialId,
    classroomId,
    teacherId,
    type: material.type,
    title: material.title,
    description: material.description || '',
    content: material.content,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  try {
    await setDoc(doc(db, 'classrooms', classroomId, 'materials', materialId), {
      ...newMaterial,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return newMaterial;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

/**
 * Fetch all shared learning materials for a classroom
 */
export async function fetchClassroomMaterials(classroomId: string): Promise<ClassroomMaterial[]> {
  const path = `classrooms/${classroomId}/materials`;
  try {
    const snap = await getDocs(collection(db, 'classrooms', classroomId, 'materials'));
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        classroomId,
        teacherId: data.teacherId,
        type: data.type,
        title: data.title,
        description: data.description || '',
        content: data.content,
        createdAt: typeof data.createdAt === 'string' ? new Date(data.createdAt).getTime() : data.createdAt || Date.now(),
        updatedAt: typeof data.updatedAt === 'string' ? new Date(data.updatedAt).getTime() : data.updatedAt || Date.now(),
      } as ClassroomMaterial;
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

/**
 * Student submits quiz answers to classroom
 */
export async function submitQuizToClassroom(
  classroomId: string,
  submission: {
    quizMaterialId: string;
    studentId: string;
    studentName: string;
    score: number;
    totalQuestions: number;
    answers: number[];
  }
): Promise<ClassroomQuizSubmission> {
  const submissionId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const path = `classrooms/${classroomId}/submissions/${submissionId}`;

  const newSub: ClassroomQuizSubmission = {
    id: submissionId,
    classroomId,
    quizMaterialId: submission.quizMaterialId,
    studentId: submission.studentId,
    studentName: submission.studentName,
    score: submission.score,
    totalQuestions: submission.totalQuestions,
    answers: submission.answers,
    submittedAt: Date.now(),
  };

  try {
    await setDoc(doc(db, 'classrooms', classroomId, 'submissions', submissionId), {
      ...newSub,
      submittedAt: new Date().toISOString(),
    });
    return newSub;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

/**
 * Teacher reviews student quiz submissions
 */
export async function fetchClassroomSubmissions(classroomId: string): Promise<ClassroomQuizSubmission[]> {
  const path = `classrooms/${classroomId}/submissions`;
  try {
    const snap = await getDocs(collection(db, 'classrooms', classroomId, 'submissions'));
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        classroomId,
        quizMaterialId: data.quizMaterialId,
        studentId: data.studentId,
        studentName: data.studentName,
        score: data.score,
        totalQuestions: data.totalQuestions,
        answers: data.answers || [],
        submittedAt: typeof data.submittedAt === 'string' ? new Date(data.submittedAt).getTime() : data.submittedAt || Date.now(),
      } as ClassroomQuizSubmission;
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

/**
 * Delete a classroom material (Teacher only)
 */
export async function deleteClassroomMaterial(classroomId: string, materialId: string): Promise<void> {
  const path = `classrooms/${classroomId}/materials/${materialId}`;
  try {
    await deleteDoc(doc(db, 'classrooms', classroomId, 'materials', materialId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

/**
 * Update member online presence in classroom
 */
export async function updateClassroomMemberPresence(
  classroomId: string,
  userId: string,
  isOnline: boolean
): Promise<void> {
  if (!classroomId || classroomId.startsWith('demo_')) return;
  const path = `classrooms/${classroomId}`;
  try {
    const docRef = doc(db, 'classrooms', classroomId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const members: ClassroomMember[] = Array.isArray(data.members) ? data.members : [];
    const updated = members.map((m) => (m.uid === userId ? { ...m, isOnline } : m));
    await updateDoc(docRef, {
      members: updated,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Could not update member presence:', err);
  }
}


