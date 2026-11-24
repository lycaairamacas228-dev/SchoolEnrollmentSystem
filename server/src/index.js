
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import db from './db.js';
import { auth, adminOnly, signToken } from './auth.js';

const app = express();
app.use(cors({ origin:true }));
app.use(express.json({limit:'1mb'}));
const port = process.env.PORT || 5000;
const publicUser = u => ({id:u.id,fullName:u.full_name,email:u.email,role:u.role,studentNumber:u.student_number});

app.get('/api/health', (_req,res) => res.json({ok:true, service:'School Enrollment API'}));

app.post('/api/auth/register', (req,res) => {
 const {fullName,email,password} = req.body || {};
 if (!fullName?.trim() || !email?.trim() || !password) return res.status(400).json({error:'Complete all required fields.'});
 if (password.length < 8) return res.status(400).json({error:'Password must be at least 8 characters.'});
 try {
  const number = `2026-${String(Date.now()).slice(-6)}`;
  const result = db.prepare('INSERT INTO users(full_name,email,password_hash,role,student_number) VALUES(?,?,?,?,?)')
   .run(fullName.trim(),email.trim().toLowerCase(),bcrypt.hashSync(password,10),'student',number);
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(result.lastInsertRowid);
  res.status(201).json({token:signToken(user),user:publicUser(user)});
 } catch { res.status(409).json({error:'An account with this email already exists.'}); }
});
app.post('/api/auth/login',(req,res)=>{
 const {email,password} = req.body || {};
 const user = db.prepare('SELECT * FROM users WHERE email=?').get((email||'').toLowerCase().trim());
 if (!user || !bcrypt.compareSync(password||'',user.password_hash)) return res.status(401).json({error:'Invalid email or password.'});
 res.json({token:signToken(user),user:publicUser(user)});
});
app.get('/api/auth/me',auth,(req,res)=>{
 const user=db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
 if (!user) return res.status(404).json({error:'Account not found.'});
 res.json({user:publicUser(user)});
});

app.get('/api/courses',(req,res)=>{
 const rows=db.prepare('SELECT * FROM courses WHERE is_active=1 ORDER BY name').all();
 res.json(rows);
});
app.get('/api/courses/:id/subjects',(req,res)=>{
 res.json(db.prepare('SELECT * FROM subjects WHERE course_id=? ORDER BY year_level,semester,name').all(req.params.id));
});
app.get('/api/student/dashboard',auth,(req,res)=>{
 const total=db.prepare('SELECT COUNT(*) n FROM enrollments WHERE user_id=?').get(req.user.id).n;
 const latest=db.prepare(`SELECT e.*,c.name course_name FROM enrollments e JOIN courses c ON c.id=e.course_id WHERE e.user_id=? ORDER BY e.id DESC LIMIT 1`).get(req.user.id);
 res.json({totalEnrollments:total,latest});
});
app.get('/api/student/enrollments',auth,(req,res)=>{
 const rows=db.prepare(`SELECT e.*,c.name course_name,c.code course_code,
 (SELECT GROUP_CONCAT(s.code || ' - ' || s.name, ', ') FROM enrollment_subjects es JOIN subjects s ON s.id=es.subject_id WHERE es.enrollment_id=e.id) subjects
 FROM enrollments e JOIN courses c ON c.id=e.course_id WHERE e.user_id=? ORDER BY e.id DESC`).all(req.user.id);
 res.json(rows);
});
app.post('/api/student/enrollments',auth,(req,res)=>{
 const {courseId,schoolYear,semester,yearLevel,subjectIds=[],notes=''}=req.body||{};
 if (!courseId || !schoolYear || !semester || !yearLevel || !Array.isArray(subjectIds) || !subjectIds.length)
  return res.status(400).json({error:'Select a course, school year, semester, year level and at least one subject.'});
 const course=db.prepare('SELECT id FROM courses WHERE id=? AND is_active=1').get(courseId);
 if (!course) return res.status(400).json({error:'Please select a valid course.'});
 const insert=db.transaction(()=>{
  const e=db.prepare('INSERT INTO enrollments(user_id,course_id,school_year,semester,year_level,notes) VALUES(?,?,?,?,?,?)')
   .run(req.user.id,courseId,schoolYear,semester,yearLevel,notes);
  const add=db.prepare('INSERT INTO enrollment_subjects(enrollment_id,subject_id) VALUES(?,?)');
  for(const sid of subjectIds) {
   const subject=db.prepare('SELECT id FROM subjects WHERE id=? AND course_id=?').get(sid,courseId);
   if(!subject) throw new Error('One or more selected subjects do not belong to this course.');
   add.run(e.lastInsertRowid,sid);
  }
  return e.lastInsertRowid;
 });
 try { res.status(201).json({id:insert(),message:'Enrollment application submitted.'}); }
 catch(err){res.status(400).json({error:err.message||'Unable to submit enrollment.'});}
});
app.get('/api/student/profile',auth,(req,res)=>{
 const u=db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);res.json(publicUser(u));
});
app.put('/api/student/profile',auth,(req,res)=>{
 const {fullName}=req.body||{};
 if(!fullName?.trim()) return res.status(400).json({error:'Full name is required.'});
 db.prepare('UPDATE users SET full_name=? WHERE id=?').run(fullName.trim(),req.user.id);
 const u=db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);res.json({user:publicUser(u)});
});

