export type {
  AccessMode,
  ClassTimeSlot,
  ComciganSchoolRef,
  DataStatus,
  DailyMealService,
  DailyMeals,
  DayTimetable,
  KampusProvider,
  MealItem,
  NeisSchoolRef,
  PeriodChange,
  PeriodItem,
  PeriodSource,
  PeriodStatus,
  ProviderCapability,
  ProviderId,
  ProviderMetadata,
  ProviderRefs,
  ProviderWarning,
  SchoolInfo,
  SchoolRef,
  SchoolSearchResult,
  SnapshotDiff,
  TeacherDayTimetable,
  TeacherInfo,
  TeacherPeriodItem,
  TeacherTimetable,
  WeekTimetable,
  WeeklyMeals,
} from './types.js';

export { UNKNOWN_SUBJECT, WEEKDAY_NAMES, WEEKDAY_SHORT } from './types.js';

export {
  AmbiguousSchoolError,
  InvalidInputError,
  KampusError,
  MealsUnavailableError,
  NetworkError,
  ProviderUnavailableError,
  SchoolNotFoundError,
  TeacherNotFoundError,
  TimetableUnavailableError,
  UpstreamChangedError,
} from './errors.js';

export {
  describeSecretStorage,
  getPreferredSecretStorage,
  protectSecret,
  resolveSecret,
} from './secret.js';
export type { KampusProtectedSecret, KampusResolvedSecret, KampusSecretStorage } from './secret.js';

export {
  getKampusConfigStatus,
  getActiveProfile,
  clearDefaultSchool,
  loadKampusConfig,
  listProfiles,
  maskSecret,
  rememberRecentSchool,
  removeRecentSchool,
  removeProfile,
  resolveCachePolicy,
  resolveKampusConfigPath,
  resolveKampusDataDir,
  resolveNeisApiKey,
  saveKampusConfig,
  setActiveProfile,
  setDefaultSchool,
  setNeisApiKeyStatus,
  upsertProfile,
} from './config.js';
export type {
  KampusCachePolicy,
  KampusConfig,
  KampusConfigOptions,
  KampusConfigStatus,
  KampusNeisApiKeyStatus,
  KampusProfile,
  KampusProfileInput,
  KampusStoredSchool,
} from './config.js';

export { KAMPUS_DEVELOPER_INFO, KAMPUS_PROJECT_INFO } from './metadata.js';
export type { KampusDeveloperInfo, KampusProjectInfo } from './metadata.js';

export {
  loadKampusCache,
  readKampusCacheEntry,
  resolveKampusCachePath,
  saveKampusCache,
  touchKampusCacheEntry,
  writeKampusCacheEntry,
} from './cache.js';
export type { KampusCacheEntry, KampusCacheFile, KampusCacheOptions, KampusCacheReadResult } from './cache.js';

export {
  diffSnapshots,
  extractDay,
  formatDate,
  getMonday,
  hasProviderRef,
  mergeProviderRefs,
  mergeSchoolRefs,
  mergeSchoolSearchResults,
  normalizePeriod,
  normalizeRegionName,
  normalizeSchoolName,
  normalizeTeacherPeriod,
  providerIdsFromRefs,
  schoolMatches,
  todayWeekday,
  weekdayName,
} from './normalize.js';

export { KampusClient, createSnapshot } from './client.js';
export type { KampusClientOptions, KampusSnapshot } from './client.js';
