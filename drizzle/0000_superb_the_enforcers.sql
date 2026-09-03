CREATE TABLE "cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expert_id" uuid,
	"case_number" text NOT NULL,
	"referral_source" text NOT NULL,
	"expert_order" text NOT NULL,
	"referral_date" text NOT NULL,
	"meeting_date" text NOT NULL,
	"meeting_time" text NOT NULL,
	"deadline" text NOT NULL,
	"advance_fee" text NOT NULL,
	"claimant" text NOT NULL,
	"claimant_phone" text NOT NULL,
	"respondent" text NOT NULL,
	"respondent_phone" text NOT NULL,
	"claimant_lawyer" text NOT NULL,
	"claimant_lawyer_phone" text NOT NULL,
	"respondent_lawyer" text NOT NULL,
	"respondent_lawyer_phone" text NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expert_accounts" (
	"expert_id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"national_id" text NOT NULL,
	"password_credential" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"national_id" text NOT NULL,
	"phone" text NOT NULL,
	"email" text NOT NULL,
	"expertise" text NOT NULL,
	"license_number" text NOT NULL,
	"membership_date" text NOT NULL,
	"address" text NOT NULL,
	"notes" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"verification_status" text DEFAULT 'pending' NOT NULL,
	"meeting_reminder_enabled" boolean DEFAULT true NOT NULL,
	"meeting_reminder_days" integer DEFAULT 2 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"expert_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"purpose" text NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_expert_id_experts_id_fk" FOREIGN KEY ("expert_id") REFERENCES "public"."experts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expert_accounts" ADD CONSTRAINT "expert_accounts_expert_id_experts_id_fk" FOREIGN KEY ("expert_id") REFERENCES "public"."experts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_expert_id_experts_id_fk" FOREIGN KEY ("expert_id") REFERENCES "public"."experts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cases_case_number_unique" ON "cases" USING btree ("case_number");--> statement-breakpoint
CREATE UNIQUE INDEX "experts_national_id_unique" ON "experts" USING btree ("national_id");--> statement-breakpoint
CREATE UNIQUE INDEX "experts_email_unique" ON "experts" USING btree ("email");