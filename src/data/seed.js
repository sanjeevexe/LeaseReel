// LeaseReel prototype seed data.
// Extends the three core tables (properties, posts, leads) with the owner-side
// financial context the AI Asset Manager use case calls for: vacancy exposure,
// channel spend/attribution, and a 90-day pilot-vs-baseline-vs-control frame.
// All figures are illustrative demo data grounded in 2025-26 multifamily ranges
// (national days-on-market ~30-41; lead-to-lease avg ~9%, good 10-15%).

export const seedProperties = [
  {
    id: "76c5a4e6-8a0e-4697-80f9-8e8f9b250b0d",
    name: "Maple Court",
    units: 186,
    market: "Austin, TX",
    city: "Austin",
    state: "TX",
    hopa_qualified: false,
    cohort: "pilot",
    avg_rent: 1740,
    vacant_units: 11,
    // 90-day windows: baseline is pre-pilot, current is the live pilot period.
    baseline: { social_leases: 4, cost_per_lease: 545, days_on_market: 41, vacancy_rate: 7.9 },
    current: { social_leases: 13, cost_per_lease: 214, days_on_market: 28, vacancy_rate: 5.9 }
  },
  {
    id: "ee8a51df-0425-4ecf-bd0b-5dc5149dd3c2",
    name: "Harbor Point",
    units: 142,
    market: "Tampa, FL",
    city: "Tampa",
    state: "FL",
    hopa_qualified: false,
    cohort: "pilot",
    avg_rent: 1980,
    vacant_units: 9,
    baseline: { social_leases: 3, cost_per_lease: 590, days_on_market: 39, vacancy_rate: 8.4 },
    current: { social_leases: 10, cost_per_lease: 236, days_on_market: 31, vacancy_rate: 6.3 }
  },
  {
    id: "b9aa4fd5-597c-4338-9e9a-1bd0dc37024c",
    name: "Northline Flats",
    units: 224,
    market: "Denver, CO",
    city: "Denver",
    state: "CO",
    hopa_qualified: false,
    cohort: "pilot",
    avg_rent: 2120,
    vacant_units: 17,
    baseline: { social_leases: 5, cost_per_lease: 512, days_on_market: 37, vacancy_rate: 8.9 },
    current: { social_leases: 16, cost_per_lease: 198, days_on_market: 25, vacancy_rate: 7.6 }
  },
  {
    id: "a7c48824-8a49-4642-a859-e1702db4091a",
    name: "Briar Ridge",
    units: 96,
    market: "Charlotte, NC",
    city: "Charlotte",
    state: "NC",
    hopa_qualified: false,
    cohort: "control",
    avg_rent: 1610,
    vacant_units: 8,
    baseline: { social_leases: 3, cost_per_lease: 556, days_on_market: 40, vacancy_rate: 8.3 },
    current: { social_leases: 4, cost_per_lease: 531, days_on_market: 42, vacancy_rate: 8.6 }
  },
  {
    id: "4d6a12cc-9f42-4a64-9721-20825ced7c3a",
    name: "Hudson Ledger",
    units: 168,
    market: "New York, NY",
    city: "New York",
    state: "NY",
    hopa_qualified: false,
    cohort: "pilot",
    avg_rent: 3450,
    vacant_units: 6,
    baseline: { social_leases: 2, cost_per_lease: 720, days_on_market: 34, vacancy_rate: 3.9 },
    current: { social_leases: 7, cost_per_lease: 305, days_on_market: 27, vacancy_rate: 3.6 }
  },
  {
    id: "1f81a926-3700-4077-a6dc-7c8f6ec3fbed",
    name: "Silver Oaks 55+",
    units: 118,
    market: "Scottsdale, AZ",
    city: "Scottsdale",
    state: "AZ",
    hopa_qualified: true,
    cohort: "control",
    avg_rent: 1890,
    vacant_units: 7,
    baseline: { social_leases: 2, cost_per_lease: 601, days_on_market: 44, vacancy_rate: 6.2 },
    current: { social_leases: 3, cost_per_lease: 588, days_on_market: 43, vacancy_rate: 6.0 }
  }
];

