const encoder = new TextEncoder();
const SESSION_DAYS = 30;
const SESSION_COOKIE = 'exam_session';

function json(data, status=200, extra={}) {
  return new Response(JSON.stringify(data), {status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...extra}});
}
function bad(message,status=400){return json({error:message},status)}
function cookie(name,value,maxAge){return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`}
function clearCookie(name){return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`}
function randomHex(bytes=32){const a=new Uint8Array(bytes);crypto.getRandomValues(a);return [...a].map(x=>x.toString(16).padStart(2,'0')).join('')}
function toB64(buf){let s='';for(const b of new Uint8Array(buf))s+=String.fromCharCode(b);return btoa(s).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')}
function fromB64(s){s=s.replaceAll('-','+').replaceAll('_','/');while(s.length%4)s+='=';const bin=atob(s);const a=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);return a}
function clean(v,max=10000){return String(v??'').trim().slice(0,max)}
function normalizeAttachments(value){
  const arr=Array.isArray(value)?value:[];
  return arr.slice(0,20).map(x=>{
    const url=clean(x?.url,2000),name=clean(x?.name||x?.title,200);
    const rawType=String(x?.type||'').toLowerCase();
    const type=['pdf','video','link'].includes(rawType)?rawType:(/\.pdf(?:$|[?#])/i.test(url)?'pdf':(/(youtube\.com|youtu\.be|vimeo\.com|\.mp4(?:$|[?#]))/i.test(url)?'video':'link'));
    return {name,url,type,required:x?.required===true||x?.required===1||String(x?.required||'').toLowerCase()==='true'};
  }).filter(x=>x.name&&/^https?:\/\//i.test(x.url));
}
function parseAttachments(value){
  try{return normalizeAttachments(JSON.parse(value||'[]'))}
  catch{return []}
}
function idNum(v){const n=Number(v);return Number.isInteger(n)&&n>0?n:null}
function passwordOK(v){return typeof v==='string'&&v.length>=8&&v.length<=128}
function emailOK(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)}
function phoneOK(v){return v===''||/^[+0-9][0-9 ()-]{6,19}$/.test(v)}
function educationSystem(v){v=String(v||'general').toLowerCase();return v==='azhar'?'azhar':'general'}
function cleanGrade(v){return clean(v,80)}
function normalizeStudentGrade(v){
  const raw=clean(v,80), key=raw.toLowerCase().replace(/[ًٌٍَُِّْـ]/g,'').replace(/[-_]/g,' ').replace(/\s+/g,' ').trim();
  const map={
    '1 prep':'Preparatory 1','2 prep':'Preparatory 2','3 prep':'Preparatory 3',
    'prep 1':'Preparatory 1','prep 2':'Preparatory 2','prep 3':'Preparatory 3',
    '1 preparatory':'Preparatory 1','2 preparatory':'Preparatory 2','3 preparatory':'Preparatory 3',
    '1 secondary':'Secondary 1','2 secondary':'Secondary 2','3 secondary':'Secondary 3',
    'secondary 1':'Secondary 1','secondary 2':'Secondary 2','secondary 3':'Secondary 3',
    'اولى اعدادي':'Preparatory 1','اولى اعدادى':'Preparatory 1','الأول الإعدادي':'Preparatory 1','الاول الاعدادي':'Preparatory 1',
    'تانية اعدادي':'Preparatory 2','تانية اعدادى':'Preparatory 2','الثاني الإعدادي':'Preparatory 2','الثاني الاعدادي':'Preparatory 2',
    'تالتة اعدادي':'Preparatory 3','تالتة اعدادى':'Preparatory 3','الثالث الإعدادي':'Preparatory 3','الثالث الاعدادي':'Preparatory 3',
    'اولى ثانوي':'Secondary 1','أولى ثانوي':'Secondary 1','الأول الثانوي':'Secondary 1','الاول الثانوي':'Secondary 1',
    'تانية ثانوي':'Secondary 2','ثانية ثانوي':'Secondary 2','الثاني الثانوي':'Secondary 2',
    'تالتة ثانوي':'Secondary 3','ثالثة ثانوي':'Secondary 3','الثالث الثانوي':'Secondary 3'
  };
  return map[key]||raw;
}
function resolveStudentGroup(groupValue,grade,system,env){
  const raw=clean(groupValue,80); if(!raw) return Promise.resolve(null);
  const code=system==='azhar' ? (raw.toUpperCase().endsWith('A')?raw.toUpperCase():raw+'A') : raw;
  return (async()=>{
    let g=await env.DB.prepare('SELECT id,name,grade,system FROM groups WHERE lower(name)=lower(?) AND grade=? AND system=?').bind(code,grade,system).first();
    if(!g && /^\d+$/.test(raw)) g=await env.DB.prepare('SELECT id,name,grade,system FROM groups WHERE id=? AND grade=? AND system=?').bind(Number(raw),grade,system).first();
    return g;
  })();
}
function now(){return Math.floor(Date.now()/1000)}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function studentCredentialsEmail(student,origin){
  const name=escapeHtml(student.name),phone=escapeHtml(student.phone||'Not provided'),id=escapeHtml(student.studentId),password=escapeHtml(student.password),loginUrl=`${origin}/`;
  return {subject:'Your Excam Student Account Details',html:`<!doctype html><html><body style="margin:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#172033"><div style="max-width:640px;margin:32px auto;padding:0 16px"><div style="background:#102a56;border-radius:20px 20px 0 0;padding:28px 32px;color:#fff"><div style="font-size:13px;letter-spacing:2px;text-transform:uppercase;opacity:.8">Excam</div><h1 style="margin:10px 0 0;font-size:28px">Your student account is ready</h1></div><div style="background:#fff;padding:32px;border-radius:0 0 20px 20px;box-shadow:0 8px 30px rgba(16,42,86,.08)"><p style="font-size:17px;margin-top:0">Hello <strong>${name}</strong>,</p><p style="line-height:1.7;color:#5d687c">Your Excam student account has been created. Please keep the following login details private and use them to access your exams.</p><div style="margin:24px 0;padding:20px;background:#f7f9fc;border:1px solid #e4e9f1;border-radius:14px"><div style="margin-bottom:14px"><span style="display:block;color:#7a8495;font-size:12px;text-transform:uppercase;letter-spacing:1px">Name</span><strong style="font-size:17px">${name}</strong></div><div style="margin-bottom:14px"><span style="display:block;color:#7a8495;font-size:12px;text-transform:uppercase;letter-spacing:1px">Phone</span><strong style="font-size:17px">${phone}</strong></div><div style="margin-bottom:14px"><span style="display:block;color:#7a8495;font-size:12px;text-transform:uppercase;letter-spacing:1px">Student ID</span><strong style="font-size:19px;letter-spacing:1px">${id}</strong></div><div><span style="display:block;color:#7a8495;font-size:12px;text-transform:uppercase;letter-spacing:1px">Password</span><strong style="font-size:19px;letter-spacing:1px">${password}</strong></div></div><a href="${loginUrl}" style="display:inline-block;background:#f28c28;color:#fff;text-decoration:none;padding:13px 22px;border-radius:10px;font-weight:700">Open Excam</a><p style="margin:24px 0 0;color:#7a8495;font-size:13px;line-height:1.6">For your security, do not share your Student ID or password with anyone.</p></div><p style="text-align:center;color:#98a1af;font-size:12px;padding:16px 0">Excam · Student Portal</p></div></body></html>`,text:`Hello ${student.name},\n\nYour Excam student account is ready.\n\nName: ${student.name}\nPhone: ${student.phone||'Not provided'}\nStudent ID: ${student.studentId}\nPassword: ${student.password}\n\nOpen Excam: ${loginUrl}\n\nPlease keep your login details private.`};
}
async function sendCredentialEmails(env,students,origin){
  const endpoint=String(env.GMAIL_APPS_SCRIPT_URL||'').trim(),token=String(env.GMAIL_APPS_SCRIPT_TOKEN||'').trim();
  if(!endpoint||!token)throw new Error('Gmail email service is not configured. Set GMAIL_APPS_SCRIPT_URL and GMAIL_APPS_SCRIPT_TOKEN.');
  const valid=students.filter(x=>x&&emailOK(String(x.email||''))).slice(0,100).map(x=>{const e=studentCredentialsEmail(x,origin);return {...x,subject:e.subject,html:e.html,text:e.text}});
  if(!valid.length)return [];
  const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,students:valid})});
  const raw=await r.text();
  let data={};try{data=JSON.parse(raw)}catch{}
  if(!r.ok||!data.ok)throw new Error(data.error||`Gmail service error: ${r.status}`);
  return data.sent||[];
}