app.get('/api/admin/summary',auth,adminOnly,(_req,res)=>{
 const count=t=>db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n;
 const statuses=db.prepare('SELECT status,COUNT(*) count FROM enrollments GROUP BY status').all();
 res.json({students:db.prepare("SELECT COUNT(*) n FROM users WHERE role='student'").get().n,
 courses:count('courses'),subjects:count('subjects'),enrollments:count('enrollments'),statuses});
});
app.get('/api/admin/students',auth,adminOnly,(_req,res)=>{
 res.json(db.prepare(`SELECT u.id,u.full_name fullName,u.email,u.student_number studentNumber,u.created_at createdAt,
 (SELECT COUNT(*) FROM enrollments e WHERE e.user_id=u.id) enrollments
 FROM users u WHERE role='student' ORDER BY u.id DESC`).all());
});
app.get('/api/admin/enrollments',auth,adminOnly,(_req,res)=>{
 res.json(db.prepare(`SELECT e.*,u.full_name student_name,u.email,u.student_number,c.name course_name
 FROM enrollments e JOIN users u ON u.id=e.user_id JOIN courses c ON c.id=e.course_id ORDER BY e.id DESC`).all());
});
app.patch('/api/admin/enrollments/:id/status',auth,adminOnly,(req,res)=>{
 const allowed=['Pending','Approved','Rejected'];
 if(!allowed.includes(req.body.status)) return res.status(400).json({error:'Invalid enrollment status.'});
 const result=db.prepare('UPDATE enrollments SET status=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?').run(req.body.status,req.params.id);
 if(!result.changes) return res.status(404).json({error:'Enrollment not found.'});
 res.json({message:'Enrollment status updated.'});
});
app.get('/api/admin/courses',auth,adminOnly,(_req,res)=>res.json(db.prepare('SELECT * FROM courses ORDER BY id DESC').all()));
app.post('/api/admin/courses',auth,adminOnly,(req,res)=>{
 const {code,name,description='',duration='4 years'}=req.body||{};
 if(!code?.trim()||!name?.trim()) return res.status(400).json({error:'Course code and name are required.'});
 try{const r=db.prepare('INSERT INTO courses(code,name,description,duration) VALUES(?,?,?,?)').run(code.trim().toUpperCase(),name.trim(),description,duration);res.status(201).json({id:r.lastInsertRowid});}
 catch{res.status(409).json({error:'Course code already exists.'});}
});
app.put('/api/admin/courses/:id',auth,adminOnly,(req,res)=>{
 const {code,name,description='',duration='4 years',is_active=1}=req.body||{};
 if(!code?.trim()||!name?.trim()) return res.status(400).json({error:'Course code and name are required.'});
 try{db.prepare('UPDATE courses SET code=?,name=?,description=?,duration=?,is_active=? WHERE id=?').run(code.trim().toUpperCase(),name.trim(),description,duration,is_active?1:0,req.params.id);res.json({message:'Course updated.'});}
 catch{res.status(409).json({error:'Unable to update course. Check for duplicate code.'});}
});
app.delete('/api/admin/courses/:id',auth,adminOnly,(req,res)=>{
 try{db.prepare('DELETE FROM courses WHERE id=?').run(req.params.id);res.json({message:'Course deleted.'});}
 catch{res.status(409).json({error:'This course is already used in enrollment records and cannot be deleted.'});}
});
app.get('/api/admin/courses/:id/subjects',auth,adminOnly,(req,res)=>res.json(db.prepare('SELECT * FROM subjects WHERE course_id=? ORDER BY id DESC').all(req.params.id)));
app.post('/api/admin/courses/:id/subjects',auth,adminOnly,(req,res)=>{
 const {code,name,units=3,yearLevel=1,semester='1st'}=req.body||{};
 if(!code?.trim()||!name?.trim())return res.status(400).json({error:'Subject code and name are required.'});
 try{const r=db.prepare('INSERT INTO subjects(course_id,code,name,units,year_level,semester) VALUES(?,?,?,?,?,?)').run(req.params.id,code.trim().toUpperCase(),name.trim(),units,yearLevel,semester);res.status(201).json({id:r.lastInsertRowid});}
 catch{return res.status(409).json({error:'Unable to add subject. Check course and subject code.'});}
});
app.delete('/api/admin/subjects/:id',auth,adminOnly,(req,res)=>{
 try{db.prepare('DELETE FROM subjects WHERE id=?').run(req.params.id);res.json({message:'Subject deleted.'});}
 catch{res.status(409).json({error:'Subject is already part of an enrollment and cannot be deleted.'});}
});
app.use((err,_req,res,_next)=>{console.error(err);res.status(500).json({error:'Unexpected server error.'});});
app.listen(port,()=>console.log(`School Enrollment API running at http://localhost:${port}`));