// Explicit dating for every windowed/aggregate figure below (channel spend,
// weekly trend, pilot baseline/current). These are periodic pilot-cycle
// snapshots, not values recomputed from whatever is clicked in a live demo
// session — the same way a real BI tool timestamps a 90-day rollup instead
// of silently recalculating it on every page view. Live-session activity
// (compliance checks you run, leads you log) shows up immediately on
// Overview and Leads instead, which do read straight from session state.
export const pilotWindow = {
  baseline_start: "2026-01-15",
  baseline_end: "2026-04-14",
  current_start: "2026-04-15",
  current_end: "2026-07-14",
  synced_at: "2026-07-14",
  label: "90-day pilot window · Apr 15 – Jul 14, 2026"
};

// Portfolio-wide 90-day marketing attribution by channel. LeaseReel is the
// owned social channel; the rest are the paid sources the doc benchmarks
// against. Synced with pilotWindow.current_end — see note above.
export const channelPerformance = [
  { channel: "LeaseReel (social)", key: "leasereel", owned: true, spend: 9600, leads: 214, leases: 49, tours: 88 },
  { channel: "Zillow", key: "zillow", owned: false, spend: 21400, leads: 173, leases: 42, tours: 71 },
  { channel: "Apartments.com", key: "apartments", owned: false, spend: 24800, leads: 168, leases: 43, tours: 69 },
  { channel: "Google PPC", key: "google", owned: false, spend: 18900, leads: 121, leases: 29, tours: 47 },
  { channel: "Referral", key: "referral", owned: false, spend: 6200, leads: 58, leases: 21, tours: 33 }
];

// Weekly compliance-screening volume for the trend sparkline / bar chart.
// Ordered oldest -> newest; last entry lines up with pilotWindow.synced_at.
export const complianceTrend = [
  { week: "May 26", screened: 34, cleared: 24, needs_review: 7, blocked: 3 },
  { week: "Jun 02", screened: 41, cleared: 29, needs_review: 8, blocked: 4 },
  { week: "Jun 09", screened: 38, cleared: 28, needs_review: 7, blocked: 3 },
  { week: "Jun 16", screened: 47, cleared: 36, needs_review: 8, blocked: 3 },
  { week: "Jun 23", screened: 52, cleared: 41, needs_review: 8, blocked: 3 },
  { week: "Jun 30", screened: 49, cleared: 40, needs_review: 7, blocked: 2 },
  { week: "Jul 07", screened: 58, cleared: 49, needs_review: 7, blocked: 2 },
  { week: "Jul 14", screened: 61, cleared: 53, needs_review: 6, blocked: 2 }
];

// Agent roster (leasing agents whose social posts flow through the compliance
// layer). Portfolio governance = visibility across every agent, every property.
export const agents = [
  { name: "Maya Patel", property_id: "76c5a4e6-8a0e-4697-80f9-8e8f9b250b0d", role: "Senior Leasing" },
  { name: "Jordan Lee", property_id: "ee8a51df-0425-4ecf-bd0b-5dc5149dd3c2", role: "Leasing" },
  { name: "Nia Brooks", property_id: "b9aa4fd5-597c-4338-9e9a-1bd0dc37024c", role: "Leasing" },
  { name: "Carlos Rivera", property_id: "a7c48824-8a49-4642-a859-e1702db4091a", role: "Leasing" },
  { name: "Amara Chen", property_id: "4d6a12cc-9f42-4a64-9721-20825ced7c3a", role: "Senior Leasing" },
  { name: "Elliot Grant", property_id: "1f81a926-3700-4077-a6dc-7c8f6ec3fbed", role: "Leasing" }
];

