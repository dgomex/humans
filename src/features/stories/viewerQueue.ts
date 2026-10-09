/**
 * Order of reels for the story viewer: the tray (page 43) sets the users in tray order before
 * opening `/stories/[userId]`, so swiping moves through the same list. A profile ring opens a
 * single user.
 */
let queue: string[] = [];

export function setStoryQueue(userIds: string[]) {
  queue = userIds;
}

export function storyQueueFor(userId: string): string[] {
  return queue.includes(userId) ? queue : [userId];
}
