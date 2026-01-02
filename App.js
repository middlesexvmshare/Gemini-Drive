
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { html } from 'htm/react';
import * as Lucide from 'lucide-react';
import { analyzeFile } from './services/gemini.js';
import { 
  syncUserWithSupabase, 
  updateSupabaseUser, 
  deleteSupabaseUser,
  uploadFileToStorage,
  deleteFileFromStorage,
  getFilePublicUrl,
  upsertFileMetadata,
  fetchUserFilesMetadata,
  deleteFileMetadata
} from './services/supabase.js';
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  deleteUser
} from "firebase/auth";

const { 
  Plus, Search, LayoutGrid, List, FileText, Image: LucideImage, File, 
  Star, Trash2, X, Download, AlertCircle, HardDrive, StickyNote, 
  LogOut, User, Mail, Lock, Loader2, Folder, ChevronRight, ChevronLeft, Edit3, ArrowUpRight, Settings, ShieldAlert, Sparkles, Camera
} = Lucide;

// --- Firebase Initialization ---
const firebaseConfig = {
  apiKey: "AIzaSyBQTFvWTBi6Z-SgScC6lxn_EzZ_xvOKYHQ",
  authDomain: "gemini-drive-4f55e.firebaseapp.com",
  projectId: "gemini-drive-4f55e",
  storageBucket: "gemini-drive-4f55e.firebasestorage.app",
  messagingSenderId: "1366551750",
  appId: "1:1366551750:web:974339f31fc2f5967a7bc7"
};

const appInstance = initializeApp(firebaseConfig);
const auth = getAuth(appInstance);

const FileIcon = ({ filename, className = "" }) => {
  const ext = String(filename || '').split('.').pop()?.toLowerCase() || 'unknown';
  return html`<span className=${`fiv-viv fiv-icon-${ext} ${className}`}></span>`;
};

const AuthForm = ({ onAuth }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isLogin) {
        const res = await signInWithEmailAndPassword(auth, email, password);
        const userData = await syncUserWithSupabase(res.user);
        onAuth({ ...res.user, ...userData });
      } else {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        const userData = await syncUserWithSupabase(res.user, name);
        onAuth({ ...res.user, ...userData });
      }
    } catch (err) { setError(err.message || 'Authentication failed'); } finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    setLoading(true);
    setError(null);
    const provider = new GoogleAuthProvider();
    try {
      const res = await signInWithPopup(auth, provider);
      const userData = await syncUserWithSupabase(res.user);
      onAuth({ ...res.user, ...userData });
    } catch (err) { setLoading(false); setError(err.message || 'Google sign-in failed'); }
  };

  return html`
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-200 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-200 rounded-full blur-[120px]"></div>
      </div>
      <div className="bg-white/80 backdrop-blur-xl p-10 sm:p-14 rounded-[48px] shadow-2xl w-full max-w-md border border-white animate-in fade-in zoom-in duration-700 relative z-10">
        <div className="text-center mb-10">
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-indigo-200 rotate-6 group hover:rotate-0 transition-transform duration-500">
            <${Folder} className="text-white" size=${40} strokeWidth=${2.5} />
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Gemini Drive</h1>
          <p className="text-slate-500 font-semibold mt-2">Intelligence in Every Bit</p>
        </div>

        ${error && html`
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl text-xs font-bold border border-red-100 flex items-center">
            <${AlertCircle} size=${16} className="mr-3 flex-shrink-0" /> 
            <span>${String(error)}</span>
          </div>
        `}

        <form onSubmit=${handleSubmit} className="space-y-4">
          ${!isLogin && html`
            <div className="relative">
              <${User} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size=${18} />
              <input type="text" placeholder="Full Name" className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-transparent focus:border-indigo-100 focus:bg-white rounded-2xl outline-none transition-all font-semibold" value=${name} onChange=${e => setName(e.target.value)} required />
            </div>
          `}
          <div className="relative">
            <${Mail} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size=${18} />
            <input type="email" placeholder="Email Address" className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-transparent focus:border-indigo-100 focus:bg-white rounded-2xl outline-none transition-all font-semibold" value=${email} onChange=${e => setEmail(e.target.value)} required />
          </div>
          <div className="relative">
            <${Lock} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size=${18} />
            <input type="password" placeholder="Password" className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-transparent focus:border-indigo-100 focus:bg-white rounded-2xl outline-none transition-all font-semibold" value=${password} onChange=${e => setPassword(e.target.value)} required />
          </div>
          <button type="submit" disabled=${loading} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black shadow-xl hover:bg-slate-800 active:scale-[0.98] transition-all flex items-center justify-center">
            ${loading ? html`<${Loader2} className="animate-spin" size=${24} />` : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <div className="my-8 flex items-center space-x-4"><div className="flex-1 h-px bg-slate-100"></div><span className="text-[10px] font-black text-slate-300 tracking-[0.2em]">OR</span><div className="flex-1 h-px bg-slate-100"></div></div>

        <button onClick=${handleGoogle} className="w-full bg-white border border-slate-200 py-4 rounded-2xl font-bold flex items-center justify-center space-x-3 hover:bg-slate-50 active:scale-[0.98] transition-all shadow-sm">
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/action/google.svg" width="20" />
          <span className="text-slate-700">Continue with Google</span>
        </button>

        <p className="text-center mt-10 text-sm text-slate-500 font-bold">
          ${isLogin ? "Need an account?" : "Already have one?"}
          <button onClick=${() => setIsLogin(!isLogin)} className="ml-2 text-indigo-600 font-black hover:underline underline-offset-4">${isLogin ? 'Join Now' : 'Log In'}</button>
        </p>
      </div>
    </div>
  `;
};

