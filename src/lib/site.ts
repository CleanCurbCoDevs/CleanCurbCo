import type { ServiceFrequency } from "@/types/booking";

export const brand = {
  name: "Clean Curb Co.",
  tagline: "Fresh Starts at the Curb.",
  legalNote:
    "Clean Curb Co. is operated as a DBA under Stonebranch Capital LLC.",
  area: "Cane Bay / Summerville, SC",
  phone: "+1 (843) 888-4121",
  phoneHref: "tel:+18438884121",
  email: "cleancurbco@stonebranchcapital.com",
  emailHref: "mailto:cleancurbco@stonebranchcapital.com",
  logoAlt: "Clean Curb Co. logo — Fresh Starts at the Curb.",
};

export const navItems = [
  { label: "Services", href: "/services" },
  { label: "Pricing", href: "/pricing" },
  { label: "Service Area", href: "/service-area" },
  { label: "FAQ", href: "/faq" },
  { label: "Careers", href: "/careers" },
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
  "Other / Not sure",
];

export const binTypes = [
  "Trash bin",
  "Recycling bin",
  "Yard waste bin",
  "Other",
];

export const serviceAreas = [
  "Cane Bay",
  "Cane Bay Plantation",
  "Lindera Preserve",
  "The Oaks",
  "Old Rice Retreat",
  "Sanctuary Cove",
  "Four Seasons",
  "Lakes of Cane Bay",
  "Nearby Summerville communities",
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
    question: "Do I need to be home?",
    answer:
      "No. As long as your bins are empty and accessible, we can handle the cleaning and send an update when it is done.",
  },
  {
    question: "Do you use my water?",
    answer:
      "At launch, yes, we may use an exterior water spigot when needed. Water usage is minimal and may be recorded with an inline meter.",
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
