import { jsonrepair } from 'jsonrepair';
import { z } from 'zod';

/**
 * Parsing mode options:
 * - parse: Only basic JSON extraction and parsing
 * - repair: All repair strategies including jsonrepair and schema fixes
 */
export type ParseMode = 'parse' | 'repair';

/**
 * Options for parseFromLLM function
 */
export interface ParseOptions {
  /**
   * Parsing mode
   * @default 'parse'
   */
  mode?: ParseMode;

  /**
   * Optional Zod schema for validation and structural fixes
   * Only used in repair mode
   */
  schema?: z.ZodTypeAny;
}

/**
 * Parses and extracts JSON from LLM output strings
 *
 * @param input - Raw string from LLM that may contain JSON
 * @param options - Parsing options
 * @returns Parsed JSON object
 * @throws Error if no valid JSON is found
 *
 * @example
 * ```ts
 * // Parse mode (default)
 * const data = parseFromLLM('Here is the data: {"name": "John"}');
 *
 * // Repair mode with schema
 * const schema = z.object({ user: z.object({ name: z.string() }) });
 * const data = parseFromLLM('{"name": "John"}', { mode: 'repair', schema });
 * ```
 */
export function parseFromLLM<T = any>(input: string, options?: ParseOptions): T {
  const mode = options?.mode || 'parse';
  const schema = options?.schema;

  let result: any;

  if (mode === 'parse') {
    result = parseOnly(input);
  } else {
    result = parseWithRepair(input);
  }

  // Apply schema fixes only in repair mode
  if (mode === 'repair' && schema) {
    result = wrapRootIfMissing(result, schema);
  }

  return result;
}

/**
 * Parse mode: extract and parse JSON without repair
 */
function parseOnly(input: string): any {
  // Try to find first complete JSON object
  const firstJson = findFirstCompleteJson(input);

  if (!firstJson) {
    throw new Error('No JSON found in the string.');
  }

  try {
    return JSON.parse(firstJson);
  } catch (error: any) {
    throw new Error('Failed to parse JSON: ' + error.message);
  }
}

/**
 * Repair mode: multiple strategies with repair
 */
function parseWithRepair(input: string): any {
  const cleaned = extractOnlyJson(input);

  if (cleaned.startsWith('Invalid input')) {
    throw new Error('No JSON found in the string.');
  }

  // Strategy 1: Try all possible JSON candidates
  const possibleJson = findAllPossibleJson(cleaned);

  for (const jsonCandidate of possibleJson) {
    // Try native JSON.parse first (fast path)
    try {
      return JSON.parse(jsonCandidate);
    } catch (parseError) {
      // Try jsonrepair as fallback
      try {
        const repaired = jsonrepair(jsonCandidate);
        return JSON.parse(repaired);
      } catch (repairError) {
        continue;
      }
    }
  }

  // Strategy 2: Fallback to first complete JSON
  const firstJson = findFirstCompleteJson(cleaned);
  if (firstJson) {
    try {
      return JSON.parse(firstJson);
    } catch (parseError) {
      const repaired = jsonrepair(firstJson);
      return JSON.parse(repaired);
    }
  }

  throw new Error('No valid JSON found in the string.');
}

/**
 * Wraps parsed object with root key if schema expects it but it's missing
 * Only applies when schema has a single root object key
 */
function wrapRootIfMissing(parsed: any, schema: z.ZodTypeAny): any {
  if (!(schema instanceof z.ZodObject)) return parsed;

  const shape = schema.shape;
  const rootKeys = Object.keys(shape);
  if (rootKeys.length !== 1) return parsed;

  const rootKey = rootKeys[0]!;
  const rootSchema = shape[rootKey];
  if (!(rootSchema instanceof z.ZodObject)) return parsed;

  // Already has the root key
  if (parsed && typeof parsed === 'object' && rootKey in parsed) return parsed;

  // Check if parsed has all children of the expected root
  const childShape = rootSchema.shape;
  const childKeys = Object.keys(childShape);
  const hasAllChildren =
    parsed && typeof parsed === 'object' && childKeys.every((k) => k in parsed);

  if (hasAllChildren) {
    return { [rootKey]: parsed };
  }

  return parsed;
}

/**
 * Extracts the substring between the first and last braces
 */
function extractOnlyJson(str: string): string {
  const start = str.indexOf('{');
  const end = str.lastIndexOf('}') + 1;
  if (start !== -1 && end !== -1) {
    return str.slice(start, end);
  }
  return 'Invalid input: no braces found.';
}

/**
 * Finds every complete JSON object in the input
 */
function findAllPossibleJson(input: string): string[] {
  const candidates: string[] = [];

  for (let i = 0; i < input.length; i++) {
    if (input[i] === '{') {
      const jsonCandidate = findCompleteJsonStartingAt(input, i);
      if (jsonCandidate) {
        candidates.push(jsonCandidate);
      }
    }
  }

  return candidates;
}

/**
 * Returns a balanced JSON object starting at a given index
 */
function findCompleteJsonStartingAt(input: string, startIndex: number): string | null {
  let braceCount = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = startIndex; i < input.length; i++) {
    const char = input[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === '"' && !escapeNext) {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          return input.substring(startIndex, i + 1);
        }
      }
    }
  }

  return null;
}

/**
 * Finds the first complete JSON object in the input
 */
function findFirstCompleteJson(input: string): string | null {
  let braceCount = 0;
  let startIndex = -1;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (char === '{') {
      if (startIndex === -1) startIndex = i;
      braceCount++;
    } else if (char === '}') {
      braceCount--;
      if (braceCount === 0 && startIndex !== -1) {
        return input.substring(startIndex, i + 1);
      }
    }
  }

  return null;
}

/**
 * Checks whether the string may contain JSON braces
 */
export function hasPossibleJson(str: string): boolean {
  const start = str.indexOf('{');
  const end = str.lastIndexOf('}') + 1;
  return start > -1 && end > 1;
}

/**
 * Validates whether the string is valid JSON
 */
export function isJsonString(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
}
