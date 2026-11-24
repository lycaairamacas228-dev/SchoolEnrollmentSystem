
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, 'school.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 full_name TEXT NOT NULL,
 email TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'student',
 student_number TEXT UNIQUE,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS courses (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 code TEXT NOT NULL UNIQUE,
 name TEXT NOT NULL,
 description TEXT DEFAULT '',
 duration TEXT DEFAULT '4 years',
 is_active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS subjects (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
 code TEXT NOT NULL,
 name TEXT NOT NULL,
 units INTEGER NOT NULL DEFAULT 3,
 year_level INTEGER NOT NULL DEFAULT 1,
 semester TEXT NOT NULL DEFAULT '1st',
 UNIQUE(course_id, code)
);
CREATE TABLE IF NOT EXISTS enrollments (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL REFERENCES users(id),
 course_id INTEGER NOT NULL REFERENCES courses(id),
 school_year TEXT NOT NULL,
 semester TEXT NOT NULL,
 year_level INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'Pending',
 notes TEXT DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 reviewed_at TEXT
);
CREATE TABLE IF NOT EXISTS enrollment_subjects (
 enrollment_id INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
 subject_id INTEGER NOT NULL REFERENCES subjects(id),
 PRIMARY KEY(enrollment_id, subject_id)
);
`);

const courseCount = db.prepare('SELECT COUNT(*) n FROM courses').get().n;
if (!courseCount) {
 const insertCourse = db.prepare('INSERT INTO courses(code,name,description,duration) VALUES(?,?,?,?)');
 const courses = [
  ['BSIT','Bachelor of Science in Information Technology','Computing, software development, networking and information systems.','4 years'],
  ['BSBA','Bachelor of Science in Business Administration','Business management, finance, marketing and entrepreneurship.','4 years'],
  ['BSED','Bachelor of Secondary Education','Professional education and subject-area teaching.','4 years'],
  ['BSHM','Bachelor of Science in Hospitality Management','Hospitality operations, tourism and service management.','4 years'],
  ['BIT-AUTO','Bachelor of Industrial Technology - Automotive','Automotive servicing, diagnostics and shop operations.','4 years']
 ];
 const tx = db.transaction(() => {
  courses.forEach(c => insertCourse.run(...c));
  const all = db.prepare('SELECT id,code FROM courses').all();
  const insertSubject = db.prepare('INSERT INTO subjects(course_id,code,name,units,year_level,semester) VALUES(?,?,?,?,?,?)');
  const common = [
   ['GE101','Understanding the Self',3,1,'1st'],['GE102','Purposive Communication',3,1,'1st'],
   ['IT101','Introduction to Computing',3,1,'1st'],['IT102','Computer Programming 1',3,1,'2nd'],
   ['GE103','Readings in Philippine History',3,1,'2nd'],['PE101','Physical Education 1',2,1,'1st']
  ];
  for (const c of all) common.forEach(s => insertSubject.run(c.id,...s));
 });
 tx();
}
const admin = db.prepare('SELECT id FROM users WHERE email=?').get('admin@school.edu');
if (!admin) {
 db.prepare('INSERT INTO users(full_name,email,password_hash,role) VALUES(?,?,?,?)')
  .run('System Administrator','admin@school.edu',bcrypt.hashSync('Admin123!',10),'admin');
 db.prepare('INSERT INTO users(full_name,email,password_hash,role,student_number) VALUES(?,?,?,?,?)')
  .run('Alex Student','student@school.edu',bcrypt.hashSync('Student123!',10),'student','2026-0001');
}
export default db;
