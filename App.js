
import React, { useState, useEffect, useMemo } from 'react';
import { html } from 'htm/react';
import * as Lucide from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { analyzeFile } from './services/gemini.js';

const { 
  Plus, Search, LayoutGrid, FileText, Image: ImageIcon, File, 
  Star, Trash2, X, Download, AlertCircle, HardDrive, StickyNote, 
  LogOut, User, Mail, Lock, Loader2, Folder, ChevronRight, ChevronLeft, ArrowUpRight, CheckCircle2,
  Clock, Filter, Edit3, MoreVertical, ExternalLink
} = Lucide;

// --- Configuration ---
const SUPABASE_URL = 'https://zhaouflvkajwdspfllew.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoYW91Zmx2a2Fqd2RzcGZsbGV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNTU1NzQsImV4cCI6MjA4MjkzMTU3NH0.nGP_5J6DFRswGGoq8Cq7DCrmldAyl5N6hRYbGnnB0WA';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ALLOWED_MIMES = [
  'image/jpeg', 'image/png', 'image/jpg', 'image/gif', 
  'video/mp4', 'text/plain', 'application/zip', 
  'application/x-rar-compressed', 'application/vnd.rar',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/html'
];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// --- Components ---

const FileIcon = ({ filename, className = "" }) => {
  if (!filename) return html`<span className="fiv-viv ${className}"></span>`;
  const parts = filename.split('.');
  const ext = parts.length > 1 ? parts.pop().toLowerCase() : 'unknown';
  return html`<span className="fiv-viv fiv-icon-${ext} ${className}"></span>`;
};

const AuthForm = ({ onAuth }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isLogin) {
        const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
        if (authErr) throw authErr;
        onAuth(data.user);
      } else {
        const { data, error: authErr } = await supabase.auth.signUp({ email, password });
        if (authErr) throw authErr;
        if (data.user) setError("Activation email sent. Verify to continue.");
      }
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return html`
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-6">
      <div className="bg-white p-12 rounded-[56px] shadow-2xl w-full max-w-md border border-slate-100 animate-in zoom-in duration-500">
        <div className="text-center mb-10">
          <div className="bg-indigo-600 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-indigo-100 rotate-6">
            <${Folder} className="text-white" size=${40} />
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Gemini Drive</h1>
          <p className="text-slate-400 font-bold mt-2 uppercase text-[10px] tracking-[0.2em]">S3 Federated Storage</p>
        </div>
        ${error && html`<div className="mb-6 p-4 bg-red-50 text-red-600 rounded-3xl text-xs font-bold border border-red-100 flex items-center"><${AlertCircle} size=${16} className="mr-3 flex-shrink-0" /><span>${error}</span></div>`}
        <form onSubmit=${handleSubmit} className="space-y-4">
          <input type="email" placeholder="Identity" className="w-full p-5 bg-slate-50 rounded-3xl outline-none focus:ring-4 ring-indigo-50 font-bold transition-all" value=${email} onChange=${e => setEmail(e.target.value)} required />
          <input type="password" placeholder="Passkey" className="w-full p-5 bg-slate-50 rounded-3xl outline-none focus:ring-4 ring-indigo-50 font-bold transition-all" value=${password} onChange=${e => setPassword(e.target.value)} required />
          <button type="submit" disabled=${loading} className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-black shadow-xl hover:bg-indigo-700 active:scale-95 transition-all">
            ${loading ? html`<${Loader2} className="animate-spin mx-auto" />` : (isLogin ? 'Enter Hub' : 'Join Network')}
          </button>
        </form>
        <p className="text-center mt-10 text-[11px] font-black text-slate-300 uppercase tracking-widest">
          ${isLogin ? "New node?" : "Member?"}
          <button onClick=${() => setIsLogin(!isLogin)} className="ml-2 text-indigo-600 hover:underline">${isLogin ? 'Register' : 'Login'}</button>
        </p>
      </div>
    </div>
  `;
};

