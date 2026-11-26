// Ask: RAG step 5 (lib/rag/answer.js), plus the checks that keep it safe.
//
//   Check    the question, that the signed-in user owns the project and the chosen document, and the chat history
//   5a       search with the previous question + this one, so "and when is it due?" still finds the invoice
//   5b–5d    stream the answer: sources → text… → done
//
// The checks and the search run before anything is sent, so a bad question still gets a normal 400/404 response.
import { answerFromChunks, findRelevantChunks } from "../rag/answer.js";
import { getProjectOrThrow } from "./projects.js";
import { findDocumentOrThrow } from "./documents.js";
import { HttpError } from "../http.js";
import { BUSY_MESSAGE } from "../rag/model.js";

const MAX_QUESTION_LENGTH = 2000;
const MAX_HISTORY_TURNS = 6; // the last 3 questions and their answers
const MAX_HISTORY_TEXT = 2000; // characters kept per turn

// Answers from one document at a time: the one selected in the Documents panel.
export async function startAnswer(userId, projectId, documentId, question, history) {
  const cleanQuestion = checkQuestion(question);
  const project = await getProjectOrThrow(userId, projectId);
  if (!project.documents.length) {
    throw new HttpError(400, "Import a PDF or Excel file to this project first.");
  }
  // Checks the id against this project's own documents, so another user's file can never be searched.
  const document = findDocumentOrThrow(project, documentId, "Select a document in this project to ask about.");
  return answerQuestion(project.id, document.id, cleanQuestion, history);
}

// The shared core, also used by the website widget (lib/services/widget.js). The caller has already checked
// which project and files may be searched. documentIds: one id or a list.
export async function answerQuestion(projectId, documentIds, question, history) {
  const cleanQuestion = checkQuestion(question);
  const turns = parseHistory(history);
  const previousQuestion = turns.findLast((turn) => turn.role === "user")?.text;
  const searchText = previousQuestion ? `${previousQuestion}\n${cleanQuestion}` : cleanQuestion;
  let chunks;
  try {
    chunks = await findRelevantChunks(projectId, documentIds, searchText);
  } catch (error) {
    // The embedding call already retried (LangChain's AsyncCaller); still failing means Google is busy or over its limit.
    if (error.status === 429 || error.status >= 500) throw new HttpError(503, BUSY_MESSAGE);
    throw error;
  }
  return answerFromChunks({ question: cleanQuestion, history: turns, chunks });
}

function checkQuestion(question) {
  const cleanQuestion = typeof question === "string" ? question.trim() : "";
  if (!cleanQuestion || cleanQuestion.length > MAX_QUESTION_LENGTH) {
    throw new HttpError(400, "Enter a question of up to 2,000 characters.");
  }
  return cleanQuestion;
}

// The history comes from the browser, so it is checked: only user/assistant text turns, the last 6, each shortened.
export function parseHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((turn) => (turn?.role === "user" || turn?.role === "assistant") && typeof turn.text === "string" && turn.text.trim())
    .slice(-MAX_HISTORY_TURNS)
    .map((turn) => ({ role: turn.role, text: turn.text.trim().slice(0, MAX_HISTORY_TEXT) }));
}
