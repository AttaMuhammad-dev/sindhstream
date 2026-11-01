import React, { useState } from 'react';
import {
  Sparkles,
  Calculator,
  Type,
  GitBranch,
  BookOpen,
  HelpCircle,
  GraduationCap,
  MessageSquare,
  X,
  RefreshCw,
  Camera,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
  Send,
  Bot,
  User,
  Clock,
  Target,
  ListOrdered,
  FileCheck,
} from 'lucide-react';
import type { Project } from '../../types';
import type {
  AIEducationalTask,
  EducationalLevel,
  HandwritingRecognitionResult,
  MathSolutionResult,
  DiagramAnalysisResult,
  StudyNotesResult,
  QuizResult,
  FlashcardDeckResult,
  LessonPlanResult,
  ConceptExplanationResult,
} from '../../types/ai';
import {
  recognizeHandwritingFromCanvas,
  solveMathProblem,
  analyzeWhiteboardDiagram,
  generateStudyNotes,
  generateInteractiveQuiz,
  generateFlashcardDeck,
  generateLessonPlan,
  explainConceptFromCanvas,
} from '../../services/aiEducationalService';
import { auth, logAISessionToCloud } from '../../services/firebase';
import { sendAITutorChatMessage } from '../../services/geminiService';
import { MathGraphViewer } from './MathGraphViewer';
import { AmbiguityConfirmation } from './AmbiguityConfirmation';
import { InteractiveQuizViewer } from './InteractiveQuizViewer';

interface AIAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  currentSubject: Project['subject'];
  onInsertText?: (text: string) => void;
}

