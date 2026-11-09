-- MIG-004 / SRC-003: native debug files (dSYM Mach-O, ELF/DWARF and Dart symbols, Breakpad, ProGuard/R8
-- mappings) an unmodified sentry-cli uploads from mobile CI. Spool keeps the bytes under the project and
-- the debug ID the client names, so a build's symbol upload has a destination. Symbolication that reads
-- them is SDK-002; nothing here rewrites an event. As with Sentry, one debug ID can name several files (an
-- executable and its dSYM share one), so a file is keyed by its SHA-1. Additive; no foreign keys, as in 0060: erasure follows
-- by declaration. The bytes are the staged base64 chunks, copied once at assembly.
CREATE TABLE sentry_debug_files (
 project TEXT NOT NULL,
 debug_id TEXT NOT NULL CHECK(length(debug_id)>=8 AND length(debug_id)<=64),
 kind TEXT NOT NULL CHECK(kind IN ('macho','elf','breakpad','proguard')),
 sha1 TEXT NOT NULL CHECK(length(sha1)=40),
 name TEXT NOT NULL CHECK(length(name)<=200),
 size INTEGER NOT NULL CHECK(size>0),
 created INTEGER NOT NULL,
 PRIMARY KEY(project,sha1)
);
CREATE INDEX sentry_debug_files_debug ON sentry_debug_files(project,debug_id);
CREATE TABLE sentry_debug_file_parts (
 project TEXT NOT NULL,
 sha1 TEXT NOT NULL CHECK(length(sha1)=40),
 seq INTEGER NOT NULL CHECK(seq>=0),
 data TEXT NOT NULL,
 PRIMARY KEY(project,sha1,seq)
);
