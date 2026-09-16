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
  return arr.slice(0,10).map(x=>({
    name:clean(x?.name||x?.title,200),
    url:clean(x?.url,2000)
  })).filter(x=>x.name&&/^https?:\/\//i.test(x.url));
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
function now(){return Math.floor(Date.now()/1000)}
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
function userSession(s){return !!s?.user_id}
function adminSession(s){return !!s?.admin_user_id}
async function body(req){try{return await req.json()}catch{return null}}
function originOK(request){const origin=request.headers.get('Origin');if(!origin)return true;return origin===new URL(request.url).origin}
async function createSession(env,kind,id,request){
  const sid=randomHex(32);await env.DB.prepare(`INSERT INTO sessions(id,${kind==='user'?'user_id':'admin_user_id'},expires_at,created_at,user_agent) VALUES(?,?,?,?,?)`).bind(sid,id,now()+SESSION_DAYS*86400,now(),clean(request.headers.get('user-agent'),500)).run();return sid;
}
async function logout(request,env){const sid=sessionId(request);if(sid)await env.DB.prepare('DELETE FROM sessions WHERE id=?').bind(sid).run();return new Response(null,{status:204,headers:{'set-cookie':clearCookie(SESSION_COOKIE)}})}
function adminOnly(s){return adminSession(s)?null:bad('Admin authorization required',403)}

async function api(request,env){
  const url=new URL(request.url),p=url.pathname,m=request.method,s=await getSession(request,env);
  if(!originOK(request))return bad('Invalid request origin',403);

  if(m==='POST'&&p==='/api/setup/admin'){
    const secret=request.headers.get('x-bootstrap-secret')||'';if(!env.ADMIN_BOOTSTRAP_SECRET||secret!==env.ADMIN_BOOTSTRAP_SECRET)return bad('Forbidden',403);
    const count=await env.DB.prepare('SELECT COUNT(*) c FROM admin_users').first();if(Number(count?.c||0)>0)return bad('Admin bootstrap is already locked',409);
    const b=await body(request);const username=clean(b?.username,80).toLowerCase();if(!/^[a-z0-9._-]{3,80}$/.test(username)||!passwordOK(b?.password))return bad('Valid username and 8+ character password required');
    const ph=await hashPassword(b.password);await env.DB.prepare('INSERT INTO admin_users(username,password_hash,password_salt,role,status) VALUES(?,?,?,?,?)').bind(username,ph.hash,ph.salt,'super_admin','active').run();return json({ok:true});
  }
  if(m==='POST'&&p==='/api/auth/register'){
    const b=await body(request),name=clean(b?.fullName,120),email=clean(b?.email,160).toLowerCase(),phone=clean(b?.phone,30);if(!name||!email||!emailOK(email)||!passwordOK(b?.password)||!phoneOK(phone))return bad('Full name, valid email, valid phone and password of 8–128 characters are required');
    let studentId=clean(b?.studentId,30).toUpperCase();if(studentId&&!/^STU-[A-Z0-9]{6,12}$/.test(studentId))return bad('Student ID must look like STU-ABC123456');
    if(!studentId){for(let i=0;i<10;i++){studentId=`STU-${randomHex(5).slice(0,8).toUpperCase()}`;const x=await env.DB.prepare('SELECT id FROM users WHERE student_id=?').bind(studentId).first();if(!x)break}}
    const existing=await env.DB.prepare('SELECT id FROM users WHERE student_id=? OR email=?').bind(studentId,email).first();if(existing)return bad('Student ID or email already exists',409);
    const ph=await hashPassword(b.password),r=await env.DB.prepare('INSERT INTO users(student_id,full_name,email,phone,password_hash,password_salt) VALUES(?,?,?,?,?,?)').bind(studentId,name,email,phone,ph.hash,ph.salt).run();
    const sid=await createSession(env,'user',r.meta.last_row_id,request);return json({ok:true,studentId,user:{studentId,fullName:name,email,phone}},201,{'set-cookie':sessionCookie(sid)});
  }
  if(m==='POST'&&p==='/api/auth/login'){
    const b=await body(request),ident=clean(b?.identifier,160).toLowerCase();if(!ident||!passwordOK(b?.password))return bad('Identifier and password are required');
    const u=await env.DB.prepare('SELECT * FROM users WHERE lower(student_id)=? OR lower(email)=?').bind(ident,ident).first();if(!u||u.status!=='active'||!(await verifyPassword(b.password,u.password_hash,u.password_salt)))return bad('Invalid credentials',401);
    const sid=await createSession(env,'user',u.id,request);return json({ok:true,user:{studentId:u.student_id,fullName:u.full_name,email:u.email}},200,{'set-cookie':sessionCookie(sid)});
  }
  if(m==='POST'&&p==='/api/admin/login'){
    const b=await body(request),username=clean(b?.username,80).toLowerCase();if(!username||!passwordOK(b?.password))return bad('Username and password are required');
    const a=await env.DB.prepare('SELECT * FROM admin_users WHERE lower(username)=?').bind(username).first();if(!a||a.status!=='active'||!(await verifyPassword(b.password,a.password_hash,a.password_salt)))return bad('Invalid admin credentials',401);
    const sid=await createSession(env,'admin',a.id,request);return json({ok:true,admin:{username:a.username,role:a.role}},200,{'set-cookie':sessionCookie(sid)});
  }
  if(m==='POST'&&p==='/api/auth/logout')return logout(request,env);
  if(m==='GET'&&p==='/api/auth/me')return json({authenticated:!!s,user:userSession(s)?{studentId:s.student_id,fullName:s.full_name,email:s.email,phone:s.phone,educationSystem:s.education_system||'general',grade:s.grade_level||'',groupId:s.group_id||null}:null,admin:adminSession(s)?{username:s.username,role:s.role}:null});

  if(m==='GET'&&p==='/api/exams'){
    if(!userSession(s)&&!adminSession(s))return bad('Unauthorized',401);
    const rows=await env.DB.prepare(`SELECT e.id,e.title,e.description,e.duration_minutes,e.passing_percentage,e.status,e.created_at,e.attachments_json,e.desktop_required,e.available_from,e.expires_at,(SELECT COUNT(*) FROM questions q WHERE q.exam_id=e.id) question_count FROM exams e ${adminSession(s)?'':'WHERE e.status=\'active\' AND (e.expires_at IS NULL OR e.expires_at>datetime(\'now\'))'} ORDER BY COALESCE(e.available_from,e.created_at) ASC,e.created_at DESC`).all();const results=(rows.results||[]).map(e=>({...e,attachments:parseAttachments(e.attachments_json)}));return json(results);
  }
  if(m==='GET'&&p.match(/^\/api\/exams\/\d+\/start$/)){
    if(!userSession(s))return bad('Unauthorized',401);const id=idNum(p.split('/')[3]);const e=id?await env.DB.prepare('SELECT id,title,description,duration_minutes,passing_percentage,attachments_json,desktop_required FROM exams WHERE id=? AND status=\'active\'').bind(id).first():null;if(!e)return bad('Exam not found',404);
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
    const qs=await env.DB.prepare('SELECT id,question_text,option_a,option_b,option_c,option_d,points,sort_order,attachments_json,skill_id,topic FROM questions WHERE exam_id=? ORDER BY sort_order,id').bind(id).all();const exam={...e};delete exam.attachments_json;const questions=(qs.results||[]).map(q=>{const x={...q,attachments:parseAttachments(q.attachments_json)};delete x.attachments_json;return x});return json({exam,attachments:parseAttachments(e.attachments_json),attemptId:attempt.id,startedAt:attempt.started_at,questions});
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

      submitStage='save answers';
      for(const q of qs){
        const points=Number(q.points)||0;
        total+=points;
        const selected=incoming.get(q.id)||null;
        const correct=selected!==null&&selected===q.correct_answer;
        const earned=correct?points:0;
        score+=earned;
        if(q.skill_id){const key=Number(q.skill_id);const cur=skillTotals.get(key)||{points:0,earned:0,questions:0};cur.points+=points;cur.earned+=earned;cur.questions++;skillTotals.set(key,cur)}

        // Write the answer without relying on a composite UNIQUE constraint.
        // This keeps submission compatible with existing D1 databases created before
        // the latest schema was deployed.
        const updatedAnswer=await env.DB.prepare(`UPDATE answers SET selected_answer=?,is_correct=?,points_earned=? WHERE attempt_id=? AND question_id=?`).bind(selected,correct?1:0,earned,id,q.id).run();
        if(!Number(updatedAnswer.meta?.changes||0)){
          await env.DB.prepare(`INSERT INTO answers(attempt_id,question_id,selected_answer,is_correct,points_earned) VALUES(?,?,?,?,?)`).bind(id,q.id,selected,correct?1:0,earned).run();
        }
      }

      submitStage='calculate result';
      const percentage=total>0?(score/total)*100:0;
      const passed=percentage>=Number(a.passing_percentage)?1:0;
      let skillBreakdown=[];
      if(skillTotals.size){try{const ids=[...skillTotals.keys()];const placeholders=ids.map(()=>'?').join(',');const sr=await env.DB.prepare(`SELECT id,name FROM skills WHERE id IN (${placeholders})`).bind(...ids).all();const names=new Map((sr.results||[]).map(x=>[Number(x.id),x.name]));skillBreakdown=[...skillTotals.entries()].map(([id,x])=>({skill:names.get(id)||'Skill',percentage:x.points?Number((x.earned/x.points*100).toFixed(1)):0,questions:x.questions})).sort((x,y)=>x.percentage-y.percentage)}catch(err){console.error('SKILL BREAKDOWN ERROR:',err?.message||err);skillBreakdown=[]}}

      submitStage='mark attempt submitted';
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

  if(m==='GET'&&p==='/api/results'){
    if(!userSession(s))return bad('Unauthorized',401);const rows=await env.DB.prepare('SELECT r.*,e.title,e.passing_percentage FROM results r JOIN exams e ON e.id=r.exam_id WHERE r.user_id=? ORDER BY r.created_at DESC').bind(s.user_id).all();return json(rows.results||[]);
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
    if(m==='GET'&&p==='/api/admin/students'){
      const q=clean(url.searchParams.get('q'),100),grade=cleanGrade(url.searchParams.get('grade')),like=`%${q}%`;const rows=grade?await env.DB.prepare(`SELECT u.id,u.student_id,u.full_name,u.email,u.phone,u.status,u.education_system,u.grade_level,u.group_id,u.created_at,g.name group_name FROM users u LEFT JOIN groups g ON g.id=u.group_id WHERE u.grade_level=? AND (u.student_id LIKE ? OR u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?) ORDER BY u.created_at DESC`).bind(grade,like,like,like,like).all():await env.DB.prepare(`SELECT u.id,u.student_id,u.full_name,u.email,u.phone,u.status,u.education_system,u.grade_level,u.group_id,u.created_at,g.name group_name FROM users u LEFT JOIN groups g ON g.id=u.group_id WHERE u.student_id LIKE ? OR u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ? ORDER BY u.created_at DESC`).bind(like,like,like,like).all();return json(rows.results||[]);
    }
    if(m==='POST'&&p==='/api/admin/students'){
      const b=await body(request),name=clean(b?.fullName,120),email=clean(b?.email,160).toLowerCase(),phone=clean(b?.phone,30),password=String(b?.password||''),system=educationSystem(b?.educationSystem),grade=cleanGrade(b?.grade),groupId=b?.groupId? idNum(b.groupId):null;
      if(!name||!emailOK(email)||!passwordOK(password)||!phoneOK(phone)||!grade)return bad('Name, valid email, valid phone, grade and an 8+ character password are required');
      if(groupId){const g=await env.DB.prepare('SELECT id,grade FROM groups WHERE id=?').bind(groupId).first();if(!g)return bad('Group not found',404);if(g.grade!==grade)return bad('Student grade does not match this group',409)}
      let studentId=clean(b?.studentId,30).toUpperCase();if(studentId&&!/^STU-[A-Z0-9]{6,12}$/.test(studentId))return bad('Student ID must look like STU-ABC123456');
      if(!studentId){for(let i=0;i<10;i++){studentId=`STU-${randomHex(5).slice(0,8).toUpperCase()}`;const x=await env.DB.prepare('SELECT id FROM users WHERE student_id=?').bind(studentId).first();if(!x)break}}
      const exists=await env.DB.prepare('SELECT id FROM users WHERE student_id=? OR email=?').bind(studentId,email).first();if(exists)return bad('Student ID or email already exists',409);
      const ph=await hashPassword(password);const r=await env.DB.prepare('INSERT INTO users(student_id,full_name,email,phone,password_hash,password_salt,education_system,grade_level,group_id) VALUES(?,?,?,?,?,?,?,?,?)').bind(studentId,name,email,phone,ph.hash,ph.salt,system,grade,groupId).run();return json({ok:true,id:r.meta.last_row_id,studentId},201);
    }
    if(m==='GET'&&p.match(/^\/api\/admin\/students\/\d+$/)){const id=idNum(p.split('/')[4]);if(!id)return bad('Invalid student');const u=await env.DB.prepare('SELECT u.id,u.student_id,u.full_name,u.email,u.phone,u.status,u.education_system,u.grade_level,u.group_id,u.created_at,g.name group_name FROM users u LEFT JOIN groups g ON g.id=u.group_id WHERE u.id=?').bind(id).first();if(!u)return bad('Student not found',404);const results=await env.DB.prepare('SELECT r.*,e.title FROM results r JOIN exams e ON e.id=r.exam_id WHERE r.user_id=? ORDER BY r.created_at DESC').bind(id).all();const skills=await env.DB.prepare(`SELECT COALESCE(s.name,'Uncategorized') skill,ROUND(100.0*SUM(a.points_earned)/NULLIF(SUM(q.points),0),1) percentage,COUNT(*) questions FROM answers a JOIN questions q ON q.id=a.question_id LEFT JOIN skills s ON s.id=q.skill_id JOIN exam_attempts ea ON ea.id=a.attempt_id WHERE ea.user_id=? GROUP BY q.skill_id ORDER BY percentage ASC`).bind(id).all();return json({student:u,results:results.results||[],skills:skills.results||[]})}
    if(m==='PUT'&&p.match(/^\/api\/admin\/students\/\d+$/)){const id=idNum(p.split('/')[4]),b=await body(request);if(!id)return bad('Invalid student');const name=clean(b?.fullName,120),email=clean(b?.email,160).toLowerCase(),phone=clean(b?.phone,30),system=educationSystem(b?.educationSystem),grade=cleanGrade(b?.grade),groupId=b?.groupId? idNum(b.groupId):null;if(!name||!emailOK(email)||!phoneOK(phone)||!grade)return bad('Name, valid email, valid phone and grade are required');if(groupId&&!await env.DB.prepare('SELECT id FROM groups WHERE id=?').bind(groupId).first())return bad('Group not found',404);const exists=await env.DB.prepare('SELECT id FROM users WHERE email=? AND id<>?').bind(email,id).first();if(exists)return bad('Email already exists',409);await env.DB.prepare('UPDATE users SET full_name=?,email=?,phone=?,education_system=?,grade_level=?,group_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(name,email,phone,system,grade,groupId,id).run();return json({ok:true})}
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
    if(m==='GET'&&p==='/api/admin/groups'){const grade=cleanGrade(url.searchParams.get('grade'));const rows=grade?await env.DB.prepare(`SELECT g.*,COUNT(u.id) student_count FROM groups g LEFT JOIN users u ON u.group_id=g.id WHERE g.grade=? GROUP BY g.id ORDER BY g.name`).bind(grade).all():await env.DB.prepare(`SELECT g.*,COUNT(u.id) student_count FROM groups g LEFT JOIN users u ON u.group_id=g.id GROUP BY g.id ORDER BY g.grade,g.name`).all();return json(rows.results||[])}
    if(m==='POST'&&p==='/api/admin/groups'){const b=await body(request),name=clean(b?.name,100),system=educationSystem(b?.system),grade=cleanGrade(b?.grade);if(!name||!grade)return bad('Group name and grade are required');try{const r=await env.DB.prepare('INSERT INTO groups(name,system,grade) VALUES(?,?,?)').bind(name,system,grade).run();return json({id:r.meta.last_row_id},201)}catch{return bad('This group already exists',409)}}
    if(m==='GET'&&p.match(/^\/api\/admin\/groups\/\d+$/)){const id=idNum(p.split('/')[4]);if(!id)return bad('Invalid group');const g=await env.DB.prepare('SELECT * FROM groups WHERE id=?').bind(id).first();if(!g)return bad('Group not found',404);const rows=await env.DB.prepare('SELECT id,student_id,full_name,email,phone,status,grade_level FROM users WHERE group_id=? ORDER BY full_name').bind(id).all();return json({group:g,students:rows.results||[]})}
    if(m==='PUT'&&p.match(/^\/api\/admin\/groups\/\d+$/)){const id=idNum(p.split('/')[4]),b=await body(request),name=clean(b?.name,100),system=educationSystem(b?.system),grade=cleanGrade(b?.grade);if(!id||!name||!grade)return bad('Group name and grade are required');try{await env.DB.prepare('UPDATE groups SET name=?,system=?,grade=? WHERE id=?').bind(name,system,grade,id).run();await env.DB.prepare('UPDATE users SET group_id=NULL,updated_at=CURRENT_TIMESTAMP WHERE group_id=? AND grade_level<>?').bind(id,grade).run();return json({ok:true})}catch{return bad('This group already exists',409)}}
    if(m==='DELETE'&&p.match(/^\/api\/admin\/groups\/\d+$/)){const id=idNum(p.split('/')[4]);if(!id)return bad('Invalid group');const g=await env.DB.prepare('SELECT id FROM groups WHERE id=?').bind(id).first();if(!g)return bad('Group not found',404);await env.DB.prepare('UPDATE users SET group_id=NULL,updated_at=CURRENT_TIMESTAMP WHERE group_id=?').bind(id).run();await env.DB.prepare('DELETE FROM groups WHERE id=?').bind(id).run();return json({ok:true})}
    if(m==='POST'&&p.match(/^\/api\/admin\/groups\/\d+\/students$/)){const id=idNum(p.split('/')[4]),b=await body(request),key=clean(b?.student,120).toLowerCase();if(!id||!key)return bad('Student ID or email is required');const g=await env.DB.prepare('SELECT * FROM groups WHERE id=?').bind(id).first();if(!g)return bad('Group not found',404);const u=await env.DB.prepare('SELECT id,grade_level FROM users WHERE lower(student_id)=? OR lower(email)=?').bind(key,key).first();if(!u)return bad('Student not found',404);if(u.grade_level!==g.grade)return bad('Student grade does not match this group',409);await env.DB.prepare('UPDATE users SET group_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(id,u.id).run();return json({ok:true})}
    if(m==='PATCH'&&p.match(/^\/api\/admin\/students\/\d+\/group$/)){const id=idNum(p.split('/')[4]),b=await body(request),groupId=b?.groupId? idNum(b.groupId):null;if(!id)return bad('Invalid student');if(groupId){const g=await env.DB.prepare('SELECT id,grade FROM groups WHERE id=?').bind(groupId).first();if(!g)return bad('Group not found',404);const u=await env.DB.prepare('SELECT grade_level FROM users WHERE id=?').bind(id).first();if(!u)return bad('Student not found',404);if(u.grade_level!==g.grade)return bad('Student grade does not match this group',409)}await env.DB.prepare('UPDATE users SET group_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(groupId,id).run();return json({ok:true})}
    if(m==='GET'&&p==='/api/admin/skills'){const rows=await env.DB.prepare(`SELECT s.*,COUNT(q.id) question_count FROM skills s LEFT JOIN questions q ON q.skill_id=s.id GROUP BY s.id ORDER BY s.name`).all();return json(rows.results||[])}
    if(m==='POST'&&p==='/api/admin/skills'){const b=await body(request),name=clean(b?.name,80),description=clean(b?.description,300);if(!name)return bad('Skill name is required');try{const r=await env.DB.prepare('INSERT INTO skills(name,description) VALUES(?,?)').bind(name,description).run();return json({id:r.meta.last_row_id},201)}catch{return bad('Skill already exists',409)}}
    if(m==='GET'&&p==='/api/admin/analytics'){const grade=cleanGrade(url.searchParams.get('grade'));const groups=grade?await env.DB.prepare(`SELECT g.id,g.name,g.system,g.grade,COUNT(DISTINCT u.id) students,ROUND(AVG(r.percentage),1) average_score FROM groups g LEFT JOIN users u ON u.group_id=g.id LEFT JOIN results r ON r.user_id=u.id WHERE g.grade=? GROUP BY g.id ORDER BY g.name`).bind(grade).all():await env.DB.prepare(`SELECT g.id,g.name,g.system,g.grade,COUNT(DISTINCT u.id) students,ROUND(AVG(r.percentage),1) average_score FROM groups g LEFT JOIN users u ON u.group_id=g.id LEFT JOIN results r ON r.user_id=u.id GROUP BY g.id ORDER BY g.grade,g.name`).all();const skills=grade?await env.DB.prepare(`SELECT COALESCE(s.name,'Uncategorized') skill,ROUND(100.0*SUM(a.points_earned)/NULLIF(SUM(q.points),0),1) percentage,COUNT(DISTINCT ea.user_id) students FROM answers a JOIN questions q ON q.id=a.question_id LEFT JOIN skills s ON s.id=q.skill_id JOIN exam_attempts ea ON ea.id=a.attempt_id JOIN exams e ON e.id=ea.exam_id WHERE ea.status='submitted' AND e.grade_level=? GROUP BY q.skill_id ORDER BY percentage ASC`).bind(grade).all():await env.DB.prepare(`SELECT COALESCE(s.name,'Uncategorized') skill,ROUND(100.0*SUM(a.points_earned)/NULLIF(SUM(q.points),0),1) percentage,COUNT(DISTINCT ea.user_id) students FROM answers a JOIN questions q ON q.id=a.question_id LEFT JOIN skills s ON s.id=q.skill_id JOIN exam_attempts ea ON ea.id=a.attempt_id WHERE ea.status='submitted' GROUP BY q.skill_id ORDER BY percentage ASC`).all();return json({groups:groups.results||[],skills:skills.results||[]})}
    if(m==='GET'&&(p==='/api/admin/exams'||p==='/api/admin/exams/')){
      const grade=cleanGrade(url.searchParams.get('grade'));const rows=grade?await env.DB.prepare(`SELECT e.*, (SELECT COUNT(*) FROM questions q WHERE q.exam_id=e.id) question_count FROM exams e WHERE e.grade_level=? ORDER BY e.created_at DESC`).bind(grade).all():await env.DB.prepare(`SELECT e.*, (SELECT COUNT(*) FROM questions q WHERE q.exam_id=e.id) question_count FROM exams e ORDER BY e.created_at DESC`).all();return json(rows.results||[]);
    }
    if(m==='POST'&&(p==='/api/admin/exams'||p==='/api/admin/exams/')){
      const b=await body(request),title=clean(b?.title,200),grade=cleanGrade(b?.gradeLevel),duration=Number(b?.durationMinutes),pass=Number(b?.passingPercentage),attachments=normalizeAttachments(b?.attachments),desktopRequired=b?.desktopRequired?1:0,availableFrom=isoOrNull(b?.availableFrom),availabilityHours=b?.availabilityHours===''||b?.availabilityHours==null?null:Number(b?.availabilityHours);if(!title||!grade||!Number.isInteger(duration)||duration<1||duration>600||!Number.isFinite(pass)||pass<0||pass>100)return bad('Invalid exam fields');if(b?.availableFrom&&!availableFrom)return bad('Invalid availability start date');if(availabilityHours!==null&&(!Number.isFinite(availabilityHours)||availabilityHours<1||availabilityHours>720))return bad('Availability window must be between 1 and 720 hours');const expiresAt=availableFrom&&availabilityHours!==null?new Date(Date.parse(availableFrom)+availabilityHours*3600000).toISOString():null;const r=await env.DB.prepare('INSERT INTO exams(title,description,grade_level,duration_minutes,passing_percentage,status,created_by,attachments_json,desktop_required,available_from,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(title,clean(b?.description),grade,duration,pass,b?.status==='active'?'active':'inactive',s.admin_user_id,JSON.stringify(attachments),desktopRequired,availableFrom,expiresAt).run();return json({id:r.meta.last_row_id},201);
    }
    if(m==='PUT'&&p.match(/^\/api\/admin\/exams\/(\d+)\/?$/)){const id=idNum((p.match(/^\/api\/admin\/exams\/(\d+)/)||[])[1]),b=await body(request),grade=cleanGrade(b?.gradeLevel),duration=Number(b?.durationMinutes),pass=Number(b?.passingPercentage),desktopRequired=b?.desktopRequired?1:0,availableFrom=isoOrNull(b?.availableFrom),availabilityHours=b?.availabilityHours===''||b?.availabilityHours==null?null:Number(b?.availabilityHours);if(!id||!clean(b?.title)||!grade||!Number.isInteger(duration)||duration<1||duration>600||pass<0||pass>100)return bad('Invalid exam fields');if(b?.availableFrom&&!availableFrom)return bad('Invalid availability start date');if(availabilityHours!==null&&(!Number.isFinite(availabilityHours)||availabilityHours<1||availabilityHours>720))return bad('Availability window must be between 1 and 720 hours');const expiresAt=availableFrom&&availabilityHours!==null?new Date(Date.parse(availableFrom)+availabilityHours*3600000).toISOString():null;if(Object.prototype.hasOwnProperty.call(b,'attachments')){const attachments=normalizeAttachments(b.attachments);await env.DB.prepare('UPDATE exams SET title=?,description=?,grade_level=?,duration_minutes=?,passing_percentage=?,status=?,attachments_json=?,desktop_required=?,available_from=?,expires_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(clean(b.title,200),clean(b.description),grade,duration,pass,b.status==='active'?'active':'inactive',JSON.stringify(attachments),desktopRequired,availableFrom,expiresAt,id).run()}else{await env.DB.prepare('UPDATE exams SET title=?,description=?,grade_level=?,duration_minutes=?,passing_percentage=?,status=?,desktop_required=?,available_from=?,expires_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(clean(b.title,200),clean(b.description),grade,duration,pass,b.status==='active'?'active':'inactive',desktopRequired,availableFrom,expiresAt,id).run()}return json({ok:true})}
    if(m==='DELETE'&&p.match(/^\/api\/admin\/exams\/(\d+)\/?$/)){const id=idNum((p.match(/^\/api\/admin\/exams\/(\d+)/)||[])[1]);if(!id)return bad('Invalid exam');await env.DB.prepare('DELETE FROM exams WHERE id=?').bind(id).run();return json({ok:true})}
    if(m==='GET'&&p.match(/^\/api\/admin\/exams\/\d+\/questions$/)){const id=idNum(p.split('/')[4]);if(!id)return bad('Invalid exam');const rows=await env.DB.prepare('SELECT * FROM questions WHERE exam_id=? ORDER BY sort_order,id').bind(id).all();return json((rows.results||[]).map(q=>({...q,attachments:parseAttachments(q.attachments_json)})))}
    if(m==='POST'&&p==='/api/admin/questions/bulk'){
      const b=await body(request),examId=idNum(b?.examId),items=Array.isArray(b?.questions)?b.questions:[];
      if(!examId||!items.length||items.length>200)return bad('Provide 1–200 questions');
      const exam=await env.DB.prepare('SELECT id FROM exams WHERE id=?').bind(examId).first();if(!exam)return bad('Exam not found',404);
      const statements=[];
      for(let i=0;i<items.length;i++){
        const q=items[i]||{},points=Number(q.points??1),sortOrder=Number(q.sortOrder??i+1),correct=String(q.correctAnswer||'').trim().toUpperCase();
        if(!clean(q.questionText)||!clean(q.optionA)||!clean(q.optionB)||!clean(q.optionC)||!clean(q.optionD)||!['A','B','C','D'].includes(correct)||!Number.isFinite(points)||points<=0||!Number.isInteger(sortOrder))return bad(`Invalid question data on row ${i+2}`);
        statements.push(env.DB.prepare('INSERT INTO questions(exam_id,question_text,option_a,option_b,option_c,option_d,correct_answer,points,sort_order,attachments_json) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(examId,clean(q.questionText),clean(q.optionA),clean(q.optionB),clean(q.optionC),clean(q.optionD),correct,points,sortOrder,'[]'));
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
    if(m==='GET'&&p==='/api/admin/admins'){if(s.role!=='super_admin')return bad('Super admin required',403);const rows=await env.DB.prepare('SELECT id,username,role,status,created_at FROM admin_users ORDER BY created_at DESC').all();return json(rows.results||[])}
    if(m==='POST'&&p==='/api/admin/admins'){if(s.role!=='super_admin')return bad('Super admin required',403);const b=await body(request),username=clean(b?.username,80).toLowerCase();if(!/^[a-z0-9._-]{3,80}$/.test(username)||!passwordOK(b?.password)||!['admin','super_admin'].includes(b?.role||'admin'))return bad('Invalid admin fields');const exists=await env.DB.prepare('SELECT id FROM admin_users WHERE username=?').bind(username).first();if(exists)return bad('Username already exists',409);const ph=await hashPassword(b.password);const r=await env.DB.prepare('INSERT INTO admin_users(username,password_hash,password_salt,role,status) VALUES(?,?,?,?,?)').bind(username,ph.hash,ph.salt,b.role,'active').run();return json({id:r.meta.last_row_id},201)}
    if(m==='PATCH'&&p.match(/^\/api\/admin\/admins\/\d+$/)){if(s.role!=='super_admin')return bad('Super admin required',403);const id=idNum(p.split('/')[4]),b=await body(request);if(!id||!['active','blocked'].includes(b?.status))return bad('Invalid status');await env.DB.prepare('UPDATE admin_users SET status=? WHERE id=?').bind(b.status,id).run();return json({ok:true})}
  }
  return bad('Not found',404);
}

export default {async fetch(request,env){try{const url=new URL(request.url);const path=url.pathname;if(path.startsWith('/api/'))return api(request,env);if(path==='/admin'||path==='/admin/')return env.ASSETS.fetch(new Request(new URL('/admin.html',request.url),request));return env.ASSETS.fetch(request)}catch(e){console.error(e);return json({error:'Internal server error'},500)}}};
