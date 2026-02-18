import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeCauses } from "@/lib/utils/normalize-causes";
import { computeQualityScore } from "@/lib/validation/compute-quality-score";

const testDonors = [
  {
    name: "The Schusterman Family Foundation",
    type: "FOUNDATION" as const,
    description:
      "The Charles and Lynn Schusterman Family Philanthropies invests in initiatives that strengthen the Jewish community, advance education, and empower young people. Active in both the US and Israel with a focus on social justice and leadership development.",
    website: "https://www.schusterman.org",
    websiteVerified: true,
    websiteSource: "irs_990",
    country: "United States",
    city: "Tulsa",
    headquartersCountry: "United States",
    headquartersCity: "Tulsa",
    activeRegions: ["United States", "Israel", "Global"],
    totalGivingUsd: 250000000,
    avgGrantSizeUsd: 1500000,
    grantCount: 165,
    givingYearRange: "2003-2024",
    location: "Tulsa, Oklahoma, USA",
    causes: ["Education", "Jewish Community", "Social Justice", "Youth Development", "Israel"],
    targetPopulations: ["Youth", "Jewish Communities", "Underserved Communities"],
    geographicFocus: ["United States", "Israel"],
    dataQualityScore: 0.92,
    dataSources: [{ source: "seed", url: "https://www.schusterman.org" }],
    researchStatus: "COMPLETED" as const,
    ein: "73-1475159",
  },
  {
    name: "The Jim Joseph Foundation",
    type: "FOUNDATION" as const,
    description:
      "The Jim Joseph Foundation is dedicated to fostering compelling Jewish learning experiences for young Jews in the United States. The Foundation supports a range of programs from early childhood to young adult, investing in innovation and high-quality educational initiatives.",
    website: "https://jimjosephfoundation.org",
    websiteVerified: true,
    websiteSource: "irs_990",
    country: "United States",
    city: "San Francisco",
    headquartersCountry: "United States",
    headquartersCity: "San Francisco",
    activeRegions: ["United States", "Israel"],
    totalGivingUsd: 180000000,
    avgGrantSizeUsd: 2000000,
    grantCount: 90,
    givingYearRange: "2006-2024",
    location: "San Francisco, California, USA",
    causes: ["Jewish Education", "Youth Development", "Community Building"],
    targetPopulations: ["Youth", "Young Adults", "Jewish Communities"],
    geographicFocus: ["United States"],
    dataQualityScore: 0.88,
    dataSources: [{ source: "seed", url: "https://jimjosephfoundation.org" }],
    researchStatus: "COMPLETED" as const,
    ein: "20-5765972",
  },
  {
    name: "The Leichtag Foundation",
    type: "FOUNDATION" as const,
    description:
      "The Leichtag Foundation ignites and inspires vibrant Jewish life, advances self-sufficiency and social justice, and promotes tolerance and understanding in San Diego County and Jerusalem. Focuses on agriculture, innovation, and community development.",
    website: "https://leichtag.org",
    websiteVerified: true,
    websiteSource: "crawl_verified",
    country: "United States",
    city: "Encinitas",
    headquartersCountry: "United States",
    headquartersCity: "Encinitas",
    activeRegions: ["United States", "Israel", "San Diego County"],
    totalGivingUsd: 45000000,
    avgGrantSizeUsd: 350000,
    grantCount: 128,
    givingYearRange: "2007-2024",
    location: "Encinitas, California, USA",
    causes: ["Jewish Community", "Agriculture", "Social Justice", "Innovation", "Community Development"],
    targetPopulations: ["Jewish Communities", "Farmers", "Youth"],
    geographicFocus: ["United States", "Israel", "San Diego County"],
    dataQualityScore: 0.85,
    dataSources: [{ source: "seed", url: "https://leichtag.org" }],
    researchStatus: "COMPLETED" as const,
    ein: "26-0703760",
  },
  {
    name: "UJA-Federation of New York",
    type: "FOUNDATION" as const,
    description:
      "UJA-Federation of New York cares for Jews everywhere and New Yorkers of all backgrounds, responding to crises close to home and far away, and shaping the Jewish future. One of the largest local philanthropies in the world with annual campaigns exceeding $200M.",
    website: "https://www.ujafedny.org",
    websiteVerified: true,
    websiteSource: "irs_990",
    country: "United States",
    city: "New York",
    headquartersCountry: "United States",
    headquartersCity: "New York",
    activeRegions: ["United States", "Israel", "Former Soviet Union", "Global"],
    totalGivingUsd: 500000000,
    avgGrantSizeUsd: 800000,
    grantCount: 625,
    givingYearRange: "1990-2024",
    location: "New York, New York, USA",
    causes: ["Jewish Community", "Social Services", "Poverty Alleviation", "Education", "Israel"],
    targetPopulations: ["Jewish Communities", "Low-Income Families", "Elderly", "Youth"],
    geographicFocus: ["United States", "Israel", "New York"],
    dataQualityScore: 0.95,
    dataSources: [{ source: "seed", url: "https://www.ujafedny.org" }],
    researchStatus: "COMPLETED" as const,
    ein: "51-0172429",
  },
  {
    name: "The Rashi Foundation",
    type: "FOUNDATION" as const,
    description:
      "The Rashi Foundation is one of Israel's leading philanthropic organizations, working to close social gaps and promote equal opportunities in Israeli society. Invests over ₪200M annually in education, employment, and community empowerment in peripheral areas.",
    website: "https://www.rfrashi.org",
    websiteVerified: true,
    websiteSource: "crawl_verified",
    country: "Israel",
    city: "Tel Aviv",
    headquartersCountry: "Israel",
    headquartersCity: "Tel Aviv",
    activeRegions: ["Israel"],
    totalGivingUsd: 60000000,
    avgGrantSizeUsd: 500000,
    grantCount: 120,
    givingYearRange: "1994-2024",
    location: "Tel Aviv, Israel",
    causes: ["Education", "Employment", "Social Equality", "Community Development"],
    targetPopulations: ["Underserved Communities", "Youth", "Arab Citizens of Israel", "Ethiopian Israelis"],
    geographicFocus: ["Israel"],
    dataQualityScore: 0.87,
    dataSources: [{ source: "seed", url: "https://www.rfrashi.org" }],
    researchStatus: "COMPLETED" as const,
  },
  {
    name: "The Paul E. Singer Foundation",
    type: "FOUNDATION" as const,
    description:
      "The Paul E. Singer Foundation supports organizations that defend human rights, strengthen democratic values, and advance educational opportunities. Has significant focus on LGBTQ rights, Israel policy, and education reform with grants totaling over $100M.",
    website: "https://www.singerfdn.org",
    websiteVerified: true,
    websiteSource: "irs_990",
    country: "United States",
    city: "New York",
    headquartersCountry: "United States",
    headquartersCity: "New York",
    activeRegions: ["United States", "Israel", "Global"],
    totalGivingUsd: 120000000,
    avgGrantSizeUsd: 750000,
    grantCount: 160,
    givingYearRange: "2008-2024",
    location: "New York, New York, USA",
    causes: ["Human Rights", "Education", "Democracy", "LGBTQ Rights", "Israel"],
    targetPopulations: ["LGBTQ Community", "Students", "Youth"],
    geographicFocus: ["United States", "Israel", "Global"],
    dataQualityScore: 0.82,
    dataSources: [{ source: "seed", url: "https://www.singerfdn.org" }],
    researchStatus: "COMPLETED" as const,
    ein: "20-5350288",
  },
  {
    name: "The Russell Berrie Foundation",
    type: "FOUNDATION" as const,
    description:
      "The Russell Berrie Foundation promotes interreligious understanding, diabetes research, and community development. Has a strong focus on Jewish-Christian relations and supporting communities in New Jersey and Israel. Annual giving approximately $15M.",
    website: "https://www.russellberriefoundation.org",
    websiteVerified: true,
    websiteSource: "crawl_verified",
    country: "United States",
    city: "Teaneck",
    headquartersCountry: "United States",
    headquartersCity: "Teaneck",
    activeRegions: ["United States", "Israel", "New Jersey"],
    totalGivingUsd: 75000000,
    avgGrantSizeUsd: 400000,
    grantCount: 188,
    givingYearRange: "2002-2024",
    location: "Teaneck, New Jersey, USA",
    causes: ["Interfaith Dialogue", "Healthcare", "Community Development", "Education"],
    targetPopulations: ["Religious Communities", "Diabetes Patients", "Youth"],
    geographicFocus: ["United States", "Israel", "New Jersey"],
    dataQualityScore: 0.80,
    dataSources: [{ source: "seed", url: "https://www.russellberriefoundation.org" }],
    researchStatus: "COMPLETED" as const,
    ein: "22-2507520",
  },
  {
    name: "Matan - United Way of Israel",
    type: "FOUNDATION" as const,
    description:
      "Matan – United Way of Israel is the leading organization in Israel advancing strategic philanthropy and corporate social responsibility. Connects corporations and foundations with effective nonprofits to maximize social impact. Facilitates over ₪100M in annual giving.",
    website: "https://www.matan.org.il",
    websiteVerified: true,
    websiteSource: "crawl_verified",
    country: "Israel",
    city: "Tel Aviv",
    headquartersCountry: "Israel",
    headquartersCity: "Tel Aviv",
    activeRegions: ["Israel"],
    totalGivingUsd: 30000000,
    avgGrantSizeUsd: 200000,
    grantCount: 150,
    givingYearRange: "1998-2024",
    location: "Tel Aviv, Israel",
    causes: ["Philanthropy", "Corporate Social Responsibility", "Social Services", "Education"],
    targetPopulations: ["Nonprofits", "Corporations", "Underserved Communities"],
    geographicFocus: ["Israel"],
    dataQualityScore: 0.83,
    dataSources: [{ source: "seed", url: "https://www.matan.org.il" }],
    researchStatus: "COMPLETED" as const,
  },
  {
    name: "The Maimonides Fund",
    type: "FOUNDATION" as const,
    description:
      "The Maimonides Fund supports initiatives in Jewish education, Israel, and public policy. Named after the medieval Jewish philosopher, the fund invests in strengthening Jewish identity and engagement among young adults. Grants average $500K-$2M per recipient.",
    website: "https://www.maimonidesfund.org",
    websiteVerified: true,
    websiteSource: "irs_990",
    country: "United States",
    city: "New York",
    headquartersCountry: "United States",
    headquartersCity: "New York",
    activeRegions: ["United States", "Israel"],
    totalGivingUsd: 85000000,
    avgGrantSizeUsd: 1200000,
    grantCount: 71,
    givingYearRange: "2010-2024",
    location: "New York, New York, USA",
    causes: ["Jewish Education", "Israel", "Public Policy", "Jewish Identity"],
    targetPopulations: ["Young Adults", "Jewish Communities", "Students"],
    geographicFocus: ["United States", "Israel"],
    dataQualityScore: 0.86,
    dataSources: [{ source: "seed", url: "https://www.maimonidesfund.org" }],
    researchStatus: "COMPLETED" as const,
    ein: "27-3175463",
  },
  {
    name: "Keren Hayesod",
    type: "FOUNDATION" as const,
    description:
      "Keren Hayesod – United Israel Appeal is the fundraising organization for Israel. It raises funds in over 45 countries for immigrant absorption, social welfare, education, and rural development in Israel. Annual campaigns raise over $300M worldwide.",
    website: "https://www.kh-uia.org.il",
    websiteVerified: true,
    websiteSource: "crawl_verified",
    country: "Israel",
    city: "Jerusalem",
    headquartersCountry: "Israel",
    headquartersCity: "Jerusalem",
    activeRegions: ["Israel", "Global"],
    totalGivingUsd: 300000000,
    avgGrantSizeUsd: 2000000,
    grantCount: 150,
    givingYearRange: "1920-2024",
    location: "Jerusalem, Israel",
    causes: ["Immigration", "Social Welfare", "Education", "Rural Development", "Israel"],
    targetPopulations: ["Immigrants", "Underserved Communities", "Youth", "Elderly"],
    geographicFocus: ["Israel", "Global"],
    dataQualityScore: 0.93,
    dataSources: [{ source: "seed", url: "https://www.kh-uia.org.il" }],
    researchStatus: "COMPLETED" as const,
  },
];

