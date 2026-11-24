
import jwt from 'jsonwebtoken';
export function signToken(user) {
 return jwt.sign({ id:user.id, role:user.role, email:user.email }, process.env.JWT_SECRET || 'dev-only-change-me', { expiresIn:'8h' });
}
export function auth(req,res,next) {
 const token = (req.headers.authorization || '').replace(/^Bearer\s+/i,'');
 if (!token) return res.status(401).json({error:'Please log in first.'});
 try { req.user = jwt.verify(token, process.env.JWT_SECRET || 'dev-only-change-me'); next(); }
 catch { return res.status(401).json({error:'Session expired. Please log in again.'}); }
}
export function adminOnly(req,res,next) {
 if (req.user?.role !== 'admin') return res.status(403).json({error:'Administrator access required.'});
 next();
}
