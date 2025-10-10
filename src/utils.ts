import { User } from './data/mockData';

// A consistent set of colors for the avatars
const COLORS = [
  'f44336', 'e91e63', '9c27b0', '673ab7', '3f51b5',
  '2196f3', '03a9f4', '00bcd4', '009688', '4caf50',
  '8bc34a', 'cddc39', 'ffc107', 'ff9800',
  'ff5722', '795548', '607d8b'
];

/**
 * Generates a consistent color from a string (e.g., a user ID).
 * @param str The string to hash.
 * @returns A hex color code without the '#'.
 */
const generateColor = (str: string): string => {
  let hash = 0;
  if (str.length === 0) return COLORS[0];
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  const index = Math.abs(hash % COLORS.length);
  return COLORS[index];
};

/**
 * Returns a user's avatar URL or generates a placeholder if one doesn't exist.
 * @param user The user object.
 * @returns A URL string for the avatar image.
 */
export const getAvatarUrl = (user: User | null | undefined): string => {
    if (!user) {
        // Fallback for when user data isn't available yet
        return `https://placehold.co/128x128/cccccc/FFFFFF?text=?`;
    }

    // If the user has a real avatar (from Google Sign-In), use it.
    if (user.avatar) {
        return user.avatar;
    }

    // Otherwise, generate a colorful placeholder with their initial.
    const firstLetter = user.name ? user.name.charAt(0).toUpperCase() : '?';
    const color = generateColor(user.uid);
    
    // Using placehold.co to generate the image
    return `https://placehold.co/128x128/${color}/FFFFFF?text=${firstLetter}`;
}