const testGrants = [
  // Schusterman (6 grants)
  { donorName: "The Schusterman Family Foundation", recipientName: "Hillel International", amount: 5000000, year: 2023, purpose: "Supporting Jewish campus life and student engagement across 550 campuses" },
  { donorName: "The Schusterman Family Foundation", recipientName: "ROI Community", amount: 2000000, year: 2023, purpose: "Young Jewish innovators network and leadership programs" },
  { donorName: "The Schusterman Family Foundation", recipientName: "Teach For All - Israel", amount: 1500000, year: 2022, purpose: "Teacher training in underserved Israeli communities" },
  { donorName: "The Schusterman Family Foundation", recipientName: "Repair the World", amount: 1800000, year: 2023, purpose: "Jewish service learning and volunteerism programs" },
  { donorName: "The Schusterman Family Foundation", recipientName: "BBYO", amount: 3000000, year: 2022, purpose: "Teen leadership and Jewish identity programs in 60+ countries" },
  { donorName: "The Schusterman Family Foundation", recipientName: "OneTable", amount: 900000, year: 2023, purpose: "Shabbat dinner experiences for young Jewish adults in 200+ cities" },
  // Jim Joseph (5 grants)
  { donorName: "The Jim Joseph Foundation", recipientName: "PJ Library", amount: 3500000, year: 2023, purpose: "Jewish children's book distribution to 680K families" },
  { donorName: "The Jim Joseph Foundation", recipientName: "Birthright Israel Foundation", amount: 4000000, year: 2022, purpose: "Free educational trips to Israel for young adults" },
  { donorName: "The Jim Joseph Foundation", recipientName: "Foundation for Jewish Camp", amount: 2800000, year: 2023, purpose: "Scholarships and innovation grants for Jewish summer camps" },
  { donorName: "The Jim Joseph Foundation", recipientName: "Hillel International", amount: 2500000, year: 2023, purpose: "Jewish campus engagement and Hillel programming expansion" },
  { donorName: "The Jim Joseph Foundation", recipientName: "Moving Traditions", amount: 1200000, year: 2022, purpose: "Jewish teen engagement through gender-based programming" },
  // UJA-Federation (6 grants)
  { donorName: "UJA-Federation of New York", recipientName: "JASA", amount: 1500000, year: 2023, purpose: "Services for 40,000 aging Jewish community members" },
  { donorName: "UJA-Federation of New York", recipientName: "Met Council on Jewish Poverty", amount: 2500000, year: 2023, purpose: "Anti-poverty programs serving 325,000 New Yorkers" },
  { donorName: "UJA-Federation of New York", recipientName: "Birthright Israel", amount: 3000000, year: 2023, purpose: "Israel experience trips for NYC young adults" },
  { donorName: "UJA-Federation of New York", recipientName: "HIAS", amount: 1800000, year: 2023, purpose: "Refugee resettlement and immigration legal services" },
  { donorName: "UJA-Federation of New York", recipientName: "Sephardic Community Alliance", amount: 750000, year: 2022, purpose: "Cultural preservation and community programming" },
  { donorName: "UJA-Federation of New York", recipientName: "Israel Trauma Coalition", amount: 2000000, year: 2024, purpose: "Mental health support for October 7 survivors and evacuees" },
  // Leichtag (4 grants)
  { donorName: "The Leichtag Foundation", recipientName: "Leket Israel", amount: 500000, year: 2023, purpose: "Food rescue and agricultural programs in Israel" },
  { donorName: "The Leichtag Foundation", recipientName: "Coastal Roots Farm", amount: 750000, year: 2023, purpose: "Sustainable agriculture and community food programs in San Diego" },
  { donorName: "The Leichtag Foundation", recipientName: "Jewish National Fund", amount: 400000, year: 2022, purpose: "Environmental and agricultural projects in the Negev" },
  { donorName: "The Leichtag Foundation", recipientName: "Hazon", amount: 350000, year: 2023, purpose: "Jewish food sustainability and environmental education" },
  // Singer (4 grants)
  { donorName: "The Paul E. Singer Foundation", recipientName: "Israel Democracy Institute", amount: 1000000, year: 2022, purpose: "Strengthening democratic institutions in Israel" },
  { donorName: "The Paul E. Singer Foundation", recipientName: "AIPAC", amount: 2000000, year: 2023, purpose: "US-Israel policy advocacy" },
  { donorName: "The Paul E. Singer Foundation", recipientName: "Manhattan Institute", amount: 1500000, year: 2023, purpose: "Public policy research and education reform" },
  { donorName: "The Paul E. Singer Foundation", recipientName: "Paul Singer Foundation Scholarship Fund", amount: 800000, year: 2022, purpose: "STEM scholarships for underrepresented students" },
  // Keren Hayesod (5 grants)
  { donorName: "Keren Hayesod", recipientName: "Jewish Agency for Israel", amount: 10000000, year: 2023, purpose: "Immigrant absorption and social welfare programs for 25,000 new immigrants" },
  { donorName: "Keren Hayesod", recipientName: "Youth Futures", amount: 3000000, year: 2023, purpose: "Mentoring at-risk youth in Israeli periphery towns" },
  { donorName: "Keren Hayesod", recipientName: "Nefesh B'Nefesh", amount: 5000000, year: 2023, purpose: "North American and UK aliyah support and integration services" },
  { donorName: "Keren Hayesod", recipientName: "World ORT", amount: 2000000, year: 2022, purpose: "Vocational training and STEM education in Israeli periphery" },
  { donorName: "Keren Hayesod", recipientName: "Ethiopian National Project", amount: 1500000, year: 2023, purpose: "Education and integration programs for Ethiopian-Israeli youth" },
  // Maimonides (4 grants)
  { donorName: "The Maimonides Fund", recipientName: "MASA Israel Journey", amount: 750000, year: 2023, purpose: "Long-term Israel programs for young adults" },
  { donorName: "The Maimonides Fund", recipientName: "Tikvah Fund", amount: 1200000, year: 2023, purpose: "Jewish intellectual leadership and public policy programs" },
  { donorName: "The Maimonides Fund", recipientName: "Shalom Hartman Institute", amount: 900000, year: 2022, purpose: "Pluralistic Jewish thought and education leadership" },
  { donorName: "The Maimonides Fund", recipientName: "Birthright Israel", amount: 2000000, year: 2023, purpose: "Israel education trips with enhanced curriculum" },
  // Rashi (4 grants)
  { donorName: "The Rashi Foundation", recipientName: "ELEM - Youth in Distress", amount: 400000, year: 2023, purpose: "Support programs for at-risk Israeli youth" },
  { donorName: "The Rashi Foundation", recipientName: "Arava Institute", amount: 600000, year: 2022, purpose: "Environmental education and cross-border cooperation" },
  { donorName: "The Rashi Foundation", recipientName: "Appleseeds Academy", amount: 800000, year: 2023, purpose: "Digital literacy programs in underserved Israeli communities" },
  { donorName: "The Rashi Foundation", recipientName: "Tsofen", amount: 500000, year: 2023, purpose: "Integrating Arab citizens into Israel's high-tech sector" },
  // Russell Berrie (4 grants)
  { donorName: "The Russell Berrie Foundation", recipientName: "Angelica Berrie Center", amount: 500000, year: 2023, purpose: "Interreligious dialogue programs in New Jersey" },
  { donorName: "The Russell Berrie Foundation", recipientName: "Ramapo College", amount: 750000, year: 2022, purpose: "Interfaith studies program and scholarships" },
  { donorName: "The Russell Berrie Foundation", recipientName: "Naomi Berrie Diabetes Center", amount: 1200000, year: 2023, purpose: "Type 1 diabetes research at Columbia University" },
  { donorName: "The Russell Berrie Foundation", recipientName: "Council of Centers on Jewish-Christian Relations", amount: 300000, year: 2023, purpose: "Academic research in Jewish-Christian dialogue" },
  // Matan (3 grants)
  { donorName: "Matan - United Way of Israel", recipientName: "JDC Israel", amount: 500000, year: 2023, purpose: "Social services capacity building for Israeli nonprofits" },
  { donorName: "Matan - United Way of Israel", recipientName: "Midot", amount: 200000, year: 2023, purpose: "Nonprofit effectiveness standards and evaluation" },
  { donorName: "Matan - United Way of Israel", recipientName: "Ruach Tova", amount: 150000, year: 2022, purpose: "Volunteer management and corporate social responsibility programs" },
];