export const seedPostDrafts = [
  {
    id: "8d7d63b2-1ac0-4839-a282-f7fb7da36e2f",
    property_id: "76c5a4e6-8a0e-4697-80f9-8e8f9b250b0d",
    agent_name: "Maya Patel",
    platform: "instagram",
    published: true,
    body: "Renovated 2BR at Maple Court with hardwood floors, a family room, wheelchair accessible entry, and Equal Housing Opportunity.",
    days_ago: 0.2
  },
  {
    id: "15df14ce-c75d-471e-b9e9-e139ecf8b657",
    property_id: "ee8a51df-0425-4ecf-bd0b-5dc5149dd3c2",
    agent_name: "Jordan Lee",
    platform: "facebook",
    published: false,
    body: "Exclusive executive community in a safe neighborhood, walking distance to the marina and downtown dining.",
    days_ago: 1.1
  },
  {
    id: "beac730e-a773-4ea3-bf75-5980f85b4c9f",
    property_id: "b9aa4fd5-597c-4338-9e9a-1bd0dc37024c",
    agent_name: "Nia Brooks",
    platform: "tiktok",
    published: false,
    body: "Great for families, no kids in the upper-floor homes, but includes a wheelchair accessible lobby and near transit.",
    days_ago: 1.8
  },
  {
    id: "5b33b5d0-9057-4329-ac2d-7c6065d7d18a",
    property_id: "a7c48824-8a49-4642-a859-e1702db4091a",
    agent_name: "Carlos Rivera",
    platform: "instagram",
    published: true,
    body: "Spacious townhome with a master bedroom, walk-in closet, gated community access, near golf course, and a great view.",
    days_ago: 2.4
  },
  {
    id: "2f905fda-578c-4b5c-8a5f-243c2a67041d",
    property_id: "76c5a4e6-8a0e-4697-80f9-8e8f9b250b0d",
    agent_name: "Maya Patel",
    platform: "facebook",
    published: false,
    body: "Private, quiet building with limited availability and controlled-access entry.",
    days_ago: 3.2
  },
  {
    id: "b98d4ad5-3e5c-4e32-b140-4800cb934381",
    property_id: "4d6a12cc-9f42-4a64-9721-20825ced7c3a",
    agent_name: "Amara Chen",
    platform: "instagram",
    published: false,
    body: "No Section 8, no vouchers accepted for this downtown home.",
    days_ago: 3.9
  },
  {
    id: "f6fd57de-1c67-4e1c-9a6e-e96db38ccf54",
    property_id: "1f81a926-3700-4077-a6dc-7c8f6ec3fbed",
    agent_name: "Elliot Grant",
    platform: "facebook",
    published: true,
    body: "Senior living community, ages 55 and up, with renovated one-bedroom homes and Equal Housing Opportunity.",
    days_ago: 4.3
  },
  {
    id: "c1a4e0d2-7b6f-4a1e-90ab-4f2b6d1c9a55",
    property_id: "b9aa4fd5-597c-4338-9e9a-1bd0dc37024c",
    agent_name: "Nia Brooks",
    platform: "instagram",
    published: true,
    body: "Bright top-floor one-bedroom with a walk-in closet, in-unit laundry, and a resident fitness studio. Now leasing.",
    days_ago: 5.1
  },
  {
    id: "d47f9b83-2c5a-4e77-8c1d-6a0e3f2b7c11",
    property_id: "ee8a51df-0425-4ecf-bd0b-5dc5149dd3c2",
    agent_name: "Jordan Lee",
    platform: "tiktok",
    published: true,
    body: "Waterfront studio with floor-to-ceiling windows, a renovated kitchen, and covered parking. Equal Housing Opportunity.",
    days_ago: 6.0
  },
  {
    id: "e58a1c94-3d6b-4f88-9d2e-7b1f4a3c8d22",
    property_id: "4d6a12cc-9f42-4a64-9721-20825ced7c3a",
    agent_name: "Amara Chen",
    platform: "facebook",
    published: true,
    body: "Downtown 1BR steps from the subway, with hardwood floors, a dishwasher, and a rooftop lounge open to all residents.",
    days_ago: 6.8
  },
  {
    id: "f69b2da5-4e7c-4099-ae3f-8c2a5b4d9e33",
    property_id: "76c5a4e6-8a0e-4697-80f9-8e8f9b250b0d",
    agent_name: "Maya Patel",
    platform: "tiktok",
    published: true,
    body: "Take a 30-second walk through our renovated 2BR: new flooring, quartz counters, and a shaded courtyard. Tours daily.",
    days_ago: 7.5
  },
  {
    id: "07ac3eb6-5f8d-41aa-bf40-9d3b6c5e0f44",
    property_id: "a7c48824-8a49-4642-a859-e1702db4091a",
    agent_name: "Carlos Rivera",
    platform: "facebook",
    published: false,
    body: "Perfect for young professionals only, no families, in a mature adult building near the office district.",
    days_ago: 8.2
  }
];

