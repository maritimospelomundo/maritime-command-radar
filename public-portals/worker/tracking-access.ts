export const digest=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
export async function syncMembers(env:any, members:any[], capturedAt:string){
 if(!Array.isArray(members)||members.length>1500||!Number.isFinite(Date.parse(capturedAt))||members.some(m=>!m||typeof m.id!=='string'||m.id.length>100||!/^[a-f0-9]{64}$/.test(m.hash)))throw Error('Invalid members');
 const statements=[env.DB.prepare("INSERT INTO publications(id,data,captured_at) VALUES('tracking-members','{}',?) ON CONFLICT(id) DO UPDATE SET captured_at=excluded.captured_at WHERE excluded.captured_at > publications.captured_at").bind(capturedAt)];
 // Each mutation is conditional on the version marker, protecting against delayed syncs.
 statements.push(env.DB.prepare("DELETE FROM tracking_members WHERE EXISTS(SELECT 1 FROM publications WHERE id='tracking-members' AND captured_at=?)").bind(capturedAt));
 for(const m of members)statements.push(env.DB.prepare("INSERT INTO tracking_members(id,registration_hash) SELECT ?,? WHERE EXISTS(SELECT 1 FROM publications WHERE id='tracking-members' AND captured_at=?) ON CONFLICT(id) DO UPDATE SET registration_hash=excluded.registration_hash").bind(m.id,m.hash,capturedAt));
 await env.DB.batch(statements);
}
export async function trackingLogin(request:Request,env:any,json:any){
 if(request.method!=='POST')return json({error:'Método não permitido.'},405);
 const raw=await request.text();if(raw.length>400)return json({error:'Dados inválidos.'},400);
 let body:any;try{body=JSON.parse(raw)}catch{return json({error:'Dados inválidos.'},400)}
 const registration=typeof body.registration==='string'?body.registration.trim().toUpperCase():'';
 if(!/^[A-Z0-9.-]{1,80}$/.test(registration))return json({error:'Matrícula não autorizada.'},403);
 const now=Date.now(),bucket=Math.floor(now/900000),ip=request.headers.get('CF-Connecting-IP')||'unknown';
 const attemptId=await digest(ip+'|'+bucket);
 await env.DB.prepare('INSERT INTO tracking_attempts(id,attempts,expires_ms) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET attempts=attempts+1').bind(attemptId,(bucket+1)*900000).run();
 const attempt=await env.DB.prepare('SELECT attempts FROM tracking_attempts WHERE id=?').bind(attemptId).first();
 if(attempt.attempts>20)return json({error:'Muitas tentativas. Aguarde 15 minutos.'},429);
 const member=await env.DB.prepare('SELECT id FROM tracking_members WHERE registration_hash=?').bind(await digest(request.headers.get('Authorization')!.slice(7)+'|'+registration)).first();
 if(!member)return json({error:'Matrícula não autorizada. Confirme seu cadastro com o Comandante.'},403);
 const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
 await env.DB.batch([
 env.DB.prepare('INSERT INTO tracking_sessions(token_hash,member_id,expires_ms) VALUES(?,?,?)').bind(await digest(token),member.id,now+12*3600000),
 env.DB.prepare('INSERT INTO tracking_visits(id,member_id,visited_ms) VALUES(?,?,?)').bind(crypto.randomUUID(),member.id,now),
 env.DB.prepare('DELETE FROM tracking_sessions WHERE expires_ms<?').bind(now),
 env.DB.prepare('DELETE FROM tracking_attempts WHERE expires_ms<?').bind(now),
 env.DB.prepare('DELETE FROM tracking_visits WHERE visited_ms<?').bind(now-90*86400000)]);
 return json({token,expiresAt:new Date(now+12*3600000).toISOString()});
}
export async function trackingSession(request:Request,env:any){
 const token=request.headers.get('X-Tracking-Session')||'';if(!/^[a-f0-9]{64}$/.test(token))return false;
 return !!await env.DB.prepare('SELECT s.member_id FROM tracking_sessions s JOIN tracking_members m ON m.id=s.member_id WHERE s.token_hash=? AND s.expires_ms>?').bind(await digest(token),Date.now()).first();
}
export async function trackingStats(env:any){
 const now=Date.now();const rows=await env.DB.prepare('SELECT member_id,COUNT(*) AS visits,MIN(visited_ms) AS first_ms,MAX(visited_ms) AS last_ms,SUM(CASE WHEN visited_ms>=? THEN 1 ELSE 0 END) AS visits_7d,SUM(CASE WHEN visited_ms>=? THEN 1 ELSE 0 END) AS visits_24h FROM tracking_visits WHERE visited_ms>=? GROUP BY member_id ORDER BY last_ms DESC').bind(now-7*86400000,now-86400000,now-90*86400000).all();
 return {members:rows.results,retentionDays:90,checkedAt:new Date(now).toISOString()};
}
