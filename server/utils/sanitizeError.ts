const PG_ERROR_CODES = new Set(['23505', '23503', '40001', '23514']);

export function sanitizeErrorForClient(err: unknown): { status: number; message: string; code?: string } {
  if (err instanceof Error) {
    const pgCode = (err as { code?: string }).code;
    if (pgCode && PG_ERROR_CODES.has(pgCode)) {
      return { status: 409, message: 'Request could not be completed due to a data conflict.', code: pgCode };
    }

    const msg = err.message;
    if (
      msg.includes('Invalid member ID') ||
      msg.includes('No user found') ||
      msg.includes('Notes cannot be empty') ||
      msg.includes('credentials that must be removed') ||
      msg.includes('analysis_failed') ||
      msg.includes('Only the incident owner')
    ) {
      return { status: 400, message: msg };
    }

    if (msg.includes('Authentication required') || msg.includes('Unauthorized')) {
      return { status: 401, message: 'Authentication required' };
    }

    if (msg.includes('Forbidden') || msg.includes('not authorized')) {
      return { status: 403, message: 'You do not have permission to perform this action.' };
    }
  }

  return { status: 500, message: 'An unexpected error occurred. Please try again.' };
}

export function logServerError(err: unknown, context?: string): void {
  const prefix = context ? `[${context}] ` : '';
  if (err instanceof Error) {
    console.error(`${prefix}${err.name}: ${err.message}`);
  } else {
    console.error(`${prefix}Unknown error`);
  }
}
