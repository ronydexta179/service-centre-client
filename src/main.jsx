import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { EmailAuthProvider, onAuthStateChanged, reauthenticateWithCredential, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut, updateProfile } from 'firebase/auth';
import { Activity, Archive, BarChart3, Bell, CalendarDays, Check, ChevronDown, ClipboardList, Clock3, Download, Eye, EyeOff, FilePlus2, FileText, Filter, LayoutDashboard, LogOut, Menu, Package, Phone, Plus, Search, Settings, ShieldCheck, Trash2, Wallet, Wrench, X } from 'lucide-react';
import { auth, firebaseConfigured } from './firebase';
import { apiRequest, connectRealtime } from './api';
import './styles.css';

const STATUSES = ['Pending', 'Ready', 'Waiting-Spare', 'Collected'];
const APPLIANCE_STATUSES = ['Pending', 'Ready', 'Waiting-Spare'];
const READY_TYPES = ['Pending Collection', 'Collected'];
const nav = [
  { id:'dashboard', label:'Dashboard', icon:LayoutDashboard },
  { id:'new', label:'Register a record', icon:FilePlus2 },
  { id:'records', label:'All records', icon:ClipboardList },
  { id:'status', label:'Work status', icon:Activity },
  { id:'finance', label:'Finance', icon:Wallet },
  { id:'appliances', label:'Home appliances', icon:Package },
  { id:'receiveNotes', label:'Delivery notes', icon:Archive },
  { id:'pendingCalls', label:'Pending calls', icon:Phone },
  { id:'reports', label:'Reports', icon:BarChart3 },
];
const today = () => new Date().toISOString().slice(0,10);
const currentTime = () => { const date=new Date(); return `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`; };
const timeFromCreatedAt = (value) => { const date=new Date(value); return value&&!Number.isNaN(date.getTime())?date.toTimeString().slice(0,5):''; };
const fmt = (d) => d ? new Date(`${d}T00:00:00`).toLocaleDateString(undefined,{day:'2-digit',month:'short',year:'numeric'}) : '—';
const fmtTimestamp = (value) => { const date=new Date(value); return value&&!Number.isNaN(date.getTime())?date.toLocaleString():'—'; };
const fmtKes = (value) => new Intl.NumberFormat('en-KE',{style:'currency',currency:'KES'}).format(Number(value||0));
const isSameWeek = (date) => { if(!date) return false; const d=new Date(`${date}T00:00:00`), now=new Date(); const start=new Date(now); start.setHours(0,0,0,0); start.setDate(now.getDate()-((now.getDay()+6)%7)); const end=new Date(start); end.setDate(start.getDate()+7); return d>=start && d<end; };
const isSameMonth = (date) => date && date.slice(0,7)===today().slice(0,7);

function AuthScreen(){
  const [mode,setMode]=useState('login');
  const [name,setName]=useState('');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [showPassword,setShowPassword]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const isReset=mode==='reset';
  const clearFeedback=()=>{setError('');setMessage('');};
  const submit=async(e)=>{
    e.preventDefault();
    setBusy(true);
    clearFeedback();
    try{
      if(!isReset&&!name.trim())throw new Error('Please enter your name.');
      if(isReset){
        await sendPasswordResetEmail(auth,email);
        setMessage('Password reset email sent. Check your inbox for the reset link.');
      }else if(mode==='login'){
        const {user}=await signInWithEmailAndPassword(auth,email,password);
        await updateProfile(user,{displayName:name.trim()});
        await user.getIdToken(true);
      }else{
        const {user}=await createUserWithEmailAndPassword(auth,email,password);
        await updateProfile(user,{displayName:name.trim()});
        await user.getIdToken(true);
      }
    }catch(err){
      setError(err.message.replace('Firebase: ',''));
    }finally{
      setBusy(false);
    }
  };
  const changeMode=(nextMode)=>{setMode(nextMode);clearFeedback();};
  return <div className="auth-wrap"><div className="auth-card">
    <div className="brand-mark"><Wrench size={22}/></div>
    <p className="eyebrow">SERVICE CENTRE MANAGEMENT</p>
    <h1>{isReset?'Reset your password':mode==='login'?'Welcome back':'Create your account'}</h1>
    <p className="muted">{isReset?'Enter your account email and we’ll send you a password reset link.':'Sign in to manage service records and reports.'}</p>
    <form onSubmit={submit} className="stack">
      {!isReset&&<label>Name<input type="text" required maxLength="80" autoComplete="name" value={name} onChange={event=>setName(event.target.value)} placeholder="Your name"/></label>}
      <label>Email address<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@company.com" autoComplete="email"/></label>
      {!isReset&&<label>Password<div className="password-input"><input type={showPassword?'text':'password'} minLength="6" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete={mode==='login'?'current-password':'new-password'}/><button type="button" className="password-toggle" onClick={()=>setShowPassword(value=>!value)} aria-label={showPassword?'Hide password':'Show password'} aria-pressed={showPassword}><span>{showPassword?'Hide':'Show'}</span>{showPassword?<EyeOff size={16}/>:<Eye size={16}/>}</button></div></label>}
      {mode==='login'&&<div className="forgot-password"><button type="button" className="link" onClick={()=>changeMode('reset')}>Forgot password?</button></div>}
      {error&&<div className="error" role="alert">{error}</div>}
      {message&&<div className="success" role="status">{message}</div>}
      <button className="primary full" disabled={busy}>{busy?'Please wait…':isReset?'Send reset link':mode==='login'?'Sign in':'Create account'}</button>
    </form>
    {isReset
      ? <p className="switch-auth"><button className="link" onClick={()=>changeMode('login')}>Back to sign in</button></p>
      : <p className="switch-auth">{mode==='login'?"New to the system? ":'Already registered? '}<button className="link" onClick={()=>changeMode(mode==='login'?'signup':'login')}>{mode==='login'?'Create an account':'Sign in'}</button></p>}
    <p className="tiny muted">Your records are stored securely in MongoDB.</p>
  </div></div>
}

