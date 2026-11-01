/**
 * Client service for AI Tutor and Canvas handwriting analysis
 * Calls the secure backend proxy (/api/gemini/*)
 */

import { AIAnalysisResult, AITutorChatMessage } from '../types';

export async function analyzeCanvasWithGemini(
  canvas: HTMLCanvasElement,
  subject: string,
  prompt?: string
): Promise<AIAnalysisResult> {
  try {
    const imageBase64 = canvas.toDataURL('image/png', 0.85);

    const res = await fetch('/api/gemini/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64,
        subject,
        prompt,
      }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Server responded with ${res.status}`);
    }

    return await res.json();
  } catch (err: any) {
    console.error('Canvas analysis error:', err);
    // Graceful structured fallback
    return {
      success: false,
      error: err.message || 'Unable to connect to AI analysis service.',
      transcription: 'Analysis offline',
      subject: subject || 'STEM',
      stepByStepSolution: [
        {
          stepNumber: 1,
          title: 'Connection Notice',
          detail: 'Could not reach the AI service. Verify your connection or try again.'
        }
      ],
      conceptSummary: 'Review the written notes or equations on the board.',
    };
  }
}

export async function sendAITutorChatMessage(
  message: string,
  history: AITutorChatMessage[],
  subject: string
): Promise<{ reply: string; isSimulated?: boolean }> {
  try {
    const res = await fetch('/api/gemini/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        history,
        subject,
      }),
    });

    if (!res.ok) {
      throw new Error(`Server returned ${res.status}`);
    }

    return await res.json();
  } catch (err: any) {
    console.warn('AI Chat error, using fallback:', err);
    return {
      reply: `I am currently operating in offline mode. For "${message}", try reviewing the core principles of ${subject}. Let me know if you would like step-by-step problem breakdown once reconnected!`,
      isSimulated: true,
    };
  }
}
