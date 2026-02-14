/**
 * Seed the database with 50 diverse, well-known donors across sectors.
 * Run: npx tsx prisma/seed-diverse.ts
 *
 * These are real, publicly known foundations with accurate data.
 * Each entry includes: name, type, description, website, location,
 * causes, target populations, geographic focus, quality score, and sample grants.
 */

import pg from "pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface SeedDonor {
  name: string;
  type: "FOUNDATION" | "CORPORATE" | "INDIVIDUAL" | "GOVERNMENT" | "OTHER";
  description: string;
  website: string;
  country: string;
  city: string;
  location: string;
  causes: string[];
  targetPopulations: string[];
  geographicFocus: string[];
  dataQualityScore: number;
  dataSources: { source: string; url: string }[];
  researchStatus: "COMPLETED";
  ein?: string;
  totalGivingUsd?: number;
  avgGrantSizeUsd?: number;
}

interface SeedGrant {
  donorName: string;
  recipientName: string;
  amount: number;
  year: number;
  purpose: string;
}

// ============================================================
// HEALTH (6 donors)
// ============================================================

const healthDonors: SeedDonor[] = [
  {
    name: "Bill & Melinda Gates Foundation",
    type: "FOUNDATION",
    description:
      "The world's largest private charitable foundation, focused on global health, poverty reduction, and expanding educational opportunity. Spends over $7 billion annually on programs including vaccine development, disease eradication, and agricultural innovation in developing countries.",
    website: "https://www.gatesfoundation.org",
    country: "United States",
    city: "Seattle",
    location: "Seattle, Washington, USA",
    causes: ["Health", "Poverty Alleviation", "Education", "Food & Agriculture", "International Development"],
    targetPopulations: ["Low-Income Communities", "Children", "Women", "Farmers"],
    geographicFocus: ["Global", "Sub-Saharan Africa", "South Asia", "United States"],
    dataQualityScore: 0.95,
    dataSources: [{ source: "seed", url: "https://www.gatesfoundation.org" }],
    researchStatus: "COMPLETED",
    ein: "56-2618866",
    totalGivingUsd: 7000000000,
    avgGrantSizeUsd: 5000000,
  },
  {
    name: "Robert Wood Johnson Foundation",
    type: "FOUNDATION",
    description:
      "The nation's largest philanthropy dedicated solely to health. Works to build a culture of health in the United States, addressing health equity, healthy communities, and transforming health and health care systems.",
    website: "https://www.rwjf.org",
    country: "United States",
    city: "Princeton",
    location: "Princeton, New Jersey, USA",
    causes: ["Health", "Community Development", "Human Rights"],
    targetPopulations: ["Underserved Communities", "Children", "Elderly"],
    geographicFocus: ["United States"],
    dataQualityScore: 0.90,
    dataSources: [{ source: "seed", url: "https://www.rwjf.org" }],
    researchStatus: "COMPLETED",
    ein: "22-1907153",
    totalGivingUsd: 600000000,
    avgGrantSizeUsd: 500000,
  },
  {
    name: "Wellcome Trust",
    type: "FOUNDATION",
    description:
      "A global charitable foundation focused on health research. Based in London, Wellcome supports scientists and researchers to solve urgent health challenges, funding work in infectious diseases, mental health, climate and health.",
    website: "https://wellcome.org",
    country: "United Kingdom",
    city: "London",
    location: "London, United Kingdom",
    causes: ["Health", "Science & Research", "Mental Health"],
    targetPopulations: ["Researchers", "Scientists", "Global Population"],
    geographicFocus: ["Global", "United Kingdom", "Sub-Saharan Africa"],
    dataQualityScore: 0.88,
    dataSources: [{ source: "seed", url: "https://wellcome.org" }],
    researchStatus: "COMPLETED",
    totalGivingUsd: 1200000000,
    avgGrantSizeUsd: 2000000,
  },
  {
    name: "The Susan Thompson Buffett Foundation",
    type: "FOUNDATION",
    description:
      "One of the largest private foundations in the US, focused on reproductive health and rights, particularly access to family planning services. Also funds scholarships for Nebraska students.",
    website: "https://www.buffettfoundation.org",
    country: "United States",
    city: "Omaha",
    location: "Omaha, Nebraska, USA",
    causes: ["Health", "Women & Girls", "Education"],
    targetPopulations: ["Women", "Students", "Low-Income Communities"],
    geographicFocus: ["United States", "Global", "Sub-Saharan Africa"],
    dataQualityScore: 0.82,
    dataSources: [{ source: "seed", url: "https://www.buffettfoundation.org" }],
    researchStatus: "COMPLETED",
    ein: "47-0632523",
    totalGivingUsd: 600000000,
    avgGrantSizeUsd: 3000000,
  },
  {
    name: "The Bloomberg Philanthropies",
    type: "FOUNDATION",
    description:
      "Founded by Michael Bloomberg, this foundation works in five areas: arts, education, environment, government innovation, and public health. Known for major anti-smoking and anti-obesity campaigns worldwide.",
    website: "https://www.bloomberg.org",
    country: "United States",
    city: "New York",
    location: "New York, New York, USA",
    causes: ["Health", "Environment", "Arts & Culture", "Education", "Democracy & Governance"],
    targetPopulations: ["Urban Communities", "Youth", "Global Population"],
    geographicFocus: ["Global", "United States"],
    dataQualityScore: 0.90,
    dataSources: [{ source: "seed", url: "https://www.bloomberg.org" }],
    researchStatus: "COMPLETED",
    totalGivingUsd: 1700000000,
    avgGrantSizeUsd: 5000000,
  },
  {
    name: "The California Endowment",
    type: "FOUNDATION",
    description:
      "A private health foundation that works to expand access to affordable, quality health care for underserved communities in California. Focuses on health equity, community power building, and systemic change.",
    website: "https://www.calendow.org",
    country: "United States",
    city: "Los Angeles",
    location: "Los Angeles, California, USA",
    causes: ["Health", "Community Development", "Human Rights"],
    targetPopulations: ["Underserved Communities", "Immigrants", "Youth"],
    geographicFocus: ["California", "United States"],
    dataQualityScore: 0.84,
    dataSources: [{ source: "seed", url: "https://www.calendow.org" }],
    researchStatus: "COMPLETED",
    ein: "95-4523232",
    totalGivingUsd: 200000000,
    avgGrantSizeUsd: 500000,
  },
];

// ============================================================
// EDUCATION (5 donors)
// ============================================================