const ProfileModal = ({ user, onClose, onUpdate, onDelete }) => {
  const [name, setName] = useState(user.name || '');
  const [photoUrl, setPhotoUrl] = useState(user.photo_url || '');
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef(null);

  const handleUpdate = async () => {
    setSaving(true);
    try {
      const updated = await updateSupabaseUser(user.uid, { 
        name, 
        photo_url: photoUrl 
      });
      onUpdate({ ...user, ...updated });
      onClose();
    } catch (e) { alert(e.message || 'Update failed'); } finally { setSaving(false); }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingPhoto(true);
    try {
      // Use profile_avatar as a fixed ID for the user's main profile picture
      await uploadFileToStorage(user.uid, 'profile_avatar', file);
      const publicUrl = getFilePublicUrl(user.uid, 'profile_avatar');
      
      // Update local state temporarily, the final save happens with handleUpdate
      setPhotoUrl(publicUrl);
    } catch (err) {
      alert("Photo upload failed: " + err.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  return html`
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-8 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white rounded-[48px] w-full max-w-lg p-12 shadow-2xl border border-white max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="flex justify-between items-center mb-10">
          <h2 className="text-3xl font-black text-slate-900">Account</h2>
          <button onClick=${onClose} className="p-3 hover:bg-slate-100 rounded-2xl transition-all"><${X} size=${24} /></button>
        </div>
        <div className="space-y-8 text-center">
          <div className="relative inline-block group cursor-pointer" onClick=${() => fileInputRef.current?.click()}>
            <div className="w-28 h-28 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-3xl border-4 border-white shadow-2xl overflow-hidden mx-auto transition-transform group-hover:scale-105">
              ${uploadingPhoto ? html`<${Loader2} className="animate-spin" size=${32} />` : 
                (photoUrl ? html`<img src=${photoUrl} className="w-full h-full object-cover" />` : (String(name || '?')[0].toUpperCase()))}
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <${Camera} className="text-white" size=${24} />
              </div>
            </div>
            <input type="file" ref=${fileInputRef} className="hidden" accept="image/*" onChange=${handlePhotoUpload} />
            <div className="absolute -bottom-1 -right-1 bg-white p-2 rounded-full shadow-lg border border-slate-100 text-indigo-600">
              <${Plus} size=${14} strokeWidth=${3} />
            </div>
          </div>
          <div className="space-y-4">
            <div className="text-left space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
              <input type="text" className="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:ring-4 ring-indigo-50 font-bold" value=${name} onChange=${e => setName(e.target.value)} />
            </div>
            <div className="text-left space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
              <div className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-slate-400 cursor-not-allowed border border-slate-100">${String(user.email || '')}</div>
            </div>
          </div>
          <div className="flex flex-col space-y-4 pt-6">
            <button onClick=${handleUpdate} disabled=${saving || uploadingPhoto} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50">
              ${saving ? html`<${Loader2} className="animate-spin mx-auto" />` : 'Update Profile'}
            </button>
            <button onClick=${onDelete} className="w-full bg-red-50 text-red-500 py-4 rounded-2xl font-black hover:bg-red-100 transition-all flex items-center justify-center space-x-2">
              <${ShieldAlert} size=${18} />
              <span>Delete Cloud Data</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
};

const FileDetailsModal = ({ file, user, onClose, onStar, onDelete, onUpdateFiles }) => {
  const [localNotes, setLocalNotes] = useState(file.notes || '');
  const [isSaving, setIsSaving] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    setLocalNotes(file.notes || '');
  }, [file.id]);

  const handleNotesChange = (e) => {
    const val = e.target.value;
    setLocalNotes(val);
    
    if (debounceRef.current) clearTimeout(debounceRef.current);
    
    setIsSaving(true);
    debounceRef.current = setTimeout(async () => {
      try {
        await upsertFileMetadata(user.uid, file.id, { 
          name: String(file.name),
          type: String(file.type),
          size: Number(file.size),
          notes: String(val) 
        });
        onUpdateFiles(file.id, { notes: String(val) });
      } catch (err) {
        console.error("Auto-save notes failed", err);
      } finally {
        setIsSaving(false);
      }
    }, 1000);
  };

  const handleExport = async () => {
    try {
      const response = await fetch(file.previewUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', file.name);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert("Export failed: " + e.message);
    }
  };

  return html`
    <div className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-slate-900/60 backdrop-blur-2xl animate-in fade-in duration-500">
      <div className="bg-white rounded-[64px] w-full max-w-7xl h-full max-h-[90vh] flex flex-col md:flex-row overflow-hidden shadow-2xl border border-white/20">
        <div className="flex-1 bg-slate-50/50 flex items-center justify-center relative p-20 overflow-hidden border-r border-slate-100">
          <button onClick=${onClose} className="absolute top-12 left-12 p-5 bg-white rounded-[24px] shadow-xl hover:bg-slate-50 active:scale-90 transition-all border border-slate-100"><${X} size=${24} /></button>
          ${file.type === 'image' ? html`<img src=${file.previewUrl} className="max-h-full max-w-full object-contain rounded-[48px] shadow-2xl border-8 border-white" />` : html`
            <div className="text-center">
               <div className="w-56 h-56 bg-white rounded-[48px] flex items-center justify-center shadow-2xl mx-auto mb-12 border border-slate-100"><${FileIcon} filename=${file.name} className="fiv-viv-lg scale-150" /></div>
               <p className="text-4xl font-black text-slate-900 mb-4 tracking-tight">${String(file.name)}</p>
            </div>
          `}
        </div>
        
        <div className="w-full md:w-[500px] p-20 flex flex-col bg-white overflow-y-auto custom-scrollbar">
          <div className="mb-14">
            <div className="flex items-center justify-between mb-6">
              <span className="text-[11px] font-black text-indigo-500 uppercase tracking-[0.4em] block">Cloud Intelligence</span>
              <button onClick=${e => onStar(file.id, e)} className=${`transition-all ${file.starred ? 'text-amber-500' : 'text-slate-200 hover:text-amber-500'}`}><${Star} size=${20} fill=${file.starred ? "currentColor" : "none"} /></button>
            </div>
            <h2 className="text-5xl font-black text-slate-900 break-words leading-[1.1] mb-6 tracking-tight">${String(file.name)}</h2>
            <div className="flex space-x-3">
               <span className="bg-indigo-50 text-indigo-600 px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-indigo-100">${String(file.type)}</span>
               <span className="bg-fuchsia-50 text-fuchsia-600 px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-fuchsia-100">${(file.size / (1024*1024)).toFixed(2)} MB</span>
            </div>
          </div>
          
          <div className="flex-1 space-y-16">
            <section>
              <div className="flex items-center space-x-3 mb-8">
                <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-100"><${ArrowUpRight} className="text-white" size=${18} strokeWidth=${3} /></div>
                <span className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.3em]">AI Summary</span>
              </div>
              <div className="bg-gradient-to-br from-indigo-50/50 to-white p-10 rounded-[48px] text-sm leading-relaxed text-indigo-900 border border-indigo-100/50 shadow-inner">
                ${file.analysis ? String(file.analysis) : html`<div className="flex items-center space-x-3 text-slate-400 font-bold"><${Loader2} className="animate-spin" size=${18} /> <span>Thinking...</span></div>`}
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-3">
                  <div className="bg-slate-900 p-2.5 rounded-2xl shadow-lg shadow-slate-200"><${StickyNote} className="text-white" size=${18} strokeWidth=${2.5} /></div>
                  <span className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em]">Annotations</span>
                </div>
                ${isSaving && html`<span className="text-[10px] font-black text-indigo-500 uppercase animate-pulse">Saving...</span>`}
              </div>
              <textarea 
                className="w-full bg-slate-50 p-10 rounded-[48px] text-sm text-slate-600 border border-slate-100 font-medium resize-none focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                placeholder="Add notes..."
                value=${localNotes}
                rows=${4}
                onChange=${handleNotesChange}
              />
            </section>
          </div>

          <div className="mt-20 flex space-x-5">
            <button onClick=${handleExport} className="flex-1 bg-slate-900 text-white py-6 rounded-[32px] font-black flex items-center justify-center space-x-4 shadow-2xl active:scale-[0.98] transition-all">
              <${Download} size=${22} strokeWidth=${2.5} /> <span>Export</span>
            </button>
            <button onClick=${e => onDelete(file.id, e)} className="p-6 bg-rose-50 text-rose-500 rounded-[32px] hover:bg-rose-500 hover:text-white transition-all shadow-lg active:scale-[0.98]"><${Trash2} size=${22} /></button>
          </div>
        </div>
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
  const [viewMode, setViewMode] = useState('grid');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showProfile, setShowProfile] = useState(false);

  const TOTAL_CAPACITY_GB = 5.0;
  const usedSpaceBytes = useMemo(() => files.reduce((acc, f) => acc + (f.size || 0), 0), [files]);
  const usedSpaceGB = (usedSpaceBytes / (1024 * 1024 * 1024)).toFixed(2);
  const usedPercentage = Math.min(100, (usedSpaceBytes / (TOTAL_CAPACITY_GB * 1024 * 1024 * 1024)) * 100);

  useEffect(() => {
    return onAuthStateChanged(auth, async u => {
      if (u) {
        try {
          const userData = await syncUserWithSupabase(u);
          setUser({ ...u, ...userData });
          const dbFiles = await fetchUserFilesMetadata(u.uid);
          const processedFiles = dbFiles.map(f => ({
            id: f.file_uuid,
            name: String(f.name || 'Untitled'),
            type: String(f.type || 'other'),
            size: Number(f.size || 0),
            date: f.created_at,
            starred: Boolean(f.starred),
            analysis: String(f.analysis || ''),
            notes: String(f.notes || ''),
            previewUrl: getFilePublicUrl(u.uid, f.file_uuid)
          }));
          setFiles(processedFiles);
        } catch (e) {
          console.error("Supabase init error:", e);
          setUser(u);
        }
      } else { setUser(null); }
      setLoading(false);
    });
  }, []);

  const handleUpload = async (e) => {
    const list = Array.from(e.target.files || []);
    if (!list.length) return;
    setUploading(true);
    for (const f of list) {
      const type = f.type.startsWith('image/') ? 'image' : (f.type.includes('pdf') || f.type.startsWith('text/') ? 'text' : 'other');
      const fileId = crypto.randomUUID();
      
      try {
        await uploadFileToStorage(user.uid, fileId, f);
        const publicUrl = getFilePublicUrl(user.uid, fileId);
        const metadata = {
          name: String(f.name),
          type: String(type),
          size: Number(f.size),
          notes: '',
          analysis: 'Analysis pending...',
          starred: false
        };
        await upsertFileMetadata(user.uid, fileId, metadata);

        const newFileObj = { ...metadata, id: fileId, date: new Date().toISOString(), previewUrl: publicUrl };
        setFiles(prev => [newFileObj, ...prev]);

        const reader = new FileReader();
        reader.onload = async (ev) => {
          const analysisResult = await analyzeFile(f.name, ev.target.result, f.type);
          const analysisStr = String(analysisResult || 'Analysis complete.');
          await upsertFileMetadata(user.uid, fileId, { 
            name: String(f.name),
            type: String(type),
            size: Number(f.size),
            analysis: analysisStr 
          });
          setFiles(prev => prev.map(item => item.id === fileId ? { ...item, analysis: analysisStr } : item));
        };
        reader.readAsDataURL(f);

      } catch (err) {
        console.error("Upload error:", err);
        alert("Upload failed: " + (err.message || 'Unknown error'));
      }
    }
    setUploading(false);
    e.target.value = '';
  };

  const removeFile = async (id, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!confirm("Permanently delete this cloud file?")) return;
    try {
      await deleteFileFromStorage(user.uid, id);
      await deleteFileMetadata(id);
      setFiles(prev => prev.filter(f => f.id !== id));
      if (selectedFile?.id === id) setSelectedFile(null);
    } catch (err) {
      alert("Delete failed: " + (err.message || 'Unknown error'));
    }
  };

  const toggleStar = async (id, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const file = files.find(f => f.id === id);
    if (!file) return;
    const newStarred = !file.starred;
    try {
      await upsertFileMetadata(user.uid, id, { 
        name: String(file.name),
        type: String(file.type),
        size: Number(file.size),
        starred: newStarred 
      });
      setFiles(prev => prev.map(f => f.id === id ? { ...f, starred: newStarred } : f));
      if (selectedFile?.id === id) setSelectedFile({ ...selectedFile, starred: newStarred });
    } catch (err) {
      alert("Update failed: " + (err.message || 'Unknown error'));
    }
  };

  const onUpdateFiles = (id, updates) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
    if (selectedFile?.id === id) setSelectedFile(prev => ({ ...prev, ...updates }));
  };

  const handleDeleteAccount = async () => {
    if (!confirm("Are you absolutely sure? This will purge all your cloud data permanently.")) return;
    try {
      await deleteSupabaseUser(user.uid);
      await deleteUser(auth.currentUser);
      setUser(null);
      setShowProfile(false);
    } catch (e) { alert("Security restriction: Please sign in again to delete account."); signOut(auth); }
  };

  const filtered = useMemo(() => {
    return files.filter(f => {
      const name = String(f.name || '').toLowerCase();
      const analysis = String(f.analysis || '').toLowerCase();
      const search = String(filters.search || '').toLowerCase();
      const matchesSearch = name.includes(search) || analysis.includes(search);
      const matchesStar = !filters.starred || f.starred;
      const matchesType = filters.type === 'all' || f.type === filters.type;
      return matchesSearch && matchesStar && matchesType;
    });
  }, [files, filters]);

  if (loading) return html`<div className="h-screen flex items-center justify-center bg-[#f8fafc]"><${Loader2} className="animate-spin text-indigo-600" size=${48} /></div>`;
  if (!user) return html`<${AuthForm} onAuth=${setUser} />`;

  const UserAvatar = () => {
    if (user.photo_url) return html`<img src=${user.photo_url} className="w-full h-full object-cover" />`;
    return html`<span>${String(user.name || 'C')[0].toUpperCase()}</span>`;
  };

  return html`
    <div className="flex h-screen bg-white text-slate-900 overflow-hidden font-['Inter']">
      <!-- Sidebar -->
      <aside className=${`bg-white border-r border-slate-100 transition-all duration-300 flex flex-col z-30 ${isSidebarOpen ? 'w-72' : 'w-0 overflow-hidden'}`}>
        <div className="p-8 flex flex-col h-full min-w-[288px]">
          <div className="flex items-center space-x-4 mb-12">
            <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-xl shadow-indigo-100 rotate-3"><${Folder} className="text-white" size=${24} strokeWidth=${2.5} /></div>
            <span className="text-2xl font-black text-slate-900 tracking-tight">Gemini Drive</span>
          </div>

          <nav className="flex-1 space-y-1">
             <button onClick=${() => setFilters({ ...filters, starred: false, type: 'all' })} className=${`w-full flex items-center space-x-3 p-4 rounded-2xl transition-all ${!filters.starred && filters.type === 'all' ? 'bg-indigo-50 text-indigo-700 font-black shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}><${LayoutGrid} size=${20} /> <span className="text-sm">All Files</span></button>
             <button onClick=${() => setFilters({ ...filters, starred: true })} className=${`w-full flex items-center space-x-3 p-4 rounded-2xl transition-all ${filters.starred ? 'bg-indigo-50 text-indigo-700 font-black shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}><${Star} size=${20} /> <span className="text-sm">Favorites</span></button>
             <div className="pt-8 pb-3 px-4 text-[10px] font-black text-slate-300 uppercase tracking-[0.25em]">Cloud Category</div>
             <button onClick=${() => setFilters({ ...filters, starred: false, type: 'image' })} className=${`w-full flex items-center space-x-3 p-4 rounded-2xl transition-all ${filters.type === 'image' ? 'bg-indigo-50 text-indigo-700 font-black shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}><${LucideImage} size=${20} /> <span className="text-sm">Photos</span></button>
             <button onClick=${() => setFilters({ ...filters, starred: false, type: 'text' })} className=${`w-full flex items-center space-x-3 p-4 rounded-2xl transition-all ${filters.type === 'text' ? 'bg-indigo-50 text-indigo-700 font-black shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}><${FileText} size=${20} /> <span className="text-sm">Documents</span></button>
          </nav>

          <div className="mt-auto space-y-6">
            <div className="bg-gradient-to-br from-slate-50 to-white p-6 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden group">
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                   <div className="flex items-center space-x-2 text-indigo-600">
                     <${HardDrive} size=${16} strokeWidth=${2.5} />
                     <span className="text-[10px] font-black uppercase tracking-widest">Storage</span>
                   </div>
                   <span className="text-[10px] font-black text-slate-400">${usedPercentage.toFixed(0)}%</span>
                </div>
                <div className="flex items-baseline space-x-1 mb-4">
                  <span className="text-xl font-black text-slate-900">${usedSpaceGB}</span>
                  <span className="text-xs font-bold text-slate-400 tracking-tight">GB of ${TOTAL_CAPACITY_GB} GB</span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden shadow-inner p-[1px]">
                  <div 
                    className=${`h-full rounded-full transition-all duration-1000 ease-out shadow-sm ${usedPercentage > 90 ? 'bg-gradient-to-r from-red-500 to-rose-600 animate-pulse' : 'bg-gradient-to-r from-indigo-500 via-indigo-600 to-fuchsia-500'}`} 
                    style=${{ width: `${usedPercentage}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-4 bg-slate-900 rounded-3xl group cursor-pointer hover:bg-slate-800 transition-all shadow-xl shadow-slate-200" onClick=${() => setShowProfile(true)}>
              <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-white font-black text-sm overflow-hidden border border-white/5">
                <${UserAvatar} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black truncate text-white uppercase tracking-tighter">${String(user.name || 'Cloud User')}</p>
                <p className="text-[9px] font-bold text-slate-400 truncate tracking-widest uppercase">Account</p>
              </div>
              <button onClick=${(e) => { e.stopPropagation(); signOut(auth); }} className="text-slate-500 hover:text-rose-400 transition-colors"><${LogOut} size=${18} /></button>
            </div>
          </div>
        </div>
      </aside>

      <!-- Main Content -->
      <main className="flex-1 flex flex-col overflow-hidden bg-[#fafafa]">
        <header className="px-10 py-8 border-b border-slate-100 bg-white/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center space-x-8 flex-1 max-w-2xl">
            <button onClick=${() => setIsSidebarOpen(!isSidebarOpen)} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl text-slate-400 transition-all active:scale-90 shadow-sm border border-slate-100">
              <${isSidebarOpen ? ChevronLeft : ChevronRight} size=${22} />
            </button>
            <div className="relative w-full group">
              <${Search} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size=${20} />
              <input type="text" placeholder="Search history..." className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-transparent focus:border-indigo-100 focus:bg-white rounded-3xl outline-none transition-all text-sm font-semibold shadow-inner" value=${filters.search} onChange=${e => setFilters({ ...filters, search: e.target.value })} />
            </div>
          </div>

          <div className="flex items-center space-x-6">
            <div className="flex items-center bg-slate-50 p-1.5 rounded-2xl border border-slate-100 shadow-inner">
              <button onClick=${() => setViewMode('grid')} className=${`p-2.5 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><${LayoutGrid} size=${20} /></button>
              <button onClick=${() => setViewMode('list')} className=${`p-2.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><${List} size=${20} /></button>
            </div>
            <label className="flex items-center space-x-3 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-3xl cursor-pointer font-black transition-all shadow-2xl shadow-indigo-200 active:scale-95 group">
              <${Plus} size=${22} strokeWidth=${3} className="group-hover:rotate-90 transition-transform duration-300" />
              <span className="text-sm">Upload</span>
              <input type="file" multiple className="hidden" onChange=${handleUpload} />
            </label>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
          ${uploading && html`
            <div className="mb-12 flex items-center space-x-4 bg-slate-900 p-6 rounded-[32px] shadow-2xl animate-in slide-in-from-top duration-700">
              <${Loader2} className="animate-spin text-indigo-400" size=${24} />
              <span className="text-white text-xs font-black uppercase tracking-[0.25em]">Syncing cloud multimodal data...</span>
            </div>
          `}

          ${filtered.length === 0 ? html`
            <div className="h-full flex flex-col items-center justify-center text-slate-100 py-32 animate-in fade-in duration-1000">
              <${HardDrive} size=${100} strokeWidth=${1} className="opacity-10 mb-8 text-indigo-900" />
              <p className="text-2xl font-black text-slate-300 uppercase tracking-[0.4em]">Empty Space</p>
            </div>
          ` : (viewMode === 'grid' ? html`
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-10">
              ${filtered.map(f => html`
                <div key=${f.id} onClick=${() => setSelectedFile(f)} className="group bg-white p-6 rounded-[48px] border border-slate-100 hover:border-indigo-100 hover:shadow-2xl hover:shadow-indigo-500/5 transition-all duration-500 cursor-pointer relative flex flex-col">
                  <div className="aspect-[1/1] bg-slate-50 rounded-[40px] mb-6 flex items-center justify-center overflow-hidden border border-slate-50/50 relative">
                    ${f.type === 'image' ? html`<img src=${f.previewUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />` : html`<${FileIcon} filename=${f.name} className="fiv-viv-lg opacity-40 group-hover:scale-110 transition-transform duration-500" />`}
                  </div>
                  <div className="flex-1 min-w-0 px-2">
                    <h3 className="font-black text-slate-800 truncate text-sm mb-2">${String(f.name)}</h3>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">${(f.size / 1024).toFixed(0)} KB • ${new Date(f.date).toLocaleDateString()}</p>
                      <span className="bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-lg text-[9px] font-black text-slate-500 uppercase">${String(f.type)}</span>
                    </div>
                  </div>
                  <div className="absolute top-6 right-6 flex space-x-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <button onClick=${e => toggleStar(f.id, e)} className=${`p-2.5 rounded-2xl shadow-xl transition-all active:scale-90 ${f.starred ? 'bg-amber-400 text-white' : 'bg-white text-slate-400 border border-slate-100 hover:text-amber-500'}`}><${Star} size=${15} fill=${f.starred ? "currentColor" : "none"} /></button>
                    <button onClick=${e => removeFile(f.id, e)} className="p-2.5 bg-white border border-slate-100 rounded-2xl shadow-xl text-slate-400 hover:text-rose-500 transition-all active:scale-90"><${Trash2} size=${15} /></button>
                  </div>
                </div>
              `)}
            </div>
          ` : html`
            <div className="bg-white rounded-[48px] border border-slate-100 overflow-hidden shadow-sm animate-in fade-in duration-500">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 border-b border-slate-100">
                  <tr>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Name</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Size</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                    <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  ${filtered.map(f => html`
                    <tr key=${f.id} onClick=${() => setSelectedFile(f)} className="group hover:bg-slate-50/50 transition-all cursor-pointer">
                      <td className="px-8 py-6">
                        <div className="flex items-center space-x-4">
                          <${FileIcon} filename=${f.name} className="fiv-viv-md" />
                          <span className="font-bold text-slate-700 text-sm truncate max-w-xs">${f.name}</span>
                          ${f.starred && html`<${Star} size=${14} className="text-amber-400" fill="currentColor" />`}
                        </div>
                      </td>
                      <td className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-tight">${(f.size / 1024).toFixed(0)} KB</td>
                      <td className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-tight">${new Date(f.date).toLocaleDateString()}</td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-all">
                           <button onClick=${e => toggleStar(f.id, e)} className=${`p-2.5 rounded-xl transition-all ${f.starred ? 'text-amber-500' : 'text-slate-300 hover:text-amber-500'}`}><${Star} size=${16} fill=${f.starred ? "currentColor" : "none"} /></button>
                           <button onClick=${e => removeFile(f.id, e)} className="p-2.5 rounded-xl text-slate-300 hover:text-rose-500 transition-all"><${Trash2} size=${16} /></button>
                        </div>
                      </td>
                    </tr>
                  `)}
                </tbody>
              </table>
            </div>
          `)}
        </div>
      </main>

      <!-- Profile Modal -->
      ${showProfile && html`<${ProfileModal} user=${user} onClose=${() => setShowProfile(false)} onUpdate=${setUser} onDelete=${handleDeleteAccount} />`}

      <!-- File Details Modal -->
      ${selectedFile && html`
        <${FileDetailsModal} 
          file=${selectedFile} 
          user=${user} 
          onClose=${() => setSelectedFile(null)} 
          onStar=${toggleStar} 
          onDelete=${removeFile} 
          onUpdateFiles=${onUpdateFiles} 
        />
      `}
    </div>
  `;
};

export default App;