export const seedLeads = [
  {
    id: "1b72fdc3-36b8-4cad-9e57-34818a9dfd4a",
    property_id: "76c5a4e6-8a0e-4697-80f9-8e8f9b250b0d",
    prospect_name: "Avery Mitchell",
    source: "instagram",
    interaction_type: "dm",
    message: "Is the renovated 2BR still available this weekend?",
    stage: "new",
    days_ago: 0.1
  },
  {
    id: "3ce12902-18e6-4c25-ab14-043f8c3a092a",
    property_id: "ee8a51df-0425-4ecf-bd0b-5dc5149dd3c2",
    prospect_name: "Priya Shah",
    source: "facebook",
    interaction_type: "comment",
    message: "Can someone send floor plans for the marina-facing units?",
    stage: "contacted",
    days_ago: 0.8
  },
  {
    id: "48f78e2a-29d2-4a56-b45c-e38fd572274c",
    property_id: "b9aa4fd5-597c-4338-9e9a-1bd0dc37024c",
    prospect_name: "Marcus Reed",
    source: "tiktok",
    interaction_type: "click",
    message: "Clicked tour link from short-form video.",
    stage: "toured",
    days_ago: 1.4
  },
  {
    id: "b1597a42-163b-4548-9d9b-9cb6ce0496c1",
    property_id: "a7c48824-8a49-4642-a859-e1702db4091a",
    prospect_name: "Elena Torres",
    source: "instagram",
    interaction_type: "form_fill",
    message: "Requested pricing for townhomes near the golf course.",
    stage: "leased",
    days_ago: 3.8
  },
  {
    id: "5bfe8cb9-7105-437c-b592-ac63550f46cc",
    property_id: "ee8a51df-0425-4ecf-bd0b-5dc5149dd3c2",
    prospect_name: "Noah Carter",
    source: "instagram",
    interaction_type: "dm",
    message: "Asked about parking and pet policy.",
    stage: "new",
    days_ago: 2.1
  },
  {
    id: "b3a61a4d-7b85-4a8d-a20a-5c08d1a82a78",
    property_id: "76c5a4e6-8a0e-4697-80f9-8e8f9b250b0d",
    prospect_name: "Simone Walker",
    source: "facebook",
    interaction_type: "comment",
    message: "Asked whether Saturday tours are open.",
    stage: "lost",
    days_ago: 4.5
  },
  {
    id: "8300ffc5-cff6-44f1-b3dc-b737b5469d70",
    property_id: "4d6a12cc-9f42-4a64-9721-20825ced7c3a",
    prospect_name: "Leah Stein",
    source: "facebook",
    interaction_type: "form_fill",
    message: "Requested a tour after seeing the downtown availability post.",
    stage: "contacted",
    days_ago: 1.7
  },
  {
    id: "9a4c1f77-6b21-4d3e-8f0a-2c5b7e9d1a44",
    property_id: "b9aa4fd5-597c-4338-9e9a-1bd0dc37024c",
    prospect_name: "Diego Morales",
    source: "instagram",
    interaction_type: "dm",
    message: "Loved the walkthrough. Can I see the top-floor 1BR Thursday?",
    stage: "toured",
    days_ago: 2.6
  },
  {
    id: "a1b2c3d4-7e8f-4a90-b1c2-3d4e5f6a7b88",
    property_id: "b9aa4fd5-597c-4338-9e9a-1bd0dc37024c",
    prospect_name: "Hannah Kim",
    source: "tiktok",
    interaction_type: "form_fill",
    message: "Filled out the tour form from the fitness studio reel.",
    stage: "leased",
    days_ago: 5.2
  },
  {
    id: "b2c3d4e5-8f90-4a12-c3d4-5e6f7a8b9c99",
    property_id: "76c5a4e6-8a0e-4697-80f9-8e8f9b250b0d",
    prospect_name: "Tyrell Jackson",
    source: "instagram",
    interaction_type: "click",
    message: "Clicked the apply link from the courtyard video.",
    stage: "leased",
    days_ago: 6.1
  },
  {
    id: "c3d4e5f6-9012-4a34-d4e5-6f7a8b9c0daa",
    property_id: "4d6a12cc-9f42-4a64-9721-20825ced7c3a",
    prospect_name: "Sofia Rossi",
    source: "facebook",
    interaction_type: "comment",
    message: "Is the rooftop lounge open to all residents?",
    stage: "contacted",
    days_ago: 3.1
  },
  {
    id: "d4e5f6a7-0123-4a56-e5f6-7a8b9c0d1ebb",
    property_id: "ee8a51df-0425-4ecf-bd0b-5dc5149dd3c2",
    prospect_name: "Grace Nguyen",
    source: "tiktok",
    interaction_type: "click",
    message: "Clicked through from the waterfront studio clip.",
    stage: "new",
    days_ago: 0.5
  },
  {
    id: "e5f6a7b8-1234-4a67-f6a7-8b9c0d1e2fcc",
    property_id: "a7c48824-8a49-4642-a859-e1702db4091a",
    prospect_name: "Owen Brooks",
    source: "instagram",
    interaction_type: "dm",
    message: "Asked about lease length options for the townhomes.",
    stage: "toured",
    days_ago: 4.9
  },
  {
    id: "f6a7b8c9-2345-4a78-a7b8-9c0d1e2f3add",
    property_id: "b9aa4fd5-597c-4338-9e9a-1bd0dc37024c",
    prospect_name: "Isabella Cruz",
    source: "instagram",
    interaction_type: "form_fill",
    message: "Requested a same-week tour of a top-floor unit.",
    stage: "leased",
    days_ago: 7.3
  }
];