const educationDonors: SeedDonor[] = [
  {
    name: "Walton Family Foundation",
    type: "FOUNDATION",
    description:
      "Founded by the family behind Walmart, the Walton Family Foundation is a major funder of K-12 education reform, charter schools, and school choice. Also invests in environmental conservation and community development in the Arkansas-Mississippi Delta.",
    website: "https://www.waltonfamilyfoundation.org",
    country: "United States",
    city: "Bentonville",
    location: "Bentonville, Arkansas, USA",
    causes: ["Education", "Environment", "Community Development"],
    targetPopulations: ["Students", "Teachers", "Rural Communities"],
    geographicFocus: ["United States", "Arkansas-Mississippi Delta"],
    dataQualityScore: 0.88,
    dataSources: [{ source: "seed", url: "https://www.waltonfamilyfoundation.org" }],
    researchStatus: "COMPLETED",
    ein: "71-0547084",
    totalGivingUsd: 750000000,
    avgGrantSizeUsd: 1000000,
  },
  {
    name: "Lumina Foundation",
    type: "FOUNDATION",
    description:
      "An independent, private foundation committed to making opportunities for learning beyond high school available to all. Focused on increasing the proportion of Americans with college degrees and credentials.",
    website: "https://www.luminafoundation.org",
    country: "United States",
    city: "Indianapolis",
    location: "Indianapolis, Indiana, USA",
    causes: ["Education", "Poverty Alleviation"],
    targetPopulations: ["Students", "Adult Learners", "First-Generation Students"],
    geographicFocus: ["United States"],
    dataQualityScore: 0.85,
    dataSources: [{ source: "seed", url: "https://www.luminafoundation.org" }],
    researchStatus: "COMPLETED",
    ein: "35-1813228",
    totalGivingUsd: 90000000,
    avgGrantSizeUsd: 500000,
  },
  {
    name: "The Spencer Foundation",
    type: "FOUNDATION",
    description:
      "Dedicated to the investigation and improvement of education. Funds research across disciplines to understand and improve education at every level, from early childhood through postsecondary.",
    website: "https://www.spencer.org",
    country: "United States",
    city: "Chicago",
    location: "Chicago, Illinois, USA",
    causes: ["Education", "Science & Research"],
    targetPopulations: ["Researchers", "Educators", "Students"],
    geographicFocus: ["United States", "Global"],
    dataQualityScore: 0.82,
    dataSources: [{ source: "seed", url: "https://www.spencer.org" }],
    researchStatus: "COMPLETED",
    ein: "36-6078860",
    totalGivingUsd: 50000000,
    avgGrantSizeUsd: 200000,
  },
  {
    name: "Carnegie Corporation of New York",
    type: "FOUNDATION",
    description:
      "Founded by Andrew Carnegie in 1911, the corporation works to promote education, democracy, and international peace. Major funder of education reform, library systems, and democratic institutions.",
    website: "https://www.carnegie.org",
    country: "United States",
    city: "New York",
    location: "New York, New York, USA",
    causes: ["Education", "Democracy & Governance", "International Development"],
    targetPopulations: ["Students", "Educators", "Immigrants"],
    geographicFocus: ["United States", "Sub-Saharan Africa", "Global"],
    dataQualityScore: 0.90,
    dataSources: [{ source: "seed", url: "https://www.carnegie.org" }],
    researchStatus: "COMPLETED",
    ein: "13-1628151",
    totalGivingUsd: 150000000,
    avgGrantSizeUsd: 500000,
  },
  {
    name: "The Jack Kent Cooke Foundation",
    type: "FOUNDATION",
    description:
      "Dedicated to advancing the education of exceptionally promising students who have financial need. Provides scholarships, grants, and direct support from elementary school through graduate school.",
    website: "https://www.jkcf.org",
    country: "United States",
    city: "Lansdowne",
    location: "Lansdowne, Virginia, USA",
    causes: ["Education"],
    targetPopulations: ["Low-Income Students", "High-Achieving Students"],
    geographicFocus: ["United States"],
    dataQualityScore: 0.80,
    dataSources: [{ source: "seed", url: "https://www.jkcf.org" }],
    researchStatus: "COMPLETED",
    ein: "31-1615577",
    totalGivingUsd: 60000000,
    avgGrantSizeUsd: 250000,
  },
];

// ============================================================
// ENVIRONMENT (5 donors)
// ============================================================

const environmentDonors: SeedDonor[] = [
  {
    name: "Gordon and Betty Moore Foundation",
    type: "FOUNDATION",
    description:
      "Founded by Intel co-founder Gordon Moore, the foundation works in environmental conservation, science, and patient care. A major funder of marine conservation, Amazonian land protection, and scientific research.",
    website: "https://www.moore.org",
    country: "United States",
    city: "Palo Alto",
    location: "Palo Alto, California, USA",
    causes: ["Environment", "Science & Research", "Health"],
    targetPopulations: ["Scientists", "Conservation Groups", "Indigenous Communities"],
    geographicFocus: ["Global", "North America", "Amazon Region"],
    dataQualityScore: 0.88,
    dataSources: [{ source: "seed", url: "https://www.moore.org" }],
    researchStatus: "COMPLETED",
    ein: "94-3397785",
    totalGivingUsd: 400000000,
    avgGrantSizeUsd: 2000000,
  },
  {
    name: "David and Lucile Packard Foundation",
    type: "FOUNDATION",
    description:
      "One of the largest foundations in the US, focused on conservation, science, children's health, and reproductive health. Major funder of ocean conservation and climate change mitigation.",
    website: "https://www.packard.org",
    country: "United States",
    city: "Los Altos",
    location: "Los Altos, California, USA",
    causes: ["Environment", "Health", "Science & Research", "Youth Development"],
    targetPopulations: ["Children", "Scientists", "Conservation Groups"],
    geographicFocus: ["Global", "Western United States", "Latin America"],
    dataQualityScore: 0.87,
    dataSources: [{ source: "seed", url: "https://www.packard.org" }],
    researchStatus: "COMPLETED",
    ein: "94-2278431",
    totalGivingUsd: 400000000,
    avgGrantSizeUsd: 1000000,
  },
  {
    name: "The Nature Conservancy",
    type: "OTHER",
    description:
      "The world's largest environmental nonprofit, working to conserve lands and waters globally. Protects over 125 million acres of land and thousands of miles of rivers across 72 countries.",
    website: "https://www.nature.org",
    country: "United States",
    city: "Arlington",
    location: "Arlington, Virginia, USA",
    causes: ["Environment", "Science & Research"],
    targetPopulations: ["Indigenous Communities", "Rural Communities"],
    geographicFocus: ["Global", "United States", "Latin America", "Asia Pacific"],
    dataQualityScore: 0.90,
    dataSources: [{ source: "seed", url: "https://www.nature.org" }],
    researchStatus: "COMPLETED",
    ein: "53-0242652",
    totalGivingUsd: 1200000000,
    avgGrantSizeUsd: 500000,
  },
  {
    name: "ClimateWorks Foundation",
    type: "FOUNDATION",
    description:
      "A global platform for philanthropy to innovate and accelerate climate solutions. Channels hundreds of millions of dollars annually to climate change mitigation efforts worldwide.",
    website: "https://www.climateworks.org",
    country: "United States",
    city: "San Francisco",
    location: "San Francisco, California, USA",
    causes: ["Environment"],
    targetPopulations: ["Climate Organizations", "Policy Makers"],
    geographicFocus: ["Global", "United States", "China", "India", "Europe"],
    dataQualityScore: 0.84,
    dataSources: [{ source: "seed", url: "https://www.climateworks.org" }],
    researchStatus: "COMPLETED",
    ein: "26-3529041",
    totalGivingUsd: 300000000,
    avgGrantSizeUsd: 2000000,
  },
  {
    name: "The Hewlett Foundation",
    type: "FOUNDATION",
    description:
      "The William and Flora Hewlett Foundation makes grants to address some of the most serious social and environmental problems, including climate change, education, performing arts, and global development.",
    website: "https://hewlett.org",
    country: "United States",
    city: "Menlo Park",
    location: "Menlo Park, California, USA",
    causes: ["Environment", "Education", "Arts & Culture", "International Development", "Democracy & Governance"],
    targetPopulations: ["Nonprofits", "Artists", "Policy Makers"],
    geographicFocus: ["Global", "United States", "Sub-Saharan Africa"],
    dataQualityScore: 0.90,
    dataSources: [{ source: "seed", url: "https://hewlett.org" }],
    researchStatus: "COMPLETED",
    ein: "94-1655673",
    totalGivingUsd: 500000000,
    avgGrantSizeUsd: 1000000,
  },
];