function App(){
 const [user,setUser]=useState(null);
 const [authReady,setAuthReady]=useState(false);
 const [records,setRecords]=useState([]);
 const [itemTypes,setItemTypes]=useState([]);
 const [deletingRecordIds,setDeletingRecordIds]=useState(()=>new Set());
 const deletingRecordIdsRef=useRef(new Set());
 const [pettyCashEntries,setPettyCashEntries]=useState([]);
 const [pettyCashFundLoads,setPettyCashFundLoads]=useState([]);
 const [appliances,setAppliances]=useState([]);
 const [receiveNotes,setReceiveNotes]=useState([]);
 const [calls,setCalls]=useState([]);
 const [invoices,setInvoices]=useState([]);
 const [pettyCashLoading,setPettyCashLoading]=useState(true);
 const [pettyCashFundLoadsLoading,setPettyCashFundLoadsLoading]=useState(true);
 const [appliancesLoading,setAppliancesLoading]=useState(true);
 const [receiveNotesLoading,setReceiveNotesLoading]=useState(true);
 const [callsLoading,setCallsLoading]=useState(true);
 const [invoicesLoading,setInvoicesLoading]=useState(true);
 const [page,setPage]=useState('dashboard');
 const [recordType,setRecordType]=useState('jobCard');
 const [loading,setLoading]=useState(true);
 const [search,setSearch]=useState('');
 const [mobileNav,setMobileNav]=useState(false);
 const [toast,setToast]=useState(null);
 const [deleteConfirmation,setDeleteConfirmation]=useState('');
 const deleteConfirmationResolver=useRef(null);
 const [editing,setEditing]=useState(null);
 useEffect(()=>{if(!auth){setAuthReady(true);return;}return onAuthStateChanged(auth,u=>{setUser(u);setAuthReady(true)});},[]);
 useEffect(()=>{if(!mobileNav)return;const closeOnOutsideClick=(event)=>{if(!(event.target instanceof Element)||!event.target.closest('.sidebar.open, .mobile-menu'))setMobileNav(false);};document.addEventListener('pointerdown',closeOnOutsideClick);return()=>document.removeEventListener('pointerdown',closeOnOutsideClick);},[mobileNav]);
 useEffect(()=>{
  if(!user){setRecords([]);setItemTypes([]);deletingRecordIdsRef.current=new Set();setDeletingRecordIds(new Set());setPettyCashEntries([]);setPettyCashFundLoads([]);setAppliances([]);setReceiveNotes([]);setCalls([]);setInvoices([]);setPettyCashLoading(false);setPettyCashFundLoadsLoading(false);setAppliancesLoading(false);setReceiveNotesLoading(false);setCallsLoading(false);setInvoicesLoading(false);setLoading(false);return;}
  let active=true;
  let socket;
  setLoading(true);
  setPettyCashLoading(true);
  setPettyCashFundLoadsLoading(true);
  setAppliancesLoading(true);
  setReceiveNotesLoading(true);
  setCallsLoading(true);
  setInvoicesLoading(true);
  const loadRecords=async()=>{
   try{const data=await apiRequest(user,'/api/records');if(active)setRecords(current=>{const loadedIds=new Set(data.map(record=>record.id));const recordsAnimatingOut=current.filter(record=>deletingRecordIdsRef.current.has(record.id)&&!loadedIds.has(record.id));return [...data,...recordsAnimatingOut];});}
   catch(e){console.error(e);if(active)setToast({message:`Could not load records: ${e.message}`,type:'error'});}
   finally{if(active)setLoading(false);}
  };
  const loadItemTypes=async()=>{
   try{const data=await apiRequest(user,'/api/item-types');if(active)setItemTypes(data);}
   catch(e){console.error(e);if(active)setToast({message:`Could not load item types: ${e.message}`,type:'error'});}
  };
  const loadResource=(path,setter,setResourceLoading,label)=>async()=>{
   try{const data=await apiRequest(user,path);if(active)setter(data);}
   catch(e){console.error(e);if(active)setToast({message:`Could not load ${label}: ${e.message}`,type:'error'});}
   finally{if(active)setResourceLoading(false);}
  };
  const loadPettyCash=loadResource('/api/petty-cash',setPettyCashEntries,setPettyCashLoading,'petty cash entries');
  const loadPettyCashFundLoads=loadResource('/api/petty-cash/loads',setPettyCashFundLoads,setPettyCashFundLoadsLoading,'petty cash fund loads');
  const loadAppliances=loadResource('/api/appliances',setAppliances,setAppliancesLoading,'home appliances');
  const loadReceiveNotes=loadResource('/api/receive-notes',setReceiveNotes,setReceiveNotesLoading,'delivery notes');
  const loadCalls=loadResource('/api/calls',setCalls,setCallsLoading,'calls');
  const loadInvoices=loadResource('/api/invoices',setInvoices,setInvoicesLoading,'invoices');
  loadRecords();
  loadItemTypes();
  loadPettyCash();
  loadPettyCashFundLoads();
  loadAppliances();
  loadReceiveNotes();
  loadCalls();
  loadInvoices();
  connectRealtime(user).then(connection=>{
   if(!active){connection.disconnect();return;}
   socket=connection;
   socket.on('records:changed',loadRecords);
   socket.on('item-types:changed',loadItemTypes);
   socket.on('petty-cash:changed',()=>{loadPettyCash();loadPettyCashFundLoads();});
   socket.on('appliances:changed',loadAppliances);
   socket.on('receive-notes:changed',loadReceiveNotes);
   socket.on('calls:changed',loadCalls);
   socket.on('invoices:changed',loadInvoices);
  }).catch(e=>{console.error('Realtime connection failed:',e);});
  return()=>{active=false;socket?.disconnect();};
 },[user]);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(null),3500);return()=>clearTimeout(t)},[toast]);
 const counts=useMemo(()=>{const jobs=records.filter(r=>r.recordType!=='gatePass');return {total:jobs.length,pending:jobs.filter(r=>r.status==='Pending').length,ready:jobs.filter(r=>r.status==='Ready').length,spares:jobs.filter(r=>r.status==='Waiting-Spare').length,collection:jobs.filter(r=>r.status==='Ready'&&r.readyCategory==='Pending Collection').length,collected:jobs.filter(r=>r.status==='Collected'||(r.status==='Ready'&&r.readyCategory==='Collected')).length}},[records]);
 const notify=(message,type='success')=>setToast({message,type});
 const createItemType=async(name)=>{
  const created=await apiRequest(user,'/api/item-types',{method:'POST',body:{name}});
  setItemTypes(current=>Array.from(new Map([...current,created.name].map(type=>[type.toLowerCase(),type])).values()).sort((first,second)=>first.localeCompare(second)));
  return created.name;
 };
 const setRecordDeleting=(id,deleting)=>{
  const next=new Set(deletingRecordIdsRef.current);
  if(deleting)next.add(id);else next.delete(id);
  deletingRecordIdsRef.current=next;
  setDeletingRecordIds(next);
 };
 const confirmDelete=(message)=>new Promise(resolve=>{
  if(deleteConfirmationResolver.current){resolve(false);return;}
  deleteConfirmationResolver.current=resolve;
  setDeleteConfirmation(message);
 });
 const resolveDeleteConfirmation=confirmed=>{
  deleteConfirmationResolver.current?.(confirmed);
  deleteConfirmationResolver.current=null;
  setDeleteConfirmation('');
 };
 const saveRecord=async(data,id)=>{try{const saved=await apiRequest(user,id?`/api/records/${id}`:'/api/records',{method:id?'PUT':'POST',body:data});const collectedJobCards=saved.collectedJobCards||[];if(collectedJobCards.length){const collectedById=new Map(collectedJobCards.map(record=>[record.id,record]));setRecords(current=>current.map(record=>collectedById.get(record.id)||record));}if(data.recordType==='gatePass'){notify(collectedJobCards.length?`Gate pass saved. ${collectedJobCards.length} matching job card${collectedJobCards.length===1?'':'s'} marked collected.`:'Gate pass saved, but no job cards matched both model and serial.',collectedJobCards.length?'success':'warning');}else if(id)notify('Record updated successfully.');else notify('New record saved successfully.');setRecordType(data.recordType==='gatePass'?'gatePass':'jobCard');setPage('records');setEditing(null);}catch(e){notify(`Save failed: ${e.message}`,'error')}};
 const saveInvoice=async(data)=>{
  try{
   const saved=await apiRequest(user,'/api/invoices',{method:'POST',body:data});
   setInvoices(current=>[saved,...current.filter(invoice=>invoice.id!==saved.id)]);
   notify(`Invoice ${saved.invoiceNumber} created successfully.`);
   return saved;
  }catch(e){notify(`Could not create invoice: ${e.message}`,'error');return null;}
 };
 const removeRecord=async(id)=>{if(!await confirmDelete('Delete this service record permanently?'))return;setRecordDeleting(id,true);try{await apiRequest(user,`/api/records/${id}`,{method:'DELETE'});await new Promise(resolve=>setTimeout(resolve,350));setRecordDeleting(id,false);setRecords(current=>current.filter(record=>record.id!==id));notify('Record deleted.');}catch(e){setRecordDeleting(id,false);notify(`Delete failed: ${e.message}`,'error')}};
 const saveResource=async(path,label,data,id)=>{
  try{
   const saved=await apiRequest(user,id?`${path}/${id}`:path,{method:id?'PUT':'POST',body:data});
   const updateEntries=setter=>setter(current=>{
    const existing=current.some(entry=>entry.id===saved.id);
    if(id)return existing?current.map(entry=>entry.id===saved.id?saved:entry):[saved,...current];
    return [saved,...current.filter(entry=>entry.id!==saved.id)];
   });
   if(path==='/api/petty-cash')updateEntries(setPettyCashEntries);
   if(path==='/api/petty-cash/loads')updateEntries(setPettyCashFundLoads);
   if(path==='/api/appliances')updateEntries(setAppliances);
   if(path==='/api/receive-notes')updateEntries(setReceiveNotes);
   if(path==='/api/calls')updateEntries(setCalls);
   notify(`${label} ${id?'updated':'added'} successfully.`);
   return true;
  }catch(e){notify(`Could not save ${label.toLowerCase()}: ${e.message}`,'error');return false;}
 };
 const removeResource=async(path,label,id)=>{
  if(!await confirmDelete(`Delete this ${label.toLowerCase()} permanently?`))return false;
  try{
   await apiRequest(user,`${path}/${id}`,{method:'DELETE'});
   if(path==='/api/petty-cash')setPettyCashEntries(current=>current.filter(entry=>entry.id!==id));
   if(path==='/api/petty-cash/loads')setPettyCashFundLoads(current=>current.filter(entry=>entry.id!==id));
   if(path==='/api/appliances')setAppliances(current=>current.filter(entry=>entry.id!==id));
   if(path==='/api/receive-notes')setReceiveNotes(current=>current.filter(entry=>entry.id!==id));
   if(path==='/api/calls')setCalls(current=>current.filter(entry=>entry.id!==id));
   notify(`${label} deleted.`);
   return true;
  }catch(e){notify(`Could not delete ${label.toLowerCase()}: ${e.message}`,'error');return false;}
 };
 const createPettyCashDeleteChallenge=(transaction,challengeUser=user)=>{
  const path=transaction.direction==='IN'?'/api/petty-cash/loads':'/api/petty-cash';
  return apiRequest(challengeUser,`${path}/${transaction.sourceId}/delete-challenge`,{method:'POST'});
 };
 const removeVerifiedPettyCashResource=async(transaction,challengeId,verifiedUser)=>{
  const isFundLoad=transaction.direction==='IN';
  const path=isFundLoad?'/api/petty-cash/loads':'/api/petty-cash';
  const label=isFundLoad?'Petty cash fund load':'Petty cash entry';
  try{
  await apiRequest(verifiedUser,`${path}/${transaction.sourceId}`,{method:'DELETE',headers:{'X-Petty-Cash-Delete-Challenge':challengeId},forceRefreshToken:true});
  if(isFundLoad)setPettyCashFundLoads(current=>current.filter(entry=>entry.id!==transaction.sourceId));
  else setPettyCashEntries(current=>current.filter(entry=>entry.id!==transaction.sourceId));
  notify(`${label} deleted.`);
  return true;
  }catch(e){notify(`Could not delete ${label.toLowerCase()}: ${e.message}`,'error');return false;}
 };
 if(!firebaseConfigured)return <div className="setup-screen"><div className="setup-card"><div className="brand-mark"><Wrench/></div><p className="eyebrow">INITIAL SETUP</p><h1>Connect your Firebase project</h1><p className="muted">The app is ready. Add your Firebase web app credentials to the <code>.env</code> file, then restart the development server.</p><ol><li>Open Firebase Console and create a project.</li><li>Add a Web App and copy its configuration.</li><li>Enable Email/Password under Authentication → Sign-in method.</li><li>Configure MongoDB and Firebase Admin credentials for the API.</li><li>Copy <code>.env.example</code> to <code>.env</code> and fill in the values.</li></ol><p className="tiny muted">Full instructions are in README.md.</p></div></div>;
 if(!authReady)return <div className="loading-screen">Loading service centre…</div>;
 if(!user)return <AuthScreen/>;
 const active=nav.find(n=>n.id===page)?.label||'Dashboard';
 const allRecordCount=records.length+pettyCashEntries.length+pettyCashFundLoads.length+appliances.length+receiveNotes.length+calls.length;
 return <div className="app-shell">
  <aside className={`sidebar ${mobileNav?'open':''}`}>
   <div className="side-brand"><div className="brand-mark small"><Wrench size={18}/></div><div><strong>Service Centre</strong><span>RECORDS MANAGEMENT</span></div><button className="mobile-close" onClick={()=>setMobileNav(false)}><X/></button></div>
   <div className="workspace-label">WORKSPACE</div>
   <nav>{nav.map(item=>{
    const Icon=item.icon;
    const navCount=item.id==='records'?allRecordCount:item.id==='finance'?pettyCashEntries.length+pettyCashFundLoads.length+invoices.length:item.id==='appliances'?appliances.length:item.id==='receiveNotes'?receiveNotes.length:item.id==='pendingCalls'?calls.filter(call=>call.status!=='Sorted').length:undefined;
    return <button key={item.id} className={`nav-item ${page===item.id?'active':''}`} onClick={()=>{setPage(item.id);setEditing(null);setMobileNav(false)}}>
     <Icon size={18}/><span>{item.label}</span>{navCount!==undefined&&<span className="nav-count">{navCount}</span>}
    </button>;
   })}</nav>
   <div className="sidebar-bottom"><div className="secure-note"><ShieldCheck size={16}/><span>Connected to Firebase</span></div><div className="user-row"><div className="avatar">{(user.displayName||user.email||'U')[0].toUpperCase()}</div><div className="user-info"><strong>{user.displayName||user.email}</strong><span>{user.email}</span></div><button className="icon-btn" title="Sign out" onClick={()=>signOut(auth)}><LogOut size={17}/></button></div></div>
  </aside>
  <main className="main-area">
   <header className="topbar"><button className="mobile-menu icon-btn" onClick={()=>setMobileNav(true)}><Menu/></button><div><p className="breadcrumb">WORKSPACE <span>/</span> {active.toUpperCase()}</p><h2>{active}</h2></div><div className="top-actions"><div className="today-chip"><CalendarDays size={15}/>{new Date().toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short',year:'numeric'})}</div><div className="top-avatar" title={user.displayName||user.email}>{(user.displayName||user.email||'U')[0].toUpperCase()}</div></div></header>
   <div className="content">
    {page==='dashboard'&&<Dashboard records={records} counts={counts} loading={loading} setPage={setPage} setSearch={setSearch} onEdit={r=>setEditing(r)}/>}
    {page==='new'&&<RecordForm initial={editing} itemTypes={itemTypes} onCreateItemType={createItemType} onSave={saveRecord} onCancel={()=>{setEditing(null);setPage('records')}}/>}
    {page==='records'&&<AllRecordsPage serviceRecords={records} serviceRecordCount={records.length} deletingRecordIds={deletingRecordIds} pettyCashEntries={pettyCashEntries} pettyCashFundLoads={pettyCashFundLoads} appliances={appliances} receiveNotes={receiveNotes} calls={calls} pettyCashLoading={pettyCashLoading} pettyCashFundLoadsLoading={pettyCashFundLoadsLoading} appliancesLoading={appliancesLoading} receiveNotesLoading={receiveNotesLoading} callsLoading={callsLoading} search={search} setSearch={setSearch} recordType={recordType} setRecordType={setRecordType} loading={loading} onEdit={record=>setEditing(record)} onDelete={removeRecord}/>}
    {page==='status'&&<RecordsPage page="status" records={records} allCount={records.length} search={search} setSearch={setSearch} recordType={recordType} setRecordType={setRecordType} loading={loading} onEdit={r=>setEditing(r)} onDelete={removeRecord} onNew={()=>{setEditing(null);setPage('new')}}/>}
    {page==='finance'&&<FinancePage entries={pettyCashEntries} fundLoads={pettyCashFundLoads} pettyCashLoading={pettyCashLoading} fundLoadsLoading={pettyCashFundLoadsLoading} invoices={invoices} invoicesLoading={invoicesLoading} onSaveEntry={(entry,id)=>saveResource('/api/petty-cash','Petty cash entry',entry,id)} onDeleteEntry={removeVerifiedPettyCashResource} onCreateDeleteChallenge={createPettyCashDeleteChallenge} onLoadFunds={(data,id)=>saveResource('/api/petty-cash/loads','Petty cash fund load',data,id)} onSaveInvoice={saveInvoice}/>}
    {page==='appliances'&&<AppliancesPage entries={appliances} itemTypes={itemTypes} onCreateItemType={createItemType} loading={appliancesLoading} onSave={(entry,id)=>saveResource('/api/appliances','Home appliance entry',entry,id)} onDelete={id=>removeResource('/api/appliances','Home appliance entry',id)}/>}
    {page==='receiveNotes'&&<DeliveryNotesPage entries={receiveNotes} loading={receiveNotesLoading} onSave={(note,id)=>saveResource('/api/receive-notes','Delivery note',note,id)} onDelete={id=>removeResource('/api/receive-notes','Delivery note',id)}/>}
    {page==='pendingCalls'&&<CallsPage calls={calls} loading={callsLoading} view="pending" onSave={(call,id)=>saveResource('/api/calls','Call',call,id)} onDelete={id=>removeResource('/api/calls','Call',id)}/>}
    {page==='reports'&&<Reports records={records} appliances={appliances} invoices={invoices} pettyCashEntries={pettyCashEntries} pettyCashFundLoads={pettyCashFundLoads} loading={loading} appliancesLoading={appliancesLoading} invoicesLoading={invoicesLoading} pettyCashLoading={pettyCashLoading} fundLoadsLoading={pettyCashFundLoadsLoading}/>}
    {editing&&page!=='new'&&<RecordForm initial={editing} itemTypes={itemTypes} onCreateItemType={createItemType} onSave={saveRecord} onCancel={()=>setEditing(null)} overlay/>}
   </div>
  </main>
  {deleteConfirmation&&<Overlay title="Confirm deletion" className="delete-confirmation" onClose={()=>resolveDeleteConfirmation(false)}>
    <p className="muted">{deleteConfirmation}</p>
    <div className="delete-confirmation-actions"><button type="button" className="secondary" onClick={()=>resolveDeleteConfirmation(false)}>Cancel</button><button type="button" className="secondary danger-action" onClick={()=>resolveDeleteConfirmation(true)}>Delete</button></div>
  </Overlay>}
  {toast&&<div className={`toast toast-${toast.type}`} role="status" aria-live="polite">{toast.type==='success'?<Check size={16} aria-hidden="true"/>:toast.type==='warning'?<Activity size={16} aria-hidden="true"/>:<X size={16} aria-hidden="true"/>}{toast.message}</div>}
 </div>
}

