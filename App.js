
import React, { useState, useEffect, useMemo } from 'react';
import { html } from 'htm/react';
import * as Lucide from 'lucide-react';
import { analyzeFile } from './services/gemini.js';
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
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc 
} from "firebase/firestore";

const { 
  Plus, Search, LayoutGrid, FileText, Image: ImageIcon, File, 
  Star, Trash2, X, Download, AlertCircle, HardDrive, StickyNote, 
  LogOut, User, Mail, Lock, Loader2, Folder, ChevronRight, ChevronLeft, Edit3, ArrowUpRight, Settings, ShieldAlert, Sparkles
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
const db = getFirestore(appInstance);

// --- IndexedDB Configuration ---
const DB_NAME = 'GeminiDriveStorage';
const STORE_NAME = 'files';

const initDB = () => new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: 'id' });
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const saveToDB = async (file) => {
  const database = await initDB();
  const tx = database.transaction(STORE_NAME, 'readwrite');
  const { previewUrl, ...toSave } = file;
  return new Promise(r => { tx.objectStore(STORE_NAME).put(toSave).onsuccess = r; });
};

const deleteFromDB = async (id) => {
  const database = await initDB();
  const tx = database.transaction(STORE_NAME, 'readwrite');
  return new Promise(r => { tx.objectStore(STORE_NAME).delete(id).onsuccess = r; });
};

const getAllFromDB = async () => {
  const database = await initDB();
  const tx = database.transaction(STORE_NAME, 'readonly');
  return new Promise(r => { tx.objectStore(STORE_NAME).getAll().onsuccess = (e) => r(e.target.result); });
};

const syncUserWithFirestore = async (user, displayName = '') => {
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) {
    const newUser = { uid: user.uid, name: displayName || user.displayName || user.email.split('@')[0], email: user.email, photoURL: user.photoURL || '', createdAt: Date.now() };
    await setDoc(userRef, newUser);
    return newUser;
  }
  return userSnap.data();
};