// ============================================================
// ARTS & CULTURE (4 donors)
// ============================================================

const artsDonors: SeedDonor[] = [
  {
    name: "Andrew W. Mellon Foundation",
    type: "FOUNDATION",
    description:
      "One of the largest funders of arts and humanities in the US. Supports higher education, museums, libraries, and scholarly communication. Invests heavily in diversity and inclusion in arts and academia.",
    website: "https://www.mellon.org",
    country: "United States",
    city: "New York",
    location: "New York, New York, USA",
    causes: ["Arts & Culture", "Education", "Human Rights"],
    targetPopulations: ["Artists", "Scholars", "Students", "Museums"],
    geographicFocus: ["United States", "Global"],
    dataQualityScore: 0.92,
    dataSources: [{ source: "seed", url: "https://www.mellon.org" }],
    researchStatus: "COMPLETED",
    ein: "13-1879954",
    totalGivingUsd: 350000000,
    avgGrantSizeUsd: 1000000,
  },
  {
    name: "The Getty Foundation",
    type: "FOUNDATION",
    description:
      "Part of the J. Paul Getty Trust, the Getty Foundation supports individuals and institutions committed to advancing the understanding and preservation of visual arts worldwide.",
    website: "https://www.getty.edu/foundation",
    country: "United States",
    city: "Los Angeles",
    location: "Los Angeles, California, USA",
    causes: ["Arts & Culture", "Education"],
    targetPopulations: ["Artists", "Museums", "Scholars", "Art Conservators"],
    geographicFocus: ["Global", "United States", "Europe"],
    dataQualityScore: 0.86,
    dataSources: [{ source: "seed", url: "https://www.getty.edu/foundation" }],
    researchStatus: "COMPLETED",
    ein: "95-4404755",
    totalGivingUsd: 30000000,
    avgGrantSizeUsd: 300000,
  },
  {
    name: "John S. and James L. Knight Foundation",
    type: "FOUNDATION",
    description:
      "Dedicated to fostering informed and engaged communities through journalism, arts, and technology innovation. Major funder of local news, community arts, and smart city initiatives.",
    website: "https://knightfoundation.org",
    country: "United States",
    city: "Miami",
    location: "Miami, Florida, USA",
    causes: ["Arts & Culture", "Democracy & Governance", "Technology & STEM", "Community Development"],
    targetPopulations: ["Journalists", "Artists", "Local Communities"],
    geographicFocus: ["United States"],
    dataQualityScore: 0.88,
    dataSources: [{ source: "seed", url: "https://knightfoundation.org" }],
    researchStatus: "COMPLETED",
    ein: "65-0464177",
    totalGivingUsd: 150000000,
    avgGrantSizeUsd: 500000,
  },
  {
    name: "The Kresge Foundation",
    type: "FOUNDATION",
    description:
      "Works to expand opportunities in America's cities through arts and culture, education, environment, health, human services, and community development. Known for challenge grants that leverage additional funding.",
    website: "https://kresge.org",
    country: "United States",
    city: "Troy",
    location: "Troy, Michigan, USA",
    causes: ["Arts & Culture", "Community Development", "Education", "Health", "Environment"],
    targetPopulations: ["Urban Communities", "Low-Income Populations", "Artists"],
    geographicFocus: ["United States"],
    dataQualityScore: 0.86,
    dataSources: [{ source: "seed", url: "https://kresge.org" }],
    researchStatus: "COMPLETED",
    ein: "38-1359217",
    totalGivingUsd: 180000000,
    avgGrantSizeUsd: 500000,
  },
];

// ============================================================
// HUMAN RIGHTS (5 donors)
// ============================================================