function FinancePage({entries,fundLoads,pettyCashLoading,fundLoadsLoading,invoices,invoicesLoading,onSaveEntry,onDeleteEntry,onCreateDeleteChallenge,onLoadFunds,onSaveInvoice}){
 const [section,setSection]=useState('overview');
 const [invoicePeriod,setInvoicePeriod]=useState('month');
 const [cashPeriod,setCashPeriod]=useState('month');
 const [cashMetric,setCashMetric]=useState('balance');
 const dateKey=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
 const [invoiceDay,setInvoiceDay]=useState(()=>dateKey(new Date()));
 const [cashDay,setCashDay]=useState(()=>dateKey(new Date()));
 const weekStart=new Date();
 weekStart.setHours(0,0,0,0);
 weekStart.setDate(weekStart.getDate()-((weekStart.getDay()+6)%7));
 const weekDays=Array.from({length:7},(_,index)=>{
  const day=new Date(weekStart);
  day.setDate(weekStart.getDate()+index);
  return {value:dateKey(day),label:day.toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'})};
 });
 const currentMonthEnd=()=>{
  const end=new Date();
  end.setHours(0,0,0,0);
  end.setMonth(end.getMonth()+1,0);
  return dateKey(end);
 };
 const currentMonthStart=()=>{
  const start=new Date();
  start.setHours(0,0,0,0);
  start.setDate(1);
  return dateKey(start);
 };
 const periodInvoices=invoices.filter(invoice=>invoicePeriod==='week'?invoice.invoiceDate===invoiceDay:isSameMonth(invoice.invoiceDate));
 const invoiceTotalCents=periodInvoices.reduce((sum,invoice)=>sum+Math.round(Number(invoice.total||0)*100),0);
 const cashPeriodStart=cashPeriod==='week'?cashDay:currentMonthStart();
 const cashPeriodEnd=cashPeriod==='week'?cashDay:currentMonthEnd();
 const periodFundLoads=fundLoads.filter(load=>load.date>=cashPeriodStart&&load.date<=cashPeriodEnd);
 const periodExpenses=entries.filter(entry=>entry.date>=cashPeriodStart&&entry.date<=cashPeriodEnd);
 const periodFundsCents=periodFundLoads.reduce((sum,load)=>sum+Math.round(Number(load.amount||0)*100),0);
 const periodExpensesCents=periodExpenses.reduce((sum,entry)=>sum+Math.round(Number(entry.amount||0)*100),0);
 const cashBalanceCents=fundLoads.reduce((sum,load)=>load.date<=cashPeriodEnd?sum+Math.round(Number(load.amount||0)*100):sum,0)-entries.reduce((sum,entry)=>entry.date<=cashPeriodEnd?sum+Math.round(Number(entry.amount||0)*100):sum,0);
 const cashMetricDetails={
  funds:{title:'Petty-cash funds',value:fmtKes(periodFundsCents/100),note:`${periodFundLoads.length} fund loads in selected period`,icon:Wallet,tone:'green'},
  expenses:{title:'Petty-cash expenses',value:fmtKes(periodExpensesCents/100),note:`${periodExpenses.length} expenses in selected period`,icon:Activity,tone:'amber'},
  balance:{title:'Petty-cash balance',value:fmtKes(cashBalanceCents/100),note:`Balance through ${fmt(cashPeriodEnd)}${cashBalanceCents<0?` · overdrawn by ${fmtKes(Math.abs(cashBalanceCents)/100)}`:''}`,icon:Wallet,tone:cashBalanceCents<0?'purple':'green'},
 }[cashMetric];
 return <div className="finance-page data-register">
  {section==='overview'&&<>
   <div className="page-intro"><div><p className="eyebrow">MONEY MANAGEMENT</p><h1>Overview</h1><p className="muted">Invoice totals and petty-cash position.</p></div></div>
   <div className="stats-grid finance-summary">
    <FinanceOverviewCard title="Total invoiced" value={invoicesLoading?'…':fmtKes(invoiceTotalCents/100)} note={invoicesLoading?'Loading invoices':`${periodInvoices.length} invoices · payment status not tracked`} icon={FileText} tone="navy" period={invoicePeriod} onPeriodChange={setInvoicePeriod} periodDay={invoiceDay} onPeriodDayChange={setInvoiceDay} weekDays={weekDays}/>
    <FinanceOverviewCard {...cashMetricDetails} value={pettyCashLoading||fundLoadsLoading?'…':cashMetricDetails.value} note={pettyCashLoading||fundLoadsLoading?'Loading cash records':cashMetricDetails.note} period={cashPeriod} onPeriodChange={setCashPeriod} periodDay={cashDay} onPeriodDayChange={setCashDay} weekDays={weekDays} selectedOption={cashMetric} options={[{value:'funds',label:'Funds'},{value:'expenses',label:'Expenses'},{value:'balance',label:'Balance'}]} onOptionChange={setCashMetric}/>
   </div>
   <div className="finance-links">
    <section className="panel finance-link-card"><div className="finance-link-icon"><Wallet size={19}/></div><div className="finance-link-copy"><h2>Petty cash</h2><p>Manage fund loads, cash expenses, and the running balance.</p></div><button type="button" className="secondary" onClick={()=>setSection('pettyCash')}>Open petty cash</button></section>
    <section className="panel finance-link-card"><div className="finance-link-icon"><FileText size={19}/></div><div className="finance-link-copy"><h2>Invoices</h2><p>Create, review, and print client invoices.</p></div><button type="button" className="secondary" onClick={()=>setSection('invoices')}>Open invoices</button></section>
   </div>
  </>}
  {section==='pettyCash'&&<>
   <div className="finance-back"><button type="button" className="secondary" onClick={()=>setSection('overview')}>Back to overview</button></div>
   <PettyCashPage entries={entries} fundLoads={fundLoads} loading={pettyCashLoading} fundLoadsLoading={fundLoadsLoading} onSave={onSaveEntry} onDelete={onDeleteEntry} onCreateDeleteChallenge={onCreateDeleteChallenge} onLoadFunds={onLoadFunds}/>
  </>}
  {section==='invoices'&&<>
   <div className="finance-back"><button type="button" className="secondary" onClick={()=>setSection('overview')}>Back to overview</button></div>
   <InvoicePage invoices={invoices} loading={invoicesLoading} onSave={onSaveInvoice}/>
  </>}
 </div>;
}

function FinanceOverviewCard({title,value,note,icon:Icon,tone,period,onPeriodChange,periodDay,onPeriodDayChange,weekDays,options,selectedOption,onOptionChange}){
 return <div className="stat-card finance-stat-card">
  <div className="finance-stat-top"><div className={`stat-icon ${tone}`}><Icon size={19}/></div><div className="finance-period-selectors">
   <label className="finance-period-select"><span>Period</span><select aria-label={`${title} period`} value={period} onChange={event=>onPeriodChange(event.target.value)}><option value="month">This month</option><option value="week">This week</option></select></label>
   {period==='week'&&<label className="finance-period-select"><span>Day</span><select aria-label={`${title} day`} value={periodDay} onChange={event=>onPeriodDayChange(event.target.value)}>{weekDays.map(day=><option key={day.value} value={day.value}>{day.label}</option>)}</select></label>}
  </div></div>
  {options&&<div className="finance-stat-options" role="group" aria-label="Petty-cash metric">{options.map(option=><button type="button" key={option.value} className={selectedOption===option.value?'selected':''} aria-pressed={selectedOption===option.value} onClick={()=>onOptionChange(option.value)}>{option.label}</button>)}</div>}
  <p>{title}</p><strong>{value}</strong><span>{note}</span>
 </div>;
}

function InvoicePage({invoices,loading,onSave}){
 const emptyForm=()=>({invoiceDate:today(),dueDate:'',clientName:'',clientContact:'',clientEmail:'',billingAddress:'',paymentTerms:'Due on receipt',bankName:'',payBillNumber:'',accountNumber:'',taxRate:'0',lineItems:[{description:'',quantity:'1',unitPrice:''}]});
 const [form,setForm]=useState(emptyForm);
 const [showForm,setShowForm]=useState(false);
 const [viewingInvoice,setViewingInvoice]=useState(null);
 const [search,setSearch]=useState('');
 const [invoiceOutput,setInvoiceOutput]=useState('print');
 const [pdfBusy,setPdfBusy]=useState(false);
 const [pdfError,setPdfError]=useState('');
 const [busy,setBusy]=useState(false);
 const subtotalCents=form.lineItems.reduce((sum,item)=>sum+Math.round((Number(item.quantity)||0)*(Number(item.unitPrice)||0)*100),0);
 const taxCents=Math.round(subtotalCents*(Number(form.taxRate)||0)/100);
 const searchTerm=search.trim().toLowerCase();
 const visibleInvoices=invoices.filter(invoice=>!searchTerm||[invoice.invoiceNumber,invoice.invoiceDate,invoice.clientName,invoice.clientContact,invoice.clientEmail,invoice.billingAddress,invoice.bankName,invoice.payBillNumber,invoice.accountNumber,invoice.total,fmtKes(invoice.total),invoice.createdBy].some(value=>String(value??'').toLowerCase().includes(searchTerm)));
 const change=(field,value)=>setForm(current=>({...current,[field]:value}));
 const updateLine=(index,field,value)=>setForm(current=>({...current,lineItems:current.lineItems.map((item,itemIndex)=>itemIndex===index?{...item,[field]:value}:item)}));
 const addLine=()=>setForm(current=>({...current,lineItems:[...current.lineItems,{description:'',quantity:'1',unitPrice:''}]}));
 const removeLine=index=>setForm(current=>({...current,lineItems:current.lineItems.filter((_,itemIndex)=>itemIndex!==index)}));
 const closeForm=()=>{setShowForm(false);setForm(emptyForm());};
 const handleInvoiceOutput=async()=>{
  if(invoiceOutput==='print'){window.print();return;}
  setPdfError('');
  setPdfBusy(true);
  try{const {downloadInvoicePdf}=await import('./invoicePdf');await downloadInvoicePdf(viewingInvoice);}
  catch(error){console.error(error);setPdfError(`Could not download invoice PDF: ${error instanceof Error?error.message:String(error)}`);}
  finally{setPdfBusy(false);}
 };
 const submit=async(event)=>{
  event.preventDefault();
  setBusy(true);
  try{
   const saved=await onSave({
    invoiceDate:form.invoiceDate,
    dueDate:form.dueDate,
    clientName:form.clientName.trim(),
    clientContact:form.clientContact.trim(),
    clientEmail:form.clientEmail.trim(),
    billingAddress:form.billingAddress.trim(),
    paymentTerms:form.paymentTerms.trim(),
    bankName:form.bankName.trim(),
    payBillNumber:form.payBillNumber.trim(),
    accountNumber:form.accountNumber.trim(),
    currency:'KES',
    taxRate:Number(form.taxRate),
    lineItems:form.lineItems.map(item=>({description:item.description.trim(),quantity:Number(item.quantity),unitPrice:Number(item.unitPrice)})),
   });
   if(saved){closeForm();setViewingInvoice(saved);}
  }finally{setBusy(false);}
 };
 return <div className="data-register invoice-page">
  <div className="page-intro"><div><p className="eyebrow">CLIENT BILLING</p><h1>Invoices</h1><p className="muted">Create, view, and print client invoices.</p></div><button type="button" className="primary" onClick={()=>setShowForm(true)}><Plus size={17}/> Create invoice</button></div>
  <div className="panel table-panel data-table">
   <div className="table-toolbar"><label className="search-box"><Search size={16}/><input type="search" aria-label="Search invoices" placeholder="Search invoice number, client, contact, amount…" value={search} onChange={event=>setSearch(event.target.value)}/></label><span className="muted">{visibleInvoices.length} of {invoices.length} invoices</span></div>
   {loading?<div className="empty">Loading invoices…</div>:invoices.length===0?<Empty text="No invoices have been created yet."/>:visibleInvoices.length===0?<Empty text="No invoices match your search."/>:
    <div className="table-scroll"><table className="invoice-register-table"><thead><tr><th>Invoice number</th><th>Invoice date</th><th>Client</th><th>Contact</th><th>Total</th><th>Created by</th></tr></thead><tbody>
     {visibleInvoices.map(invoice=><tr key={invoice.id} className="invoice-register-row" tabIndex={0} aria-label={`View invoice ${invoice.invoiceNumber}`} onClick={()=>setViewingInvoice(invoice)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setViewingInvoice(invoice);}}}>
      <td><strong className="job-number">{invoice.invoiceNumber}</strong></td><td>{fmt(invoice.invoiceDate)}</td><td>{invoice.clientName}</td><td>{invoice.clientContact}</td><td><strong>{fmtKes(invoice.total)}</strong></td><td>{invoice.createdBy||'—'}</td>
     </tr>)}
    </tbody></table></div>}
   <div className="table-foot">Showing {visibleInvoices.length} of {invoices.length} invoices. Select a row to view or print. <span>Amounts in KES</span></div>
  </div>
  {showForm&&<Overlay title="Create client invoice" className="invoice-form-overlay" onClose={closeForm}>
   <form className="panel data-form invoice-form" onSubmit={submit}>
    <div className="invoice-company-banner"><strong>Hisense</strong><span>Under Googa Electronics Limited</span><span>Funzi Road Industrial Area, Nairobi</span><span>+25470011311</span></div>
    <div className="data-form-grid">
     <Field label="Invoice date *"><input type="date" required value={form.invoiceDate} onChange={event=>change('invoiceDate',event.target.value)}/></Field>
     <Field label="Due date"><input type="date" value={form.dueDate} onChange={event=>change('dueDate',event.target.value)}/></Field>
     <Field label="Client name *"><input required maxLength="120" value={form.clientName} onChange={event=>change('clientName',event.target.value)}/></Field>
     <Field label="Client contact *"><input required maxLength="40" value={form.clientContact} onChange={event=>change('clientContact',event.target.value)} placeholder="+254…"/></Field>
     <Field label="Client email"><input type="email" maxLength="160" value={form.clientEmail} onChange={event=>change('clientEmail',event.target.value)}/></Field>
     <Field label="Billing address *" wide><textarea required maxLength="300" rows="2" value={form.billingAddress} onChange={event=>change('billingAddress',event.target.value)}/></Field>
     <Field label="Payment terms *"><input required maxLength="200" value={form.paymentTerms} onChange={event=>change('paymentTerms',event.target.value)}/></Field>
     <Field label="VAT rate (%) *"><input type="number" required min="0" max="100" step="0.01" value={form.taxRate} onChange={event=>change('taxRate',event.target.value)}/></Field>
     <div className="invoice-payment-fields field wide"><span>Payment details (optional)</span><div className="invoice-payment-grid">
      <Field label="Bank"><input maxLength="100" value={form.bankName} onChange={event=>change('bankName',event.target.value)} placeholder="Bank name"/></Field>
      <Field label="PayBill"><input maxLength="40" value={form.payBillNumber} onChange={event=>change('payBillNumber',event.target.value)} placeholder="PayBill number"/></Field>
      <Field label="Account"><input maxLength="80" value={form.accountNumber} onChange={event=>change('accountNumber',event.target.value)} placeholder="Account number"/></Field>
     </div></div>
     <div className="invoice-line-items field wide">
      <span>Invoice items *</span>
      <div className="invoice-line-list">{form.lineItems.map((item,index)=><div className="invoice-line-row" key={index}>
       <label className="invoice-description-field">Description<input required maxLength="240" value={item.description} onChange={event=>updateLine(index,'description',event.target.value)} placeholder="Item or service"/></label>
       <label>Quantity<input type="number" required min="0.01" step="0.01" value={item.quantity} onChange={event=>updateLine(index,'quantity',event.target.value)}/></label>
       <label>Unit price (KES)<input type="number" required min="0" step="0.01" value={item.unitPrice} onChange={event=>updateLine(index,'unitPrice',event.target.value)}/></label>
       <button type="button" className="icon-btn danger" title="Remove invoice item" aria-label="Remove invoice item" disabled={form.lineItems.length===1} onClick={()=>removeLine(index)}><Trash2 size={16}/></button>
      </div>)}</div>
      <button type="button" className="secondary invoice-add-line" onClick={addLine}><Plus size={15}/> Add item</button>
     </div>
    </div>
    <div className="invoice-form-totals"><span>Subtotal <strong>{fmtKes(subtotalCents/100)}</strong></span><span>VAT ({Number(form.taxRate)||0}%) <strong>{fmtKes(taxCents/100)}</strong></span><span className="invoice-grand-total">Total <strong>{fmtKes((subtotalCents+taxCents)/100)}</strong></span></div>
    <div className="form-actions"><span className="muted tiny">Invoice number will be generated automatically.</span><div className="data-form-actions"><button type="button" className="secondary" disabled={busy} onClick={closeForm}>Cancel</button><button className="primary" disabled={busy}>{busy?'Creating…':'Create invoice'}</button></div></div>
   </form>
  </Overlay>}
  {viewingInvoice&&<Overlay title={`Invoice ${viewingInvoice.invoiceNumber}`} className="invoice-preview-overlay" onClose={()=>setViewingInvoice(null)}>
   <InvoiceDocument invoice={viewingInvoice}/>
   {pdfError&&<div className="error invoice-pdf-error" role="alert">{pdfError}</div>}
   <div className="invoice-print-actions"><button type="button" className="secondary" onClick={()=>setViewingInvoice(null)}>Close</button><label className="invoice-output-select">Output<select value={invoiceOutput} onChange={event=>{setInvoiceOutput(event.target.value);setPdfError('');}}><option value="print">Print invoice</option><option value="pdf">Download PDF</option></select></label><button type="button" className="primary" disabled={pdfBusy} onClick={handleInvoiceOutput}>{pdfBusy?'Preparing PDF…':invoiceOutput==='pdf'?'Download PDF':'Print invoice'}</button></div>
  </Overlay>}
 </div>;
}

function InvoiceDocument({invoice}){
 return <article className="invoice-document">
  <header className="invoice-document-header">
   <div className="invoice-company-banner"><strong>Hisense</strong><span>Under Googa Electronics Limited</span><span>Funzi Road Industrial Area, Nairobi</span><span>+25470011311</span></div>
   <div className="invoice-document-title"><h1>INVOICE</h1><strong>{invoice.invoiceNumber}</strong></div>
  </header>
  <div className="invoice-client-details">
   <div><h2>Bill to</h2><strong>{invoice.clientName}</strong><span>{invoice.clientContact}</span>{invoice.clientEmail&&<span>{invoice.clientEmail}</span>}<span>{invoice.billingAddress}</span></div>
   <div><h2>Invoice details</h2><span>Invoice date: {fmt(invoice.invoiceDate)}</span>{invoice.dueDate&&<span>Due date: {fmt(invoice.dueDate)}</span>}<span>Currency: {invoice.currency}</span></div>
  </div>
  <div className="table-scroll invoice-document-table"><table><thead><tr><th>Description</th><th>Quantity</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>
   {invoice.lineItems.map((item,index)=><tr key={`${item.description}-${index}`}><td>{item.description}</td><td>{item.quantity}</td><td>{fmtKes(item.unitPrice)}</td><td>{fmtKes(Math.round(item.quantity*item.unitPrice*100)/100)}</td></tr>)}
  </tbody></table></div>
  <div className="invoice-document-totals"><span>Subtotal<strong>{fmtKes(invoice.subtotal)}</strong></span><span>VAT ({invoice.taxRate}%)<strong>{fmtKes(invoice.taxAmount)}</strong></span><span className="invoice-grand-total">Total<strong>{fmtKes(invoice.total)}</strong></span></div>
  <div className="invoice-payment-terms"><h2>Payment terms</h2><p>{invoice.paymentTerms}</p></div>
  {(invoice.bankName||invoice.payBillNumber||invoice.accountNumber)&&<section className="invoice-payment-details"><h2>Payment details</h2>{invoice.bankName&&<p><strong>Bank:</strong> {invoice.bankName}</p>}{invoice.payBillNumber&&<p><strong>PayBill:</strong> {invoice.payBillNumber}</p>}{invoice.accountNumber&&<p><strong>Account:</strong> {invoice.accountNumber}</p>}</section>}
  <section className="invoice-confirmation">
   <h2>Confirmation</h2>
   <div className="invoice-confirmation-fields">
    <div className="invoice-signature-area"><span>Authorized signature</span><div className="invoice-signature-line"/><small>Name / Date</small></div>
    <div className="invoice-stamp-area"><span>Company rubber stamp</span></div>
   </div>
  </section>
  <footer className="invoice-footer">Thank you for your business.</footer>
 </article>;
}

