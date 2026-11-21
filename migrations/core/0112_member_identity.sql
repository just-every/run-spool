-- The native account remains authoritative for a member's own identity.
-- A uniqueness conflict aborts the native email change in the same transaction.
CREATE TRIGGER spool_member_identity AFTER UPDATE OF email,display_name ON oa_operators BEGIN
 UPDATE spool_members SET email=NEW.email,name=NEW.display_name WHERE operator_id=NEW.id;
END;
UPDATE spool_members SET email=(SELECT email FROM oa_operators WHERE id=operator_id),
 name=(SELECT display_name FROM oa_operators WHERE id=operator_id)
 WHERE operator_id IN (SELECT id FROM oa_operators);
