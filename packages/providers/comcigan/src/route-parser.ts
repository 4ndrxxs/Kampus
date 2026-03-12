import { UpstreamChangedError } from '@kampus/core';

/**
 * Configuration extracted from the Comcigan route/main JS file.
 * The JS file contains obfuscated variable assignments that tell us
 * how to parse timetable data arrays.
 */
export interface ComciganRouteConfig {
  /** Prefix path for the timetable data endpoint. */
  dataPrefix: string;
  /** Variable name / index for subject list. */
  subjectIdx: string;
  /** Variable name / index for teacher list. */
  teacherIdx: string;
  /** Variable name / index for timetable data array. */
  timetableIdx: string;
  /** The full route JS source (cached for debugging). */
  rawSource?: string;
}

/**
 * Parse the Comcigan route.js to extract key variable indices.
 *
 * The route JS typically contains patterns like:
 *   var 자료N = ...[N]  (where N is an index into the response array)
 *   sc_data(...) patterns for school search
 *   data retrieval path construction
 *
 * This is fragile by nature — upstream can change at any time.
 */
export function parseRouteConfig(jsSource: string): ComciganRouteConfig {
  // Extract the data prefix for timetable API calls
  // Pattern: something like "36179" or a path prefix for the data endpoint
  // The route JS builds URLs like: prefix + "?" + schoolCode + base64suffix
  const prefixMatch = jsSource.match(/sc_data\("[^"]*?(\d{4,6})\?/);
  const dataPrefix = prefixMatch?.[1] ?? extractDataPrefix(jsSource);

  // Extract indices for subject, teacher, timetable arrays
  // These are typically accessed as responseData[N] where N is an integer
  const subjectIdx = extractVarIndex(jsSource, '과목') ?? extractVarIndex(jsSource, 'subject') ?? '8';
  const teacherIdx = extractVarIndex(jsSource, '교사') ?? extractVarIndex(jsSource, 'teacher') ?? '9';
  const timetableIdx = extractVarIndex(jsSource, '시간표') ?? extractVarIndex(jsSource, 'timetable') ?? '12';

  return {
    dataPrefix,
    subjectIdx,
    teacherIdx,
    timetableIdx,
    rawSource: jsSource,
  };
}

function extractDataPrefix(js: string): string {
  // Look for numeric path prefix patterns
  // e.g., "36179?" or similar 5-digit prefix
  const match = js.match(/['"](\d{4,6})\?/);
  if (match) return match[1];

  // Fallback: try to find the sc3 / st3 pattern
  const match2 = js.match(/orgnum\s*\+\s*['"]([^'"]+)['"]/);
  if (match2) return match2[1];

  throw new UpstreamChangedError(
    'Comcigan route.js 에서 데이터 경로를 찾을 수 없습니다. 업스트림 구조가 변경되었을 수 있습니다.',
  );
}

function extractVarIndex(js: string, keyword: string): string | undefined {
  // Look for patterns like: 자료8 = or var_name[8]
  const pattern = new RegExp(`(?:자료|var_?data|sc_data).*?\\[(\\d+)\\].*?(?:${keyword}|${keyword.charAt(0)})`, 'i');
  const match = js.match(pattern);
  if (match) return match[1];

  // Also try: 자료[keyword] = xxx[N]
  const pattern2 = new RegExp(`${keyword}.*?\\[(\\d+)\\]`);
  const match2 = js.match(pattern2);
  return match2?.[1];
}