const testPublications = [
  // Schusterman
  { donorName: "The Schusterman Family Foundation", title: "2024 Annual Impact Report: Investing in Jewish Futures", type: "ARTICLE", url: "https://www.schusterman.org/impact-2024", summary: "Comprehensive review of $250M+ in grants across education, social justice, and Israel programs" },
  { donorName: "The Schusterman Family Foundation", title: "Schusterman Foundation Announces $50M Initiative for Jewish Youth Leadership", type: "PRESS_RELEASE", url: "https://www.schusterman.org/news/youth-leadership-initiative", summary: "New multi-year initiative to develop next generation of Jewish community leaders" },
  // Jim Joseph
  { donorName: "The Jim Joseph Foundation", title: "Reimagining Jewish Education: Lessons from a Decade of Innovation", type: "ARTICLE", url: "https://ejewishphilanthropy.com/jim-joseph-decade-review", summary: "How $180M in grants transformed Jewish education from camps to campuses" },
  { donorName: "The Jim Joseph Foundation", title: "Foundation Awards $15M for Jewish Summer Camp Expansion", type: "PRESS_RELEASE", url: "https://jimjosephfoundation.org/news/camp-expansion-2024", summary: "Largest single investment in Jewish camping to reach 50,000 additional campers" },
  // UJA-Federation
  { donorName: "UJA-Federation of New York", title: "UJA-Federation Raises Record $523M in Annual Campaign", type: "PRESS_RELEASE", url: "https://www.ujafedny.org/news/record-campaign-2024", summary: "Record-breaking campaign supports 100+ agencies serving 4.5M people" },
  { donorName: "UJA-Federation of New York", title: "Israel Emergency Fund Surpasses $100M After October 7", type: "ARTICLE", url: "https://www.ujafedny.org/news/israel-emergency-fund", summary: "Rapid response fund for trauma support, evacuee housing, and community resilience" },
  // Keren Hayesod
  { donorName: "Keren Hayesod", title: "Annual Report 2024: Building Israel's Future Together", type: "ARTICLE", url: "https://www.kh-uia.org.il/annual-report-2024", summary: "Worldwide campaign results: $300M+ raised across 45 countries for Israel programs" },
  { donorName: "Keren Hayesod", title: "Record Aliyah Numbers: 75,000 New Immigrants in 2024", type: "PRESS_RELEASE", url: "https://www.kh-uia.org.il/news/aliyah-2024", summary: "Keren Hayesod-supported programs helped absorb unprecedented wave of new immigrants" },
  // Rashi
  { donorName: "The Rashi Foundation", title: "Closing the Digital Divide: Rashi's Technology Initiative Reaches 100 Communities", type: "ARTICLE", url: "https://www.rfrashi.org/digital-initiative-2024", summary: "Digital literacy programs now active in 100 peripheral Israeli communities" },
  // Singer
  { donorName: "The Paul E. Singer Foundation", title: "Singer Foundation Expands Education Reform Portfolio to $30M", type: "PRESS_RELEASE", url: "https://www.singerfdn.org/news/education-expansion", summary: "New grants target STEM education access and school choice programs" },
  // Leichtag
  { donorName: "The Leichtag Foundation", title: "From Field to Table: How Leichtag is Reinventing Jewish Agriculture", type: "ARTICLE", url: "https://leichtag.org/blog/jewish-agriculture-2024", summary: "Farm-based education programs connect 15,000 participants to Jewish food traditions" },
  // Maimonides
  { donorName: "The Maimonides Fund", title: "Maimonides Fund Launches $10M Jewish Identity Initiative for Gen Z", type: "PRESS_RELEASE", url: "https://www.maimonidesfund.org/news/gen-z-initiative", summary: "New program targets 18-25 year olds through digital media and Israel experiences" },
  // Russell Berrie
  { donorName: "The Russell Berrie Foundation", title: "Breakthrough in Diabetes Research Funded by Berrie Foundation", type: "ARTICLE", url: "https://www.russellberriefoundation.org/news/diabetes-breakthrough", summary: "Columbia University team discovers new therapeutic approach for Type 1 diabetes" },
  // Matan
  { donorName: "Matan - United Way of Israel", title: "Matan's Good Deeds Day 2024 Engages 1 Million Volunteers Worldwide", type: "PRESS_RELEASE", url: "https://www.matan.org.il/news/good-deeds-day-2024", summary: "Annual volunteer day reaches record participation across 100 countries" },
];

