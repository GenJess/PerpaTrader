import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatPrice = (price: number) => {
  return price >= 1000 
    ? price.toLocaleString('en-US', { maximumFractionDigits: 2 })
    : price.toLocaleString('en-US', { maximumFractionDigits: 6 });
};

export const formatPercentChange = (change: number) => {
  const prefix = change >= 0 ? '+' : '';
  return `${prefix}${change.toFixed(2)}%`;
};

export const formatTimestamp = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};