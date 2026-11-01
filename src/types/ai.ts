/**
 * Strict TypeScript models for AIRWRITE AI educational intelligence system
 * Covers Handwriting OCR, Mathematics, Diagrams, Study Assistant, Quizzes, Flashcards & Lesson Plans.
 */

export type AIEducationalTask =
  | 'handwriting'
  | 'math'
  | 'diagram'
  | 'study_summary'
  | 'quiz'
  | 'flashcards'
  | 'lesson_plan'
  | 'explain'
  | 'ask';

export type EducationalLevel =
  | 'Elementary'
  | 'Middle School'
  | 'High School'
  | 'Undergraduate'
  | 'Professional';

export interface ConceptExplanationResult {
  success: boolean;
  conceptTitle: string;
  recognizedContent: string;
  educationalLevel: EducationalLevel;
  confidence: number;
  confidenceReasoning: string;
  explanation: string;
  steps: MathStep[];
  coreTakeaway: string;
  suggestions: string[];
  analogies: string[];
  isSimulated?: boolean;
  error?: string;
}

export interface AmbiguityItem {
  id: string;
  character: string;
  alternatives: string[];
  selected: string;
  position?: number;
  context?: string;
}

export interface HandwritingRecognitionResult {
  success: boolean;
  transcription: string;
  confidence: number; // Calibrated 0.0 to 1.0
  isMath: boolean;
  ambiguities: AmbiguityItem[];
  needsConfirmation: boolean;
  detectedSubject?: string;
  notes?: string;
  isSimulated?: boolean;
  error?: string;
}

export interface MathStep {
  stepNumber: number;
  title: string;
  explanation: string;
  formula?: string;
}

export interface MathGraphPoint {
  x: number;
  y: number;
}

export interface MathGraphData {
  hasGraph: boolean;
  functionExpression: string; // e.g. "f(x) = x^2 - 4"
  domain: [number, number];   // e.g. [-5, 5]
  range?: [number, number];   // e.g. [-6, 10]
  points: MathGraphPoint[];
  roots?: number[];
  extrema?: { type: 'min' | 'max'; x: number; y: number }[];
  label?: string;
}

export interface MathSolutionResult {
  success: boolean;
  recognizedEquation: string;
  subjectArea: string;
  confidence: number;
  steps: MathStep[];
  finalAnswer: string;
  graphData?: MathGraphData;
  conceptsCovered: string[];
  suggestions: string[];
  isSimulated?: boolean;
  error?: string;
}

export interface DiagramComponent {
  id: string;
  name: string;
  type: 'process' | 'decision' | 'start_end' | 'entity' | 'data' | 'system' | 'other';
  role: string;
  connectedTo: string[];
}

export interface DiagramAnalysisResult {
  success: boolean;
  diagramType: 'Flowchart' | 'Mind Map' | 'Architecture' | 'Biological/Chemical Cycle' | 'Schematic' | 'Concept Hierarchy';
  title: string;
  summary: string;
  confidence: number;
  components: DiagramComponent[];
  flowSequence: string[];
  suggestions: string[];
  identifiedIssues?: string[];
  isSimulated?: boolean;
  error?: string;
}

export interface StudyConceptItem {
  term: string;
  definition: string;
}

export interface StudyNotesResult {
  success: boolean;
  topic: string;
  summary: string;
  keyConcepts: StudyConceptItem[];
  revisionBulletPoints: string[];
  memoryTips?: string[];
  isSimulated?: boolean;
  error?: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface QuizResult {
  success: boolean;
  title: string;
  subject: string;
  difficulty: EducationalLevel;
  questions: QuizQuestion[];
  isSimulated?: boolean;
  error?: string;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  hint?: string;
  category?: string;
}

export interface FlashcardDeckResult {
  success: boolean;
  title: string;
  subject: string;
  cards: Flashcard[];
  isSimulated?: boolean;
  error?: string;
}

export interface LessonPlanSection {
  title: string;
  durationMinutes: number;
  activities: string[];
  teacherScriptOrNotes: string;
}

export interface LessonPracticeProblem {
  problem: string;
  solution: string;
  difficulty?: 'Easy' | 'Medium' | 'Challenging';
}

export interface LessonPlanResult {
  success: boolean;
  lessonTitle: string;
  gradeLevel: EducationalLevel;
  durationTotal: string;
  learningObjectives: string[];
  prerequisites: string[];
  materialsNeeded: string[];
  sections: LessonPlanSection[];
  practiceExercises: LessonPracticeProblem[];
  assessmentCriteria: string[];
  isSimulated?: boolean;
  error?: string;
}

export interface AIAssistantRequestPayload {
  task: AIEducationalTask;
  imageBase64?: string;
  textInput?: string;
  subject?: string;
  educationalLevel?: EducationalLevel;
  difficulty?: EducationalLevel;
}
