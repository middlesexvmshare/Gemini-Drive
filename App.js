
import React, { useState, useEffect, useMemo } from 'react';
import { html } from 'htm/react';
import * as Lucide from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { analyzeFile } from './services/gemini.js';

const { 
  Plus, Search, LayoutGrid, FileText, Image: ImageIcon, File, 
  Star, Trash2, X, Download, AlertCircle, HardDrive, StickyNote, 
  LogOut, User, Mail, Lock, Loader2, Folder, ChevronRight, ChevronLeft, ArrowUpRight, CheckCircle2,
  Clock, Filter
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
          setError("Verification email sent! Please check your inbox to activate your cloud hub.");
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
          <p className="text-slate-400 font-semibold mt-2 text-sm uppercase tracking-widest">Neural Cloud Infrastructure</p>
        </div>

        ${error && html`
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-3xl text-xs font-bold border border-red-100 flex items-center animate-in fade-in slide-in-from-top-2">
            <${AlertCircle} size=${16} className="mr-3 flex-shrink-0" />
            <span>${error}</span>
          </div>
        `}

        <form onSubmit=${handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-4">Access Key (Email)</label>
            <input type="email" placeholder="name@company.com" className="w-full p-5 bg-slate-50 rounded-3xl outline-none focus:ring-4 ring-indigo-50 font-bold transition-all border border-transparent focus:border-indigo-100" value=${email} onChange=${e => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-4">Secret (Password)</label>
            <input type="password" placeholder="••••••••" className="w-full p-5 bg-slate-50 rounded-3xl outline-none focus:ring-4 ring-indigo-50 font-bold transition-all border border-transparent focus:border-indigo-100" value=${password} onChange=${e => setPassword(e.target.value)} required />
          </div>
          <button type="submit" disabled=${loading} className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-black shadow-xl hover:bg-indigo-700 active:scale-95 transition-all mt-4 flex items-center justify-center space-x-2">
            ${loading ? html`<${Loader2} className="animate-spin" />` : html`<span>${isLogin ? 'Initialize Session' : 'Create Neural Node'}</span>`}
          </button>
        </form>

        <p className="text-center mt-10 text-xs text-slate-400 font-bold uppercase tracking-widest">
          ${isLogin ? "New user?" : "Existing node?"}
          <button onClick=${() => setIsLogin(!isLogin)} className="ml-2 text-indigo-600 font-black hover:underline underline-offset-4">${isLogin ? 'Request Access' : 'Authenticate'}</button>
        </p>
      </div>
    </div>
  `;
};

const SidebarItem = ({ active, onClick, icon: Icon, label, count }) => html`
  <button onClick=${onClick} className=${`w-full flex items-center justify-between p-4 rounded-[24px] transition-all group ${active ? 'bg-indigo-50 text-indigo-700 font-black shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}>
    <div className="flex items-center space-x-4">
      <${Icon} size=${20} className=${active ? 'text-indigo-600' : 'group-hover:text-indigo-400 transition-colors'} /> 
      <span className="text-sm tracking-tight">${label}</span>
    </div>
    ${count !== undefined && html`<span className=${`text-[10px] px-2 py-0.5 rounded-lg ${active ? 'bg-indigo-200 text-indigo-800' : 'bg-slate-100 text-slate-400'}`}>${count}</span>`}
  </button>
`;

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
        // Run AI Analysis immediately on upload
        const analysis = await analyzeFile(f.name, fileDataUrl, f.type);
        
        const { data, error } = await supabase.from('user_files').insert([{
          user_id: user.id,
          name: f.name,
          type: type,
          size: f.size,
          analysis: analysis,
          notes: '',
          starred: false,
          file_url: fileDataUrl // In a production app, we would use Supabase Storage. Storing as DataURL for demo.
        }]).select();

        if (!error && data) {
          setFiles(prev => [data[0], ...prev]);
        } else if (error) {
          console.error("Upload error:", error);
        }
      };
      reader.readAsDataURL(f);
    }
    setUploading(false);
    e.target.value = '';
  };

  const removeFile = async (id, e) => {
    e.stopPropagation();
    if (!confirm("Permanently destroy this neural data?")) return;
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
    if (!error) {
      setFiles(prev => prev.map(f => f.id === id ? { ...f, starred: !f.starred } : f));
      if (selectedFile?.id === id) setSelectedFile({ ...selectedFile, starred: !selectedFile.starred });
    }
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

  // Statistics for sidebar counts
  const stats = useMemo(() => {
    return {
      all: files.length,
      images: files.filter(f => f.type === 'image').length,
      docs: files.filter(f => f.type === 'text' || f.type === 'pdf').length,
      starred: files.filter(f => f.starred).length
    };
  }, [files]);

  if (loading) return html`<div className="h-screen flex items-center justify-center bg-slate-50"><${Loader2} className="animate-spin text-indigo-600" size=${48} /></div>`;
  if (!user) return html`<${AuthForm} onAuth=${setUser} />`;

  return html`
    <div className="flex h-screen bg-white text-slate-900 overflow-hidden font-inter selection:bg-indigo-100 selection:text-indigo-900">
      <!-- Sidebar -->
      <aside className=${`bg-white border-r border-slate-100 transition-all duration-500 ease-in-out flex flex-col ${isSidebarOpen ? 'w-80' : 'w-0 overflow-hidden'}`}>
        <div className="p-10 flex flex-col h-full min-w-[320px]">
          <div className="flex items-center space-x-4 mb-14">
            <div className="bg-indigo-600 p-3 rounded-[20px] shadow-2xl shadow-indigo-100 rotate-6"><${Folder} className="text-white" size=${24} /></div>
            <span className="text-2xl font-black text-slate-900 tracking-tighter">Gemini Drive</span>
          </div>

          <nav className="flex-1 space-y-2 overflow-y-auto custom-scrollbar pr-2">
             <div className="pb-4 px-4 text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Isolated Hub</div>
             <${SidebarItem} active=${!filters.starred && filters.type === 'all'} onClick=${() => setFilters({ ...filters, starred: false, type: 'all' })} icon=${LayoutGrid} label="Main Drive" count=${stats.all} />
             <${SidebarItem} active=${filters.starred} onClick=${() => setFilters({ ...filters, starred: true, type: 'all' })} icon=${Star} label="Favorites" count=${stats.starred} />
             
             <div className="pt-10 pb-4 px-4 text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Categories</div>
             <${SidebarItem} active=${filters.type === 'image'} onClick=${() => setFilters({ ...filters, starred: false, type: 'image' })} icon=${ImageIcon} label="Visual Assets" count=${stats.images} />
             <${SidebarItem} active=${filters.type === 'text'} onClick=${() => setFilters({ ...filters, starred: false, type: 'text' })} icon=${FileText} label="Documents" count=${stats.docs} />
             
             <div className="pt-10 pb-4 px-4 text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Intelligence</div>
             <button className="w-full flex items-center space-x-4 p-4 rounded-[24px] text-slate-400 hover:bg-slate-50 transition-all">
               <${CheckCircle2} size=${20} />
               <span className="text-sm tracking-tight">AI Insights List</span>
             </button>
          </nav>

          <div className="mt-auto pt-10 border-t border-slate-100">
            <div className="flex items-center space-x-4 p-5 bg-slate-50 rounded-[32px] group">
              <div className="w-12 h-12 rounded-[18px] bg-indigo-100 flex items-center justify-center text-indigo-700 font-black text-lg border-2 border-white shadow-xl">
                ${(user.email)[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black truncate text-slate-900 leading-tight">${user.email.split('@')[0]}</p>
                <div className="flex items-center text-[10px] font-bold text-emerald-500 uppercase tracking-tight">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2 animate-pulse"></span> Encrypted Sync
                </div>
              </div>
              <button onClick=${() => supabase.auth.signOut()} className="text-slate-300 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-xl"><${LogOut} size=${20} /></button>
            </div>
          </div>
        </div>
      </aside>

      <!-- Main Hub -->
      <main className="flex-1 flex flex-col overflow-hidden bg-[#fafafa]">
        <header className="px-10 py-8 border-b border-slate-100 bg-white/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center space-x-8 flex-1 max-w-3xl">
            <button onClick=${() => setIsSidebarOpen(!isSidebarOpen)} className="p-3 hover:bg-slate-100 rounded-[18px] text-slate-400 transition-all active:scale-90 shadow-sm border border-slate-50 bg-white">
              <${isSidebarOpen ? ChevronLeft : ChevronRight} size=${22} />
            </button>
            <div className="relative w-full group">
              <${Search} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size=${20} />
              <input type="text" placeholder="Search isolated records or neural analysis..." className="w-full pl-14 pr-6 py-4 bg-slate-50 rounded-[22px] outline-none focus:bg-white focus:ring-4 ring-indigo-50/50 transition-all text-sm font-bold border border-transparent focus:border-indigo-100" value=${filters.search} onChange=${e => setFilters({ ...filters, search: e.target.value })} />
            </div>
          </div>

          <div className="flex items-center space-x-4 ml-10">
            <label className="flex items-center space-x-3 bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-4 rounded-[22px] cursor-pointer font-black transition-all shadow-2xl shadow-indigo-100 active:scale-95 group">
              <${Plus} size=${20} className="group-hover:rotate-90 transition-transform duration-500" />
              <span className="text-sm tracking-tight uppercase">Sync File</span>
              <input type="file" multiple className="hidden" onChange=${handleUpload} />
            </label>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
          ${uploading && html`
            <div className="mb-12 flex items-center space-x-5 bg-indigo-600 p-6 rounded-[32px] shadow-2xl animate-in slide-in-from-top duration-700">
              <div className="bg-white/20 p-2 rounded-xl"><${Loader2} className="animate-spin text-white" size=${24} /></div>
              <div>
                <span className="text-white text-sm font-black uppercase tracking-[0.2em] block">Indexing Neural Data</span>
                <span className="text-indigo-200 text-[10px] font-bold uppercase">Gemini is parsing metadata...</span>
              </div>
            </div>
          `}

          <div className="mb-10 flex items-center justify-between">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center">
              ${filters.starred ? 'Starred Units' : filters.type === 'all' ? 'Your Drive' : `${filters.type.charAt(0).toUpperCase() + filters.type.slice(1)} Assets`}
              <span className="ml-4 text-xs bg-slate-100 text-slate-400 px-3 py-1 rounded-full font-bold uppercase tracking-widest">${filtered.length} Items</span>
            </h2>
            <div className="flex items-center space-x-2 text-slate-400">
               <${Filter} size=${16} />
               <span className="text-[10px] font-black uppercase tracking-widest">Auto Filtered</span>
            </div>
          </div>

          ${filtered.length === 0 ? html`
            <div className="h-full flex flex-col items-center justify-center text-slate-200 py-32 animate-in fade-in duration-1000">
              <div className="relative mb-8">
                <${HardDrive} size=${100} strokeWidth=${1} className="opacity-10" />
                <div className="absolute inset-0 flex items-center justify-center">
                   <${Search} size=${32} className="opacity-20 animate-pulse" />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-300 uppercase tracking-[0.3em]">No Records Found</p>
              <p className="text-slate-400 text-sm mt-4 font-bold">Try adjusting your filters or upload a new node.</p>
            </div>
          ` : html`
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8">
              ${filtered.map(f => html`
                <div key=${f.id} onClick=${() => setSelectedFile(f)} className="group bg-white p-6 rounded-[44px] border border-slate-100 hover:border-indigo-100 hover:shadow-2xl transition-all duration-500 cursor-pointer relative flex flex-col animate-in fade-in slide-in-from-bottom-4">
                  <div className="aspect-[4/3] bg-slate-50 rounded-[32px] mb-6 flex items-center justify-center overflow-hidden border border-slate-50 relative">
                    ${f.type === 'image' ? html`<img src=${f.file_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />` : html`<${FileIcon} filename=${f.name} className="fiv-viv-lg opacity-40 group-hover:scale-110 transition-transform duration-700" />`}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors"></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-slate-900 truncate text-sm mb-2 tracking-tight">${f.name}</h3>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">${(f.size / 1024).toFixed(0)} KB • ${new Date(f.created_at).toLocaleDateString()}</p>
                      <span className="bg-slate-50 px-3 py-1 rounded-xl text-[9px] font-black text-slate-400 uppercase tracking-widest border border-slate-100">${f.type}</span>
                    </div>
                    ${f.analysis && html`
                      <div className="mt-4 pt-4 border-t border-slate-50 flex items-start space-x-2">
                        <${ArrowUpRight} size=${12} className="text-indigo-400 mt-0.5 flex-shrink-0" />
                        <p className="text-[11px] text-slate-400 font-medium line-clamp-2 italic">${f.analysis}</p>
                      </div>
                    `}
                  </div>
                  <div className="absolute top-5 right-5 flex space-x-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                    <button onClick=${e => toggleStar(f.id, e)} className=${`p-3 rounded-[18px] shadow-2xl transition-all ${f.starred ? 'bg-amber-400 text-white' : 'bg-white text-slate-400 hover:text-amber-500 hover:scale-110'}`}><${Star} size=${18} fill=${f.starred ? "currentColor" : "none"} /></button>
                    <button onClick=${e => removeFile(f.id, e)} className="p-3 bg-white rounded-[18px] shadow-2xl text-slate-400 hover:text-red-600 transition-all hover:scale-110"><${Trash2} size=${18} /></button>
                  </div>
                </div>
              `)}
            </div>
          `}
        </div>
      </main>

      <!-- Details Overlay -->
      ${selectedFile && html`
        <div className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-slate-900/60 backdrop-blur-2xl animate-in fade-in duration-500">
          <div className="bg-white rounded-[64px] w-full max-w-7xl h-full max-h-[90vh] flex flex-col md:flex-row overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500">
            <div className="flex-1 bg-slate-50 flex items-center justify-center relative p-16 overflow-hidden">
              <button onClick=${() => setSelectedFile(null)} className="absolute top-12 left-12 p-6 bg-white rounded-[24px] shadow-2xl hover:bg-slate-50 active:scale-90 transition-all z-20"><${X} size=${24} /></button>
              ${selectedFile.type === 'image' ? html`<img src=${selectedFile.file_url} className="max-h-full max-w-full object-contain rounded-[48px] shadow-2xl" />` : html`
                <div className="text-center">
                   <div className="w-64 h-64 bg-white rounded-[56px] flex items-center justify-center shadow-2xl mx-auto mb-12 border-2 border-indigo-50"><${FileIcon} filename=${selectedFile.name} className="fiv-viv-lg scale-150" /></div>
                   <p className="text-4xl font-black text-slate-900 mb-4 tracking-tighter">${selectedFile.name}</p>
                   <p className="text-xs text-slate-400 uppercase tracking-[0.4em] font-black">Supabase Isolated Unit</p>
                </div>
              `}
            </div>
            
            <div className="w-full md:w-[540px] p-16 flex flex-col bg-white overflow-y-auto custom-scrollbar border-l border-slate-100">
              <div className="mb-14">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.4em]">Neural Analysis</span>
                  <button onClick=${e => toggleStar(selectedFile.id, e)} className=${`p-4 rounded-2xl transition-all ${selectedFile.starred ? 'bg-amber-400 text-white' : 'bg-slate-50 text-slate-300'}`}>
                    <${Star} size=${20} fill=${selectedFile.starred ? "currentColor" : "none"} />
                  </button>
                </div>
                <h2 className="text-5xl font-black text-slate-900 break-words leading-tight mb-8 tracking-tighter">${selectedFile.name}</h2>
                <div className="flex flex-wrap gap-3">
                   <span className="bg-indigo-50 text-indigo-600 px-6 py-2 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border border-indigo-100 flex items-center"><${FileText} size=${12} className="mr-2" /> ${selectedFile.type}</span>
                   <span className="bg-amber-50 text-amber-600 px-6 py-2 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border border-amber-100 flex items-center"><${HardDrive} size=${12} className="mr-2" /> ${(selectedFile.size / (1024*1024)).toFixed(2)} MB</span>
                   <span className="bg-slate-50 text-slate-500 px-6 py-2 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border border-slate-100 flex items-center"><${Clock} size=${12} className="mr-2" /> ${new Date(selectedFile.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              
              <div className="flex-1 space-y-16">
                <section>
                  <div className="flex items-center space-x-4 mb-8">
                    <div className="bg-indigo-600 p-3 rounded-[18px] shadow-xl shadow-indigo-100 rotate-6"><${ArrowUpRight} className="text-white" size=${20} /></div>
                    <span className="text-xs font-black text-indigo-600 uppercase tracking-[0.3em]">Gemini AI Intelligence</span>
                  </div>
                  <div className="bg-gradient-to-br from-indigo-50/50 to-white p-10 rounded-[48px] text-base leading-relaxed text-indigo-900 border border-indigo-100 shadow-inner group relative">
                    ${selectedFile.analysis ? html`<span>${selectedFile.analysis}</span>` : html`<div className="flex items-center space-x-3"><${Loader2} className="animate-spin" size=${16} /> <span>Gemini is thinking...</span></div>`}
                  </div>
                </section>

                <section>
                  <div className="flex items-center space-x-4 mb-8">
                    <div className="bg-slate-900 p-3 rounded-[18px] shadow-xl shadow-slate-200 -rotate-3"><${StickyNote} className="text-white" size=${20} /></div>
                    <span className="text-xs font-black text-slate-900 uppercase tracking-[0.3em]">Isolated Unit Meta</span>
                  </div>
                  <div className="bg-slate-50 p-10 rounded-[48px] text-[10px] font-mono text-slate-400 border border-slate-100 break-all space-y-2">
                    <p>UUID: ${selectedFile.id}</p>
                    <p>OWNER: ${selectedFile.user_id}</p>
                    <p>SOURCE: SECURE_SYNC_GATE</p>
                  </div>
                </section>
              </div>

              <div className="mt-20 flex space-x-5">
                <button onClick=${() => { const a = document.createElement('a'); a.href = selectedFile.file_url; a.download = selectedFile.name; a.click(); }} className="flex-1 bg-slate-900 text-white py-7 rounded-[32px] font-black flex items-center justify-center space-x-4 shadow-2xl active:scale-95 transition-all group">
                  <${Download} size=${24} className="group-hover:translate-y-1 transition-transform" /> <span>Retrieve Node</span>
                </button>
                <button onClick=${e => removeFile(selectedFile.id, e)} className="p-7 bg-red-50 text-red-500 rounded-[32px] hover:bg-red-500 hover:text-white transition-all shadow-sm hover:shadow-xl"><${Trash2} size=${28} /></button>
              </div>
            </div>
          </div>
        </div>
      `}
    </div>
  `;
};

export default App;
