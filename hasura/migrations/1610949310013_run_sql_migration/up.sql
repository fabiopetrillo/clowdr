CREATE OR REPLACE FUNCTION chat."unnotifiedCount"(currRow chat."ReadUpToIndex")
 RETURNS integer
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
  RETURN (SELECT COUNT(*) FROM chat."Message" WHERE "chatId" = currRow."chatId" AND id > currRow."notifiedUpToMessageId");
END;
$function$;
