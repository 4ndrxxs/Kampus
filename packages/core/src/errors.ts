import type { SchoolRef } from './types.js';

export class KampusError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'KampusError';
  }
}

export class NetworkError extends KampusError {
  constructor(message: string, cause?: unknown) {
    super(message, 'NETWORK_ERROR', cause);
    this.name = 'NetworkError';
  }
}

export class UpstreamChangedError extends KampusError {
  constructor(message: string, cause?: unknown) {
    super(message, 'UPSTREAM_CHANGED', cause);
    this.name = 'UpstreamChangedError';
  }
}

export class SchoolNotFoundError extends KampusError {
  constructor(keyword: string) {
    super(`School not found: "${keyword}"`, 'SCHOOL_NOT_FOUND');
    this.name = 'SchoolNotFoundError';
  }
}

export class AmbiguousSchoolError extends KampusError {
  constructor(
    public readonly keyword: string,
    public readonly matches: Array<Pick<SchoolRef, 'name' | 'region' | 'schoolType'>>,
  ) {
    const list = matches
      .map((match) => {
        const extras = [match.region, match.schoolType].filter(Boolean).join(', ');
        return extras ? `${match.name} (${extras})` : match.name;
      })
      .join(', ');

    super(`Multiple schools matched "${keyword}": ${list}`, 'AMBIGUOUS_SCHOOL');
    this.name = 'AmbiguousSchoolError';
  }
}

export class TeacherNotFoundError extends KampusError {
  constructor(teacherName: string, schoolName: string) {
    super(`Teacher "${teacherName}" was not found in "${schoolName}"`, 'TEACHER_NOT_FOUND');
    this.name = 'TeacherNotFoundError';
  }
}

export class MealsUnavailableError extends KampusError {
  constructor(message = 'Meals are unavailable for the requested school/date.') {
    super(message, 'MEALS_UNAVAILABLE');
    this.name = 'MealsUnavailableError';
  }
}

export class TimetableUnavailableError extends KampusError {
  constructor(message = 'Timetable data is unavailable for the requested school/date.') {
    super(message, 'TIMETABLE_UNAVAILABLE');
    this.name = 'TimetableUnavailableError';
  }
}

export class InvalidInputError extends KampusError {
  constructor(message: string) {
    super(message, 'INVALID_INPUT');
    this.name = 'InvalidInputError';
  }
}

export class ProviderUnavailableError extends KampusError {
  constructor(providerName: string, cause?: unknown, message?: string) {
    super(message ?? `Provider unavailable: ${providerName}`, 'PROVIDER_UNAVAILABLE', cause);
    this.name = 'ProviderUnavailableError';
  }
}
