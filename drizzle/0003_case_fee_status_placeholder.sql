ALTER TABLE "case_fees" ALTER COLUMN "status" SET DEFAULT 'unselected';
--> statement-breakpoint
UPDATE "case_fees" SET "status" = 'unselected' WHERE "status" = 'sendToCenter';
