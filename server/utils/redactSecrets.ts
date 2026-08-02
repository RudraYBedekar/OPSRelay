const AWS_KEY_PATTERN = /\b(AKIA[0-9A-Z]{16})\b/g;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\b/g;
const DB_URL_PATTERN = /postgres(?:ql)?:\/\/[^\s'"]+/gi;
const PRIVATE_KEY_PATTERN = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g;

export interface SecretScanResult {
  blocked: boolean;
  redactedText: string;
  findings: string[];
}

function redactPattern(text: string, pattern: RegExp, label: string, findings: string[]): string {
  if (!pattern.test(text)) return text;
  pattern.lastIndex = 0;
  if (!findings.includes(label)) findings.push(label);
  return text.replace(pattern, `[REDACTED:${label}]`);
}

/** Scan and redact high-confidence secrets before persistence or model calls. */
export function scanAndRedactSecrets(text: string): SecretScanResult {
  const findings: string[] = [];
  let redactedText = text;

  redactedText = redactPattern(redactedText, AWS_KEY_PATTERN, 'aws_access_key', findings);
  redactedText = redactPattern(redactedText, BEARER_PATTERN, 'bearer_token', findings);
  redactedText = redactPattern(redactedText, JWT_PATTERN, 'jwt', findings);
  redactedText = redactPattern(redactedText, DB_URL_PATTERN, 'database_url', findings);
  redactedText = redactPattern(redactedText, PRIVATE_KEY_PATTERN, 'private_key', findings);

  const blocked = findings.includes('aws_access_key') || findings.includes('private_key');

  return { blocked, redactedText, findings };
}

export function assertNotesSafeForProcessing(text: string): void {
  const scan = scanAndRedactSecrets(text);
  if (scan.blocked) {
    throw new Error(
      'Notes contain credentials that must be removed before processing (AWS keys and private keys are not accepted).',
    );
  }
}