function Dashboard({records,counts,loading,setPage,setSearch,onEdit}){
 const jobs=records.filter(r=>r.recordType!=='gatePass'); const recent=jobs.slice(0,6); const week=jobs.filter(r=>isSameWeek(r.date)); const month=jobs.filter(r=>isSameMonth(r.date));
 return <>
  <div className="welcome-row">
   <div><p className="eyebrow">OVERVIEW</p><p className="muted">Track repair records, follow up pending work and monitor collections.</p></div>
   <button className="primary" onClick={()=>setPage('new')}><Plus size={17}/> Register new record</button>
  </div>
  <div className="stats-grid">
   <Stat title="Ready" value={counts.ready} note={`${counts.collection} pending collection`} icon={Check} tone="green"/>
   <Stat title="Pending" value={counts.pending} note="Awaiting action" icon={Clock3} tone="amber"/>
   <Stat title="Waiting for spare parts" value={counts.spares} note="Parts required" icon={Package} tone="purple"/>
   <Stat title="Collected" value={counts.collected} note="Jobs collected" icon={Archive} tone="navy"/>
  </div>
  <div className="section-head"><div><h3>Work status</h3><p className="muted">Current breakdown of all registered records</p></div><button className="text-action" onClick={()=>setPage('records')}>View all records →</button></div>
  <div className="status-overview">
   <StatusLine label="Ready · Pending collection" value={counts.collection} total={counts.total} color="blue"/>
   <StatusLine label="Pending" value={counts.pending} total={counts.total} color="amber"/>
   <StatusLine label="Waiting for spare parts" value={counts.spares} total={counts.total} color="purple"/>
   <StatusLine label="Collected" value={counts.collected} total={counts.total} color="green"/>
  </div>
  <div className="two-col">
   <div className="panel"><div className="panel-head"><div><h3>Recent records</h3><p className="muted">Latest jobs added to the system</p></div><button className="text-action" onClick={()=>setPage('records')}>See register →</button></div>{loading?<div className="empty">Loading records…</div>:recent.length===0?<Empty text="No records have been registered yet."/>:<div className="recent-list">{recent.map(r=><button className="recent-row" key={r.id} onClick={()=>onEdit(r)}><div className="job-icon"><Wrench size={17}/></div><div className="recent-main"><strong>{r.jobCard}</strong><span>{r.model} · {r.issue}</span></div><div className="recent-right"><StatusBadge status={r.status} category={r.readyCategory}/><small>{fmt(r.date)}</small></div></button>)}</div>}</div>
   <div className="panel report-preview"><div className="panel-head"><div><h3>Reporting snapshot</h3><p className="muted">Records registered in each period</p></div><BarChart3 size={19} className="muted-icon"/></div><div className="period-block"><div><span>This week</span><strong>{week.length}</strong></div><span className="period-detail">{week.filter(r=>r.status==='Ready').length} ready · {week.filter(r=>r.status==='Pending').length} pending · {week.filter(r=>r.status==='Waiting-Spare').length} spares</span></div><div className="period-block"><div><span>This month</span><strong>{month.length}</strong></div><span className="period-detail">{month.filter(r=>r.status==='Ready').length} ready · {month.filter(r=>r.status==='Pending').length} pending · {month.filter(r=>r.status==='Waiting-Spare').length} spares</span></div><button className="secondary full" onClick={()=>setPage('reports')}>Open detailed reports</button></div>
  </div>
 </>
}
function Stat({title,value,note,icon:Icon,tone}){return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={19}/></div><p>{title}</p><strong>{value}</strong><span>{note}</span></div>}
function StatusLine({label,value,total,color}){return <div className="status-line"><div className="status-line-top"><span>{label}</span><strong>{value}</strong></div><div className="progress-track"><div className={`progress-fill ${color}`} style={{width:`${total?value/total*100:0}%`}}/></div></div>}
function StatusBadge({status,category}){const cls=status==='Pending'?'pending':status==='Ready'?'ready':status==='Collected'?'collected':'spares';return <span className={`badge ${cls}`}>{status==='Waiting-Spare'?'Waiting for spares':status}{status==='Ready'&&category?` · ${category}`:''}</span>}
function Empty({text}){return <div className="empty"><div className="empty-icon"><ClipboardList size={22}/></div><strong>Nothing to show</strong><span>{text}</span></div>}

function RecordForm({initial,itemTypes,onCreateItemType,onSave,onCancel,overlay=false}){
 const [form,setForm]=useState(()=>({jobCard:'',date:today(),model:'',itemType:'',serial:'',collectionDate:today(),destination:'',clientName:'',issue:'',status:'Pending',readyCategory:'Pending Collection',contact:'',technician:'',remarks:'',...(initial||{}),recordType:initial?.recordType==='gatePass'?'gatePass':'jobCard'}));
 const [busy,setBusy]=useState(false);
 const change=(key,value)=>setForm(current=>({...current,[key]:value}));
 const isGatePass=form.recordType==='gatePass';
 const submit=async(event)=>{
  event.preventDefault();
  setBusy(true);
  try{
   const data=isGatePass
    ?{recordType:'gatePass',model:form.model.trim(),itemType:form.itemType.trim(),serial:form.serial.trim(),collectionDate:form.collectionDate,destination:form.destination.trim(),clientName:form.clientName.trim()}
    :{recordType:'jobCard',jobCard:form.jobCard.trim(),date:form.date,model:form.model.trim(),itemType:form.itemType.trim(),serial:form.serial.trim(),issue:form.issue.trim(),status:form.status,readyCategory:form.status==='Ready'?form.readyCategory:'',contact:form.contact.trim(),technician:form.technician.trim(),remarks:form.remarks.trim()};
   await onSave(data,initial?.id);
  }finally{setBusy(false);}
 };
 const formElement=<form className="panel record-form" onSubmit={submit}>
  {!initial&&<div className="segmented record-type-tabs" role="group" aria-label="Record category">
   <button type="button" className={!isGatePass?'selected':''} aria-pressed={!isGatePass} onClick={()=>change('recordType','jobCard')}>Job card</button>
   <button type="button" className={isGatePass?'selected':''} aria-pressed={isGatePass} onClick={()=>change('recordType','gatePass')}>Gate pass</button>
  </div>}
  <div className="form-section-title"><span>01</span><div><h3>{isGatePass?'Gate pass details':'Job information'}</h3><p>{isGatePass?'Collection and destination details':'Reference and product details'}</p></div></div>
  <div className="form-grid">
   {isGatePass?<>
    <ItemTypeField itemTypes={itemTypes} value={form.itemType} onChange={value=>change('itemType',value)} onCreateItemType={onCreateItemType}/>
    <Field label="Model number *"><input required value={form.model} onChange={event=>change('model',event.target.value)} placeholder="Model number"/></Field>
    <Field label="Serial number *"><input required value={form.serial} onChange={event=>change('serial',event.target.value)} placeholder="Serial number"/></Field>
    <Field label="Date of collection *"><input required type="date" value={form.collectionDate} onChange={event=>change('collectionDate',event.target.value)}/></Field>
    <Field label="Destination *"><input required value={form.destination} onChange={event=>change('destination',event.target.value)} placeholder="Destination"/></Field>
    <Field label="Client name *"><input required value={form.clientName} onChange={event=>change('clientName',event.target.value)} placeholder="Client name"/></Field>
   </>:<>
    <Field label="Job card number *"><input required value={form.jobCard} onChange={event=>change('jobCard',event.target.value)} placeholder="e.g. SC-2026-001"/></Field>
    <Field label="Date received *"><input required type="date" value={form.date} onChange={event=>change('date',event.target.value)}/></Field>
    <ItemTypeField itemTypes={itemTypes} value={form.itemType} onChange={value=>change('itemType',value)} onCreateItemType={onCreateItemType}/>
    <Field label="Product model *"><input required value={form.model} onChange={event=>change('model',event.target.value)} placeholder="e.g. 65A6K"/></Field>
    <Field label="Serial number"><input value={form.serial} onChange={event=>change('serial',event.target.value)} placeholder="Enter serial number"/></Field>
    <Field label="Issue / reported fault *" wide><textarea required rows="3" value={form.issue} onChange={event=>change('issue',event.target.value)} placeholder="Describe the reported issue…"/></Field>
   </>}
  </div>
  {!isGatePass&&<>
   <div className="form-divider"/>
   <div className="form-section-title"><span>02</span><div><h3>Contact and progress</h3><p>Customer contact and current work status</p></div></div>
   <div className="form-grid">
    <Field label="Customer contact *"><input required value={form.contact} onChange={event=>change('contact',event.target.value)} placeholder="Phone number"/></Field>
    <Field label="Current status *"><select value={form.status} onChange={event=>change('status',event.target.value)}>{STATUSES.map(status=><option key={status}>{status}</option>)}</select></Field>
    {form.status==='Ready'&&<Field label="Ready category *"><select value={form.readyCategory} onChange={event=>change('readyCategory',event.target.value)}>{READY_TYPES.map(category=><option key={category}>{category}</option>)}</select></Field>}
    <Field label="Assigned technician"><input value={form.technician} onChange={event=>change('technician',event.target.value)} placeholder="Optional"/></Field>
    <Field label="Internal remarks" wide><textarea rows="3" value={form.remarks} onChange={event=>change('remarks',event.target.value)} placeholder="Additional notes (optional)…"/></Field>
   </div>
  </>}
  <div className="form-actions"><span className="muted tiny">Records save directly to MongoDB.</span><div className="data-form-actions">{overlay&&<button className="secondary" type="button" onClick={onCancel}>Cancel</button>}<button className="primary" disabled={busy}>{busy?'Saving…':initial?'Save changes':isGatePass?'Save gate pass':'Save job card'}</button></div></div>
 </form>;
 if(overlay)return <Overlay title={`Edit ${isGatePass?'gate pass':'job card'}`} onClose={onCancel}>{formElement}</Overlay>;
 return <div className="form-page"><div className="page-intro"><div><p className="eyebrow">RECORD INTAKE</p><h1>{initial?`Update ${isGatePass?'gate pass':'job card'}`:'Register a new record'}</h1><p className="muted">Choose a record category and complete its required details.</p></div><button className="secondary" onClick={onCancel}>Cancel</button></div>{formElement}</div>;
}
function ItemTypeField({itemTypes,value,onChange,onCreateItemType}){
 const [creating,setCreating]=useState(false);
 const [draft,setDraft]=useState('');
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const saveType=async()=>{
  const name=draft.trim();
  if(!name){setError('Enter an item type.');return;}
  setSaving(true);
  setError('');
  try{
   const createdName=await onCreateItemType(name);
   onChange(createdName);
   setDraft('');
   setCreating(false);
  }catch(createError){
   setError(createError.message);
  }finally{setSaving(false);}
 };
 return <div className="field">
  <span>Item type *</span>
  <div className="item-type-control">
   <select required value={value} onChange={event=>onChange(event.target.value)}>
    <option value="" disabled>Select an item type</option>
    {value&&!itemTypes.some(type=>type.toLowerCase()===value.toLowerCase())&&<option value={value}>{value}</option>}
    {itemTypes.map(type=><option key={type} value={type}>{type}</option>)}
   </select>
   <button type="button" className="secondary item-type-create-trigger" onClick={()=>{setCreating(current=>!current);setError('');}}>{!creating&&<Plus size={14} />}{creating?'Cancel':'Create type'}</button>
  </div>
  {creating&&<div className="item-type-create">
   <input value={draft} maxLength="80" aria-label="New item type" placeholder="Enter a new item type" onChange={event=>setDraft(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();saveType();}}}/>
   <button type="button" className="secondary" disabled={saving||!draft.trim()} onClick={saveType}>{saving?'Creating…':'Create'}</button>
  </div>}
  {error&&<p className="error" role="alert">{error}</p>}
 </div>;
}
function Field({label,wide,children}){return <label className={`field ${wide?'wide':''}`}><span>{label}</span>{children}</label>}

function Overlay({title,onClose,children,className=''}){
 const onCloseRef=useRef(onClose);
 onCloseRef.current=onClose;
 useEffect(()=>{
  const previousOverflow=document.body.style.overflow;
  const closeOnEscape=event=>{if(event.key==='Escape')onCloseRef.current();};
  document.body.style.overflow='hidden';
  document.addEventListener('keydown',closeOnEscape);
  return()=>{document.body.style.overflow=previousOverflow;document.removeEventListener('keydown',closeOnEscape);};
 },[]);
 return <div className="overlay-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
  <section className={`overlay-card ${className}`} role="dialog" aria-modal="true" aria-label={title}>
   <div className="overlay-header"><h2>{title}</h2><button type="button" className="icon-btn" aria-label="Close dialog" onClick={onClose}><X size={19}/></button></div>
   {children}
  </section>
 </div>
}

function PettyCashDeleteVerification({transaction,onCancel,onCreateDeleteChallenge,onDelete,onDeleted}){
 const [password,setPassword]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const submit=async(event)=>{
  event.preventDefault();
  setBusy(true);
  setError('');
  try{
   const currentUser=auth?.currentUser;
   if(!currentUser?.email)throw new Error('Sign in with an email and password to verify petty-cash deletion.');
   const challenge=await onCreateDeleteChallenge(transaction,currentUser);
   await reauthenticateWithCredential(currentUser,EmailAuthProvider.credential(currentUser.email,password));
   await currentUser.getIdToken(true);
   const deleted=await onDelete(transaction,challenge.challengeId,currentUser);
   if(deleted)onDeleted();
   else setError('Deletion did not complete. Enter your password to try again.');
  }catch(submitError){
   setError(submitError.message?.replace(/^Firebase:\s*/,'')||'Verification failed. Try again.');
  }finally{setBusy(false);}
 };
 const amount=(Math.abs(transaction.amountCents)/100).toFixed(2);
 return <form className="panel data-form cash-delete-verification" onSubmit={submit}>
  <div className="petty-cash-entry-intro"><span className="petty-cash-entry-icon"><ShieldCheck size={19}/></span><div><h3>Verify before deletion</h3><p>{transaction.direction} transaction · {transaction.details} · {amount}</p></div></div>
  <Field label="Account password *"><input type="password" required autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)} placeholder="Enter your account password"/></Field>
  {error&&<p className="error" role="alert">{error}</p>}
  <div className="form-actions"><span className="muted tiny">Confirm your password to delete this record.</span><div className="data-form-actions">
   <button className="secondary" type="button" disabled={busy} onClick={onCancel}>Cancel</button>
   <button className="primary" disabled={busy}>{busy?'Verifying…':'Verify & delete'}</button>
  </div></div>
 </form>;
}