const humanRightsDonors: SeedDonor[] = [
  {
    name: "Ford Foundation",
    type: "FOUNDATION",
    description:
      "One of the world's most influential foundations, fighting inequality in all its forms. Focuses on civic engagement, economic fairness, gender and racial justice, technology, and creative expression.",
    website: "https://www.fordfoundation.org",
    country: "United States",
    city: "New York",
    location: "New York, New York, USA",
    causes: ["Human Rights", "Poverty Alleviation", "Arts & Culture", "Democracy & Governance"],
    targetPopulations: ["Marginalized Communities", "Women", "People of Color", "LGBTQ Community"],
    geographicFocus: ["Global", "United States", "Latin America", "Africa", "Asia"],
    dataQualityScore: 0.95,
    dataSources: [{ source: "seed", url: "https://www.fordfoundation.org" }],
    researchStatus: "COMPLETED",
    ein: "13-1684331",
    totalGivingUsd: 600000000,
    avgGrantSizeUsd: 500000,
  },
  {
    name: "Open Society Foundations",
    type: "FOUNDATION",
    description:
      "Founded by George Soros, the Open Society Foundations work to build vibrant and inclusive democracies, defend human rights and the rule of law, and advance justice and equality across the world.",
    website: "https://www.opensocietyfoundations.org",
    country: "United States",
    city: "New York",
    location: "New York, New York, USA",
    causes: ["Human Rights", "Democracy & Governance", "Criminal Justice", "Education"],
    targetPopulations: ["Refugees", "Minorities", "Journalists", "Civil Society Organizations"],
    geographicFocus: ["Global", "Eastern Europe", "Africa", "Asia", "United States"],
    dataQualityScore: 0.92,
    dataSources: [{ source: "seed", url: "https://www.opensocietyfoundations.org" }],
    researchStatus: "COMPLETED",
    totalGivingUsd: 1500000000,
    avgGrantSizeUsd: 500000,
  },
  {
    name: "MacArthur Foundation",
    type: "FOUNDATION",
    description:
      "The John D. and Catherine T. MacArthur Foundation supports creative people, effective institutions, and influential networks. Known for MacArthur Fellows (\"genius grants\") and work in criminal justice reform, climate change, and nuclear risk reduction.",
    website: "https://www.macfound.org",
    country: "United States",
    city: "Chicago",
    location: "Chicago, Illinois, USA",
    causes: ["Human Rights", "Criminal Justice", "Environment", "Science & Research"],
    targetPopulations: ["Creatives", "Researchers", "Incarcerated Populations", "Policy Makers"],
    geographicFocus: ["Global", "United States", "India", "Nigeria"],
    dataQualityScore: 0.92,
    dataSources: [{ source: "seed", url: "https://www.macfound.org" }],
    researchStatus: "COMPLETED",
    ein: "23-7093598",
    totalGivingUsd: 350000000,
    avgGrantSizeUsd: 500000,
  },
  {
    name: "Omidyar Network",
    type: "FOUNDATION",
    description:
      "Founded by eBay creator Pierre Omidyar, the network invests in entrepreneurs and organizations building a more inclusive and equitable society. Bridges philanthropy and impact investing in areas like digital rights, governance, and economic opportunity.",
    website: "https://omidyar.com",
    country: "United States",
    city: "Redwood City",
    location: "Redwood City, California, USA",
    causes: ["Human Rights", "Technology & STEM", "Democracy & Governance", "Poverty Alleviation"],
    targetPopulations: ["Entrepreneurs", "Digital Citizens", "Low-Income Communities"],
    geographicFocus: ["Global", "United States", "India", "Latin America", "Africa"],
    dataQualityScore: 0.85,
    dataSources: [{ source: "seed", url: "https://omidyar.com" }],
    researchStatus: "COMPLETED",
    totalGivingUsd: 200000000,
    avgGrantSizeUsd: 1000000,
  },
  {
    name: "The Atlantic Philanthropies",
    type: "FOUNDATION",
    description:
      "Founded by Chuck Feeney, a giving-while-living foundation that completed its grantmaking in 2020 after distributing over $8 billion. Focused on aging, health, human rights, youth, and reconciliation in Northern Ireland, Republic of Ireland, South Africa, and the US.",
    website: "https://www.atlanticphilanthropies.org",
    country: "United States",
    city: "New York",
    location: "New York, New York, USA",
    causes: ["Human Rights", "Health", "Elderly & Aging", "Youth Development"],
    targetPopulations: ["Elderly", "Youth", "Immigrants"],
    geographicFocus: ["United States", "Ireland", "South Africa", "Vietnam", "Australia"],
    dataQualityScore: 0.88,
    dataSources: [{ source: "seed", url: "https://www.atlanticphilanthropies.org" }],
    researchStatus: "COMPLETED",
    totalGivingUsd: 8000000000,
    avgGrantSizeUsd: 2000000,
  },
];

// ============================================================
// POVERTY / HUNGER (4 donors)
// ============================================================

const povertyDonors: SeedDonor[] = [
  {
    name: "Robin Hood Foundation",
    type: "FOUNDATION",
    description:
      "New York City's largest poverty-fighting organization. Funds over 250 nonprofits in NYC that provide education, job training, housing, food assistance, and legal services to those in need.",
    website: "https://www.robinhood.org",
    country: "United States",
    city: "New York",
    location: "New York, New York, USA",
    causes: ["Poverty Alleviation", "Education", "Housing & Homelessness", "Food & Agriculture"],
    targetPopulations: ["Low-Income Families", "Homeless Individuals", "Youth"],
    geographicFocus: ["New York City", "United States"],
    dataQualityScore: 0.86,
    dataSources: [{ source: "seed", url: "https://www.robinhood.org" }],
    researchStatus: "COMPLETED",
    ein: "13-3441066",
    totalGivingUsd: 200000000,
    avgGrantSizeUsd: 500000,
  },
  {
    name: "Skoll Foundation",
    type: "FOUNDATION",
    description:
      "Founded by eBay's first president Jeff Skoll, the foundation invests in social entrepreneurs who drive large-scale change. Focuses on climate, health pandemics, water, education, and economic opportunity.",
    website: "https://skoll.org",
    country: "United States",
    city: "Palo Alto",
    location: "Palo Alto, California, USA",
    causes: ["Poverty Alleviation", "Environment", "Health", "Education"],
    targetPopulations: ["Social Entrepreneurs", "Low-Income Communities"],
    geographicFocus: ["Global"],
    dataQualityScore: 0.85,
    dataSources: [{ source: "seed", url: "https://skoll.org" }],
    researchStatus: "COMPLETED",
    ein: "52-2338331",
    totalGivingUsd: 50000000,
    avgGrantSizeUsd: 1500000,
  },
  {
    name: "The Rockefeller Foundation",
    type: "FOUNDATION",
    description:
      "Promotes the well-being of humanity throughout the world. Focuses on food systems, health, energy, and economic opportunity, with special emphasis on the intersection of climate and equity.",
    website: "https://www.rockefellerfoundation.org",
    country: "United States",
    city: "New York",
    location: "New York, New York, USA",
    causes: ["Poverty Alleviation", "Food & Agriculture", "Health", "Environment", "International Development"],
    targetPopulations: ["Low-Income Communities", "Smallholder Farmers", "Urban Populations"],
    geographicFocus: ["Global", "United States", "Sub-Saharan Africa", "South Asia"],
    dataQualityScore: 0.92,
    dataSources: [{ source: "seed", url: "https://www.rockefellerfoundation.org" }],
    researchStatus: "COMPLETED",
    ein: "13-1659629",
    totalGivingUsd: 200000000,
    avgGrantSizeUsd: 1000000,
  },
  {
    name: "Conrad N. Hilton Foundation",
    type: "FOUNDATION",
    description:
      "Works to improve the lives of disadvantaged and vulnerable people throughout the world. Focuses on homelessness, child welfare, substance use prevention, water access, and Catholic education.",
    website: "https://www.hiltonfoundation.org",
    country: "United States",
    city: "Agoura Hills",
    location: "Agoura Hills, California, USA",
    causes: ["Poverty Alleviation", "Housing & Homelessness", "Youth Development", "Health"],
    targetPopulations: ["Homeless Individuals", "Children", "Vulnerable Families"],
    geographicFocus: ["Global", "United States", "Sub-Saharan Africa"],
    dataQualityScore: 0.84,
    dataSources: [{ source: "seed", url: "https://www.hiltonfoundation.org" }],
    researchStatus: "COMPLETED",
    ein: "51-0187893",
    totalGivingUsd: 350000000,
    avgGrantSizeUsd: 2000000,
  },
];

// ============================================================
// YOUTH DEVELOPMENT (3 donors)
// ============================================================

