const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const v=$("#v"),S={file:null,url:null,dur:0,len:30,fmt:"9:16",clips:[],cur:null,busy:false,last:null,mus:"auto",mood:"calm",rms:null,lang:"en-IN",listen:false,pickby:"fun"};
const DIM={"9:16":[1080,1920],"1:1":[1080,1080],"16:9":[1920,1080]};
const fmt=s=>String(Math.floor(s/60)).padStart(2,"0")+":"+String(Math.floor(s%60)).padStart(2,"0");
const toast=m=>{const t=$("#toast");t.textContent=m;t.classList.add("on");clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove("on"),3200)};
const go=id=>{$$(".screen").forEach(s=>s.classList.toggle("on",s.id===id));$("#"+id).scrollTop=0;if(id==="lib")lib();$("#nav").style.display=(id==="home"||id==="lib")?"flex":"none";$$("#nav button").forEach(b=>b.classList.toggle("on",b.dataset.n===id))};
const sw=(id,on)=>$(id).setAttribute("aria-checked",on);
function seg(id,fn){$$("#"+id+" button").forEach(b=>b.onclick=()=>{$$("#"+id+" button").forEach(x=>x.classList.toggle("on",x===b));fn(b.dataset.v)})}
seg("len",x=>S.len=+x);seg("pickby",x=>S.pickby=x);seg("fmt",x=>S.fmt=x);

// ---------- storage (IndexedDB, kept on the phone) ----------
let _db;const db=()=>_db||(_db=new Promise((ok,no)=>{const r=indexedDB.open("autoclip",1);
 r.onupgradeneeded=()=>{["videos","projects","exports","exportblobs"].forEach(n=>r.result.createObjectStore(n,{keyPath:"id"}))};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)}));
const tx=async(st,mode,fn)=>{const d=await db();return new Promise((ok,no)=>{const t=d.transaction(st,mode),q=fn(t.objectStore(st));t.oncomplete=()=>ok(q&&q.result);t.onerror=t.onabort=()=>no(t.error)})};
const dbGet=(s,k)=>tx(s,"readonly",o=>o.get(k)),dbPut=(s,v)=>tx(s,"readwrite",o=>o.put(v)),dbDel=(s,k)=>tx(s,"readwrite",o=>o.delete(k)),dbAll=s=>tx(s,"readonly",o=>o.getAll());
// ---------- choose a video ----------
const rid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);
async function load(f){
 if(!f||!(f.type||"").startsWith("video/")){toast("Choose a video file");return}
 if(S.url)URL.revokeObjectURL(S.url);
 S.id=null;S.clips=[];S.file=f;S.url=URL.createObjectURL(f);v.src=S.url;
 await new Promise(r=>{v.onloadedmetadata=r;v.onerror=r});
 if(!v.duration||!isFinite(v.duration)){toast("This browser cannot read that video. Try MP4 (H.264) or WebM.");S.file=null;linkChk();return}
 S.dur=v.duration;$("#drop").classList.add("has");$("#fname").textContent=f.name;
 $("#fmeta").textContent=`${fmt(S.dur)} · ${(f.size/1048576).toFixed(0)} MB · tap to change`;linkChk()}
