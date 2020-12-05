ALTER TABLE "public"."Room" ADD COLUMN "mediaLiveChannelId" text;
ALTER TABLE "public"."Room" ALTER COLUMN "mediaLiveChannelId" DROP NOT NULL;
