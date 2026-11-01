import React, { useState } from 'react';
import { Project, LearningActivityStats, AppView } from '../../types';
import {
  Sparkles,
  Plus,
  Play,
  Flame,
  Hand,
  CheckCircle2,
  Clock,
  Star,
  Search,
  Filter,
  MoreVertical,
  Trash2,
  Copy,
  ExternalLink,
  BookOpen,
  Atom,
  Binary,
  Presentation,
  Sliders,
  ScanText,
  FolderOpen,
} from 'lucide-react';

interface DashboardViewProps {
  projects: Project[];
  stats: LearningActivityStats;
  onNavigate: (view: AppView) => void;
  onOpenNewBoard: () => void;
  onOpenProject: (project: Project) => void;
  onToggleStar: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onDuplicateProject: (id: string) => void;
  onOpenCalibration: () => void;
}

const AI_TUTOR_PROMPTS = [
  {
    subject: 'Calculus & Analysis',
    prompt: 'Derive Stokes\' Theorem and verify line integral flux equivalence.',
    icon: Binary,
  },
  {
    subject: 'Physics & Electromagnetism',
    prompt: 'Explain Lenz\'s law induced EMF opposing changes in magnetic flux.',
    icon: Atom,
  },
  {
    subject: 'Organic Chemistry',
    prompt: 'Diagram carbonyl nucleophilic addition with Grignard reagents.',
    icon: Sparkles,
  },
  {
    subject: 'Geometry Proofs',
    prompt: 'Step-by-step synthetic proof of Euler\'s line in arbitrary triangle.',
    icon: BookOpen,
  },
];

