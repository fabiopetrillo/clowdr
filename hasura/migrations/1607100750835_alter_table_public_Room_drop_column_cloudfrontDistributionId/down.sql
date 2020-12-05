ALTER TABLE "public"."Room" ADD COLUMN "cloudfrontDistributionId" text;
ALTER TABLE "public"."Room" ALTER COLUMN "cloudfrontDistributionId" DROP NOT NULL;
