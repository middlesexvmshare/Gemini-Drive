import React, { useState, useEffect, useMemo } from 'react';
import { html } from 'htm/react';
import * as Lucide from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { analyzeFile } from './services/gemini.js';

const { 
  Plus, Search, LayoutGrid, FileText, Image: ImageIcon, File, 
  Star, Trash2, X, Download, AlertCircle, HardDrive, StickyNote, 
  LogOut, User, Mail, Lock, Loader2, Folder, ChevronRight, ChevronLeft, ArrowUpRight, CheckCircle2
} = Lucide;

// --- Supabase Client Initialization ---
const SUPABASE_URL = 'https://zhaouflvkajwdspfllew.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoYW91Zmx2a2Fqd2RzcGZsbGV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNTU1NzQsImV4cCI6MjA4MjkzMTU3NH0.nGP_5J6DFRswGGoq8Cq7DCrmldAyl5N6hRYbGnnB0WA';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const FileIcon = ({ filename, className = "" }) => {
  const ext = filename.split('.').pop()?.toLowerCase() || 'unknown';
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
        if (data.user) {
          setError("Verification email sent! Please check your inbox.");
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return html`
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="bg-white p-12 rounded-[56px] shadow-2xl w-full max-w-md border border-slate-100 animate-in zoom-in duration-500">
        <div className="text-center mb-10">
          <div className="bg-indigo-600 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-indigo-100 rotate-3">
            <${Folder} className="text-white" size=${40} />
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Gemini Drive</h1>
          <p className="text-slate-400 font-semibold mt-2">Supabase Cloud Intelligence</p>
        </div>

        ${error && html`
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-3xl text-xs font-bold border border-red-100 flex items-center">
            <${AlertCircle} size=${16} className="mr-3 flex-shrink-0" />
            <span>${error}</span>
          </div>
        `}

        <form onSubmit=${handleSubmit} className="space-y-4">
          <input type="email" placeholder="Email" className="w-full p-5 bg-slate-50 rounded-3xl outline-none focus:ring-4 ring-indigo-50 font-bold transition-all" value=${email} onChange=${e => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password" className="w-full p-5 bg-slate-50 rounded-3xl outline-none focus:ring-4 ring-indigo-50 font-bold transition-all" value=${password} onChange=${e => setPassword(e.target.value)} required />
          <button type="submit" disabled=${loading} className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-black shadow-xl hover:bg-indigo-700 active:scale-95 transition-all">
            ${loading ? html`<${Loader2} className="animate-spin mx-auto" />` : (isLogin ? 'Enter Drive' : 'Initialize Hub')}
          </button>
        </form>

        <p className="text-center mt-10 text-sm text-slate-400 font-semibold">
          ${isLogin ? "No account yet?" : "Existing member?"}
          <button onClick=${() => setIsLogin(!isLogin)} className="ml-2 text-indigo-600 font-black hover:underline underline-offset-4">${isLogin ? 'Sign up' : 'Sign in'}</button>
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
      if (session) {
        setUser(session.user);
        fetchFiles(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser(session.user);
        fetchFiles(session.user.id);
      } else {
        setUser(null);
        setFiles([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchFiles = async (userId) => {
    const { data, error } = await supabase
      .from('user_files')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (!error && data) setFiles(data);
  };

  const handleUpload = async (e) => {
    const list = Array.from(e.target.files || []);
    if (!list.length || !user) return;
    setUploading(true);

    for (const f of list) {
      const type = f.type.startsWith('image/') ? 'image' : (f.type.includes('pdf') || f.type.startsWith('text/') ? 'text' : 'other');
      const reader = new FileReader();
      
      reader.onload = async (ev) => {
        const fileDataUrl = ev.target.result;
        const analysis = await analyzeFile(f.name, fileDataUrl, f.type);
        
        const { data, error } = await supabase.from('user_files').insert([{
          user_id: user.id,
          name: f.name,
          type: type,
          size: f.size,
          analysis: analysis,
          notes: '',
          starred: false,
          file_url: fileDataUrl
        }]).select();

        if (!error && data) setFiles(prev => [data[0], ...prev]);
      };
      reader.readAsDataURL(f);
    }
    setUploading(false);
    e.target.value = '';
  };

  const removeFile = async (id, e) => {
    e.stopPropagation();
    if (!confirm("Remove permanently from your cloud?")) return;
    const { error } = await supabase.from('user_files').delete().eq('id', id);
    if (!error) {
      setFiles(prev => prev.filter(f => f.id !== id));
      if (selectedFile?.id === id) setSelectedFile(null);
    }
  };

  const toggleStar = async (id, e) => {
    e.stopPropagation();
    const file = files.find(f => f.id === id);
    if (!file) return;
    const { error } = await supabase.from('user_files').update({ starred: !file.starred }).eq('id', id);
    if (!error) setFiles(prev => prev.map(f => f.id === id ? { ...f, starred: !f.starred } : f));
  };

  const filtered = useMemo(() => {
    return files.filter(f => {
      const s = filters.search.toLowerCase();
      const matchesSearch = f.name.toLowerCase().includes(s) || (f.analysis && f.analysis.toLowerCase().includes(s));
      const matchesStar = !filters.starred || f.starred;
      const matchesType = filters.type === 'all' || f.type === filters.type;
      return matchesSearch && matchesStar && matchesType;
    });
  }, [files, filters]);

  if (loading) return html`<div className="h-screen flex items-center justify-center"><${Loader2} className="animate-spin text-indigo-600" size=${48} /></div>`;
  if (!user) return html`<${AuthForm} onAuth=${setUser} />`;

  return html`
    <div className="flex h-screen bg-white text-slate-900 overflow-hidden font-inter">
      <!-- Sidebar -->
      <aside className=${`bg-white border-r border-slate-100 transition-all duration-300 flex flex-col ${isSidebarOpen ? 'w-80' : 'w-0 overflow-hidden'}`}>
        <div className="p-10 flex flex-col h-full min-w-[320px]">
          <div className="flex items-center space-x-4 mb-14">
            <div className="bg-indigo-600 p-3 rounded-[20px] shadow-2xl shadow-indigo-100 rotate-3"><${Folder} className="text-white" size=${24} /></div>
            <span className="text-2xl font-black text-slate-900 tracking-tighter">Gemini Drive</span>
          </div>

          <nav className="flex-1 space-y-2">
             <SidebarItem active=${!filters.starred && filters.type === 'all'} onClick=${() => setFilters({ ...filters, starred: false, type: 'all' })} icon=${LayoutGrid} label="Main Hub" />
             <SidebarItem active=${filters.starred} onClick=${() => setFilters({ ...filters, starred: true })} icon=${Star} label="Favorites" />
             <div className="pt-10 pb-4 px-4 text-[11px] font-black text-slate-300 uppercase tracking-[0.3em]">Categories</div>
             <SidebarItem active=${filters.type === 'image'} onClick=${() => setFilters({ ...filters, starred: false, type: 'image' })} icon=${ImageIcon} label="Visuals" />
             <SidebarItem active=${filters.type === 'text'} onClick=${() => setFilters({ ...filters, starred: false, type: 'text' })} icon=${FileText} label="Documents" />
          </nav>

          <div className="mt-auto pt-10 border-t border-slate-100">
            <div className="flex items-center space-x-4 p-5 bg-slate-50 rounded-[32px] group">
              <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-black text-lg border-2 border-white shadow-xl">
                ${(user.email)[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black truncate text-slate-900 leading-tight">${user.email.split('@')[0]}</p>
                <div className="flex items-center text-[10px] font-bold text-emerald-500 uppercase tracking-tight">
                  <${CheckCircle2} size=${10} className="mr-1" /> Cloud Sync
                </div>
              </div>
              <button onClick=${() => supabase.auth.signOut()} className="text-slate-300 hover:text-red-500 transition-colors"><${LogOut} size=${22} /></button>
            </div>
          </div>
        </div>
      </aside>

      <!-- Main Area -->
      <main className="flex-1 flex flex-col overflow-hidden bg-[#fafafa]">
        <header className="px-10 py-8 border-b border-slate-100 bg-white flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center space-x-8 flex-1 max-w-3xl">
            <button onClick=${() => setIsSidebarOpen(!isSidebarOpen)} className="p-3 hover:bg-slate-100 rounded-[20px] text-slate-400 transition-all active:scale-90">
              <${isSidebarOpen ? ChevronLeft : ChevronRight} size=${24} />
            </button>
            <div className="relative w-full group">
              <${Search} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size=${22} />
              <input type="text" placeholder="Search your cloud memories..." className="w-full pl-14 pr-6 py-4 bg-slate-50 rounded-[24px] outline-none focus:bg-white focus:ring-4 ring-indigo-50 transition-all text-sm font-bold border border-transparent focus:border-indigo-100" value=${filters.search} onChange=${e => setFilters({ ...filters, search: e.target.value })} />
            </div>
          </div>

          <div className="flex items-center space-x-4 ml-10">
            <label className="flex items-center space-x-3 bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-4 rounded-[24px] cursor-pointer font-black transition-all shadow-2xl shadow-indigo-100 active:scale-95 group">
              <${Plus} size=${22} className="group-hover:rotate-90 transition-transform duration-300" />
              <span className="text-sm tracking-tight">Upload New</span>
              <input type="file" multiple className="hidden" onChange=${handleUpload} />
            </label>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
          ${uploading && html`
            <div className="mb-12 flex items-center space-x-4 bg-indigo-600 p-6 rounded-[32px] shadow-2xl animate-in slide-in-from-top duration-700">
              <${Loader2} className="animate-spin text-white" size=${24} />
              <span className="text-white text-sm font-black uppercase tracking-[0.2em]">Processing with Gemini AI...</span>
            </div>
          `}

          ${filtered.length === 0 ? html`
            <div className="h-full flex flex-col items-center justify-center text-slate-200 py-32 animate-in fade-in duration-1000">
              <${HardDrive} size=${100} strokeWidth=${1} className="opacity-10 mb-8" />
              <p className="text-2xl font-black text-slate-300 uppercase tracking-[0.3em]">No records found</p>
            </div>
          ` : html`
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-10">
              ${filtered.map(f => html`
                <div key=${f.id} onClick=${() => setSelectedFile(f)} className="group bg-white p-6 rounded-[48px] border border-slate-100 hover:border-indigo-100 hover:shadow-2xl transition-all duration-700 cursor-pointer relative flex flex-col">
                  <div className="aspect-[4/3] bg-slate-50 rounded-[36px] mb-6 flex items-center justify-center overflow-hidden border border-slate-50">
                    ${f.type === 'image' ? html`<img src=${f.file_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />` : html`<${FileIcon} filename=${f.name} className="fiv-viv-lg opacity-40 group-hover:scale-110 transition-transform duration-700" />`}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-slate-900 truncate text-sm mb-2 tracking-tight">${f.name}</h3>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">${(f.size / 1024).toFixed(0)} KB</p>
                      <span className="bg-slate-50 px-3 py-1 rounded-xl text-[9px] font-black text-slate-500 uppercase tracking-widest border border-slate-100">${f.type}</span>
                    </div>
                  </div>
                  <div className="absolute top-5 right-5 flex space-x-2 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-2 group-hover:translate-y-0">
                    <button onClick=${e => toggleStar(f.id, e)} className=${`p-3 rounded-2xl shadow-2xl transition-all ${f.starred ? 'bg-amber-400 text-white' : 'bg-white text-slate-400 hover:text-amber-500'}`}><${Star} size=${18} fill=${f.starred ? "currentColor" : "none"} /></button>
                    <button onClick=${e => removeFile(f.id, e)} className="p-3 bg-white rounded-2xl shadow-2xl text-slate-400 hover:text-red-600 transition-all"><${Trash2} size=${18} /></button>
                  </div>
                </div>
              `)}
            </div>
          `}
        </div>
      </main>

      <!-- Details Overlay -->
      ${selectedFile && html`
        <div className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-black/60 backdrop-blur-3xl animate-in fade-in duration-500">
          <div className="bg-white rounded-[64px] w-full max-w-7xl h-full max-h-[90vh] flex flex-col md:flex-row overflow-hidden shadow-2xl">
            <div className="flex-1 bg-slate-50 flex items-center justify-center relative p-20 overflow-hidden">
              <button onClick=${() => setSelectedFile(null)} className="absolute top-12 left-12 p-6 bg-white rounded-[24px] shadow-2xl hover:bg-slate-50 active:scale-90 transition-all"><${X} size=${24} /></button>
              ${selectedFile.type === 'image' ? html`<img src=${selectedFile.file_url} className="max-h-full max-w-full object-contain rounded-[48px] shadow-2xl" />` : html`
                <div className="text-center">
                   <div className="w-56 h-56 bg-white rounded-[56px] flex items-center justify-center shadow-2xl mx-auto mb-12"><${FileIcon} filename=${selectedFile.name} className="fiv-viv-lg" /></div>
                   <p className="text-4xl font-black text-slate-900 mb-4 tracking-tighter">${selectedFile.name}</p>
                   <p className="text-xs text-slate-400 uppercase tracking-[0.4em] font-black">Supabase Cloud Object</p>
                </div>
              `}
            </div>
            
            <div className="w-full md:w-[520px] p-20 flex flex-col bg-white overflow-y-auto custom-scrollbar border-l border-slate-100">
              <div className="mb-14">
                <span className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.4em] block mb-6">Neural Insights</span>
                <h2 className="text-5xl font-black text-slate-900 break-words leading-tight mb-6 tracking-tighter">${selectedFile.name}</h2>
                <div className="flex space-x-3">
                   <span className="bg-indigo-50 text-indigo-600 px-6 py-2 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border border-indigo-100">${selectedFile.type}</span>
                   <span className="bg-amber-50 text-amber-600 px-6 py-2 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border border-amber-100">${(selectedFile.size / (1024*1024)).toFixed(2)} MB</span>
                </div>
              </div>
              
              <div className="flex-1 space-y-16">
                <section>
                  <div className="flex items-center space-x-4 mb-8">
                    <div className="bg-indigo-600 p-3 rounded-2xl shadow-xl shadow-indigo-100"><${ArrowUpRight} className="text-white" size=${20} /></div>
                    <span className="text-xs font-black text-indigo-600 uppercase tracking-[0.3em]">AI Intelligence Report</span>
                  </div>
                  <div className="bg-gradient-to-br from-indigo-50/50 to-white p-10 rounded-[48px] text-base leading-relaxed text-indigo-900 border border-indigo-100 shadow-inner">
                    ${selectedFile.analysis || html`Analyzing unit...`}
                  </div>
                </section>

                <section>
                  <div className="flex items-center space-x-4 mb-8">
                    <div className="bg-slate-900 p-3 rounded-2xl shadow-xl shadow-slate-200"><${StickyNote} className="text-white" size=${20} /></div>
                    <span className="text-xs font-black text-slate-900 uppercase tracking-[0.3em]">Storage Notes</span>
                  </div>
                  <div className="bg-slate-50 p-10 rounded-[48px] text-xs font-mono text-slate-400 border border-slate-100 overflow-hidden truncate">
                    ID: ${selectedFile.id}
                  </div>
                </section>
              </div>

              <div className="mt-20 flex space-x-5">
                <button onClick=${() => { const a = document.createElement('a'); a.href = selectedFile.file_url; a.download = selectedFile.name; a.click(); }} className="flex-1 bg-slate-900 text-white py-7 rounded-[32px] font-black flex items-center justify-center space-x-4 shadow-2xl active:scale-95 transition-all group">
                  <${Download} size=${24} className="group-hover:translate-y-1 transition-transform" /> <span>Retrieve Node</span>
                </button>
                <button onClick=${e => removeFile(selectedFile.id, e)} className="p-7 bg-red-50 text-red-500 rounded-[32px] hover:bg-red-500 hover:text-white transition-all"><${Trash2} size=${28} /></button>
              </div>
            </div>
          </div>
        </div>
      `}
    </div>
  `;
};

const SidebarItem = ({ active, onClick, icon: Icon, label }) => html`
  <button onClick=${onClick} className=${`w-full flex items-center space-x-4 p-4 rounded-3xl transition-all ${active ? 'bg-indigo-50 text-indigo-700 font-black shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}>
    <${Icon} size=${22} /> 
    <span className="text-sm">${label}</span>
  </button>
`;

export default App;