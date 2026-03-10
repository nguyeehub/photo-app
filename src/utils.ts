import { BurstGroup, DateSection, SortOrder } from "./types";

/** Format a date string like "2025-01-15" into "January 15, 2025" */
export function formatDateHeading(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${months[month - 1]} ${day}, ${year}`;
}

/** Group burst groups into date sections and apply sort order */
export function groupByDate(
  groups: BurstGroup[],
  sortOrder: SortOrder
): DateSection[] {
  // Build a map of date -> groups
  const dateMap = new Map<string, BurstGroup[]>();

  for (const group of groups) {
    const key = group.date_key ?? "unknown";
    if (!dateMap.has(key)) {
      dateMap.set(key, []);
    }
    dateMap.get(key)!.push(group);
  }

  // Convert to sections
  let sections: DateSection[] = Array.from(dateMap.entries()).map(
    ([date, dateGroups]) => ({
      date,
      displayDate:
        date === "unknown" ? "Unknown Date" : formatDateHeading(date),
      groups: dateGroups,
      totalPhotos: dateGroups.reduce((sum, g) => sum + g.count, 0),
    })
  );

  // Sort sections by date
  sections.sort((a, b) => {
    if (a.date === "unknown") return 1;
    if (b.date === "unknown") return -1;
    if (sortOrder === "newest") {
      return b.date.localeCompare(a.date);
    }
    return a.date.localeCompare(b.date);
  });

  // Also reverse the group order within each section if newest-first
  if (sortOrder === "newest") {
    for (const section of sections) {
      section.groups.reverse();
    }
  }

  return sections;
}
