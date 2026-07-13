import type { ServiceFrequency } from "@/types/booking";

export const brand = {
  name: "Clean Curb Co.",
  tagline: "Fresh Starts at the Curb.",
  legalNote: "Clean Curb Co. is operated by Stonebranch Capital LLC.",
  area:
    "Summerville, Goose Creek, Moncks Corner, and surrounding Charleston-area communities",
  phone: "+1 (843) 888-4124",
  phoneHref: "tel:+18438884124",
  email: "contact@cleancurbco.com",
  emailHref: "mailto:contact@cleancurbco.com",
  logoAlt: "Clean Curb Co. logo — Fresh Starts at the Curb.",
};

export const launchPromo =
  "Recurring service keeps your bins cleaner, fresher, and easier to live with — without having to remember to rebook.";

export const launchNotice =
  "Now accepting bookings throughout our current service area. Service dates are confirmed based on collection schedules and route availability.";

export const launchRouteDate = "";

export const launchRouteHeadline =
  "We build efficient neighborhood routes around local trash-collection schedules.";

export const launchReservationCopy =
  "Submit your booking request and we will confirm your service date before payment is due.";

export const launchBillingNote =
  "Payment is due no later than 24 hours before your confirmed service date.";

export const futureBillingNote =
  "Recurring services are billed according to the selected service frequency. We may adjust payment dates with advance notice when needed for routing or billing operations.";

export const bookingLaunchTimingNotice =
  "Your booking request reserves a place on an upcoming route. We will confirm your service date based on your regular collection day and current route availability.";

export const bookingBillingAfterLaunchNotice =
  "Payment is due no later than 24 hours before your confirmed service date. Recurring plans are billed according to the selected service frequency.";

export const bookingLaunchAgreement =
  "I understand that my requested date is not final until Clean Curb Co. confirms my route. Payment must be completed no later than 24 hours before the confirmed service date.";

export const bookingSuccessLaunchMessage =
  "Your request has been received. We will review your collection day, confirm your service date, and send payment instructions before service.";

export const navItems = [
  { label: "Services", href: "/services" },
  { label: "Pricing", href: "/pricing" },
  { label: "Service Area", href: "/service-area" },
  { label: "FAQ", href: "/faq" },
  { label: "Login", href: "/login" },
];

export const oneTimeRows = [
  { label: "1 bin", price: "$25" },
  { label: "2 bins", price: "$35" },
  { label: "3 bins", price: "$45" },
  { label: "Each additional bin", price: "+$10" },
];

export const recurringPlans: Array<{
  id: ServiceFrequency;
  name: string;
  label: string;
  frequency: string;
  price: string;
  suffix: string;
  featured?: boolean;
  highlights: string[];
}> = [
  {
    id: "monthly",
    name: "Fresh Routine",
    label: "Monthly",
    frequency: "Every month",
    price: "$25",
    suffix: "/visit",
    featured: true,
    highlights: [
      "Best for bins stored near garages",
      "No rebooking needed",
      "Up to 2 bins included",
    ],
  },
  {
    id: "every_other_month",
    name: "Most Popular",
    label: "Every Other Month",
    frequency: "Every 2 months",
    price: "$30",
    suffix: "/visit",
    highlights: [
      "Keeps odors under control",
      "Easy route-day reminders",
      "Up to 2 bins included",
    ],
  },
  {
    id: "quarterly",
    name: "Seasonal Fresh Start",
    label: "Quarterly",
    frequency: "Every 3 months",
    price: "$35",
    suffix: "/visit",
    highlights: [
      "Good seasonal reset",
      "Simple recurring service",
      "Up to 2 bins included",
    ],
  },
];

export const addOns = [
  {
    id: "trash_pad_refresh",
    name: "Trash Pad Refresh",
    price: "+$12",
    estimate: 12,
    description: "Rinse and sanitize the curb or pad area where bins rest.",
  },
  {
    id: "deodorizer_boost",
    name: "Deodorizer Boost",
    price: "+$5",
    estimate: 5,
    description: "A little extra help for the bins that have stories.",
  },
  {
    id: "heavy_grime_cleanup",
    name: "Heavy Grime Cleanup",
    price: "+$15",
    estimate: 15,
    description: "For sticky residue, extra buildup, or serious grime.",
  },
  {
    id: "driveway_sidewalk_spot_clean",
    name: "Driveway/Sidewalk Spot Clean",
    price: "Starting at +$25",
    estimate: 25,
    description: "Small spot clean for nearby curb, driveway, or sidewalk areas.",
  },
  {
    id: "pet_waste_cleanup",
    name: "Pet Waste Cleanup",
    price: "Starting at +$20",
    estimate: 20,
    description: "Targeted outdoor cleanup support. Final price confirmed first.",
  },
];

