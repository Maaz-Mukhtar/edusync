export function normalizeTopicName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