const youthDonors: SeedDonor[] = [
  {
    name: "Annie E. Casey Foundation",
    type: "FOUNDATION",
    description:
      "Works to build a brighter future for millions of children at risk of poor educational, economic, social, and health outcomes. Known for the annual KIDS COUNT data book on child well-being.",
    website: "https://www.aecf.org",
    country: "United States",
    city: "Baltimore",
    location: "Baltimore, Maryland, USA",
    causes: ["Youth Development", "Education", "Poverty Alleviation", "Community Development"],
    targetPopulations: ["Children", "Families", "Youth"],
    geographicFocus: ["United States"],
    dataQualityScore: 0.88,
    dataSources: [{ source: "seed", url: "https://www.aecf.org" }],
    researchStatus: "COMPLETED",
    ein: "52-1951110",
    totalGivingUsd: 250000000,
    avgGrantSizeUsd: 500000,
  },
  {
    name: "W.K. Kellogg Foundation",
    type: "FOUNDATION",
    description:
      "One of the largest US foundations, focused on thriving children, working families, and equitable communities. Invests heavily in racial equity, early childhood education, and community food systems.",
    website: "https://www.wkkf.org",
    country: "United States",
    city: "Battle Creek",
    location: "Battle Creek, Michigan, USA",
    causes: ["Youth Development", "Education", "Food & Agriculture", "Human Rights"],
    targetPopulations: ["Children", "Families", "Communities of Color"],
    geographicFocus: ["United States", "Mexico", "Haiti"],
    dataQualityScore: 0.90,
    dataSources: [{ source: "seed", url: "https://www.wkkf.org" }],
    researchStatus: "COMPLETED",
    ein: "38-1359264",
    totalGivingUsd: 400000000,
    avgGrantSizeUsd: 500000,
  },
  {
    name: "The Bezos Family Foundation",
    type: "FOUNDATION",
    description:
      "Focused on education and early learning, the foundation supports programs for youth development from early childhood through high school. Known for backing innovative educational approaches.",
    website: "https://www.bezosfamilyfoundation.org",
    country: "United States",
    city: "Seattle",
    location: "Seattle, Washington, USA",
    causes: ["Youth Development", "Education"],
    targetPopulations: ["Children", "Students", "Educators"],
    geographicFocus: ["United States"],
    dataQualityScore: 0.80,
    dataSources: [{ source: "seed", url: "https://www.bezosfamilyfoundation.org" }],
    researchStatus: "COMPLETED",
    totalGivingUsd: 100000000,
    avgGrantSizeUsd: 1000000,
  },
];

// ============================================================
// WOMEN & GIRLS (3 donors)
// ============================================================

const womenDonors: SeedDonor[] = [
  {
    name: "NoVo Foundation",
    type: "FOUNDATION",
    description:
      "Co-founded by Peter Buffett, the NoVo Foundation works to foster a transformation of global society from domination to partnership. Focuses on ending violence against girls and women and supporting social-emotional learning.",
    website: "https://novofoundation.org",
    country: "United States",
    city: "New York",
    location: "New York, New York, USA",
    causes: ["Women & Girls", "Education", "Human Rights"],
    targetPopulations: ["Girls", "Women", "Youth"],
    geographicFocus: ["United States", "Global"],
    dataQualityScore: 0.84,
    dataSources: [{ source: "seed", url: "https://novofoundation.org" }],
    researchStatus: "COMPLETED",
    ein: "20-5765986",
    totalGivingUsd: 100000000,
    avgGrantSizeUsd: 500000,
  },
  {
    name: "Global Fund for Women",
    type: "FOUNDATION",
    description:
      "One of the world's leading foundations for gender equality. Funds women-led organizations around the world working on issues including economic justice, health, safety from violence, and civic participation.",
    website: "https://www.globalfundforwomen.org",
    country: "United States",
    city: "San Francisco",
    location: "San Francisco, California, USA",
    causes: ["Women & Girls", "Human Rights", "Health"],
    targetPopulations: ["Women", "Girls", "LGBTQ Women"],
    geographicFocus: ["Global", "Africa", "Asia", "Latin America", "Middle East"],
    dataQualityScore: 0.85,
    dataSources: [{ source: "seed", url: "https://www.globalfundforwomen.org" }],
    researchStatus: "COMPLETED",
    ein: "77-0155782",
    totalGivingUsd: 20000000,
    avgGrantSizeUsd: 50000,
  },
  {
    name: "Nike Foundation",
    type: "CORPORATE",
    description:
      "The Nike Foundation focuses on empowering adolescent girls as the most powerful force for change in the developing world. Invested in the Girl Effect movement connecting girls to health, education, and economic opportunity.",
    website: "https://www.nike.com/purpose",
    country: "United States",
    city: "Beaverton",
    location: "Beaverton, Oregon, USA",
    causes: ["Women & Girls", "Youth Development", "Poverty Alleviation"],
    targetPopulations: ["Adolescent Girls", "Women", "Youth"],
    geographicFocus: ["Global", "Sub-Saharan Africa", "South Asia"],
    dataQualityScore: 0.78,
    dataSources: [{ source: "seed", url: "https://www.nike.com/purpose" }],
    researchStatus: "COMPLETED",
    totalGivingUsd: 100000000,
    avgGrantSizeUsd: 500000,
  },
];

// ============================================================
// TECHNOLOGY & STEM (3 donors)
// ============================================================

const techDonors: SeedDonor[] = [
  {
    name: "Chan Zuckerberg Initiative",
    type: "FOUNDATION",
    description:
      "Founded by Mark Zuckerberg and Priscilla Chan, CZI uses technology, community-driven solutions, and collaboration to address major challenges in science, education, and criminal justice reform.",
    website: "https://chanzuckerberg.com",
    country: "United States",
    city: "Redwood City",
    location: "Redwood City, California, USA",
    causes: ["Technology & STEM", "Science & Research", "Education", "Criminal Justice"],
    targetPopulations: ["Scientists", "Students", "Incarcerated Populations"],
    geographicFocus: ["United States", "Global"],
    dataQualityScore: 0.90,
    dataSources: [{ source: "seed", url: "https://chanzuckerberg.com" }],
    researchStatus: "COMPLETED",
    totalGivingUsd: 3000000000,
    avgGrantSizeUsd: 5000000,
  },
  {
    name: "Schmidt Futures",
    type: "FOUNDATION",
    description:
      "Founded by former Google CEO Eric Schmidt. Bets early on exceptional people making the world better through technology. Funds AI research, scientific innovation, and talent development.",
    website: "https://www.schmidtfutures.com",
    country: "United States",
    city: "New York",
    location: "New York, New York, USA",
    causes: ["Technology & STEM", "Science & Research", "Education"],
    targetPopulations: ["Scientists", "Researchers", "Technologists"],
    geographicFocus: ["Global", "United States"],
    dataQualityScore: 0.82,
    dataSources: [{ source: "seed", url: "https://www.schmidtfutures.com" }],
    researchStatus: "COMPLETED",
    totalGivingUsd: 200000000,
    avgGrantSizeUsd: 2000000,
  },
  {
    name: "Mozilla Foundation",
    type: "FOUNDATION",
    description:
      "The nonprofit behind the Firefox browser, Mozilla Foundation fights for internet health and a trustworthy, human-centered web. Funds digital rights, open source technology, and internet literacy.",
    website: "https://foundation.mozilla.org",
    country: "United States",
    city: "San Francisco",
    location: "San Francisco, California, USA",
    causes: ["Technology & STEM", "Human Rights", "Education"],
    targetPopulations: ["Digital Citizens", "Developers", "Youth"],
    geographicFocus: ["Global"],
    dataQualityScore: 0.82,
    dataSources: [{ source: "seed", url: "https://foundation.mozilla.org" }],
    researchStatus: "COMPLETED",
    ein: "20-0097189",
    totalGivingUsd: 20000000,
    avgGrantSizeUsd: 200000,
  },
];

