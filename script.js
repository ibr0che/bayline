// Show any JS error on the page instead of silently staying on "Loading…"
window.addEventListener('error',e=>{const m=document.getElementById('message');if(m){m.className='error';m.textContent='Script error: '+e.message+' ('+(e.filename||'').split('/').pop()+':'+e.lineno+')'}});
// If photos.js is missing, the Blog still renders (without photos)
if(typeof blogPhotos==='undefined')window.blogPhotos=[];

// ---------- Local data store (replaces Google Sheets / Apps Script) ----------
// Data lives in the browser's localStorage. Run resetLocalDb() in the console to start over.
const KEY = 'bayline-mock-db';
const seed = () => ({
  customers: [
    {id:'C-001',name:'Issa',email:'issa.demo@sdsu.edu',phone:'619-555-0101'},
    {id:'C-002',name:'Abshir',email:'abshir.demo@sdsu.edu',phone:'858-555-0102'},
    {id:'C-003',name:'Ibrahim',email:'ibrahim.demo@sdsu.edu',phone:'619-555-0103'},
    {id:'C-004',name:'AK',email:'ak.demo@sdsu.edu',phone:'858-555-0104'}
  ],
  vehicles: [
    {id:'V-001',name:'2015 Toyota Highlander',customer:'C-001',plate:'DEMO101',mileage:72000},
    {id:'V-002',name:'2005 Honda Civic',customer:'C-002',plate:'DEMO102',mileage:84000},
    {id:'V-003',name:'2024 Honda Civic (White)',customer:'C-003',plate:'DEMO103',mileage:62000},
    {id:'V-004',name:'2023 Chevrolet Corvette',customer:'C-004',plate:'DEMO104',mileage:0}
  ],
  parts: [
    {id:'P-001',name:'Engine oil filter',sku:'OIL-101',bin:'A-01',stock:12,reorder:3,price:14.5},
    {id:'P-002',name:'Front brake pads',sku:'BRK-210',bin:'B-02',stock:4,reorder:2,price:85},
    {id:'P-003',name:'DOT 4 brake fluid',sku:'FLD-401',bin:'B-01',stock:1,reorder:2,price:18},
    {id:'P-004',name:'Engine air filter',sku:'AIR-220',bin:'A-03',stock:2,reorder:3,price:24}
  ],
  orders: [
    {id:'WO-1001',title:'Oil and filter service',vehicle:'V-001',status:'Queued',due:'2026-10-20',labor:65,notes:'Routine oil service. Check tire pressures.',lines:[]},
    {id:'WO-1002',title:'Cold-start diagnosis',vehicle:'V-002',status:'In progress',due:'2026-10-21',labor:150,notes:'Inspect intake and record fault codes.',lines:[]},
    {id:'WO-1003',title:'Front brake service',vehicle:'V-003',status:'Ready for pickup',due:'2026-10-19',labor:180,notes:'Road test complete.',lines:[{part:'P-002',name:'Front brake pads',quantity:1,price:85}]},
    {id:'WO-1004',title:'Brake fluid service',vehicle:'V-001',status:'Completed',due:'2026-10-16',labor:90,notes:'Completed demonstration record.',lines:[{part:'P-003',name:'DOT 4 brake fluid',quantity:1,price:18}]},
    {id:'WO-1005',title:'General inspection',vehicle:'V-004',status:'Queued',due:'2026-10-24',labor:95,notes:'Inspect AK demo Corvette.',lines:[]}
  ],
  activity: [{id:'A-001',at:new Date().toISOString(),text:'Local mock workspace created with fictional sample records.'}]
});

let db;
try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
if (!db) db = seed();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} };
const uid = p => p + Math.random().toString(16).slice(2, 10).toUpperCase();
const clone = x => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const find = (list, id) => {
  const a = list.find(x => x.id === id);
  if (!a) throw new Error('Record not found. Refresh and try again.');
  return a;
};
const text = (v, max) => {
  v = String(v == null ? '' : v).trim();
  if (!v || v.length > (max || 120)) throw new Error('Please complete all required fields using shorter values.');
  return v;
};
const num = (v, int) => {
  const n = Number(v);
  if (v === '' || !isFinite(n) || n < 0 || n > 1e6 || (int && !Number.isInteger(n)))
    throw new Error('Enter a valid nonnegative ' + (int ? 'whole number' : 'amount') + '.');
  return n;
};

