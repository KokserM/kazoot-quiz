const { z } = require('zod');

const questionSchema = z.object({
  question: z.string().trim().min(8).max(240),
  choices: z.array(z.string().trim().min(1).max(120)).length(4),
  correctAnswerIndex: z.number().int().min(0).max(3),
});

const quizSchema = z.object({
  topic: z.string().trim().min(1).max(80),
  language: z.string().trim().min(1).max(40),
  questions: z.array(questionSchema).length(10),
});

const createSessionSchema = z.object({
  topic: z.string().trim().min(2).max(80),
  language: z.string().trim().min(2).max(40).default('English'),
});

const generateQuizSchema = createSessionSchema;

const joinGameSchema = z.object({
  sessionId: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6}$/),
  username: z.string().trim().min(2).max(32),
  playerToken: z.string().trim().min(8).max(128).optional(),
  isCreator: z.boolean().optional().default(false),
});

const submitAnswerSchema = z.object({
  answerIndex: z.number().int().min(0).max(3),
  roundId: z.string().trim().min(1).max(64),
});

module.exports = {
  createSessionSchema,
  generateQuizSchema,
  joinGameSchema,
  quizSchema,
  submitAnswerSchema,
};
