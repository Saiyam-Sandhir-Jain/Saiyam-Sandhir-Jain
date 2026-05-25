import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge Tailwind CSS classes without conflicts.
 * Usage: cn('base-class', condition && 'conditional-class', 'override-class')
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
