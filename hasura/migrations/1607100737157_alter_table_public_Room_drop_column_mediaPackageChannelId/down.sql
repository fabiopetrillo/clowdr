ALTER TABLE "public"."Room" ADD COLUMN "mediaPackageChannelId" text;
ALTER TABLE "public"."Room" ALTER COLUMN "mediaPackageChannelId" DROP NOT NULL;
