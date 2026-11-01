import React, { useState } from 'react';
import type { AmbiguityItem } from '../../types/ai';
import { AlertCircle, Check, Copy, Edit3, ArrowRight } from 'lucide-react';

interface AmbiguityConfirmationProps {
  initialTranscription: string;
  ambiguities: AmbiguityItem[];
  confidence: number;
  onConfirmAndInsert: (finalText: string) => void;
  onCopy: (finalText: string) => void;
}

export const AmbiguityConfirmation: React.FC<AmbiguityConfirmationProps> = ({
  initialTranscription,
  ambiguities,
  confidence,
  onConfirmAndInsert,
  onCopy,
}) => {
  const [transcription, setTranscription] = useState(initialTranscription);
  const [resolvedAmbiguities, setResolvedAmbiguities] = useState<AmbiguityItem[]>(ambiguities);
  const [copied, setCopied] = useState(false);

  const handleSelectAlternative = (ambId: string, alt: string) => {
    const amb = resolvedAmbiguities.find((a) => a.id === ambId);
    if (!amb) return;

    // Replace the character in the transcription string
    const oldChar = amb.selected;
    const newTranscription = transcription.replace(oldChar, alt);
    setTranscription(newTranscription);

    setResolvedAmbiguities((prev) =>
      prev.map((item) => (item.id === ambId ? { ...item, selected: alt } : item))
    );
  };

  const handleCopyText = () => {
    navigator.clipboard?.writeText(transcription);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopy(transcription);
  };

  return (
    <div className="p-4 rounded-xl bg-[#0B132B] border border-amber-500/40 text-slate-100 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-xs font-bold text-amber-300">
            Ambiguity Detected &bull; Confirm Handwriting
          </span>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
          Confidence: {(confidence * 100).toFixed(0)}%
        </span>
      </div>

      <p className="text-[11px] text-slate-300 leading-relaxed">
        Our vision model identified symbols that may have multiple mathematical or linguistic interpretations.
        Tap a chip below to select your intended notation:
      </p>

      {/* Ambiguity alternatives selector */}
      {resolvedAmbiguities.length > 0 && (
        <div className="space-y-2 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
          {resolvedAmbiguities.map((item) => (
            <div key={item.id} className="flex flex-col gap-1.5 text-xs">
              <div className="flex items-center justify-between text-slate-400 text-[11px]">
                <span>Symbol: <strong className="text-white font-mono">{item.character}</strong></span>
                {item.context && <span className="text-[10px] text-slate-500 italic">{item.context}</span>}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {item.alternatives.map((alt) => {
                  const isSelected = item.selected === alt;
                  return (
                    <button
                      key={alt}
                      onClick={() => handleSelectAlternative(item.id, alt)}
                      className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {alt}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editable Transcription Field */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>Editable Transcription:</span>
          <Edit3 className="w-3 h-3 text-cyan-400" />
        </div>
        <textarea
          value={transcription}
          onChange={(e) => setTranscription(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-cyan-300 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => onConfirmAndInsert(transcription)}
          className="flex-1 py-2 px-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Insert as Text on Canvas</span>
        </button>

        <button
          onClick={handleCopyText}
          className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors border border-slate-700"
          title="Copy to Clipboard"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
    </div>
  );
};