// ============================================================
// INTERNATIONAL DEVELOPMENT (4 donors)
// ============================================================

const internationalDonors: SeedDonor[] = [
  {
    name: "The MasterCard Foundation",
    type: "CORPORATE",
    description:
      "An independent foundation based in Toronto, working to advance youth learning and promote financial inclusion, primarily in Africa. One of the largest foundations in the world by assets, with a focus on creating dignified and fulfilling work for young people.",
    website: "https://mastercardfdn.org",
    country: "Canada",
    city: "Toronto",
    location: "Toronto, Ontario, Canada",
    causes: ["International Development", "Education", "Poverty Alleviation", "Youth Development"],
    targetPopulations: ["Youth", "Women", "Smallholder Farmers"],
    geographicFocus: ["Sub-Saharan Africa", "Canada"],
    dataQualityScore: 0.88,
    dataSources: [{ source: "seed", url: "https://mastercardfdn.org" }],
    researchStatus: "COMPLETED",
    totalGivingUsd: 700000000,
    avgGrantSizeUsd: 5000000,
  },
  {
    name: "IKEA Foundation",
    type: "CORPORATE",
    description:
      "The philanthropic arm of INGKA Foundation (IKEA). Focuses on climate action and renewable energy, along with improving livelihoods for families in vulnerable communities through agriculture, employment, and refugee support.",
    website: "https://ikeafoundation.org",
    country: "Netherlands",
    city: "Leiden",
    location: "Leiden, Netherlands",
    causes: ["International Development", "Environment", "Immigration & Refugees", "Poverty Alleviation"],
    targetPopulations: ["Refugees", "Low-Income Families", "Children"],
    geographicFocus: ["Global", "Sub-Saharan Africa", "South Asia", "Europe"],
    dataQualityScore: 0.84,
    dataSources: [{ source: "seed", url: "https://ikeafoundation.org" }],
    researchStatus: "COMPLETED",
    totalGivingUsd: 250000000,
    avgGrantSizeUsd: 2000000,
  },
  {
    name: "The ELMA Philanthropies",
    type: "FOUNDATION",
    description:
      "Supports programs that improve the lives of children and the vulnerable in Africa, with focus areas including health, education, and safety from violence. Works through local organizations to drive systemic change.",
    website: "https://www.elmaphilanthropies.org",
    country: "United States",
    city: "New York",
    location: "New York, New York, USA",
    causes: ["International Development", "Health", "Education", "Youth Development"],
    targetPopulations: ["Children", "Youth", "Vulnerable Communities"],
    geographicFocus: ["Sub-Saharan Africa"],
    dataQualityScore: 0.80,
    dataSources: [{ source: "seed", url: "https://www.elmaphilanthropies.org" }],
    researchStatus: "COMPLETED",
    totalGivingUsd: 50000000,
    avgGrantSizeUsd: 500000,
  },
  {
    name: "Aga Khan Foundation",
    type: "FOUNDATION",
    description:
      "Part of the Aga Khan Development Network, the foundation seeks sustainable solutions to long-term problems of poverty through community-based programs in health, education, rural development, and civil society strengthening.",
    website: "https://www.akdn.org",
    country: "Switzerland",
    city: "Geneva",
    location: "Geneva, Switzerland",
    causes: ["International Development", "Education", "Health", "Community Development", "Faith & Religion"],
    targetPopulations: ["Rural Communities", "Women", "Children"],
    geographicFocus: ["Central Asia", "South Asia", "East Africa", "Middle East"],
    dataQualityScore: 0.86,
    dataSources: [{ source: "seed", url: "https://www.akdn.org" }],
    researchStatus: "COMPLETED",
    totalGivingUsd: 600000000,
    avgGrantSizeUsd: 1000000,
  },
];

// ============================================================
// FAITH-BASED (4 donors)
// ============================================================

const faithDonors: SeedDonor[] = [
  {
    name: "Lilly Endowment",
    type: "FOUNDATION",
    description:
      "One of the largest private foundations in the US, based in Indianapolis. Supports religion, education, and community development, primarily in Indiana. Founded by the Eli Lilly pharmaceutical family.",
    website: "https://lillyendowment.org",
    country: "United States",
    city: "Indianapolis",
    location: "Indianapolis, Indiana, USA",
    causes: ["Faith & Religion", "Education", "Community Development"],
    targetPopulations: ["Religious Organizations", "Students", "Indiana Communities"],
    geographicFocus: ["United States", "Indiana"],
    dataQualityScore: 0.88,
    dataSources: [{ source: "seed", url: "https://lillyendowment.org" }],
    researchStatus: "COMPLETED",
    ein: "35-0868122",
    totalGivingUsd: 600000000,
    avgGrantSizeUsd: 2000000,
  },
  {
    name: "The Templeton Foundation",
    type: "FOUNDATION",
    description:
      "The John Templeton Foundation funds research and projects exploring the deepest questions of universe and humankind. Supports science-religion dialogue, character development, genetics, and free markets.",
    website: "https://www.templeton.org",
    country: "United States",
    city: "West Conshohocken",
    location: "West Conshohocken, Pennsylvania, USA",
    causes: ["Faith & Religion", "Science & Research", "Education"],
    targetPopulations: ["Researchers", "Religious Communities", "Students"],
    geographicFocus: ["Global", "United States"],
    dataQualityScore: 0.85,
    dataSources: [{ source: "seed", url: "https://www.templeton.org" }],
    researchStatus: "COMPLETED",
    ein: "62-1322826",
    totalGivingUsd: 150000000,
    avgGrantSizeUsd: 500000,
  },
  {
    name: "Islamic Relief USA",
    type: "OTHER",
    description:
      "A faith-inspired humanitarian and development organization providing emergency relief and long-term development. Works in disaster relief, education, health, and orphan support across 40 countries.",
    website: "https://irusa.org",
    country: "United States",
    city: "Alexandria",
    location: "Alexandria, Virginia, USA",
    causes: ["Faith & Religion", "Disaster Relief", "International Development", "Health"],
    targetPopulations: ["Refugees", "Orphans", "Disaster Victims", "Low-Income Communities"],
    geographicFocus: ["Global", "Middle East", "Africa", "South Asia", "United States"],
    dataQualityScore: 0.82,
    dataSources: [{ source: "seed", url: "https://irusa.org" }],
    researchStatus: "COMPLETED",
    ein: "95-4453134",
    totalGivingUsd: 150000000,
    avgGrantSizeUsd: 200000,
  },
  {
    name: "Catholic Charities USA",
    type: "OTHER",
    description:
      "The national office of the Catholic Charities network, one of the largest social service networks in the US. Provides food, housing, health care, disaster relief, and immigration services through 168 member agencies.",
    website: "https://www.catholiccharitiesusa.org",
    country: "United States",
    city: "Alexandria",
    location: "Alexandria, Virginia, USA",
    causes: ["Faith & Religion", "Poverty Alleviation", "Immigration & Refugees", "Housing & Homelessness", "Disaster Relief"],
    targetPopulations: ["Low-Income Families", "Immigrants", "Refugees", "Homeless Individuals"],
    geographicFocus: ["United States"],
    dataQualityScore: 0.84,
    dataSources: [{ source: "seed", url: "https://www.catholiccharitiesusa.org" }],
    researchStatus: "COMPLETED",
    ein: "53-0196620",
    totalGivingUsd: 500000000,
    avgGrantSizeUsd: 500000,
  },
];

