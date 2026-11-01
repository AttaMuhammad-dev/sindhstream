import React, { useState } from 'react';
import { Project } from '../../types';
import { X, Grid, BookOpen, FlaskConical, Network, Square } from 'lucide-react';

interface NewBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (project: Partial<Project>) => void;
}

const TEMPLATES = [
  {
    id: 'blank',
    title: 'Blank Canvas',
    description: 'Clean slate for freehand handwriting, fast sketches, and diagrams.',
    bg: 'blank',
    icon: Square,
  },
  {
    id: 'math_grid',
    title: 'Math & Coordinates',
    description: 'Crisp Cartesian grid ideal for calculus, geometry, and curve sketching.',
    bg: 'grid',
    icon: Grid,
  },
  {
    id: 'cornell',
    title: 'Cornell Notes',
    description: 'Structured layout with dedicated cue column, lecture body, and summary block.',
    bg: 'ruled',
    icon: BookOpen,
  },
  {
    id: 'lab_report',
    title: 'Science Lab Blueprint',
    description: 'Blueprint grid for circuit diagrams, lab instruments, and vector schematics.',
    bg: 'blueprint',
    icon: FlaskConical,
  },
  {
    id: 'concept_map',
    title: 'Concept & Mind Map',
    description: 'Dotted canvas for associative brainstorming, logic trees, and flowcharts.',
    bg: 'dots',
    icon: Network,
  },
] as const;

export const NewBoardModal: React.FC<NewBoardModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState<Project['subject']>('Mathematics');
  const [selectedTemplate, setSelectedTemplate] = useState<typeof TEMPLATES[number]['id']>('math_grid');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalTitle = title.trim() || `${subject} Board — ${new Date().toLocaleDateString()}`;
    const tpl = TEMPLATES.find((t) => t.id === selectedTemplate) || TEMPLATES[0];

    onCreate({
      title: finalTitle,
      subject,
      template: tpl.id as any,
      description: `Created with ${tpl.title} template.`,
      tags: [subject, tpl.title],
      pages: [
        {
          id: `page_${Date.now()}`,
          title: 'Page 1',
          background: tpl.bg as any,
          strokes: [],
        },
      ],
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-[#0F172A] border border-slate-800 rounded-xl shadow-2xl p-6 text-slate-100">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Create New Whiteboard</h2>
            <p className="text-xs text-slate-400 mt-0.5">Select a template and subject to begin touchless air writing</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {/* Board Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Board Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`e.g. Calculus III Flux Integrals or Chemistry Reaction Mechanism`}
              className="w-full px-3.5 py-2.5 bg-slate-900/90 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500"
            />
          </div>

          {/* STEM Subject Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Academic Subject
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science', 'General'] as const).map((sub) => (
                <button
                  key={sub}
                  type="button"
                  onClick={() => setSubject(sub)}
                  className={`px-3 py-2 text-xs font-medium rounded-lg border text-left transition-all ${
                    subject === sub
                      ? 'bg-blue-600/20 border-cyan-500 text-cyan-300'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>
          </div>

          {/* Template presets */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Whiteboard Template
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TEMPLATES.map((tpl) => {
                const Icon = tpl.icon;
                const isSelected = selectedTemplate === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setSelectedTemplate(tpl.id)}
                    className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-950/40 border-cyan-500 ring-1 ring-cyan-500/30'
                        : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-md shrink-0 ${
                        isSelected ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-200">{tpl.title}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">{tpl.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg hover:from-blue-500 hover:to-cyan-500 transition-all shadow-md shadow-blue-950 cursor-pointer"
            >
              Launch Workspace
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
