import { describe, it, expect, vi } from 'vitest';
import { cn, formatPrice, formatPercentChange, formatTimestamp } from './utils';

describe('cn utility', () => {
  it('should combine basic strings', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('should handle conditional classes', () => {
    expect(cn('a', { b: true, c: false, d: true })).toBe('a b d');
  });

  it('should handle mixed string and conditional classes', () => {
    expect(cn('a', 'b', { c: true, d: false, e: true }, 'f')).toBe('a b c e f');
  });

  it('should correctly merge conflicting Tailwind classes', () => {
    // Example from tailwind-merge documentation
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('px-2', 'py-2', 'p-4')).toBe('p-4');
    expect(cn('text-black', 'text-red-500')).toBe('text-red-500');
    expect(cn('text-sm leading-5', 'text-base leading-6')).toBe('text-base leading-6');
  });

  it('should return empty string for no arguments or all falsy', () => {
    expect(cn()).toBe('');
    expect(cn(null, undefined, false, { a: false })).toBe('');
  });
});

describe('formatPrice utility', () => {
  it('should format whole numbers >= 1000 with 2 decimal places', () => {
    expect(formatPrice(12345)).toBe('12,345.00');
    expect(formatPrice(1000)).toBe('1,000.00');
  });

  it('should format decimal numbers >= 1000 with 2 decimal places', () => {
    expect(formatPrice(1234.567)).toBe('1,234.57'); // Rounding
    expect(formatPrice(1000.1)).toBe('1,000.10');
  });

  it('should format numbers < 1000 with up to 6 decimal places', () => {
    expect(formatPrice(123.45)).toBe('123.45');
    expect(formatPrice(0.123456)).toBe('0.123456');
    expect(formatPrice(0.1234567)).toBe('0.123457'); // Rounding
    expect(formatPrice(999.999999)).toBe('999.999999');
    expect(formatPrice(10)).toBe('10.00'); // Should show .00 for whole numbers
    expect(formatPrice(0.5)).toBe('0.50');
  });
  
  it('should format small numbers correctly', () => {
    expect(formatPrice(0.00000123)).toBe('0.000001'); // Rounds
    expect(formatPrice(0.0000001)).toBe('0.00'); // Rounds down to 0.00 if too small for 6 digits
  });

  it('should format zero correctly', () => {
    expect(formatPrice(0)).toBe('0.00');
  });

  // Testing behavior with non-number inputs - depends on toLocaleString behavior
  // In many environments, non-finite numbers or passing non-numbers might throw or return 'NaN'
  // For this specific implementation, it will likely use the non-number value
  // and toLocaleString will try to convert it, which might result in 'NaN' or throw.
  // Let's assume it might return "NaN" if the input isn't directly usable as a number.
  // A more robust function would handle this, but we test current behavior.
  it('should handle non-numeric inputs gracefully or as per toLocaleString behavior', () => {
    // @ts-expect-error testing invalid input
    expect(() => formatPrice(undefined)).toThrow(); // Or specific error / 'NaN'
    // @ts-expect-error testing invalid input
    expect(() => formatPrice(null)).toThrow();      // Or specific error / 'NaN'
    // @ts-expect-error testing invalid input
    expect(formatPrice('abc')).toBe('NaN');  // toLocaleString('abc') is NaN
  });
});

describe('formatPercentChange utility', () => {
  it('should format positive numbers with a + sign and 2 decimal places', () => {
    expect(formatPercentChange(1.2345)).toBe('+1.23%');
    expect(formatPercentChange(0.5)).toBe('+0.50%');
    expect(formatPercentChange(10)).toBe('+10.00%');
  });

  it('should format negative numbers with a - sign and 2 decimal places', () => {
    expect(formatPercentChange(-2.3456)).toBe('-2.35%'); // Rounding
    expect(formatPercentChange(-0.75)).toBe('-0.75%');
    expect(formatPercentChange(-5)).toBe('-5.00%');
  });

  it('should format zero with a + sign and 2 decimal places', () => {
    expect(formatPercentChange(0)).toBe('+0.00%');
  });
});

describe('formatTimestamp utility', () => {
  // Mock Date.toLocaleTimeString to ensure consistent output across environments/timezones
  // The actual implementation uses new Date(timestamp).toLocaleTimeString(...)

  it('should format timestamp to HH:MM AM/PM format', () => {
    // Example: Test with a specific timestamp
    // 1678886400000 is March 15, 2023 12:00:00 PM UTC
    // The output will depend on the test runner's locale if not mocked.
    // Let's test a specific case by controlling the date object's output.
    
    const date = new Date(2023, 2, 15, 14, 35, 0); // 2:35 PM
    const timestamp = date.getTime();
    // The exact string depends on the testing environment's locale.
    // For 'en-US' it's '2:35 PM'. For 'en-GB' it might be '14:35'.
    // The function uses `[]` for locales, meaning system default.
    // This makes it hard to make a universally passing test without more specific locale or mocking.
    // We'll check if it contains a colon and is a string for now.
    const formatted = formatTimestamp(timestamp);
    expect(typeof formatted).toBe('string');
    expect(formatted).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)?/i); // Loosely check for HH:MM format, optionally AM/PM
  });

  it('should format different times correctly', () => {
    const morning = new Date(2023, 0, 1, 9, 5, 0).getTime(); // 9:05 AM
    const evening = new Date(2023, 0, 1, 21, 45, 0).getTime(); // 9:45 PM
    
    // As above, exact output is locale-dependent. We'll check for pattern.
    expect(formatTimestamp(morning)).toMatch(/\d{1,2}:05\s*(AM|PM)?/i);
    expect(formatTimestamp(evening)).toMatch(/\d{1,2}:45\s*(AM|PM)?/i);
  });

  // To make this more robust, one would typically mock toLocaleTimeString or use a library
  // that allows specifying a locale for testing.
  // For example, using vi.spyOn:
  it('should use 2-digit hour and minute', () => {
    const mockDate = new Date(2023, 0, 1, 7, 8, 9); // 07:08:09
    const timestamp = mockDate.getTime();
    
    // Temporarily mock toLocaleTimeString for this test
    const toLocaleTimeStringSpy = vi.spyOn(Date.prototype, 'toLocaleTimeString');
    toLocaleTimeStringSpy.mockImplementation(function(this: Date, locales, options) {
      // Basic mock to simulate the desired options
      if (options && options.hour === '2-digit' && options.minute === '2-digit') {
        const hours = this.getHours().toString().padStart(2, '0');
        const minutes = this.getMinutes().toString().padStart(2, '0');
        // This mock doesn't handle AM/PM, but the original function might based on locale
        return `${hours}:${minutes}`; 
      }
      // Fallback to original or simpler mock if needed for other calls
      return "mocked time"; 
    });

    const formatted = formatTimestamp(timestamp);
    // According to the mock, this should be '07:08'
    expect(formatted).toBe('07:08');
    
    toLocaleTimeStringSpy.mockRestore(); // Clean up the spy
  });
});
