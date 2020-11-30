CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE "public"."Room"("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(), "name" text NOT NULL, "vonageSessionId" text, "rtmpUri" text, "hlsUri" text, "mediaLiveChannelId" text, "mediaPackageChannelId" text, "cloudfrontDistributionId" text, PRIMARY KEY ("id") );
CREATE OR REPLACE FUNCTION "public"."set_current_timestamp_updatedAt"()
RETURNS TRIGGER AS $$
DECLARE
  _new record;
BEGIN
  _new := NEW;
  _new."updatedAt" = NOW();
  RETURN _new;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "set_public_Room_updatedAt"
BEFORE UPDATE ON "public"."Room"
FOR EACH ROW
EXECUTE PROCEDURE "public"."set_current_timestamp_updatedAt"();
COMMENT ON TRIGGER "set_public_Room_updatedAt" ON "public"."Room" 
IS 'trigger to set value of column "updatedAt" to current timestamp on row update';
