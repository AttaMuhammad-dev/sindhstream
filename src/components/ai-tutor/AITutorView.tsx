import React, { useState } from 'react';
import { Project, AITutorChatMessage, AppView } from '../../types';
import { sendAITutorChatMessage } from '../../services/geminiService';
import {
  Sparkles,
  Bot,
  User,
  Send,
  RefreshCw,
  ExternalLink,
  BookOpen,
  Atom,
  Binary,
  FlaskConical,
  Dna,
} from 'lucide-react';

interface AITutorViewProps {
  onNavigate: (view: AppView) => void;
  onStartBoardWithTopic: (subject: Project['subject'], title: string) => void;
}

const STEM_SUBJECTS: { id: Project['subject']; label: string; icon: any; prompts: string[] }[] = [
  {
    id: 'Mathematics',
    label: 'Mathematics & Calculus',
    icon: Binary,
    prompts: [
      'Explain Stokes\' Theorem and verify line integral flux equivalence.',
      'How to evaluate improper integrals using residue calculus?',
      'Step-by-step diagonalization of a 3x3 symmetric matrix.',
    ],
  },
  {
    id: 'Physics',
    label: 'Physics & Kinetics',
    icon: Atom,
    prompts: [
      'Explain Lenz\'s law and induced EMF opposing magnetic flux.',
      'Derive the Lagrangian for a simple double pendulum.',
      'Explain wave-particle duality and the Compton scattering formula.',
    ],
  },
  {
    id: 'Chemistry',
    label: 'Chemistry & Mechanisms',
    icon: FlaskConical,
    prompts: [
      'Compare SN1 vs SN2 nucleophilic substitution kinetics.',
      'Explain molecular orbital theory and bond order for O2.',
      'Diagram the Grignard addition to an aldehyde with arrow pushing.',
    ],
  },
  {
    id: 'Biology',
    label: 'Biology & Genetics',
    icon: Dna,
    prompts: [
      'Explain the Bohr effect and hemoglobin oxygen dissociation.',
      'Diagram the light-dependent reactions in thylakoid membranes.',
      'Explain CRISPR-Cas9 guide RNA targeting and cleavage mechanism.',
    ],
  },
];

export const AITutorView: React.FC<AITutorViewProps> = ({
  onNavigate,
  onStartBoardWithTopic,
}) => {
  const [selectedSubject, setSelectedSubject] = useState<Project['subject']>('Mathematics');
  const [chatInput, setChatInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<AITutorChatMessage[]>([
    {
      id: 'm_welcome',
      sender: 'tutor',
      text: `Welcome to the GestEra STEM Learning Center! I'm your interactive tutor for Mathematics, Physics, Chemistry, and Biology. \n\nSelect a subject or pick one of the core academic concepts below to get started. You can also write solutions in the air on the Whiteboard at any time!`,
      timestamp: Date.now(),
    },
  ]);

  const currentSubjectObj =
    STEM_SUBJECTS.find((s) => s.id === selectedSubject) || STEM_SUBJECTS[0];

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || chatInput).trim();
    if (!text || isLoading) return;

    if (!textToSend) setChatInput('');

    const userMsg: AITutorChatMessage = {
      id: `u_${Date.now()}`,
      sender: 'user',
      text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const resp = await sendAITutorChatMessage(text, messages, selectedSubject);
      setMessages((prev) => [
        ...prev,
        {
          id: `t_${Date.now()}`,
          sender: 'tutor',
          text: resp.reply,
          timestamp: Date.now(),
          isSimulated: resp.isSimulated,
        },
      ]);
    } catch (err) {
      console.error('Tutor chat failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col md:flex-row max-w-7xl mx-auto w-full p-6 gap-6 h-[calc(100vh-61px)]">
      {/* Left Subject Deck */}
      <div className="w-full md:w-80 flex flex-col gap-4 shrink-0">
        <div className="p-4 rounded-xl bg-[#0F172A] border border-slate-800">
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <Sparkles className="w-4 h-4" />
            <span>Academic STEM Disciplines</span>
          </div>
          <div className="space-y-1.5">
            {STEM_SUBJECTS.map((sub) => {
              const Icon = sub.icon;
              const isSelected = selectedSubject === sub.id;
              return (
                <button
                  key={sub.id}
                  onClick={() => setSelectedSubject(sub.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{sub.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Concept Prompts */}
        <div className="p-4 rounded-xl bg-[#0F172A] border border-slate-800 flex-1 overflow-y-auto space-y-2">
          <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Core Learning Concepts
          </div>
          {currentSubjectObj.prompts.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(prompt)}
              className="w-full p-2.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-left text-xs text-slate-300 hover:text-white hover:border-slate-700 transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between gap-1">
                <span className="line-clamp-2 leading-relaxed">{prompt}</span>
                <span className="text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
              </div>
            </button>
          ))}

          <div className="pt-2">
            <button
              onClick={() => onStartBoardWithTopic(selectedSubject, `${selectedSubject} Notes`)}
              className="w-full py-2.5 px-3 bg-gradient-to-r from-blue-950 to-slate-900 border border-cyan-800/60 hover:border-cyan-500 rounded-lg text-xs font-semibold text-cyan-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Air-Write This in Whiteboard</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Right Chat Conversation Stage */}
      <div className="flex-1 flex flex-col rounded-2xl bg-[#0A101D] border border-slate-800 overflow-hidden shadow-2xl">
        {/* Chat Header */}
        <div className="px-5 py-3.5 bg-[#0F172A] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-cyan-400 flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">{currentSubjectObj.label} Tutor</h2>
              <p className="text-[11px] text-slate-400">Powered by GestEra AI</p>
            </div>
          </div>

          <button
            onClick={() => onNavigate('workspace')}
            className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-cyan-300 border border-blue-900/60 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span>Open Air Board</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'tutor' && (
                <div className="w-7 h-7 rounded-lg bg-blue-600/30 text-cyan-300 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-none'
                    : 'bg-[#0F172A] border border-slate-800 text-slate-200 rounded-tl-none shadow-sm'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.text}</div>
                <div className="mt-2 text-[10px] text-slate-400 text-right">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              {msg.sender === 'user' && (
                <div className="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2.5 text-xs text-slate-400 animate-pulse p-2">
              <Bot className="w-4 h-4 text-cyan-400" />
              <span>GestEra Tutor is drafting an explanation...</span>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="p-4 bg-[#0F172A] border-t border-slate-800 flex gap-2.5"
        >
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder={`Ask a question or request a derivation for ${currentSubjectObj.label}...`}
            className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
          <button
            type="submit"
            disabled={!chatInput.trim() || isLoading}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span>Ask Tutor</span>
          </button>
        </form>
      </div>
    </div>
  );
};