export const AIAssistantDrawer: React.FC<AIAssistantDrawerProps> = ({
  isOpen,
  onClose,
  canvasRef,
  currentSubject,
  onInsertText,
}) => {
  const [activeTab, setActiveTab] = useState<AIEducationalTask>('math');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Results State
  const [handwritingResult, setHandwritingResult] = useState<HandwritingRecognitionResult | null>(null);
  const [mathResult, setMathResult] = useState<MathSolutionResult | null>(null);
  const [diagramResult, setDiagramResult] = useState<DiagramAnalysisResult | null>(null);
  const [studyResult, setStudyResult] = useState<StudyNotesResult | null>(null);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [flashcardResult, setFlashcardResult] = useState<FlashcardDeckResult | null>(null);
  const [lessonPlanResult, setLessonPlanResult] = useState<LessonPlanResult | null>(null);
  const [conceptResult, setConceptResult] = useState<ConceptExplanationResult | null>(null);

  // Configuration inputs
  const [textInput, setTextInput] = useState('');
  const [educationalLevel, setEducationalLevel] = useState<EducationalLevel>('High School');

  // Tutor Chat
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; sender: 'user' | 'tutor'; text: string; timestamp: number }>>([
    {
      id: 'welcome',
      sender: 'tutor',
      text: `Hello! I'm your GestEra educational assistant. Capture any air-written problem on your whiteboard, solve equations with step-by-step graphs, transcribe handwriting, or generate interactive quizzes!`,
      timestamp: Date.now(),
    },
  ]);

  if (!isOpen) return null;

  const handleRunTask = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    const canvas = canvasRef.current;

    try {
      if (activeTab === 'handwriting') {
        const result = await recognizeHandwritingFromCanvas(canvas, currentSubject);
        setHandwritingResult(result);
        if (auth.currentUser) {
          logAISessionToCloud(auth.currentUser.uid, {
            task: 'handwriting',
            prompt: 'Whiteboard handwriting snapshot',
            summary: result.transcription,
            confidence: result.confidence,
          });
        }
      } else if (activeTab === 'math') {
        const result = await solveMathProblem(canvas, textInput || undefined, currentSubject);
        setMathResult(result);
        if (auth.currentUser) {
          logAISessionToCloud(auth.currentUser.uid, {
            task: 'math',
            prompt: result.recognizedEquation,
            summary: `Final: ${result.finalAnswer}. Steps: ${result.steps.length}`,
            confidence: result.confidence,
          });
        }
      } else if (activeTab === 'explain') {
        const result = await explainConceptFromCanvas(canvas, textInput || undefined, currentSubject, educationalLevel);
        setConceptResult(result);
        if (auth.currentUser) {
          logAISessionToCloud(auth.currentUser.uid, {
            task: 'explain',
            prompt: result.conceptTitle,
            summary: result.coreTakeaway,
            confidence: result.confidence,
          });
        }
      } else if (activeTab === 'diagram') {
        const result = await analyzeWhiteboardDiagram(canvas, textInput || `${currentSubject} Diagram`);
        setDiagramResult(result);
      } else if (activeTab === 'study_summary') {
        const result = await generateStudyNotes(canvas, textInput || undefined, currentSubject);
        setStudyResult(result);
      } else if (activeTab === 'quiz') {
        const qRes = await generateInteractiveQuiz(canvas, currentSubject, educationalLevel);
        const fRes = await generateFlashcardDeck(canvas, currentSubject);
        setQuizResult(qRes);
        setFlashcardResult(fRes);
      } else if (activeTab === 'lesson_plan') {
        const result = await generateLessonPlan(canvas, textInput || `${currentSubject} Module`, educationalLevel);
        setLessonPlanResult(result);
      }
    } catch (err: any) {
      console.error(`AI Task ${activeTab} failed:`, err);
      setErrorMessage(err.message || 'Operation failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendChatMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userText = chatInput.trim();
    setChatInput('');

    const userMsg = {
      id: `u_${Date.now()}`,
      sender: 'user' as const,
      text: userText,
      timestamp: Date.now(),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setIsChatLoading(true);

    try {
      const resp = await sendAITutorChatMessage(userText, [], currentSubject);
      setChatMessages((prev) => [
        ...prev,
        {
          id: `t_${Date.now()}`,
          sender: 'tutor' as const,
          text: resp.reply,
          timestamp: Date.now(),
        },
      ]);
    } catch (err: any) {
      console.error('Chat error:', err);
    } finally {
      setIsChatLoading(false);
    }
  };

  const tabs: { id: AIEducationalTask; label: string; icon: any }[] = [
    { id: 'ask', label: 'Ask AI', icon: MessageSquare },
    { id: 'math', label: 'Solve Math', icon: Calculator },
    { id: 'explain', label: 'Explain', icon: Lightbulb },
    { id: 'study_summary', label: 'Summarize', icon: BookOpen },
    { id: 'quiz', label: 'Generate Quiz', icon: HelpCircle },
    { id: 'handwriting', label: 'Convert to Text', icon: Type },
    { id: 'diagram', label: 'Diagram', icon: GitBranch },
    { id: 'lesson_plan', label: 'Lesson Plan', icon: GraduationCap },
  ];

  return (
    <aside
      className="fixed top-0 right-0 bottom-0 w-full sm:w-[460px] md:w-[490px] bg-[#0A101D] border-l border-slate-800 shadow-2xl z-40 flex flex-col text-slate-100"
              aria-label="GestEra educational assistant sidebar"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-[#0F172A]">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 text-white shadow-md">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              GestEra AI Education
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-900/60 text-cyan-300 border border-blue-800">
                Gemini 3.8
              </span>
            </h3>
            <span className="text-[11px] text-slate-400">Curriculum context: {currentSubject}</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          aria-label="Close AI Sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center border-b border-slate-800 bg-slate-900/80 px-2 py-1.5 overflow-x-auto gap-1 scrollbar-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Drawer Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {activeTab !== 'ask' && (
          <div className="p-4 rounded-xl bg-gradient-to-br from-blue-950/40 to-slate-900 border border-blue-900/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-cyan-400" />
                Whiteboard Snapshot Analysis
              </span>
              <span className="text-[10px] text-slate-400">Zero continuous upload</span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              {activeTab === 'math' && 'Transcribes and solves air-written equations step by step, with function graphs.'}
              {activeTab === 'explain' && 'Deconstructs whiteboard concepts, laws, and diagrams with analogies and foundational insights.'}
              {activeTab === 'handwriting' && 'Transcribes handwriting, detects ambiguous symbols, and allows one-click canvas insertion.'}
              {activeTab === 'diagram' && 'Deconstructs flowcharts, mind maps, and cycles into structural nodes and sequences.'}
              {activeTab === 'study_summary' && 'Synthesizes notes into high-yield revision summaries and memory aids.'}
              {activeTab === 'quiz' && 'Creates self-grading multiple-choice questions and interactive study flashcards.'}
              {activeTab === 'lesson_plan' && 'Builds a complete, pedagogical lesson plan adapted to target grade level.'}
            </p>

            {/* Optional Educational Level Selector for Explain, Quiz & Lesson Plan */}
            {(activeTab === 'explain' || activeTab === 'quiz' || activeTab === 'lesson_plan') && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">Target Level:</span>
                <select
                  value={educationalLevel}
                  onChange={(e) => setEducationalLevel(e.target.value as EducationalLevel)}
                  className="px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-lg text-xs text-cyan-300 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
                >
                  <option value="Elementary">Elementary School</option>
                  <option value="Middle School">Middle School</option>
                  <option value="High School">High School (Standard/AP)</option>
                  <option value="Undergraduate">College / Undergraduate</option>
                  <option value="Professional">Graduate / Professional</option>
                </select>
              </div>
            )}

            {/* Optional Text context / equation override */}
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={
                activeTab === 'math'
                  ? 'Optional: type equation or use board (e.g. f(x) = x^2 - 4)...'
                  : activeTab === 'explain'
                  ? 'Concept to explain (e.g. Lenz\'s Law, Chain Rule)...'
                  : activeTab === 'lesson_plan'
                  ? 'Topic (e.g. Kinematics, Integration, Photosynthesis)...'
                  : 'Optional prompt / focus instructions...'
              }
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
            />

            {/* Run Button */}
            <button
              onClick={handleRunTask}
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50 text-xs font-semibold text-white rounded-lg transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing with Gemini AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    {activeTab === 'math' && 'Solve & Graph Whiteboard'}
                    {activeTab === 'explain' && 'Explain Concept / Board'}
                    {activeTab === 'handwriting' && 'Transcribe Handwriting'}
                    {activeTab === 'diagram' && 'Analyze Whiteboard Diagram'}
                    {activeTab === 'study_summary' && 'Generate Study Summary'}
                    {activeTab === 'quiz' && 'Generate Quiz & Flashcards'}
                    {activeTab === 'lesson_plan' && 'Generate Adapted Lesson Plan'}
                  </span>
                </>
              )}
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={handleRunTask}
              className="px-2 py-1 bg-rose-900/60 hover:bg-rose-800 text-rose-200 rounded text-[11px] font-medium cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* 1. MATH SOLVER VIEW */}
        {activeTab === 'math' && mathResult && (
          <div className="space-y-3 animate-in fade-in">
            {/* Recognized equation shown first */}
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-cyan-400 mb-1 flex items-center justify-between">
                <span>Recognized Expression</span>
                <span className="text-[10px] font-mono text-slate-400">
                  Confidence: {(mathResult.confidence * 100).toFixed(0)}%
                </span>
              </div>
              <div className="font-mono text-sm text-cyan-200 p-2.5 bg-slate-950 rounded-lg border border-slate-800 overflow-x-auto">
                {mathResult.recognizedEquation}
              </div>
            </div>

            {/* Final Answer Banner */}
            <div className="p-3.5 rounded-xl bg-blue-950/50 border border-cyan-500/40 text-slate-100 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] uppercase font-mono text-cyan-300 font-bold">Final Solution</span>
                <div className="font-mono text-sm text-white font-bold">{mathResult.finalAnswer}</div>
              </div>
            </div>

            {/* Interactive Graph if graphable */}
            {mathResult.graphData && mathResult.graphData.hasGraph && (
              <MathGraphViewer graphData={mathResult.graphData} />
            )}

            {/* Step-by-Step Derivation */}
            {mathResult.steps && mathResult.steps.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ListOrdered className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Step-by-Step Derivation</span>
                </div>
                {mathResult.steps.map((step) => (
                  <div key={step.stepNumber} className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                    <div className="text-xs font-bold text-cyan-300 mb-1">
                      Step {step.stepNumber}: {step.title}
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed mb-1.5">{step.explanation}</p>
                    {step.formula && (
                      <div className="p-2 bg-slate-950 rounded border border-slate-800 font-mono text-xs text-cyan-400 overflow-x-auto">
                        {step.formula}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Suggestions & Concepts */}
            {mathResult.conceptsCovered && mathResult.conceptsCovered.length > 0 && (
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Concepts Tested
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {mathResult.conceptsCovered.map((c, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded bg-slate-800 text-[11px] text-slate-300 border border-slate-700"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. EXPLAIN CONCEPT VIEW */}
        {activeTab === 'explain' && conceptResult && (
          <div className="space-y-3 animate-in fade-in">
            {/* Concept Header */}
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800">
                  {conceptResult.educationalLevel} Level
                </span>
                <span className="text-[10px] font-mono text-cyan-400">
                  Confidence: {(conceptResult.confidence * 100).toFixed(0)}%
                </span>
              </div>
              <h4 className="text-sm font-bold text-white tracking-tight">{conceptResult.conceptTitle}</h4>
              <p className="text-xs text-slate-300 leading-relaxed">{conceptResult.explanation}</p>
              {conceptResult.confidenceReasoning && (
                <div className="text-[10px] font-mono text-slate-400 bg-slate-950/80 p-2 rounded border border-slate-800">
                  Confidence Evaluation: {conceptResult.confidenceReasoning}
                </div>
              )}
            </div>

            {/* Core Takeaway Banner */}
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-950/70 to-slate-900 border border-cyan-500/40 text-slate-100 flex items-start gap-2.5">
              <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] uppercase font-mono text-cyan-300 font-bold">Core Takeaway</span>
                <div className="text-xs text-slate-200 mt-0.5">{conceptResult.coreTakeaway}</div>
              </div>
            </div>

            {/* Step-by-Step Breakdown */}
            {conceptResult.steps && conceptResult.steps.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ListOrdered className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Logical Breakdown</span>
                </div>
                {conceptResult.steps.map((step) => (
                  <div key={step.stepNumber} className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                    <div className="text-xs font-bold text-cyan-300 mb-1">
                      {step.stepNumber}. {step.title}
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed mb-1.5">{step.explanation}</p>
                    {step.formula && (
                      <div className="p-2 bg-slate-950 rounded border border-slate-800 font-mono text-xs text-cyan-400 overflow-x-auto">
                        {step.formula}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Analogies */}
            {conceptResult.analogies && conceptResult.analogies.length > 0 && (
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                  <Lightbulb className="w-3.5 h-3.5" />
                  <span>Intuitive Analogies</span>
                </span>
                <ul className="text-xs text-slate-300 space-y-1 list-disc pl-4">
                  {conceptResult.analogies.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Suggestions */}
            {conceptResult.suggestions && conceptResult.suggestions.length > 0 && (
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Further Mastery & Practice
                </span>
                <ul className="text-xs text-slate-300 space-y-1 list-disc pl-4">
                  {conceptResult.suggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* 2. CONVERT TO TEXT & AMBIGUITY CONFIRMATION VIEW */}
        {activeTab === 'handwriting' && handwritingResult && (
          <div className="space-y-3 animate-in fade-in">
            <AmbiguityConfirmation
              initialTranscription={handwritingResult.transcription}
              ambiguities={handwritingResult.ambiguities}
              confidence={handwritingResult.confidence}
              onConfirmAndInsert={(text) => {
                if (onInsertText) {
                  onInsertText(text);
                }
              }}
              onCopy={(text) => {
                console.log('Copied transcription:', text);
              }}
            />

            {handwritingResult.notes && (
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 flex items-start gap-2">
                <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>{handwritingResult.notes}</span>
              </div>
            )}
          </div>
        )}

        {/* 3. DIAGRAM ASSISTANT VIEW */}
        {activeTab === 'diagram' && diagramResult && (
          <div className="space-y-3 animate-in fade-in">
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-900/60 text-cyan-300 border border-blue-800">
                  {diagramResult.diagramType}
                </span>
                <span className="text-[10px] text-slate-400">
                  Confidence: {(diagramResult.confidence * 100).toFixed(0)}%
                </span>
              </div>
              <h4 className="text-xs font-bold text-white">{diagramResult.title}</h4>
              <p className="text-xs text-slate-300 leading-relaxed">{diagramResult.summary}</p>
            </div>

            {/* Components & Nodes */}
            {diagramResult.components && diagramResult.components.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Identified Nodes & Components
                </span>
                <div className="space-y-1.5">
                  {diagramResult.components.map((c) => (
                    <div key={c.id} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-cyan-300">{c.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 uppercase">
                          {c.type}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300">{c.role}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sequence Flow */}
            {diagramResult.flowSequence && diagramResult.flowSequence.length > 0 && (
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Process Execution Flow
                </span>
                <ul className="text-xs text-slate-300 space-y-1 list-disc pl-4">
                  {diagramResult.flowSequence.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Suggestions */}
            {diagramResult.suggestions && diagramResult.suggestions.length > 0 && (
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                  <Lightbulb className="w-3.5 h-3.5" />
                  <span>Improvement Recommendations</span>
                </span>
                <ul className="text-xs text-slate-300 space-y-1 list-disc pl-4">
                  {diagramResult.suggestions.map((sug, idx) => (
                    <li key={idx}>{sug}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* 4. STUDY SUMMARY VIEW */}
        {activeTab === 'study_summary' && studyResult && (
          <div className="space-y-3 animate-in fade-in">
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
              <h4 className="text-xs font-bold text-cyan-300">{studyResult.topic}</h4>
              <p className="text-xs text-slate-300 leading-relaxed">{studyResult.summary}</p>
            </div>

            {/* Key Concepts */}
            {studyResult.keyConcepts && studyResult.keyConcepts.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Key Concept Definitions
                </span>
                {studyResult.keyConcepts.map((item, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-0.5">
                    <strong className="text-cyan-400">{item.term}:</strong>
                    <p className="text-slate-300 text-[11px] leading-relaxed">{item.definition}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Revision Bullets */}
            {studyResult.revisionBulletPoints && studyResult.revisionBulletPoints.length > 0 && (
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <FileCheck className="w-3.5 h-3.5 text-cyan-400" />
                  <span>High-Yield Revision Points</span>
                </span>
                <ul className="text-xs text-slate-300 space-y-1 list-disc pl-4">
                  {studyResult.revisionBulletPoints.map((point, idx) => (
                    <li key={idx}>{point}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* 5. INTERACTIVE QUIZ & FLASHCARDS VIEW */}
        {activeTab === 'quiz' && (
          <div className="animate-in fade-in">
            <InteractiveQuizViewer quizData={quizResult} flashcardData={flashcardResult} />
          </div>
        )}

        {/* 6. LESSON PLAN VIEW */}
        {activeTab === 'lesson_plan' && lessonPlanResult && (
          <div className="space-y-3 animate-in fade-in text-xs text-slate-300">
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-900/60 text-cyan-300 border border-blue-800">
                  {lessonPlanResult.gradeLevel}
                </span>
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-cyan-400" />
                  {lessonPlanResult.durationTotal}
                </span>
              </div>
              <h4 className="text-xs font-bold text-white">{lessonPlanResult.lessonTitle}</h4>
            </div>

            {/* Learning Objectives */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="font-semibold text-cyan-300 uppercase tracking-wider flex items-center gap-1">
                <Target className="w-3.5 h-3.5" />
                <span>Learning Objectives</span>
              </span>
              <ul className="space-y-1 list-disc pl-4">
                {lessonPlanResult.learningObjectives.map((obj, i) => (
                  <li key={i}>{obj}</li>
                ))}
              </ul>
            </div>

            {/* Sections Timetable */}
            <div className="space-y-1.5">
              <span className="font-semibold text-slate-300 uppercase tracking-wider">
                Lesson Workflow Timetable
              </span>
              {lessonPlanResult.sections.map((sec, idx) => (
                <div key={idx} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <strong className="text-white">{sec.title}</strong>
                    <span className="text-[10px] text-cyan-400 font-mono">{sec.durationMinutes} mins</span>
                  </div>
                  <p className="text-[11px] text-slate-400 italic">{sec.teacherScriptOrNotes}</p>
                </div>
              ))}
            </div>

            {/* Practice Exercises */}
            {lessonPlanResult.practiceExercises && lessonPlanResult.practiceExercises.length > 0 && (
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                <span className="font-semibold text-cyan-300 uppercase tracking-wider">
                  Practice Exercises & Solutions
                </span>
                {lessonPlanResult.practiceExercises.map((ex, i) => (
                  <div key={i} className="p-2 bg-slate-950 rounded border border-slate-800 space-y-1">
                    <p className="font-medium text-slate-200">Q: {ex.problem}</p>
                    <p className="text-cyan-400 font-mono text-[11px]">A: {ex.solution}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 7. TUTOR CHAT CONVERSATION VIEW */}
        {activeTab === 'ask' && (
          <div className="space-y-3">
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'tutor' && (
                  <div className="w-6 h-6 rounded-md bg-blue-600/30 text-cyan-300 flex items-center justify-center shrink-0 text-xs">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-xl p-3 text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-900 border border-slate-800 text-slate-200'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>
                {msg.sender === 'user' && (
                  <div className="w-6 h-6 rounded-md bg-slate-700 text-slate-300 flex items-center justify-center shrink-0 text-xs">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))}

            {isChatLoading && (
              <div className="flex gap-2 items-center text-xs text-slate-400 animate-pulse">
                <Bot className="w-3.5 h-3.5 text-cyan-400" />
                <span>GestEra Tutor is thinking...</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chat Input Footer (Visible only when in Ask AI tab) */}
      {activeTab === 'ask' && (
        <form onSubmit={handleSendChatMessage} className="p-3 border-t border-slate-800 bg-[#0F172A] flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder={`Ask a question about ${currentSubject}...`}
            className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
          <button
            type="submit"
            disabled={!chatInput.trim() || isChatLoading}
            className="p-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-colors cursor-pointer"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      )}
    </aside>
  );
};
