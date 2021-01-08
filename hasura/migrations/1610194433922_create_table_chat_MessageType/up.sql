CREATE TABLE "chat"."MessageType"("name" Text NOT NULL, "number" integer NOT NULL, PRIMARY KEY ("number") , UNIQUE ("number"), UNIQUE ("name")); COMMENT ON TABLE "chat"."MessageType" IS E'Name is a useful unique moniker for the number, but the number is the efficient way to fetch the type.';
