ALTER TABLE "families" ADD COLUMN "block_app_installs" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "families" ADD COLUMN "block_app_removal" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "families" ADD COLUMN "web_filter" text DEFAULT 'adult' NOT NULL;