function RegisterFilters({search,setSearch,sort,setSort,sortOptions,placeholder}){
 return <div className="register-filter-controls">
  <div className="search-box"><Search size={16}/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder={placeholder}/>{search&&<button type="button" className="icon-btn" title="Clear search" onClick={()=>setSearch('')}><X size={15}/></button>}</div>
  <label className="sort-select"><Filter size={15}/><select value={sort} onChange={event=>setSort(event.target.value)}>{sortOptions.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
 </div>
}

function AllRecordsPage({serviceRecords,serviceRecordCount,deletingRecordIds,pettyCashEntries,pettyCashFundLoads,appliances,receiveNotes,calls,pettyCashLoading,pettyCashFundLoadsLoading,appliancesLoading,receiveNotesLoading,callsLoading,search,setSearch,recordType,setRecordType,loading,onEdit,onDelete}){
 const [category,setCategory]=useState('service');
 return <div className="all-records-page">
  <div className="segmented all-records-tabs" role="group" aria-label="Record category">
   <button type="button" className={category==='service'?'selected':''} aria-pressed={category==='service'} onClick={()=>setCategory('service')}>Service records<span className="status-filter-count">{serviceRecordCount}</span></button>
   <button type="button" className={category==='pettyCash'?'selected':''} aria-pressed={category==='pettyCash'} onClick={()=>setCategory('pettyCash')}>Petty cash<span className="status-filter-count">{pettyCashEntries.length+pettyCashFundLoads.length}</span></button>
   <button type="button" className={category==='appliances'?'selected':''} aria-pressed={category==='appliances'} onClick={()=>setCategory('appliances')}>Home appliances<span className="status-filter-count">{appliances.length}</span></button>
   <button type="button" className={category==='receiveNotes'?'selected':''} aria-pressed={category==='receiveNotes'} onClick={()=>setCategory('receiveNotes')}>Delivery notes<span className="status-filter-count">{receiveNotes.length}</span></button>
   <button type="button" className={category==='pendingCalls'?'selected':''} aria-pressed={category==='pendingCalls'} onClick={()=>setCategory('pendingCalls')}>Pending calls<span className="status-filter-count">{calls.filter(call=>call.status!=='Sorted').length}</span></button>
   <button type="button" className={category==='archiveCalls'?'selected':''} aria-pressed={category==='archiveCalls'} onClick={()=>setCategory('archiveCalls')}>Archive calls<span className="status-filter-count">{calls.filter(call=>call.status==='Sorted').length}</span></button>
  </div>
  {category==='service'&&<RecordsPage page="records" records={serviceRecords} allCount={serviceRecordCount} deletingRecordIds={deletingRecordIds} search={search} setSearch={setSearch} recordType={recordType} setRecordType={setRecordType} loading={loading} readOnly={false} rowActionOverlay onEdit={onEdit} onDelete={onDelete}/>}
  {category==='pettyCash'&&<PettyCashPage entries={pettyCashEntries} fundLoads={pettyCashFundLoads} loading={pettyCashLoading} fundLoadsLoading={pettyCashFundLoadsLoading} readOnly/>}
  {category==='appliances'&&<AppliancesPage entries={appliances} loading={appliancesLoading} readOnly/>}
  {category==='receiveNotes'&&<DeliveryNotesPage entries={receiveNotes} loading={receiveNotesLoading} readOnly/>}
  {category==='pendingCalls'&&<CallsPage calls={calls} loading={callsLoading} view="pending" readOnly/>}
  {category==='archiveCalls'&&<CallsPage calls={calls} loading={callsLoading} view="archive" readOnly/>}
 </div>
}

function PettyCashPage({entries,fundLoads=[],loading,fundLoadsLoading=false,onSave,onDelete,onCreateDeleteChallenge,onLoadFunds,readOnly=false}){
 const emptyForm=()=>({date:today(),time:currentTime(),whereUsed:'',amount:''});
 const emptyFundForm=()=>({date:today(),time:currentTime(),amount:''});
 const [form,setForm]=useState(emptyForm);
 const [fundForm,setFundForm]=useState(emptyFundForm);
 const [editingId,setEditingId]=useState(null);
 const [fundEditingId,setFundEditingId]=useState(null);
 const [busy,setBusy]=useState(false);
 const [fundBusy,setFundBusy]=useState(false);
 const [showFundOverlay,setShowFundOverlay]=useState(false);
 const [showEntryOverlay,setShowEntryOverlay]=useState(false);
 const [selectedTransaction,setSelectedTransaction]=useState(null);
 const [showDeleteVerification,setShowDeleteVerification]=useState(false);
 const [search,setSearch]=useState('');
 const [sort,setSort]=useState('newest');
 const toCents=amount=>Math.round(Number(amount||0)*100);
 const totalGivenOutCents=entries.reduce((sum,entry)=>sum+toCents(entry.amount),0);
 const totalSetAsideCents=fundLoads.reduce((sum,load)=>sum+toCents(load.amount),0);
 const amountInStoreCents=totalSetAsideCents-totalGivenOutCents;
 const money=cents=>(cents/100).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
 const ledger=[
  ...fundLoads.map(load=>({id:`in-${load.id}`,source:load,sourceId:load.id,date:load.date,time:load.time||timeFromCreatedAt(load.createdAt),createdAt:load.createdAt||'',direction:'IN',details:'Funds set aside',amountCents:toCents(load.amount)})),
  ...entries.map(entry=>({id:`out-${entry.id}`,source:entry,sourceId:entry.id,date:entry.date,time:entry.time||timeFromCreatedAt(entry.createdAt),createdAt:entry.createdAt||'',direction:'OUT',details:entry.whereUsed,amountCents:-toCents(entry.amount)})),
 ];
 const compareChronological=(a,b)=>String(a.date).localeCompare(String(b.date))||String(a.time).localeCompare(String(b.time))||String(a.createdAt).localeCompare(String(b.createdAt))||a.id.localeCompare(b.id);
 let runningBalanceCents=0;
 const ledgerWithBalances=[...ledger].sort(compareChronological).map(item=>{runningBalanceCents+=item.amountCents;return {...item,balanceAfterCents:runningBalanceCents};});
 const term=search.trim().toLowerCase();
 const visibleLedger=ledgerWithBalances.filter(item=>!term||[item.date,item.time,item.direction,item.details,money(Math.abs(item.amountCents)),money(item.balanceAfterCents)].some(value=>String(value??'').toLowerCase().includes(term)));
 const sortedLedger=[...visibleLedger].sort((a,b)=>{
  if(sort==='oldest')return compareChronological(a,b);
  if(sort==='amount-high')return Math.abs(b.amountCents)-Math.abs(a.amountCents);
  if(sort==='amount-low')return Math.abs(a.amountCents)-Math.abs(b.amountCents);
  return compareChronological(b,a);
 });
 const ledgerLoading=loading||fundLoadsLoading;
 const reset=()=>{setForm(emptyForm());setEditingId(null);setShowEntryOverlay(false);};
 const closeFundOverlay=()=>{setFundForm(emptyFundForm());setFundEditingId(null);setShowFundOverlay(false);};
 const submit=async(event)=>{
  event.preventDefault();
  setBusy(true);
  const saved=await onSave({date:form.date,time:form.time,whereUsed:form.whereUsed.trim(),amount:Number(form.amount)},editingId);
  if(saved)reset();
  setBusy(false);
 };
 const submitFundLoad=async(event)=>{
  event.preventDefault();
  setFundBusy(true);
  try{
   const saved=await onLoadFunds({date:fundForm.date,time:fundForm.time,amount:Number(fundForm.amount)},fundEditingId);
   if(saved)closeFundOverlay();
  }finally{setFundBusy(false);}
 };
 const edit=entry=>{
  setEditingId(entry.id);
  setForm({date:entry.date,time:entry.time||timeFromCreatedAt(entry.createdAt),whereUsed:entry.whereUsed,amount:String(entry.amount)});
  setShowEntryOverlay(true);
 };
 const editFundLoad=load=>{
  setFundEditingId(load.id);
  setFundForm({date:load.date,time:load.time||timeFromCreatedAt(load.createdAt),amount:String(load.amount)});
  setShowFundOverlay(true);
 };
 const editSelectedTransaction=()=>{
  const transaction=selectedTransaction;
  setShowDeleteVerification(false);
  setSelectedTransaction(null);
  if(transaction.direction==='IN')editFundLoad(transaction.source);
  else edit(transaction.source);
 };
 const closeTransactionDetails=()=>{setShowDeleteVerification(false);setSelectedTransaction(null);};
 const selectedEditHistory=selectedTransaction?[...(selectedTransaction.source.editHistory||[])].sort((a,b)=>new Date(b.editedAt).getTime()-new Date(a.editedAt).getTime()):[];
 const formElement=<form className="panel data-form petty-cash-entry-form" onSubmit={submit}>
  <div className="petty-cash-entry-intro"><span className="petty-cash-entry-icon"><Wallet size={19}/></span><div><h3>Expense details</h3><p>Record when the cash was used, what it covered, and the amount given out.</p></div></div>
  <div className="data-form-grid">
   <Field label="Date *"><input type="date" required value={form.date} onChange={event=>setForm(current=>({...current,date:event.target.value}))}/></Field>
   <Field label="Time *"><input type="time" required value={form.time} onChange={event=>setForm(current=>({...current,time:event.target.value}))}/></Field>
   <Field label="Amount given out *"><input type="number" min="0.01" step="0.01" required value={form.amount} onChange={event=>setForm(current=>({...current,amount:event.target.value}))} placeholder="0.00"/></Field>
   <Field label="Where was the cash used? *" wide><textarea required rows="3" value={form.whereUsed} onChange={event=>setForm(current=>({...current,whereUsed:event.target.value}))} placeholder="Describe the expense (for example, transport or supplies)…"/></Field>
  </div>
  <div className="petty-cash-entry-note"><Activity size={16}/><span>This expense adds to <strong>Amount given out</strong> and reduces <strong>Amount in store</strong>.</span></div>
  <div className="form-actions"><span className="muted tiny">Amounts must be greater than zero. Negative balances are allowed.</span><div className="data-form-actions"><button className="secondary" type="button" onClick={reset}>Cancel</button><button className="primary" disabled={busy}>{busy?'Saving…':editingId?'Save changes':'Add cash entry'}</button></div></div>
 </form>;
 return <div className="data-register">
  <div className="page-intro"><div><p className="eyebrow">FINANCE REGISTER</p><h1>Petty cash</h1><p className="muted">{entries.length} expenses · {fundLoads.length} fund loads</p></div>{!readOnly&&<div className="petty-cash-actions"><button type="button" className="secondary" onClick={()=>{setFundForm(emptyFundForm());setFundEditingId(null);setShowFundOverlay(true)}}><Plus size={16}/> Load funds</button><button type="button" className="primary" onClick={()=>{setForm(emptyForm());setShowEntryOverlay(true)}}><Plus size={16}/> Add cash entry</button></div>}</div>
  <div className={`stats-grid petty-cash-summary ${amountInStoreCents<0?'has-deficit':''}`}>
   <Stat title="Amount set aside" value={fundLoadsLoading?'…':money(totalSetAsideCents)} note={fundLoadsLoading?'Loading fund loads':`${fundLoads.length} fund loads`} icon={Wallet} tone="navy"/>
   <Stat title="Amount given out" value={loading?'…':money(totalGivenOutCents)} note={loading?'Loading expenses':`${entries.length} expenses`} icon={Activity} tone="amber"/>
   <Stat title="Amount in store" value={loading||fundLoadsLoading?'…':money(amountInStoreCents)} note={amountInStoreCents<0?`Overdrawn by ${money(Math.abs(amountInStoreCents))}`:'Available petty-cash balance'} icon={Wallet} tone={amountInStoreCents<0?'purple':'green'}/>
  </div>
  {showFundOverlay&&<Overlay title={fundEditingId?'Edit fund load':'Load petty-cash funds'} onClose={closeFundOverlay}><form className="panel data-form" onSubmit={submitFundLoad}>
   <div className="data-form-grid">
    <Field label="Date set aside *"><input type="date" required value={fundForm.date} onChange={event=>setFundForm(current=>({...current,date:event.target.value}))}/></Field>
    <Field label="Time *"><input type="time" required value={fundForm.time} onChange={event=>setFundForm(current=>({...current,time:event.target.value}))}/></Field>
    <Field label="Amount set aside *"><input type="number" min="0.01" step="0.01" required value={fundForm.amount} onChange={event=>setFundForm(current=>({...current,amount:event.target.value}))} placeholder="0.00"/></Field>
   </div>
   <div className="form-actions"><span className="muted tiny">{fundEditingId?'Save the updated date and amount.':'This amount will be added to the petty-cash fund.'}</span><div className="data-form-actions"><button className="secondary" type="button" onClick={closeFundOverlay}>Cancel</button><button className="primary" disabled={fundBusy}>{fundBusy?'Saving…':fundEditingId?'Save changes':'Load funds'}</button></div></div>
  </form></Overlay>}
  {!readOnly&&showEntryOverlay&&<Overlay title={editingId?'Edit petty cash entry':'Add petty cash entry'} onClose={reset}>{formElement}</Overlay>}
  {selectedTransaction&&<Overlay className={showDeleteVerification?'':'petty-cash-detail-overlay'} title={showDeleteVerification?'Verify petty-cash deletion':selectedTransaction.direction==='IN'?'Fund load details':'Expense details'} onClose={closeTransactionDetails}>
   {showDeleteVerification?<PettyCashDeleteVerification transaction={selectedTransaction} onCancel={()=>setShowDeleteVerification(false)} onCreateDeleteChallenge={onCreateDeleteChallenge} onDelete={onDelete} onDeleted={closeTransactionDetails}/>:<>
   <div className="ledger-detail-view">
    <div className="ledger-detail-heading"><span className={`cash-direction ${selectedTransaction.direction.toLowerCase()}`}>{selectedTransaction.direction}</span><strong className={`cash-ledger-amount ${selectedTransaction.direction.toLowerCase()}`}>{selectedTransaction.amountCents>0?'+':'-'}{money(Math.abs(selectedTransaction.amountCents))}</strong></div>
    <dl className="ledger-detail-grid">
     <div><dt>Date</dt><dd>{fmt(selectedTransaction.date)}</dd></div>
      <div><dt>Time</dt><dd>{selectedTransaction.time||'—'}</dd></div>
     <div><dt>Type</dt><dd>{selectedTransaction.direction==='IN'?'Funds set aside':'Amount given out'}</dd></div>
     <div className="wide"><dt>Details</dt><dd>{selectedTransaction.details}</dd></div>
     <div><dt>Balance after transaction</dt><dd className={selectedTransaction.balanceAfterCents<0?'negative':''}>{money(selectedTransaction.balanceAfterCents)}</dd></div>
     <div><dt>Registered by</dt><dd>{selectedTransaction.source.createdBy||'—'}</dd></div>
     <div><dt>Updated by</dt><dd>{selectedTransaction.source.updatedBy||'—'}</dd></div>
    </dl>
     <div className="cash-edit-history">
      <div className="cash-edit-history-title"><h3>Amount edit history</h3><span>{selectedEditHistory.length} edits</span></div>
      {selectedEditHistory.length===0?<p className="muted tiny">No edits have been recorded for this transaction.</p>:<div className={`cash-edit-history-list ${selectedEditHistory.length>3?'scrollable':''}`}>
       {selectedEditHistory.map((editRecord,index)=><div className="cash-edit-record" key={`${editRecord.editedAt}-${index}`}>
        <div className="cash-edit-values"><span>Initial amount<strong>{money(toCents(editRecord.initialAmount))}</strong></span><span>Final amount<strong>{money(toCents(editRecord.finalAmount))}</strong></span></div>
        <div className="cash-edit-meta"><span>Edited by <strong>{editRecord.editedBy}</strong></span><time>Edited at <strong>{fmtTimestamp(editRecord.editedAt)}</strong></time></div>
       </div>)}
      </div>}
     </div>
    <div className="form-actions"><span className="muted tiny">This transaction is included in the petty-cash balance.</span><div className="data-form-actions">
     {!readOnly&&<button className="secondary danger-action" type="button" onClick={()=>setShowDeleteVerification(true)}>Delete</button>}
     <button className="secondary" type="button" onClick={()=>setSelectedTransaction(null)}>Close</button>
     {!readOnly&&<button className="primary" type="button" onClick={editSelectedTransaction}>Edit transaction</button>}
    </div></div>
   </div>
   </>}
  </Overlay>}
  <div className="panel table-panel data-table">
   <div className="table-toolbar">
    <RegisterFilters search={search} setSearch={setSearch} sort={sort} setSort={setSort} placeholder="Search date, time, IN/OUT, details, amount…" sortOptions={[{value:'newest',label:'Newest first'},{value:'oldest',label:'Oldest first'},{value:'amount-high',label:'Amount: largest first'},{value:'amount-low',label:'Amount: smallest first'}]}/>
   </div>
   {ledgerLoading?<div className="empty">Loading petty-cash ledger…</div>:sortedLedger.length===0?<Empty text={ledger.length?'No matching transactions.':'No petty-cash transactions yet.'}/>:
    <div className="table-scroll petty-cash-ledger-scroll"><table className="petty-cash-ledger-table"><thead><tr><th>Date</th><th>Time</th><th>Type</th><th>Details</th><th>Amount</th><th>Balance after</th><th>Registered by</th><th>Updated by</th></tr></thead><tbody>
     {sortedLedger.map(item=><tr key={item.id} className="petty-cash-ledger-row" role="button" tabIndex={0} aria-label={`View ${item.direction.toLowerCase()} transaction: ${item.details}`} onClick={()=>setSelectedTransaction(item)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setSelectedTransaction(item);}}}>
      <td>{fmt(item.date)}</td>
      <td>{item.time||'—'}</td>
      <td><span className={`cash-direction ${item.direction.toLowerCase()}`}>{item.direction}</span></td>
      <td>{item.details}</td>
      <td><strong className={`cash-ledger-amount ${item.direction.toLowerCase()}`}>{item.amountCents>0?'+':'-'}{money(Math.abs(item.amountCents))}</strong></td>
      <td><strong className={`cash-ledger-balance ${item.balanceAfterCents<0?'negative':''}`}>{money(item.balanceAfterCents)}</strong></td>
      <td>{item.source.createdBy||'—'}</td>
      <td>{item.source.updatedBy||'—'}</td>
     </tr>)}
    </tbody></table></div>}
   <div className="table-foot">Showing {sortedLedger.length} of {ledger.length} transactions <span>IN adds funds · OUT records expenses</span></div>
  </div>
 </div>
}