export async function POST() {
  try {
    let created = 0;
    let updated = 0;
    const skipped = 0;
    const donorMap = new Map<string, string>();

    for (const donor of testDonors) {
      // Normalize causes and compute quality score
      const normalizedCauses = normalizeCauses(donor.causes);
      const computedScore = computeQualityScore({
        name: donor.name,
        description: donor.description,
        website: donor.website,
        websiteVerified: donor.websiteVerified,
        causes: normalizedCauses,
        targetPopulations: donor.targetPopulations,
        geographicFocus: donor.geographicFocus,
        activeRegions: donor.activeRegions,
        headquartersCountry: donor.headquartersCountry,
        headquartersCity: donor.headquartersCity,
        totalGivingUsd: donor.totalGivingUsd,
        avgGrantSizeUsd: donor.avgGrantSizeUsd,
        email: undefined,
        phone: undefined,
        grantCount: donor.grantCount,
        dataSources: donor.dataSources as unknown[],
      }).total;

      const donorWithNormalized = {
        ...donor,
        causes: normalizedCauses,
        dataQualityScore: computedScore,
      };

      const existing = donor.ein
        ? await prisma.donor.findFirst({ where: { OR: [{ ein: donor.ein }, { name: donor.name }] } })
        : await prisma.donor.findFirst({ where: { name: donor.name } });

      if (existing) {
        // Update existing donors with new enrichment fields
        await prisma.donor.update({
          where: { id: existing.id },
          data: {
            websiteVerified: donor.websiteVerified,
            websiteSource: donor.websiteSource,
            headquartersCountry: donor.headquartersCountry,
            headquartersCity: donor.headquartersCity,
            activeRegions: donor.activeRegions,
            totalGivingUsd: donor.totalGivingUsd,
            avgGrantSizeUsd: donor.avgGrantSizeUsd,
            grantCount: donor.grantCount,
            givingYearRange: donor.givingYearRange,
            dataQualityScore: computedScore,
            description: donor.description,
            causes: normalizedCauses,
          },
        });
        donorMap.set(donor.name, existing.id);
        updated++;
        continue;
      }

      const result = await prisma.donor.create({ data: donorWithNormalized });
      donorMap.set(donor.name, result.id);
      created++;
    }

    let grantsCreated = 0;
    for (const grant of testGrants) {
      const donorId = donorMap.get(grant.donorName);
      if (!donorId) continue;

      const existing = await prisma.donorGrant.findFirst({
        where: { donorId, recipientName: grant.recipientName, year: grant.year },
      });
      if (existing) continue;

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

    let pubsCreated = 0;
    for (const pub of testPublications) {
      const donorId = donorMap.get(pub.donorName);
      if (!donorId) continue;

      const existing = await prisma.donorPublication.findFirst({
        where: { donorId, url: pub.url },
      });
      if (existing) continue;

      await prisma.donorPublication.create({
        data: {
          donorId,
          title: pub.title,
          type: pub.type as "ARTICLE" | "PRESS_RELEASE",
          url: pub.url,
          summary: pub.summary,
          publishedAt: new Date("2024-06-01"),
        },
      });
      pubsCreated++;
    }

    return NextResponse.json({
      success: true,
      donors: { created, updated, skipped },
      grants: { created: grantsCreated },
      publications: { created: pubsCreated },
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: "Seed failed", details: String(error) },
      { status: 500 }
    );
  }
}
