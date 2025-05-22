import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines multiple class names into a single string, resolving Tailwind CSS conflicts.
 * Uses `clsx` for conditional class name handling and `tailwind-merge` for conflict resolution.
 * @param inputs - A list of class names or conditional class objects.
 * @returns A string of combined and merged class names.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Formats a numerical price into a currency string.
 * Uses 2 decimal places for prices >= $1000, and up to 6 decimal places for prices < $1000.
 * @param price - The price to format.
 * @returns A string representing the formatted price, e.g., "1,234.56" or "0.123456".
 *          Returns "NaN" or throws an error if the input is not a valid number.
 */
export const formatPrice = (price: number): string => {
  if (typeof price !== 'number' || isNaN(price)) {
    // Or throw new Error("Invalid price provided");
    // Depending on desired error handling, current implementation relies on toLocaleString's behavior
  }
  return price >= 1000 
    ? price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
};

/**
 * Formats a numerical change into a percentage string with a sign.
 * @param change - The percentage change value (e.g., 1.23 for +1.23%, -0.5 for -0.50%).
 * @returns A string representing the formatted percentage change, e.g., "+1.23%", "-0.50%".
 */
export const formatPercentChange = (change: number): string => {
  const prefix = change >= 0 ? '+' : '';
  return `${prefix}${change.toFixed(2)}%`;
};

/**
 * Formats a Unix timestamp into a human-readable time string (HH:MM AM/PM or 24-hour format based on locale).
 * @param timestamp - The Unix timestamp in milliseconds.
 * @returns A string representing the formatted time, e.g., "02:30 PM" or "14:30".
 */
export const formatTimestamp = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};