export const complianceExamples = [
  {
    id: "clean",
    label: "Clean property-feature copy",
    body: "Renovated 2BR with hardwood floors, a family room, wheelchair accessible entry, walk-in closet, and Equal Housing Opportunity."
  },
  {
    id: "caution",
    label: "Caution-only steering language",
    body: "Exclusive executive community in a safe neighborhood, walking distance to downtown and ideal for a polished lifestyle."
  },
  {
    id: "violation",
    label: "Hard violation plus false-positive trap",
    body: "Great for families, no kids in upper-floor homes, with a wheelchair accessible lobby, spacious layouts, and hardwood floors."
  },
  {
    id: "source-income",
    label: "Source-of-income jurisdiction switch",
    property_id: "76c5a4e6-8a0e-4697-80f9-8e8f9b250b0d",
    body: "No Section 8, no vouchers accepted."
  },
  {
    id: "hopa",
    label: "HOPA-qualified senior housing",
    property_id: "1f81a926-3700-4077-a6dc-7c8f6ec3fbed",
    body: "Senior living community, ages 55 and up, with renovated one-bedroom homes and Equal Housing Opportunity."
  }
];

export const stages = ["new", "contacted", "toured", "leased", "lost"];
export const platforms = ["instagram", "tiktok", "facebook"];
export const interactionTypes = ["dm", "comment", "click", "form_fill"];
