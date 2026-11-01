/**
 * ClassroomView for AIRWRITE AI
 * Education-first classroom environment with Teacher & Student roles,
 * Realtime Firestore synchronization, Live Presentations, Shared Boards,
 * AI Quizzes, Notes scratchpad, and Student Submission Review.
 */

import React, { useState, useEffect, useRef } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import {
  Classroom,
  ClassroomMaterial,
  ClassroomQuizSubmission,
  UserRole,
  Project,
  HandTrackingState,
} from '../../types';
import {
  createClassroomInCloud,
  joinClassroomByCode,
  fetchClassroomsForUser,
  listenToClassroom,
  updateClassroomLiveSession,
  publishMaterialToClassroom,
  fetchClassroomMaterials,
  submitQuizToClassroom,
  fetchClassroomSubmissions,
  saveProjectToCloud,
  updateClassroomMemberPresence,
  deleteClassroomMaterial,
} from '../../services/firebase';
import { PresentationOverlay } from '../whiteboard/PresentationOverlay';
import {
  GraduationCap,
  Users,
  Radio,
  Tv,
  Plus,
  Share2,
  Copy,
  Check,
  BookOpen,
  Sparkles,
  Award,
  CheckCircle2,
  FileText,
  Lock,
  Unlock,
  ArrowRight,
  ExternalLink,
  MessageSquare,
  HelpCircle,
  RefreshCw,
  FolderPlus,
  Send,
  UserCheck,
  Shield,
  Layers,
  ChevronRight,
  UserPlus,
  Trash2,
  Link,
  Eye,
  CheckSquare,
  X,
  Play,
  RotateCcw,
} from 'lucide-react';

interface ClassroomViewProps {
  currentUser: FirebaseUser | null;
  projects: Project[];
  trackingState: HandTrackingState;
  onOpenProject: (project: Project) => void;
  onSaveProject: (project: Project) => void;
  onOpenAuth: () => void;
  userRole?: UserRole;
  onUpdateRole?: (newRole: UserRole) => void;
}

const INITIAL_DEMO_CLASSROOM: Classroom = {
  id: 'demo_classroom_stem',
  code: 'AIR982',
  name: 'Advanced STEM Air-Writing Lab',
  subject: 'Physics & Applied Mathematics',
  description: 'Live interactive air-drawn classroom with touchless demonstrations.',
  teacherId: 'teacher_demo_gauss',
  teacherName: 'Professor Alpha',
  activeSlideIndex: 0,
  isLiveSession: true,
  allowStudentDraw: true,
  members: [
    {
      uid: 'teacher_demo_gauss',
      displayName: 'Professor Alpha (Instructor)',
      role: 'teacher',
      joinedAt: Date.now() - 3600000,
      isOnline: true,
    },
    {
      uid: 'std_demo_1',
      displayName: 'Alex Chen',
      role: 'student',
      joinedAt: Date.now() - 1800000,
      isOnline: true,
    },
    {
      uid: 'std_demo_2',
      displayName: 'Maria Santos',
      role: 'student',
      joinedAt: Date.now() - 900000,
      isOnline: true,
    },
    {
      uid: 'std_demo_3',
      displayName: 'Liam Wilson',
      role: 'student',
      joinedAt: Date.now() - 300000,
      isOnline: false,
    },
  ],
  createdAt: Date.now() - 86400000,
  updatedAt: Date.now(),
};

