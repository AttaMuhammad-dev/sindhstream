import React, { useState } from 'react';
import type { QuizResult, FlashcardDeckResult } from '../../types/ai';
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Layers,
  Award,
} from 'lucide-react';

interface InteractiveQuizViewerProps {
  quizData?: QuizResult | null;
  flashcardData?: FlashcardDeckResult | null;
}

export const InteractiveQuizViewer: React.FC<InteractiveQuizViewerProps> = ({
  quizData,
  flashcardData,
}) => {
  const [mode, setMode] = useState<'quiz' | 'flashcards'>('quiz');

  // Quiz State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  // Flashcards State
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [masteredCards, setMasteredCards] = useState<Set<string>>(new Set());

  const questions = quizData?.questions || [];
  const currentQ = questions[currentQuestionIndex];

  const cards = flashcardData?.cards || [];
  const currentCard = cards[currentCardIndex];

  // Quiz handlers
  const handleSelectOption = (idx: number) => {
    if (isAnswerSubmitted) return;
    setSelectedOption(idx);
  };

  const handleSubmitAnswer = () => {
    if (selectedOption === null || isAnswerSubmitted || !currentQ) return;
    setIsAnswerSubmitted(true);
    if (selectedOption === currentQ.correctIndex) {
      setScore((prev) => prev + 1);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedOption(null);
      setIsAnswerSubmitted(false);
    } else {
      setQuizFinished(true);
    }
  };

  const handleRestartQuiz = () => {
    setCurrentQuestionIndex(0);
    setSelectedOption(null);
    setIsAnswerSubmitted(false);
    setScore(0);
    setQuizFinished(false);
  };

  // Flashcard handlers
  const handleToggleCardMastered = (cardId: string) => {
    setMasteredCards((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {/* Mode Switcher */}
      <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
        <button
          onClick={() => setMode('quiz')}
          className={`flex-1 py-1.5 rounded-md font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            mode === 'quiz' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Interactive Quiz ({questions.length})</span>
        </button>
        <button
          onClick={() => setMode('flashcards')}
          className={`flex-1 py-1.5 rounded-md font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            mode === 'flashcards' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Flashcard Deck ({cards.length})</span>
        </button>
      </div>

      {/* QUIZ MODE */}
      {mode === 'quiz' && (
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 space-y-3">
          {quizFinished ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-12 h-12 rounded-full bg-blue-600/20 text-cyan-400 flex items-center justify-center mx-auto">
                <Award className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-white">Quiz Completed!</h4>
              <p className="text-xs text-slate-300">
                You scored <strong className="text-cyan-400 text-sm font-bold">{score}</strong> out of{' '}
                <strong className="text-white text-sm">{questions.length}</strong> (
                {Math.round((score / Math.max(1, questions.length)) * 100)}%)
              </p>
              <button
                onClick={handleRestartQuiz}
                className="py-2 px-4 bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retake Quiz</span>
              </button>
            </div>
          ) : currentQ ? (
            <div className="space-y-3">
              {/* Question Header & Progress */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-2">
                <span>
                  Question {currentQuestionIndex + 1} of {questions.length}
                </span>
                <span className="font-mono text-cyan-400">Score: {score}</span>
              </div>

              <div className="text-xs font-semibold text-white leading-relaxed">
                {currentQ.question}
              </div>

              {/* Options */}
              <div className="space-y-1.5">
                {currentQ.options.map((opt, idx) => {
                  const isSelected = selectedOption === idx;
                  let optionStyle = 'bg-slate-950 hover:bg-slate-850 text-slate-300 border-slate-800';

                  if (isAnswerSubmitted) {
                    if (idx === currentQ.correctIndex) {
                      optionStyle = 'bg-emerald-950/80 border-emerald-500 text-emerald-200 font-medium';
                    } else if (isSelected) {
                      optionStyle = 'bg-rose-950/80 border-rose-500 text-rose-200';
                    } else {
                      optionStyle = 'bg-slate-950/50 text-slate-500 border-slate-900';
                    }
                  } else if (isSelected) {
                    optionStyle = 'bg-blue-900/60 border-blue-500 text-white';
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => handleSelectOption(idx)}
                      disabled={isAnswerSubmitted}
                      className={`w-full p-2.5 rounded-lg border text-left text-xs transition-all flex items-center justify-between cursor-pointer ${optionStyle}`}
                    >
                      <span>{opt}</span>
                      {isAnswerSubmitted && idx === currentQ.correctIndex && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                      {isAnswerSubmitted && isSelected && idx !== currentQ.correctIndex && (
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Explanation after submission */}
              {isAnswerSubmitted && (
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-300 leading-relaxed space-y-1 animate-in fade-in">
                  <div className="font-semibold text-cyan-300 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                    Explanation:
                  </div>
                  <p>{currentQ.explanation}</p>
                </div>
              )}

              {/* Action buttons */}
              <div className="pt-2 flex justify-end">
                {!isAnswerSubmitted ? (
                  <button
                    onClick={handleSubmitAnswer}
                    disabled={selectedOption === null}
                    className="py-2 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-semibold text-white rounded-lg transition-colors cursor-pointer"
                  >
                    Submit Answer
                  </button>
                ) : (
                  <button
                    onClick={handleNextQuestion}
                    className="py-2 px-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-xs font-semibold text-white rounded-lg inline-flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                  >
                    <span>{currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'View Results'}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center py-4">No quiz questions generated yet.</p>
          )}
        </div>
      )}

      {/* FLASHCARD MODE */}
      {mode === 'flashcards' && (
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 space-y-3">
          {currentCard ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-2">
                <span>
                  Card {currentCardIndex + 1} of {cards.length}
                </span>
                <span className="text-cyan-400">
                  {masteredCards.has(currentCard.id) ? 'Mastered ★' : 'Learning'}
                </span>
              </div>

              {/* Interactive Card */}
              <div
                onClick={() => setIsFlipped(!isFlipped)}
                className="min-h-[160px] p-5 rounded-xl bg-gradient-to-br from-slate-950 to-blue-950/40 border border-blue-900/50 hover:border-cyan-500/60 transition-all flex flex-col justify-between cursor-pointer shadow-lg select-none group"
              >
                <div className="text-[10px] uppercase font-mono text-cyan-400 tracking-wider">
                  {isFlipped ? 'Answer & Derivation (Click to flip)' : 'Question / Concept (Click to flip)'}
                </div>

                <div className="my-auto text-xs sm:text-sm font-medium text-slate-100 leading-relaxed text-center py-2">
                  {isFlipped ? currentCard.back : currentCard.front}
                </div>

                {currentCard.hint && !isFlipped && (
                  <div className="text-[10px] text-slate-400 italic text-center">
                    Hint: {currentCard.hint}
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => {
                    setCurrentCardIndex((prev) => Math.max(0, prev - 1));
                    setIsFlipped(false);
                  }}
                  disabled={currentCardIndex === 0}
                  className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 disabled:opacity-40 text-slate-300 cursor-pointer"
                  title="Previous Card"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleToggleCardMastered(currentCard.id)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer border ${
                    masteredCards.has(currentCard.id)
                      ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                      : 'bg-slate-950 border-slate-700 text-slate-300 hover:text-white'
                  }`}
                >
                  {masteredCards.has(currentCard.id) ? 'Marked Mastered ✓' : 'Mark as Mastered'}
                </button>

                <button
                  onClick={() => {
                    setCurrentCardIndex((prev) => Math.min(cards.length - 1, prev + 1));
                    setIsFlipped(false);
                  }}
                  disabled={currentCardIndex === cards.length - 1}
                  className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 disabled:opacity-40 text-slate-300 cursor-pointer"
                  title="Next Card"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center py-4">No flashcards available yet.</p>
          )}
        </div>
      )}
    </div>
  );
};
