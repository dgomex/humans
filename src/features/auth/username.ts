/** Client mirror of public.is_valid_username (the database is the source of truth). */
export function usernameRuleError(name: string): string | null {
  if (!name) return null;
  if (name.length > 30) return 'Enter a username that is 30 characters or less.';
  if (!/^[a-z0-9._]+$/.test(name))
    return 'Usernames can only use letters, numbers, underscores and periods.';
  if (name.includes('..')) return "You can't use more than one period in a row.";
  if (name.startsWith('.') || name.endsWith('.'))
    return "You can't start or end a username with a period.";
  return null;
}
