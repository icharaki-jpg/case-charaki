import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const experts = pgTable(
  "experts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fullName: text("full_name").notNull(),
    nationalId: text("national_id").notNull(),
    phone: text("phone").notNull(),
    email: text("email").notNull(),
    expertise: text("expertise").notNull(),
    licenseNumber: text("license_number").notNull(),
    membershipDate: text("membership_date").notNull(),
    address: text("address").notNull(),
    notes: text("notes").notNull(),
    status: text("status").notNull().default("active"),
    verificationStatus: text("verification_status").notNull().default("pending"),
    meetingReminderEnabled: boolean("meeting_reminder_enabled").notNull().default(true),
    meetingReminderDays: integer("meeting_reminder_days").notNull().default(2),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    nationalIdUnique: uniqueIndex("experts_national_id_unique").on(table.nationalId),
    emailUnique: uniqueIndex("experts_email_unique").on(table.email),
  }),
);

export const expertAccounts = pgTable("expert_accounts", {
  expertId: uuid("expert_id")
    .primaryKey()
    .references(() => experts.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  nationalId: text("national_id").notNull(),
  passwordCredential: text("password_credential").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  expertId: uuid("expert_id")
    .notNull()
    .references(() => experts.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const verificationChallenges = pgTable("verification_challenges", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  purpose: text("purpose").notNull(),
  codeHash: text("code_hash").notNull(),
  attempts: integer("attempts").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const cases = pgTable(
  "cases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    expertId: uuid("expert_id").references(() => experts.id, { onDelete: "set null" }),
    caseNumber: text("case_number").notNull(),
    referralSource: text("referral_source").notNull(),
    expertOrder: text("expert_order").notNull(),
    referralDate: text("referral_date").notNull(),
    meetingDate: text("meeting_date").notNull(),
    meetingTime: text("meeting_time").notNull(),
    deadline: text("deadline").notNull(),
    advanceFee: text("advance_fee").notNull(),
    claimant: text("claimant").notNull(),
    claimantPhone: text("claimant_phone").notNull(),
    respondent: text("respondent").notNull(),
    respondentPhone: text("respondent_phone").notNull(),
    claimantLawyer: text("claimant_lawyer").notNull(),
    claimantLawyerPhone: text("claimant_lawyer_phone").notNull(),
    respondentLawyer: text("respondent_lawyer").notNull(),
    respondentLawyerPhone: text("respondent_lawyer_phone").notNull(),
    description: text("description").notNull(),
    status: text("status").notNull().default("new"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    caseNumberUnique: uniqueIndex("cases_case_number_unique").on(table.caseNumber),
  }),
);

export type Expert = typeof experts.$inferSelect;
export type NewExpert = typeof experts.$inferInsert;
export type ExpertAccount = typeof expertAccounts.$inferSelect;
export type Case = typeof cases.$inferSelect;
export type NewCase = typeof cases.$inferInsert;
