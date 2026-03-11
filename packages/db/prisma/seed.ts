/**
 * Database Seed Script
 *
 * Seeds the database with:
 * 1. Default admin user
 * 2. SLA configuration per onboarding stage
 * 3. Sample data for development
 *
 * Run: pnpm db:seed
 */

import { PrismaClient, OnboardingStage, UserRole } from '@prisma/client';
import { hash } from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...\n');

  // Hash default passwords with argon2
  const adminHash = await hash('admin123');
  const userHash = await hash('password123');

  // ── 1. Default Admin User ──────────────────
  const admin = await prisma.user.upsert({
    where: { email: 'admin@aggroso.com' },
    update: {},
    create: {
      name: 'Admin',
      email: 'admin@aggroso.com',
      passwordHash: adminHash,
      role: UserRole.ADMIN,
    },
  });
  console.log(`✅ Admin user: ${admin.email}`);

  // ── 2. SLA Configuration per Stage ─────────
  const slaConfigs = [
    { stage: OnboardingStage.DEAL_CLOSED, slaHours: 4, atRiskPct: 0.75 },
    { stage: OnboardingStage.KICKOFF, slaHours: 48, atRiskPct: 0.75 },
    { stage: OnboardingStage.REQUIREMENTS_GATHERING, slaHours: 120, atRiskPct: 0.7 },
    { stage: OnboardingStage.DOCUMENTATION, slaHours: 72, atRiskPct: 0.75 },
    { stage: OnboardingStage.TECHNICAL_SETUP, slaHours: 168, atRiskPct: 0.7 },
    { stage: OnboardingStage.TESTING_UAT, slaHours: 120, atRiskPct: 0.75 },
    { stage: OnboardingStage.GO_LIVE, slaHours: 48, atRiskPct: 0.8 },
    { stage: OnboardingStage.TRAINING, slaHours: 72, atRiskPct: 0.75 },
    { stage: OnboardingStage.COMPLETED, slaHours: 0, atRiskPct: 1.0 },
  ];

  for (const config of slaConfigs) {
    await prisma.stageSlaConfig.upsert({
      where: { stage: config.stage },
      update: { slaHours: config.slaHours, atRiskPct: config.atRiskPct },
      create: config,
    });
  }
  console.log(`✅ SLA config: ${slaConfigs.length} stages configured`);

  // ── 3. Sample Data (Development Only) ──────
  if (process.env['NODE_ENV'] !== 'production') {
    const samplePartner = await prisma.user.upsert({
      where: { email: 'rohit@aggroso.com' },
      update: {},
      create: {
        name: 'Rohit',
        email: 'rohit@aggroso.com',
        passwordHash: userHash,
        role: UserRole.PARTNER,
      },
    });

    const bdManager = await prisma.user.upsert({
      where: { email: 'bd@aggroso.com' },
      update: {},
      create: {
        name: 'BD Manager',
        email: 'bd@aggroso.com',
        passwordHash: userHash,
        role: UserRole.BD_MANAGER,
      },
    });

    console.log(`✅ Sample users: ${samplePartner.email}, ${bdManager.email}`);

    // Sample leads
    const sampleLeads = [
      {
        companyName: 'TechStartup Inc.',
        contactName: 'John Doe',
        contactEmail: 'john@techstartup.com',
        website: 'https://techstartup.com',
        industry: 'SaaS',
        companySize: '10-50',
        location: 'Mumbai, India',
        source: 'MANUAL' as const,
        status: 'PENDING_REVIEW' as const,
        assignedToId: bdManager.id,
      },
      {
        companyName: 'FinServ Solutions',
        contactName: 'Jane Smith',
        contactEmail: 'jane@finserv.com',
        website: 'https://finserv.com',
        industry: 'FinTech',
        companySize: '50-200',
        location: 'Bangalore, India',
        source: 'AI_SEARCH' as const,
        status: 'DISCOVERED' as const,
        aiScore: 78.5,
      },
      {
        companyName: 'EduLearn Platform',
        contactName: 'Mike Johnson',
        contactEmail: 'mike@edulearn.com',
        website: 'https://edulearn.com',
        industry: 'EdTech',
        companySize: '10-50',
        location: 'Delhi, India',
        source: 'REFERRAL' as const,
        status: 'APPROVED' as const,
        aiScore: 85.2,
        reviewedById: samplePartner.id,
        reviewedAt: new Date(),
      },
    ];

    for (const lead of sampleLeads) {
      await prisma.lead.create({ data: lead });
    }
    console.log(`✅ Sample leads: ${sampleLeads.length} created`);
  }

  console.log('\n🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