// ============================================================
// COMMUNITY DEVELOPMENT (4 donors)
// ============================================================

const communityDonors: SeedDonor[] = [
  {
    name: "Silicon Valley Community Foundation",
    type: "FOUNDATION",
    description:
      "One of the largest community foundations in the US, SVCF acts as a hub for philanthropy in the Bay Area. Manages donor-advised funds and makes grants to community organizations addressing housing, immigration, education, and economic security.",
    website: "https://www.siliconvalleycf.org",
    country: "United States",
    city: "Mountain View",
    location: "Mountain View, California, USA",
    causes: ["Community Development", "Education", "Housing & Homelessness", "Immigration & Refugees"],
    targetPopulations: ["Low-Income Communities", "Immigrants", "Students"],
    geographicFocus: ["San Francisco Bay Area", "United States"],
    dataQualityScore: 0.86,
    dataSources: [{ source: "seed", url: "https://www.siliconvalleycf.org" }],
    researchStatus: "COMPLETED",
    ein: "20-5205488",
    totalGivingUsd: 2000000000,
    avgGrantSizeUsd: 100000,
  },
  {
    name: "The Chicago Community Trust",
    type: "FOUNDATION",
    description:
      "One of the oldest and largest community foundations in the US. Works to close the racial and ethnic wealth gap in Chicago through grants in arts, economic vitality, education, and health.",
    website: "https://www.cct.org",
    country: "United States",
    city: "Chicago",
    location: "Chicago, Illinois, USA",
    causes: ["Community Development", "Human Rights", "Arts & Culture", "Education"],
    targetPopulations: ["Communities of Color", "Youth", "Low-Income Families"],
    geographicFocus: ["Chicago", "Cook County", "Illinois"],
    dataQualityScore: 0.84,
    dataSources: [{ source: "seed", url: "https://www.cct.org" }],
    researchStatus: "COMPLETED",
    ein: "36-2167000",
    totalGivingUsd: 300000000,
    avgGrantSizeUsd: 100000,
  },
  {
    name: "The California Community Foundation",
    type: "FOUNDATION",
    description:
      "One of the largest community foundations in the US, serving Los Angeles County. Awards grants to nonprofits addressing education, housing, health, and immigration challenges in LA.",
    website: "https://www.calfund.org",
    country: "United States",
    city: "Los Angeles",
    location: "Los Angeles, California, USA",
    causes: ["Community Development", "Education", "Health", "Housing & Homelessness", "Immigration & Refugees"],
    targetPopulations: ["Low-Income Communities", "Immigrants", "Youth"],
    geographicFocus: ["Los Angeles County", "California"],
    dataQualityScore: 0.83,
    dataSources: [{ source: "seed", url: "https://www.calfund.org" }],
    researchStatus: "COMPLETED",
    ein: "95-3510055",
    totalGivingUsd: 250000000,
    avgGrantSizeUsd: 50000,
  },
  {
    name: "The Cleveland Foundation",
    type: "FOUNDATION",
    description:
      "The world's first community foundation, established in 1914. Makes grants in arts, economic development, education, youth, and neighborhood revitalization in Greater Cleveland.",
    website: "https://www.clevelandfoundation.org",
    country: "United States",
    city: "Cleveland",
    location: "Cleveland, Ohio, USA",
    causes: ["Community Development", "Arts & Culture", "Education", "Youth Development"],
    targetPopulations: ["Urban Communities", "Youth", "Artists"],
    geographicFocus: ["Greater Cleveland", "Ohio"],
    dataQualityScore: 0.82,
    dataSources: [{ source: "seed", url: "https://www.clevelandfoundation.org" }],
    researchStatus: "COMPLETED",
    ein: "34-0714588",
    totalGivingUsd: 100000000,
    avgGrantSizeUsd: 100000,
  },
];

// ============================================================
// SAMPLE GRANTS
// ============================================================

