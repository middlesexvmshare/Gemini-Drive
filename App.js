
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
  sendEmailVerification,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";

const { 
  Plus, Search, LayoutGrid, List, FileText, Image: ImageIcon, File, 
  Star, Trash2, X, Edit3, ArrowUpRight, Loader2, ChevronRight, ChevronLeft, 
  Download, Maximize2, Minimize2, AlertCircle, HardDrive, StickyNote, 
  LogOut, User, Mail, Lock, Camera, ArrowRight, RefreshCcw, Folder 
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// --- IndexedDB Utility ---
const DB_NAME = 'GeminiDriveDB';
const STORE_NAME = 'files';

const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const saveFileToDB = async (file) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const { previewUrl, ...toSave } = file;
    const request = store.put(toSave);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

const deleteFileFromDB = async (id) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

const getAllFilesFromDB = async () => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const generateId = () => crypto.randomUUID?.() || Math.random().toString(36).substring(2, 15);

// --- Auth UI Component ---
const AuthForm = ({ onAuth }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      onAuth(result.user);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const res = await signInWithEmailAndPassword(auth, email, password);
        if (!res.user.emailVerified) {
          await sendEmailVerification(res.user);
          await signOut(auth);
          setVerificationEmail(email);
        } else { onAuth(res.user); }
      } else {
        if (password !== repeatPassword) throw new Error("Passwords do not match");
        const res = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(res.user);
        await signOut(auth);
        setVerificationEmail(email);
      }
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  if (verificationEmail) return html`
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white p-12 rounded-[48px] shadow-2xl text-center max-w-lg">
        <${Mail} size=${40} className="mx-auto mb-6 text-indigo-600" />
        <h2 className="text-3xl font-black mb-4">Check your inbox</h2>
        <p className="text-gray-600 mb-8">Verification sent to ${verificationEmail}</p>
        <button onClick=${() => setVerificationEmail(null)} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black">Back to Login</button>
      </div>
    </div>
  `;

  return html`
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white p-12 rounded-[48px] shadow-2xl w-full max-w-lg">
        <div className="text-center mb-10">
          <div className="bg-indigo-600 p-4 rounded-3xl inline-block mb-4">
            <${Folder} className="text-white" size=${32} />
          </div>
          <h1 className="text-4xl font-black">Gemini Drive</h1>
        </div>
        <form onSubmit=${handleSubmit} className="space-y-4">
          <input type="email" placeholder="Email" className="w-full p-4 bg-gray-50 rounded-2xl outline-none" value=${email} onChange=${(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password" className="w-full p-4 bg-gray-50 rounded-2xl outline-none" value=${password} onChange=${(e) => setPassword(e.target.value)} required />
          ${!isLogin && html`<input type="password" placeholder="Repeat Password" className="w-full p-4 bg-gray-50 rounded-2xl outline-none" value=${repeatPassword} onChange=${(e) => setRepeatPassword(e.target.value)} required />`}
          <button type="submit" disabled=${loading} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black">
            ${loading ? html`<${Loader2} className="animate-spin mx-auto" />` : (isLogin ? 'Sign In' : 'Sign Up')}
          </button>
          <div className="flex items-center space-x-4"><div className="flex-1 h-px bg-gray-100"></div><span className="text-xs text-gray-400">OR</span><div className="flex-1 h-px bg-gray-100"></div></div>
          <button type="button" onClick=${handleGoogleSignIn} className="w-full border p-4 rounded-2xl font-bold flex items-center justify-center space-x-2">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/action/google.svg" width="20" /> <span>Continue with Google</span>
          </button>
        </form>
        <button onClick=${() => setIsLogin(!isLogin)} className="w-full mt-6 text-indigo-600 font-bold">${isLogin ? 'Create an account' : 'Already have one? Login'}</button>
      </div>
    </div>
  `;
};

const FileIcon = ({ filename }) => {
  const ext = filename.split('.').pop()?.toLowerCase() || 'unknown';
  return html`<span className="fiv-viv fiv-icon-${ext}"></span>`;
};

