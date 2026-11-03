/**
 * Storage and mock seed persistence for GestEra.
 * Uses localStorage with reliable in-memory fallback
 */

import { Project, UserSettings, LearningActivityStats } from '../types';

const STORAGE_KEYS = {
  PROJECTS: 'gestera_projects_v1',
  SETTINGS: 'gestera_settings_v2',
  STATS: 'gestera_stats_v1',
  ACTIVE_PROJECT: 'gestera_active_project_id',
};

const PREVIOUS_GESTERA_SETTINGS_KEY = 'gestera_settings_v1';

const LEGACY_STORAGE_KEYS = {
  PROJECTS: 'airwrite_projects_v1',
  SETTINGS: 'airwrite_settings_v1',
  STATS: 'airwrite_stats_v1',
};

export const DEFAULT_SETTINGS: UserSettings = {
  dominantHand: 'Right',
  pinchSensitivity: 0.05,
  smoothingFactor: 0.35,
  handDetectionConfidence: 0.55,
  oneEuroMinCutoff: 1.0,
  oneEuroBeta: 0.007,
  mirrorWebcam: true,
  showLandmarks: true,
  showWebcamHUD: true,
  cameraResolution: '720p',
  academicLevel: 'Undergraduate',
  hapticFeedback: true,
  smartHandwriting: true,
  autoSaveInterval: 15,
  gestureBindings: {
    pinchAction: 'draw',
    pointingAction: 'laser_presentation',
    vSignAction: 'erase_select',
    thumbsUpAction: 'ai_solve',
    openPalmAction: 'pan',
    closedFistAction: 'pause',
    swipeLeftAction: 'prev_page',
    swipeRightAction: 'next_page',
    twoHandZoomAction: 'zoom',
    pinkyAction: 'next_color',
    pinchTriggerMode: 'thumb_index',
    hysteresisRatio: 1.35,
    swipeVelocityThreshold: 0.8,
    cooldownMs: 350,
    twoHandZoomSensitivity: 0.008,
  },
};

export const INITIAL_STATS: LearningActivityStats = {
  streakDays: 4,
  weeklyMinutes: 142,
  gesturesMasteredCount: 7,
  problemsSolvedCount: 28,
  notesCreatedCount: 12,
  dailyGoalPercentage: 85,
};

// Seed projects with rich educational content
export const SEED_PROJECTS: Project[] = [
  {
    id: 'proj_seed_calc_1',
    title: 'Calculus: Integration by Parts & Green\'s Theorem',
    description: 'Lecture annotations with air-drawn vector flux integrals and step-by-step proofs.',
    subject: 'Mathematics',
    template: 'math_grid',
    tags: ['Calculus', 'STEM', 'Multivariable', 'Air-Drawn'],
    createdAt: Date.now() - 3600 * 1000 * 48,
    updatedAt: Date.now() - 3600 * 1000 * 4,
    isStarred: true,
    pages: [
      {
        id: 'page_seed_1',
        title: 'Stokes Theorem Setup',
        background: 'grid',
        strokes: [
          {
            id: 's1',
            tool: 'pen',
            color: '#38BDF8',
            size: 4,
            opacity: 1,
            points: [
              { x: 120, y: 150 }, { x: 140, y: 145 }, { x: 160, y: 155 }, { x: 180, y: 170 },
              { x: 200, y: 190 }, { x: 220, y: 220 }
            ],
            createdAt: Date.now() - 100000,
          },
          {
            id: 's2',
            tool: 'highlighter',
            color: '#06B6D4',
            size: 14,
            opacity: 0.3,
            points: [
              { x: 100, y: 120 }, { x: 280, y: 120 }
            ],
            createdAt: Date.now() - 90000,
          }
        ]
      }
    ]
  },
  {
    id: 'proj_seed_phys_2',
    title: 'AP Physics C: Electromagnetic Induction & Lenz\'s Law',
    description: 'Diagramming magnetic flux through rotating loop in uniform B-field with air vectors.',
    subject: 'Physics',
    template: 'lab_report',
    tags: ['Physics', 'Electromagnetism', 'Right-Hand-Rule'],
    createdAt: Date.now() - 3600 * 1000 * 96,
    updatedAt: Date.now() - 3600 * 1000 * 18,
    isStarred: true,
    pages: [
      {
        id: 'page_seed_2',
        title: 'Faraday Law Derivation',
        background: 'blueprint',
        strokes: []
      }
    ]
  },
  {
    id: 'proj_seed_chem_3',
    title: 'Organic Chemistry: Nucleophilic Carbonyl Addition',
    description: 'Reaction pathways for Grignard reagents and resonance stabilization mechanisms.',
    subject: 'Chemistry',
    template: 'cornell',
    tags: ['Chemistry', 'Reaction Mechanisms', 'Cornell Notes'],
    createdAt: Date.now() - 3600 * 1000 * 140,
    updatedAt: Date.now() - 3600 * 1000 * 42,
    isStarred: false,
    pages: [
      {
        id: 'page_seed_3',
        title: 'Grignard Reaction Mechanism',
        background: 'ruled',
        strokes: []
      }
    ]
  }
];