export const DashboardView: React.FC<DashboardViewProps> = ({
  projects,
  stats,
  onNavigate,
  onOpenNewBoard,
  onOpenProject,
  onToggleStar,
  onDeleteProject,
  onDuplicateProject,
  onOpenCalibration,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');

  // Filter projects
  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.subject.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag =
      selectedTag === 'all'
        ? true
        : selectedTag === 'starred'
        ? p.isStarred
        : p.subject.toLowerCase() === selectedTag.toLowerCase();
    return matchesSearch && matchesTag;
  });

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 max-w-7xl mx-auto w-full space-y-8">
      {/* Welcome Hero Section */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0C1529] via-[#0E1A36] to-[#0A1324] border border-blue-900/40 p-7 shadow-2xl">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span>TOUCHLESS AI WHITEBOARD ECOSYSTEM</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
              Write in the air. Think with AI. Create without limits.
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Step up to your screen, pinch your fingers in the air, and watch equations and sketches appear in real-time. Instant AI handwriting OCR, step-by-step STEM derivations, and interactive tutoring.
            </p>
          </div>

          {/* Quick Hero Actions */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => onNavigate('workspace')}
              className="px-5 py-3 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 rounded-xl transition-all shadow-lg shadow-blue-950/60 flex items-center gap-2 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Start Air Writing</span>
            </button>
            <button
              onClick={onOpenNewBoard}
              className="px-4 py-3 text-xs font-semibold text-slate-200 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 rounded-xl transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Board</span>
            </button>
          </div>
        </div>
      </section>

      {/* Learning Activity & Streak Metrics Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#0F172A] border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Air-Writing Streak</span>
            <Flame className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{stats.streakDays} Days</div>
          <p className="text-[11px] text-emerald-400 mt-1">● Active daily practice</p>
        </div>

        <div className="p-4 rounded-xl bg-[#0F172A] border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Gestures Mastered</span>
            <Hand className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{stats.gesturesMasteredCount} / 7</div>
          <p className="text-[11px] text-slate-400 mt-1">Pinch, Point, Palm, Fist, Swipes, Zoom</p>
        </div>

        <div className="p-4 rounded-xl bg-[#0F172A] border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>AI Problems Solved</span>
            <Sparkles className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{stats.problemsSolvedCount}</div>
          <p className="text-[11px] text-cyan-400 mt-1">Math & Science derivations</p>
        </div>

        <div className="p-4 rounded-xl bg-[#0F172A] border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Air Time This Week</span>
            <Clock className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{stats.weeklyMinutes} mins</div>
          <p className="text-[11px] text-slate-400 mt-1">85% of weekly learning goal</p>
        </div>
      </section>

      {/* Recent Projects Section */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Recent Whiteboards</h2>
            <p className="text-xs text-slate-400">Continue air writing where you left off</p>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search whiteboards..."
                className="pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 w-44 sm:w-56"
              />
            </div>

            {/* Filter tags */}
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
              {['all', 'starred', 'Mathematics', 'Physics', 'Chemistry'].map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedTag(t)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded capitalize cursor-pointer transition-colors ${
                    selectedTag === t
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Projects Grid */}
        {filteredProjects.length === 0 ? (
          <div className="p-10 rounded-xl bg-[#0F172A] border border-slate-800 text-center space-y-3">
            <FolderOpen className="w-8 h-8 text-slate-500 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-200">No Whiteboards Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Create a new touchless whiteboard to start writing in the air with computer vision.
            </p>
            <button
              onClick={onOpenNewBoard}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors"
            >
              Create New Board
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((p) => (
              <div
                key={p.id}
                className="group relative flex flex-col justify-between p-5 rounded-xl bg-[#0F172A] border border-slate-800/80 hover:border-slate-700 transition-all shadow-md hover:shadow-xl"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider">
                      {p.subject}
                    </span>
                    <button
                      onClick={() => onToggleStar(p.id)}
                      className={`p-1 rounded hover:bg-slate-800 transition-colors cursor-pointer ${
                        p.isStarred ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'
                      }`}
                      aria-label={p.isStarred ? 'Unstar' : 'Star'}
                    >
                      <Star className={`w-3.5 h-3.5 ${p.isStarred ? 'fill-amber-400' : ''}`} />
                    </button>
                  </div>

                  <h3
                    onClick={() => onOpenProject(p)}
                    className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors cursor-pointer line-clamp-1"
                  >
                    {p.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {p.description}
                  </p>

                  {/* Clean unboxed metadata with bullet separators */}
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-3 font-mono">
                    <span>{p.pages?.length || 1} {p.pages?.length === 1 ? 'Page' : 'Pages'}</span>
                    <span aria-hidden="true">·</span>
                    <span>{p.template}</span>
                    <span aria-hidden="true">·</span>
                    <span>{new Date(p.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Card footer actions */}
                <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-800/80 text-xs">
                  <button
                    onClick={() => onOpenProject(p)}
                    className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <span>Open Board</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onDuplicateProject(p.id)}
                      className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Duplicate"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteProject(p.id)}
                      className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* AI Tutor Quick Access & STEM Subjects */}
      <section className="space-y-4">
        <div className="pb-2 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white tracking-tight">AI STEM Tutor</h2>
          <p className="text-xs text-slate-400">Select an academic subject for instant air-board tutoring</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {AI_TUTOR_PROMPTS.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                onClick={() => onNavigate('ai-tutor')}
                className="p-4 rounded-xl bg-[#0F172A] border border-slate-800 hover:border-cyan-500/50 transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="p-2 w-fit rounded-lg bg-blue-600/20 text-cyan-400 mb-3 group-hover:scale-105 transition-transform">
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-bold text-white">{item.subject}</h3>
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">{item.prompt}</p>
                </div>
                <div className="mt-3 text-[11px] font-semibold text-cyan-400 flex items-center gap-1">
                  <span>Start Discussion</span>
                  <ExternalLink className="w-3 h-3" />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Quick Access Tools */}
      <section className="space-y-4">
        <div className="pb-2 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white tracking-tight">Quick Access Tools</h2>
          <p className="text-xs text-slate-400">Touchless calibration and classroom utilities</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div
            onClick={onOpenCalibration}
            className="p-4 rounded-xl bg-[#0F172A] border border-slate-800 hover:border-slate-700 transition-all cursor-pointer flex items-start gap-3"
          >
            <div className="p-2 rounded-lg bg-blue-600/20 text-cyan-400 shrink-0">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white">Gesture Calibration</h3>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                Adjust pinch distance thresholds, smoothing strength, and hand preference.
              </p>
            </div>
          </div>

          <div
            onClick={() => onNavigate('workspace')}
            className="p-4 rounded-xl bg-[#0F172A] border border-slate-800 hover:border-slate-700 transition-all cursor-pointer flex items-start gap-3"
          >
            <div className="p-2 rounded-lg bg-cyan-600/20 text-cyan-400 shrink-0">
              <ScanText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white">Handwriting OCR Engine</h3>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                Transcribe handwritten math formulas directly to clean LaTeX on the fly.
              </p>
            </div>
          </div>

          <div
            onClick={() => onNavigate('settings')}
            className="p-4 rounded-xl bg-[#0F172A] border border-slate-800 hover:border-slate-700 transition-all cursor-pointer flex items-start gap-3"
          >
            <div className="p-2 rounded-lg bg-purple-600/20 text-purple-400 shrink-0">
              <Presentation className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white">Classroom & Presenter Mode</h3>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                Project full-screen touchless whiteboard for smartboards and auditorium displays.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