export const neighborhoods = [
  "Cane Bay Plantation",
  "Lindera Preserve",
  "The Oaks",
  "Old Rice Retreat",
  "Sanctuary Cove",
  "Four Seasons",
  "Lakes of Cane Bay",
  "Nexton",
  "Carnes Crossroads",
  "Summers Corner",
  "Downtown Summerville",
  "Sangaree",
  "Goose Creek",
  "Moncks Corner",
  "Other / Not sure",
];

export const binTypes = [
  "Trash bin",
  "Recycling bin",
  "Yard waste bin",
  "Other",
];

export const serviceAreas = [
  "Summerville",
  "Cane Bay",
  "Nexton",
  "Carnes Crossroads",
  "Summers Corner",
  "Goose Creek",
  "Moncks Corner",
  "Nearby Charleston-area communities within our service radius",
];

export const futureServices = [
  "Full driveway cleaning",
  "Sidewalk cleaning",
  "Gutter cleaning",
  "Trash enclosure cleaning",
  "Commercial dumpster cleaning",
  "Full pressure washing",
  "Soft washing",
  "Window cleaning",
  "Holiday lighting",
  "Fleet washing",
  "HOA / municipal contracts",
];

export const faqItems = [
  {
    question: "How do you choose my service date?",
    answer:
      "We normally schedule cleaning after your regular trash collection so the bins are empty. Your requested date is reviewed against current route availability before it is confirmed.",
  },
  {
    question: "When is payment due?",
    answer:
      "Payment is due no later than 24 hours before your confirmed service date. Your booking is not fully scheduled until the route date has been confirmed.",
  },
  {
    question: "How does recurring billing work?",
    answer:
      "Recurring plans are billed according to the selected service frequency. We will provide payment and scheduling details before your first confirmed service.",
  },
  {
    question: "Can Clean Curb Co change my billing date?",
    answer:
      "We may adjust billing dates with advance notice when needed for route scheduling, service changes, or billing operations.",
  },
  {
    question: "Do I need to be home?",
    answer:
      "No. As long as your bins are empty and accessible, we can handle the cleaning and send an update when it is done.",
  },
  {
    question: "Do you use my water?",
    answer:
      "Yes, we may use an exterior water spigot when needed. Water usage is minimal and may be recorded with an inline meter.",
  },
  {
    question: "What if my bins are full?",
    answer:
      "Bins need to be empty before service. Full or inaccessible bins may need to be rescheduled.",
  },
  {
    question: "What happens to wastewater?",
    answer:
      "We use reasonable efforts to collect, manage, or redirect wastewater when appropriate and avoid intentional discharge into storm drains.",
  },
  {
    question: "Are your products eco-safe?",
    answer:
      "We use eco-conscious cleaning products whenever possible and choose practical methods that help reduce odor and grime.",
  },
  {
    question: "Can I cancel recurring service?",
    answer:
      "Yes. Keep it simple: reach out before your next planned service and we will help adjust or cancel your recurring service.",
  },
  {
    question: "Do you clean recycling bins?",
    answer: "Yes. Recycling bins are welcome as long as they are empty.",
  },
  {
    question: "Do you clean yard waste bins?",
    answer:
      "Yes, as long as they are empty and safe to clean. If a bin is packed with yard debris, we will need to reschedule.",
  },
  {
    question: "What if my bin is extra nasty?",
    answer:
      "Heavy grime, maggots, or extreme buildup may require an additional fee. We will confirm the final price before service.",
  },
];

export const portalFeatures = [
  "View upcoming service",
  "View past cleanings",
  "View before/after photos",
  "Update contact info",
  "Update service address",
  "Pause recurring service",
  "Cancel recurring service",
  "Request add-ons",
  "Update payment method",
  "View billing/payment history",
  "Referral rewards",
  "Leave a review",
];

export const adminFeatures = [
  "New booking requests",
  "Customer list",
  "Route grouping by neighborhood",
  "Service status tracking",
  "Add/edit bookings",
  "Internal notes",
  "Payment status",
  "Add-ons",
  "Agreement tracking",
  "Water spigot availability",
  "Before/after photos",
  "Route map planning",
  "Review request status",
  "Referral tracking",
  "Settings/pricing editing",
];