function AppliancesPage({entries,itemTypes,onCreateItemType,loading,onSave,onDelete,readOnly=false}){
 const emptyForm=()=>({date:today(),item:'',model:'',name:'',contact:'',location:'',issue:'',status:'Pending',technician:'',purchaseDate:''});
 const [form,setForm]=useState(emptyForm);
 const [editingId,setEditingId]=useState(null);
 const [busy,setBusy]=useState(false);
 const [search,setSearch]=useState('');
 const [sort,setSort]=useState('newest');
 const term=search.trim().toLowerCase();
 const visibleEntries=entries.filter(entry=>!term||[entry.date,entry.item,entry.model,entry.name,entry.contact,entry.location,entry.issue,entry.status||'Pending',entry.technician,entry.purchaseDate].some(value=>String(value??'').toLowerCase().includes(term)));
 const sortedEntries=[...visibleEntries].sort((a,b)=>sort==='oldest'?String(a.date).localeCompare(String(b.date)):String(b.date).localeCompare(String(a.date)));
 const reset=()=>{setForm(emptyForm());setEditingId(null);};
 const change=(field,value)=>setForm(current=>({...current,[field]:value}));
 const submit=async(event)=>{
  event.preventDefault();
  setBusy(true);
  const saved=await onSave({...form,item:form.item.trim(),model:form.model.trim(),name:form.name.trim(),contact:form.contact.trim(),location:form.location.trim(),issue:form.issue.trim(),technician:form.technician.trim()},editingId);
  if(saved)reset();
  setBusy(false);
 };
 const edit=entry=>{
  setEditingId(entry.id);
  setForm({date:entry.date,item:entry.item,model:entry.model,name:entry.name,contact:entry.contact,location:entry.location,issue:entry.issue,status:entry.status||'Pending',technician:entry.technician||'',purchaseDate:entry.purchaseDate||''});
 };
 const formElement=<form className="panel data-form" onSubmit={submit}>
  <div className="data-form-grid">
   <Field label="Date *"><input type="date" required value={form.date} onChange={event=>change('date',event.target.value)}/></Field>
   <ItemTypeField itemTypes={itemTypes} value={form.item} onChange={value=>change('item',value)} onCreateItemType={onCreateItemType}/>
   <Field label="Model *"><input required value={form.model} onChange={event=>change('model',event.target.value)} placeholder="Model number"/></Field>
   <Field label="Name *"><input required value={form.name} onChange={event=>change('name',event.target.value)} placeholder="Customer name"/></Field>
   <Field label="Contact *"><input required value={form.contact} onChange={event=>change('contact',event.target.value)} placeholder="Phone number"/></Field>
   <Field label="Location *"><input required value={form.location} onChange={event=>change('location',event.target.value)} placeholder="Customer location"/></Field>
   <Field label="Issue *" wide><textarea required rows="3" value={form.issue} onChange={event=>change('issue',event.target.value)} placeholder="Describe the issue…"/></Field>
   <Field label="Work status *"><select required value={form.status} onChange={event=>change('status',event.target.value)}>{APPLIANCE_STATUSES.map(status=><option key={status} value={status}>{status==='Waiting-Spare'?'Waiting for spares':status}</option>)}</select></Field>
   <Field label="Technician"><input value={form.technician} onChange={event=>change('technician',event.target.value)} placeholder="Optional"/></Field>
   <Field label="Date of purchase"><input type="date" value={form.purchaseDate} onChange={event=>change('purchaseDate',event.target.value)}/></Field>
  </div>
  <div className="form-actions"><span className="muted tiny">Technician and date of purchase are optional.</span><div className="data-form-actions">{editingId&&<button className="secondary" type="button" onClick={reset}>Cancel</button>}<button className="primary" disabled={busy}>{busy?'Saving…':editingId?'Save changes':'Add appliance'}</button></div></div>
 </form>;
 return <div className="data-register">
  <div className="page-intro"><div><p className="eyebrow">CUSTOMER SERVICE REGISTER</p><h1>Home appliances</h1><p className="muted">{entries.length} appliance records</p></div></div>
  {!readOnly&&(editingId?<Overlay title="Edit home appliance" onClose={reset}>{formElement}</Overlay>:formElement)}
  <div className="panel table-panel data-table">
   <div className="table-toolbar">{readOnly?<RegisterFilters search={search} setSearch={setSearch} sort={sort} setSort={setSort} placeholder="Search appliance, customer, issue…" sortOptions={[{value:'newest',label:'Newest first'},{value:'oldest',label:'Oldest first'}]}/>:<><strong>Appliance records</strong><span className="muted">{entries.length} records</span></>}</div>
   {loading?<div className="empty">Loading appliance records…</div>:sortedEntries.length===0?<Empty text={entries.length?'No matching appliance records.':'No home appliance records yet.'}/>:
    <div className="table-scroll"><table className="appliance-table"><thead><tr><th>Date</th><th>Item</th><th>Model</th><th>Name</th><th>Contact</th><th>Location</th><th>Issue</th><th>Work status</th><th>Technician</th><th>Date of purchase</th><th>Registered by</th><th>Updated by</th>{!readOnly&&<th>Actions</th>}</tr></thead><tbody>
     {sortedEntries.map(entry=><tr key={entry.id}><td>{fmt(entry.date)}</td><td>{entry.item}</td><td><strong>{entry.model}</strong></td><td>{entry.name}</td><td>{entry.contact}</td><td>{entry.location}</td><td className="issue-cell" title={entry.issue}>{entry.issue}</td><td><StatusBadge status={entry.status||'Pending'}/></td><td>{entry.technician||'Unassigned'}</td><td>{fmt(entry.purchaseDate)}</td><td>{entry.createdBy||'—'}</td><td>{entry.updatedBy||'—'}</td>{!readOnly&&<td><div className="action-buttons"><button className="icon-btn" title="Edit appliance record" onClick={()=>edit(entry)}><Settings size={16}/></button><button className="icon-btn danger" title="Delete appliance record" onClick={()=>onDelete(entry.id)}><Trash2 size={16}/></button></div></td>}</tr>)}
    </tbody></table></div>}
   <div className="table-foot">Showing {sortedEntries.length} of {entries.length} appliance records</div>
  </div>
 </div>
}

function DeliveryNotesPage({entries,loading,onSave,onDelete,readOnly=false}){
 const emptyForm=()=>({location:'',deliveryDate:today(),item:'',model:'',serial:''});
 const [form,setForm]=useState(emptyForm);
 const [editingId,setEditingId]=useState(null);
 const [busy,setBusy]=useState(false);
 const [search,setSearch]=useState('');
 const [sort,setSort]=useState('newest');
 const term=search.trim().toLowerCase();
 const filteredEntries=entries.filter(entry=>!term||[entry.location,entry.deliveryDate,entry.item,entry.model,entry.serial].some(value=>String(value??'').toLowerCase().includes(term)));
 const sortedEntries=[...filteredEntries].sort((a,b)=>sort==='oldest'?String(a.deliveryDate).localeCompare(String(b.deliveryDate)):String(b.deliveryDate).localeCompare(String(a.deliveryDate)));
 const reset=()=>{setForm(emptyForm());setEditingId(null);};
 const change=(field,value)=>setForm(current=>({...current,[field]:value}));
 const submit=async(event)=>{
  event.preventDefault();
  setBusy(true);
  const saved=await onSave({...form,location:form.location.trim(),item:form.item.trim(),model:form.model.trim(),serial:form.serial.trim()},editingId);
  if(saved)reset();
  setBusy(false);
 };
 const edit=entry=>{
  setEditingId(entry.id);
  setForm({location:entry.location,deliveryDate:entry.deliveryDate,item:entry.item,model:entry.model,serial:entry.serial});
 };
 const formElement=<form className="panel data-form" onSubmit={submit}>
  <div className="data-form-grid">
   <Field label="Location *"><input required maxLength="160" value={form.location} onChange={event=>change('location',event.target.value)} placeholder="Delivery location"/></Field>
   <Field label="Date of delivery *"><input type="date" required value={form.deliveryDate} onChange={event=>change('deliveryDate',event.target.value)}/></Field>
   <Field label="Item *"><input required maxLength="160" value={form.item} onChange={event=>change('item',event.target.value)} placeholder="Item received"/></Field>
   <Field label="Model *"><input required maxLength="120" value={form.model} onChange={event=>change('model',event.target.value)} placeholder="Model number"/></Field>
   <Field label="Serial *"><input required maxLength="120" value={form.serial} onChange={event=>change('serial',event.target.value)} placeholder="Serial number"/></Field>
  </div>
  <div className="form-actions"><span className="muted tiny">All delivery note details are required.</span><div className="data-form-actions">{editingId&&<button className="secondary" type="button" onClick={reset}>Cancel</button>}<button className="primary" disabled={busy}>{busy?'Saving…':editingId?'Save changes':'Add delivery note'}</button></div></div>
 </form>;
 return <div className="data-register">
  <div className="page-intro"><div><p className="eyebrow">DELIVERY REGISTER</p><h1>Delivery notes</h1><p className="muted">{entries.length} delivery notes</p></div></div>
  {!readOnly&&(editingId?<Overlay title="Edit delivery note" onClose={reset}>{formElement}</Overlay>:formElement)}
  <div className="panel table-panel data-table">
   <div className="table-toolbar">{readOnly?<RegisterFilters search={search} setSearch={setSearch} sort={sort} setSort={setSort} placeholder="Search location, item, model, serial…" sortOptions={[{value:'newest',label:'Newest delivery first'},{value:'oldest',label:'Oldest delivery first'}]}/>:<><strong>Delivery notes</strong><span className="muted">{entries.length} records</span></>}</div>
   {loading?<div className="empty">Loading delivery notes…</div>:sortedEntries.length===0?<Empty text={entries.length?'No matching delivery notes.':'No delivery notes yet.'}/>:
    <div className="table-scroll"><table className="receive-note-table"><thead><tr><th>Location</th><th>Date of delivery</th><th>Item</th><th>Model</th><th>Serial</th><th>Registered by</th><th>Updated by</th>{!readOnly&&<th>Actions</th>}</tr></thead><tbody>
     {sortedEntries.map(entry=><tr key={entry.id}><td>{entry.location}</td><td>{fmt(entry.deliveryDate)}</td><td>{entry.item}</td><td><strong>{entry.model}</strong></td><td>{entry.serial}</td><td>{entry.createdBy||'—'}</td><td>{entry.updatedBy||'—'}</td>{!readOnly&&<td><div className="action-buttons"><button className="icon-btn" title="Edit delivery note" onClick={()=>edit(entry)}><Settings size={16}/></button><button className="icon-btn danger" title="Delete delivery note" onClick={()=>onDelete(entry.id)}><Trash2 size={16}/></button></div></td>}</tr>)}
    </tbody></table></div>}
   <div className="table-foot">Showing {sortedEntries.length} of {entries.length} delivery notes</div>
  </div>
 </div>
}

