// ============================================================
// STRUCTURED ERROR TYPES — No more swallowed errors
// ============================================================
//
// WHY THIS FILE EXISTS:
// Before this, errors were thrown as raw strings like:
//   throw new Error('PASSWORD_REQUIRED')
// and caught with:
//   catch (e: any) { showToast(e.message, 'error') }
//
// This caused:
// 1. Silent failures when catch blocks were empty
// 2. No way to programmatically handle specific error types
// 3. User-facing messages mixed with internal error codes
//
// HOW TO USE:
// import { AppError, FileProcessingError, isAppError } from '@/utils/errors';
//
// // Throwing:
// throw new FileProcessingError('PDF is encrypted', 'PASSWORD_REQUIRED', { filename });
//
// // Catching:
// catch (e: unknown) {
//   if (isAppError(e)) { showToast(e.userMessage, 'error'); }
//   else { showToast('An unexpected error occurred', 'error'); }
// }
//
// RULES:
// - NEVER use `catch (e: any)` — use `catch (e: unknown)` and type-check
// - NEVER leave catch blocks empty — at minimum, log to console
// - ALWAYS provide a user-friendly message via AppError.userMessage
// ============================================================

/**
 * Base error class for all TrackSpendZ errors.
 * Carries both a technical message and a user-friendly message.
 */
export class AppError extends Error {
  /** Human-readable message safe to show in a toast */
  public readonly userMessage: string;
  /** Machine-readable error code for programmatic handling */
  public readonly code: string;
  /** Additional context for debugging */
  public readonly context: Record<string, unknown>;

  constructor(
    technicalMessage: string,
    code: string,
    userMessage?: string,
    context: Record<string, unknown> = {}
  ) {
    super(technicalMessage);
    this.name = 'AppError';
    this.code = code;
    this.userMessage = userMessage || technicalMessage;
    this.context = context;
  }
}

/** Errors during file parsing and transformation */
export class FileProcessingError extends AppError {
  constructor(message: string, code: string, context: Record<string, unknown> = {}) {
    super(message, code, message, context);
    this.name = 'FileProcessingError';
  }
}

/** Errors from Supabase or cloud storage */
export class StorageError extends AppError {
  constructor(message: string, code: string, context: Record<string, unknown> = {}) {
    super(message, code, 'Failed to save your data. Please try again.', context);
    this.name = 'StorageError';
  }
}

/** Errors from AI/Gemini API */
export class AIError extends AppError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, 'AI_ERROR', 'AI analysis is temporarily unavailable.', context);
    this.name = 'AIError';
  }
}

/** Errors from authentication */
export class AuthError extends AppError {
  constructor(message: string, code: string = 'AUTH_ERROR') {
    super(message, code, message);
    this.name = 'AuthError';
  }
}

// ============================================================
// Type Guards
// ============================================================

/** Check if an unknown error is an AppError */
export const isAppError = (e: unknown): e is AppError => e instanceof AppError;

/** Safely extract a user-friendly message from any error */
export const getUserMessage = (e: unknown): string => {
  if (isAppError(e)) return e.userMessage;
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return 'An unexpected error occurred';
};

/** Safely extract error details for logging */
export const getErrorDetails = (e: unknown): { message: string; code?: string; context?: Record<string, unknown> } => {
  if (isAppError(e)) return { message: e.message, code: e.code, context: e.context };
  if (e instanceof Error) return { message: e.message };
  return { message: String(e) };
};