const App = () => {
  const [user, setUser] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [filters, setFilters] = useState({ search: '', type: 'all', starred: false });
  const [selectedFile, setSelectedFile] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { setUser(session.user); fetchFiles(session.user.id); }
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) { setUser(s.user); fetchFiles(s.user.id); }
      else { setUser(null); setFiles([]); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchFiles = async (uid) => {
    const { data, error } = await supabase.from('user_files').select('*').eq('user_id', uid).order('created_at', { ascending: false });
    if (!error && data) setFiles(data);
  };

  const handleUpload = async (e) => {
    const list = Array.from(e.target.files || []);
    if (!list.length || !user) return;
    setUploading(true);

    for (const f of list) {
      if (!ALLOWED_MIMES.includes(f.type) && !f.name.endsWith('.xlsx') && !f.name.endsWith('.docx')) {
        alert(`Type ${f.type} is restricted.`);
        continue;
      }
      if (f.size > MAX_FILE_SIZE) {
        alert(`File too large (Max 50MB).`);
        continue;
      }

      const fileId = crypto.randomUUID();
      const storagePath = `uploads/${user.id}/${fileId}/${f.name}`;

      try {
        // 1. Upload to Storage
        const { error: storageErr } = await supabase.storage.from('file_uploads').upload(storagePath, f);
        if (storageErr) throw storageErr;

        // 2. Prepare AI Analysis (multimodal if image)
        const reader = new FileReader();
        reader.onload = async (ev) => {
          const content = ev.target.result;
          const analysis = await analyzeFile(f.name, content, f.type);
          
          // 3. Save Metadata
          const { data, error: dbErr } = await supabase.from('user_files').insert([{
            user_id: user.id,
            name: f.name,
            mime_type: f.type,
            size: f.size,
            storage_path: storagePath,
            analysis: analysis
          }]).select();

          if (!dbErr && data) setFiles(prev => [data[0], ...prev]);
        };
        reader.readAsDataURL(f);
      } catch (err) { alert(`Sync failed: ${err.message}`); }
    }
    setUploading(false);
    e.target.value = '';
  };

  const deleteFile = async (file, e) => {
    if (e) e.stopPropagation();
    if (!confirm("Destroy this storage node?")) return;
    
    // 1. Delete Storage Binary
    await supabase.storage.from('file_uploads').remove([file.storage_path]);
    
    // 2. Delete Metadata
    const { error } = await supabase.from('user_files').delete().eq('id', file.id);
    if (!error) {
      setFiles(prev => prev.filter(f => f.id !== file.id));
      if (selectedFile?.id === file.id) setSelectedFile(null);
    }
  };

  const getSignedDownload = async (path) => {
    const { data, error } = await supabase.storage.from('file_uploads').createSignedUrl(path, 3600);
    if (!error && data) window.open(data.signedUrl, '_blank');
  };

  const renameFile = async (id, currentName) => {
    const newName = prompt("New node name:", currentName);
    if (!newName || newName === currentName) return;
    const { error } = await supabase.from('user_files').update({ name: newName }).eq('id', id);
    if (!error) setFiles(prev => prev.map(f => f.id === id ? { ...f, name: newName } : f));
  };

  const toggleStar = async (id, current) => {
    const { error } = await supabase.from('user_files').update({ starred: !current }).eq('id', id);
    if (!error) setFiles(prev => prev.map(f => f.id === id ? { ...f, starred: !current } : f));
  };

  const filtered = useMemo(() => {
    return files.filter(f => {
      const s = filters.search.toLowerCase();
      const matchesSearch = (f.name || '').toLowerCase().includes(s) || (f.analysis && f.analysis.toLowerCase().includes(s));
      const matchesStar = !filters.starred || f.starred;
      const matchesType = filters.type === 'all' || 
        (filters.type === 'image' && f.mime_type && f.mime_type.startsWith('image/')) ||
        (filters.type === 'doc' && f.mime_type && (f.mime_type.includes('document') || f.mime_type.includes('text') || f.mime_type.includes('sheet')));
      return matchesSearch && matchesStar && matchesType;
    });
  }, [files, filters]);

  if (loading) return html`<div className="h-screen flex items-center justify-center"><${Loader2} className="animate-spin text-indigo-600" size=${40} /></div>`;
  if (!user) return html`<${AuthForm} onAuth=${setUser} />`;

  return html`
    <div className="flex h-screen bg-white text-slate-900 overflow-hidden font-inter">
      <!-- Sidebar -->
      <aside className=${`bg-white border-r border-slate-100 transition-all duration-300 flex flex-col ${isSidebarOpen ? 'w-80' : 'w-0 overflow-hidden'}`}>
        <div className="p-10 flex flex-col h-full min-w-[320px]">
          <div className="flex items-center space-x-4 mb-12">
            <div className="bg-indigo-600 p-3 rounded-2xl shadow-xl shadow-indigo-100 rotate-6"><${Folder} className="text-white" size=${24} /></div>
            <span className="text-2xl font-black text-slate-900 tracking-tighter">Gemini Drive</span>
          </div>
          <nav className="flex-1 space-y-2">
             <SidebarItem active=${!filters.starred && filters.type === 'all'} onClick=${() => setFilters({ ...filters, starred: false, type: 'all' })} icon=${LayoutGrid} label="Network Hub" />
             <SidebarItem active=${filters.starred} onClick=${() => setFilters({ ...filters, starred: true })} icon=${Star} label="Pinned Units" />
             <div className="pt-8 pb-4 px-4 text-[10px] font-black text-slate-300 uppercase tracking-widest">Federated Access</div>
             <SidebarItem active=${filters.type === 'image'} onClick=${() => setFilters({ ...filters, starred: false, type: 'image' })} icon=${ImageIcon} label="Media Blocks" />
             <SidebarItem active=${filters.type === 'doc'} onClick=${() => setFilters({ ...filters, starred: false, type: 'doc' })} icon=${FileText} label="Cloud Docs" />
          </nav>
          <div className="mt-auto pt-8 border-t border-slate-100 flex items-center space-x-4 p-4 bg-slate-50 rounded-[32px]">
             <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-black text-sm border-2 border-white shadow-md">
                ${user.email ? user.email[0].toUpperCase() : '?'}
             </div>
             <div className="flex-1 min-w-0">
                <p className="text-xs font-black truncate text-slate-900 leading-tight">${user.email ? user.email.split('@')[0] : 'Unknown Node'}</p>
                <div className="flex items-center text-[9px] font-bold text-emerald-500 uppercase tracking-tight">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2 animate-pulse"></span> Verified Link
                </div>
             </div>
             <button onClick=${() => supabase.auth.signOut()} className="text-slate-300 hover:text-red-500 transition-colors"><${LogOut} size=${18} /></button>
          </div>
        </div>
      </aside>

      <!-- Main Hub -->
      <main className="flex-1 flex flex-col overflow-hidden bg-[#fafafa]">
        <header className="px-10 py-8 bg-white/50 backdrop-blur-xl border-b border-slate-100 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center space-x-6 flex-1 max-w-3xl">
            <button onClick=${() => setIsSidebarOpen(!isSidebarOpen)} className="p-2.5 hover:bg-slate-100 rounded-2xl text-slate-400 transition-all active:scale-90">
              <${isSidebarOpen ? ChevronLeft : ChevronRight} size=${22} />
            </button>
            <div className="relative w-full group">
              <${Search} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size=${20} />
              <input type="text" placeholder="Search S3 federated records..." className="w-full pl-14 pr-6 py-4 bg-slate-50 rounded-3xl outline-none focus:bg-white focus:ring-4 ring-indigo-50 transition-all text-sm font-bold border border-transparent focus:border-indigo-100" value=${filters.search} onChange=${e => setFilters({ ...filters, search: e.target.value })} />
            </div>
          </div>
          <label className="flex items-center space-x-3 bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-4 rounded-3xl cursor-pointer font-black transition-all shadow-2xl shadow-indigo-100 active:scale-95 group ml-8">
            <${Plus} size=${20} className="group-hover:rotate-90 transition-transform duration-500" />
            <span className="text-sm">Commit Data</span>
            <input type="file" multiple className="hidden" onChange=${handleUpload} />
          </label>
        </header>

        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
          ${uploading && html`
            <div className="mb-10 flex items-center space-x-5 bg-indigo-600 p-6 rounded-[36px] shadow-2xl animate-in slide-in-from-top duration-700">
              <${Loader2} className="animate-spin text-white" size=${24} />
              <div className="text-white"><p className="text-xs font-black uppercase tracking-widest">Writing S3 Binary</p><p className="text-[10px] opacity-70">Neural Analysis in background...</p></div>
            </div>
          `}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-10">
            ${filtered.map(f => html`
              <div key=${f.id} onClick=${() => setSelectedFile(f)} className="group bg-white p-6 rounded-[48px] border border-slate-100 hover:border-indigo-100 hover:shadow-2xl transition-all duration-700 cursor-pointer relative flex flex-col">
                <div className="aspect-[4/3] bg-slate-50 rounded-[40px] mb-6 flex items-center justify-center overflow-hidden border border-slate-50 relative">
                   <${FileIcon} filename=${f.name} className="fiv-viv-lg opacity-30 group-hover:scale-110 transition-transform duration-700" />
                   <div className="absolute inset-0 flex items-center justify-center bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <${ExternalLink} size=${32} className="text-white drop-shadow-md" />
                   </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-slate-900 truncate text-sm mb-2">${f.name || 'Untitled Node'}</h3>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">${(f.size / 1024).toFixed(0)} KB</p>
                    <span className="bg-slate-50 px-2 py-0.5 rounded-lg text-[9px] font-black text-slate-500 uppercase">${f.mime_type ? f.mime_type.split('/')[1] : 'binary'}</span>
                  </div>
                </div>
                <div className="absolute top-5 right-5 flex space-x-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                  <button onClick=${e => { e.stopPropagation(); toggleStar(f.id, f.starred); }} className=${`p-3 rounded-2xl shadow-xl transition-all ${f.starred ? 'bg-amber-400 text-white' : 'bg-white text-slate-400 hover:text-amber-500'}`}><${Star} size=${18} fill=${f.starred ? "currentColor" : "none"} /></button>
                  <button onClick=${e => { e.stopPropagation(); deleteFile(f, e); }} className="p-3 bg-white rounded-2xl shadow-xl text-slate-400 hover:text-red-600 transition-all"><${Trash2} size=${18} /></button>
                </div>
              </div>
            `)}
          </div>
          ${filtered.length === 0 && !uploading && html`
            <div className="h-full flex flex-col items-center justify-center text-slate-200 py-32">
              <${HardDrive} size=${84} strokeWidth=${1} className="opacity-10 mb-8" />
              <p className="text-2xl font-black text-slate-300 uppercase tracking-widest">Zero Cloud Objects</p>
            </div>
          `}
        </div>
      </main>

      <!-- Details Layer -->
      ${selectedFile && html`
        <div className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-black/60 backdrop-blur-3xl animate-in fade-in duration-500">
          <div className="bg-white rounded-[64px] w-full max-w-7xl h-full max-h-[90vh] flex flex-col md:flex-row overflow-hidden shadow-2xl">
            <div className="flex-1 bg-slate-50 flex flex-col items-center justify-center relative p-20">
              <button onClick=${() => setSelectedFile(null)} className="absolute top-12 left-12 p-6 bg-white rounded-[24px] shadow-2xl hover:bg-slate-50 active:scale-90 transition-all z-20"><${X} size=${24} /></button>
              <div className="text-center">
                 <div className="w-56 h-56 bg-white rounded-[56px] flex items-center justify-center shadow-2xl mx-auto mb-12"><${FileIcon} filename=${selectedFile.name} className="fiv-viv-lg scale-150" /></div>
                 <p className="text-4xl font-black text-slate-900 mb-4">${selectedFile.name || 'Untitled Node'}</p>
                 <p className="text-xs text-slate-400 font-bold tracking-widest uppercase">Federated UUID: ${selectedFile.id ? selectedFile.id.substring(0, 8) : 'unknown'}</p>
              </div>
            </div>
            
            <div className="w-full md:w-[540px] p-20 flex flex-col bg-white overflow-y-auto custom-scrollbar border-l border-slate-100">
              <div className="mb-14 flex flex-col space-y-8">
                <div>
                   <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] block mb-4">Neural Analysis</span>
                   <h2 className="text-4xl font-black text-slate-900 break-words leading-tight mb-6">${selectedFile.name || 'Untitled Node'}</h2>
                   <div className="flex space-x-3">
                      <button onClick=${() => renameFile(selectedFile.id, selectedFile.name)} className="flex items-center space-x-2 bg-slate-50 px-5 py-2 rounded-2xl text-[10px] font-black uppercase border border-slate-100 text-slate-500 hover:bg-slate-100"><${Edit3} size=${12} /><span>Rename Node</span></button>
                      <span className="bg-amber-50 text-amber-600 px-5 py-2 rounded-2xl text-[10px] font-black uppercase border border-amber-100">${((selectedFile.size || 0) / (1024*1024)).toFixed(2)} MB</span>
                   </div>
                </div>
                
                <section>
                  <div className="flex items-center space-x-4 mb-6">
                    <div className="bg-indigo-600 p-3 rounded-2xl shadow-xl shadow-indigo-100"><${ArrowUpRight} className="text-white" size=${20} /></div>
                    <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">Gemini Insights</span>
                  </div>
                  <div className="bg-gradient-to-br from-indigo-50/50 to-white p-10 rounded-[48px] text-sm leading-relaxed text-indigo-900 border border-indigo-100 shadow-inner">
                    ${selectedFile.analysis || html`Generating node report...`}
                  </div>
                </section>

                <section>
                  <div className="flex items-center space-x-4 mb-6">
                    <div className="bg-slate-900 p-3 rounded-2xl shadow-xl shadow-slate-200"><${StickyNote} className="text-white" size=${20} /></div>
                    <span className="text-xs font-black text-slate-900 uppercase tracking-widest">Federated Context</span>
                  </div>
                  <div className="bg-slate-50 p-8 rounded-[40px] text-[10px] font-mono text-slate-400 border border-slate-100 space-y-2">
                    <p>MIME: ${selectedFile.mime_type || 'unknown'}</p>
                    <p>PATH: ${selectedFile.storage_path || 'unknown'}</p>
                    <p>OWNER: ${selectedFile.user_id || 'unknown'}</p>
                  </div>
                </section>
              </div>

              <div className="mt-auto flex space-x-5">
                <button onClick=${() => getSignedDownload(selectedFile.storage_path)} className="flex-1 bg-slate-900 text-white py-8 rounded-[36px] font-black flex items-center justify-center space-x-4 shadow-2xl active:scale-95 transition-all group">
                  <${Download} size=${24} className="group-hover:translate-y-1 transition-transform" /> <span>Retrieve Node</span>
                </button>
                <button onClick=${e => deleteFile(selectedFile, e)} className="p-8 bg-red-50 text-red-500 rounded-[36px] hover:bg-red-500 hover:text-white transition-all shadow-sm"><${Trash2} size=${28} /></button>
              </div>
            </div>
          </div>
        </div>
      `}
    </div>
  `;
};

const SidebarItem = ({ active, onClick, icon: Icon, label }) => html`
  <button onClick=${onClick} className=${`w-full flex items-center space-x-4 p-4 rounded-[28px] transition-all group ${active ? 'bg-indigo-50 text-indigo-700 font-black' : 'text-slate-400 hover:bg-slate-50'}`}>
    <${Icon} size=${22} className=${active ? 'text-indigo-600' : 'group-hover:text-indigo-400'} /> 
    <span className="text-sm tracking-tight">${label}</span>
  </button>
`;

export default App;