function CallsPage({calls,loading,view,onSave,onDelete,readOnly=false}){
 const emptyForm=()=>({callerName:'',recordedDate:today(),recordedTime:new Date().toTimeString().slice(0,5),issue:'',status:'Pending'});
 const [form,setForm]=useState(emptyForm);
 const [editingId,setEditingId]=useState(null);
 const [busy,setBusy]=useState(false);
 const [search,setSearch]=useState('');
 const [sort,setSort]=useState('newest');
 const [activeView,setActiveView]=useState(view);
 const isArchive=activeView==='archive';
 const viewCalls=calls.filter(call=>isArchive?call.status==='Sorted':call.status!=='Sorted');
 const term=search.trim().toLowerCase();
 const filteredCalls=viewCalls.filter(call=>!term||[call.callerName,call.recordedDate,call.recordedTime,call.issue,call.status].some(value=>String(value??'').toLowerCase().includes(term)));
 const sortedCalls=[...filteredCalls].sort((a,b)=>{
  const dateA=`${a.recordedDate}T${a.recordedTime}`;
  const dateB=`${b.recordedDate}T${b.recordedTime}`;
  return sort==='oldest'?dateA.localeCompare(dateB):dateB.localeCompare(dateA);
 });
 const reset=()=>{setForm(emptyForm());setEditingId(null);};
 const change=(field,value)=>setForm(current=>({...current,[field]:value}));
 const submit=async(event)=>{
  event.preventDefault();
  setBusy(true);
  const saved=await onSave({...form,callerName:form.callerName.trim(),issue:form.issue.trim()},editingId);
  if(saved)reset();
  setBusy(false);
 };
 const edit=call=>{
  setEditingId(call.id);
  setForm({callerName:call.callerName,recordedDate:call.recordedDate,recordedTime:call.recordedTime,issue:call.issue,status:call.status||'Pending'});
 };
 const formElement=<form className="panel data-form" onSubmit={submit}>
  <div className="data-form-grid">
   <Field label="Caller name *"><input required value={form.callerName} onChange={event=>change('callerName',event.target.value)} placeholder="Caller name"/></Field>
   <Field label="Date recorded *"><input type="date" required value={form.recordedDate} onChange={event=>change('recordedDate',event.target.value)}/></Field>
   <Field label="Time recorded *"><input type="time" required value={form.recordedTime} onChange={event=>change('recordedTime',event.target.value)}/></Field>
   <Field label="Call status *"><select required value={form.status} onChange={event=>change('status',event.target.value)}><option value="Pending">Pending</option><option value="Sorted">Sorted</option></select></Field>
   <Field label="Issue to be sorted *" wide><textarea required rows="3" value={form.issue} onChange={event=>change('issue',event.target.value)} placeholder="Describe the issue…"/></Field>
  </div>
  <div className="form-actions"><span className="muted tiny">Sorted calls move to the archive automatically.</span><div className="data-form-actions">{editingId&&<button className="secondary" type="button" onClick={reset}>Cancel</button>}<button className="primary" disabled={busy}>{busy?'Saving…':editingId?'Save changes':'Add call'}</button></div></div>
 </form>;
 const statusBadge=call=><span className={`badge ${call.status==='Sorted'?'ready':'pending'}`}>{call.status==='Sorted'?'Sorted':'Pending'}</span>;
 return <div className="data-register">
  <div className="page-intro"><div><p className="eyebrow">CALL REGISTER</p><h1>{isArchive?'Archive calls':'Pending calls'}</h1><p className="muted">{viewCalls.length} {isArchive?'archived':'pending'} calls</p></div></div>
  {!readOnly&&<div className="segmented call-view-tabs" role="group" aria-label="Filter calls by status">
   <button type="button" className={!isArchive?'selected':''} aria-pressed={!isArchive} onClick={()=>setActiveView('pending')}>Pending<span className="status-filter-count">{calls.filter(call=>call.status!=='Sorted').length}</span></button>
   <button type="button" className={isArchive?'selected':''} aria-pressed={isArchive} onClick={()=>setActiveView('archive')}>Archive<span className="status-filter-count">{calls.filter(call=>call.status==='Sorted').length}</span></button>
  </div>}
  {!readOnly&&(editingId?<Overlay title="Edit call" onClose={reset}>{formElement}</Overlay>:!isArchive&&formElement)}
  <div className="panel table-panel data-table">
   <div className="table-toolbar"><RegisterFilters search={search} setSearch={setSearch} sort={sort} setSort={setSort} placeholder="Search caller, date, time, issue…" sortOptions={[{value:'newest',label:'Newest first'},{value:'oldest',label:'Oldest first'}]}/></div>
   {loading?<div className="empty">Loading calls…</div>:sortedCalls.length===0?<Empty text={viewCalls.length?'No matching calls.':`No ${isArchive?'archived':'pending'} calls yet.`}/>:
    <div className="table-scroll"><table className="calls-table"><thead><tr><th>Caller name</th><th>Date recorded</th><th>Time</th><th>Issue to be sorted</th><th>Status</th><th>Registered by</th><th>Updated by</th>{!readOnly&&<th>Actions</th>}</tr></thead><tbody>
     {sortedCalls.map(call=><tr key={call.id}><td><strong>{call.callerName}</strong></td><td>{fmt(call.recordedDate)}</td><td>{call.recordedTime}</td><td>{call.issue}</td><td>{statusBadge(call)}</td><td>{call.createdBy||'—'}</td><td>{call.updatedBy||'—'}</td>{!readOnly&&<td><div className="action-buttons">{call.status!=='Sorted'&&<button className="icon-btn" title="Mark call as sorted" onClick={()=>onSave({...call,status:'Sorted'},call.id)}><Check size={16}/></button>}<button className="icon-btn" title="Edit call" onClick={()=>edit(call)}><Settings size={16}/></button><button className="icon-btn danger" title="Delete call" onClick={()=>onDelete(call.id)}><Trash2 size={16}/></button></div></td>}</tr>)}
    </tbody></table></div>}
   <div className="table-foot">Showing {sortedCalls.length} of {viewCalls.length} calls</div>
  </div>
 </div>
}

function RecordsPage({page,records,allCount,search,setSearch,recordType,setRecordType,loading,onEdit,onDelete,onNew,readOnly=false,rowActionOverlay=false,deletingRecordIds=new Set()}){
 const title=page==='records'?'All service records':'Work status';
 const [statusFilter,setStatusFilter]=useState('All');
 const [sort,setSort]=useState('newest');
 const [selectedRecord,setSelectedRecord]=useState(null);
 const [viewingRecord,setViewingRecord]=useState(null);
 const jobCards=records.filter(record=>record.recordType!=='gatePass');
 const gatePasses=records.filter(record=>record.recordType==='gatePass');
 const isGatePass=page==='records'&&recordType==='gatePass';
 const categoryRecords=isGatePass?gatePasses:jobCards;
 const term=search.trim().toLowerCase();
 const matchingRecords=categoryRecords.filter(record=>{
   const fields=isGatePass
    ?[record.itemType,record.model,record.serial,record.collectionDate,record.destination,record.clientName]
    :[record.jobCard,record.date,record.itemType,record.model,record.serial,record.issue,record.contact,record.status];
   return !term||fields.some(value=>String(value??'').toLowerCase().includes(term));
 });
 const statusFilters=[
   {value:'All',label:'All',count:jobCards.length},
   {value:'Pending',label:'Pending',count:jobCards.filter(r=>r.status==='Pending').length},
   {value:'Ready',label:'Ready',count:jobCards.filter(r=>r.status==='Ready').length},
   {value:'Collected',label:'Collected',count:jobCards.filter(r=>r.status==='Collected').length},
   {value:'Waiting-Spare',label:'Waiting for spares',count:jobCards.filter(r=>r.status==='Waiting-Spare').length},
 ];
 const visibleRecords=page==='status'&&statusFilter!=='All'?matchingRecords.filter(r=>r.status===statusFilter):matchingRecords;
 const sortDate=record=>isGatePass?record.collectionDate:record.date;
 const sorted=[...visibleRecords].sort((a,b)=>sort==='oldest'?String(sortDate(a)).localeCompare(String(sortDate(b))):String(sortDate(b)).localeCompare(String(sortDate(a))));
 const recordCount=isGatePass?gatePasses.length:jobCards.length;
 const openRecordActions=(event,record)=>{
  if(!rowActionOverlay||event.target.closest('button'))return;
  setSelectedRecord(record);
 };
 const recordDetails=record=>record.recordType==='gatePass'
 ?[['Item type',record.itemType||'Uncategorized'],['Model',record.model],['Serial number',record.serial],['Date of collection',record.collectionDate?fmt(record.collectionDate):''],['Destination',record.destination],['Client name',record.clientName],['Registered by',record.createdBy],['Updated by',record.updatedBy]]
 :[['Job card',record.jobCard],['Date received',record.date?fmt(record.date):''],['Item type',record.itemType||'Uncategorized'],['Product',record.model],['Serial number',record.serial],['Issue',record.issue],['Contact',record.contact],['Status',record.status],['Ready category',record.readyCategory],['Technician',record.technician],['Internal remarks',record.remarks],['Registered by',record.createdBy],['Updated by',record.updatedBy]].filter(([,value])=>value!==''&&value!=null);
 return <>
  <div className="page-intro">
    <div><p className="eyebrow">SERVICE REGISTER</p><h1>{title}</h1><p className="muted">{page==='records'?`${allCount} records in the register`:`${jobCards.length} job cards across all statuses`}</p></div>
   {!readOnly&&onNew&&<button className="primary" onClick={onNew}><Plus size={17}/> New record</button>}
  </div>
   {page==='records'&&<div className="segmented record-type-tabs" role="group" aria-label="Filter records by category">
    <button type="button" className={!isGatePass?'selected':''} aria-pressed={!isGatePass} onClick={()=>setRecordType('jobCard')}>Job cards<span className="status-filter-count">{jobCards.length}</span></button>
    <button type="button" className={isGatePass?'selected':''} aria-pressed={isGatePass} onClick={()=>setRecordType('gatePass')}>Gate passes<span className="status-filter-count">{gatePasses.length}</span></button>
   </div>}
  <div className="panel table-panel">
   {page==='status'&&<div className="status-filter-tabs segmented" role="group" aria-label="Filter records by status">{statusFilters.map(filter=><button key={filter.value} type="button" className={statusFilter===filter.value?'selected':''} aria-pressed={statusFilter===filter.value} onClick={()=>setStatusFilter(filter.value)}>{filter.label}<span className="status-filter-count">{filter.count}</span></button>)}</div>}
    <div className="table-toolbar"><RegisterFilters search={search} setSearch={setSearch} sort={sort} setSort={setSort} placeholder={isGatePass?'Search model, serial, date, destination, client…':'Search job card, model, serial, contact…'} sortOptions={[{value:'newest',label:'Newest first'},{value:'oldest',label:'Oldest first'}]}/></div>
    {loading?<div className="empty">Loading records…</div>:sorted.length===0?<Empty text={`No matching ${isGatePass?'gate pass':'job card'} records found.`}/>:
     <div className="table-scroll">{isGatePass?<table className="gate-pass-table">
      <thead><tr><th>Item type</th><th>Model number</th><th>Serial number</th><th>Date of collection</th><th>Destination</th><th>Client name</th><th>Registered by</th><th>Updated by</th>{!readOnly&&!rowActionOverlay&&<th>Actions</th>}</tr></thead>
      <tbody>{sorted.map(r=><tr key={r.id} className={`${rowActionOverlay?'record-action-row':''} ${deletingRecordIds.has(r.id)?'is-deleting':''}`} tabIndex={rowActionOverlay?0:undefined} aria-label={rowActionOverlay?`Actions for gate pass ${r.model}`:undefined} onClick={event=>openRecordActions(event,r)} onKeyDown={event=>{if(rowActionOverlay&&event.target===event.currentTarget&&(event.key==='Enter'||event.key===' ')){event.preventDefault();setSelectedRecord(r);}}}>
       <td>{r.itemType||'Uncategorized'}</td><td><strong>{r.model}</strong></td><td>{r.serial}</td><td>{fmt(r.collectionDate)}</td><td>{r.destination}</td><td>{r.clientName}</td>
       <td>{r.createdBy||'—'}</td><td>{r.updatedBy||'—'}</td>
       {!readOnly&&!rowActionOverlay&&<td><div className="action-buttons"><button className="icon-btn" title="Edit gate pass" onClick={()=>onEdit(r)}><Settings size={16}/></button><button className="icon-btn danger" title="Delete gate pass" onClick={()=>onDelete(r.id)}><Trash2 size={16}/></button></div></td>}
      </tr>)}</tbody>
     </table>:<table className="job-card-table">
      <thead><tr><th>Job card</th><th>Date received</th><th>Item type</th><th>Product</th><th>Issue</th><th>Contact</th><th>Status</th><th>Registered by</th><th>Updated by</th>{!readOnly&&!rowActionOverlay&&<th>Actions</th>}</tr></thead>
      <tbody>{sorted.map(r=><tr key={r.id} className={`${rowActionOverlay?'record-action-row':''} ${deletingRecordIds.has(r.id)?'is-deleting':''}`} tabIndex={rowActionOverlay?0:undefined} aria-label={rowActionOverlay?`Actions for job card ${r.jobCard}`:undefined} onClick={event=>openRecordActions(event,r)} onKeyDown={event=>{if(rowActionOverlay&&event.target===event.currentTarget&&(event.key==='Enter'||event.key===' ')){event.preventDefault();setSelectedRecord(r);}}}>
       <td><strong className="job-number">{r.jobCard}</strong></td>
       <td>{fmt(r.date)}</td>
       <td>{r.itemType||'Uncategorized'}</td>
       <td><strong>{r.model}</strong><small>{r.serial||'No serial'}</small><small>{r.technician||'Unassigned'}</small></td>
       <td className="issue-cell" title={r.issue}>{r.issue}</td>
       <td>{r.contact}</td>
       <td><StatusBadge status={r.status} category={r.readyCategory}/></td>
       <td>{r.createdBy||'—'}</td>
       <td>{r.updatedBy||'—'}</td>
       {!readOnly&&!rowActionOverlay&&<td><div className="action-buttons"><button className="icon-btn" title="Edit job card" onClick={()=>onEdit(r)}><Settings size={16}/></button><button className="icon-btn danger" title="Delete job card" onClick={()=>onDelete(r.id)}><Trash2 size={16}/></button></div></td>}
      </tr>)}</tbody>
     </table>}</div>}
    <div className="table-foot">Showing {sorted.length} of {recordCount} {isGatePass?'gate passes':'job cards'} <span>Live updates enabled</span></div>
  </div>
  {selectedRecord&&<Overlay title={`${selectedRecord.recordType==='gatePass'?'Gate pass':'Job card'} actions`} className="service-record-actions" onClose={()=>setSelectedRecord(null)}>
   <p className="muted">{selectedRecord.recordType==='gatePass'?`${selectedRecord.model} · ${selectedRecord.serial}`:`${selectedRecord.jobCard} · ${selectedRecord.model}`}</p>
   <div className="service-record-action-buttons">
    <button type="button" className="secondary" onClick={()=>{setViewingRecord(selectedRecord);setSelectedRecord(null);}}><Eye size={16}/> View</button>
    <button type="button" className="secondary" onClick={()=>{setSelectedRecord(null);onEdit(selectedRecord);}}><Settings size={16}/> Edit</button>
    <button type="button" className="secondary danger-action" onClick={()=>{setSelectedRecord(null);onDelete(selectedRecord.id);}}><Trash2 size={16}/> Delete</button>
   </div>
  </Overlay>}
  {viewingRecord&&<Overlay title={`${viewingRecord.recordType==='gatePass'?'Gate pass':'Job card'} details`} className="service-record-view" onClose={()=>setViewingRecord(null)}>
   <dl className="service-record-details">{recordDetails(viewingRecord).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{label==='Status'?<StatusBadge status={value} category={viewingRecord.readyCategory}/>:value||'—'}</dd></div>)}</dl>
   <div className="service-record-action-buttons"><button type="button" className="secondary" onClick={()=>setViewingRecord(null)}>Close</button></div>
  </Overlay>}
 </>
}

