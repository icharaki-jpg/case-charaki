ALTER TABLE "cases" ALTER COLUMN "expert_order" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "cases" ALTER COLUMN "expert_order" SET DEFAULT '';
