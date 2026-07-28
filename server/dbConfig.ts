/** Build a connection URL with a specific database name */
export function withDatabase(connectionString: string, database: string): string {
  return connectionString.replace(/(postgresql:\/\/[^/]+\/)([^?]*)/, `$1${database}`);
}

/** Main app data (incidents, vectors, etc.) */
export const CRDB_DATABASE = process.env.CRDB_DATABASE ?? 'Rudra';

/** Isolated database for credentials — separate from operational data */
export const CRDB_SECURE_DATABASE = process.env.CRDB_SECURE_DATABASE ?? 'SecureData';
