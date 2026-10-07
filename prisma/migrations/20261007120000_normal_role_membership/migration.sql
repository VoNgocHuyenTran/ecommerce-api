UPDATE "Role"
SET "rolename" = 'normal'
WHERE "rolename" = 'customer';

UPDATE "MemberShip"
SET "mname" = 'normal',
    "score" = 10
WHERE "mname" = 'Standard';

ALTER TABLE "MemberShip" ALTER COLUMN "score" SET DEFAULT 10;