const FileIcon = ({ filename, className = "" }) => {
  const ext = filename.split('.').pop()?.toLowerCase() || 'unknown';
  return html`<span className="fiv-viv fiv-icon-${ext} ${className}"></span>`;
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
        const userData = await syncUserWithFirestore(res.user);
        onAuth({ ...res.user, ...userData });
      } else {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        const userData = await syncUserWithFirestore(res.user, name);
        onAuth({ ...res.user, ...userData });
      }
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    setLoading(true);
    setError(null);
    const provider = new GoogleAuthProvider();
    try {
      const res = await signInWithPopup(auth, provider);
      const userData = await syncUserWithFirestore(res.user);
      onAuth({ ...res.user, ...userData });
    } catch (err) { setLoading(false); setError(err.message); }
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
            <span>${error}</span>
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
  const [saving, setSaving] = useState(false);

  const handleUpdate = async () => {
    setSaving(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { name });
      onUpdate({ ...user, name });
      onClose();
    } catch (e) { alert(e.message); } finally { setSaving(false); }
  };

  return html`
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-8 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white rounded-[48px] w-full max-w-lg p-12 shadow-2xl border border-white">
        <div className="flex justify-between items-center mb-10">
          <h2 className="text-3xl font-black text-slate-900">Account</h2>
          <button onClick=${onClose} className="p-3 hover:bg-slate-100 rounded-2xl transition-all"><${X} size=${24} /></button>
        </div>
        <div className="space-y-8 text-center">
          <div className="relative inline-block">
            <div className="w-28 h-28 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-3xl border-4 border-white shadow-2xl overflow-hidden mx-auto">
              ${user.photoURL ? html`<img src=${user.photoURL} className="w-full h-full object-cover" />` : user.name?.[0].toUpperCase()}
            </div>
          </div>
          <div className="space-y-4">
            <div className="text-left space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
              <input type="text" className="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:ring-4 ring-indigo-50 font-bold" value=${name} onChange=${e => setName(e.target.value)} />
            </div>
            <div className="text-left space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
              <div className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-slate-400 cursor-not-allowed">${user.email}</div>
            </div>
          </div>
          <div className="flex flex-col space-y-4 pt-6">
            <button onClick=${handleUpdate} disabled=${saving} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-indigo-700 active:scale-95 transition-all">
              ${saving ? html`<${Loader2} className="animate-spin mx-auto" />` : 'Save Preferences'}
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

const App = () => {
  const [user, setUser] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [filters, setFilters] = useState({ search: '', type: 'all', starred: false });
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
        const userData = await syncUserWithFirestore(u);
        setUser({ ...u, ...userData });
        getAllFromDB().then(data => {
          setFiles(data.map(f => ({ ...f, previewUrl: URL.createObjectURL(f.data) })));
        });
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
      const id = crypto.randomUUID();
      const newFile = { id, name: f.name, type, size: f.size, date: Date.now(), data: f, starred: false, analysis: '', notes: '', ownerUid: user.uid };
      await saveToDB(newFile);
      setFiles(prev => [{ ...newFile, previewUrl: URL.createObjectURL(f) }, ...prev]);
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const res = await analyzeFile(f.name, ev.target.result, f.type);
        const updated = { ...newFile, analysis: res };
        await saveToDB(updated);
        setFiles(prev => prev.map(file => file.id === id ? { ...file, analysis: res } : file));
      };
      reader.readAsDataURL(f);
    }
    setUploading(false);
    e.target.value = '';
  };

  const removeFile = async (id, e) => {
    e.stopPropagation();
    if (!confirm("Remove this object permanently?")) return;
    await deleteFromDB(id);
    setFiles(prev => prev.filter(f => f.id !== id));
    if (selectedFile?.id === id) setSelectedFile(null);
  };

  const toggleStar = async (id, e) => {
    e.stopPropagation();
    const file = files.find(f => f.id === id);
    if (!file) return;
    const updated = { ...file, starred: !file.starred };
    await saveToDB(updated);
    setFiles(prev => prev.map(f => f.id === id ? updated : f));
    if (selectedFile?.id === id) setSelectedFile(updated);
  };

  const handleDeleteAccount = async () => {
    if (!confirm("Are you absolutely sure? This will purge all your cloud data permanently.")) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await deleteDoc(userRef);
      await deleteUser(auth.currentUser);
      setUser(null);
      setShowProfile(false);
    } catch (e) { alert("Security timeout. Please sign in again to delete account."); signOut(auth); }
  };

  const filtered = useMemo(() => {
    return files.filter(f => {
      const matchesSearch = f.name.toLowerCase().includes(filters.search.toLowerCase()) || 
                            (f.analysis && f.analysis.toLowerCase().includes(filters.search.toLowerCase()));
      const matchesStar = !filters.starred || f.starred;
      const matchesType = filters.type === 'all' || f.type === filters.type;
      return matchesSearch && matchesStar && matchesType;
    });
  }, [files, filters]);

  if (loading) return html`<div className="h-screen flex items-center justify-center bg-[#f8fafc]"><${Loader2} className="animate-spin text-indigo-600" size=${48} /></div>`;
  if (!user) return html`<${AuthForm} onAuth=${setUser} />`;

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
             <button onClick=${() => setFilters({ ...filters, starred: false, type: 'image' })} className=${`w-full flex items-center space-x-3 p-4 rounded-2xl transition-all ${filters.type === 'image' ? 'bg-indigo-50 text-indigo-700 font-black shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}><${ImageIcon} size=${20} /> <span className="text-sm">Photos</span></button>
             <button onClick=${() => setFilters({ ...filters, starred: false, type: 'text' })} className=${`w-full flex items-center space-x-3 p-4 rounded-2xl transition-all ${filters.type === 'text' ? 'bg-indigo-50 text-indigo-700 font-black shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}><${FileText} size=${20} /> <span className="text-sm">Documents</span></button>
          </nav>

          <div className="mt-auto space-y-6">
            <!-- Storage Space Loader -->
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
                ${usedPercentage > 85 && html`
                  <p className="mt-3 text-[9px] font-black text-rose-500 uppercase tracking-widest flex items-center">
                    <${AlertCircle} size=${10} className="mr-1" /> Space almost full
                  </p>
                `}
              </div>
              <div className="absolute top-[-20px] right-[-20px] w-24 h-24 bg-indigo-50/50 rounded-full blur-3xl group-hover:bg-indigo-100/50 transition-colors"></div>
            </div>

            <div className="flex items-center space-x-3 p-4 bg-slate-900 rounded-3xl group cursor-pointer hover:bg-slate-800 transition-all shadow-xl shadow-slate-200" onClick=${() => setShowProfile(true)}>
              <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-white font-black text-sm overflow-hidden border border-white/5">
                ${user.photoURL ? html`<img src=${user.photoURL} className="w-full h-full object-cover" />` : user.name?.[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black truncate text-white uppercase tracking-tighter">${user.name || 'Cloud User'}</p>
                <p className="text-[9px] font-bold text-slate-400 truncate tracking-widest uppercase">Manage Account</p>
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
              <input type="text" placeholder="Search through your cloud intelligence..." className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-transparent focus:border-indigo-100 focus:bg-white rounded-3xl outline-none transition-all text-sm font-semibold shadow-inner" value=${filters.search} onChange=${e => setFilters({ ...filters, search: e.target.value })} />
            </div>
          </div>

          <div className="flex items-center space-x-6">
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
              <div className="relative">
                <${Loader2} className="animate-spin text-indigo-400" size=${24} />
                <${Sparkles} className="absolute -top-1 -right-1 text-white animate-pulse" size=${10} />
              </div>
              <span className="text-white text-xs font-black uppercase tracking-[0.25em]">Gemini is processing multimodal data...</span>
            </div>
          `}

          ${filtered.length === 0 ? html`
            <div className="h-full flex flex-col items-center justify-center text-slate-100 py-32 animate-in fade-in duration-1000">
              <div className="relative">
                 <${HardDrive} size=${100} strokeWidth=${1} className="opacity-10 mb-8 text-indigo-900" />
                 <div className="absolute inset-0 bg-indigo-50/20 blur-3xl rounded-full"></div>
              </div>
              <p className="text-2xl font-black text-slate-300 uppercase tracking-[0.4em]">Cloud Clear</p>
              <p className="text-xs font-bold text-slate-400 mt-4 uppercase tracking-widest">Your smart storage is empty</p>
            </div>
          ` : html`
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-10">
              ${filtered.map(f => html`
                <div key=${f.id} onClick=${() => setSelectedFile(f)} className="group bg-white p-6 rounded-[48px] border border-slate-100 hover:border-indigo-100 hover:shadow-2xl hover:shadow-indigo-500/5 transition-all duration-500 cursor-pointer relative flex flex-col">
                  <div className="aspect-[1/1] bg-slate-50 rounded-[40px] mb-6 flex items-center justify-center overflow-hidden border border-slate-50/50 relative">
                    ${f.type === 'image' ? html`<img src=${f.previewUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />` : html`<${FileIcon} filename=${f.name} className="fiv-viv-lg opacity-40 group-hover:scale-110 transition-transform duration-500" />`}
                    <div className="absolute inset-0 bg-indigo-900/0 group-hover:bg-indigo-900/5 transition-colors duration-500"></div>
                  </div>
                  <div className="flex-1 min-w-0 px-2">
                    <h3 className="font-black text-slate-800 truncate text-sm mb-2">${f.name}</h3>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">${(f.size / 1024).toFixed(0)} KB • ${new Date(f.date).toLocaleDateString()}</p>
                      <span className="bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-lg text-[9px] font-black text-slate-500 uppercase">${f.type}</span>
                    </div>
                  </div>
                  <div className="absolute top-6 right-6 flex space-x-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                    <button onClick=${e => toggleStar(f.id, e)} className=${`p-3 rounded-2xl shadow-xl transition-all active:scale-90 ${f.starred ? 'bg-amber-400 text-white' : 'bg-white text-slate-400 hover:text-amber-500 border border-slate-100'}`}><${Star} size=${18} fill=${f.starred ? "currentColor" : "none"} /></button>
                    <button onClick=${e => removeFile(f.id, e)} className="p-3 bg-white border border-slate-100 rounded-2xl shadow-xl text-slate-400 hover:text-rose-500 transition-all active:scale-90"><${Trash2} size=${18} /></button>
                  </div>
                </div>
              `)}
            </div>
          `}
        </div>
      </main>

      <!-- Profile Modal -->
      ${showProfile && html`<${ProfileModal} user=${user} onClose=${() => setShowProfile(false)} onUpdate=${setUser} onDelete=${handleDeleteAccount} />`}

      <!-- File Details Modal -->
      ${selectedFile && html`
        <div className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-slate-900/60 backdrop-blur-2xl animate-in fade-in duration-500">
          <div className="bg-white rounded-[64px] w-full max-w-7xl h-full max-h-[90vh] flex flex-col md:flex-row overflow-hidden shadow-2xl border border-white/20">
            <div className="flex-1 bg-slate-50/50 flex items-center justify-center relative p-20 overflow-hidden border-r border-slate-100">
              <button onClick=${() => setSelectedFile(null)} className="absolute top-12 left-12 p-5 bg-white rounded-[24px] shadow-xl hover:bg-slate-50 active:scale-90 transition-all border border-slate-100"><${X} size=${24} /></button>
              ${selectedFile.type === 'image' ? html`<img src=${selectedFile.previewUrl} className="max-h-full max-w-full object-contain rounded-[48px] shadow-2xl border-8 border-white" />` : html`
                <div className="text-center">
                   <div className="w-56 h-56 bg-white rounded-[48px] flex items-center justify-center shadow-2xl mx-auto mb-12 border border-slate-100"><${FileIcon} filename=${selectedFile.name} className="fiv-viv-lg scale-150" /></div>
                   <p className="text-4xl font-black text-slate-900 mb-4 tracking-tight">${selectedFile.name}</p>
                   <p className="text-xs text-slate-400 uppercase tracking-[0.3em] font-black">Multimodal Preview Restricted</p>
                </div>
              `}
            </div>
            
            <div className="w-full md:w-[500px] p-20 flex flex-col bg-white overflow-y-auto custom-scrollbar">
              <div className="mb-14">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-[11px] font-black text-indigo-500 uppercase tracking-[0.4em] block">Intelligence Metadata</span>
                  <button onClick=${e => toggleStar(selectedFile.id, e)} className=${`transition-all ${selectedFile.starred ? 'text-amber-500' : 'text-slate-200 hover:text-amber-500'}`}><${Star} size=${24} fill=${selectedFile.starred ? "currentColor" : "none"} /></button>
                </div>
                <h2 className="text-5xl font-black text-slate-900 break-words leading-[1.1] mb-6 tracking-tight">${selectedFile.name}</h2>
                <div className="flex space-x-3">
                   <span className="bg-indigo-50 text-indigo-600 px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-indigo-100">${selectedFile.type}</span>
                   <span className="bg-fuchsia-50 text-fuchsia-600 px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-fuchsia-100">${(selectedFile.size / (1024*1024)).toFixed(2)} MB</span>
                </div>
              </div>
              
              <div className="flex-1 space-y-16">
                <section>
                  <div className="flex items-center space-x-3 mb-8">
                    <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-100"><${ArrowUpRight} className="text-white" size=${18} strokeWidth=${3} /></div>
                    <span className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.3em]">Gemini 3 Flash Insights</span>
                  </div>
                  <div className="bg-gradient-to-br from-indigo-50/50 to-white p-10 rounded-[48px] text-sm leading-relaxed text-indigo-900 border border-indigo-100/50 shadow-inner relative overflow-hidden group">
                    <div className="relative z-10">
                      ${selectedFile.analysis || html`<div className="flex items-center space-x-3 text-slate-400 font-bold"><${Loader2} className="animate-spin" size=${18} /> <span>Thinking...</span></div>`}
                    </div>
                    <div className="absolute bottom-[-20px] right-[-20px] opacity-10"><${Sparkles} size=${64} /></div>
                  </div>
                </section>

                <section>
                  <div className="flex items-center space-x-3 mb-8">
                    <div className="bg-slate-900 p-2.5 rounded-2xl shadow-lg shadow-slate-200"><${StickyNote} className="text-white" size=${18} strokeWidth=${2.5} /></div>
                    <span className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em]">User Annotation</span>
                  </div>
                  <div className="bg-slate-50 p-10 rounded-[48px] text-sm italic text-slate-400 border border-slate-100 font-medium">
                    No custom annotations added to this object.
                  </div>
                </section>
              </div>

              <div className="mt-20 flex space-x-5">
                <button onClick=${() => { const a = document.createElement('a'); a.href = selectedFile.previewUrl; a.download = selectedFile.name; a.click(); }} className="flex-1 bg-slate-900 text-white py-6 rounded-[32px] font-black flex items-center justify-center space-x-4 shadow-2xl active:scale-[0.98] transition-all hover:bg-slate-800">
                  <${Download} size=${22} strokeWidth=${2.5} /> <span>Export Data</span>
                </button>
                <button onClick=${e => removeFile(selectedFile.id, e)} className="p-6 bg-rose-50 text-rose-500 rounded-[32px] hover:bg-rose-500 hover:text-white transition-all shadow-lg active:scale-[0.98]"><${Trash2} size=${28} /></button>
              </div>
            </div>
          </div>
        </div>
      `}
    </div>
  `;
};

export default App;