function isoOrNull(v){if(v===null||v===undefined||String(v).trim()==='')return null;const t=Date.parse(String(v));return Number.isFinite(t)?new Date(t).toISOString():null}
function availabilityState(startAt,expiresAt){const t=Date.now();const s=startAt?Date.parse(startAt):NaN,e=expiresAt?Date.parse(expiresAt):NaN;if(Number.isFinite(e)&&t>=e)return 'expired';if(Number.isFinite(s)&&t<s)return 'scheduled';return 'open'}
async function hashPassword(password,saltB64){
  const salt=saltB64?fromB64(saltB64):crypto.getRandomValues(new Uint8Array(16));
  const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:100000,hash:'SHA-256'},key,256);
  return {hash:toB64(bits),salt:toB64(salt)};
}
function equalBytes(a,b){if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a[i]^b[i];return d===0}
async function verifyPassword(password,stored,salt){const x=await hashPassword(password,salt);return equalBytes(fromB64(x.hash),fromB64(stored))}
function sessionCookie(id){return cookie(SESSION_COOKIE,id,SESSION_DAYS*86400)}
function sessionId(request){return request.headers.get('cookie')?.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]+)`))?.[1]||null}
async function getSession(request,env){
  const sid=sessionId(request);if(!sid)return null;
  const row=await env.DB.prepare(`SELECT s.*,u.student_id,u.full_name,u.email,u.phone,u.status user_status,au.username,au.role,au.status admin_status FROM sessions s LEFT JOIN users u ON u.id=s.user_id LEFT JOIN admin_users au ON au.id=s.admin_user_id WHERE s.id=? AND s.expires_at>?`).bind(sid,now()).first();
  if(!row)return null;
  if((row.user_id&&row.user_status!=='active')||(row.admin_user_id&&row.admin_status!=='active'))return null;
  // Refresh active sessions on each authenticated request so students stay signed in.
  await env.DB.prepare('UPDATE sessions SET expires_at=? WHERE id=?').bind(now()+SESSION_DAYS*86400,sid).run();
  return row;
}
async function getParentSession(request,env){
  const sid=request.headers.get('cookie')?.match(/(?:^|; )parent_session=([^;]+)/)?.[1]||null;
  if(!sid)return null;
  const row=await env.DB.prepare(`SELECT ps.*,p.username,p.full_name,p.email,p.phone,p.status parent_status FROM parent_sessions ps JOIN parent_accounts p ON p.id=ps.parent_id WHERE ps.id=? AND ps.expires_at>?`).bind(sid,now()).first();
  if(!row||row.parent_status!=='active')return null;
  await env.DB.prepare('UPDATE parent_sessions SET expires_at=? WHERE id=?').bind(now()+SESSION_DAYS*86400,sid).run();
  return row;
}
function parentSessionCookie(id){return cookie('parent_session',id,SESSION_DAYS*86400)}
function clearParentCookie(){return clearCookie('parent_session')}
function parentSession(s){return !!s?.parent_id}
function userSession(s){return !!s?.user_id}
function adminSession(s){return !!s?.admin_user_id}
async function body(req){try{return await req.json()}catch{return null}}
function originOK(request){const origin=request.headers.get('Origin');if(!origin)return true;return origin===new URL(request.url).origin}
async function createSession(env,kind,id,request){
  const sid=randomHex(32);await env.DB.prepare(`INSERT INTO sessions(id,${kind==='user'?'user_id':'admin_user_id'},expires_at,created_at,user_agent) VALUES(?,?,?,?,?)`).bind(sid,id,now()+SESSION_DAYS*86400,now(),clean(request.headers.get('user-agent'),500)).run();return sid;
}
async function logout(request,env){const sid=sessionId(request);if(sid)await env.DB.prepare('DELETE FROM sessions WHERE id=?').bind(sid).run();return new Response(null,{status:204,headers:{'set-cookie':clearCookie(SESSION_COOKIE)}})}
function adminOnly(s){return adminSession(s)?null:bad('Admin authorization required',403)}
function examTargetsStudent(e,u){
  return (e.grade_level===''||e.grade_level===u.grade_level) &&
    (e.target_system==='all'||!e.target_system||e.target_system===u.education_system) &&
    (!e.target_type||e.target_type==='all'||
      (e.target_type==='grade'&&(e.target_grade===u.grade_level||e.grade_level===u.grade_level)) ||
      (e.target_type==='group'&&Number(e.target_group_id)===Number(u.group_id||0)));
}
function requiredResourcesComplete(gate,resources,opened){
  if(gate!=='required_all') return true;
  const required=resources.filter(r=>r.required!==false);
  return required.every((_,i)=>opened.has(resources.indexOf(_)));
}

function resourceTargetsStudent(r,u){
  return (r.grade_level===''||r.grade_level===u.grade_level) &&
    (r.education_system==='all'||!r.education_system||r.education_system===u.education_system) &&
    (!r.group_id || Number(r.group_id)===Number(u.group_id||0));
}
function normalizeResourceType(v){return ['video','pdf'].includes(String(v||'').toLowerCase())?String(v).toLowerCase():null}
function normalizeResourceIds(v){return Array.isArray(v)?v.map(idNum).filter(Boolean).slice(0,30):[]}

async function api(request,env){
  const url=new URL(request.url),p=url.pathname,m=request.method,s=await getSession(request,env),ps=await getParentSession(request,env);
  if(!originOK(request))return bad('Invalid request origin',403);

  if(m==='POST'&&p==='/api/setup/admin'){
    const secret=request.headers.get('x-bootstrap-secret')||'';if(!env.ADMIN_BOOTSTRAP_SECRET||secret!==env.ADMIN_BOOTSTRAP_SECRET)return bad('Forbidden',403);
    const count=await env.DB.prepare('SELECT COUNT(*) c FROM admin_users').first();if(Number(count?.c||0)>0)return bad('Admin bootstrap is already locked',409);
    const b=await body(request);const username=clean(b?.username,80).toLowerCase();if(!/^[a-z0-9._-]{3,80}$/.test(username)||!passwordOK(b?.password))return bad('Valid username and 8+ character password required');
    const ph=await hashPassword(b.password);await env.DB.prepare('INSERT INTO admin_users(username,password_hash,password_salt,role,status) VALUES(?,?,?,?,?)').bind(username,ph.hash,ph.salt,'super_admin','active').run();return json({ok:true});
  }
  if(m==='POST'&&p==='/api/auth/register'){
    return bad('Student registration is disabled. Student accounts can only be created by the teacher.',403);
    /* legacy code below is intentionally unreachable */
    const b=await body(request),name=clean(b?.fullName,120),email=clean(b?.email,160).toLowerCase(),phone=clean(b?.phone,30);if(!name||!email||!emailOK(email)||!passwordOK(b?.password)||!phoneOK(phone))return bad('Full name, valid email, valid phone and password of 8–128 characters are required');
    let studentId=clean(b?.studentId,30).toUpperCase();if(studentId&&!/^STU-[A-Z0-9]{6,12}$/.test(studentId))return bad('Student ID must look like STU-ABC123456');
    if(!studentId){for(let i=0;i<10;i++){studentId=`STU-${randomHex(5).slice(0,8).toUpperCase()}`;const x=await env.DB.prepare('SELECT id FROM users WHERE student_id=?').bind(studentId).first();if(!x)break}}
    const existing=await env.DB.prepare('SELECT id FROM users WHERE student_id=? OR email=?').bind(studentId,email).first();if(existing)return bad('Student ID or email already exists',409);
    const ph=await hashPassword(b.password),r=await env.DB.prepare('INSERT INTO users(student_id,full_name,email,phone,parent_phone,password_hash,password_salt) VALUES(?,?,?,?,?,?,?)').bind(studentId,name,email,phone,parentPhone,ph.hash,ph.salt).run();
    const sid=await createSession(env,'user',r.meta.last_row_id,request);return json({ok:true,studentId,user:{studentId,fullName:name,email,phone}},201,{'set-cookie':sessionCookie(sid)});
  }
  if(m==='POST'&&p==='/api/auth/login'){
    const b=await body(request),ident=clean(b?.identifier,160).toLowerCase();if(!ident||!passwordOK(b?.password))return bad('Identifier and password are required');
    const u=await env.DB.prepare('SELECT * FROM users WHERE lower(student_id)=? OR lower(email)=?').bind(ident,ident).first();if(!u||u.status!=='active'||!(await verifyPassword(b.password,u.password_hash,u.password_salt)))return bad('Invalid credentials',401);
    const sid=await createSession(env,'user',u.id,request);return json({ok:true,user:{studentId:u.student_id,fullName:u.full_name,email:u.email}},200,{'set-cookie':sessionCookie(sid)});
  }
  if(m==='POST'&&p==='/api/parent/login'){
    const b=await body(request),username=clean(b?.username,80).toLowerCase();if(!username||!passwordOK(b?.password))return bad('Username and password are required');
    const parent=await env.DB.prepare('SELECT * FROM parent_accounts WHERE lower(username)=?').bind(username).first();
    if(!parent||parent.status!=='active'||!(await verifyPassword(b.password,parent.password_hash,parent.password_salt)))return bad('Invalid parent credentials',401);
    const sid=randomHex(32);await env.DB.prepare('INSERT INTO parent_sessions(id,parent_id,expires_at,created_at,user_agent) VALUES(?,?,?,?,?)').bind(sid,parent.id,now()+SESSION_DAYS*86400,now(),clean(request.headers.get('user-agent'),500)).run();
    return json({ok:true,parent:{username:parent.username,fullName:parent.full_name}},200,{'set-cookie':parentSessionCookie(sid)});
  }
  if(m==='POST'&&p==='/api/admin/login'){
    const b=await body(request),username=clean(b?.username,80).toLowerCase();if(!username||!passwordOK(b?.password))return bad('Username and password are required');
    const a=await env.DB.prepare('SELECT * FROM admin_users WHERE lower(username)=?').bind(username).first();if(!a||a.status!=='active'||!(await verifyPassword(b.password,a.password_hash,a.password_salt)))return bad('Invalid admin credentials',401);
    const sid=await createSession(env,'admin',a.id,request);return json({ok:true,admin:{username:a.username,role:a.role}},200,{'set-cookie':sessionCookie(sid)});
  }
  if(m==='POST'&&p==='/api/auth/logout'){
    const sid=request.headers.get('cookie')?.match(/(?:^|; )parent_session=([^;]+)/)?.[1]||null;
    if(sid)await env.DB.prepare('DELETE FROM parent_sessions WHERE id=?').bind(sid).run();
    const base=await logout(request,env);return new Response(null,{status:204,headers:{'set-cookie':`${clearCookie(SESSION_COOKIE)}, ${clearParentCookie()}`}});
  }
  if(m==='GET'&&p==='/api/auth/me')return json({authenticated:!!s||!!ps,user:userSession(s)?{studentId:s.student_id,fullName:s.full_name,email:s.email,phone:s.phone,educationSystem:s.education_system||'general',grade:s.grade_level||'',groupId:s.group_id||null}:null,admin:adminSession(s)?{username:s.username,role:s.role}:null,parent:parentSession(ps)?{username:ps.username,fullName:ps.full_name,email:ps.email,phone:ps.phone}:null});
  if(m==='GET'&&(p.match(/^\/api\/follow\/[^/]+$/)||p.match(/^\/api\/followup\/[^/]+$/))){
    const token=clean(decodeURIComponent(p.split('/')[3]||''),200);if(!token)return bad('Invalid follow-up link',404);
    const student=await env.DB.prepare(`SELECT u.id,u.student_id,u.full_name,u.email,u.phone,u.parent_phone,u.education_system,u.grade_level,u.status,g.name group_name FROM student_followup_links l JOIN users u ON u.id=l.student_id LEFT JOIN groups g ON g.id=u.group_id WHERE l.token=? AND u.status='active'`).bind(token).first();
    if(!student)return bad('This follow-up link is invalid or no longer active',404);
    const results=await env.DB.prepare(`SELECT r.id,r.exam_id,r.score,r.total_points,r.percentage,r.passed,r.created_at,e.title FROM results r JOIN exams e ON e.id=r.exam_id WHERE r.user_id=? ORDER BY r.created_at DESC,r.id DESC`).bind(student.id).all();
    const skills=await env.DB.prepare(`SELECT COALESCE(sk.name,'Uncategorized') skill,ROUND(100.0*SUM(a.points_earned)/NULLIF(SUM(q.points),0),1) percentage,COUNT(*) questions FROM answers a JOIN questions q ON q.id=a.question_id LEFT JOIN skills sk ON sk.id=q.skill_id JOIN exam_attempts ea ON ea.id=a.attempt_id WHERE ea.user_id=? AND ea.status='submitted' GROUP BY q.skill_id ORDER BY percentage ASC`).bind(student.id).all();
    const exams=await env.DB.prepare(`SELECT e.id,e.title,e.description,e.duration_minutes,e.passing_percentage,e.available_from,e.expires_at,e.resource_gate,(SELECT COUNT(*) FROM exam_resources er JOIN learning_resources lr ON lr.id=er.resource_id WHERE er.exam_id=e.id AND er.required=1) resource_count,
      (SELECT r.id FROM results r WHERE r.exam_id=e.id AND r.user_id=? ORDER BY r.id DESC LIMIT 1) result_id,
      (SELECT r.percentage FROM results r WHERE r.exam_id=e.id AND r.user_id=? ORDER BY r.id DESC LIMIT 1) percentage,
      (SELECT r.passed FROM results r WHERE r.exam_id=e.id AND r.user_id=? ORDER BY r.id DESC LIMIT 1) passed
      FROM exams e WHERE e.status='active' AND (e.expires_at IS NULL OR e.expires_at>datetime('now'))
      AND (COALESCE(NULLIF(e.target_system,''),'all')='all' OR e.target_system=?)
      AND (e.target_type='all' OR (e.target_type='group' AND e.target_group_id=?) OR (e.target_type='grade' AND e.target_grade=?))
      ORDER BY COALESCE(e.available_from,e.created_at) DESC`).bind(student.id,student.id,student.id,student.education_system||'general',student.group_id||0,student.grade_level||'').all();
    const rr=results.results||[],stats={completed:rr.length,average:rr.length?rr.reduce((a,r)=>a+Number(r.percentage||0),0)/rr.length:0,best:rr.length?Math.max(...rr.map(r=>Number(r.percentage||0))):0,passed:rr.filter(r=>Number(r.passed)===1).length};
    return json({student,results:rr,skills:skills.results||[],exams:exams.results||[],stats});
  }

  if(m==='GET'&&p==='/api/resources'){
    if(!userSession(s))return bad('Unauthorized',401);
    const type=normalizeResourceType(url.searchParams.get('type'));
    const u=await env.DB.prepare('SELECT education_system,grade_level,group_id FROM users WHERE id=?').bind(s.user_id).first();
    if(!u)return bad('Student not found',404);
    let sql=`SELECT r.id,r.type,r.title,r.url,r.description,r.grade_level,r.education_system,r.group_id,r.created_at,
      (SELECT COUNT(*) FROM exam_resources er WHERE er.resource_id=r.id) exam_count,
      EXISTS(SELECT 1 FROM learning_resource_access la WHERE la.resource_id=r.id AND la.user_id=?) opened
      FROM learning_resources r WHERE r.status='active' AND r.grade_level=? AND (r.education_system='all' OR r.education_system=?) AND (r.group_id IS NULL OR r.group_id=?)`;
    const params=[s.user_id,u.grade_level||'',u.education_system||'general',u.group_id||0];
    if(type){sql+=' AND r.type=?';params.push(type)}
    sql+=' ORDER BY r.type,r.created_at DESC,r.id DESC';
    const rows=await env.DB.prepare(sql).bind(...params).all();
    return json(rows.results||[]);
  }
  if(m==='POST'&&p.match(/^\/api\/resources\/\d+\/open$/)){
    if(!userSession(s))return bad('Unauthorized',401);
    const resourceId=idNum(p.split('/')[3]);if(!resourceId)return bad('Invalid resource');
    const u=await env.DB.prepare('SELECT education_system,grade_level,group_id FROM users WHERE id=?').bind(s.user_id).first();
    const resource=await env.DB.prepare("SELECT * FROM learning_resources WHERE id=? AND status='active'").bind(resourceId).first();
    if(!u||!resource||!resourceTargetsStudent(resource,u))return bad('Resource is not available for this student.',403);
    await env.DB.prepare('INSERT OR IGNORE INTO learning_resource_access(resource_id,user_id,opened_at) VALUES(?,?,CURRENT_TIMESTAMP)').bind(resourceId,s.user_id).run();
    return json({ok:true,resourceId});
  }
  if(m==='POST'&&p.match(/^\/api\/exams\/\d+\/resources\/\d+\/open$/)){
    if(!userSession(s))return bad('Unauthorized',401);
    const parts=p.split('/'),examId=idNum(parts[3]),resourceId=idNum(parts[5]);
    if(!examId||!resourceId)return bad('Invalid resource');
    const exam=await env.DB.prepare(`SELECT id,grade_level,target_system,target_type,target_grade,target_group_id,resource_gate FROM exams WHERE id=? AND status='active'`).bind(examId).first();
    if(!exam)return bad('Exam not found',404);
    const u=await env.DB.prepare('SELECT education_system,grade_level,group_id FROM users WHERE id=?').bind(s.user_id).first();
    if(!u||!examTargetsStudent(exam,u))return bad('This assessment is not assigned to your academic stage/system.',403);
    const resource=await env.DB.prepare("SELECT * FROM learning_resources WHERE id=? AND status='active'").bind(resourceId).first();
    if(!resource||!resourceTargetsStudent(resource,u))return bad('Resource is not available for this student.',403);
    const link=await env.DB.prepare('SELECT sort_order,required FROM exam_resources WHERE exam_id=? AND resource_id=?').bind(examId,resourceId).first();
    if(!link)return bad('This resource is not part of the learning path.',403);
    if(exam.resource_gate==='required_all' && Number(link.required)!==0 && Number(link.sort_order)>1){
      const previous=await env.DB.prepare(`SELECT er.resource_id FROM exam_resources er WHERE er.exam_id=? AND er.required=1 AND er.sort_order<? ORDER BY er.sort_order`).bind(examId,link.sort_order).all();
      const ids=(previous.results||[]).map(x=>Number(x.resource_id));
      if(ids.length){const ph=ids.map(()=>'?').join(',');const opened=await env.DB.prepare(`SELECT resource_id FROM learning_resource_access WHERE user_id=? AND resource_id IN (${ph})`).bind(s.user_id,...ids).all();if((opened.results||[]).length!==ids.length)return bad('Complete the previous required learning resources first.',409)}
    }
    await env.DB.prepare('INSERT OR IGNORE INTO learning_resource_access(resource_id,user_id,opened_at) VALUES(?,?,CURRENT_TIMESTAMP)').bind(resourceId,s.user_id).run();
    return json({ok:true,resourceId});
  }

  if(m==='GET'&&p==='/api/exams'){
    if(!userSession(s)&&!adminSession(s))return bad('Unauthorized',401);
    let sql=`SELECT e.id,e.title,e.description,e.duration_minutes,e.passing_percentage,e.status,e.created_at,e.attachments_json,e.desktop_required,e.available_from,e.expires_at,e.grade_level,e.target_system,e.target_type,e.target_grade,e.target_group_id,e.resource_gate,(SELECT COUNT(*) FROM exam_resources er WHERE er.exam_id=e.id AND er.required=1) resource_count,(SELECT COUNT(*) FROM questions q WHERE q.exam_id=e.id) question_count FROM exams e`;
    const params=[];
    if(userSession(s)){
      const u=await env.DB.prepare('SELECT education_system,grade_level,group_id FROM users WHERE id=?').bind(s.user_id).first();
      if(!u)return bad('Student not found',404);
      sql+=` WHERE e.status='active'
        AND NOT EXISTS (SELECT 1 FROM results pr WHERE pr.exam_id=e.id AND pr.user_id=? AND pr.passed=1)
        AND (e.available_from IS NULL OR e.available_from<=datetime('now'))
        AND (e.expires_at IS NULL OR e.expires_at>datetime('now'))
        AND (e.grade_level='' OR e.grade_level=?)
        AND (COALESCE(NULLIF(e.target_system,''),'all')='all' OR e.target_system=?)
        AND (COALESCE(NULLIF(e.target_type,''),'all')='all'
          OR (e.target_type='grade' AND (e.target_grade=? OR e.grade_level=?))
          OR (e.target_type='group' AND e.target_group_id=?))`;
      params.push(s.user_id,u.grade_level||'',u.education_system||'general',u.grade_level||'',u.grade_level||'',u.group_id||0);
    }
    sql+=` ORDER BY COALESCE(e.available_from,e.created_at) DESC,e.created_at DESC`;
    const rows=await env.DB.prepare(sql).bind(...params).all();
    return json((rows.results||[]).map(e=>({...e,attachments:parseAttachments(e.attachments_json)})));
  }
  if(m==='GET'&&p.match(/^\/api\/exams\/\d+\/resources$/)){
    if(!userSession(s))return bad('Unauthorized',401);
    const id=idNum(p.split('/')[3]);
    const e=id?await env.DB.prepare(`SELECT id,title,description,grade_level,target_system,target_type,target_grade,target_group_id,resource_gate FROM exams WHERE id=? AND status='active'`).bind(id).first():null;
    if(!e)return bad('Exam not found',404);
    const u=await env.DB.prepare('SELECT education_system,grade_level,group_id FROM users WHERE id=?').bind(s.user_id).first();
    if(!u||!examTargetsStudent(e,u))return bad('This assessment is not assigned to your academic stage/system.',403);
    const rows=await env.DB.prepare(`SELECT r.id,r.type,r.title,r.url,r.description,er.sort_order,er.required
      FROM exam_resources er JOIN learning_resources r ON r.id=er.resource_id
      WHERE er.exam_id=? ORDER BY er.sort_order`).bind(id).all();
    const resources=(rows.results||[]);
    const openedRows=resources.length?await env.DB.prepare(`SELECT resource_id FROM learning_resource_access WHERE user_id=? AND resource_id IN (${resources.map(()=>'?').join(',')})`).bind(s.user_id,...resources.map(r=>r.id)).all():{results:[]};
    return json({exam:{id:e.id,title:e.title,resourceGate:e.resource_gate||'direct'},resources,opened:(openedRows.results||[]).map(x=>Number(x.resource_id))});
  }

  if(m==='GET'&&p.match(/^\/api\/exams\/\d+\/start$/)){
    if(!userSession(s))return bad('Unauthorized',401);const id=idNum(p.split('/')[3]);const e=id?await env.DB.prepare(`SELECT id,title,description,duration_minutes,passing_percentage,desktop_required,grade_level,target_system,target_type,target_grade,target_group_id,resource_gate FROM exams WHERE id=? AND status='active'`).bind(id).first():null;if(!e)return bad('Exam not found',404);
    const student=await env.DB.prepare('SELECT education_system,grade_level,group_id FROM users WHERE id=?').bind(s.user_id).first();
    if(!student)return bad('Student not found',404);
    if(!examTargetsStudent(e,student))return bad('This assessment is not assigned to your academic stage/system.',403);
    if(e.resource_gate==='required_all'){
      const required=await env.DB.prepare(`SELECT resource_id FROM exam_resources WHERE exam_id=? AND required=1 ORDER BY sort_order`).bind(id).all();
      const ids=(required.results||[]).map(x=>Number(x.resource_id));
      if(ids.length){const placeholders=ids.map(()=>'?').join(',');const opened=await env.DB.prepare(`SELECT resource_id FROM learning_resource_access WHERE user_id=? AND resource_id IN (${placeholders})`).bind(s.user_id,...ids).all();if((opened.results||[]).length!==ids.length)return json({ok:false,canEnter:false,reason:'resources_required',error:'Complete the required learning path before starting this exam.',message:'Complete the required learning path before starting this exam.'},409)}
    }
    if(Number(e.desktop_required)===1 && /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(request.headers.get('user-agent')||'')){return json({ok:false,canEnter:false,reason:'desktop_required',error:'This assessment must be taken on a desktop or laptop.',message:'This assessment must be taken on a desktop or laptop.'},409)}
    const schedule=availabilityState(e.available_from,e.expires_at);if(schedule==='scheduled')return json({ok:false,canEnter:false,reason:'not_started',error:'This assessment is not open yet.',message:'This assessment is not open yet.',availableFrom:e.available_from},409);if(schedule==='expired')return json({ok:false,canEnter:false,reason:'expired',error:'This assessment is no longer available.',message:'This assessment is no longer available.'},410)
    const previousResult=await env.DB.prepare("SELECT id,passed,percentage,created_at FROM results WHERE exam_id=? AND user_id=? ORDER BY created_at DESC,id DESC LIMIT 1").bind(id,s.user_id).first();
    if(previousResult&&Number(previousResult.passed)===1){
      return json({ok:false,canEnter:false,reason:'already_passed',error:'لا يمكن دخول الامتحان مرة أخرى لأنك اجتزت هذا الامتحان بالفعل.',message:'لا يمكن دخول الامتحان مرة أخرى لأنك اجتزت هذا الامتحان بالفعل.',result:{percentage:Number(previousResult.percentage),passed:true}},409);
    }

    let attempt=await env.DB.prepare("SELECT * FROM exam_attempts WHERE exam_id=? AND user_id=? AND status='in_progress' ORDER BY id DESC LIMIT 1").bind(id,s.user_id).first();
    if(!attempt){
      await env.DB.prepare("INSERT INTO exam_attempts(exam_id,user_id,status) VALUES(?,?, 'in_progress') ON CONFLICT(exam_id,user_id,status) DO NOTHING").bind(id,s.user_id).run();
      attempt=await env.DB.prepare("SELECT * FROM exam_attempts WHERE exam_id=? AND user_id=? AND status='in_progress' ORDER BY id DESC LIMIT 1").bind(id,s.user_id).first();
      if(!attempt)return bad('Could not create exam attempt',500);
    }
    const age=(Date.now()-Date.parse(attempt.started_at))/60000;if(age>e.duration_minutes+0.5){await env.DB.prepare("UPDATE exam_attempts SET status='expired',submitted_at=CURRENT_TIMESTAMP WHERE id=?").bind(attempt.id).run();return bad('This attempt has expired',409)}
    const qs=await env.DB.prepare('SELECT id,question_text,option_a,option_b,option_c,option_d,points,sort_order,attachments_json,skill_id,topic FROM questions WHERE exam_id=? ORDER BY sort_order,id').bind(id).all();const exam={...e};delete exam.attachments_json;const questions=(qs.results||[]).map(q=>{const x={...q,attachments:parseAttachments(q.attachments_json)};delete x.attachments_json;return x});return json({exam,attachments:[],resourceGate:e.resource_gate||'direct',attemptId:attempt.id,startedAt:attempt.started_at,questions});
  }
  if(m==='POST'&&p.match(/^\/api\/attempts\/\d+\/submit$/)){
    if(!userSession(s))return bad('Unauthorized',401);

    const id=idNum(p.split('/')[3]);
    const b=await body(request);

    if(!id||!Array.isArray(b?.answers)){
      return bad('Answers are required');
    }

    let submitStage='load attempt';
    try{
      const a=await env.DB.prepare(`SELECT a.*,e.passing_percentage,e.duration_minutes,e.title FROM exam_attempts a JOIN exams e ON e.id=a.exam_id WHERE a.id=? AND a.user_id=?`).bind(id,s.user_id).first();

      if(!a)return bad('Attempt not found',404);
      submitStage='validate attempt';

      if(a.status!=='in_progress'){
        const existing=await env.DB.prepare(`SELECT r.score,r.total_points,r.percentage,r.passed,e.title AS examTitle FROM results r JOIN exams e ON e.id=r.exam_id WHERE r.attempt_id=?`).bind(id).first();
        if(existing){
          return json({ok:true,result:{score:Number(existing.score),totalPoints:Number(existing.total_points),percentage:Number(existing.percentage),passed:Number(existing.passed),examTitle:existing.examTitle}});
        }
        return bad('Attempt already submitted',409);
      }

      const age=(Date.now()-Date.parse(a.started_at))/60000;

      if(!Number.isFinite(age))return bad('Invalid attempt start time',500);

      if(age>Number(a.duration_minutes)+0.5){
        await env.DB.prepare(`UPDATE exam_attempts SET status='expired',submitted_at=CURRENT_TIMESTAMP WHERE id=?`).bind(id).run();
        return bad('Time expired',409);
      }

      submitStage='load questions';
      const qs=(await env.DB.prepare(`SELECT * FROM questions WHERE exam_id=? ORDER BY sort_order,id`).bind(a.exam_id).all()).results||[];
      const incoming=new Map(b.answers.map(x=>[Number(x.questionId),['A','B','C','D'].includes(x.answer)?x.answer:null]));

      // Manual submission is allowed only when every question has an answer.
      // Automatic timer expiry may still submit the attempt with unanswered questions.
      if(!b.expired){
        const missing=qs.filter(q=>!incoming.get(q.id));
        if(missing.length)return json({ok:false,error:`Please answer all ${missing.length} remaining question${missing.length===1?'':'s'} before submitting.`},400);
      }

      let score=0,total=0;
      const skillTotals=new Map();
      const answerStatements=[];

      submitStage='prepare answers';
      for(const q of qs){
        const points=Number(q.points)||0;
        total+=points;
        const selected=incoming.get(q.id)||null;
        const correct=selected!==null&&selected===q.correct_answer;
        const earned=correct?points:0;
        score+=earned;
        if(q.skill_id){const key=Number(q.skill_id);const cur=skillTotals.get(key)||{points:0,earned:0,questions:0};cur.points+=points;cur.earned+=earned;cur.questions++;skillTotals.set(key,cur)}
        answerStatements.push(env.DB.prepare(`INSERT OR REPLACE INTO answers(attempt_id,question_id,selected_answer,is_correct,points_earned) VALUES(?,?,?,?,?)`).bind(id,q.id,selected,correct?1:0,earned));
      }
      submitStage='save answers';
      if(answerStatements.length)await env.DB.batch(answerStatements);

      submitStage='calculate result';
      const percentage=total>0?(score/total)*100:0;
      const passed=percentage>=Number(a.passing_percentage)?1:0;
      let skillBreakdown=[];
      if(skillTotals.size){try{const ids=[...skillTotals.keys()];const placeholders=ids.map(()=>'?').join(',');const sr=await env.DB.prepare(`SELECT id,name FROM skills WHERE id IN (${placeholders})`).bind(...ids).all();const names=new Map((sr.results||[]).map(x=>[Number(x.id),x.name]));skillBreakdown=[...skillTotals.entries()].map(([id,x])=>({skill:names.get(id)||'Skill',percentage:x.points?Number((x.earned/x.points*100).toFixed(1)):0,questions:x.questions})).sort((x,y)=>x.percentage-y.percentage)}catch(err){console.error('SKILL BREAKDOWN ERROR:',err?.message||err);skillBreakdown=[]}}

      submitStage='mark attempt submitted';
      // The original schema has UNIQUE(exam_id,user_id,status).
      // A student is allowed to retake a failed exam, so an older submitted
      // attempt can collide when the new in-progress attempt is changed to
      // submitted. Keep the result history, but move the previous attempt
      // out of the submitted state before closing the new attempt.
      const previousSubmitted=await env.DB.prepare(`SELECT id FROM exam_attempts WHERE exam_id=? AND user_id=? AND status='submitted' AND id<>? ORDER BY id DESC LIMIT 1`).bind(a.exam_id,s.user_id,id).first();
      if(previousSubmitted){
        await env.DB.prepare(`UPDATE exam_attempts SET status='expired' WHERE id=?`).bind(previousSubmitted.id).run();
      }
      await env.DB.prepare(`UPDATE exam_attempts SET status='submitted',submitted_at=CURRENT_TIMESTAMP WHERE id=?`).bind(id).run();

      submitStage='save result';
      const existingResult=await env.DB.prepare(`SELECT id FROM results WHERE attempt_id=? LIMIT 1`).bind(id).first();
      if(existingResult){
        await env.DB.prepare(`UPDATE results SET user_id=?,exam_id=?,score=?,total_points=?,percentage=?,passed=? WHERE id=?`).bind(s.user_id,a.exam_id,score,total,percentage,passed,existingResult.id).run();
      }else{
        await env.DB.prepare(`INSERT INTO results(attempt_id,user_id,exam_id,score,total_points,percentage,passed) VALUES(?,?,?,?,?,?,?)`).bind(id,s.user_id,a.exam_id,score,total,percentage,passed).run();
      }

      return json({ok:true,result:{score,totalPoints:total,percentage,passed,examTitle:a.title,examId:a.exam_id,passingPercentage:Number(a.passing_percentage),questionCount:qs.length,answeredCount:[...incoming.values()].filter(Boolean).length,submittedAt:new Date().toISOString(),skillBreakdown}});
    }catch(e){
      console.error('EXAM SUBMIT ERROR:',submitStage,e?.message||e);
      return json({error:`Exam submission failed at ${submitStage}`,details:String(e?.message||e)},500);
    }
  }

  if(m==='GET'&&p.match(/^\/api\/parent\/students\/\d+\/exams$/)){
    if(!parentSession(ps))return bad('Unauthorized',401);
    const studentId=idNum(p.split('/')[4]);if(!studentId)return bad('Invalid student');
    const linked=await env.DB.prepare('SELECT 1 FROM parent_students WHERE parent_id=? AND student_id=?').bind(ps.parent_id,studentId).first();
    if(!linked)return bad('Student is not linked to this parent',403);
    const rows=await env.DB.prepare(`SELECT e.id,e.title,e.description,e.duration_minutes,e.passing_percentage,e.status,e.available_from,e.expires_at,
      (SELECT COUNT(*) FROM questions q WHERE q.exam_id=e.id) question_count,
      r.id result_id,r.score,r.total_points,r.percentage,r.passed,r.created_at result_date
      FROM exams e JOIN users u ON u.id=? LEFT JOIN results r ON r.id=(SELECT r2.id FROM results r2 WHERE r2.exam_id=e.id AND r2.user_id=? ORDER BY r2.created_at DESC,r2.id DESC LIMIT 1)
      WHERE e.status='active' AND (e.grade_level='' OR e.grade_level=u.grade_level)
      ORDER BY COALESCE(e.available_from,e.created_at) ASC,e.created_at DESC`).bind(studentId,studentId).all();
    return json({studentId,exams:rows.results||[]});
  }
  if(m==='GET'&&p.match(/^\/api\/parent\/students\/\d+\/exams\/\d+$/)){
    if(!parentSession(ps))return bad('Unauthorized',401);
    const parts=p.split('/'),studentId=idNum(parts[4]),examId=idNum(parts[6]);if(!studentId||!examId)return bad('Invalid student or exam');
    const linked=await env.DB.prepare('SELECT 1 FROM parent_students WHERE parent_id=? AND student_id=?').bind(ps.parent_id,studentId).first();
    if(!linked)return bad('Student is not linked to this parent',403);
    const exam=await env.DB.prepare(`SELECT id,title,description,duration_minutes,passing_percentage,status,available_from,expires_at FROM exams WHERE id=? AND status='active'`).bind(examId).first();
    if(!exam)return bad('Exam not found',404);
    const qs=await env.DB.prepare(`SELECT id,question_text,option_a,option_b,option_c,option_d,points,sort_order FROM questions WHERE exam_id=? ORDER BY sort_order,id`).bind(examId).all();
    return json({exam,questions:qs.results||[]});
  }
  if(m==='GET'&&p.match(/^\/api\/parent\/students\/\d+\/teacher-chat$/)){
    if(!parentSession(ps))return bad('Unauthorized',401);
    const studentId=idNum(p.split('/')[4]);if(!studentId)return bad('Invalid student');
    const linked=await env.DB.prepare('SELECT 1 FROM parent_students WHERE parent_id=? AND student_id=?').bind(ps.parent_id,studentId).first();
    if(!linked)return bad('Student is not linked to this parent',403);
    const rows=await env.DB.prepare(`SELECT m.id,m.sender_type,m.sender_id,m.message,m.created_at,COALESCE(a.username,'') teacher_username FROM parent_teacher_messages m LEFT JOIN admin_users a ON a.id=m.teacher_id WHERE m.parent_id=? AND m.student_id=? ORDER BY m.created_at ASC,m.id ASC`).bind(ps.parent_id,studentId).all();
    return json({messages:rows.results||[]});
  }
  if(m==='POST'&&p.match(/^\/api\/parent\/students\/\d+\/teacher-chat$/)){
    if(!parentSession(ps))return bad('Unauthorized',401);
    const studentId=idNum(p.split('/')[4]),b=await body(request),message=clean(b?.message,2000);if(!studentId||!message)return bad('Message is required');
    const linked=await env.DB.prepare('SELECT 1 FROM parent_students WHERE parent_id=? AND student_id=?').bind(ps.parent_id,studentId).first();
    if(!linked)return bad('Student is not linked to this parent',403);
    const teacher=await env.DB.prepare("SELECT id FROM admin_users WHERE status='active' ORDER BY CASE WHEN role='super_admin' THEN 0 ELSE 1 END,id LIMIT 1").first();
    if(!teacher)return bad('No active teacher account is available',503);
    const r=await env.DB.prepare(`INSERT INTO parent_teacher_messages(parent_id,student_id,teacher_id,sender_type,sender_id,message) VALUES(?,?,?,?,?,?)`).bind(ps.parent_id,studentId,teacher.id,'parent',ps.parent_id,message).run();
    return json({id:r.meta.last_row_id},201);
  }

  if(m==='GET'&&p.match(/^\/api\/student\/parents$/)){
    if(!userSession(s))return bad('Unauthorized',401);
    const rows=await env.DB.prepare(`SELECT p.id,p.full_name,p.username FROM parent_students x JOIN parent_accounts p ON p.id=x.parent_id WHERE x.student_id=? AND p.status='active' ORDER BY p.full_name`).bind(s.user_id).all();
    return json(rows.results||[]);
  }

  if(m==='GET'&&p==='/api/parent/dashboard'){
    if(!parentSession(ps))return bad('Unauthorized',401);
    const links=await env.DB.prepare(`SELECT u.id,u.student_id,u.full_name,u.email,u.phone,u.grade_level,u.education_system,g.name group_name FROM parent_students x JOIN users u ON u.id=x.student_id LEFT JOIN groups g ON g.id=u.group_id WHERE x.parent_id=? AND u.status='active' ORDER BY u.full_name`).bind(ps.parent_id).all();
    const students=[];
    for(const u of (links.results||[])){
      const rr=await env.DB.prepare(`SELECT r.id,r.exam_id,r.score,r.total_points,r.percentage,r.passed,r.created_at,e.title FROM results r JOIN exams e ON e.id=r.exam_id WHERE r.user_id=? ORDER BY r.created_at DESC,r.id DESC`).bind(u.id).all();
      const sk=await env.DB.prepare(`SELECT COALESCE(s.name,'Uncategorized') skill,ROUND(100.0*SUM(a.points_earned)/NULLIF(SUM(q.points),0),1) percentage,COUNT(*) questions FROM answers a JOIN questions q ON q.id=a.question_id LEFT JOIN skills s ON s.id=q.skill_id JOIN results r ON r.attempt_id=a.attempt_id WHERE r.user_id=? GROUP BY q.skill_id ORDER BY percentage ASC`).bind(u.id).all();
      students.push({...u,results:rr.results||[],skills:sk.results||[]});
    }
    return json({parent:{username:ps.username,full_name:ps.full_name},students});
  }
  if(m==='GET'&&p==='/api/results'){
    if(!userSession(s))return bad('Unauthorized',401);const rows=await env.DB.prepare('SELECT r.*,e.title,e.passing_percentage FROM results r JOIN exams e ON e.id=r.exam_id WHERE r.user_id=? ORDER BY r.created_at DESC').bind(s.user_id).all();return json(rows.results||[]);
  }
  if(m==='GET'&&p==='/api/student/analytics'){
    if(!userSession(s))return bad('Unauthorized',401);
    const skills=await env.DB.prepare(`SELECT COALESCE(sk.name,'Uncategorized') skill,ROUND(100.0*SUM(a.points_earned)/NULLIF(SUM(q.points),0),1) percentage,COUNT(*) questions FROM answers a JOIN questions q ON q.id=a.question_id LEFT JOIN skills sk ON sk.id=q.skill_id JOIN exam_attempts ea ON ea.id=a.attempt_id WHERE ea.user_id=? AND ea.status='submitted' GROUP BY q.skill_id ORDER BY percentage ASC`).bind(s.user_id).all();
    return json({skills:skills.results||[]});
  }

  if(adminSession(s)){
    if(m==='GET'&&p==='/api/admin/stats'){
      const grade=cleanGrade(url.searchParams.get('grade'));const f=grade?` WHERE grade_level=?`:'';const eb=grade?' AND e.grade_level=?':'';
      const [u,e,a,r,p]=await Promise.all([
        grade?env.DB.prepare('SELECT COUNT(*) c FROM users WHERE grade_level=?').bind(grade).first():env.DB.prepare('SELECT COUNT(*) c FROM users').first(),
        grade?env.DB.prepare('SELECT COUNT(*) c FROM exams WHERE grade_level=?').bind(grade).first():env.DB.prepare('SELECT COUNT(*) c FROM exams').first(),
        grade?env.DB.prepare('SELECT COUNT(*) c FROM exam_attempts ea JOIN exams e ON e.id=ea.exam_id WHERE e.grade_level=?').bind(grade).first():env.DB.prepare('SELECT COUNT(*) c FROM exam_attempts').first(),
        grade?env.DB.prepare('SELECT AVG(r.percentage) avg FROM results r JOIN exams e ON e.id=r.exam_id WHERE e.grade_level=?').bind(grade).first():env.DB.prepare('SELECT AVG(percentage) avg FROM results').first(),
        grade?env.DB.prepare('SELECT COALESCE(SUM(r.passed),0) passed,COUNT(*) total FROM results r JOIN exams e ON e.id=r.exam_id WHERE e.grade_level=?').bind(grade).first():env.DB.prepare('SELECT COALESCE(SUM(passed),0) passed,COUNT(*) total FROM results').first()
      ]);return json({students:Number(u.c),exams:Number(e.c),attempts:Number(a.c),averagePercentage:Number(r.avg||0),passRate:Number(p.total?100*p.passed/p.total:0)});
    }
    if(m==='POST'&&p.match(/^\/api\/admin\/students\/\d+\/followup-link$/)){
      const id=idNum(p.split('/')[4]);if(!id)return bad('Invalid student');
      const u=await env.DB.prepare('SELECT id FROM users WHERE id=?').bind(id).first();if(!u)return bad('Student not found',404);
      let row=await env.DB.prepare('SELECT token FROM student_followup_links WHERE student_id=?').bind(id).first();
      if(!row){const token=randomHex(24);await env.DB.prepare('INSERT INTO student_followup_links(student_id,token,created_at) VALUES(?,?,CURRENT_TIMESTAMP)').bind(id,token).run();row={token}}
      return json({ok:true,url:`${url.origin}/followup?token=${encodeURIComponent(row.token)}`});
    }
    if(m==='GET'&&p==='/api/admin/students'){
      const q=clean(url.searchParams.get('q'),100),grade=cleanGrade(url.searchParams.get('grade')),like=`%${q}%`;const rows=grade?await env.DB.prepare(`SELECT u.id,u.student_id,u.full_name,u.email,u.phone,u.parent_phone,u.status,u.education_system,u.grade_level,u.group_id,u.created_at,g.name group_name FROM users u LEFT JOIN groups g ON g.id=u.group_id WHERE u.grade_level=? AND (u.student_id LIKE ? OR u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?) ORDER BY u.created_at DESC`).bind(grade,like,like,like,like).all():await env.DB.prepare(`SELECT u.id,u.student_id,u.full_name,u.email,u.phone,u.parent_phone,u.status,u.education_system,u.grade_level,u.group_id,u.created_at,g.name group_name FROM users u LEFT JOIN groups g ON g.id=u.group_id WHERE u.student_id LIKE ? OR u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ? ORDER BY u.created_at DESC`).bind(like,like,like,like).all();return json(rows.results||[]);
    }
    if(m==='POST'&&p==='/api/admin/students'){
      const b=await body(request),name=clean(b?.fullName,120),email=clean(b?.email,160).toLowerCase(),phone=clean(b?.phone,30),parentPhone=clean(b?.parentPhone,30),password=String(b?.password||''),system=educationSystem(b?.educationSystem),grade=cleanGrade(b?.grade),groupId=b?.groupId? idNum(b.groupId):null;
      if(!name||!emailOK(email)||!passwordOK(password)||!phoneOK(phone)||!phoneOK(parentPhone)||!grade)return bad('Name, valid email, valid phone, valid parent phone, grade and an 8+ character password are required');
      if(groupId){const g=await env.DB.prepare('SELECT id,grade FROM groups WHERE id=?').bind(groupId).first();if(!g)return bad('Group not found',404);if(g.grade!==grade)return bad('Student grade does not match this group',409)}
      let studentId=clean(b?.studentId,30).toUpperCase();if(studentId&&!/^STU-[A-Z0-9]{6,12}$/.test(studentId))return bad('Student ID must look like STU-ABC123456');
      if(!studentId){for(let i=0;i<10;i++){studentId=`STU-${randomHex(5).slice(0,8).toUpperCase()}`;const x=await env.DB.prepare('SELECT id FROM users WHERE student_id=?').bind(studentId).first();if(!x)break}}
      const exists=await env.DB.prepare('SELECT id FROM users WHERE student_id=? OR email=?').bind(studentId,email).first();if(exists)return bad('Student ID or email already exists',409);
      const ph=await hashPassword(password);const r=await env.DB.prepare('INSERT INTO users(student_id,full_name,email,phone,parent_phone,password_hash,password_salt,education_system,grade_level,group_id) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(studentId,name,email,phone,parentPhone,ph.hash,ph.salt,system,grade,groupId).run();return json({ok:true,id:r.meta.last_row_id,studentId},201);
    }
    if(m==='GET'&&p.match(/^\/api\/admin\/students\/\d+$/)){const id=idNum(p.split('/')[4]);if(!id)return bad('Invalid student');const u=await env.DB.prepare('SELECT u.id,u.student_id,u.full_name,u.email,u.phone,u.parent_phone,u.status,u.education_system,u.grade_level,u.group_id,u.created_at,g.name group_name FROM users u LEFT JOIN groups g ON g.id=u.group_id WHERE u.id=?').bind(id).first();if(!u)return bad('Student not found',404);const results=await env.DB.prepare('SELECT r.*,e.title FROM results r JOIN exams e ON e.id=r.exam_id WHERE r.user_id=? ORDER BY r.created_at DESC').bind(id).all();const skills=await env.DB.prepare(`SELECT COALESCE(s.name,'Uncategorized') skill,ROUND(100.0*SUM(a.points_earned)/NULLIF(SUM(q.points),0),1) percentage,COUNT(*) questions FROM answers a JOIN questions q ON q.id=a.question_id LEFT JOIN skills s ON s.id=q.skill_id JOIN exam_attempts ea ON ea.id=a.attempt_id WHERE ea.user_id=? GROUP BY q.skill_id ORDER BY percentage ASC`).bind(id).all();const link=await env.DB.prepare('SELECT token FROM student_followup_links WHERE student_id=?').bind(id).first();return json({student:u,results:results.results||[],skills:skills.results||[],followupUrl:link?`${url.origin}/followup?token=${encodeURIComponent(link.token)}`:''})}
    if(m==='POST'&&p==='/api/admin/students/send-credentials'){
      const b=await body(request),students=Array.isArray(b?.students)?b.students:[];
      if(!students.length)return bad('No students were provided');
      if(students.length>500)return bad('Maximum 500 emails per request');
      try{const sent=await sendCredentialEmails(env,students,url.origin);return json({ok:true,sentCount:sent.length,sent})}
      catch(err){return bad(err?.message||'Could not send emails',502)}
    }
    if(m==='POST'&&p==='/api/admin/students/import'){
      const b=await body(request),items=Array.isArray(b?.students)?b.students:[];if(!items.length)return bad('No students were provided');if(items.length>500)return bad('Maximum 500 students per import');
      const created=[],errors=[];
      for(let i=0;i<items.length;i++){const x=items[i]||{},name=clean(x.fullName,120),email=clean(x.email,160).toLowerCase(),phone=clean(x.phone,30),parentPhone=clean(x.parentPhone,30),system=educationSystem(x.educationSystem),grade=normalizeStudentGrade(x.grade),groupValue=clean(x.groupId,80);let password=String(x.password||'');if(!password)password=`Stu@${randomHex(5).slice(0,8)}`;
        if(!name||!emailOK(email)||!phoneOK(phone)||!phoneOK(parentPhone)||!grade||!passwordOK(password)){errors.push({row:i+2,error:'Name, valid email, valid phones, grade and password (8+ chars) are required'});continue}
        const group=groupValue?await resolveStudentGroup(groupValue,grade,system,env):null;const groupId=group?Number(group.id):null;if(groupValue&&!group){errors.push({row:i+2,error:`Group '${groupValue}' not found for ${system==='azhar'?'Azhar':'General'} · ${grade}`});continue}
        if(await env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first()){errors.push({row:i+2,email,error:'Email already exists'});continue}
        let studentId=null;for(let j=0;j<10;j++){const candidate=`STU-${randomHex(5).slice(0,8).toUpperCase()}`;if(!await env.DB.prepare('SELECT id FROM users WHERE student_id=?').bind(candidate).first()){studentId=candidate;break}}
        if(!studentId){errors.push({row:i+2,error:'Could not generate Student ID'});continue}
        try{const ph=await hashPassword(password);await env.DB.prepare('INSERT INTO users(student_id,full_name,email,phone,parent_phone,password_hash,password_salt,education_system,grade_level,group_id) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(studentId,name,email,phone,parentPhone,ph.hash,ph.salt,system,grade,groupId).run();created.push({row:i+2,studentId,name,email,password})}catch(err){errors.push({row:i+2,email,error:'Could not create student'})}
      }return json({ok:true,created,errors});
    }
    if(m==='PUT'&&p.match(/^\/api\/admin\/students\/\d+$/)){const id=idNum(p.split('/')[4]),b=await body(request);if(!id)return bad('Invalid student');const name=clean(b?.fullName,120),email=clean(b?.email,160).toLowerCase(),phone=clean(b?.phone,30),parentPhone=clean(b?.parentPhone,30),system=educationSystem(b?.educationSystem),grade=cleanGrade(b?.grade),groupId=b?.groupId? idNum(b.groupId):null;if(!name||!emailOK(email)||!phoneOK(phone)||!phoneOK(parentPhone)||!grade)return bad('Name, valid email, valid phone, valid parent phone and grade are required');if(groupId&&!await env.DB.prepare('SELECT id FROM groups WHERE id=?').bind(groupId).first())return bad('Group not found',404);const exists=await env.DB.prepare('SELECT id FROM users WHERE email=? AND id<>?').bind(email,id).first();if(exists)return bad('Email already exists',409);await env.DB.prepare('UPDATE users SET full_name=?,email=?,phone=?,parent_phone=?,education_system=?,grade_level=?,group_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(name,email,phone,parentPhone,system,grade,groupId,id).run();return json({ok:true})}
    if(m==='PATCH'&&p.match(/^\/api\/admin\/students\/\d+$/)){const id=idNum(p.split('/')[4]),b=await body(request);if(!id||!['active','blocked'].includes(b?.status))return bad('Invalid status');await env.DB.prepare('UPDATE users SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(b.status,id).run();return json({ok:true})}
    if(m==='POST'&&p.match(/^\/api\/admin\/students\/\d+\/reset-password$/)){
      const id=idNum(p.split('/')[4]),b=await body(request),newPassword=typeof b?.newPassword==='string'?b.newPassword:'';
      if(!id||!passwordOK(newPassword))return bad('Password must be 8–128 characters');
      const u=await env.DB.prepare('SELECT id FROM users WHERE id=?').bind(id).first();if(!u)return bad('Student not found',404);
      const ph=await hashPassword(newPassword);
      await env.DB.prepare('UPDATE users SET password_hash=?,password_salt=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(ph.hash,ph.salt,id).run();
      await env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(id).run();
      return json({ok:true,message:'Student password updated. Existing student sessions were signed out.'});
    }
    if(m==='POST'&&p==='/api/admin/promote'){
      const result=await env.DB.prepare(`SELECT id,grade_level FROM users`).all();
      const students=result.results||[];
      const nextGrade=g=>({'Preparatory 1':'Preparatory 2','Preparatory 2':'Preparatory 3','Preparatory 3':'Secondary 1','Secondary 1':'Secondary 2','Secondary 2':'Secondary 3'})[g]||null;
      const graduating=students.filter(u=>u.grade_level==='Secondary 3');
      if(graduating.length) await env.DB.batch(graduating.map(u=>env.DB.prepare('DELETE FROM users WHERE id=?').bind(u.id)));
      const updates=students.filter(u=>nextGrade(u.grade_level)).map(u=>env.DB.prepare(`UPDATE users SET grade_level=?,group_id=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(nextGrade(u.grade_level),u.id));
      if(updates.length) await env.DB.batch(updates);
      return json({ok:true,promoted:updates.length,deletedSecondary3:graduating.length});
    }
    if(m==='GET'&&p==='/api/admin/groups'){const grade=cleanGrade(url.searchParams.get('grade'));const rows=grade?await env.DB.prepare(`SELECT g.*,COUNT(u.id) student_count FROM groups g LEFT JOIN users u ON u.group_id=g.id WHERE g.grade=? GROUP BY g.id ORDER BY g.name`).bind(grade).all():await env.DB.prepare(`SELECT g.*,COUNT(u.id) student_count FROM groups g LEFT JOIN users u ON u.group_id=g.id GROUP BY g.id ORDER BY g.grade,g.name`).all();return json(rows.results||[])}
    if(m==='POST'&&p==='/api/admin/groups'){const b=await body(request),name=clean(b?.name,100),system=educationSystem(b?.system),grade=cleanGrade(b?.grade);if(!name||!grade)return bad('Group name and grade are required');try{const r=await env.DB.prepare('INSERT INTO groups(name,system,grade) VALUES(?,?,?)').bind(name,system,grade).run();return json({id:r.meta.last_row_id},201)}catch{return bad('This group already exists',409)}}
    if(m==='GET'&&p.match(/^\/api\/admin\/groups\/\d+$/)){const id=idNum(p.split('/')[4]);if(!id)return bad('Invalid group');const g=await env.DB.prepare('SELECT * FROM groups WHERE id=?').bind(id).first();if(!g)return bad('Group not found',404);const rows=await env.DB.prepare('SELECT id,student_id,full_name,email,phone,status,grade_level FROM users WHERE group_id=? ORDER BY full_name').bind(id).all();return json({group:g,students:rows.results||[]})}
    if(m==='PUT'&&p.match(/^\/api\/admin\/groups\/\d+$/)){const id=idNum(p.split('/')[4]),b=await body(request),name=clean(b?.name,100),system=educationSystem(b?.system),grade=cleanGrade(b?.grade);if(!id||!name||!grade)return bad('Group name and grade are required');try{await env.DB.prepare('UPDATE groups SET name=?,system=?,grade=? WHERE id=?').bind(name,system,grade,id).run();await env.DB.prepare('UPDATE users SET group_id=NULL,updated_at=CURRENT_TIMESTAMP WHERE group_id=? AND grade_level<>?').bind(id,grade).run();return json({ok:true})}catch{return bad('This group already exists',409)}}
    if(m==='DELETE'&&p.match(/^\/api\/admin\/groups\/\d+$/)){const id=idNum(p.split('/')[4]);if(!id)return bad('Invalid group');const g=await env.DB.prepare('SELECT id FROM groups WHERE id=?').bind(id).first();if(!g)return bad('Group not found',404);await env.DB.prepare('UPDATE users SET group_id=NULL,updated_at=CURRENT_TIMESTAMP WHERE group_id=?').bind(id).run();await env.DB.prepare('DELETE FROM groups WHERE id=?').bind(id).run();return json({ok:true})}
    if(m==='POST'&&p.match(/^\/api\/admin\/groups\/\d+\/students$/)){const id=idNum(p.split('/')[4]),b=await body(request),key=clean(b?.student,120).toLowerCase();if(!id||!key)return bad('Student ID or email is required');const g=await env.DB.prepare('SELECT * FROM groups WHERE id=?').bind(id).first();if(!g)return bad('Group not found',404);const u=await env.DB.prepare('SELECT id,grade_level FROM users WHERE lower(student_id)=? OR lower(email)=?').bind(key,key).first();if(!u)return bad('Student not found',404);if(u.grade_level!==g.grade)return bad('Student grade does not match this group',409);await env.DB.prepare('UPDATE users SET group_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(id,u.id).run();return json({ok:true})}
    if(m==='PATCH'&&p.match(/^\/api\/admin\/students\/\d+\/group$/)){const id=idNum(p.split('/')[4]),b=await body(request),groupId=b?.groupId? idNum(b.groupId):null;if(!id)return bad('Invalid student');if(groupId){const g=await env.DB.prepare('SELECT id,grade FROM groups WHERE id=?').bind(groupId).first();if(!g)return bad('Group not found',404);const u=await env.DB.prepare('SELECT grade_level FROM users WHERE id=?').bind(id).first();if(!u)return bad('Student not found',404);if(u.grade_level!==g.grade)return bad('Student grade does not match this group',409)}await env.DB.prepare('UPDATE users SET group_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(groupId,id).run();return json({ok:true})}
    if(m==='GET'&&p==='/api/admin/resources'){
      const type=normalizeResourceType(url.searchParams.get('type')),grade=cleanGrade(url.searchParams.get('grade'));
      let sql=`SELECT r.*,g.name group_name,(SELECT COUNT(*) FROM exam_resources er WHERE er.resource_id=r.id) exam_count FROM learning_resources r LEFT JOIN groups g ON g.id=r.group_id WHERE 1=1`,params=[];
      if(type){sql+=' AND r.type=?';params.push(type)} if(grade){sql+=' AND r.grade_level=?';params.push(grade)} sql+=' ORDER BY r.type,r.grade_level,r.created_at DESC,r.id DESC';
      const rows=await env.DB.prepare(sql).bind(...params).all();return json(rows.results||[]);
    }
    if(m==='POST'&&p==='/api/admin/resources'){
      const b=await body(request),type=normalizeResourceType(b?.type),title=clean(b?.title,200),resourceUrl=clean(b?.url,2000),description=clean(b?.description,500),grade=cleanGrade(b?.gradeLevel),system=['general','azhar','all'].includes(String(b?.educationSystem||'').toLowerCase())?String(b.educationSystem).toLowerCase():'general',groupId=b?.groupId?idNum(b.groupId):null;
      if(!type||!title||!/^https?:\/\//i.test(resourceUrl)||!grade)return bad('Type, title, valid URL and grade are required');
      if(groupId){const g=await env.DB.prepare('SELECT id,grade,system FROM groups WHERE id=?').bind(groupId).first();if(!g)return bad('Group not found',404);if(g.grade!==grade)return bad('Group grade does not match resource grade',409);if(system!=='all'&&g.system!==system)return bad('Group system does not match resource system',409)}
      const r=await env.DB.prepare('INSERT INTO learning_resources(type,title,url,description,grade_level,education_system,group_id,status,created_by) VALUES(?,?,?,?,?,?,?,?,?)').bind(type,title,resourceUrl,description,grade,system,groupId,'active',s.admin_user_id).run();return json({id:r.meta.last_row_id},201);
    }
    if(m==='PUT'&&p.match(/^\/api\/admin\/resources\/\d+$/)){
      const id=idNum(p.split('/')[4]),b=await body(request),type=normalizeResourceType(b?.type),title=clean(b?.title,200),resourceUrl=clean(b?.url,2000),description=clean(b?.description,500),grade=cleanGrade(b?.gradeLevel),system=['general','azhar','all'].includes(String(b?.educationSystem||'').toLowerCase())?String(b.educationSystem).toLowerCase():'general',groupId=b?.groupId?idNum(b.groupId):null,status=b?.status==='inactive'?'inactive':'active';
      if(!id||!type||!title||!/^https?:\/\//i.test(resourceUrl)||!grade)return bad('Invalid resource fields');
      await env.DB.prepare('UPDATE learning_resources SET type=?,title=?,url=?,description=?,grade_level=?,education_system=?,group_id=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(type,title,resourceUrl,description,grade,system,groupId,status,id).run();return json({ok:true});
    }
    if(m==='DELETE'&&p.match(/^\/api\/admin\/resources\/\d+$/)){const id=idNum(p.split('/')[4]);if(!id)return bad('Invalid resource');await env.DB.prepare('DELETE FROM learning_resources WHERE id=?').bind(id).run();return json({ok:true})}
    if(m==='GET'&&p.match(/^\/api\/admin\/exams\/\d+\/resources$/)){const id=idNum(p.split('/')[4]);if(!id)return bad('Invalid exam');const rows=await env.DB.prepare(`SELECT r.id,r.type,r.title,r.url,r.grade_level,r.education_system,er.sort_order,er.required FROM exam_resources er JOIN learning_resources r ON r.id=er.resource_id WHERE er.exam_id=? ORDER BY er.sort_order`).bind(id).all();return json(rows.results||[])}
    if(m==='PUT'&&p.match(/^\/api\/admin\/exams\/\d+\/resources$/)){const id=idNum(p.split('/')[4]),b=await body(request),ids=normalizeResourceIds(b?.resourceIds),gate=b?.resourceGate==='required_all'?'required_all':'direct';if(!id)return bad('Invalid exam');const ex=await env.DB.prepare('SELECT id,grade_level,target_system,target_type,target_grade,target_group_id FROM exams WHERE id=?').bind(id).first();if(!ex)return bad('Exam not found',404);const resources=ids.length?await env.DB.prepare(`SELECT id,grade_level,education_system,group_id FROM learning_resources WHERE id IN (${ids.map(()=>'?').join(',')})`).bind(...ids).all():{results:[]};const map=new Map((resources.results||[]).map(r=>[Number(r.id),r]));for(const rid of ids){const r=map.get(rid);if(!r)return bad('One or more selected resources no longer exist',404);if(r.grade_level!==ex.grade_level)return bad('All learning resources must match the exam grade',409);if(ex.target_system!=='all'&&r.education_system!=='all'&&r.education_system!==ex.target_system)return bad('Resource system does not match the exam system',409)}await env.DB.prepare('DELETE FROM exam_resources WHERE exam_id=?').bind(id).run();if(ids.length)await env.DB.batch(ids.map((rid,i)=>env.DB.prepare('INSERT INTO exam_resources(exam_id,resource_id,sort_order,required) VALUES(?,?,?,1)').bind(id,rid,i+1)));await env.DB.prepare('UPDATE exams SET resource_gate=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(gate,id).run();return json({ok:true,count:ids.length})}

    if(m==='GET'&&p==='/api/admin/skills'){const rows=await env.DB.prepare(`SELECT s.*,COUNT(q.id) question_count FROM skills s LEFT JOIN questions q ON q.skill_id=s.id GROUP BY s.id ORDER BY s.name`).all();return json(rows.results||[])}
    if(m==='POST'&&p==='/api/admin/skills'){const b=await body(request),name=clean(b?.name,80),description=clean(b?.description,300);if(!name)return bad('Skill name is required');try{const r=await env.DB.prepare('INSERT INTO skills(name,description) VALUES(?,?)').bind(name,description).run();return json({id:r.meta.last_row_id},201)}catch{return bad('Skill already exists',409)}}
    if(m==='GET'&&p==='/api/admin/analytics'){const grade=cleanGrade(url.searchParams.get('grade'));const groups=grade?await env.DB.prepare(`SELECT g.id,g.name,g.system,g.grade,COUNT(DISTINCT u.id) students,ROUND(AVG(r.percentage),1) average_score FROM groups g LEFT JOIN users u ON u.group_id=g.id LEFT JOIN results r ON r.user_id=u.id WHERE g.grade=? GROUP BY g.id ORDER BY g.name`).bind(grade).all():await env.DB.prepare(`SELECT g.id,g.name,g.system,g.grade,COUNT(DISTINCT u.id) students,ROUND(AVG(r.percentage),1) average_score FROM groups g LEFT JOIN users u ON u.group_id=g.id LEFT JOIN results r ON r.user_id=u.id GROUP BY g.id ORDER BY g.grade,g.name`).all();const skills=grade?await env.DB.prepare(`SELECT COALESCE(s.name,'Uncategorized') skill,ROUND(100.0*SUM(a.points_earned)/NULLIF(SUM(q.points),0),1) percentage,COUNT(DISTINCT ea.user_id) students FROM answers a JOIN questions q ON q.id=a.question_id LEFT JOIN skills s ON s.id=q.skill_id JOIN exam_attempts ea ON ea.id=a.attempt_id JOIN exams e ON e.id=ea.exam_id WHERE ea.status='submitted' AND e.grade_level=? GROUP BY q.skill_id ORDER BY percentage ASC`).bind(grade).all():await env.DB.prepare(`SELECT COALESCE(s.name,'Uncategorized') skill,ROUND(100.0*SUM(a.points_earned)/NULLIF(SUM(q.points),0),1) percentage,COUNT(DISTINCT ea.user_id) students FROM answers a JOIN questions q ON q.id=a.question_id LEFT JOIN skills s ON s.id=q.skill_id JOIN exam_attempts ea ON ea.id=a.attempt_id WHERE ea.status='submitted' GROUP BY q.skill_id ORDER BY percentage ASC`).all();return json({groups:groups.results||[],skills:skills.results||[]})}
    if(m==='GET'&&(p==='/api/admin/exams'||p==='/api/admin/exams/')){
      const grade=cleanGrade(url.searchParams.get('grade'));const rows=grade?await env.DB.prepare(`SELECT e.*, (SELECT COUNT(*) FROM exam_resources er WHERE er.exam_id=e.id AND er.required=1) resource_count, (SELECT COUNT(*) FROM questions q WHERE q.exam_id=e.id) question_count FROM exams e WHERE e.grade_level=? ORDER BY e.created_at DESC`).bind(grade).all():await env.DB.prepare(`SELECT e.*, (SELECT COUNT(*) FROM exam_resources er WHERE er.exam_id=e.id AND er.required=1) resource_count, (SELECT COUNT(*) FROM questions q WHERE q.exam_id=e.id) question_count FROM exams e ORDER BY e.created_at DESC`).all();return json(rows.results||[]);
    }
    if(m==='POST'&&(p==='/api/admin/exams'||p==='/api/admin/exams/')){
      const b=await body(request),title=clean(b?.title,200),grade=cleanGrade(b?.gradeLevel),duration=Number(b?.durationMinutes),pass=Number(b?.passingPercentage),attachments=normalizeAttachments(b?.attachments),desktopRequired=b?.desktopRequired?1:0,resourceGate=b?.resourceGate==='required_all'?'required_all':'direct',targetSystem=['general','azhar','all'].includes(String(b?.targetSystem||'').toLowerCase())?String(b.targetSystem).toLowerCase():'all',targetType=['all','grade','group'].includes(String(b?.targetType||'').toLowerCase())?String(b.targetType).toLowerCase():'all',targetGrade=cleanGrade(b?.targetGrade||grade),targetGroupId=b?.targetGroupId?idNum(b.targetGroupId):null,availableFrom=isoOrNull(b?.availableFrom),availabilityHours=b?.availabilityHours===''||b?.availabilityHours==null?null:Number(b?.availabilityHours);if(!title||!grade||!Number.isInteger(duration)||duration<1||duration>600||!Number.isFinite(pass)||pass<0||pass>100)return bad('Invalid exam fields');if(b?.availableFrom&&!availableFrom)return bad('Invalid availability start date');if(availabilityHours!==null&&(!Number.isFinite(availabilityHours)||availabilityHours<1||availabilityHours>720))return bad('Availability window must be between 1 and 720 hours');const expiresAt=availableFrom&&availabilityHours!==null?new Date(Date.parse(availableFrom)+availabilityHours*3600000).toISOString():null;const r=await env.DB.prepare('INSERT INTO exams(title,description,grade_level,duration_minutes,passing_percentage,status,created_by,attachments_json,desktop_required,available_from,expires_at,target_type,target_system,target_grade,target_group_id,resource_gate) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(title,clean(b?.description),grade,duration,pass,b?.status==='active'?'active':'inactive',s.admin_user_id,JSON.stringify(attachments),desktopRequired,availableFrom,expiresAt,targetType,targetSystem,targetGrade,targetGroupId,resourceGate).run();return json({id:r.meta.last_row_id},201);
    }
    if(m==='PUT'&&p.match(/^\/api\/admin\/exams\/(\d+)\/?$/)){const id=idNum((p.match(/^\/api\/admin\/exams\/(\d+)/)||[])[1]),b=await body(request),grade=cleanGrade(b?.gradeLevel),duration=Number(b?.durationMinutes),pass=Number(b?.passingPercentage),desktopRequired=b?.desktopRequired?1:0,resourceGate=b?.resourceGate==='required_all'?'required_all':'direct',targetSystem=['general','azhar','all'].includes(String(b?.targetSystem||'').toLowerCase())?String(b.targetSystem).toLowerCase():'all',targetType=['all','grade','group'].includes(String(b?.targetType||'').toLowerCase())?String(b.targetType).toLowerCase():'all',targetGrade=cleanGrade(b?.targetGrade||grade),targetGroupId=b?.targetGroupId?idNum(b.targetGroupId):null,availableFrom=isoOrNull(b?.availableFrom),availabilityHours=b?.availabilityHours===''||b?.availabilityHours==null?null:Number(b?.availabilityHours);if(!id||!clean(b?.title)||!grade||!Number.isInteger(duration)||duration<1||duration>600||pass<0||pass>100)return bad('Invalid exam fields');if(b?.availableFrom&&!availableFrom)return bad('Invalid availability start date');if(availabilityHours!==null&&(!Number.isFinite(availabilityHours)||availabilityHours<1||availabilityHours>720))return bad('Availability window must be between 1 and 720 hours');const expiresAt=availableFrom&&availabilityHours!==null?new Date(Date.parse(availableFrom)+availabilityHours*3600000).toISOString():null;if(Object.prototype.hasOwnProperty.call(b,'attachments')){const attachments=normalizeAttachments(b.attachments);await env.DB.prepare('UPDATE exams SET title=?,description=?,grade_level=?,duration_minutes=?,passing_percentage=?,status=?,attachments_json=?,desktop_required=?,available_from=?,expires_at=?,target_type=?,target_system=?,target_grade=?,target_group_id=?,resource_gate=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(clean(b.title,200),clean(b.description),grade,duration,pass,b.status==='active'?'active':'inactive',JSON.stringify(attachments),desktopRequired,availableFrom,expiresAt,targetType,targetSystem,targetGrade,targetGroupId,resourceGate,id).run()}else{await env.DB.prepare('UPDATE exams SET title=?,description=?,grade_level=?,duration_minutes=?,passing_percentage=?,status=?,desktop_required=?,available_from=?,expires_at=?,target_type=?,target_system=?,target_grade=?,target_group_id=?,resource_gate=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(clean(b.title,200),clean(b.description),grade,duration,pass,b.status==='active'?'active':'inactive',desktopRequired,availableFrom,expiresAt,targetType,targetSystem,targetGrade,targetGroupId,resourceGate,id).run()}return json({ok:true})}
    if(m==='DELETE'&&p.match(/^\/api\/admin\/exams\/(\d+)\/?$/)){const id=idNum((p.match(/^\/api\/admin\/exams\/(\d+)/)||[])[1]);if(!id)return bad('Invalid exam');await env.DB.prepare('DELETE FROM exams WHERE id=?').bind(id).run();return json({ok:true})}
    if(m==='GET'&&p.match(/^\/api\/admin\/exams\/\d+\/questions$/)){const id=idNum(p.split('/')[4]);if(!id)return bad('Invalid exam');const rows=await env.DB.prepare('SELECT * FROM questions WHERE exam_id=? ORDER BY sort_order,id').bind(id).all();return json((rows.results||[]).map(q=>({...q,attachments:parseAttachments(q.attachments_json)})))}
    if(m==='POST'&&p==='/api/admin/questions/bulk'){
      const b=await body(request),examId=idNum(b?.examId),items=Array.isArray(b?.questions)?b.questions:[];
      if(!examId||!items.length||items.length>200)return bad('Provide 1–200 questions');
      const exam=await env.DB.prepare('SELECT id FROM exams WHERE id=?').bind(examId).first();if(!exam)return bad('Exam not found',404);
      const statements=[];
      for(let i=0;i<items.length;i++){
        const q=items[i]||{},points=Number(q.points??1),sortOrder=Number(q.sortOrder??i+1),correct=String(q.correctAnswer||'').trim().toUpperCase(),skillName=clean(q.skill||q.skillName,80),topic=clean(q.topic,120);
        if(!clean(q.questionText)||!clean(q.optionA)||!clean(q.optionB)||!clean(q.optionC)||!clean(q.optionD)||!['A','B','C','D'].includes(correct)||!Number.isFinite(points)||points<=0||!Number.isInteger(sortOrder))return bad(`Invalid question data on row ${i+2}`);
        let skillId=null;if(skillName){const sk=await env.DB.prepare('SELECT id FROM skills WHERE lower(name)=lower(?)').bind(skillName).first();skillId=sk?.id||null;}
        statements.push(env.DB.prepare('INSERT INTO questions(exam_id,question_text,option_a,option_b,option_c,option_d,correct_answer,points,sort_order,attachments_json,skill_id,topic) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(examId,clean(q.questionText),clean(q.optionA),clean(q.optionB),clean(q.optionC),clean(q.optionD),correct,points,sortOrder,'[]',skillId,topic));
      }
      await env.DB.batch(statements);
      return json({ok:true,inserted:items.length});
    }

    if(m==='POST'&&p==='/api/admin/questions'){
      const b=await body(request),examId=idNum(b?.examId),points=Number(b?.points||1),attachments=normalizeAttachments(b?.attachments);if(!examId||!clean(b?.questionText)||!clean(b?.optionA)||!clean(b?.optionB)||!clean(b?.optionC)||!clean(b?.optionD)||!['A','B','C','D'].includes(b?.correctAnswer)||!Number.isFinite(points)||points<=0)return bad('Invalid question fields');const r=await env.DB.prepare('INSERT INTO questions(exam_id,question_text,option_a,option_b,option_c,option_d,correct_answer,points,sort_order,attachments_json,skill_id,topic) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(examId,clean(b.questionText),clean(b.optionA),clean(b.optionB),clean(b.optionC),clean(b.optionD),b.correctAnswer,points,Number(b.sortOrder||0),JSON.stringify(attachments),b.skillId?idNum(b.skillId):null,clean(b.topic,120)).run();return json({id:r.meta.last_row_id},201);
    }
    if(m==='PUT'&&p.match(/^\/api\/admin\/questions\/\d+$/)){const id=idNum(p.split('/')[4]),b=await body(request),points=Number(b?.points||1),attachments=normalizeAttachments(b?.attachments);if(!id||!clean(b?.questionText)||!['A','B','C','D'].includes(b?.correctAnswer)||points<=0)return bad('Invalid question fields');await env.DB.prepare('UPDATE questions SET question_text=?,option_a=?,option_b=?,option_c=?,option_d=?,correct_answer=?,points=?,sort_order=?,attachments_json=?,skill_id=?,topic=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(clean(b.questionText),clean(b.optionA),clean(b.optionB),clean(b.optionC),clean(b.optionD),b.correctAnswer,points,Number(b.sortOrder||0),JSON.stringify(attachments),b.skillId?idNum(b.skillId):null,clean(b.topic,120),id).run();return json({ok:true})}
    if(m==='DELETE'&&p.match(/^\/api\/admin\/questions\/\d+$/)){const id=idNum(p.split('/')[4]);if(!id)return bad('Invalid question');await env.DB.prepare('DELETE FROM questions WHERE id=?').bind(id).run();return json({ok:true})}
    if(m==='GET'&&p==='/api/admin/results'){const q=clean(url.searchParams.get('q'),100),like=`%${q}%`;const rows=await env.DB.prepare('SELECT r.*,u.student_id,u.full_name,u.email,e.title FROM results r JOIN users u ON u.id=r.user_id JOIN exams e ON e.id=r.exam_id WHERE u.student_id LIKE ? OR u.full_name LIKE ? OR u.email LIKE ? OR e.title LIKE ? ORDER BY r.created_at DESC').bind(like,like,like,like).all();return json(rows.results||[])}
    if(m==='GET'&&p.match(/^\/api\/admin\/results\/\d+$/)){const id=idNum(p.split('/')[4]);if(!id)return bad('Invalid result');const r=await env.DB.prepare('SELECT r.*,u.student_id,u.full_name,u.email,e.title,e.passing_percentage FROM results r JOIN users u ON u.id=r.user_id JOIN exams e ON e.id=r.exam_id WHERE r.id=?').bind(id).first();if(!r)return bad('Result not found',404);const answers=await env.DB.prepare('SELECT a.*,q.question_text,q.option_a,q.option_b,q.option_c,q.option_d,q.correct_answer,q.points FROM answers a JOIN questions q ON q.id=a.question_id WHERE a.attempt_id=? ORDER BY q.sort_order,q.id').bind(r.attempt_id).all();return json({result:r,answers:answers.results||[]})}
    if(m==='GET'&&p==='/api/admin/parents'){
      const grade=cleanGrade(url.searchParams.get('grade'));
      const sql=grade?`SELECT p.id,p.username,p.full_name,p.email,p.phone,p.status,p.created_at,(SELECT COUNT(*) FROM parent_students x JOIN users u2 ON u2.id=x.student_id WHERE x.parent_id=p.id) student_count FROM parent_accounts p WHERE EXISTS (SELECT 1 FROM parent_students x2 JOIN users u3 ON u3.id=x2.student_id WHERE x2.parent_id=p.id AND u3.grade_level=?) ORDER BY p.created_at DESC`:`SELECT p.id,p.username,p.full_name,p.email,p.phone,p.status,p.created_at,(SELECT COUNT(*) FROM parent_students x WHERE x.parent_id=p.id) student_count FROM parent_accounts p ORDER BY p.created_at DESC`;
      const rows=grade?await env.DB.prepare(sql).bind(grade).all():await env.DB.prepare(sql).all();return json(rows.results||[]);
    }
    if(m==='POST'&&p==='/api/admin/parents'){
      const b=await body(request),name=clean(b?.fullName,120),username=clean(b?.username,80).toLowerCase(),email=clean(b?.email,160).toLowerCase(),phone=clean(b?.phone,30),password=String(b?.password||'');
      if(!name||!/^[a-z0-9._-]{3,80}$/.test(username)||!passwordOK(password)||!phoneOK(phone)||(email&&!emailOK(email)))return bad('Invalid parent fields');
      if(await env.DB.prepare('SELECT id FROM parent_accounts WHERE username=?').bind(username).first())return bad('Username already exists',409);
      const ph=await hashPassword(password);const r=await env.DB.prepare('INSERT INTO parent_accounts(username,full_name,email,phone,password_hash,password_salt,status) VALUES(?,?,?,?,?,?,?)').bind(username,name,email,phone,ph.hash,ph.salt,'active').run();return json({id:r.meta.last_row_id},201);
    }
    if(m==='GET'&&p.match(/^\/api\/admin\/parents\/\d+$/)){
      const id=idNum(p.split('/')[4]);if(!id)return bad('Invalid parent');const parent=await env.DB.prepare('SELECT id,username,full_name,email,phone,status,created_at FROM parent_accounts WHERE id=?').bind(id).first();if(!parent)return bad('Parent not found',404);const students=await env.DB.prepare('SELECT u.id,u.student_id,u.full_name,u.email,u.phone,u.grade_level,u.education_system,g.name group_name FROM parent_students x JOIN users u ON u.id=x.student_id LEFT JOIN groups g ON g.id=u.group_id WHERE x.parent_id=? ORDER BY u.full_name').bind(id).all();return json({parent,students:students.results||[]});
    }
    if(m==='PUT'&&p.match(/^\/api\/admin\/parents\/\d+$/)){
      const id=idNum(p.split('/')[4]),b=await body(request),name=clean(b?.fullName,120),email=clean(b?.email,160).toLowerCase(),phone=clean(b?.phone,30);if(!id||!name||!phoneOK(phone)||(email&&!emailOK(email)))return bad('Invalid parent fields');const exists=email?await env.DB.prepare('SELECT id FROM parent_accounts WHERE email=? AND id<>?').bind(email,id).first():null;if(exists)return bad('Email already exists',409);await env.DB.prepare('UPDATE parent_accounts SET full_name=?,email=?,phone=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(name,email,phone,id).run();return json({ok:true});
    }
    if(m==='DELETE'&&p.match(/^\/api\/admin\/parents\/\d+$/)){
      const id=idNum(p.split('/')[4]);if(!id)return bad('Invalid parent');await env.DB.prepare('DELETE FROM parent_accounts WHERE id=?').bind(id).run();return json({ok:true});
    }
    if(m==='POST'&&p.match(/^\/api\/admin\/parents\/\d+\/students$/)){
      const id=idNum(p.split('/')[4]),b=await body(request),key=clean(b?.student,120).toLowerCase();if(!id||!key)return bad('Student ID or email is required');if(!await env.DB.prepare('SELECT id FROM parent_accounts WHERE id=?').bind(id).first())return bad('Parent not found',404);const u=await env.DB.prepare('SELECT id FROM users WHERE lower(student_id)=? OR lower(email)=?').bind(key,key).first();if(!u)return bad('Student not found',404);try{await env.DB.prepare('INSERT INTO parent_students(parent_id,student_id) VALUES(?,?)').bind(id,u.id).run()}catch{return bad('Student is already linked to this parent',409)}return json({ok:true});
    }
    if(m==='DELETE'&&p.match(/^\/api\/admin\/parents\/\d+\/students\/\d+$/)){
      const parentId=idNum(p.split('/')[4]),studentId=idNum(p.split('/')[6]);if(!parentId||!studentId)return bad('Invalid parent or student');await env.DB.prepare('DELETE FROM parent_students WHERE parent_id=? AND student_id=?').bind(parentId,studentId).run();return json({ok:true});
    }
    if(m==='GET'&&p==='/api/admin/parent-chats'){
      const rows=await env.DB.prepare(`SELECT p.id parent_id,p.full_name parent_name,u.id student_id,u.full_name student_name,u.student_id student_code,MAX(m.created_at) last_message_at,(SELECT m2.message FROM parent_teacher_messages m2 WHERE m2.parent_id=p.id AND m2.student_id=u.id ORDER BY m2.created_at DESC,m2.id DESC LIMIT 1) last_message FROM parent_teacher_messages m JOIN parent_accounts p ON p.id=m.parent_id JOIN users u ON u.id=m.student_id GROUP BY p.id,u.id ORDER BY last_message_at DESC`).all();
      return json(rows.results||[]);
    }
    if(m==='GET'&&p.match(/^\/api\/admin\/parent-chats\/\d+\/\d+$/)){
      const parts=p.split('/'),parentId=idNum(parts[4]),studentId=idNum(parts[5]);if(!parentId||!studentId)return bad('Invalid conversation');
      const rows=await env.DB.prepare(`SELECT m.id,m.sender_type,m.sender_id,m.message,m.created_at,COALESCE(a.username,'') teacher_username FROM parent_teacher_messages m LEFT JOIN admin_users a ON a.id=m.teacher_id WHERE m.parent_id=? AND m.student_id=? ORDER BY m.created_at ASC,m.id ASC`).bind(parentId,studentId).all();
      return json({messages:rows.results||[]});
    }
    if(m==='POST'&&p.match(/^\/api\/admin\/parent-chats\/\d+\/\d+$/)){
      const parts=p.split('/'),parentId=idNum(parts[4]),studentId=idNum(parts[5]),b=await body(request),message=clean(b?.message,2000);if(!parentId||!studentId||!message)return bad('Message is required');
      const linked=await env.DB.prepare('SELECT 1 FROM parent_students WHERE parent_id=? AND student_id=?').bind(parentId,studentId).first();if(!linked)return bad('Student is not linked to this parent',403);
      const r=await env.DB.prepare(`INSERT INTO parent_teacher_messages(parent_id,student_id,teacher_id,sender_type,sender_id,message) VALUES(?,?,?,?,?,?)`).bind(parentId,studentId,s.admin_user_id,'teacher',s.admin_user_id,message).run();
      return json({id:r.meta.last_row_id},201);
    }
    if(m==='GET'&&p==='/api/admin/admins'){if(s.role!=='super_admin')return bad('Super admin required',403);const rows=await env.DB.prepare('SELECT id,username,role,status,created_at FROM admin_users ORDER BY created_at DESC').all();return json(rows.results||[])}
    if(m==='POST'&&p==='/api/admin/admins'){if(s.role!=='super_admin')return bad('Super admin required',403);const b=await body(request),username=clean(b?.username,80).toLowerCase();if(!/^[a-z0-9._-]{3,80}$/.test(username)||!passwordOK(b?.password)||!['admin','super_admin'].includes(b?.role||'admin'))return bad('Invalid admin fields');const exists=await env.DB.prepare('SELECT id FROM admin_users WHERE username=?').bind(username).first();if(exists)return bad('Username already exists',409);const ph=await hashPassword(b.password);const r=await env.DB.prepare('INSERT INTO admin_users(username,password_hash,password_salt,role,status) VALUES(?,?,?,?,?)').bind(username,ph.hash,ph.salt,b.role,'active').run();return json({id:r.meta.last_row_id},201)}
    if(m==='PATCH'&&p.match(/^\/api\/admin\/admins\/\d+$/)){if(s.role!=='super_admin')return bad('Super admin required',403);const id=idNum(p.split('/')[4]),b=await body(request);if(!id||!['active','blocked'].includes(b?.status))return bad('Invalid status');await env.DB.prepare('UPDATE admin_users SET status=? WHERE id=?').bind(b.status,id).run();return json({ok:true})}
  }
  return bad('Not found',404);
}

export default {async fetch(request,env){try{const url=new URL(request.url);const path=url.pathname;if(path.startsWith('/api/'))return api(request,env);if(path==='/admin'||path==='/admin/')return env.ASSETS.fetch(new Request(new URL('/admin.html',request.url),request));if(path.startsWith('/follow/')||path==='/followup'||path==='/followup/'||path.startsWith('/followup/'))return env.ASSETS.fetch(new Request(new URL('/followup.html',request.url),request));return env.ASSETS.fetch(request)}catch(e){console.error(e);return json({error:'Internal server error'},500)}}};
