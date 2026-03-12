import {
  getActiveProfile,
  InvalidInputError,
  KampusClient,
  loadKampusConfig,
  normalizeSchoolName,
  providerIdsFromRefs,
  rememberRecentSchool,
  saveKampusConfig,
  type KampusStoredSchool,
  type SchoolSearchResult,
} from '@kampus/core';

export async function resolveSchool(
  client: KampusClient,
  name?: string,
  region?: string,
): Promise<SchoolSearchResult> {
  const config = loadKampusConfig();
  const activeProfile = getActiveProfile(config);
  const defaultSchool = activeProfile?.school ?? config.defaultSchool;
  const trimmedName = name?.trim();

  if (!trimmedName) {
    if (!defaultSchool) {
      throw new InvalidInputError(
        'School name is required. Pass --school or set a default school with "kps config set default-school <name>".',
      );
    }

    const stored = storedSchoolToSearchResult(defaultSchool);
    persistRecentSchool(stored);
    return stored;
  }

  const regionHint =
    region?.trim() ||
    (defaultSchool &&
    normalizeSchoolName(defaultSchool.name) === normalizeSchoolName(trimmedName)
      ? defaultSchool.region
      : undefined);

  const resolved = await client.resolveSchool(trimmedName, regionHint);
  persistRecentSchool(resolved);
  return resolved;
}

export function getDefaultSchool(): SchoolSearchResult | undefined {
  const config = loadKampusConfig();
  const defaultSchool = getActiveProfile(config)?.school ?? config.defaultSchool;
  return defaultSchool ? storedSchoolToSearchResult(defaultSchool) : undefined;
}

export function getActiveProfileContext() {
  const config = loadKampusConfig();
  return getActiveProfile(config);
}

export function resolveGradeClassDefaults(
  grade?: number,
  classNo?: number,
): { grade: number; classNo: number } {
  const profile = getActiveProfileContext();
  return {
    grade: grade ?? profile?.grade ?? 0,
    classNo: classNo ?? profile?.classNo ?? 0,
  };
}

export function resolveTeacherDefault(teacherName?: string): string | undefined {
  return teacherName?.trim() || getActiveProfileContext()?.teacherName;
}

function persistRecentSchool(school: SchoolSearchResult): void {
  const current = loadKampusConfig();
  saveKampusConfig(rememberRecentSchool(current, school));
}

function storedSchoolToSearchResult(school: KampusStoredSchool): SchoolSearchResult {
  return {
    name: school.name,
    region: school.region,
    schoolType: school.schoolType,
    providerRefs: school.providerRefs,
    sourceProviders: providerIdsFromRefs(school.providerRefs),
  };
}
