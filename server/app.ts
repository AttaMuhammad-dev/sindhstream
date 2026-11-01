import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  getGeminiClient,
  handleHandwritingRecognition,
  handleMathSolver,
  handleDiagramAnalysis,
  handleStudySummary,
  handleQuizGeneration,
  handleFlashcardGeneration,
  handleLessonPlanGeneration,
  handleConceptExplanation,
} from './geminiEducation.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '50mb' }));

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'GestEra Server',
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
    timestamp: new Date().toISOString(),
  });
});

// 1. Handwriting Recognition Endpoint
app.post('/api/ai/handwriting', async (req, res) => {
  try {
    const { imageBase64, subject = 'General' } = req.body;
    const ai = getGeminiClient();
    const result = await handleHandwritingRecognition(ai, imageBase64, subject);
    res.json(result);
  } catch (err: any) {
    console.error('Handwriting OCR error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to process handwriting recognition',
    });
  }
});

// 2. Math Solver with Derivations & Graph Data
app.post('/api/ai/math', async (req, res) => {
  try {
    const { imageBase64, equation, subjectArea = 'Mathematics' } = req.body;
    const ai = getGeminiClient();
    const result = await handleMathSolver(ai, imageBase64, equation, subjectArea);
    res.json(result);
  } catch (err: any) {
    console.error('Math solver error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to solve mathematical expression',
    });
  }
});

// 3. Diagram & Flowchart Assistant
app.post('/api/ai/diagram', async (req, res) => {
  try {
    const { imageBase64, topic = 'Whiteboard Schematic' } = req.body;
    const ai = getGeminiClient();
    const result = await handleDiagramAnalysis(ai, imageBase64, topic);
    res.json(result);
  } catch (err: any) {
    console.error('Diagram analysis error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to analyze diagram',
    });
  }
});

// 4. Study Notes & Summary
app.post('/api/ai/study', async (req, res) => {
  try {
    const { imageBase64, notes, subject = 'General' } = req.body;
    const ai = getGeminiClient();
    const result = await handleStudySummary(ai, imageBase64, notes, subject);
    res.json(result);
  } catch (err: any) {
    console.error('Study summary error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to generate study summary',
    });
  }
});

// 5. Interactive Quiz Generator
app.post('/api/ai/quiz', async (req, res) => {
  try {
    const { imageBase64, subject = 'General', difficulty = 'High School' } = req.body;
    const ai = getGeminiClient();
    const result = await handleQuizGeneration(ai, imageBase64, subject, difficulty);
    res.json(result);
  } catch (err: any) {
    console.error('Quiz generation error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to generate quiz',
    });
  }
});

// 6. Flashcard Deck Generator
app.post('/api/ai/flashcards', async (req, res) => {
  try {
    const { imageBase64, subject = 'General' } = req.body;
    const ai = getGeminiClient();
    const result = await handleFlashcardGeneration(ai, imageBase64, subject);
    res.json(result);
  } catch (err: any) {
    console.error('Flashcard generation error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to generate flashcards',
    });
  }
});

// 7. Lesson Plan Generator
app.post('/api/ai/lesson-plan', async (req, res) => {
  try {
    const { imageBase64, topic = 'Air-Writing Science', gradeLevel = 'High School' } = req.body;
    const ai = getGeminiClient();
    const result = await handleLessonPlanGeneration(ai, imageBase64, topic, gradeLevel);
    res.json(result);
  } catch (err: any) {
    console.error('Lesson plan error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to generate lesson plan',
    });
  }
});

// 8. Concept Explanation Endpoint
app.post('/api/ai/explain', async (req, res) => {
  try {
    const { imageBase64, conceptText, subject = 'General', level = 'High School' } = req.body;
    const ai = getGeminiClient();
    const result = await handleConceptExplanation(ai, imageBase64, conceptText, subject, level);
    res.json(result);
  } catch (err: any) {
    console.error('Concept explanation error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to explain concept',
    });
  }
});

// Backward compatibility: /api/gemini/analyze
app.post('/api/gemini/analyze', async (req, res) => {
  try {
    const { imageBase64, prompt, subject = 'Mathematics' } = req.body;
    const ai = getGeminiClient();
    const mathResult = await handleMathSolver(ai, imageBase64, prompt, subject);
    res.json({
      success: true,
      isSimulated: mathResult.isSimulated,
      transcription: mathResult.recognizedEquation,
      subject: mathResult.subjectArea,
      stepByStepSolution: mathResult.steps.map((s) => ({
        stepNumber: s.stepNumber,
        title: s.title,
        detail: `${s.explanation} ${s.formula ? `(${s.formula})` : ''}`,
      })),
      conceptSummary: `Concepts: ${mathResult.conceptsCovered.join(', ')}. Final Answer: ${mathResult.finalAnswer}`,
      practiceQuestion: mathResult.suggestions[0] || 'Try solving with alternative parameters.',
      practiceAnswer: mathResult.finalAnswer,
    });
  } catch (err: any) {
    console.error('Legacy analyze endpoint error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Interactive AI Tutor chat
app.post('/api/gemini/chat', async (req, res) => {
  try {
    const { message, subject = 'Mathematics' } = req.body;
    const ai = getGeminiClient();

    if (!ai) {
      return res.json({
        reply:
          `Great question regarding ${subject}! When working with handwritten notes and touchless air-gestures, precision in notation is paramount.\n\n` +
          `1. Ensure all boundary and initial conditions are defined.\n` +
          `2. Check symmetry or dimensional consistency before algebra.\n` +
          `3. Use the whiteboard math solver to plot functions in real time.\n\n` +
          `Would you like to examine a step-by-step derivation or generate a practice quiz on this concept?`,
        isSimulated: true,
      });
    }

    const chat = ai.chats.create({
      model: 'gemini-3.8-flash',
      config: {
        systemInstruction: `You are GestEra AI Tutor, an inspiring STEM professor helping students and teachers with touchless air-writing and digital whiteboards. Subject: ${subject}. Keep explanations clear, rigorous yet accessible, with structured steps and LaTeX formulas.`,
      },
    });

    const response = await chat.sendMessage({
      message,
    });

    res.json({
      reply: response.text,
      isSimulated: false,
    });
  } catch (err: any) {
    console.error('Gemini Chat error:', err);
    res.status(500).json({
      error: err.message || 'Failed to generate AI response',
    });
  }
});

// Mount Vite in development or serve static in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, '../dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GestEra server running on http://0.0.0.0:${PORT}`);
  });
}

// Vercel imports the Express app as a serverless function. Keep the listener
// for local development and the standalone production server only.
if (process.env.VERCEL !== '1') {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

export default app;
