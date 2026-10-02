import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { Store } from '../src/store.mjs';
import { createApp } from '../src/app.mjs';
import { configFromEnv } from '../src/config.mjs';
import { makeModerator, makeMailer } from '../src/services.mjs';
const profile = { name:'Asha', dob:'2000-01-01', city:'Pune', gender:'Woman', seeking:['Man'], minAge:22,maxAge:35, localOnly:true,children:'Undecided',smoking:'No',noSmoking:true };
const card = {about:'I enjoy books and quiet weekends with good company.',values:['Kindness','Honesty'],interests:['Books','Coffee'],communication:'Talk it through'};
async function fixture(t, options={}) {
 const store = new Store(':memory:',randomBytes(32).toString('base64')); const mail=[];
 const {server}=createApp({store,inviteCode:'test-invitation-123456',registrationMode:'open',requireVerification:true,allowedOrigin:'https://raabta.test',
 ai:{chat:async()=>({reply:'What do you value in a relationship?',memory:'Enjoys books.'}),draft:async()=>card},mailer:async m=>mail.push(m),...options});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}`;
 t.after(async()=>{await new Promise(r=>server.close(r));store.close();});
 const api=async(path,method='GET',body,token)=>{const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});return{status:r.status,body:await r.json()};};
 async function register(handle='asha',p=profile) {const r=await api('/auth/register','POST',{handle,password:'correct-horse-2026',email:handle+'@example.test',profile:p,adultConsent:true,termsConsent:true,aiConsent:true});assert.equal(r.status,200);return r.body;}
 async function verify(u) {assert.equal((await api('/auth/verify/send','POST',{},u.token)).status,200);assert.equal((await api('/auth/verify','POST',{code:mail.at(-1).code},u.token)).status,200);}
 async function mature(u) {for(let d=1;d<=7;d++)for(let n=0;n<2;n++)store.run('INSERT INTO turns(user_id,role,body,day,created,request_id) VALUES(?,?,?,?,?,?)',u.user.id,'user',store.seal('I care about kindness and honesty and enjoy a quiet evening reading a good book.'),`2026-09-${d}`,new Date().toISOString(),randomUUID());assert.equal((await api('/profile/approve','POST',{card,consent:true},u.token)).status,200);}
 return {api,register,verify,mature,mail,store,base};
}
test('verified email gates AI and matching; challenge is hashed and single-use',async t=>{
 const f=await fixture(t),u=await f.register();
 assert.equal((await f.api('/ai/chat','POST',{message:'Hello there',requestId:randomUUID()},u.token)).status,403);
 await f.api('/auth/verify/send','POST',{},u.token);const code=f.mail.at(-1).code;
 assert.notEqual(f.store.get('SELECT token FROM challenges').token,code);
 assert.equal((await f.api('/auth/verify','POST',{code:'00000000'},u.token)).status,400);
 assert.equal((await f.api('/auth/verify','POST',{code},u.token)).status,200);
 assert.equal((await f.api('/auth/verify','POST',{code},u.token)).status,400);
 assert.equal((await f.api('/ai/chat','POST',{message:'Hello there',requestId:randomUUID()},u.token)).status,200);
 assert.equal(f.store.get('SELECT count(*) AS n FROM consent_events').n,2);
});
test('codes expire and lock after five failed attempts',async t=>{
 const f=await fixture(t),u=await f.register();await f.api('/auth/verify/send','POST',{},u.token);const code=f.mail.at(-1).code;
 for(let i=0;i<5;i++)assert.equal((await f.api('/auth/verify','POST',{code:'00000000'},u.token)).status,400);
 assert.equal((await f.api('/auth/verify','POST',{code},u.token)).status,400);
 await f.api('/auth/verify/send','POST',{},u.token);f.store.run('UPDATE challenges SET expires=0');
 assert.equal((await f.api('/auth/verify','POST',{code:f.mail.at(-1).code},u.token)).status,400);
});
test('password recovery is generic, revokes sessions and cannot reuse a code',async t=>{
 const f=await fixture(t),u=await f.register();await f.verify(u);
 const exists=await f.api('/auth/recovery','POST',{email:'asha@example.test'});
 const missing=await f.api('/auth/recovery','POST',{email:'nobody@example.test'});assert.deepEqual(exists,missing);
 const code=f.mail.at(-1).code;
 assert.equal((await f.api('/auth/reset','POST',{email:'asha@example.test',code,password:'different-password-2026'})).status,200);
 assert.equal((await f.api('/me','GET',undefined,u.token)).status,401);
 assert.equal((await f.api('/auth/reset','POST',{email:'asha@example.test',code,password:'other-password-2026'})).status,400);
 assert.equal((await f.api('/auth/login','POST',{handle:'asha',password:'different-password-2026'})).status,200);
});
test('password change preserves current access and revokes all older sessions',async t=>{
 const f=await fixture(t),u=await f.register();
 const other=await f.api('/auth/login','POST',{handle:'asha',password:'correct-horse-2026'});
 const changed=await f.api('/auth/password','PUT',{currentPassword:'correct-horse-2026',password:'new-password-2026'},u.token);assert.equal(changed.status,200);
 assert.equal((await f.api('/me','GET',undefined,other.body.token)).status,401);
 assert.equal((await f.api('/me','GET',undefined,u.token)).status,401);
 assert.equal((await f.api('/me','GET',undefined,changed.body.token)).status,200);
 await f.api('/auth/logout-all','POST',{},changed.body.token);
 assert.equal((await f.api('/me','GET',undefined,changed.body.token)).status,401);
});
test('memory corrections are private, bounded and encrypted',async t=>{
 const f=await fixture(t),u=await f.register(),v=await f.register('neha');
 await f.api('/me/memory','PUT',{memory:'I prefer quiet weekends.'},u.token);
 assert.equal((await f.api('/me/memory','GET',undefined,u.token)).body.memory,'I prefer quiet weekends.');
 assert.equal((await f.api('/me/memory','GET',undefined,v.token)).body.memory,'');
 assert.ok(!f.store.get('SELECT memory FROM users WHERE id=?',u.user.id).memory.includes('weekends'));
 assert.equal((await f.api('/me/memory','PUT',{memory:'x'.repeat(12001)},u.token)).status,400);
});
test('moderation fails closed; personal distress is not automatically blocked',async()=>{
 const create=c=>makeModerator({key:'test',fetchImpl:async()=>({ok:true,json:async()=>({results:[{categories:{'sexual/minors':false,...c}}]})})});
 await create({'self-harm/intent':true})('I need help','reflection');
 await assert.rejects(()=>create({'sexual/minors':true})('blocked'),e=>e.status===422);
 await assert.rejects(()=>makeModerator({key:'test',fetchImpl:async()=>{throw Error();}})('hello'),e=>e.status===503);
 await assert.rejects(()=>makeModerator({key:'test',fetchImpl:async()=>({ok:true,json:async()=>({})})})('hello'),e=>e.status===503);
});
test('report/block during moderation prevents a queued message being delivered',async t=>{
 let resolve,entered;const enteredPromise=new Promise(r=>entered=r);
 const f=await fixture(t,{moderate:async text=>{if(text==='delayed message'){entered();await new Promise(r=>resolve=r);}}});
 const a=await f.register(),b=await f.register('arjun',{...profile,name:'Arjun',gender:'Man',seeking:['Woman']});
 await f.verify(a);await f.verify(b);await f.mature(a);await f.mature(b);
 const intro=await f.api('/intros','POST',{target:b.user.id},a.token);const id=intro.body.id;
 await f.api(`/intros/${id}/accept`,'POST',{},b.token);
 const pending=f.api(`/intros/${id}/messages`,'POST',{message:'delayed message',requestId:randomUUID()},a.token);await enteredPromise;
 await f.api('/blocks','POST',{target:a.user.id},b.token);resolve();
 assert.equal((await pending).status,404);assert.equal(f.store.get('SELECT count(*) AS n FROM messages').n,0);
 await f.api('/blocks','DELETE',{target:a.user.id},b.token);
 assert.equal((await f.api(`/intros/${id}/messages`,'GET',undefined,a.token)).status,404);
});
test('unread counts are participant-specific and read cursors reject unrelated messages',async t=>{
 const f=await fixture(t),a=await f.register(),b=await f.register('arjun',{...profile,name:'Arjun',gender:'Man',seeking:['Woman']});
 await f.verify(a);await f.verify(b);await f.mature(a);await f.mature(b);
 const id=(await f.api('/intros','POST',{target:b.user.id},a.token)).body.id;await f.api(`/intros/${id}/accept`,'POST',{},b.token);
 const message=await f.api(`/intros/${id}/messages`,'POST',{message:'Hello from Asha',requestId:randomUUID()},a.token);
 assert.equal((await f.api('/intros','GET',undefined,b.token)).body.intros[0].unread,1);
 assert.equal((await f.api('/intros','GET',undefined,a.token)).body.intros[0].unread,0);
 assert.equal((await f.api(`/intros/${id}/read`,'POST',{lastId:99999},b.token)).status,400);
 await f.api(`/intros/${id}/read`,'POST',{lastId:message.body.id},b.token);
 assert.equal((await f.api('/intros','GET',undefined,b.token)).body.intros[0].unread,0);
});
test('deletion cascades through email, codes and consent records',async t=>{
 const f=await fixture(t),a=await f.register();await f.api('/auth/verify/send','POST',{},a.token);
 assert.equal((await f.api('/me','DELETE',{confirm:'DELETE',password:'correct-horse-2026'},a.token)).status,200);
 for(const table of ['contacts','challenges','consent_events'])assert.equal(f.store.get(`SELECT count(*) AS n FROM ${table}`).n,0);
});
test('production config rejects unsafe startup and public pages escape operator fields',async t=>{
 assert.throws(()=>configFromEnv({NODE_ENV:'production'}),/requires/);
 const env={NODE_ENV:'production',DATA_KEY:'x',INVITE_CODE:'x',OPENAI_API_KEY:'x',OPENAI_MODEL:'x',RESEND_API_KEY:'x',MAIL_FROM:'x',PUBLIC_ORIGIN:'https://raabta.test',SUPPORT_EMAIL:'x',OPERATOR_NAME:'x'};
 assert.throws(()=>configFromEnv({...env,MODERATION_ENABLED:'false'}),/requires email/);
 assert.throws(()=>configFromEnv({...env,PUBLIC_ORIGIN:'http://raabta.test'}),/HTTPS/);
 const f=await fixture(t,{operatorName:'<script>alert(1)</script>'});
 const response=await fetch(f.base+'/privacy');const page=await response.text();
 assert.equal(response.status,200);assert.ok(page.includes('&lt;script&gt;'));assert.ok(!page.includes('<script>alert'));
 assert.ok(response.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
});
test('mailer sends bounded code email without leaking API key in body',async()=>{
 let body;const mailer=makeMailer({key:'secret',from:'Raabta <auth@example.test>',fetchImpl:async(url,opts)=>{assert.equal(url,'https://api.resend.com/emails');body=JSON.parse(opts.body);return{ok:true};}});
 await mailer({email:'a@example.test',code:'12345678',purpose:'reset'});assert.ok(body.text.includes('12345678'));assert.ok(!JSON.stringify(body).includes('secret'));
});

test('AI reports authorize the owner and only permit assistant replies',async t=>{
 const f=await fixture(t),a=await f.register(),b=await f.register('neha');await f.verify(a);
 await f.api('/ai/chat','POST',{message:'A meaningful conversation about books and kindness.',requestId:randomUUID()},a.token);
 const turns=f.store.turns(a.user.id),assistant=turns.find(x=>x.role==='assistant'),user=turns.find(x=>x.role==='user');
 assert.equal((await f.api('/ai/reports','POST',{messageId:assistant.id,reason:'This reply was not appropriate.'},b.token)).status,404);
 assert.equal((await f.api('/ai/reports','POST',{messageId:user.id,reason:'This reply was not appropriate.'},a.token)).status,404);
 assert.equal((await f.api('/ai/reports','POST',{messageId:assistant.id,reason:'This reply was not appropriate.'},a.token)).status,200);
 assert.equal(f.store.get('SELECT count(*) AS n FROM ai_reports').n,1);
 await f.api('/ai/history','DELETE',{},a.token);
 assert.equal(f.store.get('SELECT count(*) AS n FROM ai_reports').n,0);
});
test('AI history pagination retains chronological order and does not expose another account',async t=>{
 const f=await fixture(t),a=await f.register(),b=await f.register('neha');
 for(let i=0;i<105;i++)f.store.run('INSERT INTO turns(user_id,role,body,day,created,request_id) VALUES(?,?,?,?,?,?)',a.user.id,'user',f.store.seal('message '+i),'2026-10-01','today',randomUUID());
 const recent=(await f.api('/ai/history','GET',undefined,a.token)).body;
 assert.equal(recent.messages.length,100);assert.equal(recent.hasMore,true);assert.equal(recent.messages[0].text,'message 5');
 const older=(await f.api('/ai/history?before='+recent.messages[0].id,'GET',undefined,a.token)).body;
 assert.equal(older.messages.length,5);assert.equal(older.hasMore,false);
 assert.equal((await f.api('/ai/history','GET',undefined,b.token)).body.messages.length,0);
});
