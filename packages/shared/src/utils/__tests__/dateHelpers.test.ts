import {
  formatDate,
  formatDateTime,
  formatRelativeTime,
  getDateRange,
  isDateInRange,
  addDays,
  subtractDays,
  startOfDay,
  endOfDay,
  getDaysDifference,
  formatDuration
} from '../dateHelpers';

describe('Date Helpers', () => {
  const testDate = new Date('2023-01-15T14:30:45.123Z');

  describe('formatDate', () => {
    it('formats date with default format', () => {
      const result = formatDate(testDate);
      expect(result).toBe('2023-01-15');
    });

    it('formats date with custom format', () => {
      const result = formatDate(testDate, 'MM/dd/yyyy');
      expect(result).toBe('01/15/2023');
    });

    it('formats date with locale', () => {
      const result = formatDate(testDate, 'dd/MM/yyyy', 'en-GB');
      expect(result).toBe('15/01/2023');
    });

    it('handles invalid date', () => {
      const result = formatDate(new Date('invalid'));
      expect(result).toBe('Invalid Date');
    });
  });

  describe('formatDateTime', () => {
    it('formats datetime with default format', () => {
      const result = formatDateTime(testDate);
      expect(result).toBe('2023-01-15 14:30:45');
    });

    it('formats datetime with custom format', () => {
      const result = formatDateTime(testDate, 'MM/dd/yyyy HH:mm');
      expect(result).toBe('01/15/2023 14:30');
    });

    it('includes milliseconds when requested', () => {
      const result = formatDateTime(testDate, 'yyyy-MM-dd HH:mm:ss.SSS');
      expect(result).toBe('2023-01-15 14:30:45.123');
    });
  });

  describe('formatRelativeTime', () => {
    const now = new Date('2023-01-15T15:00:00Z');

    beforeAll(() => {
      jest.useFakeTimers();
      jest.setSystemTime(now);
    });

    afterAll(() => {
      jest.useRealTimers();
    });

    it('formats time just now', () => {
      const recent = new Date('2023-01-15T14:59:30Z');
      const result = formatRelativeTime(recent);
      expect(result).toBe('just now');
    });

    it('formats minutes ago', () => {
      const minutesAgo = new Date('2023-01-15T14:55:00Z');
      const result = formatRelativeTime(minutesAgo);
      expect(result).toBe('5 minutes ago');
    });

    it('formats hours ago', () => {
      const hoursAgo = new Date('2023-01-15T12:00:00Z');
      const result = formatRelativeTime(hoursAgo);
      expect(result).toBe('3 hours ago');
    });

    it('formats days ago', () => {
      const daysAgo = new Date('2023-01-13T15:00:00Z');
      const result = formatRelativeTime(daysAgo);
      expect(result).toBe('2 days ago');
    });

    it('formats future time', () => {
      const future = new Date('2023-01-15T16:00:00Z');
      const result = formatRelativeTime(future);
      expect(result).toBe('in 1 hour');
    });
  });

  describe('getDateRange', () => {
    it('gets last 7 days range', () => {
      const range = getDateRange('last7days');
      const today = new Date();
      const sevenDaysAgo = subtractDays(today, 7);
      
      expect(range.start.toDateString()).toBe(sevenDaysAgo.toDateString());
      expect(range.end.toDateString()).toBe(today.toDateString());
    });

    it('gets last 30 days range', () => {
      const range = getDateRange('last30days');
      const today = new Date();
      const thirtyDaysAgo = subtractDays(today, 30);
      
      expect(range.start.toDateString()).toBe(thirtyDaysAgo.toDateString());
      expect(range.end.toDateString()).toBe(today.toDateString());
    });

    it('gets this month range', () => {
      const range = getDateRange('thisMonth');
      const today = new Date();
      const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      
      expect(range.start.toDateString()).toBe(firstOfMonth.toDateString());
      expect(range.end.toDateString()).toBe(today.toDateString());
    });

    it('gets last month range', () => {
      const range = getDateRange('lastMonth');
      const today = new Date();
      const firstOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      
      expect(range.start.toDateString()).toBe(firstOfLastMonth.toDateString());
      expect(range.end.toDateString()).toBe(lastOfLastMonth.toDateString());
    });

    it('throws error for invalid range type', () => {
      expect(() => getDateRange('invalid' as any)).toThrow('Invalid date range type');
    });
  });

  describe('isDateInRange', () => {
    const startDate = new Date('2023-01-01');
    const endDate = new Date('2023-01-31');

    it('returns true for date within range', () => {
      const dateInRange = new Date('2023-01-15');
      expect(isDateInRange(dateInRange, startDate, endDate)).toBe(true);
    });

    it('returns true for date at start boundary', () => {
      expect(isDateInRange(startDate, startDate, endDate)).toBe(true);
    });

    it('returns true for date at end boundary', () => {
      expect(isDateInRange(endDate, startDate, endDate)).toBe(true);
    });

    it('returns false for date before range', () => {
      const dateBefore = new Date('2022-12-31');
      expect(isDateInRange(dateBefore, startDate, endDate)).toBe(false);
    });

    it('returns false for date after range', () => {
      const dateAfter = new Date('2023-02-01');
      expect(isDateInRange(dateAfter, startDate, endDate)).toBe(false);
    });
  });

  describe('addDays', () => {
    it('adds positive days', () => {
      const result = addDays(testDate, 5);
      expect(result.getDate()).toBe(20);
    });

    it('adds zero days', () => {
      const result = addDays(testDate, 0);
      expect(result.getTime()).toBe(testDate.getTime());
    });

    it('handles month boundary', () => {
      const endOfMonth = new Date('2023-01-31');
      const result = addDays(endOfMonth, 1);
      expect(result.getMonth()).toBe(1); // February
      expect(result.getDate()).toBe(1);
    });
  });

  describe('subtractDays', () => {
    it('subtracts positive days', () => {
      const result = subtractDays(testDate, 5);
      expect(result.getDate()).toBe(10);
    });

    it('subtracts zero days', () => {
      const result = subtractDays(testDate, 0);
      expect(result.getTime()).toBe(testDate.getTime());
    });

    it('handles month boundary', () => {
      const startOfMonth = new Date('2023-02-01');
      const result = subtractDays(startOfMonth, 1);
      expect(result.getMonth()).toBe(0); // January
      expect(result.getDate()).toBe(31);
    });
  });

  describe('startOfDay', () => {
    it('returns start of day', () => {
      const result = startOfDay(testDate);
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
      expect(result.getDate()).toBe(testDate.getDate());
    });
  });

  describe('endOfDay', () => {
    it('returns end of day', () => {
      const result = endOfDay(testDate);
      expect(result.getHours()).toBe(23);
      expect(result.getMinutes()).toBe(59);
      expect(result.getSeconds()).toBe(59);
      expect(result.getMilliseconds()).toBe(999);
      expect(result.getDate()).toBe(testDate.getDate());
    });
  });

  describe('getDaysDifference', () => {
    it('calculates positive difference', () => {
      const date1 = new Date('2023-01-01');
      const date2 = new Date('2023-01-06');
      expect(getDaysDifference(date1, date2)).toBe(5);
    });

    it('calculates negative difference', () => {
      const date1 = new Date('2023-01-06');
      const date2 = new Date('2023-01-01');
      expect(getDaysDifference(date1, date2)).toBe(-5);
    });

    it('returns zero for same date', () => {
      expect(getDaysDifference(testDate, testDate)).toBe(0);
    });

    it('handles different times on same day', () => {
      const morning = new Date('2023-01-15T08:00:00Z');
      const evening = new Date('2023-01-15T20:00:00Z');
      expect(getDaysDifference(morning, evening)).toBe(0);
    });
  });

  describe('formatDuration', () => {
    it('formats seconds', () => {
      expect(formatDuration(45)).toBe('45s');
    });

    it('formats minutes and seconds', () => {
      expect(formatDuration(125)).toBe('2m 5s');
    });

    it('formats hours, minutes and seconds', () => {
      expect(formatDuration(3665)).toBe('1h 1m 5s');
    });

    it('formats zero duration', () => {
      expect(formatDuration(0)).toBe('0s');
    });

    it('handles large durations', () => {
      expect(formatDuration(90061)).toBe('25h 1m 1s');
    });

    it('omits zero components', () => {
      expect(formatDuration(3600)).toBe('1h');
      expect(formatDuration(60)).toBe('1m');
    });
  });
});