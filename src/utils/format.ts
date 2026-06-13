export function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatRelativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffWeek === 1) return 'Last week';
  if (diffWeek < 4) return `${diffWeek}w ago`;
  if (diffMonth === 1) return 'Last month';
  return `${diffMonth}mo ago`;
}

export function formatPlatform(platform: string): string {
  switch (platform.toLowerCase()) {
    case 'youtube':
      return 'YouTube';
    case 'tiktok':
      return 'TikTok';
    case 'instagram':
      return 'Instagram';
    default:
      return platform.charAt(0).toUpperCase() + platform.slice(1);
  }
}

export function formatContentType(contentType: string | null): string {
  if (!contentType) return 'General';
  switch (contentType) {
    case 'recipe':
      return 'Recipe';
    case 'workout':
      return 'Workout';
    case 'tutorial_diy':
      return 'DIY';
    case 'beauty_fashion':
      return 'Beauty & Fashion';
    case 'education':
      return 'Education';
    case 'entertainment':
      return 'Entertainment';
    case 'general':
      return 'General';
    default:
      return contentType;
  }
}
