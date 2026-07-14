import type {
  CollectionDay,
  CollectionTimeWindow,
  SameDayPreference,
} from "@/types/booking";

type KnownCollectionDay = Exclude<
  CollectionDay,
  "varies" | "not_sure"
>;

export type BookingSchedulingRecommendation = {
  suggestedServiceDate: string | null;
  earliestSafeServiceTime: string | null;
  requiresManualReview: boolean;
  manualReviewReason: string | null;
};

const collectionDayIndexes: Record<KnownCollectionDay, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const weekdayIndexes: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const sameDayEarliestTimes: Partial<
  Record<CollectionTimeWindow, string>
> = {
  before_6_am: "07:30:00",
  "6_8_am": "08:30:00",
  "8_10_am": "10:30:00",
  "10_am_12_pm": "12:30:00",
  "12_2_pm": "14:30:00",
  "2_4_pm": "16:30:00",
  "4_6_pm": "18:30:00",
};

const nextDayWindows = new Set<CollectionTimeWindow>([
  "4_6_pm",
  "after_6_pm",
  "varies",
  "not_sure",
]);

export function buildBookingSchedulingRecommendation({
  collectionDay,
  collectionTimeWindow,
  sameDayPreference,
  requestedDate,
  now = new Date(),
}: {
  collectionDay: CollectionDay | null;
  collectionTimeWindow: CollectionTimeWindow | null;
  sameDayPreference: SameDayPreference;
  requestedDate: string | null;
  now?: Date;
}): BookingSchedulingRecommendation {
  if (requestedDate) {
    return {
      suggestedServiceDate: requestedDate,
      earliestSafeServiceTime: null,
      requiresManualReview: true,
      manualReviewReason:
        "Customer requested a specific service date.",
    };
  }

  if (
    !collectionDay ||
    collectionDay === "varies" ||
    collectionDay === "not_sure"
  ) {
    return {
      suggestedServiceDate: null,
      earliestSafeServiceTime: null,
      requiresManualReview: true,
      manualReviewReason:
        "Regular collection day requires confirmation.",
    };
  }

  const collectionDate = getNextCollectionDate(collectionDay, now);

  if (!collectionTimeWindow) {
    return {
      suggestedServiceDate: addDays(collectionDate, 1),
      earliestSafeServiceTime: "07:30:00",
      requiresManualReview: true,
      manualReviewReason:
        "Typical collection time was not provided.",
    };
  }

  const scheduleNextDay =
    sameDayPreference === "next_day_preferred" ||
    nextDayWindows.has(collectionTimeWindow);

  return {
    suggestedServiceDate: scheduleNextDay
      ? addDays(collectionDate, 1)
      : collectionDate,
    earliestSafeServiceTime: scheduleNextDay
      ? "07:30:00"
      : sameDayEarliestTimes[collectionTimeWindow] ?? null,
    requiresManualReview: false,
    manualReviewReason: null,
  };
}

function getNextCollectionDate(
  collectionDay: KnownCollectionDay,
  now: Date,
) {
  const businessDate = getBusinessDate(now);
  const currentDayIndex = getBusinessWeekdayIndex(now);
  const targetDayIndex = collectionDayIndexes[collectionDay];

  const daysUntilCollection =
    (targetDayIndex - currentDayIndex + 7) % 7;

  return addDays(businessDate, daysUntilCollection);
}

function getBusinessDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Unable to determine the business date.");
  }

  return `${year}-${month}-${day}`;
}

function getBusinessWeekdayIndex(date: Date) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
  }).format(date);

  return weekdayIndexes[weekday] ?? 0;
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