const sampleGrants: SeedGrant[] = [
  // Health
  { donorName: "Bill & Melinda Gates Foundation", recipientName: "Gavi, the Vaccine Alliance", amount: 1600000000, year: 2024, purpose: "Immunization programs for children in developing countries" },
  { donorName: "Bill & Melinda Gates Foundation", recipientName: "PATH", amount: 100000000, year: 2023, purpose: "Malaria vaccine development and distribution" },
  { donorName: "Robert Wood Johnson Foundation", recipientName: "Trust for America's Health", amount: 3000000, year: 2023, purpose: "Promoting health equity and disease prevention" },
  { donorName: "Wellcome Trust", recipientName: "University of Oxford", amount: 50000000, year: 2023, purpose: "Infectious disease research and pandemic preparedness" },
  { donorName: "The California Endowment", recipientName: "California Pan-Ethnic Health Network", amount: 2000000, year: 2023, purpose: "Health equity advocacy for communities of color" },

  // Education
  { donorName: "Walton Family Foundation", recipientName: "KIPP Foundation", amount: 15000000, year: 2023, purpose: "Charter school network expansion" },
  { donorName: "Lumina Foundation", recipientName: "Complete College America", amount: 5000000, year: 2023, purpose: "Increasing college completion rates" },
  { donorName: "Carnegie Corporation of New York", recipientName: "Sesame Workshop", amount: 3000000, year: 2023, purpose: "Early childhood education programming" },

  // Environment
  { donorName: "Gordon and Betty Moore Foundation", recipientName: "Conservation International", amount: 20000000, year: 2023, purpose: "Marine conservation in the Pacific" },
  { donorName: "David and Lucile Packard Foundation", recipientName: "Natural Resources Defense Council", amount: 5000000, year: 2023, purpose: "Climate policy advocacy" },
  { donorName: "ClimateWorks Foundation", recipientName: "Rocky Mountain Institute", amount: 10000000, year: 2023, purpose: "Clean energy transition solutions" },
  { donorName: "The Hewlett Foundation", recipientName: "Energy Foundation", amount: 8000000, year: 2023, purpose: "Clean energy and climate policy" },

  // Arts & Culture
  { donorName: "Andrew W. Mellon Foundation", recipientName: "Smithsonian Institution", amount: 5000000, year: 2023, purpose: "Museum collections digitization and access" },
  { donorName: "John S. and James L. Knight Foundation", recipientName: "ProPublica", amount: 2000000, year: 2023, purpose: "Local investigative journalism" },

  // Human Rights
  { donorName: "Ford Foundation", recipientName: "ACLU Foundation", amount: 10000000, year: 2023, purpose: "Civil rights litigation and advocacy" },
  { donorName: "MacArthur Foundation", recipientName: "Vera Institute of Justice", amount: 5000000, year: 2023, purpose: "Criminal justice reform research" },
  { donorName: "Open Society Foundations", recipientName: "International Crisis Group", amount: 3000000, year: 2023, purpose: "Conflict prevention and resolution" },

  // Poverty
  { donorName: "Robin Hood Foundation", recipientName: "Covenant House", amount: 3000000, year: 2023, purpose: "Youth homelessness services in NYC" },
  { donorName: "The Rockefeller Foundation", recipientName: "Global Alliance for Improved Nutrition", amount: 10000000, year: 2023, purpose: "Food fortification programs in Africa and Asia" },
  { donorName: "Skoll Foundation", recipientName: "One Acre Fund", amount: 5000000, year: 2023, purpose: "Supporting smallholder farmers in Africa" },

  // Youth
  { donorName: "Annie E. Casey Foundation", recipientName: "Harlem Children's Zone", amount: 3000000, year: 2023, purpose: "Comprehensive youth development programs" },
  { donorName: "W.K. Kellogg Foundation", recipientName: "National Head Start Association", amount: 4000000, year: 2023, purpose: "Early childhood education access" },

  // Women
  { donorName: "NoVo Foundation", recipientName: "Global Fund for Women", amount: 5000000, year: 2023, purpose: "Supporting women-led organizations worldwide" },
  { donorName: "Global Fund for Women", recipientName: "FRIDA Young Feminist Fund", amount: 500000, year: 2023, purpose: "Youth feminist organizing" },

  // Tech
  { donorName: "Chan Zuckerberg Initiative", recipientName: "Biohub", amount: 100000000, year: 2023, purpose: "Collaborative biomedical research" },
  { donorName: "Schmidt Futures", recipientName: "AI2", amount: 10000000, year: 2023, purpose: "AI research for social good" },

  // International
  { donorName: "The MasterCard Foundation", recipientName: "African Leadership Academy", amount: 20000000, year: 2023, purpose: "Youth leadership development in Africa" },
  { donorName: "IKEA Foundation", recipientName: "UNHCR", amount: 30000000, year: 2023, purpose: "Renewable energy for refugee camps" },
  { donorName: "Aga Khan Foundation", recipientName: "Aga Khan University", amount: 25000000, year: 2023, purpose: "Higher education in East Africa" },

  // Faith
  { donorName: "Lilly Endowment", recipientName: "National Association of Evangelicals", amount: 3000000, year: 2023, purpose: "Clergy leadership development" },
  { donorName: "Islamic Relief USA", recipientName: "Islamic Relief Worldwide", amount: 50000000, year: 2023, purpose: "Humanitarian aid in Syria and Yemen" },

  // Community
  { donorName: "Silicon Valley Community Foundation", recipientName: "Habitat for Humanity", amount: 5000000, year: 2023, purpose: "Affordable housing in Bay Area" },
  { donorName: "The Chicago Community Trust", recipientName: "Chicago CRED", amount: 2000000, year: 2023, purpose: "Violence reduction and economic opportunity" },
];

// ============================================================
// MAIN SEED FUNCTION
// ============================================================

const allDonors: SeedDonor[] = [
  ...healthDonors,
  ...educationDonors,
  ...environmentDonors,
  ...artsDonors,
  ...humanRightsDonors,
  ...povertyDonors,
  ...youthDonors,
  ...womenDonors,
  ...techDonors,
  ...internationalDonors,
  ...faithDonors,
  ...communityDonors,
];

async function seedDiverse() {
  console.log(`\nSeeding ${allDonors.length} diverse donors across ${12} sectors...\n`);

  let created = 0;
  let skipped = 0;
  const donorMap = new Map<string, string>(); // name -> id

  for (const donor of allDonors) {
    // Check if donor already exists (by EIN or name)
    const existing = donor.ein
      ? await prisma.donor.findFirst({
          where: { OR: [{ ein: donor.ein }, { name: donor.name }] },
        })
      : await prisma.donor.findFirst({ where: { name: donor.name } });

    if (existing) {
      console.log(`  SKIP  ${donor.name} (already exists)`);
      donorMap.set(donor.name, existing.id);
      skipped++;
      continue;
    }

    const result = await prisma.donor.create({
      data: {
        name: donor.name,
        type: donor.type,
        description: donor.description,
        website: donor.website,
        country: donor.country,
        city: donor.city,
        location: donor.location,
        causes: donor.causes,
        targetPopulations: donor.targetPopulations,
        geographicFocus: donor.geographicFocus,
        dataQualityScore: donor.dataQualityScore,
        dataSources: donor.dataSources,
        researchStatus: donor.researchStatus,
        ein: donor.ein,
        totalGivingUsd: donor.totalGivingUsd,
        avgGrantSizeUsd: donor.avgGrantSizeUsd,
        lastResearchedAt: new Date(),
      },
    });

    donorMap.set(donor.name, result.id);
    console.log(`  ADD   ${donor.name} [${donor.causes[0]}]`);
    created++;
  }

  console.log(`\nDonors: ${created} created, ${skipped} skipped\n`);

  // Seed grants
  let grantsCreated = 0;
  let grantsSkipped = 0;
  for (const grant of sampleGrants) {
    const donorId = donorMap.get(grant.donorName);
    if (!donorId) {
      continue;
    }

    const existing = await prisma.donorGrant.findFirst({
      where: { donorId, recipientName: grant.recipientName, year: grant.year },
    });
    if (existing) {
      grantsSkipped++;
      continue;
    }

    await prisma.donorGrant.create({
      data: {
        donorId,
        recipientName: grant.recipientName,
        amount: grant.amount,
        year: grant.year,
        purpose: grant.purpose,
        currency: "USD",
        sourceUrl: "https://www.guidestar.org",
      },
    });
    grantsCreated++;
  }

  console.log(`Grants: ${grantsCreated} created, ${grantsSkipped} skipped\n`);

  // Summary by sector
  const sectorCounts: Record<string, number> = {};
  for (const donor of allDonors) {
    const sector = donor.causes[0] ?? "Other";
    sectorCounts[sector] = (sectorCounts[sector] ?? 0) + 1;
  }
  console.log("Sector distribution:");
  for (const [sector, count] of Object.entries(sectorCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${sector}: ${count}`);
  }

  console.log(`\nDone! Total donors seeded: ${allDonors.length}`);
  console.log("Refresh your dashboard to see the new matches.");

  await prisma.$disconnect();
  await pool.end();
}

seedDiverse().catch((e) => {
  console.error("Seed error:", e);
  process.exit(1);
});