function api(action, d) {
  d = d || {};
  if (action === 'read') return clone(db);
  let event = '', r = d.record || {};
  if (action === 'add') {
    if (d.kind === 'customer') {
      r = {id:uid('C-'), name:text(r.name), email:text(r.email,180), phone:text(r.phone,40)};
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) throw new Error('Enter a valid email address.');
      db.customers.push(r); event = 'Added customer ' + r.name;
    } else if (d.kind === 'vehicle') {
      find(db.customers, r.customer);
      r = {id:uid('V-'), customer:r.customer, name:text(r.name), plate:text(r.plate,25).toUpperCase(), mileage:num(r.mileage,true)};
      if (db.vehicles.some(v => v.plate.toUpperCase() === r.plate)) throw new Error('A vehicle with this plate already exists.');
      db.vehicles.push(r); event = 'Added vehicle ' + r.name;
    } else if (d.kind === 'part') {
      r = {id:uid('P-'), name:text(r.name), sku:text(r.sku,40).toUpperCase(), bin:text(r.bin,40), stock:num(r.stock,true), reorder:num(r.reorder,true), price:num(r.price,false)};
      if (db.parts.some(p => p.sku.toUpperCase() === r.sku)) throw new Error('This SKU already exists. Use Receive to add stock.');
      db.parts.push(r); event = 'Added part ' + r.name;
    } else if (d.kind === 'order') {
      find(db.vehicles, r.vehicle);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(r.due)) || !isFinite(Date.parse(r.due))) throw new Error('Enter a valid due date.');
      r = {id:uid('WO-'), vehicle:r.vehicle, title:text(r.title), due:r.due, labor:num(r.labor,false), status:'Queued', notes:String(r.notes||'').slice(0,1500), lines:[]};
      db.orders.push(r); event = 'Created ' + r.id + ' · ' + r.title;
    } else throw new Error('Unknown record type.');
  } else if (action === 'receive') {
    const p = find(db.parts, d.id), q = num(d.quantity, true);
    if (q < 1) throw new Error('Quantity must be at least one.');
    p.stock += q; event = 'Received ' + q + ' × ' + p.name;
  } else if (action === 'reserve') {
    const o = find(db.orders, d.id), p = find(db.parts, d.part), q = num(d.quantity, true);
    if (['Completed','Cancelled'].includes(o.status)) throw new Error('Closed orders cannot be changed.');
    if (q < 1 || q > p.stock) throw new Error('Not enough available stock. Refresh inventory and try again.');
    if (o.lines.length >= 40) throw new Error('Maximum 40 reservation lines per order.');
    o.lines.push({part:p.id, name:p.name, quantity:q, price:p.price});
    p.stock -= q; event = 'Reserved ' + q + ' × ' + p.name + ' for ' + o.id;
  } else if (action === 'status') {
    const o = find(db.orders, d.id);
    if (['Completed','Cancelled'].includes(o.status)) throw new Error('Closed orders cannot be changed.');
    if (!['Queued','In progress','Ready for pickup','Completed','Cancelled'].includes(d.status)) throw new Error('Invalid status.');
    if (d.status === 'Cancelled') (o.lines || []).forEach(l => { find(db.parts, l.part).stock += l.quantity; });
    o.status = d.status; event = o.id + ' moved to ' + d.status;
  } else throw new Error('Unknown operation.');
  db.activity.push({id:uid('A-'), at:new Date().toISOString(), text:event});
  save();
  return clone(db);
}
window.resetLocalDb = () => { localStorage.removeItem(KEY); location.reload(); };
// -----------------------------------------------------------------------------