const App = () => {
  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [files, setFiles] = useState([]);
  const [filters, setFilters] = useState({ search: '', type: 'all', onlyStarred: false });
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [viewMode, setViewMode] = useState('grid');

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthChecking(false);
    });
  }, []);

  useEffect(() => {
    if (user) {
      getAllFilesFromDB().then(dbFiles => {
        setFiles(dbFiles.map(f => ({ ...f, previewUrl: URL.createObjectURL(f.data) })));
      });
    }
  }, [user]);

  const handleUpload = async (e) => {
    const fileList = e.target.files;
    if (!fileList.length) return;
    setIsUploading(true);
    for (const file of fileList) {
      const type = file.type.startsWith('image/') ? 'image' : (file.type.includes('pdf') || file.type.startsWith('text/') ? 'text' : 'other');
      const newFile = { id: generateId(), name: file.name, type, mimeType: file.type, size: file.size, uploadDate: Date.now(), data: file, notes: '', isFavorite: false };
      await saveFileToDB(newFile);
      const withUrl = { ...newFile, previewUrl: URL.createObjectURL(file) };
      setFiles(prev => [withUrl, ...prev]);
      
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const analysis = await analyzeFile(file.name, ev.target.result, file.type);
        const updated = { ...newFile, smartAnalysis: analysis };
        await saveFileToDB(updated);
        setFiles(prev => prev.map(f => f.id === newFile.id ? { ...f, smartAnalysis: analysis } : f));
      };
      reader.readAsDataURL(file);
    }
    setIsUploading(false);
  };

  const deleteFile = async (id) => {
    if (confirm('Delete?')) {
      await deleteFileFromDB(id);
      setFiles(prev => prev.filter(f => f.id !== id));
      if (selectedFile?.id === id) setSelectedFile(null);
    }
  };

  const filteredFiles = useMemo(() => {
    return files.filter(f => {
      const matchesSearch = f.name.toLowerCase().includes(filters.search.toLowerCase());
      const matchesStarred = !filters.onlyStarred || f.isFavorite;
      return matchesSearch && matchesStarred;
    });
  }, [files, filters]);

  if (authChecking) return html`<div className="h-screen flex items-center justify-center"><${Loader2} className="animate-spin text-indigo-600" size=${48} /></div>`;
  if (!user) return html`<${AuthForm} onAuth=${setUser} />`;

  return html`
    <div className="flex h-screen bg-white">
      <aside className="w-64 border-r p-6 flex flex-col">
        <div className="flex items-center space-x-3 mb-10">
          <div className="bg-indigo-600 p-2 rounded-xl"><${Folder} className="text-white" size=${20} /></div>
          <span className="font-black text-xl">Gemini Drive</span>
        </div>
        <div className="space-y-2 flex-1">
          <button onClick=${() => setFilters({ ...filters, onlyStarred: false })} className="w-full flex items-center space-x-3 p-3 rounded-xl bg-gray-50 text-indigo-600 font-bold"><${LayoutGrid} size=${18} /> <span>All Files</span></button>
          <button onClick=${() => setFilters({ ...filters, onlyStarred: true })} className="w-full flex items-center space-x-3 p-3 rounded-xl hover:bg-gray-50"><${Star} size=${18} /> <span>Starred</span></button>
        </div>
        <div className="pt-6 border-t">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">${user.email[0].toUpperCase()}</div>
            <button onClick=${() => signOut(auth)} className="text-xs text-red-500 font-bold">Logout</button>
          </div>
        </div>
      </aside>
      
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="p-6 border-b flex justify-between items-center">
          <div className="relative w-96">
            <${Search} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size=${16} />
            <input type="text" placeholder="Search..." className="w-full pl-10 pr-4 py-2 bg-gray-50 rounded-xl outline-none" value=${filters.search} onChange=${(e) => setFilters({ ...filters, search: e.target.value })} />
          </div>
          <div className="flex items-center space-x-4">
            <label className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold cursor-pointer flex items-center space-x-2">
              <${Plus} size=${18} /> <span>Upload</span>
              <input type="file" className="hidden" multiple onChange=${handleUpload} />
            </label>
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto p-8">
          ${isUploading && html`<div className="mb-4 text-indigo-600 font-bold flex items-center space-x-2"><${Loader2} className="animate-spin" /> <span>Gemini is analyzing...</span></div>`}
          <div className="grid grid-cols-4 gap-6">
            ${filteredFiles.map(file => html`
              <div key=${file.id} onClick=${() => setSelectedFile(file)} className="p-4 border rounded-3xl hover:shadow-xl transition-all cursor-pointer group relative">
                <div className="aspect-square bg-gray-50 rounded-2xl mb-3 flex items-center justify-center">
                  ${file.type === 'image' ? html`<img src=${file.previewUrl} className="w-full h-full object-cover rounded-2xl" />` : html`<${FileIcon} filename=${file.name} />`}
                </div>
                <p className="font-bold truncate">${file.name}</p>
                <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick=${(e) => { e.stopPropagation(); deleteFile(file.id); }} className="p-2 bg-white rounded-lg shadow text-red-500"><${Trash2} size=${14} /></button>
                </div>
              </div>
            `)}
          </div>
        </div>
      </main>

      ${selectedFile && html`
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-12 z-50">
          <div className="bg-white w-full max-w-5xl rounded-[48px] overflow-hidden flex h-full">
            <div className="flex-1 bg-gray-100 flex items-center justify-center relative p-8">
               <button onClick=${() => setSelectedFile(null)} className="absolute top-6 left-6 p-3 bg-white rounded-2xl shadow"><${X} /></button>
               ${selectedFile.type === 'image' ? html`<img src=${selectedFile.previewUrl} className="max-h-full object-contain shadow-2xl rounded-3xl" />` : html`<div className="text-center"><${File} size=${128} className="mx-auto text-gray-300" /><p className="mt-4 font-bold">No Preview Available</p></div>`}
            </div>
            <div className="w-96 border-l p-10 flex flex-col">
              <h2 className="text-2xl font-black mb-6">${selectedFile.name}</h2>
              <div className="flex-1">
                <p className="text-xs font-black text-indigo-600 uppercase mb-2">Gemini Analysis</p>
                <div className="bg-indigo-50 p-6 rounded-3xl text-sm leading-relaxed text-indigo-900">
                  ${selectedFile.smartAnalysis || 'Thinking...'}
                </div>
              </div>
              <button onClick=${() => { 
                const a = document.createElement('a'); a.href = selectedFile.previewUrl; a.download = selectedFile.name; a.click();
              }} className="w-full bg-gray-900 text-white py-4 rounded-2xl font-black flex items-center justify-center space-x-2">
                <${Download} /> <span>Download</span>
              </button>
            </div>
          </div>
        </div>
      `}
    </div>
  `;
};

export default App;
