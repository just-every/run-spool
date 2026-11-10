-- Agent door policy-reference suppression from Base rer-v0.2.97+ (reference migration 0041_agent_retired_refs.sql, Base 656ff43c503ee8d03af12c10c5a927da97ac9ae8).
CREATE TABLE agent_door_retired_refs (digest TEXT PRIMARY KEY, marker TEXT NOT NULL);
