CREATE TABLE "app_catalog" (
	"id" text NOT NULL,
	"family_id" uuid,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"icon" text DEFAULT 'grid' NOT NULL,
	"icon_color" text DEFAULT '#718078' NOT NULL,
	"android_packages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ios_bundle_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_catalog_scope_unique" UNIQUE NULLS NOT DISTINCT("family_id","id")
);
--> statement-breakpoint
CREATE TABLE "device_apps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"package_name" text NOT NULL,
	"label" text NOT NULL,
	"status" text DEFAULT 'approved' NOT NULL,
	"installed_at" timestamp with time zone,
	"removed_at" timestamp with time zone,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"child_id" uuid NOT NULL,
	"type" text NOT NULL,
	"detail" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_rule_bindings" (
	"device_id" uuid NOT NULL,
	"rule_id" uuid NOT NULL,
	"bound_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "device_rule_bindings_device_id_rule_id_pk" PRIMARY KEY("device_id","rule_id")
);
--> statement-breakpoint
CREATE TABLE "family_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"role" text NOT NULL,
	"created_by" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"used_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "family_invites_code_hash_unique" UNIQUE("code_hash")
);
--> statement-breakpoint
CREATE TABLE "push_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"platform" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "temporary_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"child_id" uuid NOT NULL,
	"app_id" text NOT NULL,
	"minutes" integer NOT NULL,
	"valid_on" date NOT NULL,
	"source" text NOT NULL,
	"time_request_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_daily" (
	"family_id" uuid NOT NULL,
	"child_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"app_id" text NOT NULL,
	"day" date NOT NULL,
	"minutes" integer DEFAULT 0 NOT NULL,
	"precision" text DEFAULT 'exact' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usage_daily_device_id_app_id_day_pk" PRIMARY KEY("device_id","app_id","day")
);
--> statement-breakpoint
CREATE TABLE "usage_hourly" (
	"family_id" uuid NOT NULL,
	"child_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"app_id" text NOT NULL,
	"day" date NOT NULL,
	"hour" integer NOT NULL,
	"minutes" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "usage_hourly_device_id_app_id_day_hour_pk" PRIMARY KEY("device_id","app_id","day","hour")
);
--> statement-breakpoint
ALTER TABLE "app_rules" ADD COLUMN "android_packages" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "children" ADD COLUMN "color" text DEFAULT '#2A5A4A' NOT NULL;--> statement-breakpoint
ALTER TABLE "children" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "os_version" text;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "app_version" text;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "model" text;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "timezone" text;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "battery_level" integer;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "push_token" text;--> statement-breakpoint
ALTER TABLE "families" ADD COLUMN "timezone" text DEFAULT 'America/Sao_Paulo' NOT NULL;--> statement-breakpoint
ALTER TABLE "families" ADD COLUMN "offline_lease_hours" integer DEFAULT 72 NOT NULL;--> statement-breakpoint
ALTER TABLE "families" ADD COLUMN "guardian_pin_hash" text;--> statement-breakpoint
ALTER TABLE "families" ADD COLUMN "guardian_pin_salt" text;--> statement-breakpoint
ALTER TABLE "families" ADD COLUMN "guardian_pin_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "families" ADD COLUMN "quarantine_new_apps" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "family_memberships" ADD COLUMN "invited_by" uuid;--> statement-breakpoint
ALTER TABLE "time_requests" ADD COLUMN "device_id" uuid;--> statement-breakpoint
ALTER TABLE "time_requests" ADD COLUMN "resolved_by" uuid;--> statement-breakpoint
ALTER TABLE "time_requests" ADD COLUMN "resolved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app_catalog" ADD CONSTRAINT "app_catalog_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_apps" ADD CONSTRAINT "device_apps_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_apps" ADD CONSTRAINT "device_apps_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_events" ADD CONSTRAINT "device_events_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_events" ADD CONSTRAINT "device_events_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_events" ADD CONSTRAINT "device_events_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_rule_bindings" ADD CONSTRAINT "device_rule_bindings_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_rule_bindings" ADD CONSTRAINT "device_rule_bindings_rule_id_app_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."app_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_invites" ADD CONSTRAINT "family_invites_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_invites" ADD CONSTRAINT "family_invites_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_invites" ADD CONSTRAINT "family_invites_used_by_users_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temporary_grants" ADD CONSTRAINT "temporary_grants_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temporary_grants" ADD CONSTRAINT "temporary_grants_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temporary_grants" ADD CONSTRAINT "temporary_grants_time_request_id_time_requests_id_fk" FOREIGN KEY ("time_request_id") REFERENCES "public"."time_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temporary_grants" ADD CONSTRAINT "temporary_grants_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_daily" ADD CONSTRAINT "usage_daily_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_daily" ADD CONSTRAINT "usage_daily_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_daily" ADD CONSTRAINT "usage_daily_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_hourly" ADD CONSTRAINT "usage_hourly_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_hourly" ADD CONSTRAINT "usage_hourly_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_hourly" ADD CONSTRAINT "usage_hourly_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "device_apps_unique" ON "device_apps" USING btree ("device_id","package_name");--> statement-breakpoint
CREATE INDEX "device_events_family_idx" ON "device_events" USING btree ("family_id","occurred_at");--> statement-breakpoint
CREATE INDEX "temporary_grants_child_day_idx" ON "temporary_grants" USING btree ("child_id","valid_on");--> statement-breakpoint
CREATE INDEX "usage_daily_child_day_idx" ON "usage_daily" USING btree ("child_id","day");--> statement-breakpoint
CREATE INDEX "usage_hourly_child_day_idx" ON "usage_hourly" USING btree ("child_id","day");--> statement-breakpoint
ALTER TABLE "family_memberships" ADD CONSTRAINT "family_memberships_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_requests" ADD CONSTRAINT "time_requests_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_requests" ADD CONSTRAINT "time_requests_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "app_rules_child_app_unique" ON "app_rules" USING btree ("child_id","app_id");--> statement-breakpoint
CREATE INDEX "children_family_idx" ON "children" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "devices_family_idx" ON "devices" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "devices_child_idx" ON "devices" USING btree ("child_id");--> statement-breakpoint
CREATE INDEX "pairing_codes_hash_idx" ON "pairing_codes" USING btree ("code_hash");--> statement-breakpoint
UPDATE "app_rules" SET "android_packages" = '["com.google.android.youtube"]'::jsonb WHERE "app_id" = 'youtube' AND "android_packages" = '[]'::jsonb;--> statement-breakpoint
UPDATE "app_rules" SET "android_packages" = jsonb_build_array("app_id") WHERE "app_id" LIKE '%.%' AND "android_packages" = '[]'::jsonb;
