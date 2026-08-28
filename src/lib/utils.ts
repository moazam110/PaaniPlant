import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Relative label for Customer.lastOnlineAt (set on every customer dashboard load)
export const formatLastOnline = (val: any): string => {
  if (!val) return 'Never';
  const ms = Date.now() - new Date(val).getTime();
  if (ms < 60000) return 'Just now';
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
  if (ms < 604800000) return `${Math.floor(ms / 86400000)}d ago`;
  return format(new Date(val), 'MMM d, yyyy');
};