function Reports({records,appliances,invoices,pettyCashEntries,pettyCashFundLoads,loading,appliancesLoading,invoicesLoading,pettyCashLoading,fundLoadsLoading}){
 const [category,setCategory]=useState('ward');
 const [period,setPeriod]=useState('weekly');
 const [anchor,setAnchor]=useState(today());
 const [selectedType,setSelectedType]=useState('All');
 const [exportType,setExportType]=useState('csv');
 const categoryTypes=useMemo(()=>{
  const values=category==='homeAppliances'?appliances.map(entry=>entry.item?.trim()||'Uncategorized'):records.map(record=>record.itemType?.trim()||'Uncategorized');
  return Array.from(new Set(values)).sort((a,b)=>a.localeCompare(b));
 },[category,records,appliances]);
 const activeType=categoryTypes.includes(selectedType)?selectedType:'All';
 const range=useMemo(()=>{
  const anchorDate=new Date(`${anchor}T00:00:00`);
  let start,end,label;
  if(period==='weekly'){
   start=new Date(anchorDate);
   start.setDate(anchorDate.getDate()-((anchorDate.getDay()+6)%7));
   end=new Date(start);
   end.setDate(start.getDate()+7);
   const lastDay=new Date(end);
   lastDay.setDate(end.getDate()-1);
   label=`${fmt(start.toISOString().slice(0,10))} – ${fmt(lastDay.toISOString().slice(0,10))}`;
  }else{
   start=new Date(anchorDate.getFullYear(),anchorDate.getMonth(),1);
   end=new Date(anchorDate.getFullYear(),anchorDate.getMonth()+1,1);
   label=start.toLocaleDateString(undefined,{month:'long',year:'numeric'});
  }
  const dateKey=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  return {start:dateKey(start),end:dateKey(end),label};
 },[period,anchor]);
 const inPeriod=date=>Boolean(date&&date>=range.start&&date<range.end);
 const exportDate=value=>value?value.split('-').reverse().join('/'):'';
 const sortByDate=(dateField)=>(a,b)=>String(a[dateField]||'').localeCompare(String(b[dateField]||''))||String(a.model||'').localeCompare(String(b.model||''))||String(a.id||'').localeCompare(String(b.id||''));
 const serviceSubset=records.filter(record=>{
  const date=record.recordType==='gatePass'?record.collectionDate:record.date;
  return inPeriod(date)&&(activeType==='All'||(record.itemType?.trim()||'Uncategorized')===activeType);
 });
 const inWard=serviceSubset.filter(record=>record.recordType!=='gatePass').sort(sortByDate('date'));
 const outWard=serviceSubset.filter(record=>record.recordType==='gatePass').sort(sortByDate('collectionDate'));
 const applianceRows=appliances.filter(entry=>inPeriod(entry.date)&&(activeType==='All'||(entry.item?.trim()||'Uncategorized')===activeType)).sort(sortByDate('date'));
 const periodInvoices=invoices.filter(invoice=>inPeriod(invoice.invoiceDate));
 const periodFundLoads=pettyCashFundLoads.filter(load=>inPeriod(load.date));
 const periodExpenses=pettyCashEntries.filter(entry=>inPeriod(entry.date));
 const invoiceTotalCents=periodInvoices.reduce((sum,invoice)=>sum+Math.round(Number(invoice.total||0)*100),0);
 const fundsTotalCents=periodFundLoads.reduce((sum,load)=>sum+Math.round(Number(load.amount||0)*100),0);
 const expensesTotalCents=periodExpenses.reduce((sum,entry)=>sum+Math.round(Number(entry.amount||0)*100),0);
 const cashBalanceCents=pettyCashFundLoads.reduce((sum,load)=>load.date<range.end?sum+Math.round(Number(load.amount||0)*100):sum,0)-pettyCashEntries.reduce((sum,entry)=>entry.date<range.end?sum+Math.round(Number(entry.amount||0)*100):sum,0);
 const financeRows=[
  ...periodInvoices.map(invoice=>({id:`invoice-${invoice.id}`,date:invoice.invoiceDate,category:'Invoice (not a payment)',details:`${invoice.invoiceNumber} · ${invoice.clientName}`,amountCents:Math.round(Number(invoice.total||0)*100)})),
  ...periodFundLoads.map(load=>({id:`fund-${load.id}`,date:load.date,category:'Funds loaded',details:'Petty-cash funds set aside',amountCents:Math.round(Number(load.amount||0)*100)})),
  ...periodExpenses.map(entry=>({id:`expense-${entry.id}`,date:entry.date,category:'Expense',details:entry.whereUsed,amountCents:-Math.round(Number(entry.amount||0)*100)})),
 ].sort((a,b)=>a.date.localeCompare(b.date)||a.category.localeCompare(b.category)||a.id.localeCompare(b.id));
 const reportCount=category==='ward'?inWard.length+outWard.length:category==='homeAppliances'?applianceRows.length:financeRows.length;
 const reportTitle=category==='ward'?'Ward report':category==='homeAppliances'?'Home appliances':'Finance';
 const reportNote=category==='ward'?'IN WARD uses job-card registration dates; OUT WARD uses gate-pass collection dates. Quantity is one per recorded item.':category==='homeAppliances'?'Home appliance entries are grouped by their registration date. Quantity is one per record.':'Invoice values are amounts invoiced, not confirmed payments. Petty-cash balance is cumulative through the selected period end.';
 const exportData=()=>{
  if(category==='ward'){
   return {headers:['Ward','Date','Items','Model','Serial','Qty'],data:[
    ...inWard.map(record=>['IN WARD',exportDate(record.date),record.itemType||'Uncategorized',record.model,record.serial||'',1]),
    ...outWard.map(record=>['OUT WARD',exportDate(record.collectionDate),record.itemType||'Uncategorized',record.model,record.serial||'',1]),
   ]};
  }
  if(category==='homeAppliances')return {headers:['Date','Item','Model','Name','Contact','Location','Issue','Status'],data:applianceRows.map(entry=>[exportDate(entry.date),entry.item||'Uncategorized',entry.model,entry.name,entry.contact,entry.location,entry.issue,entry.status||'Pending'])};
  return {headers:['Date','Category','Details','Amount (KES)'],data:financeRows.map(row=>[exportDate(row.date),row.category,row.details,row.amountCents/100])};
 };
 const download=(content,mime,extension)=>{
  const blob=new Blob([content],{type:mime});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;
  link.download=`${category}-report-${period}-${anchor}.${extension}`;
  link.click();
  URL.revokeObjectURL(url);
 };
 const exportReport=()=>{
  if(exportType==='pdf'){window.print();return;}
  const {headers,data}=exportData();
  if(exportType==='csv'){
   download([headers,...data].map(row=>row.map(value=>`"${String(value??'').replaceAll('"','""')}"`).join(',')).join('\n'),'text/csv;charset=utf-8','csv');
   return;
  }
  const escapeXml=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
  const excelCell=value=>`<Cell><Data ss:Type="${typeof value==='number'?'Number':'String'}">${escapeXml(value)}</Data></Cell>`;
  const excelRow=values=>`<Row>${values.map(excelCell).join('')}</Row>`;
  const excelSection=(title,sectionHeaders,sectionRows)=>[
   `<Row><Cell ss:MergeAcross="${sectionHeaders.length-1}" ss:StyleID="WardTitle"><Data ss:Type="String">${title}</Data></Cell></Row>`,
   excelRow(sectionHeaders),
   ...(sectionRows.length?sectionRows.map(excelRow):[`<Row><Cell ss:MergeAcross="${sectionHeaders.length-1}"><Data ss:Type="String">No records in this period.</Data></Cell></Row>`]),
  ];
  const sheetRows=category==='ward'
   ?[...excelSection('IN WARD',['DATE','ITEMS','MODEL','SERIAL','QTY'],inWard.map((record,index)=>[exportDate(index&&inWard[index-1].date===record.date?'':record.date),record.itemType||'Uncategorized',record.model,record.serial||'',1])), '<Row/>', ...excelSection('OUT WARD',['DATE','ITEMS','MODEL','SERIAL','QTY'],outWard.map((record,index)=>[exportDate(index&&outWard[index-1].collectionDate===record.collectionDate?'':record.collectionDate),record.itemType||'Uncategorized',record.model,record.serial||'',1]))]
   :excelSection(reportTitle.toUpperCase(),headers,data);
  const content=`<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="WardTitle"><Alignment ss:Horizontal="Center"/><Font ss:Bold="1" ss:Size="14"/></Style></Styles><Worksheet ss:Name="Report"><Table>${sheetRows.join('')}</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><PageSetup><Layout x:Orientation="Landscape"/></PageSetup><FitToPage/><Print><FitWidth>1</FitWidth><FitHeight>0</FitHeight></Print></WorksheetOptions></Worksheet></Workbook>`;
  download(content,'application/vnd.ms-excel','xls');
 };
 const categoryLoading=category==='ward'?loading:category==='homeAppliances'?appliancesLoading:invoicesLoading||pettyCashLoading||fundLoadsLoading;
 const reportHeading=category==='ward'?'Inventory movement':category==='homeAppliances'?'Home appliances':'Finance';
 return <>
  <div className="page-intro"><div><p className="eyebrow">REPORTS</p><h1>Reports & summaries</h1><p className="muted">View ward, home appliance, or finance reports.</p></div><div className="report-export-controls"><label className="date-control">Export type<select value={exportType} onChange={event=>setExportType(event.target.value)}><option value="csv">CSV</option><option value="pdf">PDF</option><option value="excel">EXCEL</option></select></label><button className="secondary" onClick={exportReport}><Download size={16}/> Export</button></div></div>
  <div className="segmented report-category-tabs" role="group" aria-label="Report category">
   <button type="button" className={category==='ward'?'selected':''} aria-pressed={category==='ward'} onClick={()=>setCategory('ward')}>IN / OUT WARD</button>
   <button type="button" className={category==='homeAppliances'?'selected':''} aria-pressed={category==='homeAppliances'} onClick={()=>setCategory('homeAppliances')}>Home appliances</button>
   <button type="button" className={category==='finance'?'selected':''} aria-pressed={category==='finance'} onClick={()=>setCategory('finance')}>Finance</button>
  </div>
  <div className="panel report-controls">
   <div className="segmented"><button type="button" className={period==='weekly'?'selected':''} aria-pressed={period==='weekly'} onClick={()=>setPeriod('weekly')}>Weekly report</button><button type="button" className={period==='monthly'?'selected':''} aria-pressed={period==='monthly'} onClick={()=>setPeriod('monthly')}>Monthly report</button></div>
   <label className="date-control">{period==='weekly'?'Choose a date in the week':'Choose a month'}<input type={period==='weekly'?'date':'month'} value={period==='weekly'?anchor:anchor.slice(0,7)} onChange={event=>setAnchor(period==='weekly'?event.target.value:`${event.target.value}-01`)}/></label>
   {category!=='finance'&&<label className="date-control">Item type<select value={activeType} onChange={event=>setSelectedType(event.target.value)}><option value="All">All item types</option>{categoryTypes.map(type=><option key={type} value={type}>{type}</option>)}</select></label>}
  </div>
  <div className="report-print-area">
   <div className="report-heading"><div><p className="eyebrow">{reportHeading.toUpperCase()}</p><h2>{range.label}</h2></div><span className="report-total">{reportCount} {category==='finance'?'transactions':category==='homeAppliances'?'appliances':'items'}{category!=='finance'&&activeType!=='All'?` · ${activeType}`:''}</span></div>
   {category==='ward'&&<><WardReportTable title="IN WARD" records={inWard} dateField="date" loading={loading}/><WardReportTable title="OUT WARD" records={outWard} dateField="collectionDate" loading={loading}/></>}
   {category==='homeAppliances'&&<HomeApplianceReportTable records={applianceRows} loading={appliancesLoading}/>}
   {category==='finance'&&<>
    <div className="stats-grid report-stats">
     <Stat title="Total invoiced" value={invoicesLoading?'…':fmtKes(invoiceTotalCents/100)} note={`${periodInvoices.length} invoices · payment status not tracked`} icon={FileText} tone="navy"/>
     <Stat title="Funds loaded" value={fundLoadsLoading?'…':fmtKes(fundsTotalCents/100)} note={`${periodFundLoads.length} fund loads`} icon={Wallet} tone="green"/>
     <Stat title="Petty-cash expenses" value={pettyCashLoading?'…':fmtKes(expensesTotalCents/100)} note={`${periodExpenses.length} expenses`} icon={Activity} tone="amber"/>
     <Stat title="Petty-cash balance" value={pettyCashLoading||fundLoadsLoading?'…':fmtKes(cashBalanceCents/100)} note="Cumulative through period end" icon={Wallet} tone={cashBalanceCents<0?'purple':'green'}/>
    </div>
    <div className="panel report-table finance-report-table-panel"><div className="panel-head"><div><h3>Finance activity</h3><p className="muted">Invoice totals are not confirmed payments.</p></div></div>
     {categoryLoading?<div className="empty">Loading finance records…</div>:financeRows.length===0?<Empty text="No finance activity in this period."/>:<div className="table-scroll"><table className="finance-report-table"><thead><tr><th>Date</th><th>Category</th><th>Details</th><th>Amount (KES)</th></tr></thead><tbody>{financeRows.map(row=><tr key={row.id}><td>{fmt(row.date)}</td><td>{row.category}</td><td>{row.details}</td><td><strong className={row.amountCents<0?'cash-ledger-amount out':'cash-ledger-amount in'}>{fmtKes(row.amountCents/100)}</strong></td></tr>)}</tbody></table></div>}
    </div>
   </>}
  </div>
  <p className="report-note"><Activity size={15}/>{categoryLoading?'Loading report data…':reportNote}</p>
 </>;
}

function WardReportTable({title,records,dateField,loading=false}){
 return <div className="panel report-table ward-report-panel">
  <div className="table-scroll"><table className="ward-report-table">
   <thead><tr className="ward-report-title"><th colSpan="5">{title}</th></tr><tr><th>DATE</th><th>ITEMS</th><th>MODEL</th><th>SERIAL</th><th>QTY</th></tr></thead>
   <tbody>{loading?<tr><td className="ward-report-empty" colSpan="5">Loading report data…</td></tr>:records.length===0?<tr><td className="ward-report-empty" colSpan="5">No items recorded in this period.</td></tr>:records.map((record,index)=>{
    const date=record[dateField];
    const previousDate=index?records[index-1][dateField]:null;
    return <tr key={record.id}><td>{date!==previousDate?date.split('-').reverse().join('/'):''}</td><td>{record.itemType||'Uncategorized'}</td><td>{record.model}</td><td>{record.serial||''}</td><td>1</td></tr>;
   })}</tbody>
  </table></div>
 </div>;
}

function HomeApplianceReportTable({records,loading}){
 return <div className="panel report-table appliance-report-panel">
  {loading?<div className="empty">Loading home appliance records…</div>:records.length===0?<Empty text="No home appliance records in this period."/>:<div className="table-scroll"><table className="appliance-report-table"><thead><tr><th>Date</th><th>Item</th><th>Model</th><th>Customer</th><th>Contact</th><th>Location</th><th>Issue</th><th>Status</th></tr></thead><tbody>{records.map(record=><tr key={record.id}><td>{fmt(record.date)}</td><td>{record.item||'Uncategorized'}</td><td>{record.model}</td><td>{record.name}</td><td>{record.contact}</td><td>{record.location}</td><td>{record.issue}</td><td>{record.status||'Pending'}</td></tr>)}</tbody></table></div>}
 </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
