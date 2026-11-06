const DEFAULT_TIME_ZONE = 'Asia/Tokyo';
const SEASON_ORDER = ['spring', 'summer', 'autumn', 'winter'];

function assertValidDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError('Expected a valid Date instance.');
  }
}

function buildFormatter(timeZone, includeTime = false) {
  try {
    return new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', {
      timeZone,
      calendar: 'gregory',
      numberingSystem: 'latn',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      ...(includeTime ? { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' } : {})
    });
  } catch (error) {
    throw new RangeError(`Unsupported time zone: ${timeZone}`, { cause: error });
  }
}

function partsToObject(parts) {
  const result = {};
  for (const part of parts) {
    if (part.type !== 'literal') result[part.type] = Number(part.value);
  }
  return result;
}

/** Return Gregorian calendar parts for an absolute instant in the requested IANA timezone. */
export function getDatePartsInTimeZone(date, timeZone = DEFAULT_TIME_ZONE) {
  assertValidDate(date);
  if (typeof timeZone !== 'string' || !timeZone.trim()) throw new TypeError('timeZone must be a non-empty string.');
  const parts = partsToObject(buildFormatter(timeZone).formatToParts(date));
  const { year, month, day } = parts;
  if (![year, month, day].every(Number.isInteger)) throw new Error('Could not resolve calendar date in the requested time zone.');
  return { year, month, day, timeZone };
}

export function isLeapYear(year) {
  return Number.isInteger(year) && year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function getDaysInMonth(year, month) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError('year and month must be valid Gregorian calendar values.');
  }
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function resolveDay(day, year, month) {
  if (day === 'last') return getDaysInMonth(year, month);
  if (!Number.isInteger(day) || day < 1 || day > getDaysInMonth(year, month)) {
    throw new RangeError(`Invalid day ${day} for month ${month}.`);
  }
  return day;
}

function monthDayNumber(month, day) {
  return month * 100 + day;
}

function dateFallsInSeason(parts, range) {
  const { start, end } = range;
  const startDay = resolveDay(start.day, parts.year, start.month);
  const wrapsYear = monthDayNumber(start.month, startDay) > monthDayNumber(end.month, end.day === 'last' ? 31 : end.day);
  const endYear = wrapsYear && parts.month >= start.month ? parts.year + 1 : parts.year;
  const endDay = resolveDay(end.day, endYear, end.month);
  const current = monthDayNumber(parts.month, parts.day);
  const startValue = monthDayNumber(start.month, startDay);
  const endValue = monthDayNumber(end.month, endDay);
  return startValue <= endValue
    ? current >= startValue && current <= endValue
    : current >= startValue || current <= endValue;
}

/** Resolve a season from the configuration schedule, never from the device's local timezone. */
export function getSeasonForDate(date, config, timeZone = config?.themeSystem?.timezone || DEFAULT_TIME_ZONE) {
  assertValidDate(date);
  const ranges = config?.themeSystem?.schedule?.seasons;
  if (!ranges || typeof ranges !== 'object') throw new TypeError('Season schedule is missing from seasonal_theme.json.');
  const parts = getDatePartsInTimeZone(date, timeZone);
  for (const season of SEASON_ORDER) {
    const range = ranges[season];
    if (range && dateFallsInSeason(parts, range)) return season;
  }
  throw new RangeError(`No configured season matches ${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')} in ${timeZone}.`);
}

/** Convert a wall-clock date/time in an IANA timezone to an absolute Date. */
export function zonedDateTimeToUtc({ year, month, day, hour = 0, minute = 0, second = 0 }, timeZone = DEFAULT_TIME_ZONE) {
  const fields = [year, month, day, hour, minute, second];
  if (!fields.every(Number.isInteger) || month < 1 || month > 12 || day < 1 || day > getDaysInMonth(year, month) || hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
    throw new RangeError('Invalid wall-clock date/time.');
  }
  // Iteratively correct the UTC guess by the timezone offset reported by Intl.
  const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let guess = targetAsUtc;
  const formatter = buildFormatter(timeZone, true);
  for (let i = 0; i < 5; i += 1) {
    const actual = partsToObject(formatter.formatToParts(new Date(guess)));
    const representedAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    const delta = representedAsUtc - targetAsUtc;
    if (delta === 0) break;
    guess -= delta;
  }
  return new Date(guess);
}

/** Return the next configured seasonal start boundary as an absolute Date. */
export function getNextSeasonBoundary(date, config, timeZone = config?.themeSystem?.timezone || DEFAULT_TIME_ZONE) {
  assertValidDate(date);
  const parts = getDatePartsInTimeZone(date, timeZone);
  const ranges = config?.themeSystem?.schedule?.seasons;
  if (!ranges || typeof ranges !== 'object') throw new TypeError('Season schedule is missing from seasonal_theme.json.');

  const candidates = [];
  for (let year = parts.year; year <= parts.year + 2; year += 1) {
    for (const season of SEASON_ORDER) {
      const start = ranges[season]?.start;
      if (!start) continue;
      const day = resolveDay(start.day, year, start.month);
      const candidate = zonedDateTimeToUtc({ year, month: start.month, day }, timeZone);
      if (candidate.getTime() > date.getTime()) candidates.push({ season, date: candidate });
    }
  }
  candidates.sort((a, b) => a.date.getTime() - b.date.getTime());
  if (!candidates.length) throw new RangeError('Could not determine the next seasonal boundary.');
  return candidates[0];
}

export const JAPAN_TIME_ZONE = DEFAULT_TIME_ZONE;
export const SEASON_ORDERED_KEYS = Object.freeze([...SEASON_ORDER]);
