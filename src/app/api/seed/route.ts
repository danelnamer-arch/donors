import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const testDonors = [
  {
    name: "The Schusterman Family Foundation",
    type: "FOUNDATION" as const,
    description:
      "The Charles and Lynn Schusterman Family Philanthropies invests in initiatives that strengthen the Jewish community, advance education, and empower young people. Active in both the US and Israel with a focus on social justice and leadership development.",
    website: "https://www.schusterman.org",
    country: "United States",
    city: "Tulsa",
    location: "Tulsa, Oklahoma, USA",
    causes: ["Education", "Jewish Community", "Social Justice", "Youth Development", "Israel"],
    targetPopulations: ["Youth", "Jewish Communities", "Underserved Communities"],
    geographicFocus: ["United States", "Israel"],
    dataQualityScore: 0.85,
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
    country: "United States",
    city: "San Francisco",
    location: "San Francisco, California, USA",
    causes: ["Jewish Education", "Youth Development", "Community Building"],
    targetPopulations: ["Youth", "Young Adults", "Jewish Communities"],
    geographicFocus: ["United States"],
    dataQualityScore: 0.82,
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
    country: "United States",
    city: "Encinitas",
    location: "Encinitas, California, USA",
    causes: ["Jewish Community", "Agriculture", "Social Justice", "Innovation", "Community Development"],
    targetPopulations: ["Jewish Communities", "Farmers", "Youth"],
    geographicFocus: ["United States", "Israel", "San Diego County"],
    dataQualityScore: 0.78,
    dataSources: [{ source: "seed", url: "https://leichtag.org" }],
    researchStatus: "COMPLETED" as const,
    ein: "26-0703760",
  },
  {
    name: "UJA-Federation of New York",
    type: "FOUNDATION" as const,
    description:
      "UJA-Federation of New York cares for Jews everywhere and New Yorkers of all backgrounds, responding to crises close to home and far away, and shaping the Jewish future. One of the largest local philanthropies in the world.",
    website: "https://www.ujafedny.org",
    country: "United States",
    city: "New York",
    location: "New York, New York, USA",
    causes: ["Jewish Community", "Social Services", "Poverty Alleviation", "Education", "Israel"],
    targetPopulations: ["Jewish Communities", "Low-Income Families", "Elderly", "Youth"],
    geographicFocus: ["United States", "Israel", "New York"],
    dataQualityScore: 0.90,
    dataSources: [{ source: "seed", url: "https://www.ujafedny.org" }],
    researchStatus: "COMPLETED" as const,
    ein: "51-0172429",
  },
  {
    name: "The Rashi Foundation",
    type: "FOUNDATION" as const,
    description:
      "The Rashi Foundation is one of Israel's leading philanthropic organizations, working to close social gaps and promote equal opportunities in Israeli society. Focuses on education, employment, and community empowerment in peripheral areas.",
    website: "https://www.rfrashi.org",
    country: "Israel",
    city: "Tel Aviv",
    location: "Tel Aviv, Israel",
    causes: ["Education", "Employment", "Social Equality", "Community Development"],
    targetPopulations: ["Underserved Communities", "Youth", "Arab Citizens of Israel", "Ethiopian Israelis"],
    geographicFocus: ["Israel"],
    dataQualityScore: 0.80,
    dataSources: [{ source: "seed", url: "https://www.rfrashi.org" }],
    researchStatus: "COMPLETED" as const,
  },
  {
    name: "The Paul E. Singer Foundation",
    type: "FOUNDATION" as const,
    description:
      "The Paul E. Singer Foundation supports organizations that defend human rights, strengthen democratic values, and advance educational opportunities. Has significant focus on LGBTQ rights, Israel, and education reform.",
    website: "https://www.singerfdn.org",
    country: "United States",
    city: "New York",
    location: "New York, New York, USA",
    causes: ["Human Rights", "Education", "Democracy", "LGBTQ Rights", "Israel"],
    targetPopulations: ["LGBTQ Community", "Students", "Youth"],
    geographicFocus: ["United States", "Israel", "Global"],
    dataQualityScore: 0.75,
    dataSources: [{ source: "seed", url: "https://www.singerfdn.org" }],
    researchStatus: "COMPLETED" as const,
    ein: "20-5350288",
  },
  {
    name: "The Russell Berrie Foundation",
    type: "FOUNDATION" as const,
    description:
      "The Russell Berrie Foundation promotes interreligious understanding, diabetes research, and community development. Has a strong focus on Jewish-Christian relations and supporting communities in New Jersey and Israel.",
    website: "https://www.russellberriefoundation.org",
    country: "United States",
    city: "Teaneck",
    location: "Teaneck, New Jersey, USA",
    causes: ["Interfaith Dialogue", "Healthcare", "Community Development", "Education"],
    targetPopulations: ["Religious Communities", "Diabetes Patients", "Youth"],
    geographicFocus: ["United States", "Israel", "New Jersey"],
    dataQualityScore: 0.72,
    dataSources: [{ source: "seed", url: "https://www.russellberriefoundation.org" }],
    researchStatus: "COMPLETED" as const,
    ein: "22-2507520",
  },
  {
    name: "Matan - United Way of Israel",
    type: "FOUNDATION" as const,
    description:
      "Matan – United Way of Israel is the leading organization in Israel advancing strategic philanthropy and corporate social responsibility. Connects corporations and foundations with effective nonprofits to maximize social impact.",
    website: "https://www.matan.org.il",
    country: "Israel",
    city: "Tel Aviv",
    location: "Tel Aviv, Israel",
    causes: ["Philanthropy", "Corporate Social Responsibility", "Social Services", "Education"],
    targetPopulations: ["Nonprofits", "Corporations", "Underserved Communities"],
    geographicFocus: ["Israel"],
    dataQualityScore: 0.77,
    dataSources: [{ source: "seed", url: "https://www.matan.org.il" }],
    researchStatus: "COMPLETED" as const,
  },
  {
    name: "The Maimonides Fund",
    type: "FOUNDATION" as const,
    description:
      "The Maimonides Fund supports initiatives in Jewish education, Israel, and public policy. Named after the medieval Jewish philosopher, the fund invests in strengthening Jewish identity and engagement among young adults.",
    website: "https://www.maimonidesfund.org",
    country: "United States",
    city: "New York",
    location: "New York, New York, USA",
    causes: ["Jewish Education", "Israel", "Public Policy", "Jewish Identity"],
    targetPopulations: ["Young Adults", "Jewish Communities", "Students"],
    geographicFocus: ["United States", "Israel"],
    dataQualityScore: 0.79,
    dataSources: [{ source: "seed", url: "https://www.maimonidesfund.org" }],
    researchStatus: "COMPLETED" as const,
    ein: "27-3175463",
  },
  {
    name: "Keren Hayesod",
    type: "FOUNDATION" as const,
    description:
      "Keren Hayesod – United Israel Appeal is the fundraising organization for Israel. It raises funds in over 45 countries for immigrant absorption, social welfare, education, and rural development in Israel.",
    website: "https://www.kh-uia.org.il",
    country: "Israel",
    city: "Jerusalem",
    location: "Jerusalem, Israel",
    causes: ["Immigration", "Social Welfare", "Education", "Rural Development", "Israel"],
    targetPopulations: ["Immigrants", "Underserved Communities", "Youth", "Elderly"],
    geographicFocus: ["Israel", "Global"],
    dataQualityScore: 0.88,
    dataSources: [{ source: "seed", url: "https://www.kh-uia.org.il" }],
    researchStatus: "COMPLETED" as const,
  },
];

