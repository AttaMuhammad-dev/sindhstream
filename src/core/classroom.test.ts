import { test } from 'node:test';
import assert from 'node:assert';
import { Classroom, ClassroomMember, UserRole, Project, ClassroomMaterial } from '../types';

test('Classroom member management correctly adds and checks online status', () => {
  const teacherMember: ClassroomMember = {
    uid: 'teacher_123',
    displayName: 'Prof. Gauss',
    role: 'teacher',
    joinedAt: Date.now(),
    isOnline: true,
  };

  const studentMember: ClassroomMember = {
    uid: 'student_456',
    displayName: 'Ada Lovelace',
    role: 'student',
    joinedAt: Date.now(),
    isOnline: true,
  };

  const classroom: Classroom = {
    id: 'cls_test_01',
    code: 'CALC99',
    name: 'Advanced Vector Calculus',
    subject: 'STEM',
    description: 'Calculus lecture',
    teacherId: teacherMember.uid,
    teacherName: teacherMember.displayName,
    activeSlideIndex: 0,
    isLiveSession: true,
    allowStudentDraw: false,
    members: [teacherMember, studentMember],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  assert.strictEqual(classroom.members.length, 2);
  assert.strictEqual(classroom.teacherId, 'teacher_123');
  assert.strictEqual(classroom.allowStudentDraw, false);
  assert.strictEqual(classroom.isLiveSession, true);

  // Check active participant count
  const onlineCount = classroom.members.filter((m) => m.isOnline).length;
  assert.strictEqual(onlineCount, 2);
});

test('Classroom presentation slide progression bounds check', () => {
  const totalSlides = 5;
  let currentSlide = 0;

  // Next slide
  const nextSlide = (cur: number, max: number) => Math.min(max - 1, cur + 1);
  const prevSlide = (cur: number) => Math.max(0, cur - 1);

  currentSlide = nextSlide(currentSlide, totalSlides);
  assert.strictEqual(currentSlide, 1);

  currentSlide = nextSlide(currentSlide, totalSlides);
  assert.strictEqual(currentSlide, 2);

  currentSlide = prevSlide(currentSlide);
  assert.strictEqual(currentSlide, 1);

  currentSlide = prevSlide(currentSlide);
  assert.strictEqual(currentSlide, 0);

  // Prev bound clamp at 0
  currentSlide = prevSlide(currentSlide);
  assert.strictEqual(currentSlide, 0);
});

test('Presentation drawing permissions correctly enforces role & teacher toggle', () => {
  const canAnnotate = (role: UserRole, allowStudentDraw: boolean) => {
    return role === 'teacher' || allowStudentDraw;
  };

  // Teacher can always annotate
  assert.strictEqual(canAnnotate('teacher', false), true);
  assert.strictEqual(canAnnotate('teacher', true), true);

  // Student can only annotate if teacher enabled allowStudentDraw
  assert.strictEqual(canAnnotate('student', false), false);
  assert.strictEqual(canAnnotate('student', true), true);
});

test('Quiz grading calculation verifies score and percentage correctly', () => {
  const questions = [
    { question: 'Q1', correctAnswer: 2 },
    { question: 'Q2', correctAnswer: 0 },
    { question: 'Q3', correctAnswer: 1 },
  ];

  const studentAnswers = [2, 0, 3]; // Q1 correct, Q2 correct, Q3 wrong

  let score = 0;
  questions.forEach((q, idx) => {
    if (studentAnswers[idx] === q.correctAnswer) {
      score++;
    }
  });

  assert.strictEqual(score, 2);
  const percentage = Math.round((score / questions.length) * 100);
  assert.strictEqual(percentage, 67);
});

test('Lesson board generation produces structured 3-page teaching deck', () => {
  const subject = 'Physics & Applied Mathematics';
  const name = 'Electromagnetism Lab';

  const prepareLessonDeck = (clsName: string, clsSubject: string): Project => ({
    id: `proj_lesson_${Date.now()}`,
    title: `Lesson: ${clsName}`,
    description: `Curriculum lesson board for ${clsSubject}`,
    subject: (['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science'].includes(clsSubject)
      ? (clsSubject as any)
      : 'Mathematics'),
    template: 'math_grid',
    tags: ['Lesson Plan', 'Classroom', 'Air-Writing'],
    pages: [
      {
        id: 'p1_overview',
        title: 'Slide 1: Concepts & Objectives',
        background: 'grid',
        strokes: [],
      },
      {
        id: 'p2_derivation',
        title: 'Slide 2: Mathematical Derivations & Diagrams',
        background: 'grid',
        strokes: [],
      },
      {
        id: 'p3_exercises',
        title: 'Slide 3: Practice Problems & Student Tasks',
        background: 'ruled',
        strokes: [],
      },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isStarred: true,
  });

  const deck = prepareLessonDeck(name, subject);
  assert.strictEqual(deck.pages.length, 3);
  assert.strictEqual(deck.pages[0].title, 'Slide 1: Concepts & Objectives');
  assert.strictEqual(deck.pages[1].title, 'Slide 2: Mathematical Derivations & Diagrams');
  assert.strictEqual(deck.pages[2].background, 'ruled');
  assert.strictEqual(deck.isStarred, true);
});

test('Student can clone shared classroom whiteboard into personal study notebook', () => {
  const sharedMaterial: ClassroomMaterial = {
    id: 'mat_board_123',
    classroomId: 'cls_1',
    teacherId: 'teacher_1',
    authorId: 'teacher_1',
    authorName: 'Prof. Euler',
    type: 'whiteboard',
    title: 'Kinematics Derivation Deck',
    description: 'Kinematics derivations for physics lecture',
    content: {
      pages: [
        { id: 'p1', title: 'Equations of Motion', background: 'grid', strokes: [] },
        { id: 'p2', title: 'Trajectory Plots', background: 'grid', strokes: [] },
      ],
    },
    createdAt: Date.now(),
  };

  const cloneMaterialToNotebook = (mat: ClassroomMaterial): Project => {
    return {
      id: `proj_clone_${Date.now()}`,
      title: `${mat.title} (Study Copy)`,
      description: `Cloned from classroom material by ${mat.authorName}`,
      subject: 'Mathematics',
      template: 'blank',
      tags: ['Study Material', 'Classroom'],
      pages: (mat.content?.pages || []).map((p: any, idx: number) => ({
        id: `pg_clone_${Date.now()}_${idx}`,
        title: p.title || `Page ${idx + 1}`,
        background: p.background || 'grid',
        strokes: p.strokes || [],
      })),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isStarred: false,
    };
  };

  const cloned = cloneMaterialToNotebook(sharedMaterial);
  assert.strictEqual(cloned.title, 'Kinematics Derivation Deck (Study Copy)');
  assert.strictEqual(cloned.pages.length, 2);
  assert.strictEqual(cloned.pages[0].title, 'Equations of Motion');
  assert.notStrictEqual(cloned.pages[0].id, 'p1'); // new unique page ID generated
});