export function getStoredProjects(): Project[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PROJECTS) || localStorage.getItem(LEGACY_STORAGE_KEYS.PROJECTS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(SEED_PROJECTS));
      return SEED_PROJECTS;
    }
    const projects = JSON.parse(raw) as Project[];
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
    return projects;
  } catch (err) {
    console.warn('Could not read projects from localStorage, using seed data:', err);
    return SEED_PROJECTS;
  }
}

export function saveProject(project: Project): Project[] {
  const current = getStoredProjects();
  const index = current.findIndex((p) => p.id === project.id);
  let updated: Project[];

  const projectToSave = {
    ...project,
    updatedAt: Date.now(),
  };

  if (index >= 0) {
    updated = [...current];
    updated[index] = projectToSave;
  } else {
    updated = [projectToSave, ...current];
  }

  try {
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(updated));
  } catch (err) {
    console.warn('Could not save projects to localStorage:', err);
  }
  return updated;
}

export function deleteProject(id: string): Project[] {
  const current = getStoredProjects();
  const updated = current.filter((p) => p.id !== id);
  try {
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(updated));
  } catch (err) {
    console.warn('Could not delete project from localStorage:', err);
  }
  return updated;
}

export function toggleProjectStar(id: string): Project[] {
  const current = getStoredProjects();
  const updated = current.map((p) => (p.id === id ? { ...p, isStarred: !p.isStarred } : p));
  try {
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(updated));
  } catch (err) {
    console.warn('Could not update project star:', err);
  }
  return updated;
}

export function getStoredSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS) ||
      localStorage.getItem(PREVIOUS_GESTERA_SETTINGS_KEY) ||
      localStorage.getItem(LEGACY_STORAGE_KEYS.SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    const saved = JSON.parse(raw) as Partial<UserSettings>;
    const savedBindings: Partial<UserSettings['gestureBindings']> = saved.gestureBindings || {};
    const hadPreviousDefaultBindings = savedBindings.pointingAction === 'aim_hover' &&
      savedBindings.openPalmAction === 'pause' &&
      savedBindings.closedFistAction === 'laser_presentation';
    const settings = {
      ...DEFAULT_SETTINGS,
      ...saved,
      gestureBindings: {
        ...DEFAULT_SETTINGS.gestureBindings,
        ...savedBindings,
        ...(hadPreviousDefaultBindings ? {
          pointingAction: 'laser_presentation' as const,
          openPalmAction: 'pan' as const,
          closedFistAction: 'pause' as const,
        } : {}),
      },
    };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    return settings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveStoredSettings(settings: UserSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (err) {
    console.warn('Could not save settings:', err);
  }
}

export function getStoredStats(): LearningActivityStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STATS) || localStorage.getItem(LEGACY_STORAGE_KEYS.STATS);
    if (!raw) return INITIAL_STATS;
    const stats = JSON.parse(raw) as LearningActivityStats;
    localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
    return stats;
  } catch {
    return INITIAL_STATS;
  }
}

export function updateStats(updater: Partial<LearningActivityStats>): LearningActivityStats {
  const current = getStoredStats();
  const updated = { ...current, ...updater };
  try {
    localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(updated));
  } catch (err) {
    console.warn('Could not save stats:', err);
  }
  return updated;
}