const testGrants = [
  { donorName: "The Schusterman Family Foundation", recipientName: "Hillel International", amount: 5000000, year: 2023, purpose: "Supporting Jewish campus life and student engagement" },
  { donorName: "The Schusterman Family Foundation", recipientName: "ROI Community", amount: 2000000, year: 2023, purpose: "Young Jewish innovators network" },
  { donorName: "The Jim Joseph Foundation", recipientName: "PJ Library", amount: 3500000, year: 2023, purpose: "Jewish children's book distribution" },
  { donorName: "The Jim Joseph Foundation", recipientName: "Birthright Israel Foundation", amount: 4000000, year: 2022, purpose: "Free educational trips to Israel for young adults" },
  { donorName: "UJA-Federation of New York", recipientName: "JASA", amount: 1500000, year: 2023, purpose: "Services for aging Jewish community members" },
  { donorName: "UJA-Federation of New York", recipientName: "Met Council on Jewish Poverty", amount: 2500000, year: 2023, purpose: "Anti-poverty programs in NYC" },
  { donorName: "The Leichtag Foundation", recipientName: "Leket Israel", amount: 500000, year: 2023, purpose: "Food rescue and agricultural programs" },
  { donorName: "The Paul E. Singer Foundation", recipientName: "Israel Democracy Institute", amount: 1000000, year: 2022, purpose: "Strengthening democratic institutions in Israel" },
  { donorName: "Keren Hayesod", recipientName: "Jewish Agency for Israel", amount: 10000000, year: 2023, purpose: "Immigrant absorption and social welfare programs" },
  { donorName: "The Maimonides Fund", recipientName: "MASA Israel Journey", amount: 750000, year: 2023, purpose: "Long-term Israel programs for young adults" },
];

export async function POST() {
  try {
    let created = 0;
    let skipped = 0;
    const donorMap = new Map<string, string>();

    for (const donor of testDonors) {
      const existing = donor.ein
        ? await prisma.donor.findFirst({ where: { OR: [{ ein: donor.ein }, { name: donor.name }] } })
        : await prisma.donor.findFirst({ where: { name: donor.name } });

      if (existing) {
        donorMap.set(donor.name, existing.id);
        skipped++;
        continue;
      }

      const result = await prisma.donor.create({ data: donor });
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

    return NextResponse.json({
      success: true,
      donors: { created, skipped },
      grants: { created: grantsCreated },
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: "Seed failed", details: String(error) },
      { status: 500 }
    );
  }
}
