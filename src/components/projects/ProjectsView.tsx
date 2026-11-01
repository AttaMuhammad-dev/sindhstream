import React, { useState } from 'react';
import { Project, AppView } from '../../types';
import {
  FolderOpen,
  Search,
  Star,
  Copy,
  Trash2,
  ExternalLink,
  Plus,
  Grid as GridIcon,
  List as ListIcon,
  Calendar,
  Layers,
  Edit2,
  Check,
  X as CloseIcon,
} from 'lucide-react';

interface ProjectsViewProps {
  projects: Project[];
  onOpenProject: (project: Project) => void;
  onNewBoard: () => void;
  onToggleStar: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onDuplicateProject: (id: string) => void;
  onRenameProject: (id: string, newTitle: string) => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  projects,
  onOpenProject,
  onNewBoard,
  onToggleStar,
  onDeleteProject,
  onDuplicateProject,
  onRenameProject,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [onlyStarred, setOnlyStarred] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const startRename = (p: Project) => {
    setEditingId(p.id);
    setEditTitle(p.title);
  };

  const saveRename = (id: string) => {
    if (editTitle.trim()) {
      onRenameProject(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const filtered = projects.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesSubject = selectedSubject === 'all' || p.subject === selectedSubject;
    const matchesStarred = !onlyStarred || p.isStarred;
    return matchesSearch && matchesSubject && matchesStarred;
  });

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Project History & Library</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage your touchless air whiteboard sessions, STEM notes, and classroom diagrams
          </p>
        </div>

        <button
          onClick={onNewBoard}
          className="px-4 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 rounded-lg transition-all shadow-md flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Whiteboard</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[#0F172A] p-3 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, topic, or tags..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <button
            onClick={() => setOnlyStarred(!onlyStarred)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 cursor-pointer transition-colors ${
              onlyStarred
                ? 'bg-amber-950/60 border-amber-600/80 text-amber-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${onlyStarred ? 'fill-amber-400' : ''}`} />
            <span>Starred</span>
          </button>
        </div>

        {/* Subject Filter pills and View Mode */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="px-3 py-1.5 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-200 cursor-pointer"
          >
            <option value="all">All Subjects</option>
            <option value="Mathematics">Mathematics</option>
            <option value="Physics">Physics</option>
            <option value="Chemistry">Chemistry</option>
            <option value="Biology">Biology</option>
            <option value="Computer Science">Computer Science</option>
            <option value="General">General</option>
          </select>

          <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded cursor-pointer ${
                viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Grid View"
              aria-label="Grid View"
            >
              <GridIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded cursor-pointer ${
                viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="List View"
              aria-label="List View"
            >
              <ListIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Projects List or Grid */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center rounded-xl bg-[#0F172A] border border-slate-800 space-y-3">
          <FolderOpen className="w-9 h-9 text-slate-500 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-200">No Projects Matched</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Try adjusting your search criteria or create a new whiteboard.
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="flex flex-col justify-between p-5 rounded-xl bg-[#0F172A] border border-slate-800 hover:border-slate-700 transition-all shadow-md group"
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
                  >
                    <Star className={`w-3.5 h-3.5 ${p.isStarred ? 'fill-amber-400' : ''}`} />
                  </button>
                </div>

                {editingId === p.id ? (
                  <div className="flex items-center gap-1.5 my-1">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveRename(p.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="flex-1 px-2 py-1 bg-slate-950 border border-cyan-500 rounded text-xs text-white focus:outline-none"
                      autoFocus
                    />
                    <button
                      onClick={() => saveRename(p.id)}
                      className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded cursor-pointer"
                      title="Save"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer"
                      title="Cancel"
                    >
                      <CloseIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <h3
                    onClick={() => onOpenProject(p)}
                    className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors cursor-pointer line-clamp-1"
                  >
                    {p.title}
                  </h3>
                )}
                <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  {p.description}
                </p>

                <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-3 font-mono">
                  <span>{p.pages?.length || 1} Pages</span>
                  <span>·</span>
                  <span>{new Date(p.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-800 text-xs">
                <button
                  onClick={() => onOpenProject(p)}
                  className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span>Open</span>
                  <ExternalLink className="w-3 h-3" />
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => startRename(p)}
                    className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Rename Project"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
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
      ) : (
        <div className="rounded-xl bg-[#0F172A] border border-slate-800 overflow-hidden divide-y divide-slate-800">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between p-4 hover:bg-slate-900/60 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1 pr-4">
                <button
                  onClick={() => onToggleStar(p.id)}
                  className={`p-1 rounded hover:bg-slate-800 transition-colors cursor-pointer shrink-0 ${
                    p.isStarred ? 'text-amber-400' : 'text-slate-500'
                  }`}
                >
                  <Star className={`w-4 h-4 ${p.isStarred ? 'fill-amber-400' : ''}`} />
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3
                      onClick={() => onOpenProject(p)}
                      className="text-sm font-semibold text-white hover:text-cyan-300 cursor-pointer truncate"
                    >
                      {p.title}
                    </h3>
                    <span className="text-[10px] text-cyan-400 font-mono px-1.5 py-0.5 rounded bg-blue-950/60 border border-blue-900/60 shrink-0">
                      {p.subject}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{p.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0 text-xs text-slate-400">
                <span className="font-mono">{new Date(p.updatedAt).toLocaleDateString()}</span>
                <button
                  onClick={() => onOpenProject(p)}
                  className="px-3 py-1 text-xs font-semibold text-cyan-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  Open
                </button>
                <button
                  onClick={() => startRename(p)}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-300 cursor-pointer"
                  title="Rename"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onDuplicateProject(p.id)}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer"
                  title="Duplicate"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onDeleteProject(p.id)}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400 cursor-pointer"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