export const ClassroomView: React.FC<ClassroomViewProps> = ({
  currentUser,
  projects,
  trackingState,
  onOpenProject,
  onSaveProject,
  onOpenAuth,
  userRole = 'teacher',
  onUpdateRole,
}) => {
  // Role switcher: Teacher or Student (defaults to userRole prop or 'teacher')
  const [activeRole, setActiveRole] = useState<UserRole>(userRole);

  useEffect(() => {
    if (userRole) {
      setActiveRole(userRole);
    }
  }, [userRole]);

  const handleRoleChange = (role: UserRole) => {
    setActiveRole(role);
    onUpdateRole?.(role);
  };

  const [classrooms, setClassrooms] = useState<Classroom[]>([INITIAL_DEMO_CLASSROOM]);
  const [selectedClassroom, setSelectedClassroom] = useState<Classroom | null>(INITIAL_DEMO_CLASSROOM);
  const [materials, setMaterials] = useState<ClassroomMaterial[]>([]);
  const [submissions, setSubmissions] = useState<ClassroomQuizSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copyCodeSuccess, setCopyCodeSuccess] = useState(false);
  const [copyInviteLinkSuccess, setCopyInviteLinkSuccess] = useState(false);

  // Tab inside classroom: 'live' | 'materials' | 'quizzes' | 'roster' | 'ai-tutor'
  const [classroomTab, setClassroomTab] = useState<'live' | 'materials' | 'quizzes' | 'roster' | 'ai-tutor'>('live');
  const [mobileViewSection, setMobileViewSection] = useState<'roster' | 'classroom'>('classroom');

  // Teacher Creation Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassSubject, setNewClassSubject] = useState('Mathematics & STEM');
  const [newClassDescription, setNewClassDescription] = useState('Interactive touchless air-writing classroom.');
  const [newClassAllowStudentDraw, setNewClassAllowStudentDraw] = useState(false);

  // Student Join Modal
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  // Invite Students Modal
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  // Material Creation Modal (Teacher)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareType, setShareType] = useState<'whiteboard' | 'lesson_notes' | 'quiz'>('whiteboard');
  const [selectedProjectIdToShare, setSelectedProjectIdToShare] = useState<string>(projects[0]?.id || '');
  const [materialTitle, setMaterialTitle] = useState('');
  const [materialNotes, setMaterialNotes] = useState('');

  // Manual Quiz Creator Modal (Teacher)
  const [isManualQuizModalOpen, setIsManualQuizModalOpen] = useState(false);
  const [manualQuizTitle, setManualQuizTitle] = useState('');
  const [manualQuizDesc, setManualQuizDesc] = useState('');
  const [manualQuizQuestions, setManualQuizQuestions] = useState<
    { question: string; options: string[]; correctAnswer: number; explanation: string }[]
  >([
    {
      question: 'What is the fundamental theorem connecting limits and derivatives?',
      options: [
        'Limits define the instantaneous rate of change as delta x approaches zero',
        'Limits only apply to integer series',
        'Derivatives cannot be evaluated using limits',
        'Derivatives represent the area under the curve',
      ],
      correctAnswer: 0,
      explanation: "By definition, f'(x) = lim_{h -> 0} [f(x+h) - f(x)] / h.",
    },
    {
      question: 'Which air gesture activates the presentation laser pointer in GestEra?',
      options: ['Open palm wave', 'Index finger pointing / air pinch', 'Two hand zoom', 'Full screen double click'],
      correctAnswer: 1,
      explanation: 'Extending the index finger or holding a gentle pinch focuses the glowing laser beam.',
    },
  ]);

  // Submission Inspection Modal (Teacher)
  const [inspectingSubmission, setInspectingSubmission] = useState<ClassroomQuizSubmission | null>(null);

  // AI Quiz Generator inside Classroom
  const [isGeneratingAIQuiz, setIsGeneratingAIQuiz] = useState(false);
  const [aiQuizTopic, setAiQuizTopic] = useState('Linear Equations & Graphs');

  // Active Presentation Mode state
  const [isPresentationOpen, setIsPresentationOpen] = useState(false);

  // Student Scratchpad Notes
  const [studentScratchpad, setStudentScratchpad] = useState<string>(
    '# Student Private Scratchpad\n- Key formulas:\n- Questions for teacher:\n- Next steps:'
  );
  const [clonedSuccessToast, setClonedSuccessToast] = useState<string | null>(null);

  // Active Quiz Taker state for Student
  const [activeQuizToTake, setActiveQuizToTake] = useState<ClassroomMaterial | null>(null);
  const [studentAnswers, setStudentAnswers] = useState<Record<number, number>>({});
  const [quizScoreResult, setQuizScoreResult] = useState<{ score: number; total: number } | null>(null);

  // Classroom AI Tutor Q&A state
  const [tutorQuery, setTutorQuery] = useState('');
  const [isTutorLoading, setIsTutorLoading] = useState(false);
  const [tutorResponses, setTutorResponses] = useState<
    { query: string; answer: string; steps?: string[]; timestamp: number }[]
  >([]);

  // Member presence heartbeat in Firestore
  useEffect(() => {
    if (!selectedClassroom?.id || !currentUser || selectedClassroom.id.startsWith('demo_')) return;
    updateClassroomMemberPresence(selectedClassroom.id, currentUser.uid, true);
    return () => {
      updateClassroomMemberPresence(selectedClassroom.id, currentUser.uid, false);
    };
  }, [selectedClassroom?.id, currentUser?.uid]);

  // Load classrooms on mount or role change
  // Load classrooms on mount or role change
  const loadClassrooms = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    const defaultDemoClassroom: Classroom = {
      id: 'demo_classroom_stem',
      code: 'AIR982',
      name: 'Advanced STEM Air-Writing Lab',
      subject: 'Physics & Applied Mathematics',
      description: 'Live interactive air-drawn classroom with touchless demonstrations.',
      teacherId: currentUser?.uid || 'teacher_demo_gauss',
      teacherName: currentUser?.displayName || 'Professor Alpha',
      activeSlideIndex: 0,
      isLiveSession: true,
      allowStudentDraw: true,
      members: [
        {
          uid: currentUser?.uid || 'teacher_demo_gauss',
          displayName: currentUser?.displayName || 'Professor Alpha (Instructor)',
          role: 'teacher',
          joinedAt: Date.now() - 3600000,
          isOnline: true,
        },
        {
          uid: 'std_demo_1',
          displayName: 'Alex Chen',
          role: 'student',
          joinedAt: Date.now() - 1800000,
          isOnline: true,
        },
        {
          uid: 'std_demo_2',
          displayName: 'Maria Santos',
          role: 'student',
          joinedAt: Date.now() - 900000,
          isOnline: true,
        },
        {
          uid: 'std_demo_3',
          displayName: 'Liam Wilson',
          role: 'student',
          joinedAt: Date.now() - 300000,
          isOnline: false,
        },
      ],
      createdAt: Date.now() - 86400000,
      updatedAt: Date.now(),
    };

    if (!currentUser) {
      setClassrooms([defaultDemoClassroom]);
      setSelectedClassroom(defaultDemoClassroom);
      setIsLoading(false);
      return;
    }

    try {
      const list = await fetchClassroomsForUser(currentUser.uid);
      if (list.length > 0) {
        setClassrooms(list);
        setSelectedClassroom((prev) => {
          if (!prev) return list[0];
          const matched = list.find((c) => c.id === prev.id);
          return matched || list[0];
        });
      } else {
        setClassrooms([defaultDemoClassroom]);
        setSelectedClassroom(defaultDemoClassroom);
      }
    } catch (err: any) {
      console.warn('Failed to load classrooms from cloud:', err);
      setClassrooms([defaultDemoClassroom]);
      setSelectedClassroom(defaultDemoClassroom);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadClassrooms();
  }, [currentUser]);

  // Realtime subscription to active classroom
  useEffect(() => {
    if (!selectedClassroom?.id || selectedClassroom.id.startsWith('demo_')) return;
    const unsubscribe = listenToClassroom(selectedClassroom.id, (updatedClassroom) => {
      setSelectedClassroom(updatedClassroom);
      setClassrooms((prev) => prev.map((c) => (c.id === updatedClassroom.id ? updatedClassroom : c)));
    });
    return () => unsubscribe();
  }, [selectedClassroom?.id]);

  // Load materials & submissions for selected classroom
  useEffect(() => {
    if (!selectedClassroom?.id) return;

    if (selectedClassroom.id.startsWith('demo_')) {
      // Mock demo materials
      setMaterials([
        {
          id: 'mat_demo_board_1',
          classroomId: selectedClassroom.id,
          teacherId: selectedClassroom.teacherId,
          type: 'whiteboard',
          title: 'Calculus: Derivatives & Rates of Change',
          description: 'Vector-drawn master whiteboard prepared with step-by-step air diagrams.',
          content: {
            projectTitle: 'Calculus: Derivatives & Rates of Change',
            pages: projects[0]?.pages || [],
          },
          createdAt: Date.now() - 7200000,
          updatedAt: Date.now() - 7200000,
        },
        {
          id: 'mat_demo_quiz_1',
          classroomId: selectedClassroom.id,
          teacherId: selectedClassroom.teacherId,
          type: 'quiz',
          title: 'Mid-Lecture Quiz: Calculus Derivatives',
          description: '3-question interactive diagnostic check on limits and power rule.',
          content: {
            questions: [
              {
                question: 'What is the derivative of f(x) = 3x^2 + 5x with respect to x?',
                options: ['6x + 5', '3x + 5', '6x^2 + 5', '5x'],
                correctAnswer: 0,
                explanation: 'Using the power rule d/dx[x^n] = n*x^(n-1): d/dx[3x^2] = 6x and d/dx[5x] = 5.',
              },
              {
                question: 'What is the limit of (x^2 - 4)/(x - 2) as x approaches 2?',
                options: ['0', '2', '4', 'Undefined'],
                correctAnswer: 2,
                explanation: 'Factor the numerator: (x - 2)(x + 2)/(x - 2) = x + 2. Substituting x=2 yields 4.',
              },
            ],
          },
          createdAt: Date.now() - 3600000,
          updatedAt: Date.now() - 3600000,
        },
      ]);
      setSubmissions([
        {
          id: 'sub_demo_1',
          classroomId: selectedClassroom.id,
          quizMaterialId: 'mat_demo_quiz_1',
          studentId: 'std_demo_1',
          studentName: 'Alex Chen',
          score: 2,
          totalQuestions: 2,
          answers: [0, 2],
          submittedAt: Date.now() - 1200000,
        },
      ]);
      return;
    }

    // Real cloud fetch
    const loadContent = async () => {
      try {
        const [mats, subs] = await Promise.all([
          fetchClassroomMaterials(selectedClassroom.id),
          fetchClassroomSubmissions(selectedClassroom.id),
        ]);
        setMaterials(mats);
        setSubmissions(subs);
      } catch (err) {
        console.warn('Failed to load classroom materials/submissions:', err);
      }
    };
    loadContent();
  }, [selectedClassroom?.id, projects]);

  // Create classroom handler (Teacher)
  const handleCreateClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newClassName.trim()) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const created = await createClassroomInCloud({
        name: newClassName.trim(),
        subject: newClassSubject.trim(),
        description: newClassDescription.trim(),
        teacherId: currentUser.uid,
        teacherName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Teacher',
        allowStudentDraw: newClassAllowStudentDraw,
      });
      setClassrooms((prev) => [created, ...prev]);
      setSelectedClassroom(created);
      setIsCreateModalOpen(false);
      setNewClassName('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create classroom.');
    } finally {
      setIsLoading(false);
    }
  };

  // Prepare a new lesson whiteboard (Teacher)
  const handlePrepareLessonBoard = () => {
    const subjectName = selectedClassroom?.subject || 'Mathematics';
    const newLessonProj: Project = {
      id: `proj_lesson_${Date.now()}`,
      title: `${selectedClassroom?.name || 'Classroom'} — Live Lesson Deck`,
      description: `Interactive lesson deck for ${subjectName} air-drawn presentation.`,
      subject: (['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science'].includes(subjectName)
        ? (subjectName as any)
        : 'Mathematics'),
      template: 'math_grid',
      tags: ['Classroom', 'Lesson Plan', 'Live Deck'],
      pages: [
        {
          id: `p1_${Date.now()}`,
          title: '1. Lesson Objectives & Axioms',
          background: 'grid',
          strokes: [],
        },
        {
          id: `p2_${Date.now()}`,
          title: '2. Step-by-Step Derivations & Diagrams',
          background: 'blueprint',
          strokes: [],
        },
        {
          id: `p3_${Date.now()}`,
          title: '3. Interactive Student Problem & Check',
          background: 'ruled',
          strokes: [],
        },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isStarred: true,
    };

    onSaveProject(newLessonProj);
    if (currentUser) {
      saveProjectToCloud(newLessonProj, currentUser.uid).catch(() => {});
    }
    onOpenProject(newLessonProj);
  };

  // Student saves their lecture scratchpad as a permanent personal notebook
  const handleSaveScratchpadAsProject = () => {
    const scratchpadProj: Project = {
      id: `proj_sc_${Date.now()}`,
      title: `${selectedClassroom?.name || 'Classroom'} — My Lecture Notes`,
      description: 'Private student notes & reflection from touchless live lecture.',
      subject: (['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science'].includes(
        selectedClassroom?.subject || ''
      )
        ? (selectedClassroom?.subject as any)
        : 'Mathematics'),
      template: 'cornell',
      tags: ['Student Notes', 'Classroom', 'Study Material'],
      pages: [
        {
          id: `p1_sc_${Date.now()}`,
          title: 'Lecture Notes',
          background: 'ruled',
          strokes: [],
        },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isStarred: false,
    };

    onSaveProject(scratchpadProj);
    if (currentUser) {
      saveProjectToCloud(scratchpadProj, currentUser.uid).catch(() => {});
    }
    setClonedSuccessToast('Saved scratchpad to your personal notebook in Projects!');
    setTimeout(() => setClonedSuccessToast(null), 3500);
  };

  // Delete a shared material (Teacher only)
  const handleDeleteMaterial = async (matId: string) => {
    if (!selectedClassroom) return;
    if (selectedClassroom.id.startsWith('demo_')) {
      setMaterials((prev) => prev.filter((m) => m.id !== matId));
      return;
    }
    try {
      await deleteClassroomMaterial(selectedClassroom.id, matId);
      setMaterials((prev) => prev.filter((m) => m.id !== matId));
    } catch (err: any) {
      alert(err.message || 'Failed to remove material');
    }
  };

  // Publish manual custom quiz (Teacher)
  const handlePublishManualQuiz = async () => {
    if (!selectedClassroom || !currentUser) return;
    if (!manualQuizTitle.trim()) {
      alert('Please enter a quiz title');
      return;
    }

    try {
      const newQuizMat = await publishMaterialToClassroom(selectedClassroom.id, currentUser.uid, {
        type: 'quiz',
        title: manualQuizTitle.trim(),
        description: manualQuizDesc.trim() || `Diagnostic check created by ${currentUser.displayName || 'Instructor'}.`,
        content: {
          topic: selectedClassroom.subject,
          questions: manualQuizQuestions,
        },
      });

      setMaterials((prev) => [newQuizMat, ...prev]);
      setIsManualQuizModalOpen(false);
      setManualQuizTitle('');
      setManualQuizDesc('');
      setClassroomTab('quizzes');
    } catch (err: any) {
      alert(err.message || 'Failed to publish custom quiz');
    }
  };

  // Join classroom handler (Student)
  const handleJoinClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !joinCodeInput.trim()) return;
    setIsJoining(true);
    setErrorMessage(null);

    try {
      const joined = await joinClassroomByCode(joinCodeInput.trim(), currentUser, 'student');
      setClassrooms((prev) => {
        const filtered = prev.filter((c) => c.id !== joined.id);
        return [joined, ...filtered];
      });
      setSelectedClassroom(joined);
      setIsJoinModalOpen(false);
      setJoinCodeInput('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid classroom code. Please double-check with your teacher.');
    } finally {
      setIsJoining(false);
    }
  };

  // Live session toggles (Teacher)
  const handleToggleLiveSession = async () => {
    if (!selectedClassroom) return;
    const nextLiveState = !selectedClassroom.isLiveSession;
    if (selectedClassroom.id.startsWith('demo_')) {
      setSelectedClassroom({ ...selectedClassroom, isLiveSession: nextLiveState });
      return;
    }
    await updateClassroomLiveSession(selectedClassroom.id, {
      isLiveSession: nextLiveState,
    });
  };

  const handleToggleStudentDrawing = async () => {
    if (!selectedClassroom) return;
    const nextDrawState = !selectedClassroom.allowStudentDraw;
    if (selectedClassroom.id.startsWith('demo_')) {
      setSelectedClassroom({ ...selectedClassroom, allowStudentDraw: nextDrawState });
      return;
    }
    await updateClassroomLiveSession(selectedClassroom.id, {
      allowStudentDraw: nextDrawState,
    });
  };

  const handleSlideChange = async (newSlideIndex: number) => {
    if (!selectedClassroom) return;
    if (selectedClassroom.id.startsWith('demo_')) {
      setSelectedClassroom({ ...selectedClassroom, activeSlideIndex: newSlideIndex });
      return;
    }
    await updateClassroomLiveSession(selectedClassroom.id, {
      activeSlideIndex: newSlideIndex,
    });
  };

  // Share whiteboard material (Teacher)
  const handleShareMaterial = async () => {
    if (!selectedClassroom || !currentUser) return;
    const proj = projects.find((p) => p.id === selectedProjectIdToShare);
    if (!proj && shareType === 'whiteboard') return;

    try {
      const content =
        shareType === 'whiteboard'
          ? {
              projectId: proj?.id,
              projectTitle: proj?.title,
              pages: proj?.pages || [],
            }
          : {
              notes: materialNotes,
            };

      const newMat = await publishMaterialToClassroom(selectedClassroom.id, currentUser.uid, {
        type: shareType,
        title: materialTitle.trim() || proj?.title || 'Classroom Whiteboard Material',
        description:
          shareType === 'whiteboard'
            ? `Shared whiteboard from ${proj?.title} with ${proj?.pages?.length || 1} slides.`
            : 'Lesson notes & revision material.',
        content,
      });

      setMaterials((prev) => [newMat, ...prev]);
      setIsShareModalOpen(false);
      setMaterialTitle('');
      setMaterialNotes('');
    } catch (err: any) {
      alert(err.message || 'Failed to publish material');
    }
  };

  // Generate AI Quiz for classroom (Teacher)
  const handleGenerateClassroomQuiz = async () => {
    if (!selectedClassroom || !currentUser) return;
    setIsGeneratingAIQuiz(true);
    try {
      const response = await fetch('/api/ai/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: aiQuizTopic,
          questionCount: 3,
        }),
      });
      const data = await response.json();
      const questions = data.questions || [
        {
          question: `Sample diagnostic on ${aiQuizTopic}`,
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          correctAnswer: 0,
          explanation: 'Standard concept verification.',
        },
      ];

      const newQuizMat = await publishMaterialToClassroom(selectedClassroom.id, currentUser.uid, {
        type: 'quiz',
        title: `AI Diagnostic Quiz: ${aiQuizTopic}`,
        description: `Instant ${questions.length}-question knowledge check for the class.`,
        content: {
          topic: aiQuizTopic,
          questions,
        },
      });

      setMaterials((prev) => [newQuizMat, ...prev]);
      setClassroomTab('quizzes');
    } catch (err) {
      console.error('Failed to generate AI quiz:', err);
    } finally {
      setIsGeneratingAIQuiz(false);
    }
  };

  // Student clones teacher whiteboard to their personal notebook
  const handleCloneWhiteboardToPersonal = (material: ClassroomMaterial) => {
    if (!material.content?.pages) return;
    const clonedProject: Project = {
      id: `proj_cloned_${Date.now()}`,
      title: `${material.title} (Classroom Copy)`,
      description: `Cloned from classroom: ${selectedClassroom?.name || 'Classroom'}`,
      subject: (['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science'].includes(selectedClassroom?.subject || '')
        ? (selectedClassroom?.subject as any)
        : 'Mathematics'),
      template: 'blank',
      tags: ['Classroom', 'Study Notes'],
      pages: material.content.pages,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isStarred: true,
    };

    onSaveProject(clonedProject);
    if (currentUser) {
      saveProjectToCloud(clonedProject, currentUser.uid).catch(() => {});
    }
    setClonedSuccessToast(`Saved "${material.title}" to your personal projects!`);
    setTimeout(() => setClonedSuccessToast(null), 3000);
  };

  // Student submits quiz
  const handleSubmitQuiz = async () => {
    if (!activeQuizToTake || !currentUser || !selectedClassroom) return;
    const questions = activeQuizToTake.content?.questions || [];
    let score = 0;
    const answersArr: number[] = [];

    questions.forEach((q: any, idx: number) => {
      const selectedOption = studentAnswers[idx] ?? -1;
      answersArr.push(selectedOption);
      if (selectedOption === q.correctAnswer) {
        score++;
      }
    });

    setQuizScoreResult({ score, total: questions.length });

    try {
      const sub = await submitQuizToClassroom(selectedClassroom.id, {
        quizMaterialId: activeQuizToTake.id,
        studentId: currentUser.uid,
        studentName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Student',
        score,
        totalQuestions: questions.length,
        answers: answersArr,
      });
      setSubmissions((prev) => [sub, ...prev]);
    } catch (err) {
      console.warn('Failed to save quiz submission to cloud:', err);
    }
  };

  // Ask AI Classroom Tutor
  const handleAskAITutor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tutorQuery.trim()) return;
    const q = tutorQuery.trim();
    setIsTutorLoading(true);
    setTutorQuery('');

    try {
      const res = await fetch('/api/ai/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concept: q,
          targetAudience: 'high school student',
        }),
      });
      const data = await res.json();
      setTutorResponses((prev) => [
        {
          query: q,
          answer: data.explanation || data.transcription || 'Explanation processed by GestEra AI.',
          steps: data.keyTakeaways || [],
          timestamp: Date.now(),
        },
        ...prev,
      ]);
    } catch (err) {
      setTutorResponses((prev) => [
        {
          query: q,
          answer: 'The rate of change or concept was analyzed. Review the teacher whiteboard notes for complete step-by-step derivational formulas.',
          timestamp: Date.now(),
        },
        ...prev,
      ]);
    } finally {
      setIsTutorLoading(false);
    }
  };

  // Copy classroom code to clipboard
  const handleCopyCode = () => {
    if (!selectedClassroom) return;
    navigator.clipboard.writeText(selectedClassroom.code);
    setCopyCodeSuccess(true);
    setTimeout(() => setCopyCodeSuccess(false), 2000);
  };

  // Current active pages for presentation or live view
  const currentBroadcastPages =
    projects.find((p) => p.id === selectedClassroom?.activeBoardId)?.pages ||
    projects[0]?.pages || [
      {
        id: 'p0',
        title: 'Classroom Live Slide',
        strokes: [],
        background: 'ruled',
      },
    ];

  const isTeacher = activeRole === 'teacher';

  return (
    <div className="flex-1 flex flex-col bg-[#070B14] text-slate-100 min-h-screen">
      {/* Top Banner: Role & Auth Status */}
      <div className="border-b border-slate-800 bg-[#0B1120]/80 px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white shadow-lg">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white flex items-center gap-2">
              <span>GestEra Classroom Environment</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                Education Core
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Touchless collaborative whiteboard, live slide broadcasting, interactive quizzes & personal study notebooks.
            </p>
          </div>
        </div>

        {/* Role Switcher Pill */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-900 border border-slate-700/80 p-1 rounded-xl">
            <button
              onClick={() => setActiveRole('teacher')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeRole === 'teacher'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Teacher Mode</span>
            </button>
            <button
              onClick={() => setActiveRole('student')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeRole === 'student'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Student Mode</span>
            </button>
          </div>

          {!currentUser && (
            <button
              onClick={onOpenAuth}
              className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-medium cursor-pointer transition-colors"
            >
              Sign In to Cloud
            </button>
          )}
        </div>
      </div>

      {/* Mobile Tab Switcher between Classes Roster and Active Room */}
      <div className="md:hidden flex items-center justify-between border-b border-slate-800 bg-[#090E1A] px-4 py-2.5 text-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileViewSection('roster')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              mobileViewSection === 'roster'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 bg-slate-850 hover:text-white'
            }`}
          >
            Classes ({classrooms.length})
          </button>
          <button
            onClick={() => setMobileViewSection('classroom')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              mobileViewSection === 'classroom'
                ? 'bg-cyan-600 text-white'
                : 'text-slate-400 bg-slate-850 hover:text-white'
            }`}
          >
            {selectedClassroom ? selectedClassroom.name : 'Classroom'}
          </button>
        </div>
        {selectedClassroom && (
          <span className="font-mono text-[11px] text-cyan-400 bg-slate-900 px-2 py-1 rounded border border-slate-800">
            {selectedClassroom.code}
          </span>
        )}
      </div>

      {/* Main Classroom Layout: Sidebar with Classroom List + Active Classroom Workspace */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Sidebar: Classrooms Roster & Controls */}
        <aside className={`w-full md:w-80 border-r border-slate-800 bg-[#090E1A]/70 flex-col shrink-0 ${mobileViewSection === 'roster' ? 'flex' : 'hidden md:flex'}`}>
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {isTeacher ? 'My Classrooms' : 'Enrolled Classes'}
            </span>
            {isTeacher ? (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create</span>
              </button>
            ) : (
              <button
                onClick={() => setIsJoinModalOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Join with Code</span>
              </button>
            )}
          </div>

          {/* Classrooms List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {classrooms.map((cls) => {
              const isSelected = selectedClassroom?.id === cls.id;
              const onlineCount = cls.members?.filter((m) => m.isOnline).length || 1;
              return (
                <div
                  key={cls.id}
                  onClick={() => {
                    setSelectedClassroom(cls);
                    setMobileViewSection('classroom');
                  }}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-950/40 border-cyan-500/60 shadow-lg ring-1 ring-cyan-500/30'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-white truncate max-w-[170px]">{cls.name}</span>
                    {cls.isLiveSession && (
                      <span className="px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-mono font-bold animate-pulse flex items-center gap-1">
                        <Radio className="w-2.5 h-2.5" />
                        LIVE
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mb-2">{cls.subject}</div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span className="flex items-center gap-1 text-slate-400">
                      <Users className="w-3 h-3 text-cyan-400" />
                      <span>{onlineCount} online</span>
                    </span>
                    <span className="bg-slate-800 px-1.5 py-0.5 rounded text-cyan-300">
                      Code: {cls.code}
                    </span>
                  </div>
                </div>
              );
            })}

            {classrooms.length === 0 && !isLoading && (
              <div className="p-6 text-center text-slate-500 text-xs">
                {isTeacher
                  ? 'No classrooms created yet. Click "Create" above to launch your first touchless interactive class.'
                  : 'You have not joined any classes yet. Click "Join with Code" and enter your teacher\'s 6-character code.'}
              </div>
            )}
          </div>

          {/* Quick Roster Stats at bottom of sidebar */}
          {selectedClassroom && (
            <div className="p-3.5 border-t border-slate-800 bg-slate-900/50">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span className="font-medium text-slate-300">Classroom Code</span>
                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
                >
                  {copyCodeSuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span className="font-mono font-bold">{selectedClassroom.code}</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Invite students with code <strong className="text-slate-300">{selectedClassroom.code}</strong>.
              </p>
            </div>
          )}
        </aside>

        {/* Right Main Stage: Classroom Content & Interactions */}
        {selectedClassroom ? (
          <main className={`flex-1 flex-col overflow-hidden ${mobileViewSection === 'classroom' ? 'flex' : 'hidden md:flex'}`}>
            {/* Classroom Header Bar */}
            <div className="p-4 border-b border-slate-800 bg-[#090D18] flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white">{selectedClassroom.name}</h2>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700 font-mono">
                    {selectedClassroom.subject}
                  </span>
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-3 mt-0.5">
                  <span>Instructor: <strong className="text-slate-200">{selectedClassroom.teacherName}</strong></span>
                  <span>•</span>
                  <span>{selectedClassroom.members?.length || 1} Enrolled Members</span>
                </div>
              </div>

              {/* Action Buttons for Teacher vs Student */}
              <div className="flex items-center gap-2 flex-wrap">
                {isTeacher ? (
                  <>
                    <button
                      onClick={handleToggleLiveSession}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                        selectedClassroom.isLiveSession
                          ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                      }`}
                      title={selectedClassroom.isLiveSession ? 'Stop Live Broadcast' : 'Start Live Broadcast'}
                    >
                      <Radio className="w-3.5 h-3.5" />
                      <span>{selectedClassroom.isLiveSession ? 'Broadcasting Live' : 'Go Live'}</span>
                    </button>

                    <button
                      onClick={() => setIsPresentationOpen(true)}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                    >
                      <Tv className="w-3.5 h-3.5" />
                      <span>Present Slide Deck</span>
                    </button>

                    <button
                      onClick={handlePrepareLessonBoard}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
                      title="Prepare a structured 3-page lesson board in the workspace"
                    >
                      <Layers className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Prepare Lesson Board</span>
                    </button>

                    <button
                      onClick={handleToggleStudentDrawing}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-all cursor-pointer ${
                        selectedClassroom.allowStudentDraw
                          ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-300'
                          : 'bg-slate-900 border-slate-700 text-slate-400'
                      }`}
                      title="Toggle whether students can annotate or only view"
                    >
                      {selectedClassroom.allowStudentDraw ? (
                        <>
                          <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Student Draw: Enabled</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5 text-amber-400" />
                          <span>View-Only Mode</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => setIsInviteModalOpen(true)}
                      className="px-3 py-1.5 rounded-lg bg-cyan-950/50 hover:bg-cyan-900/60 border border-cyan-500/40 text-cyan-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <UserPlus className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Invite Students</span>
                    </button>

                    <button
                      onClick={() => setIsShareModalOpen(true)}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Publish Material</span>
                    </button>
                  </>
                ) : (
                  <>
                    {selectedClassroom.isLiveSession ? (
                      <button
                        onClick={() => setIsPresentationOpen(true)}
                        className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 animate-pulse shadow-lg cursor-pointer"
                      >
                        <Radio className="w-3.5 h-3.5" />
                        <span>Join Live Slide Stream</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => setIsPresentationOpen(true)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                      >
                        <Tv className="w-3.5 h-3.5 text-cyan-400" />
                        <span>View Shared Slide Deck</span>
                      </button>
                    )}

                    <button
                      onClick={() => setIsInviteModalOpen(true)}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Class Code</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1 px-6 border-b border-slate-800 bg-[#0B101E]">
              {[
                { id: 'live', label: 'Live Presentation & Sync', icon: Tv },
                { id: 'materials', label: 'Shared Learning Boards', icon: BookOpen },
                { id: 'quizzes', label: 'Classroom Quizzes', icon: Award },
                { id: 'roster', label: 'Participant Presence', icon: Users },
                { id: 'ai-tutor', label: 'Classroom AI Tutor', icon: Sparkles },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = classroomTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setClassroomTab(tab.id as any)}
                    className={`px-4 py-3 text-xs font-medium flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                      isActive
                        ? 'border-cyan-400 text-cyan-300 font-semibold bg-cyan-950/20'
                        : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Cloned Toast Notification */}
            {clonedSuccessToast && (
              <div className="m-4 p-3 bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 rounded-xl text-xs flex items-center gap-2 shadow-xl animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{clonedSuccessToast}</span>
              </div>
            )}

            {/* Tab 1: Live Presentation & Sync */}
            {classroomTab === 'live' && (
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Live stream status card */}
                <div className="p-5 rounded-2xl bg-[#0C1322] border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                      <span className="text-sm font-semibold text-white">
                        {selectedClassroom.isLiveSession
                          ? 'Teacher is Presenting Live Slide'
                          : 'Classroom Presentation Waiting'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Realtime Firestore synchronized slide deck • Slide {selectedClassroom.activeSlideIndex + 1} of{' '}
                      {currentBroadcastPages.length}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsPresentationOpen(true)}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/20 flex items-center gap-2 cursor-pointer transition-all"
                    >
                      <Tv className="w-4 h-4" />
                      <span>Launch Fullscreen Presentation</span>
                    </button>
                  </div>
                </div>

                {/* Live Board Preview Canvas Container */}
                <div className="rounded-2xl border border-slate-800 bg-[#080C16] p-4 shadow-2xl">
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-semibold text-slate-200">
                        Slide {selectedClassroom.activeSlideIndex + 1}:{' '}
                        {currentBroadcastPages[selectedClassroom.activeSlideIndex]?.title || 'Lesson Overview'}
                      </span>
                    </div>

                    {isTeacher && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSlideChange(Math.max(0, selectedClassroom.activeSlideIndex - 1))}
                          disabled={selectedClassroom.activeSlideIndex === 0}
                          className="px-2 py-1 rounded bg-slate-800 text-xs text-slate-300 disabled:opacity-30 cursor-pointer"
                        >
                          Prev Slide
                        </button>
                        <span className="text-xs font-mono text-cyan-300">
                          {selectedClassroom.activeSlideIndex + 1} / {currentBroadcastPages.length}
                        </span>
                        <button
                          onClick={() =>
                            handleSlideChange(
                              Math.min(currentBroadcastPages.length - 1, selectedClassroom.activeSlideIndex + 1)
                            )
                          }
                          disabled={selectedClassroom.activeSlideIndex >= currentBroadcastPages.length - 1}
                          className="px-2 py-1 rounded bg-slate-800 text-xs text-slate-300 disabled:opacity-30 cursor-pointer"
                        >
                          Next Slide
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Render strokes visual */}
                  <div className="relative h-96 w-full rounded-xl bg-[#090D18] border border-slate-850 flex items-center justify-center overflow-hidden">
                    {currentBroadcastPages[selectedClassroom.activeSlideIndex]?.strokes?.length ? (
                      <div className="text-center p-6 space-y-2">
                        <div className="inline-flex p-3 rounded-full bg-cyan-500/10 text-cyan-400 mb-2">
                          <BookOpen className="w-6 h-6" />
                        </div>
                        <h4 className="text-sm font-semibold text-slate-200">
                          {currentBroadcastPages[selectedClassroom.activeSlideIndex].strokes.length} Vector Strokes Ready
                        </h4>
                        <p className="text-xs text-slate-400 max-w-sm">
                          Click "Launch Fullscreen Presentation" to view high-resolution strokes with air gesture slide
                          navigation and laser pointers.
                        </p>
                      </div>
                    ) : (
                      <div className="text-center p-6 text-slate-500 text-xs">
                        Slide is ready for teacher live drawing.
                      </div>
                    )}

                    {/* Permissions indicator */}
                    <div className="absolute bottom-3 left-4 text-[11px] font-mono text-slate-400 flex items-center gap-2 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800">
                      {selectedClassroom.allowStudentDraw ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <Unlock className="w-3 h-3" /> Collaboration Open: Students May Draw
                        </span>
                      ) : (
                        <span className="text-amber-400 flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Presenter Authoritative: View-Only
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Student Personal Notes Scratchpad (Only visible to students or for personal note-taking) */}
                <div className="rounded-2xl border border-slate-800 bg-[#0C1220] p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-cyan-400" />
                      <span className="text-sm font-semibold text-white">Personal Lecture Scratchpad</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">Private to your account</span>
                      <button
                        onClick={handleSaveScratchpadAsProject}
                        className="px-2.5 py-1 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/40 text-cyan-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
                        title="Save as permanent notebook in your Projects tab"
                      >
                        <FolderPlus className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Save as Notebook</span>
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={studentScratchpad}
                    onChange={(e) => setStudentScratchpad(e.target.value)}
                    rows={4}
                    placeholder="Type personal thoughts, formula insights or questions for the tutor..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
              </div>
            )}

            {/* Tab 2: Shared Learning Boards */}
            {classroomTab === 'materials' && (
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Shared Whiteboards & Lesson Notes</h3>
                    <p className="text-xs text-slate-400">
                      Materials published by the instructor for this classroom.
                    </p>
                  </div>
                  {isTeacher && (
                    <button
                      onClick={() => setIsShareModalOpen(true)}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Share New Board</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {materials
                    .filter((m) => m.type === 'whiteboard' || m.type === 'lesson_notes')
                    .map((mat) => (
                      <div
                        key={mat.id}
                        className="p-5 rounded-2xl bg-[#0C1220] border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-3 shadow-lg"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-blue-500/20 text-blue-300 border border-blue-500/30">
                              {mat.type === 'whiteboard' ? 'Whiteboard Deck' : 'Lesson Notes'}
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono">
                              {new Date(mat.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-white mt-1">{mat.title}</h4>
                          <p className="text-xs text-slate-400 mt-1 leading-relaxed">{mat.description}</p>
                        </div>

                        <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                          <button
                            onClick={() => handleCloneWhiteboardToPersonal(mat)}
                            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-cyan-950/60 border border-slate-700 hover:border-cyan-500/50 text-cyan-300 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
                            title="Clone to personal notebook for permanent offline study"
                          >
                            <FolderPlus className="w-3.5 h-3.5" />
                            <span>Save to My Notebook</span>
                          </button>

                          <div className="flex items-center gap-1.5">
                            {mat.content?.projectId && (
                              <button
                                onClick={() => {
                                  const found = projects.find((p) => p.id === mat.content.projectId);
                                  if (found) onOpenProject(found);
                                }}
                                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Open Board</span>
                              </button>
                            )}

                            {isTeacher && (
                              <button
                                onClick={() => handleDeleteMaterial(mat.id)}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                                title="Delete this material from classroom"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                  {materials.filter((m) => m.type === 'whiteboard' || m.type === 'lesson_notes').length === 0 && (
                    <div className="col-span-2 p-12 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl">
                      No shared boards published yet. Click "Share New Board" or "Prepare Lesson Board" to distribute a whiteboard to students.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 3: Classroom Quizzes */}
            {classroomTab === 'quizzes' && (
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Classroom Quizzes & Diagnostic Checks</h3>
                    <p className="text-xs text-slate-400">
                      Answer questions, test comprehension, and view automated AI grading.
                    </p>
                  </div>

                  {isTeacher && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => setIsManualQuizModalOpen(true)}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
                        title="Create quiz manually with custom questions and answers"
                      >
                        <Plus className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Manual Quiz</span>
                      </button>

                      <input
                        type="text"
                        value={aiQuizTopic}
                        onChange={(e) => setAiQuizTopic(e.target.value)}
                        placeholder="Quiz Topic..."
                        className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                      />
                      <button
                        onClick={handleGenerateClassroomQuiz}
                        disabled={isGeneratingAIQuiz}
                        className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{isGeneratingAIQuiz ? 'Generating AI...' : 'Create AI Quiz'}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Active Quiz Taker Modal/View if selected */}
                {activeQuizToTake ? (
                  <div className="p-6 rounded-2xl bg-[#0C1220] border border-cyan-500/40 shadow-2xl space-y-5">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <div>
                        <h4 className="text-base font-bold text-white">{activeQuizToTake.title}</h4>
                        <p className="text-xs text-slate-400">{activeQuizToTake.description}</p>
                      </div>
                      <button
                        onClick={() => {
                          setActiveQuizToTake(null);
                          setQuizScoreResult(null);
                          setStudentAnswers({});
                        }}
                        className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800 cursor-pointer"
                      >
                        Close Quiz
                      </button>
                    </div>

                    {/* Questions */}
                    <div className="space-y-6">
                      {(activeQuizToTake.content?.questions || []).map((q: any, qIdx: number) => (
                        <div key={qIdx} className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
                          <p className="text-sm font-semibold text-slate-200">
                            {qIdx + 1}. {q.question}
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {(q.options || []).map((opt: string, optIdx: number) => {
                              const isSelected = studentAnswers[qIdx] === optIdx;
                              const isCorrect = q.correctAnswer === optIdx;
                              let btnStyle = 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300';

                              if (quizScoreResult) {
                                if (isCorrect) {
                                  btnStyle = 'bg-emerald-950/60 border-emerald-500 text-emerald-200 font-bold';
                                } else if (isSelected && !isCorrect) {
                                  btnStyle = 'bg-rose-950/60 border-rose-500 text-rose-300';
                                }
                              } else if (isSelected) {
                                btnStyle = 'bg-cyan-950/70 border-cyan-500 text-cyan-200 font-semibold';
                              }

                              return (
                                <button
                                  key={optIdx}
                                  disabled={Boolean(quizScoreResult)}
                                  onClick={() =>
                                    setStudentAnswers((prev) => ({
                                      ...prev,
                                      [qIdx]: optIdx,
                                    }))
                                  }
                                  className={`p-3 rounded-lg border text-xs text-left transition-all cursor-pointer ${btnStyle}`}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>

                          {quizScoreResult && q.explanation && (
                            <div className="p-2.5 rounded-lg bg-blue-950/40 border border-blue-500/30 text-xs text-blue-200">
                              <strong>Explanation:</strong> {q.explanation}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Submit / Score Action */}
                    {!quizScoreResult ? (
                      <button
                        onClick={handleSubmitQuiz}
                        className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg cursor-pointer transition-all"
                      >
                        Submit Quiz for Grading
                      </button>
                    ) : (
                      <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/50 text-center space-y-1">
                        <div className="text-lg font-bold text-emerald-300">
                          Final Score: {quizScoreResult.score} / {quizScoreResult.total}
                        </div>
                        <p className="text-xs text-slate-300">
                          {Math.round((quizScoreResult.score / quizScoreResult.total) * 100)}% accuracy recorded to
                          classroom leaderboard.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {materials
                      .filter((m) => m.type === 'quiz')
                      .map((quiz) => {
                        const questionCount = quiz.content?.questions?.length || 0;
                        const sub = submissions.find((s) => s.quizMaterialId === quiz.id);

                        return (
                          <div
                            key={quiz.id}
                            className="p-5 rounded-2xl bg-[#0C1220] border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-4 shadow-lg"
                          >
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  {questionCount} Questions
                                </span>
                                {sub && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300">
                                    Score: {sub.score}/{sub.totalQuestions}
                                  </span>
                                )}
                              </div>
                              <h4 className="text-sm font-bold text-white mt-1">{quiz.title}</h4>
                              <p className="text-xs text-slate-400 mt-1">{quiz.description}</p>
                            </div>

                            <button
                              onClick={() => {
                                setActiveQuizToTake(quiz);
                                setQuizScoreResult(null);
                                setStudentAnswers({});
                              }}
                              className="w-full py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
                            >
                              <span>{sub ? 'Retake Quiz' : 'Start Quiz'}</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}

                    {materials.filter((m) => m.type === 'quiz').length === 0 && (
                      <div className="col-span-2 p-12 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl">
                        No quizzes published yet. Use the "Create AI Quiz" generator above to spin up a knowledge check.
                      </div>
                    )}
                  </div>
                )}

                {/* Submissions Review Table (Teacher Only) */}
                {isTeacher && submissions.length > 0 && (
                  <div className="mt-8 rounded-2xl border border-slate-800 bg-[#0C1220] p-5 space-y-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Student Quiz Submissions Review ({submissions.length})
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-500 font-mono">
                            <th className="py-2">Student</th>
                            <th className="py-2">Quiz ID</th>
                            <th className="py-2">Score</th>
                            <th className="py-2">Percentage</th>
                            <th className="py-2">Submitted</th>
                            <th className="py-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850 text-slate-300">
                          {submissions.map((sub) => (
                            <tr key={sub.id}>
                              <td className="py-2.5 font-medium text-white">{sub.studentName}</td>
                              <td className="py-2.5 font-mono text-slate-400 truncate max-w-[120px]">
                                {sub.quizMaterialId}
                              </td>
                              <td className="py-2.5 font-semibold text-cyan-300">
                                {sub.score} / {sub.totalQuestions}
                              </td>
                              <td className="py-2.5">
                                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 font-mono">
                                  {Math.round((sub.score / sub.totalQuestions) * 100)}%
                                </span>
                              </td>
                              <td className="py-2.5 text-slate-500 font-mono">
                                {new Date(sub.submittedAt).toLocaleTimeString()}
                              </td>
                              <td className="py-2.5 text-right">
                                <button
                                  onClick={() => setInspectingSubmission(sub)}
                                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer transition-colors"
                                  title="Review student's individual question answers"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>Review</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 4: Participant Presence */}
            {classroomTab === 'roster' && (
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Classroom Roster & Presence</h3>
                    <p className="text-xs text-slate-400">
                      Live participant status, roles, and classroom access permissions.
                    </p>
                  </div>
                  <span className="text-xs font-mono text-cyan-400">
                    {selectedClassroom.members?.length || 1} Total Members
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(selectedClassroom.members || []).map((member) => (
                    <div
                      key={member.uid}
                      className="p-4 rounded-xl bg-[#0C1220] border border-slate-800 flex items-center justify-between gap-3 shadow-md"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs text-cyan-300 border border-slate-700">
                            {member.displayName.substring(0, 2).toUpperCase()}
                          </div>
                          <span
                            className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-slate-900 ${
                              member.isOnline ? 'bg-emerald-400' : 'bg-slate-600'
                            }`}
                          />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-white truncate max-w-[130px]">
                            {member.displayName}
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">
                            {member.role === 'teacher' ? 'Instructor' : 'Student'}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                          member.isOnline
                            ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                            : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        {member.isOnline ? 'Active' : 'Offline'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 5: Classroom AI Tutor Q&A */}
            {classroomTab === 'ai-tutor' && (
              <div className="flex-1 overflow-y-auto p-6 flex flex-col space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span>Classroom AI Learning Assistant</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Ask questions on the current lecture, theorems, or step-by-step problem solutions.
                  </p>
                </div>

                {/* Question Input */}
                <form onSubmit={handleAskAITutor} className="flex gap-2">
                  <input
                    type="text"
                    value={tutorQuery}
                    onChange={(e) => setTutorQuery(e.target.value)}
                    placeholder="Ask about this lecture (e.g. 'How does the chain rule apply here?')..."
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="submit"
                    disabled={isTutorLoading || !tutorQuery.trim()}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md disabled:opacity-50 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isTutorLoading ? 'Thinking...' : 'Ask AI'}</span>
                  </button>
                </form>

                {/* Responses list */}
                <div className="space-y-4 flex-1">
                  {tutorResponses.map((res, idx) => (
                    <div key={idx} className="p-4 rounded-xl bg-[#0C1220] border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-cyan-300">
                        <span>Q: {res.query}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(res.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{res.answer}</p>
                      {res.steps && res.steps.length > 0 && (
                        <div className="pt-2 border-t border-slate-800/60 space-y-1">
                          <span className="text-[10px] uppercase font-mono text-slate-400 font-bold">Key Takeaways:</span>
                          <ul className="list-disc list-inside text-xs text-slate-300 space-y-0.5">
                            {res.steps.map((s, sIdx) => (
                              <li key={sIdx}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}

                  {tutorResponses.length === 0 && (
                    <div className="p-10 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                      No questions asked yet. Type any subject question above for immediate curriculum explanations.
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>
        ) : (
          <div className="flex-1 flex items-center justify-center p-12 text-center text-slate-500 text-sm">
            Select a classroom from the left sidebar or create one to begin.
          </div>
        )}
      </div>

      {/* Presentation Overlay Modal */}
      <PresentationOverlay
        isOpen={isPresentationOpen}
        onClose={() => setIsPresentationOpen(false)}
        pages={currentBroadcastPages}
        initialPageIndex={selectedClassroom?.activeSlideIndex || 0}
        trackingState={trackingState}
        presentationTitle={selectedClassroom?.name || 'Classroom Presentation'}
        isLiveBroadcast={Boolean(selectedClassroom?.isLiveSession)}
        userRole={activeRole}
        canAnnotate={isTeacher || Boolean(selectedClassroom?.allowStudentDraw)}
        onSlideChange={(newIdx) => handleSlideChange(newIdx)}
      />

      {/* Modal: Create Classroom (Teacher) */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0C1220] border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-blue-400" />
              <span>Create New Classroom</span>
            </h3>

            <form onSubmit={handleCreateClassroom} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Classroom Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AP Calculus & Physics Section A"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Subject</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mathematics & STEM"
                  value={newClassSubject}
                  onChange={(e) => setNewClassSubject(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={newClassDescription}
                  onChange={(e) => setNewClassDescription(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1 pb-1">
                <input
                  type="checkbox"
                  id="create-allow-draw"
                  checked={newClassAllowStudentDraw}
                  onChange={(e) => setNewClassAllowStudentDraw(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="create-allow-draw" className="text-xs text-slate-300 cursor-pointer">
                  Allow enrolled students to air-annotate during live presentations
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? 'Creating...' : 'Create & Generate Code'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Join Classroom (Student) */}
      {isJoinModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#0C1220] border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-400" />
              <span>Join Classroom with Code</span>
            </h3>

            <p className="text-xs text-slate-400">
              Enter the 6-character code provided by your teacher to join the live whiteboard session.
            </p>

            <form onSubmit={handleJoinClassroom} className="space-y-4">
              <div>
                <input
                  type="text"
                  required
                  maxLength={10}
                  placeholder="e.g. AIR982"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-3 text-center text-lg font-mono tracking-widest text-cyan-300 font-bold focus:outline-none focus:border-cyan-500"
                />
              </div>

              {errorMessage && <p className="text-xs text-rose-400">{errorMessage}</p>}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsJoinModalOpen(false)}
                  className="px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isJoining || !joinCodeInput.trim()}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isJoining ? 'Joining...' : 'Join Classroom'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Invite Students */}
      {isInviteModalOpen && selectedClassroom && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0C1220] border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-400" />
                <span>Invite Students to Classroom</span>
              </h3>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-gradient-to-br from-blue-950/40 via-slate-900 to-cyan-950/40 border border-blue-900/40 text-center space-y-2">
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Classroom Code</div>
              <div className="text-3xl font-extrabold tracking-widest font-mono text-cyan-300 select-all">
                {selectedClassroom.code}
              </div>
              <p className="text-xs text-slate-400">Share this code with your students for instant enrollment.</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Direct Join Code</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={selectedClassroom.code}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-cyan-300"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedClassroom.code);
                      setCopyCodeSuccess(true);
                      setTimeout(() => setCopyCodeSuccess(false), 2000);
                    }}
                    className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-md"
                  >
                    {copyCodeSuccess ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copyCodeSuccess ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Student Invite Message</label>
                <textarea
                  readOnly
                  rows={3}
                  value={`Join my GestEra Classroom: "${selectedClassroom.name}"\nSubject: ${selectedClassroom.subject}\nRoom Code: ${selectedClassroom.code}\nOpen GestEra and click 'Join Classroom' with this code to follow live boards & complete interactive quizzes.`}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 select-all font-sans leading-relaxed"
                />
                <button
                  onClick={() => {
                    const text = `Join my GestEra Classroom: "${selectedClassroom.name}"\nSubject: ${selectedClassroom.subject}\nRoom Code: ${selectedClassroom.code}\nOpen GestEra and click 'Join Classroom' with this code to follow live boards & complete interactive quizzes.`;
                    navigator.clipboard.writeText(text);
                    setCopyInviteLinkSuccess(true);
                    setTimeout(() => setCopyInviteLinkSuccess(false), 2000);
                  }}
                  className="mt-2 w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-700 cursor-pointer"
                >
                  {copyInviteLinkSuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copyInviteLinkSuccess ? 'Copied Invitation to Clipboard!' : 'Copy Invitation Message'}</span>
                </button>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <span className="font-semibold text-slate-300 block">Student Instructions:</span>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>Student switches to Student mode or signs into student account.</li>
                  <li>In the Classroom tab, student clicks <strong>Join Classroom</strong>.</li>
                  <li>Enter code <strong>{selectedClassroom.code}</strong> to connect to live broadcasts.</li>
                </ol>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Publish Material (Teacher) */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0C1220] border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Share2 className="w-5 h-5 text-cyan-400" />
              <span>Publish Material to Classroom</span>
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Material Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setShareType('whiteboard')}
                    className={`p-2.5 rounded-xl border text-xs font-medium cursor-pointer ${
                      shareType === 'whiteboard'
                        ? 'bg-blue-600 text-white border-blue-500'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    Whiteboard Deck
                  </button>
                  <button
                    type="button"
                    onClick={() => setShareType('lesson_notes')}
                    className={`p-2.5 rounded-xl border text-xs font-medium cursor-pointer ${
                      shareType === 'lesson_notes'
                        ? 'bg-blue-600 text-white border-blue-500'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    Lesson Notes
                  </button>
                </div>
              </div>

              {shareType === 'whiteboard' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Select Whiteboard to Distribute
                  </label>
                  <select
                    value={selectedProjectIdToShare}
                    onChange={(e) => setSelectedProjectIdToShare(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-200"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({p.pages.length} pages)
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Notes Content</label>
                  <textarea
                    rows={4}
                    placeholder="Type lesson revision notes or curriculum formulas..."
                    value={materialNotes}
                    onChange={(e) => setMaterialNotes(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-200"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Custom Title (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Chapter 4 Key Theorems"
                  value={materialTitle}
                  onChange={(e) => setMaterialTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-200"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsShareModalOpen(false)}
                  className="px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleShareMaterial}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  Publish to Students
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Manual Quiz Creator (Teacher) */}
      {isManualQuizModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#0C1220] border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-400" />
                <span>Create Educator Quiz</span>
              </h3>
              <button
                onClick={() => setIsManualQuizModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Quiz Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kinematics & Vector Equations"
                    value={manualQuizTitle}
                    onChange={(e) => setManualQuizTitle(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Instructions / Description</label>
                  <input
                    type="text"
                    placeholder="e.g. 5-question comprehension check"
                    value={manualQuizDesc}
                    onChange={(e) => setManualQuizDesc(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Questions ({manualQuizQuestions.length})
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setManualQuizQuestions((prev) => [
                        ...prev,
                        {
                          question: '',
                          options: ['Option A', 'Option B', 'Option C', 'Option D'],
                          correctAnswer: 0,
                          explanation: '',
                        },
                      ])
                    }
                    className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold flex items-center gap-1 border border-amber-500/30 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Question</span>
                  </button>
                </div>

                {manualQuizQuestions.map((q, qIdx) => (
                  <div key={qIdx} className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-400">Question {qIdx + 1}</span>
                      {manualQuizQuestions.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setManualQuizQuestions((prev) => prev.filter((_, idx) => idx !== qIdx))
                          }
                          className="p-1 text-slate-400 hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div>
                      <input
                        type="text"
                        placeholder="Type question prompt here..."
                        value={q.question}
                        onChange={(e) => {
                          const val = e.target.value;
                          setManualQuizQuestions((prev) =>
                            prev.map((item, idx) => (idx === qIdx ? { ...item, question: val } : item))
                          );
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[11px] text-slate-400 font-medium">
                        Options (select radio to mark correct answer):
                      </span>
                      {q.options.map((opt, oIdx) => (
                        <div key={oIdx} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`quiz_correct_${qIdx}`}
                            checked={q.correctAnswer === oIdx}
                            onChange={() =>
                              setManualQuizQuestions((prev) =>
                                prev.map((item, idx) =>
                                  idx === qIdx ? { ...item, correctAnswer: oIdx } : item
                                )
                              )
                            }
                            className="text-amber-500 focus:ring-amber-400 cursor-pointer"
                          />
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => {
                              const val = e.target.value;
                              setManualQuizQuestions((prev) =>
                                prev.map((item, idx) => {
                                  if (idx !== qIdx) return item;
                                  const newOpts = [...item.options];
                                  newOpts[oIdx] = val;
                                  return { ...item, options: newOpts };
                                })
                              );
                            }}
                            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1 text-xs text-slate-200"
                          />
                        </div>
                      ))}
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-0.5">Explanation / Derivation</label>
                      <input
                        type="text"
                        placeholder="Brief explanation shown after students submit..."
                        value={q.explanation}
                        onChange={(e) => {
                          const val = e.target.value;
                          setManualQuizQuestions((prev) =>
                            prev.map((item, idx) => (idx === qIdx ? { ...item, explanation: val } : item))
                          );
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1 text-xs text-slate-300"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsManualQuizModalOpen(false)}
                className="px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePublishManualQuiz}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-md cursor-pointer"
              >
                Publish Quiz to Classroom
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Submission Inspection (Teacher) */}
      {inspectingSubmission && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0C1220] border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-emerald-400" />
                  <span>Student Submission Review</span>
                </h3>
                <p className="text-xs text-slate-400">
                  {inspectingSubmission.studentName} &bull; {new Date(inspectingSubmission.submittedAt).toLocaleString()}
                </p>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono font-bold text-sm">
                Score: {inspectingSubmission.score} / {inspectingSubmission.totalQuestions} (
                {Math.round((inspectingSubmission.score / (inspectingSubmission.totalQuestions || 1)) * 100)}%)
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {inspectingSubmission.answers.map((rawAns, idx) => {
                const targetMat = materials.find((m) => m.id === inspectingSubmission.quizMaterialId);
                const matQ = targetMat?.content?.questions?.[idx];
                const isObj = typeof rawAns === 'object' && rawAns !== null;
                const questionText = isObj ? rawAns.question : (matQ?.question || `Question ${idx + 1}`);
                const options = isObj ? rawAns.options : (matQ?.options || []);
                const selectedOption = isObj ? rawAns.selectedOption : (rawAns as number);
                const correctOption = isObj ? rawAns.correctOption : (matQ?.correctAnswer ?? 0);
                const isCorrect = isObj ? rawAns.isCorrect : (selectedOption === correctOption);
                const explanation = isObj ? rawAns.explanation : matQ?.explanation;

                return (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-xl border ${
                      isCorrect
                        ? 'bg-emerald-950/20 border-emerald-900/40'
                        : 'bg-rose-950/20 border-rose-900/40'
                    } space-y-1.5`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-200">
                        Q{idx + 1}. {questionText}
                      </span>
                      <span
                        className={`text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded ${
                          isCorrect ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {isCorrect ? 'Correct' : 'Incorrect'}
                      </span>
                    </div>

                    <div className="text-xs space-y-0.5">
                      <div className="text-slate-400">
                        Student Answer:{' '}
                        <span className={isCorrect ? 'text-emerald-300 font-medium' : 'text-rose-300 font-medium'}>
                          {selectedOption !== undefined && selectedOption >= 0 && options[selectedOption]
                            ? options[selectedOption]
                            : 'No answer chosen'}
                        </span>
                      </div>
                      {!isCorrect && options[correctOption] && (
                        <div className="text-slate-400">
                          Correct Answer:{' '}
                          <span className="text-emerald-300 font-medium">
                            {options[correctOption]}
                          </span>
                        </div>
                      )}
                      {explanation && (
                        <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-800/50">
                          {explanation}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setInspectingSubmission(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer"
              >
                Close Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
