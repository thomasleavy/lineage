-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "garments" (
    "id" TEXT NOT NULL,
    "house_code" TEXT NOT NULL,
    "collection" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "designer_owner_id" TEXT,
    "status" TEXT NOT NULL,
    "silhouette_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "current_version_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "garments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "garment_versions" (
    "id" TEXT NOT NULL,
    "garment_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "change_summary" TEXT,
    "change_detail" TEXT,
    "diff_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "snapshot_json" JSONB NOT NULL,
    "parent_version_id" TEXT,

    CONSTRAINT "garment_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "garment_id" TEXT,
    "garment_version_id" TEXT,
    "type" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "original_filename" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fabric_scans" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "weave_type" TEXT,
    "tone" TEXT,
    "notes" TEXT,
    "image_stats_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fabric_scans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "looks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "collection" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "looks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "look_items" (
    "id" TEXT NOT NULL,
    "look_id" TEXT NOT NULL,
    "garment_id" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,
    "model_name" TEXT,
    "styling_notes" TEXT,

    CONSTRAINT "look_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_requests" (
    "id" TEXT NOT NULL,
    "garment_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "assigned_to_id" TEXT,
    "status" TEXT NOT NULL,
    "request_text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action_type" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "before_json" JSONB,
    "after_json" JSONB,
    "ip" TEXT,
    "user_agent" TEXT,
    "request_id" TEXT,
    "trace_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prev_hash" TEXT,
    "entry_hash" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE INDEX "sessions_token_idx" ON "sessions"("token");
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "garments_house_code_key" ON "garments"("house_code");
CREATE INDEX "garments_house_code_idx" ON "garments"("house_code");
CREATE INDEX "garments_collection_idx" ON "garments"("collection");
CREATE INDEX "garments_status_idx" ON "garments"("status");
CREATE INDEX "garments_designer_owner_id_idx" ON "garments"("designer_owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "garment_versions_garment_id_version_number_key" ON "garment_versions"("garment_id", "version_number");
CREATE INDEX "garment_versions_garment_id_idx" ON "garment_versions"("garment_id");
CREATE INDEX "garment_versions_created_by_id_idx" ON "garment_versions"("created_by_id");
CREATE INDEX "garment_versions_created_at_idx" ON "garment_versions"("created_at");

-- CreateIndex
CREATE INDEX "assets_garment_id_idx" ON "assets"("garment_id");
CREATE INDEX "assets_garment_version_id_idx" ON "assets"("garment_version_id");
CREATE INDEX "assets_created_by_id_idx" ON "assets"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "fabric_scans_asset_id_key" ON "fabric_scans"("asset_id");

-- CreateIndex
CREATE INDEX "looks_created_by_id_idx" ON "looks"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "look_items_look_id_order_index_key" ON "look_items"("look_id", "order_index");
CREATE INDEX "look_items_look_id_idx" ON "look_items"("look_id");
CREATE INDEX "look_items_garment_id_idx" ON "look_items"("garment_id");

-- CreateIndex
CREATE INDEX "change_requests_garment_id_idx" ON "change_requests"("garment_id");
CREATE INDEX "change_requests_status_idx" ON "change_requests"("status");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");
CREATE INDEX "audit_logs_entity_type_idx" ON "audit_logs"("entity_type");
CREATE INDEX "audit_logs_entity_id_idx" ON "audit_logs"("entity_id");
CREATE INDEX "audit_logs_action_type_idx" ON "audit_logs"("action_type");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- Foreign keys
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "garments" ADD CONSTRAINT "garments_designer_owner_id_fkey" FOREIGN KEY ("designer_owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "garment_versions" ADD CONSTRAINT "garment_versions_garment_id_fkey" FOREIGN KEY ("garment_id") REFERENCES "garments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "garment_versions" ADD CONSTRAINT "garment_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "garment_versions" ADD CONSTRAINT "garment_versions_parent_version_id_fkey" FOREIGN KEY ("parent_version_id") REFERENCES "garment_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "garments" ADD CONSTRAINT "garments_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "garment_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "assets" ADD CONSTRAINT "assets_garment_id_fkey" FOREIGN KEY ("garment_id") REFERENCES "garments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assets" ADD CONSTRAINT "assets_garment_version_id_fkey" FOREIGN KEY ("garment_version_id") REFERENCES "garment_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "assets" ADD CONSTRAINT "assets_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fabric_scans" ADD CONSTRAINT "fabric_scans_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "looks" ADD CONSTRAINT "looks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "look_items" ADD CONSTRAINT "look_items_look_id_fkey" FOREIGN KEY ("look_id") REFERENCES "looks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "look_items" ADD CONSTRAINT "look_items_garment_id_fkey" FOREIGN KEY ("garment_id") REFERENCES "garments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_garment_id_fkey" FOREIGN KEY ("garment_id") REFERENCES "garments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
