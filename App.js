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
  LogOut, User, Mail, Lock, Loader2, Folder, ChevronRight, ChevronLeft, Edit3, ArrowUpRight, Settings, ShieldAlert
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

// --- IndexedDB Configuration (Local Storage for Files) ---
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

// --- Helper: Sync User with Firestore ---
const syncUserWithFirestore = async (user, displayName = '') => {
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    const newUser = {
      uid: user.uid,
      name: displayName || user.displayName || user.email.split('@')[0],
      email: user.email,
      photoURL: user.photoURL || '',
      createdAt: Date.now()
    };
    await setDoc(userRef, newUser);
    return newUser;
  }
  return userSnap.data();
};

// --- Sub-components ---

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
    } catch (err) { 
      setError(err.message); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    setError(null);
    const provider = new GoogleAuthProvider();
    try {
      const res = await signInWithPopup(auth, provider);
      const userData = await syncUserWithFirestore(res.user);
      onAuth({ ...res.user, ...userData });
    } catch (err) {
      setLoading(false);
      setError(err.message);
    }
  };

  return html`
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white p-12 rounded-[48px] shadow-2xl w-full max-w-md border border-gray-100 animate-in fade-in zoom-in duration-500">
        <div className="text-center mb-8">
          <div className="bg-indigo-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-indigo-100">
            <${Folder} className="text-white" size=${32} />
          </div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Gemini Drive</h1>
          <p className="text-gray-500 font-medium mt-1">Smart Cloud Intelligence</p>
        </div>

        ${error && html`
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl text-xs font-bold border border-red-100 flex items-center">
            <${AlertCircle} size=${14} className="mr-2 flex-shrink-0" /> 
            <span>${error}</span>
          </div>
        `}

        <form onSubmit=${handleSubmit} className="space-y-4">
          ${!isLogin && html`
            <input type="text" placeholder="Full Name" className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 ring-indigo-100 transition-all font-medium" value=${name} onChange=${e => setName(e.target.value)} required />
          `}
          <input type="email" placeholder="Email" className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 ring-indigo-100 transition-all font-medium" value=${email} onChange=${e => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password" className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 ring-indigo-100 transition-all font-medium" value=${password} onChange=${e => setPassword(e.target.value)} required />
          <button type="submit" disabled=${loading} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-indigo-700 active:scale-95 transition-all">
            ${loading ? html`<${Loader2} className="animate-spin mx-auto" />` : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <div className="my-6 flex items-center space-x-4"><div className="flex-1 h-px bg-gray-100"></div><span className="text-[10px] font-bold text-gray-300">OR</span><div className="flex-1 h-px bg-gray-100"></div></div>

        <button onClick=${handleGoogle} className="w-full bg-white border border-gray-200 py-4 rounded-2xl font-bold flex items-center justify-center space-x-3 hover:bg-gray-50 active:scale-95 transition-all shadow-sm">
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/action/google.svg" width="18" />
          <span>Continue with Google</span>
        </button>

        <p className="text-center mt-8 text-sm text-gray-500 font-medium">
          ${isLogin ? "Need an account?" : "Already have one?"}
          <button onClick=${() => setIsLogin(!isLogin)} className="ml-2 text-indigo-600 font-black hover:underline">${isLogin ? 'Sign up' : 'Sign in'}</button>
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
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  return html`
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-8 bg-black/40 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white rounded-[40px] w-full max-w-lg p-12 shadow-2xl border border-gray-100">
        <div className="flex justify-between items-center mb-10">
          <h2 className="text-2xl font-black text-gray-900">Profile Settings</h2>
          <button onClick=${onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-all"><${X} size=${20} /></button>
        </div>

        <div className="space-y-8">
          <div className="flex flex-col items-center">
            <div className="w-24 h-24 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-black text-2xl mb-4 border-4 border-white shadow-xl overflow-hidden">
              ${user.photoURL ? html`<img src=${user.photoURL} className="w-full h-full object-cover" />` : user.name?.[0].toUpperCase()}
            </div>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">${user.email}</p>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
            <input type="text" className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 ring-indigo-100 font-bold" value=${name} onChange=${e => setName(e.target.value)} />
          </div>

          <div className="flex flex-col space-y-4 pt-4">
            <button onClick=${handleUpdate} disabled=${saving} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-indigo-700 active:scale-95 transition-all">
              ${saving ? html`<${Loader2} className="animate-spin mx-auto" />` : 'Save Changes'}
            </button>
            <button onClick=${onDelete} className="w-full bg-red-50 text-red-500 py-4 rounded-2xl font-black hover:bg-red-100 transition-all flex items-center justify-center space-x-2">
              <${ShieldAlert} size=${18} />
              <span>Delete Account</span>
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

  useEffect(() => {
    return onAuthStateChanged(auth, async u => {
      if (u) {
        const userData = await syncUserWithFirestore(u);
        setUser({ ...u, ...userData });
        getAllFromDB().then(data => {
          setFiles(data.map(f => ({ ...f, previewUrl: URL.createObjectURL(f.data) })));
        });
      } else {
        setUser(null);
      }
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
      const withPreview = { ...newFile, previewUrl: URL.createObjectURL(f) };
      setFiles(prev => [withPreview, ...prev]);

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
    if (!confirm("Delete permanently?")) return;
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
  };

  const handleDeleteAccount = async () => {
    if (!confirm("Are you absolutely sure? This will delete your profile and sign you out permanently.")) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await deleteDoc(userRef);
      await deleteUser(auth.currentUser);
      setUser(null);
      setShowProfile(false);
    } catch (e) {
      alert("Error: Please re-authenticate to delete your account for security reasons.");
      signOut(auth);
    }
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

  if (loading) return html`<div className="h-screen flex items-center justify-center bg-gray-50"><${Loader2} className="animate-spin text-indigo-600" size=${48} /></div>`;
  if (!user) return html`<${AuthForm} onAuth=${setUser} />`;

  return html`
    <div className="flex h-screen bg-white text-gray-900 overflow-hidden">
      <!-- Sidebar -->
      <aside className=${`bg-white border-r transition-all duration-300 flex flex-col ${isSidebarOpen ? 'w-64' : 'w-0 overflow-hidden'}`}>
        <div className="p-8 flex flex-col h-full min-w-[256px]">
          <div className="flex items-center space-x-3 mb-12">
            <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-xl shadow-indigo-100 rotate-3"><${Folder} className="text-white" size=${24} /></div>
            <span className="text-2xl font-black text-gray-900 tracking-tight">Gemini Drive</span>
          </div>

          <nav className="flex-1 space-y-1">
             <button onClick=${() => setFilters({ ...filters, starred: false, type: 'all' })} className=${`w-full flex items-center space-x-3 p-3.5 rounded-2xl transition-all ${!filters.starred && filters.type === 'all' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-gray-500 hover:bg-gray-50'}`}><${LayoutGrid} size=${20} /> <span className="text-sm">All Files</span></button>
             <button onClick=${() => setFilters({ ...filters, starred: true })} className=${`w-full flex items-center space-x-3 p-3.5 rounded-2xl transition-all ${filters.starred ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-gray-500 hover:bg-gray-50'}`}><${Star} size=${20} /> <span className="text-sm">Starred</span></button>
             <div className="pt-8 pb-3 px-4 text-[11px] font-black text-gray-300 uppercase tracking-[0.2em]">Folders</div>
             <button onClick=${() => setFilters({ ...filters, starred: false, type: 'image' })} className=${`w-full flex items-center space-x-3 p-3.5 rounded-2xl transition-all ${filters.type === 'image' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-gray-500 hover:bg-gray-50'}`}><${ImageIcon} size=${20} /> <span className="text-sm">Photos</span></button>
             <button onClick=${() => setFilters({ ...filters, starred: false, type: 'text' })} className=${`w-full flex items-center space-x-3 p-3.5 rounded-2xl transition-all ${filters.type === 'text' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-gray-500 hover:bg-gray-50'}`}><${FileText} size=${20} /> <span className="text-sm">Documents</span></button>
          </nav>

          <div className="mt-auto pt-8 border-t border-gray-100">
            <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-3xl group cursor-pointer hover:bg-gray-100 transition-all" onClick=${() => setShowProfile(true)}>
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-black text-sm overflow-hidden">
                ${user.photoURL ? html`<img src=${user.photoURL} className="w-full h-full object-cover" />` : user.name?.[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black truncate text-gray-900">${user.name || 'User'}</p>
                <p className="text-[10px] font-bold text-gray-400 truncate tracking-tight">Manage Account</p>
              </div>
              <button onClick=${(e) => { e.stopPropagation(); signOut(auth); }} className="text-gray-300 hover:text-red-500 transition-colors"><${LogOut} size=${18} /></button>
            </div>
          </div>
        </div>
      </aside>

      <!-- Main Content -->
      <main className="flex-1 flex flex-col overflow-hidden bg-white">
        <header className="px-8 py-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center space-x-6 flex-1 max-w-2xl">
            <button onClick=${() => setIsSidebarOpen(!isSidebarOpen)} className="p-2.5 hover:bg-gray-100 rounded-xl text-gray-400 transition-all active:scale-90">
              <${isSidebarOpen ? ChevronLeft : ChevronRight} size=${24} />
            </button>
            <div className="relative w-full group">
              <${Search} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-indigo-500" size=${20} />
              <input type="text" placeholder="Search by name or intelligence..." className="w-full pl-12 pr-4 py-3.5 bg-gray-50 rounded-2xl outline-none focus:bg-white focus:ring-4 ring-indigo-50 transition-all text-sm font-medium" value=${filters.search} onChange=${e => setFilters({ ...filters, search: e.target.value })} />
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3.5 rounded-2xl cursor-pointer font-black transition-all shadow-xl shadow-indigo-100 active:scale-95 group">
              <${Plus} size=${20} className="group-hover:rotate-90 transition-transform" />
              <span className="text-sm">Upload</span>
              <input type="file" multiple className="hidden" onChange=${handleUpload} />
            </label>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-[#fdfdfe]">
          ${uploading && html`
            <div className="mb-10 flex items-center space-x-4 bg-indigo-600 p-5 rounded-[32px] shadow-2xl animate-in slide-in-from-top duration-500">
              <${Loader2} className="animate-spin text-white" size=${24} />
              <span className="text-white text-sm font-black uppercase tracking-widest">Gemini is analyzing your data...</span>
            </div>
          `}

          ${filtered.length === 0 ? html`
            <div className="h-full flex flex-col items-center justify-center text-gray-200 py-32 animate-in fade-in duration-1000">
              <${HardDrive} size=${84} strokeWidth=${1} className="opacity-10 mb-6" />
              <p className="text-xl font-black text-gray-300 uppercase tracking-[0.2em]">Storage clear</p>
            </div>
          ` : html`
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-10">
              ${filtered.map(f => html`
                <div key=${f.id} onClick=${() => setSelectedFile(f)} className="group bg-white p-5 rounded-[40px] border border-gray-100 hover:border-indigo-100 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-500 cursor-pointer relative flex flex-col">
                  <div className="aspect-[5/4] bg-gray-50 rounded-[30px] mb-5 flex items-center justify-center overflow-hidden border border-gray-50">
                    ${f.type === 'image' ? html`<img src=${f.previewUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />` : html`<${FileIcon} filename=${f.name} className="fiv-viv-lg opacity-40 group-hover:scale-110 transition-transform duration-500" />`}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-gray-900 truncate text-sm mb-1">${f.name}</h3>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">${(f.size / 1024).toFixed(0)} KB • ${new Date(f.date).toLocaleDateString()}</p>
                      <span className="bg-gray-100 px-2 py-0.5 rounded-lg text-[9px] font-black text-gray-500 uppercase">${f.type}</span>
                    </div>
                  </div>
                  <div className="absolute top-4 right-4 flex space-x-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <button onClick=${e => toggleStar(f.id, e)} className=${`p-2.5 rounded-xl shadow-xl transition-all ${f.starred ? 'bg-amber-400 text-white' : 'bg-white text-gray-400 hover:text-amber-500'}`}><${Star} size=${16} fill=${f.starred ? "currentColor" : "none"} /></button>
                    <button onClick=${e => removeFile(f.id, e)} className="p-2.5 bg-white rounded-xl shadow-xl text-gray-400 hover:text-red-600 transition-all"><${Trash2} size=${16} /></button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-black/60 backdrop-blur-2xl animate-in fade-in duration-500">
          <div className="bg-white rounded-[56px] w-full max-w-7xl h-full max-h-[90vh] flex flex-col md:flex-row overflow-hidden shadow-2xl">
            <div className="flex-1 bg-gray-100/50 flex items-center justify-center relative p-16 overflow-hidden border-r border-gray-100">
              <button onClick=${() => setSelectedFile(null)} className="absolute top-10 left-10 p-5 bg-white rounded-3xl shadow-xl hover:bg-gray-50 active:scale-90 transition-all"><${X} size=${24} /></button>
              ${selectedFile.type === 'image' ? html`<img src=${selectedFile.previewUrl} className="max-h-full max-w-full object-contain rounded-[40px] shadow-2xl" />` : html`
                <div className="text-center">
                   <div className="w-48 h-48 bg-white rounded-[40px] flex items-center justify-center shadow-2xl mx-auto mb-10"><${FileIcon} filename=${selectedFile.name} className="fiv-viv-lg" /></div>
                   <p className="text-3xl font-black text-gray-900 mb-2">${selectedFile.name}</p>
                   <p className="text-sm text-gray-400 uppercase tracking-widest font-bold">Smart Preview Restricted</p>
                </div>
              `}
            </div>
            
            <div className="w-full md:w-[480px] p-16 flex flex-col bg-white overflow-y-auto custom-scrollbar">
              <div className="mb-12">
                <span className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.3em] block mb-4">Metadata Analysis</span>
                <h2 className="text-4xl font-black text-gray-900 break-words leading-tight mb-4">${selectedFile.name}</h2>
                <div className="flex space-x-2">
                   <span className="bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-indigo-100">${selectedFile.type}</span>
                   <span className="bg-amber-50 text-amber-600 px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-amber-100">${(selectedFile.size / (1024*1024)).toFixed(2)} MB</span>
                </div>
              </div>
              
              <div className="flex-1 space-y-12">
                <section>
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="bg-indigo-600 p-2 rounded-xl"><${ArrowUpRight} className="text-white" size=${16} /></div>
                    <span className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.2em]">Smart Intelligence</span>
                  </div>
                  <div className="bg-gradient-to-br from-indigo-50 to-white p-8 rounded-[40px] text-sm leading-relaxed text-indigo-900 border border-indigo-100 shadow-inner">
                    ${selectedFile.analysis || html`<div className="flex items-center space-x-3"><${Loader2} className="animate-spin" size=${16} /> <span>Thinking...</span></div>`}
                  </div>
                </section>

                <section>
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="bg-gray-900 p-2 rounded-xl"><${StickyNote} className="text-white" size=${16} /></div>
                    <span className="text-[11px] font-black text-gray-900 uppercase tracking-[0.2em]">Private Notes</span>
                  </div>
                  <div className="bg-gray-50 p-8 rounded-[40px] text-sm italic text-gray-500 border border-gray-100">
                    No custom notes available for this object.
                  </div>
                </section>
              </div>

              <div className="mt-16 flex space-x-4">
                <button onClick=${() => { const a = document.createElement('a'); a.href = selectedFile.previewUrl; a.download = selectedFile.name; a.click(); }} className="flex-1 bg-gray-900 text-white py-6 rounded-[30px] font-black flex items-center justify-center space-x-3 shadow-2xl active:scale-95 transition-all">
                  <${Download} size=${20} /> <span>Export Data</span>
                </button>
                <button onClick=${e => removeFile(selectedFile.id, e)} className="p-6 bg-red-50 text-red-500 rounded-[30px] hover:bg-red-500 hover:text-white transition-all"><${Trash2} size=${24} /></button>
              </div>
            </div>
          </div>
        </div>
      `}
    </div>
  `;
};

export default App;