$("#file").onchange=e=>load(e.target.files[0]);
// ---------- links: fetched by your online Autoclip server (Render) ----------
const LS={get(k,d){try{return localStorage.getItem(k)||d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
S.helper=LS.get("ac_helper",(window.AUTOCLIP_SERVER||"").trim());S.key=LS.get("ac_key","");S.hok=false;
const hf=(p,o={})=>fetch(S.helper+p,{...o,headers:{...(o.headers||{}),...(S.key?{"X-Access-Key":S.key}:{})}});
let hchk=0;
async function checkHelper(){const my=++hchk,st=t=>{$("#hstat").textContent=t};S.hok=false;
 if(!S.helper){st("Link server: not set up. Tap here and enter your server address.");linkChk();return}
 for(let i=0;i<15&&my===hchk;i++){
  try{const ac=new AbortController(),t=setTimeout(()=>ac.abort(),9000);const r=await hf("/api/ping",{cache:"no-store",signal:ac.signal});clearTimeout(t);const q=await r.json();
   if(q.ok){if(q.locked&&!q.authed){st("Your server needs the access key. Tap here to enter the key.");linkChk();return}
    S.hok=true;st("Link server: connected ✓");linkChk();return}}catch(e){}
  st(i?`Waking up your server… free servers sleep, this can take about a minute (${i}/15)`:"Connecting to your server…");linkChk();await new Promise(r=>setTimeout(r,4000))}
 if(my===hchk){st("Could not reach your server. Check the address, then tap here to try again.");linkChk()}}
function openSettings(){const a=prompt("Address of your online Autoclip server, for example https://autoclip.onrender.com",S.helper);if(a===null)return;
 S.helper=a.trim().replace(/\/+$/,"");LS.set("ac_helper",S.helper);
 const k=prompt("Access key (leave empty if you did not set one)",S.key);if(k!==null){S.key=k.trim();LS.set("ac_key",S.key)}checkHelper()}
function linkChk(){const u=$("#url").value.trim();let ok=false;try{ok=!!u&&new URL(/^https?:\/\//i.test(u)?u:"https://"+u).hostname.includes(".")}catch(e){}
 $("#lf").classList.toggle("err",!!u&&!ok);$("#find").disabled=u?!(ok&&S.hok):!S.file}
$("#url").oninput=linkChk;$("#hstat").onclick=()=>{/set up|key|Could not reach/.test($("#hstat").textContent)?openSettings():checkHelper()};
$("#paste").onclick=async()=>{try{$("#url").value=await navigator.clipboard.readText();linkChk()}catch(e){$("#url").focus();toast("Long-press the field to paste")}};
$("#hset").onclick=openSettings;
document.addEventListener("visibilitychange",()=>{if(!document.hidden)checkHelper()});
async function fetchLink(link){
 S.cancel=false;$("#pt").textContent=link;$("#skip").style.display="none";go("proc");prog(2,0);
 try{const H=S.helper;
  const j=await(await hf("/api/fetch",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:link})})).json();
  if(j.error)throw new Error(j.error);
  let st;do{await new Promise(r=>setTimeout(r,1000));if(S.cancel)return false;st=await(await hf("/api/job/"+j.id)).json();if(st.state=="error")throw new Error(st.error||"Could not fetch that link");prog(2+(st.pct||0)*.4,0)}while(st.state!="done");
  prog(45,0);$("#pt").textContent="Copying the video into the app…";
  const r=await hf("/video/"+j.id);if(!r.ok)throw new Error("Could not copy the video from the server");
  const blob=await r.blob();hf("/api/video/"+j.id,{method:"DELETE"}).catch(()=>{});
  const f=new File([blob],(st.title||"Video").replace(/[\\/:*?"<>|]+/g," ").slice(0,80)+".mp4",{type:blob.type||"video/mp4"});
  await load(f);if(!S.file)throw new Error("This phone could not play that video. Try another link.");
  $("#url").value="";return true
 }catch(e){toast(e.message==="Failed to fetch"?"Could not reach your server. It may be waking up. Wait a minute and try again.":(e.message||"Could not fetch that link"));go("home");return false}}
const dr=$("#drop");["dragover","dragenter"].forEach(n=>dr.addEventListener(n,e=>{e.preventDefault()}));
dr.addEventListener("drop",e=>{e.preventDefault();load(e.dataTransfer.files[0])});

// ---------- analysis ----------
const STEPS=["Reading the video","Listening to the audio","Picking highlights","Preparing clips"];
function prog(p,step){$("#pp").textContent=Math.round(p)+"%";$("#pb").style.width=p+"%";
 $("#steps").innerHTML=STEPS.map((s,i)=>`<div class="step ${i<step?"done":i==step?"cur":""}"><div class="dot">${i<step?"✓":""}</div><div>${s}</div></div>`).join("")}
const tick=()=>new Promise(r=>setTimeout(r,30));
$("#pback").onclick=()=>{S.cancel=true;go("home")};
// Loudness per second + a laughter/reaction score, worked out from 20 ms audio frames (same method as the server version).
function features(fr){
 const n=Math.floor(fr.length/50),rms=[],laugh=[];if(!n)return null;
 for(let i=0;i<n;i++){let a=0;for(let k=i*50;k<i*50+50;k++)a+=fr[k]*fr[k];rms.push(Math.sqrt(a/50))}
 const med=a=>{const t=[...a].sort((x,y)=>x-y);return t[t.length>>1]||0};
 for(let i=0;i<n;i++){
  const w=fr.slice(Math.max(0,i*50-25),Math.min(fr.length,i*50+75));let mx=0,mean=0;for(const x of w){mx=Math.max(mx,x);mean+=x}mean/=w.length||1;
  const base=med(rms.slice(Math.max(0,i-15),Math.min(n,i+16)))+1e-4,pp=[];
  for(let k=1;k<w.length-1;k++)if(w[k]>w[k-1]&&w[k]>=w[k+1]&&w[k]>.45*mx&&w[k]>.008&&(!pp.length||k-pp[pp.length-1]>=5))pp.push(k);
  let reg=0;if(pp.length>=3){let g=0;for(let j=1;j<pp.length;j++){const d=pp[j]-pp[j-1];if(d>=8&&d<=20)g++}reg=g/(pp.length-1)}
  const loud=Math.max(0,Math.min(1,(mean/base-1)/1.5));
  laugh.push(reg*Math.min(1,pp.length/5)*(.3+.7*loud))}
 return{rms:Float32Array.from(rms),lf:Float32Array.from(laugh)}}
async function decodeAnalyze(file){
 const AC=window.AudioContext||window.webkitAudioContext;let ac;try{ac=new AC({sampleRate:8000})}catch(e){ac=new AC()}
 const buf=await file.arrayBuffer();prog(25,1);await tick();
 const ab=await ac.decodeAudioData(buf);prog(55,1);await tick();
 const d=ab.getChannelData(0),fz=Math.round(ab.sampleRate*.02),fr=[];
 for(let i=0;i+fz<=d.length;i+=fz){let a=0;for(let j=i;j<i+fz;j++)a+=d[j]*d[j];fr.push(Math.sqrt(a/fz))}
 ac.close();return features(fr)}
// Very long or very large videos: play the video silently at 4x speed and measure the sound as it plays (no memory limit).
async function scanAnalyze(file){
 const AC=window.AudioContext||window.webkitAudioContext,ac=new AC(),url=URL.createObjectURL(file),el=document.createElement("video");
 el.src=url;el.playsInline=true;el.preload="auto";el.style.cssText="position:fixed;left:0;top:0;width:2px;height:2px;opacity:.01";document.body.appendChild(el);
 await new Promise(r=>{el.onloadedmetadata=r;el.onerror=r});
 const dur=el.duration,R=4;el.playbackRate=R;
 const src=ac.createMediaElementSource(el),sp=ac.createScriptProcessor(4096,1,1),fz=Math.max(1,Math.round(ac.sampleRate*.02/R)),fr=[];let acc=0,cnt=0,mx=0;
 sp.onaudioprocess=e=>{const d=e.inputBuffer.getChannelData(0);for(let i=0;i<d.length;i++){acc+=d[i]*d[i];if(++cnt>=fz){const r=Math.sqrt(acc/cnt);fr.push(r);if(r>mx)mx=r;acc=0;cnt=0}}};
 src.connect(sp);sp.connect(ac.destination);await ac.resume();$("#skip").style.display="block";const t0=performance.now();
 try{await el.play();
  await new Promise(res=>{const iv=setInterval(()=>{const p=el.currentTime/dur;prog(8+p*70,1);
   $("#pt").textContent=`${S.file.name} · about ${Math.max(1,Math.ceil((dur-el.currentTime)/R/60))} min left`;
   if(el.ended||S.cancel||S.skip||(performance.now()-t0>6000&&mx===0)){clearInterval(iv);res()}},300)})
 }finally{el.pause();try{sp.disconnect()}catch(e){}ac.close();el.remove();URL.revokeObjectURL(url);$("#skip").style.display="none"}
 if(S.cancel||S.skip||mx===0||fr.length<100)return null;
 const want=Math.floor(dur*50);let f2=fr;if(Math.abs(fr.length-want)>want*.03){f2=new Array(want);for(let k=0;k<want;k++)f2[k]=fr[Math.min(fr.length-1,Math.floor(k*fr.length/want))]}
 return features(f2)}
async function analyzeFile(file){
 const forced=/[?&]scan=1/.test(location.search),long=forced||file.size>250*1048576||S.dur>3600;
 if(!long){try{return await decodeAnalyze(file)}catch(e){}}
 try{return await scanAnalyze(file)}catch(e){return null}}
$("#skip").onclick=()=>{S.skip=true};
$("#find").onclick=async()=>{
 const link=$("#url").value.trim();if(link&&!await fetchLink(link))return;
 if(!S.file)return;S.cancel=false;S.skip=false;S.lastSave=null;S.len=Math.min(S.len,Math.max(5,Math.floor(S.dur)));
 $("#pt").textContent=S.file.name;$("#skip").style.display="none";go("proc");prog(5,0);await tick();
 const r=await analyzeFile(S.file);if(S.cancel)return;
 S.rms=r?r.rms:null;prog(80,2);await tick();S.clips=pick(S.rms,r?r.lf:null);
 if(!r)toast("Could not read this video’s audio, so clips are evenly spaced.");
 prog(90,3);await tick();
 try{S.id=S.id||rid();await dbPut("videos",{id:S.id,blob:S.file});try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}}
 catch(e){S.id=null;toast("Could not keep this video on the phone (storage may be full). You can still edit and export, but this project will not be saved.")}
 prog(100,4);await tick();showRes();persist(true)};
function pick(rms,lf){
 const len=S.len,last=Math.max(0,Math.floor(S.dur-len)),cand=[];
 if(rms){const w=(a,b)=>{let s=0;for(let i=a;i<b;i++)s+=rms[i]||0;return s/(b-a)};
  const top=(a,b)=>{const t=[];for(let i=a;i<b;i++)t.push(lf[i]||0);t.sort((x,y)=>y-x);return((t[0]||0)+(t[1]||0)+(t[2]||0))/3};
  const wl=(a,b)=>{let s=0;for(let i=a;i<b;i++)s+=lf[i]||0;return s/(b-a)};
  for(let s=0;s<=last;s++){const loud=w(s,s+len)*.6+w(s,s+3)*.4,fun=lf?top(s+Math.floor(len*.4),s+len)*.7+wl(s,s+len)*.3:0;cand.push({s,loud,fun})}
  const mL=Math.max(...cand.map(c=>c.loud))||1,mF=Math.max(...cand.map(c=>c.fun))||0,m=S.pickby;
  cand.forEach(c=>{const l=c.loud/mL,f=mF?c.fun/mF:0;c.raw=!lf||!mF||m=="loud"?l:m=="fun"?.8*f+.2*l:.5*f+.5*l;c.f=Math.round(f*100)})}
 else{const k=Math.min(6,Math.max(1,Math.floor(S.dur/len)));for(let i=0;i<k;i++)cand.push({s:Math.round(i*(S.dur-len)/Math.max(1,k-1)||0),raw:1-i*.05})}
 const mx=Math.max(...cand.map(c=>c.raw))||1;cand.sort((a,b)=>b.raw-a.raw);
 const out=[];for(const c of cand){if(out.length>=6)break;if(out.every(o=>Math.abs(o.s-c.s)>=len))out.push(c)}
 const showFun=lf&&S.pickby!="loud"&&Math.max(...lf)>0;
 return out.map((c,i)=>({s:c.s,e:Math.min(S.dur,c.s+len),min:Math.max(0,c.s-10),max:Math.min(S.dur,c.s+len+10),
  score:Math.round(55+43*(c.raw/mx)),fun:showFun?c.f:null,title:"Clip "+(i+1),text:"",cap:true,style:"pop",rf:true,auto:false,fx:.5,fy:.5,col:"#c8f26b",pos:"bot",size:1}))}
function showRes(){
 $("#rh").textContent=S.clips.length+" clips ready";$("#rs").textContent=`From ${S.file.name} · ${S.len}s`;
 $("#clips").innerHTML=S.clips.map((c,i)=>`<div class="clip"><label class="pick"><input type="checkbox" data-k="${i}"${c.sel?" checked":""}><h3>${c.title}</h3></label><div class="sub">${fmt(c.s)} – ${fmt(c.e)} · ${Math.round(c.e-c.s)}s</div><div class="ft"><span class="badge ${i?"":"top1"}">${c.fun!=null?"😂 Funny "+c.fun:"Score "+c.score}</span><button class="lime" data-e="${i}">Edit</button></div></div>`).join("");
 $$("[data-e]").forEach(b=>b.onclick=()=>openEdit(+b.dataset.e));
 $$("[data-k]").forEach(b=>b.onchange=()=>{S.clips[+b.dataset.k].sel=b.checked;updSel()});updSel();go("res")}
function updSel(){const n=S.clips.filter(c=>c.sel).length;$("#expall").textContent=`⤓ Export selected (${n})`;$("#expall").disabled=!n||S.busy;$("#selall").textContent=n===S.clips.length?"Select none":"Select all"}
$("#selall").onclick=()=>{const all=S.clips.every(c=>c.sel);S.clips.forEach(c=>c.sel=!all);$$("[data-k]").forEach(b=>b.checked=!all);updSel()};
$("#rback").onclick=()=>go("home");

// ---------- drawing ----------
const bgc=document.createElement("canvas");
function frame(x,vd,w,h,rf,fo){x.fillStyle="#000";x.fillRect(0,0,w,h);const vw=vd.videoWidth,vh=vd.videoHeight;if(!vw)return;
 if(!rf){const bw=Math.max(8,w>>3),bh=Math.max(8,h>>3),kk=Math.max(bw/vw,bh/vh);bgc.width=bw;bgc.height=bh;
  bgc.getContext("2d").drawImage(vd,(bw-vw*kk)/2,(bh-vh*kk)/2,vw*kk,vh*kk);x.imageSmoothingEnabled=true;x.drawImage(bgc,0,0,w,h);x.fillStyle="rgba(0,0,0,.45)";x.fillRect(0,0,w,h)}
 const k=rf?Math.max(w/vw,h/vh):Math.min(w/vw,h/vh),dw=vw*k,dh=vh*k;let ox=(w-dw)/2,oy=(h-dh)/2;if(rf&&fo){ox=Math.min(0,Math.max(w-dw,w/2-fo[0]*dw));oy=Math.min(0,Math.max(h-dh,h/2-fo[1]*dh))}x.drawImage(vd,ox,oy,dw,dh)}
function caps(x,w,h,c,t){
 if(!c.cap)return;let src=c.text,a0=c.s,a1=c.e;if(c.cues&&c.cues.length){const q=c.cues.find(z=>t>=z.s&&t<z.e);if(!q)return;src=q.text;a0=q.s;a1=q.e}if(!src.trim())return;const ws=src.trim().split(/\s+/),p=Math.min(.999,Math.max(0,(t-a0)/(a1-a0||1))),i=Math.floor(p*ws.length),g=Math.floor(i/3)*3,grp=ws.slice(g,g+3);
 let fs=Math.round(Math.min(w,h)*.075*(c.size||1));{x.font=`700 ${fs}px system-ui,"Segoe UI",Roboto,sans-serif`;const t0=grp.reduce((a,b)=>a+x.measureText(b).width,0)+fs*.3*(grp.length-1);if(t0>w*.9)fs=Math.floor(fs*w*.9/t0)}x.font=`700 ${fs}px system-ui,"Segoe UI",Roboto,sans-serif`;x.textBaseline="middle";
 const sp=fs*.3,wd=grp.map(a=>x.measureText(a).width),tot=wd.reduce((a,b)=>a+b,0)+sp*(grp.length-1),y=h*({top:.2,mid:.5,bot:h>w?.74:.82}[c.pos||"bot"]);let px=(w-tot)/2;
 if(c.style=="boxed"){x.fillStyle="#14161a";x.fillRect(px-fs*.4,y-fs*.75,tot+fs*.8,fs*1.5)}
 grp.forEach((a,k)=>{const cur=g+k===i;x.shadowColor="transparent";
  if(c.style=="karaoke"&&cur){x.fillStyle=c.col||"#c8f26b";x.fillRect(px-fs*.15,y-fs*.65,wd[k]+fs*.3,fs*1.3);x.fillStyle="#14160f"}
  else{x.fillStyle=(["pop","neon","outline"].includes(c.style)&&cur)?(c.col||"#c8f26b"):"#fff";if(c.style=="pop"||c.style=="clean"){x.shadowColor="rgba(0,0,0,.7)";x.shadowBlur=fs*.25}if(c.style=="neon"){x.shadowColor=c.col||"#c8f26b";x.shadowBlur=fs*.6}}
  if(c.style=="clean")x.font=`500 ${fs}px system-ui,sans-serif`;
  if(c.style=="outline"){x.lineWidth=fs*.16;x.lineJoin="round";x.strokeStyle="#000";x.strokeText(a,px,y)}x.fillText(a,px,y);px+=wd[k]+sp});x.shadowColor="transparent"}

// ---------- editor ----------
const pc=$("#pc"),px=pc.getContext("2d");
function size(){const [w,h]=DIM[S.fmt];pc.width=w/2;pc.height=h/2}
function openEdit(i){
 const c=S.cur=S.clips[i];$("#esc").textContent="Score "+c.score;size();
 $$("#efmt button").forEach(b=>b.classList.toggle("on",b.dataset.v===S.fmt));
 $$("#styles button").forEach(b=>b.classList.toggle("on",b.dataset.s===c.style));
 sw("#rf",c.rf);sw("#capsw",c.cap);$("#txt").value=c.text;syncOpt();sw("#af",c.auto!==false);$("#fx").value=c.fx??.5;$("#fy").value=c.fy??.4;
 const a=$("#t0"),b=$("#t1");[a,b].forEach(x=>{x.min=c.min;x.max=c.max;x.step=.5});a.value=c.s;b.value=c.e;trim();
 v.pause();v.currentTime=c.s;$("#play").textContent="▶ Play";$("#xinfo").style.display="none";$("#share").style.display="none";go("edit")}
function trim(){const c=S.cur,a=+$("#t0").value,b=+$("#t1").value,r=c.max-c.min||1;
 $("#fill").style.left=((a-c.min)/r*100)+"%";$("#fill").style.width=((b-a)/r*100)+"%";
 $("#ta").textContent=fmt(a);$("#tb").textContent=fmt(b);$("#tl").textContent=(b-a).toFixed(1)+"s selected"}
["t0","t1"].forEach(id=>$("#"+id).oninput=()=>{const c=S.cur;let a=+$("#t0").value,b=+$("#t1").value;
 if(b-a<3){if(id=="t0"){a=b-3;$("#t0").value=a}else{b=a+3;$("#t1").value=b}}
 c.s=a;c.e=b;trim();v.currentTime=id=="t0"?a:Math.max(a,b-.5)});
$("#rf").onclick=()=>{S.cur.rf=!S.cur.rf;sw("#rf",S.cur.rf)};
$("#capsw").onclick=()=>{S.cur.cap=!S.cur.cap;sw("#capsw",S.cur.cap)};
$("#txt").oninput=e=>{S.cur.text=e.target.value;S.cur.cues=null};
$$("#styles button").forEach(b=>b.onclick=()=>{S.cur.style=b.dataset.s;$$("#styles button").forEach(x=>x.classList.toggle("on",x===b))});
seg("efmt",x=>{S.fmt=x;size()});
seg("cpos",x=>S.cur.pos=x);seg("csize",x=>S.cur.size=+x);seg("mmode",x=>S.mus=x);seg("mmood",x=>S.mood=x);seg("cols",x=>S.cur.col=x);
function syncOpt(){const c=S.cur,m={cpos:c.pos,csize:String(c.size),mmode:S.mus,mmood:S.mood,cols:c.col};for(const id in m)$$("#"+id+" button").forEach(b=>b.classList.toggle("on",b.dataset.v===m[id]))}
seg("lang",x=>S.lang=x);
function chunk(s,e,text){const w=text.trim().split(/\s+/).filter(Boolean),out=[],d=(e-s)/(w.length||1);for(let i=0;i<w.length;i+=6){const a=w.slice(i,i+6);out.push({s:s+i*d,e:s+(i+a.length)*d,text:a.join(" ")})}return out}
$("#srt").onchange=async e=>{const f=e.target.files[0];e.target.value="";if(!f)return;const c=S.cur,t=(await f.text()).replace(/\r/g,""),cues=[];
 const re=/(?:(\d+):)?(\d+):(\d+)[.,](\d+)\s*-->\s*(?:(\d+):)?(\d+):(\d+)[.,](\d+)[^\n]*\n([\s\S]*?)(?=\n\s*\n|$)/g,sec=(h,m,s,ms)=>(+h||0)*3600+ +m*60+ +s+ +("0."+ms);let m;
 while((m=re.exec(t)))cues.push(...chunk(sec(...m.slice(1,5)),sec(...m.slice(5,9)),m[9].replace(/<[^>]+>/g,"").replace(/\n/g," ")));
 const use=cues.filter(q=>q.e>c.s&&q.s<c.e);
 if(!use.length){toast("No captions in that file fall inside this clip");return}
 c.cues=use;c.text=use.map(q=>q.text).join(" ");c.cap=true;sw("#capsw",true);$("#txt").value=c.text;toast("Captions imported")};
$("#auto").onclick=async()=>{
 const SR=window.SpeechRecognition||window.webkitSpeechRecognition,c=S.cur;
 if(!SR){toast("Auto captions need Chrome, Edge or Safari. Import an .srt file or type the captions instead.");return}
 if(S.busy)return;S.pm&&S.pm.stop();v.pause();v.currentTime=c.s;S.listen=true;$("#auto").disabled=true;$("#exp").disabled=true;
 $("#xinfo").style.display="block";$("#xl").textContent="Listening to the clip…";$("#xp").textContent="0%";$("#xb").style.width="0";
 await new Promise(r=>setTimeout(r,500));
 const rc=new SR(),cues=[],st={};let fin=false,iv;rc.lang=S.lang;rc.continuous=true;rc.interimResults=true;
 const finish=()=>{if(fin)return;fin=true;clearInterval(iv);try{rc.stop()}catch(e){}v.pause();S.listen=false;$("#auto").disabled=false;$("#exp").disabled=false;$("#xinfo").style.display="none";
  if(cues.length){cues.sort((a,b)=>a.s-b.s);c.cues=cues;c.text=cues.map(q=>q.text).join(" ");$("#txt").value=c.text;c.cap=true;sw("#capsw",true);toast("Captions added. Check the text and fix any mistakes.")}
  else toast("No speech heard. Turn the volume up, allow the microphone, or import an .srt file.");v.currentTime=c.s};
 rc.onresult=e=>{for(let k=e.resultIndex;k<e.results.length;k++){const r=e.results[k];if(st[k]===undefined)st[k]=Math.max(c.s,v.currentTime-.8);
  if(r.isFinal&&!st["d"+k]){st["d"+k]=1;cues.push(...chunk(st[k],Math.min(c.e,Math.max(st[k]+.5,v.currentTime-.2)),r[0].transcript))}}};
 rc.onend=()=>{if(!fin&&!v.paused&&v.currentTime<c.e-.3){for(const k in st)delete st[k];try{rc.start()}catch(e){}}};
 rc.onerror=e=>{if(e.error==="not-allowed"||e.error==="service-not-allowed"){toast("Microphone is blocked. Allow it, or import an .srt file.");finish()}};
 iv=setInterval(()=>{const p=Math.min(1,(v.currentTime-c.s)/(c.e-c.s));$("#xb").style.width=p*100+"%";$("#xp").textContent=Math.round(p*100)+"%";
  if(v.currentTime>=c.e-.1||v.ended){clearInterval(iv);v.pause();try{rc.stop()}catch(e){}setTimeout(finish,1300)}},200);
 try{const ms=v.captureStream&&v.captureStream(),tr=ms&&ms.getAudioTracks()[0];if(tr)rc.start(tr);else rc.start()}catch(e){try{rc.start()}catch(_){}}
 v.play().catch(()=>{})};
$$("#nav button").forEach(b=>b.onclick=()=>go(b.dataset.n));
// Face focus: uses the browser face detector when it exists, otherwise finds the skin-tone area; you can also move the focus by hand.
const fcv=document.createElement("canvas");let FD;
async function detect(vd){
 try{if("FaceDetector" in window){FD=FD||new FaceDetector({fastMode:true,maxDetectedFaces:3});const fs=await FD.detect(vd);
  if(fs.length){const b=fs.sort((a,b)=>b.boundingBox.width-a.boundingBox.width)[0].boundingBox;return{x:(b.x+b.width/2)/vd.videoWidth,y:(b.y+b.height/2)/vd.videoHeight}}}}catch(e){}
 const W=64,H=Math.max(8,Math.round(64*vd.videoHeight/vd.videoWidth));fcv.width=W;fcv.height=H;const g=fcv.getContext("2d",{willReadFrequently:true});g.drawImage(vd,0,0,W,H);
 const d=g.getImageData(0,0,W,H).data;let sx=0,sy=0,n=0;
 for(let i=0;i<d.length;i+=4){const r=d[i],q=d[i+1],b=d[i+2],Y=.299*r+.587*q+.114*b,cb=128-.1687*r-.3313*q+.5*b,cr=128+.5*r-.4187*q-.0813*b;
  if(Y>60&&cb>77&&cb<127&&cr>133&&cr<173){const p=i/4;sx+=p%W;sy+=Math.floor(p/W);n++}}
 return n<W*H*.012?null:{x:sx/n/W,y:Math.max(.2,sy/n/H*.9)}}
function foc(c,vd){
 if(!c._f)Object.defineProperty(c,"_f",{value:{x:.5,y:.4,tx:.5,ty:.4,last:0},enumerable:false,writable:true});
 const f=c._f;
 if(c.auto!==false&&vd.videoWidth){const n=performance.now();if(n-f.last>300){f.last=n;detect(vd).then(r=>{if(r){f.tx=r.x;f.ty=r.y}}).catch(()=>{})}f.x+=(f.tx-f.x)*.15;f.y+=(f.ty-f.y)*.15}
 else{f.x=f.tx=c.fx??.5;f.y=f.ty=c.fy??.4}
 return[f.x,f.y]}
$("#af").onclick=()=>{const c=S.cur;c.auto=c.auto===false;sw("#af",c.auto);if(!c.auto){c.fx=c._f?c._f.x:.5;c.fy=c._f?c._f.y:.4;$("#fx").value=c.fx;$("#fy").value=c.fy}};
["fx","fy"].forEach(id=>$("#"+id).oninput=e=>{const c=S.cur;c.auto=false;sw("#af",false);c[id]=+e.target.value});
let pt;function persist(now){if(!S.id||!S.clips.length)return;clearTimeout(pt);pt=setTimeout(async()=>{
 const b={id:S.id,title:S.file.name,dur:S.dur,len:S.len,fmt:S.fmt,mus:S.mus,mood:S.mood,lang:S.lang,rms:S.rms?Array.from(S.rms,x=>+x.toFixed(4)):null,clips:S.clips},k=JSON.stringify(b);
 if(k===S.lastSave)return;S.lastSave=k;b.updated=Date.now();try{await dbPut("projects",b)}catch(e){}},now===true?0:500)}
["click","input","change"].forEach(e=>document.addEventListener(e,persist));
const esc=s=>String(s).replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
async function openProject(id){try{const p=await dbGet("projects",id),vb=await dbGet("videos",id);
 if(!p)throw new Error("project not found");if(!vb)throw new Error("the saved video is missing");
 if(S.url)URL.revokeObjectURL(S.url);S.url=URL.createObjectURL(vb.blob);S.file=new File([vb.blob],p.title,{type:vb.blob.type});S.id=id;
 v.src=S.url;await new Promise(r=>{v.onloadedmetadata=r;v.onerror=r});
 S.dur=p.dur||v.duration;S.len=p.len;S.fmt=p.fmt;S.mus=p.mus||"auto";S.mood=p.mood||"calm";S.lang=p.lang||"en-IN";S.rms=p.rms?Float32Array.from(p.rms):null;
 S.clips=p.clips||[];S.lastSave=null;showRes()}
 catch(e){toast("Could not open that project: "+e.message)}}
async function lib(){try{const[pr,ex]=await Promise.all([dbAll("projects"),dbAll("exports")]);pr.sort((a,b)=>b.updated-a.updated);ex.sort((a,b)=>b.time-a.time);
 $("#pempty").style.display=pr.length?"none":"block";$("#eempty").style.display=ex.length?"none":"block";
 $("#projects").innerHTML=pr.map(x=>`<div class="item"><button class="main" data-o="${x.id}"><b>${esc(x.title)}</b><span>${x.clips.length} clips · ${x.len}s · ${x.fmt}</span></button><button class="del" data-d="${x.id}" aria-label="Delete project">✕</button></div>`).join("");
 $("#exports").innerHTML=ex.map(x=>`<div class="item"><div class="main"><b>${esc(x.name)}</b><span>${(x.size/1048576).toFixed(1)} MB · ${new Date(x.time).toLocaleDateString()} · <a href="#" data-p="${x.id}">Play</a> · <a href="#" data-dl="${x.id}">Download</a></span></div><button class="del" data-x="${x.id}" aria-label="Delete clip">✕</button></div>`).join("");
 $$("[data-o]").forEach(b=>b.onclick=()=>openProject(b.dataset.o));
 $$("[data-d]").forEach(b=>b.onclick=async()=>{if(!confirm("Delete this project and its video?"))return;if(b.dataset.d===S.id){S.id=null;S.clips=[]}await dbDel("projects",b.dataset.d);await dbDel("videos",b.dataset.d);lib()});
 $$("[data-x]").forEach(b=>b.onclick=async()=>{if(!confirm("Delete this saved clip?"))return;await dbDel("exports",b.dataset.x);await dbDel("exportblobs",b.dataset.x);lib()});
 $$("[data-p]").forEach(a=>a.onclick=e=>{e.preventDefault();playExport(a.dataset.p)});
 $$("[data-dl]").forEach(a=>a.onclick=async e=>{e.preventDefault();const r=await dbGet("exportblobs",a.dataset.dl),m=ex.find(z=>z.id===a.dataset.dl);if(r)dlBlob(r.blob,(m?m.name:"clip").replace(/[^\w\- ]/g,"")+"."+(m?m.ext:"webm"))});
 try{const e=await navigator.storage.estimate();$("#usage").textContent=`Storage used by Autoclip: ${(e.usage/1048576).toFixed(0)} MB of about ${(e.quota/1073741824).toFixed(1)} GB available`}catch(e){}
}catch(e){}}
function dlBlob(blob,name){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),60000)}
async function playExport(id){const r=await dbGet("exportblobs",id);if(!r)return;const u=URL.createObjectURL(r.blob);$("#pv").src=u;$("#pdl").href=u;$("#pdl").download="clip."+(r.blob.type.includes("mp4")?"mp4":"webm");$("#player").style.display="flex";$("#pv").play().catch(()=>{})}
$("#pclose").onclick=()=>{$("#pv").pause();$("#pv").removeAttribute("src");$("#player").style.display="none"};
let PAC;const pac=()=>{PAC=PAC||new(window.AudioContext||window.webkitAudioContext)();PAC.resume();return PAC};
function plan(c){const n=Math.ceil(c.e-c.s)+1;return Array.from({length:n},(_,i)=>{if(S.mus=="on")return .22;if(!S.rms)return .15;return S.rms[Math.floor(c.s)+i]>.02?.1:.38})}
// Indian-style music made in the browser: tanpura drone, tabla beat, sitar-like plucks
function music(ac,out,t0,dur,mood,pl){
 const [sc,bpm]={calm:[[1,9/8,5/4,45/32,3/2,27/16,15/8],72],up:[[1,16/15,5/4,4/3,3/2,8/5,15/8],112],soul:[[1,16/15,6/5,4/3,3/2,8/5,9/5],84]}[mood]||[[1,9/8,5/4,3/2],80];
 const sa=146.83,g=ac.createGain(),os=[];g.gain.value=0;g.connect(out);
 pl.forEach((p,i)=>g.gain.setTargetAtTime(p,t0+i,.4));g.gain.setTargetAtTime(0,t0+dur-.8,.3);
 const tone=(type,f0,f1,t,len,vol,lp)=>{const o=ac.createOscillator(),a=ac.createGain();o.type=type;o.frequency.setValueAtTime(f0,t);if(f1!==f0)o.frequency.exponentialRampToValueAtTime(f1,t+len*.6);
  a.gain.setValueAtTime(vol,t);a.gain.exponentialRampToValueAtTime(.0001,t+len);
  if(lp){const q=ac.createBiquadFilter();q.type="lowpass";q.frequency.setValueAtTime(lp,t);q.frequency.exponentialRampToValueAtTime(500,t+len);o.connect(q);q.connect(a)}else o.connect(a);
  a.connect(g);o.start(t);o.stop(t+len+.05);os.push(o)};
 [sa/2,sa*.75].forEach(f=>{const o=ac.createOscillator(),q=ac.createBiquadFilter(),a=ac.createGain();o.type="sawtooth";o.frequency.value=f;q.type="lowpass";q.frequency.value=500;a.gain.value=.3;o.connect(q);q.connect(a);a.connect(g);o.start(t0);o.stop(t0+dur);os.push(o)});
 let s=7,n=3;const r=()=>(s=(s*16807)%2147483647)/2147483647,bt=60/bpm;
 for(let i=0,t=t0;t<t0+dur-.1;i++,t+=bt/2){
  if(i%8==0)tone("sine",170,65,t,.45,.9);else if(i%2==0)tone("triangle",560,520,t,.14,.22);else tone("sine",300,260,t,.09,.1);
  if(i%2==0&&r()>.25){n=Math.max(0,Math.min(sc.length-1,n+Math.floor(r()*3)-1));tone("sawtooth",sa*2*sc[n]*(r()<.2?2:1),sa*2*sc[n],t,.8,.3,3500)}}
 return{stop(){os.forEach(o=>{try{o.stop()}catch(e){}});try{g.disconnect()}catch(e){}}}}
$("#play").onclick=()=>{S.pm&&S.pm.stop();S.pm=null;if(v.paused){if(v.currentTime<S.cur.s||v.currentTime>=S.cur.e)v.currentTime=S.cur.s;const c=S.cur;if(S.mus!=="off"){const ac=pac();S.pm=music(ac,ac.destination,ac.currentTime+.05,c.e-v.currentTime,S.mood,plan(c))}v.play();$("#play").textContent="❚❚ Pause"}else{v.pause();$("#play").textContent="▶ Play"}};
$("#eback").onclick=()=>{v.pause();S.pm&&S.pm.stop();showRes()};
(function loop(){const c=S.cur;if(c&&$("#edit").classList.contains("on")&&!S.busy){
 if(!v.paused&&v.currentTime>=c.e&&!S.listen){v.currentTime=c.s}
 frame(px,v,pc.width,pc.height,c.rf,c.rf?foc(c,v):null);caps(px,pc.width,pc.height,c,v.currentTime)}requestAnimationFrame(loop)})();

// ---------- export ----------
function exportClip(c,onp){return new Promise(async(res,rej)=>{
 try{
  const [w,h]=DIM[S.fmt],cv=document.createElement("canvas");cv.width=w;cv.height=h;const x=cv.getContext("2d");
  const ev=document.createElement("video");ev.playsInline=true;ev.src=S.url;ev.style.cssText="position:fixed;left:0;top:0;width:2px;height:2px;opacity:.01";document.body.appendChild(ev);
  await new Promise(r=>{ev.onloadedmetadata=r});ev.currentTime=c.s;await new Promise(r=>{ev.onseeked=r});
  const AC=window.AudioContext||window.webkitAudioContext,ac=new AC();await ac.resume();
  const st=cv.captureStream(30),dst=ac.createMediaStreamDestination();ac.createMediaElementSource(ev).connect(dst);
  dst.stream.getAudioTracks().forEach(t=>st.addTrack(t));
  const types=["video/mp4;codecs=avc1,mp4a.40.2","video/webm;codecs=vp9,opus","video/webm;codecs=vp8,opus","video/webm"];
  const mime=types.find(t=>window.MediaRecorder&&MediaRecorder.isTypeSupported(t))||"";
  if(!window.MediaRecorder)throw new Error("This browser cannot record video. Use Chrome, Edge, Firefox or Safari 14.1+.");
  const rec=new MediaRecorder(st,mime?{mimeType:mime,videoBitsPerSecond:12e6}:{}),parts=[];
  rec.ondataavailable=e=>e.data.size&&parts.push(e.data);
  const done=()=>{clearInterval(iv);ev.pause();ac.close();ev.remove()};
  rec.onstop=()=>{done();res({blob:new Blob(parts,{type:rec.mimeType||"video/webm"}),ext:(rec.mimeType||"").includes("mp4")?"mp4":"webm"})};
  rec.onerror=e=>{done();rej(e.error||new Error("Recording failed"))};
  const iv=setInterval(()=>{frame(x,ev,w,h,c.rf,c.rf?foc(c,ev):null);caps(x,w,h,c,ev.currentTime);const p=(ev.currentTime-c.s)/(c.e-c.s);onp(Math.min(1,Math.max(0,p)));
   if(ev.currentTime>=c.e-.05||ev.ended){clearInterval(iv);setTimeout(()=>rec.state!=="inactive"&&rec.stop(),150)}},33);
  if(S.mus!=="off")music(ac,dst,ac.currentTime+.05,c.e-c.s,S.mood,plan(c));rec.start(250);await ev.play();
 }catch(e){rej(e)}})}
async function keep(r,name){try{const id=rid();await dbPut("exportblobs",{id,blob:r.blob});
 await dbPut("exports",{id,name:(S.file?S.file.name+" – ":"")+name,ext:r.ext,size:r.blob.size,time:Date.now()});toast("Saved in My clips")}
 catch(e){toast("Could not save this clip inside the app (storage may be full). It was still downloaded.")}}
const save=(r,name)=>{keep(r,name);dlBlob(r.blob,name.replace(/[^\w\- ]/g,"")+"."+r.ext)};
$("#exp").onclick=async()=>{if(S.busy)return;const c=S.cur;v.pause();S.pm&&S.pm.stop();S.busy=true;$("#exp").disabled=true;$("#xinfo").style.display="block";$("#xl").textContent="Exporting…";
 try{const r=await exportClip(c,p=>{$("#xp").textContent=Math.round(p*100)+"%";$("#xb").style.width=p*100+"%"});
  S.last={r,name:c.title};save(r,c.title);$("#xl").textContent="Done. Saved to your downloads and My clips.";$("#xb").style.width="100%";
  if(navigator.canShare&&navigator.canShare({files:[new File([r.blob],c.title+"."+r.ext,{type:r.blob.type})]}))$("#share").style.display="block"}
 catch(e){toast(e.message||"Export failed");$("#xinfo").style.display="none"}
 S.busy=false;$("#exp").disabled=false;v.currentTime=c.s};
$("#share").onclick=()=>{const{r,name}=S.last;navigator.share({files:[new File([r.blob],name+"."+r.ext,{type:r.blob.type})],title:name}).catch(()=>{})};
$("#expall").onclick=async()=>{if(S.busy)return;S.busy=true;$("#expall").disabled=true;
 const L=S.clips.filter(c=>c.sel);if(!L.length){toast("Tick at least one clip first");S.busy=false;updSel();return}
 try{for(let i=0;i<L.length;i++){const c=L[i];$("#expall").textContent=`Exporting ${i+1} of ${L.length}…`;
  const r=await exportClip(c,()=>{});save(r,c.title);await new Promise(r=>setTimeout(r,600))}toast("Selected clips exported")}
 catch(e){toast(e.message||"Export failed")}
 S.busy=false;updSel()};

if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});

checkHelper();