let state, page='Overview', query='', busy=false;
const pages=['Overview','Work orders','Customers','Vehicles','Parts & inventory','Reports','Blog','Field guide'];
const $=id=>document.getElementById(id), esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])), money=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(v)||0), closed=o=>['Completed','Cancelled'].includes(o.status);
function notify(t,bad=false){$('message').className=bad?'error':'good';$('message').textContent=t}
function call(action,data,done){if(busy)return;busy=true;const buttons=[...document.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);const finish=()=>{busy=false;buttons.forEach(b=>b.disabled=false)};
  setTimeout(()=>{try{const s=api(action,clone(data||{}));state=s;finish();$('connection').textContent='● Local data';render();if(done)done();}catch(e){finish();render();const message=e&&e.message?e.message:String(e);notify(message,true);if($('modal').open){const body=$('modalBody');let error=body.querySelector('.call-error');if(!error){error=document.createElement('p');error.className='error call-error';error.setAttribute('role','alert');body.prepend(error)}error.textContent=message}}},150);}
function go(p){page=p;query='';$('message').textContent='';render()}
function customer(id){return state.customers.find(c=>c.id===id)||{name:'Unknown'}}
function vehicle(id){return state.vehicles.find(v=>v.id===id)||{name:'Unknown'}}
function total(o){return Number(o.labor)+(o.lines||[]).reduce((a,l)=>a+l.quantity*l.price,0)}
function tag(s){return '<span class="tag '+(s==='Queued'||s==='Cancelled'?'warn':'')+'">'+esc(s)+'</span>'}
function table(head,rows){return '<div class="table"><table><thead><tr>'+head.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table>'+(rows.length?'':'<div class="empty">No matching records.</div>')+'</div>'}
function filter(arr){return arr.filter(x=>JSON.stringify(x).toLowerCase().includes(query.toLowerCase()))}
function toolbar(add,kind){return '<div class="toolbar"><input aria-label="Search records" placeholder="Search records…" value="'+esc(query)+'" oninput="search(this.value)"><button onclick="form(&quot;'+kind+'&quot;)">+ '+add+'</button><button class="alt" onclick="exportCsv()">Export CSV</button><button class="alt" onclick="call(&quot;read&quot;)">Refresh</button></div>'}
function search(v){query=v;const active=document.activeElement;render();const input=document.querySelector('[aria-label="Search records"]');if(input){input.focus();input.setSelectionRange(v.length,v.length)}}
function orderRows(list){return list.map(o=>'<tr><td><b>'+esc(o.title)+'</b><small>'+esc(o.id)+' · '+esc(vehicle(o.vehicle).name)+'</small></td><td>'+esc(customer(vehicle(o.vehicle).customer).name)+'</td><td>'+tag(o.status)+'</td><td>'+esc(o.due)+'</td><td>'+money(total(o))+'</td><td><button class="rowbtn alt" onclick="detail(&quot;'+o.id+'&quot;)">Open</button></td></tr>')}

// These are sample paragraphs for the group to review and personalize.
// Photos live in photos.js (const blogPhotos), loaded before this file.
const blogPosts=[
  {name:'Atharva Kirawant',role:'Group leader',title:'What we want to improve next',text:'Bayline is still a Phase 1 draft, but the main pages already show how customers, cars, jobs, and inventory fit together. Our next steps are to keep testing the forms and build out the database side. The goal is to make the app useful while keeping it straightforward for someone new to it.'},
  {name:'Abshir Haybe',title:'Keeping work orders organized',text:'The work order page is the part of Bayline I find most useful. Each job has a vehicle, a due date, and a status, so you can tell what is waiting, what is in progress, and what is ready for pickup. It makes the demo feel like a tool a garage could actually build on.'},
  {name:'Ibrahim Ali',title:'Thinking about parts',text:'A repair is not just a name on a list. Shops also need to know whether the right parts are available. Our prototype tracks parts and stock amounts, and a work order can reserve a part. We kept the first version small so we can explain how the records connect.'},
  {name:'Issa Alwazir',title:'Why we picked a garage',text:'We picked a garage because even a small shop has a lot to keep track of. Bayline puts customers, vehicles, and repair jobs in one place so it is easier to see which car belongs to which person. For Phase 1, our goal was a simple prototype that someone can click through and understand.'}
];

function render(){if(!state)return;$('nav').innerHTML=pages.filter(p=>p!=='Blog').map(p=>'<button class="'+(page===p?'on':'')+'" onclick="go(&quot;'+p+'&quot;)">'+p+'</button>').join('');$('blogShortcut').classList.toggle('on',page==='Blog');let h='<p class="sub">NORTH PARK GARAGE / DEMO WORKSPACE</p><h1>'+esc(page)+'</h1>';
if(page==='Overview'){let active=state.orders.filter(o=>!closed(o));h='<p class="sub">LET’S MAKE TODAY A GOOD ONE</p><h1>Your garage, at a glance.</h1><p class="sub">Every job, every part and what’s next.</p><div class="hero"><h2>Less paperwork.<br>More road ahead.</h2><p>'+active.length+' jobs in the works. One place to keep them moving.</p><button onclick="form(&quot;order&quot;)">+ New work order</button></div><div class="cards">'+[['Active jobs',active.length],['Ready for pickup',state.orders.filter(o=>o.status==='Ready for pickup').length],['Low-stock parts',state.parts.filter(p=>p.stock<=p.reorder).length],['Completed value',money(state.orders.filter(o=>o.status==='Completed').reduce((a,o)=>a+total(o),0))]].map(a=>'<div class="card">'+a[0]+'<strong>'+a[1]+'</strong></div>').join('')+'</div><h2>On the workbench</h2>'+table(['Job / vehicle','Customer','Status','Due','Estimate',''],orderRows(active.sort((a,b)=>a.due.localeCompare(b.due))));}
if(page==='Work orders'){h+='<p class="sub">Move every repair from check-in to completion.</p>'+toolbar('New work order','order')+table(['Job / vehicle','Customer','Status','Due','Estimate',''],orderRows(filter(state.orders)));}
if(page==='Customers'){h+='<p class="sub">The people behind every vehicle.</p>'+toolbar('Add customer','customer')+table(['Customer','Email','Phone','Vehicles'],filter(state.customers).map(c=>'<tr><td><b>'+esc(c.name)+'</b><small>'+esc(c.id)+'</small></td><td>'+esc(c.email)+'</td><td>'+esc(c.phone)+'</td><td>'+state.vehicles.filter(v=>v.customer===c.id).length+'</td></tr>'));}
if(page==='Vehicles'){h+='<p class="sub">A service history that stays with the vehicle.</p>'+toolbar('Add vehicle','vehicle')+table(['Vehicle','Customer','Plate','Odometer','Jobs'],filter(state.vehicles).map(v=>'<tr><td><b>'+esc(v.name)+'</b><small>'+esc(v.id)+'</small></td><td>'+esc(customer(v.customer).name)+'</td><td>'+esc(v.plate)+'</td><td>'+Number(v.mileage).toLocaleString()+' mi</td><td>'+state.orders.filter(o=>o.vehicle===v.id).length+'</td></tr>'));}
if(page==='Parts & inventory'){h+='<p class="sub">Stock is deducted when parts are reserved. Cancellation returns it.</p>'+toolbar('Add part','part')+table(['Part','SKU / bin','Available','Reorder level','Unit price',''],filter(state.parts).map(p=>'<tr><td><b>'+esc(p.name)+'</b></td><td>'+esc(p.sku)+'<small>'+esc(p.bin)+'</small></td><td>'+tag(p.stock+' in stock')+(p.stock<=p.reorder?' <span class="tag warn">Reorder</span>':'')+'</td><td>'+p.reorder+'</td><td>'+money(p.price)+'</td><td><button class="rowbtn alt" onclick="receive(&quot;'+p.id+'&quot;)">Receive</button></td></tr>'));}
if(page==='Reports'){let complete=state.orders.filter(o=>o.status==='Completed');h+='<p class="sub">Calculated from the current shared records.</p><div class="toolbar"><button onclick="exportCsv()">Export work orders CSV</button><button class="alt" onclick="call(&quot;read&quot;)">Refresh data</button></div><div class="cards">'+[['Completed orders',complete.length],['Completed value',money(complete.reduce((a,o)=>a+total(o),0))],['Labor value',money(complete.reduce((a,o)=>a+Number(o.labor),0))],['Reserved parts value',money(state.orders.filter(o=>!closed(o)).reduce((a,o)=>a+(o.lines||[]).reduce((b,l)=>b+l.price*l.quantity,0),0))]].map(a=>'<div class="card">'+a[0]+'<strong>'+a[1]+'</strong></div>').join('')+'</div><h2>Work by status</h2>'+table(['Status','Orders','Order value'],['Queued','In progress','Ready for pickup','Completed','Cancelled'].map(s=>{let a=state.orders.filter(o=>o.status===s);return '<tr><td>'+tag(s)+'</td><td>'+a.length+'</td><td>'+money(a.reduce((t,o)=>t+total(o),0))+'</td></tr>'}))+'<h2>Recent activity</h2>'+table(['Time','Event'],state.activity.slice(-15).reverse().map(a=>'<tr><td>'+esc(a.at)+'</td><td>'+esc(a.text)+'</td></tr>'));}
if(page==='Blog'){h='<div class="blog-hero"><h1>Blog</h1></div><div class="blog-list">'+blogPosts.map((p,i)=>'<article class="blog-entry"><figure class="blog-figure"><div class="blog-photo">'+(blogPhotos[i]?'<img src="'+blogPhotos[i]+'" alt="Photo of '+esc(p.name)+'">':'<div class="blog-initials">'+esc(p.name.split(' ').map(w=>w[0]).join('').slice(0,2))+'</div>')+'</div><figcaption>'+esc(p.name)+(p.role?' <span>'+esc(p.role)+'</span>':'')+'</figcaption></figure><div class="blog-copy"><div class="blog-meta">0'+(i+1)+' / PROJECT BLOG</div><h2>'+esc(p.title)+'</h2><div class="blog-byline">By '+esc(p.name)+'</div><p>'+esc(p.text)+'</p></div></article>').join('')+'</div>';}
if(page==='Field guide'){h+='<div class="split"><div class="card"><h2>Start a repair</h2><p>1. Add the customer, then add their vehicle.</p><p>2. Create a work order with a due date, description and labor amount.</p><p>3. Open the job and reserve available parts.</p><p>4. Move the job to In progress, Ready for pickup, then Completed.</p></div><div class="card"><h2>Inventory and records</h2><p>Reservations reduce available stock immediately. Cancelling an open job returns its reserved parts. Completed jobs keep their recorded prices and cannot be changed.</p><p>Use Receive to add stock and Export CSV to download records. Refresh loads changes made by other visitors.</p></div></div><div class="card" style="margin-top:20px"><h2>About this version</h2><p>Built from scratch for Google Sites with Google Apps Script and a dedicated Google Sheets record store. The Google Site contains the project pages. The application and shared records run on Google services.</p><p>This is a public coursework demo. Use fictional customer and vehicle data. Google Sheets is a record store, not a SQL database; this version does not claim SQL transactions or database indexing.</p></div>';}
$('view').innerHTML=h;}
function show(html){$('modalBody').innerHTML=html;$('modal').showModal()}
function closeModal(){$('modal').close()}
function field(label,name,type='text',value='',extra=''){return '<label>'+label+'<input name="'+name+'" type="'+type+'" value="'+esc(value)+'" '+extra+' required></label>'}
function select(label,name,options){return '<label>'+label+'<select name="'+name+'" required>'+options+'</select></label>'}
function opts(a,fn){return a.map(x=>'<option value="'+esc(x.id)+'">'+esc(fn(x))+'</option>').join('')}
function form(kind){let fields='';if(kind==='customer')fields=field('Full name','name')+field('Email','email','email')+field('Phone','phone','tel');if(kind==='vehicle'){if(!state.customers.length)return notify('Add a customer first.',true);fields=select('Customer','customer',opts(state.customers,c=>c.name))+field('Year / make / model','name')+field('Plate','plate')+field('Odometer (miles)','mileage','number',0,'min="0" step="1"');}if(kind==='part')fields=field('Part name','name')+field('SKU','sku')+field('Bin','bin')+field('Available units','stock','number',0,'min="0" step="1"')+field('Reorder level','reorder','number',2,'min="0" step="1"')+field('Unit price ($)','price','number',0,'min="0" step="0.01"');if(kind==='order'){if(!state.vehicles.length)return notify('Add a vehicle first.',true);fields=select('Vehicle','vehicle',opts(state.vehicles,v=>v.name+' — '+customer(v.customer).name))+field('Job description','title')+field('Due date','due','date',new Date().toISOString().slice(0,10))+field('Labor amount ($)','labor','number',0,'min="0" step="0.01"')+'<label>Notes<textarea name="notes" maxlength="1500"></textarea></label>';}
show('<h2>'+({customer:'Add customer',vehicle:'Add vehicle',part:'Add inventory part',order:'New work order'}[kind])+'</h2><form onsubmit="submitForm(event,&quot;'+kind+'&quot;)">'+fields+'<div class="actions"><button type="button" class="alt" onclick="closeModal()">Cancel</button><button>Save record</button></div></form>');}
function submitForm(e,kind){e.preventDefault();let data=Object.fromEntries(new FormData(e.target));call('add',{kind:kind,record:data},()=>{closeModal();if(kind==='order'){page='Work orders';query='';render()}notify('Record saved.')})}
function detail(id){let o=state.orders.find(o=>o.id===id);show('<h2>'+esc(o.title)+'</h2><p>'+esc(vehicle(o.vehicle).name)+' · '+esc(customer(vehicle(o.vehicle).customer).name)+'</p>'+tag(o.status)+'<div class="detail">Due: '+esc(o.due)+'<br>Labor: '+money(o.labor)+'<br><b>Total: '+money(total(o))+'</b><p>'+esc(o.notes||'No notes.')+'</p></div><h3>Reserved parts</h3>'+((o.lines||[]).map(l=>'<p>'+esc(l.name)+' × '+l.quantity+' — '+money(l.price*l.quantity)+'</p>').join('')||'<p>No parts reserved.</p>')+(!closed(o)?'<form onsubmit="reserve(event,&quot;'+id+'&quot;)">'+select('Reserve a part','part',opts(state.parts.filter(p=>p.stock>0),p=>p.name+' ('+p.stock+' available)'))+field('Quantity','quantity','number',1,'min="1" step="1"')+'<button>Reserve parts</button></form><hr><form onsubmit="updateOrderStatus(event,&quot;'+id+'&quot;)">'+select('Move job to','status',['Queued','In progress','Ready for pickup','Completed','Cancelled'].map(s=>'<option '+(s===o.status?'selected':'')+'>'+s+'</option>').join(''))+'<button>Update status</button></form>':'<p>This job is closed. Pricing history is preserved.</p>')+'<div class="actions"><button class="alt" onclick="closeModal()">Close</button></div>');}
function reserve(e,id){e.preventDefault();let d=Object.fromEntries(new FormData(e.target));d.id=id;call('reserve',d,()=>detailRefresh(id))}
function updateOrderStatus(e,id){e.preventDefault();call('status',{id:id,status:new FormData(e.target).get('status')},()=>detailRefresh(id))}
function detailRefresh(id){closeModal();detail(id);notify('Work order updated.')}
function receive(id){let p=state.parts.find(p=>p.id===id);show('<h2>Receive '+esc(p.name)+'</h2><form onsubmit="stockIn(event,&quot;'+id+'&quot;)">'+field('Quantity received','quantity','number',1,'min="1" step="1"')+'<div class="actions"><button type="button" class="alt" onclick="closeModal()">Cancel</button><button>Receive stock</button></div></form>')}
function stockIn(e,id){e.preventDefault();call('receive',{id:id,quantity:new FormData(e.target).get('quantity')},()=>{closeModal();notify('Stock received.')})}
function exportCsv(){let rows;if(page==='Customers')rows=[['ID','Name','Email','Phone'],...state.customers.map(c=>[c.id,c.name,c.email,c.phone])];else if(page==='Vehicles')rows=[['ID','Vehicle','Customer','Plate','Mileage'],...state.vehicles.map(v=>[v.id,v.name,customer(v.customer).name,v.plate,v.mileage])];else if(page==='Parts & inventory')rows=[['ID','Part','SKU','Bin','Available','Reorder','Unit price'],...state.parts.map(p=>[p.id,p.name,p.sku,p.bin,p.stock,p.reorder,p.price])];else rows=[['ID','Job','Vehicle','Customer','Status','Due','Labor','Total'],...state.orders.map(o=>[o.id,o.title,vehicle(o.vehicle).name,customer(vehicle(o.vehicle).customer).name,o.status,o.due,o.labor,total(o)])];let csv=rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""').replace(/^[=+@-]/,"'$&")+'"').join(',')).join('\r\n');let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='Bayline-'+page.replace(/[^a-z]/gi,'-')+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
call('read');
