
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  LayoutGrid, 
  List, 
  FileText, 
  Image as ImageIcon, 
  File, 
  Clock, 
  Star, 
  Trash2, 
  X, 
  Edit3,
  ArrowUpRight,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Download,
  Maximize2,
  Minimize2,
  AlertCircle,
  HardDrive,
  StickyNote,
  LogOut,
  User,
  Mail,
  Lock,
  Camera,
  ArrowRight,
  RefreshCcw,
  Folder
} from 'lucide-react';
import { DriveFile, FilterState, FileType } from './types';
import { analyzeFile } from './services/gemini';

// Corrected Firebase modular SDK v9+ imports
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
  signInWithPopup,
  User as FirebaseUser
} from "firebase/auth";

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

const initDB = (): Promise<IDBDatabase> => {
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

const saveFileToDB = async (file: DriveFile) => {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const { previewUrl, ...toSave } = file;
    const request = store.put(toSave);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

const deleteFileFromDB = async (id: string) => {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

const getAllFilesFromDB = async (userId: string): Promise<DriveFile[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
  });
};

const generateId = () => {
  try {
    return crypto.randomUUID();
  } catch (e) {
    return Math.random().toString(36).substring(2, 15);
  }
};

// --- Auth UI Component ---

const AuthForm: React.FC<{ onAuth: (user: FirebaseUser) => void }> = ({ onAuth }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetEmailSent(true);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        setError("User with this email not found.");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      // Google users are usually auto-verified by Firebase
      onAuth(user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        if (!user.emailVerified) {
          await sendEmailVerification(user);
          await signOut(auth);
          setVerificationEmail(email);
        } else {
          onAuth(user);
        }
      } else {
        if (password !== repeatPassword) {
          throw new Error("Passwords do not match");
        }
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        await sendEmailVerification(user);
        await signOut(auth);
        setVerificationEmail(email);
      }
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setError("Password or Email Incorrect");
      } else if (err.code === 'auth/email-already-in-use') {
        setError("User already exists. Sign in?");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleProfilePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setProfilePreview(url);
    }
  };

  if (resetEmailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f9fafb] p-6 relative overflow-hidden text-center">
        <div className="absolute top-[-10%] left-[-10%] w-1/2 h-1/2 bg-indigo-100 rounded-full blur-[120px] opacity-50"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-1/2 h-1/2 bg-purple-100 rounded-full blur-[120px] opacity-50"></div>

        <div className="bg-white/70 backdrop-blur-xl border border-white p-12 rounded-[48px] w-full max-w-lg shadow-2xl relative z-10 animate-in zoom-in-95 duration-500">
          <div className="bg-indigo-50 w-24 h-24 rounded-[32px] flex items-center justify-center mx-auto mb-8 text-indigo-600 shadow-inner">
            <RefreshCcw size={40} strokeWidth={1.5} />
          </div>
          <h2 className="text-3xl font-black text-gray-900 mb-4">Check your email</h2>
          <p className="text-gray-600 font-medium leading-relaxed mb-10">
            We sent you a password change link to <span className="text-indigo-600 font-bold">{email}</span>.
          </p>
          <button 
            onClick={() => {
              setResetEmailSent(false);
              setIsForgotPassword(false);
              setIsLogin(true);
            }}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black shadow-xl shadow-indigo-100 transition-all flex items-center justify-center space-x-2 active:scale-95"
          >
            <ArrowRight size={20} className="rotate-180" />
            <span>Sign In</span>
          </button>
        </div>
      </div>
    );
  }

  if (verificationEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f9fafb] p-6 relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-1/2 h-1/2 bg-indigo-100 rounded-full blur-[120px] opacity-50"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-1/2 h-1/2 bg-purple-100 rounded-full blur-[120px] opacity-50"></div>

        <div className="bg-white/70 backdrop-blur-xl border border-white p-12 rounded-[48px] w-full max-w-lg shadow-2xl relative z-10 text-center animate-in zoom-in-95 duration-500">
          <div className="bg-indigo-50 w-24 h-24 rounded-[32px] flex items-center justify-center mx-auto mb-8 text-indigo-600 shadow-inner">
            <Mail size={40} strokeWidth={1.5} />
          </div>
          <h2 className="text-3xl font-black text-gray-900 mb-4">Check your inbox</h2>
          <p className="text-gray-600 font-medium leading-relaxed mb-10">
            We have sent you a verification email to <span className="text-indigo-600 font-bold">{verificationEmail}</span>. Verify it and log in.
          </p>
          <button 
            onClick={() => {
              setVerificationEmail(null);
              setIsLogin(true);
            }}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black shadow-xl shadow-indigo-100 transition-all flex items-center justify-center space-x-2 active:scale-95"
          >
            <ArrowRight size={20} className="rotate-180" />
            <span>Back to Login</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f9fafb] p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-1/2 h-1/2 bg-indigo-100 rounded-full blur-[120px] opacity-50"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-1/2 h-1/2 bg-purple-100 rounded-full blur-[120px] opacity-50"></div>

      <div className="bg-white/70 backdrop-blur-xl border border-white p-8 sm:p-12 rounded-[48px] w-full max-w-lg shadow-2xl relative z-10 transition-all duration-500">
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-4 rounded-3xl shadow-xl shadow-indigo-100 mb-6 rotate-6 group hover:rotate-0 transition-transform duration-500">
            <Folder className="text-white" size={32} strokeWidth={3} />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-gray-900 mb-2">Gemini Drive</h1>
          <p className="text-gray-500 font-medium">
            {isForgotPassword 
              ? "Recover access to your account."
              : isLogin ? "Welcome back! Access your smart cloud." : "Start your intelligent storage journey today."}
          </p>
        </div>

        {error && (
          <div className={`mb-6 p-4 rounded-2xl flex items-center justify-between text-sm font-bold transition-all ${error === "User already exists. Sign in?" ? "bg-indigo-50 text-indigo-600 border border-indigo-100" : "bg-red-50 text-red-600 border border-red-100"}`}>
            <div className="flex items-center space-x-3">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
            {error === "User already exists. Sign in?" && (
              <button onClick={() => { setIsLogin(true); setIsForgotPassword(false); }} className="underline font-black">Sign in</button>
            )}
          </div>
        )}

        <form onSubmit={isForgotPassword ? handlePasswordReset : handleSubmit} className="space-y-5">
          {!isLogin && !isForgotPassword && (
            <div className="flex flex-col items-center mb-6">
              <label className="relative cursor-pointer group">
                <div className="w-24 h-24 rounded-full bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden transition-all group-hover:border-indigo-400">
                  {profilePreview ? (
                    <img src={profilePreview} className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="text-gray-300 group-hover:text-indigo-400 transition-colors" />
                  )}
                </div>
                <input type="file" className="hidden" accept="image/*" onChange={handleProfilePhoto} />
                <div className="absolute -bottom-1 -right-1 bg-white p-1.5 rounded-full shadow-md border border-gray-100 text-indigo-600">
                  <Plus size={14} strokeWidth={3} />
                </div>
              </label>
              <span className="text-[10px] font-black text-gray-400 uppercase mt-2">Profile Photo</span>
            </div>
          )}

          {!isLogin && !isForgotPassword && (
            <div className="relative group">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
              <input 
                type="text" 
                placeholder="Full Name" 
                required 
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border-transparent border focus:bg-white focus:border-indigo-200 rounded-2xl outline-none font-medium transition-all"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}

          <div className="relative group">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
            <input 
              type="email" 
              placeholder="Email address" 
              required 
              className="w-full pl-12 pr-4 py-4 bg-gray-50 border-transparent border focus:bg-white focus:border-indigo-200 rounded-2xl outline-none font-medium transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {!isForgotPassword && (
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
              <input 
                type="password" 
                placeholder="Password" 
                required 
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border-transparent border focus:bg-white focus:border-indigo-200 rounded-2xl outline-none font-medium transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          )}

          {isLogin && !isForgotPassword && (
            <div className="flex justify-end px-2">
              <button 
                type="button"
                onClick={() => { setIsForgotPassword(true); setError(null); }}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
              >
                Forgot password?
              </button>
            </div>
          )}

          {!isLogin && !isForgotPassword && (
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
              <input 
                type="password" 
                placeholder="Repeat Password" 
                required 
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border-transparent border focus:bg-white focus:border-indigo-200 rounded-2xl outline-none font-medium transition-all"
                value={repeatPassword}
                onChange={(e) => setRepeatPassword(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-4">
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black shadow-xl shadow-indigo-100 transition-all flex items-center justify-center space-x-2 group active:scale-95 disabled:opacity-70"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : (
                <>
                  <span>{isForgotPassword ? "Get Reset Link" : isLogin ? "Sign In" : "Create Account"}</span>
                  <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>

            {!isForgotPassword && (
              <>
                <div className="flex items-center space-x-4 my-6">
                  <div className="flex-1 h-px bg-gray-100"></div>
                  <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">or</span>
                  <div className="flex-1 h-px bg-gray-100"></div>
                </div>

                <button 
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full bg-white border border-gray-200 hover:border-gray-300 text-gray-700 py-4 rounded-2xl font-bold shadow-sm transition-all flex items-center justify-center space-x-3 active:scale-95 disabled:opacity-70"
                >
                  <svg width="20" height="20" viewBox="0 0 48 48">
                    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                    <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                    <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                    <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
                  </svg>
                  <span>Continue with Google</span>
                </button>
              </>
            )}
          </div>

          {isForgotPassword && (
            <button 
              type="button"
              onClick={() => { setIsForgotPassword(false); setError(null); }}
              className="w-full text-xs font-bold text-gray-400 hover:text-gray-600 py-2"
            >
              Back to login
            </button>
          )}
        </form>

        {!isForgotPassword && (
          <div className="mt-8 pt-8 border-t border-gray-100 text-center">
            <p className="text-sm font-medium text-gray-500">
              {isLogin ? "Don't have an account?" : "Already have an account?"}
              <button 
                onClick={() => { setIsLogin(!isLogin); setError(null); }}
                className="ml-2 text-indigo-600 font-black hover:underline underline-offset-4"
              >
                {isLogin ? "Join now" : "Sign in here"}
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Main Drive App Component ---

const SidebarItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${
      active ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-sm' : 'text-gray-600 hover:bg-gray-100'
    }`}
  >
    <Icon size={20} className={active ? 'text-indigo-600' : 'text-gray-400'} />
    <span className="text-sm">{label}</span>
  </button>
);

const FileIcon = ({ filename, className = "" }: { filename: string, className?: string }) => {
  const ext = filename.split('.').pop()?.toLowerCase() || 'unknown';
  return <span className={`fiv-viv fiv-icon-${ext} ${className}`}></span>;
};

const App: React.FC = () => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    type: 'all',
    sortBy: 'date',
    onlyStarred: false
  });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null);
  const [editingFile, setEditingFile] = useState<DriveFile | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isZenMode, setIsZenMode] = useState(false);
  const [textContent, setTextContent] = useState<string>('');

  const TOTAL_SPACE_LIMIT = 5 * 1024 * 1024 * 1024;
  const currentUsedSpace = useMemo(() => files.reduce((acc, f) => acc + f.size, 0), [files]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      // Only set the user if they have verified their email
      if (currentUser && currentUser.emailVerified) {
        setUser(currentUser);
      } else {
        setUser(null);
      }
      setAuthChecking(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    return () => {
      files.forEach(file => {
        if (file.previewUrl) URL.revokeObjectURL(file.previewUrl);
      });
    };
  }, [files]);

  useEffect(() => {
    if (!user) {
      setFiles([]);
      return;
    }
    const load = async () => {
      try {
        const dbFiles = await getAllFilesFromDB(user.uid);
        const filesWithUrls = dbFiles.map(f => ({
          ...f,
          previewUrl: URL.createObjectURL(f.data)
        }));
        setFiles(filesWithUrls);
      } catch (e) {
        console.error("Failed to load files from IndexedDB", e);
      }
    };
    load();
  }, [user]);

  useEffect(() => {
    if (selectedFile?.type === 'text') {
      const reader = new FileReader();
      reader.onload = (e) => setTextContent(e.target?.result as string);
      reader.readAsText(selectedFile.data);
    } else {
      setTextContent('');
    }
  }, [selectedFile]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return;
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;

    setIsUploading(true);
    setUploadError(null);
    const newFiles: DriveFile[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (file.size > 1024 * 1024 * 1024) {
        setUploadError(`File "${file.name}" exceeds the 1GB limit.`);
        continue;
      }
      if (currentUsedSpace + file.size > TOTAL_SPACE_LIMIT) {
        setUploadError(`Storage limit reached.`);
        break;
      }

      let type: FileType = 'other';
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.includes('pdf')) type = 'pdf';
      else if (file.type.startsWith('text/') || file.name.endsWith('.md')) type = 'text';
      
      const newFile: DriveFile = {
        id: generateId(),
        name: file.name,
        type,
        mimeType: file.type,
        size: file.size,
        uploadDate: Date.now(),
        data: file,
        previewUrl: URL.createObjectURL(file),
        notes: '',
        isFavorite: false
      };

      try {
        await saveFileToDB(newFile);
        newFiles.push(newFile);

        if (type === 'image' || (type === 'text' && file.size < 1024 * 1024)) {
          const reader = new FileReader();
          reader.onload = async (e) => {
            const dataUrl = e.target?.result as string;
            // Pass actual mimeType (file.type) to the analysis service, not the internal enum category
            analyzeFile(file.name, dataUrl, file.type).then(async (analysis) => {
              const updatedFile = { ...newFile, smartAnalysis: analysis };
              await saveFileToDB(updatedFile);
              setFiles(prev => prev.map(f => f.id === newFile.id ? { ...f, smartAnalysis: analysis } : f));
            }).catch(() => {});
          };
          reader.readAsDataURL(file);
        }
      } catch (err) {
        console.error(err);
      }
    }

    if (newFiles.length > 0) {
      setFiles(prev => [...newFiles, ...prev]);
    }
    setIsUploading(false);
    event.target.value = '';
  };

  const deleteFile = async (id: string) => {
    if (window.confirm('Delete this file forever?')) {
      const fileToDelete = files.find(f => f.id === id);
      if (fileToDelete?.previewUrl) URL.revokeObjectURL(fileToDelete.previewUrl);
      
      try {
        await deleteFileFromDB(id);
        setFiles(prev => prev.filter(f => f.id !== id));
        if (selectedFile?.id === id) setSelectedFile(null);
      } catch (e) {
        console.error("Delete failed", e);
      }
    }
  };

  const toggleStar = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const fileToUpdate = files.find(f => f.id === id);
    if (!fileToUpdate) return;
    
    const updated = { ...fileToUpdate, isFavorite: !fileToUpdate.isFavorite };
    await saveFileToDB(updated);
    setFiles(prev => prev.map(f => f.id === id ? updated : f));
    if (selectedFile?.id === id) setSelectedFile(updated);
  };

  const updateFile = async (updated: DriveFile) => {
    await saveFileToDB(updated);
    setFiles(prev => prev.map(f => f.id === updated.id ? updated : f));
    setEditingFile(null);
  };

  const filteredFiles = useMemo(() => {
    return files
      .filter(f => {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch = 
          f.name.toLowerCase().includes(searchLower) || 
          f.notes.toLowerCase().includes(searchLower) ||
          f.smartAnalysis?.toLowerCase().includes(searchLower);
        
        let matchesType = true;
        if (filters.type === 'image') matchesType = f.type === 'image';
        else if (filters.type === 'documents') matchesType = f.type === 'text' || f.type === 'pdf';
        else if (filters.type !== 'all') matchesType = f.type === filters.type;

        const matchesStarred = !filters.onlyStarred || f.isFavorite;

        return matchesSearch && matchesType && matchesStarred;
      })
      .sort((a, b) => {
        if (filters.sortBy === 'date') return b.uploadDate - a.uploadDate;
        if (filters.sortBy === 'name') return a.name.localeCompare(b.name);
        return b.size - a.size;
      });
  }, [files, filters]);

  const groupedFiles = useMemo<Record<string, DriveFile[]>>(() => {
    const groups: Record<string, DriveFile[]> = {};
    filteredFiles.forEach(f => {
      const dateStr = new Date(f.uploadDate).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push(f);
    });
    return groups;
  }, [filteredFiles]);

  if (authChecking) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#f9fafb]">
        <Loader2 className="animate-spin text-indigo-600" size={48} strokeWidth={2.5} />
      </div>
    );
  }

  if (!user) {
    return <AuthForm onAuth={setUser} />;
  }

  return (
    <div className="flex h-screen overflow-hidden text-gray-900 selection:bg-indigo-100 selection:text-indigo-900">
      <aside className={`bg-white border-r border-gray-100 flex-shrink-0 transition-all duration-300 z-30 ${isSidebarOpen ? 'w-64' : 'w-0 -translate-x-full lg:translate-x-0 lg:w-0 overflow-hidden'}`}>
        <div className="p-6 h-full flex flex-col min-w-[256px]">
          <div className="flex items-center space-x-3 mb-10 px-2">
            <div className="bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 p-2.5 rounded-2xl shadow-xl shadow-indigo-100 rotate-3">
              <Folder className="text-white" size={24} strokeWidth={3} />
            </div>
            <span className="text-xl font-black tracking-tight">Gemini Drive</span>
          </div>

          <div className="space-y-1.5 flex-1">
            <SidebarItem icon={LayoutGrid} label="All Files" active={filters.type === 'all' && !filters.onlyStarred} onClick={() => setFilters({ ...filters, type: 'all', onlyStarred: false })} />
            <SidebarItem icon={ImageIcon} label="Photos" active={filters.type === 'image'} onClick={() => setFilters({ ...filters, type: 'image', onlyStarred: false })} />
            <SidebarItem icon={FileText} label="Documents" active={filters.type === 'documents'} onClick={() => setFilters({ ...filters, type: 'documents', onlyStarred: false })} />
            <SidebarItem icon={Star} label="Starred" active={filters.onlyStarred} onClick={() => setFilters({ ...filters, onlyStarred: true, type: 'all' })} />
            <SidebarItem icon={Trash2} label="Trash" active={false} onClick={() => alert('Trash folder coming soon.')} />
          </div>

          <div className="mt-auto pt-6 border-t border-gray-50 space-y-4">
            <div className="flex items-center space-x-3 px-3">
               <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100 shadow-sm overflow-hidden">
                 {user.photoURL ? <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" /> : <User size={20} />}
               </div>
               <div className="flex-1 min-w-0">
                 <p className="text-xs font-black text-gray-900 truncate uppercase tracking-tighter">{user.displayName || user.email?.split('@')[0]}</p>
                 <button onClick={() => signOut(auth)} className="text-[10px] font-bold text-red-400 hover:text-red-600 flex items-center transition-colors uppercase tracking-widest">
                   <LogOut size={10} className="mr-1" /> Logout
                 </button>
               </div>
            </div>

            <div className="bg-gradient-to-br from-indigo-50 to-white p-5 rounded-3xl relative overflow-hidden group border border-indigo-100/50 shadow-sm">
              <div className="relative z-10">
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 flex items-center">
                  <HardDrive size={12} className="mr-1.5" /> Storage
                </p>
                <div className="flex items-baseline space-x-1 mb-3">
                  <span className="text-lg font-black text-indigo-900">{(currentUsedSpace / (1024 * 1024 * 1024)).toFixed(2)}</span>
                  <span className="text-xs font-bold text-indigo-500 ml-1">GB / 5 GB</span>
                </div>
                <div className="w-full bg-indigo-100/50 h-2 rounded-full overflow-hidden">
                  <div className="bg-indigo-600 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (currentUsedSpace / TOTAL_SPACE_LIMIT) * 100)}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col bg-[#fdfdfe] overflow-hidden relative">
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 px-8 py-5 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center flex-1 max-w-2xl">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2.5 mr-6 hover:bg-gray-100 rounded-xl text-gray-400 transition-all active:scale-90">
              {isSidebarOpen ? <ChevronLeft size={22} /> : <ChevronRight size={22} />}
            </button>
            <div className="relative w-full group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500" size={18} />
              <input 
                type="text"
                placeholder="Search files, contents or notes..."
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border-transparent focus:bg-white focus:border-indigo-100 focus:ring-4 focus:ring-indigo-50/50 rounded-2xl transition-all outline-none text-sm font-medium"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center space-x-3 ml-8">
            <div className="hidden sm:flex items-center bg-gray-50 p-1 rounded-xl border border-gray-100">
              <button className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`} onClick={() => setViewMode('grid')}>
                <LayoutGrid size={18} />
              </button>
              <button className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`} onClick={() => setViewMode('list')}>
                <List size={18} />
              </button>
            </div>
            
            <label className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl cursor-pointer font-black transition-all shadow-lg active:scale-95 group">
              <Plus size={20} className="group-hover:rotate-90 transition-transform" />
              <span className="text-sm">Upload</span>
              <input type="file" multiple className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {uploadError && (
            <div className="mb-6 bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center justify-between text-red-600">
              <div className="flex items-center space-x-3">
                <AlertCircle size={20} />
                <span className="text-sm font-semibold">{uploadError}</span>
              </div>
              <button onClick={() => setUploadError(null)} className="hover:text-red-800"><X size={16} /></button>
            </div>
          )}

          {isUploading && (
            <div className="mb-8 bg-indigo-600 p-4 rounded-3xl border border-indigo-500 flex items-center space-x-4 shadow-xl">
              <Loader2 className="animate-spin text-white" size={20} />
              <span className="text-sm font-bold text-white block">Gemini is processing your upload...</span>
            </div>
          )}

          {Object.keys(groupedFiles).length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-300">
              <File size={56} strokeWidth={1} />
              <p className="text-xl font-black text-gray-400 mt-4">Cloud is clear</p>
            </div>
          ) : (
            (Object.entries(groupedFiles) as [string, DriveFile[]][]).map(([date, group]) => (
              <div key={date} className="mb-14">
                <h3 className="text-xs font-black text-gray-400 mb-8 uppercase tracking-[0.2em] flex items-center">
                  <span className="w-8 h-[2px] bg-indigo-100 mr-4 rounded-full" />
                  {date}
                </h3>
                
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8">
                    {group.map(file => (
                      <div 
                        key={file.id} 
                        className="group bg-white rounded-[32px] border border-gray-100 p-5 hover:border-indigo-100 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-500 cursor-pointer relative flex flex-col"
                        onClick={() => setSelectedFile(file)}
                      >
                        <div className="aspect-[5/4] rounded-[24px] overflow-hidden bg-gray-50 mb-5 relative flex items-center justify-center border border-gray-50">
                          {file.type === 'image' && file.previewUrl ? (
                            <img src={file.previewUrl} alt={file.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                          ) : (
                            <FileIcon filename={file.name} className="fiv-viv-large opacity-80 group-hover:scale-110 transition-transform duration-500" />
                          )}
                          <div className="absolute top-3 right-3 flex space-x-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                            <button 
                              className={`p-2 rounded-xl shadow-lg transition-all active:scale-90 ${file.isFavorite ? 'bg-amber-400 text-white' : 'bg-white text-gray-400 hover:text-amber-500'}`}
                              onClick={(e) => toggleStar(file.id, e)}
                            >
                              <Star size={16} fill={file.isFavorite ? "currentColor" : "none"} />
                            </button>
                            <button 
                              className="p-2 bg-white rounded-xl shadow-lg text-gray-400 hover:text-red-600 transition-all active:scale-90"
                              onClick={(e) => { e.stopPropagation(); deleteFile(file.id); }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-gray-900 truncate mb-1 text-sm">{file.name}</h4>
                          <div className="flex items-center justify-between text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-2">
                            <span>{file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(0)} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}</span>
                            <span className="bg-gray-50 px-2 py-1 rounded-lg border border-gray-100">{file.type}</span>
                          </div>
                          {file.notes && (
                            <div className="mt-3 pt-3 border-t border-gray-50 flex items-start space-x-2 opacity-80">
                               <StickyNote size={12} className="text-indigo-400 mt-0.5 flex-shrink-0" />
                               <p className="text-[11px] text-gray-500 leading-tight line-clamp-2">{file.notes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white rounded-[32px] border border-gray-100 overflow-hidden shadow-sm">
                    <table className="w-full">
                      <thead className="bg-gray-50/50 border-b border-gray-100">
                        <tr>
                          <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Name</th>
                          <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Type</th>
                          <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Notes</th>
                          <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Size</th>
                          <th className="px-8 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {group.map(file => (
                          <tr key={file.id} className="hover:bg-indigo-50/20 transition-colors cursor-pointer group" onClick={() => setSelectedFile(file)}>
                            <td className="px-8 py-5">
                              <div className="flex items-center space-x-4">
                                <FileIcon filename={file.name} />
                                <span className="font-bold text-gray-900 text-sm">{file.name}</span>
                              </div>
                            </td>
                            <td className="px-8 py-5 text-xs font-bold text-gray-500 uppercase tracking-widest">{file.type}</td>
                            <td className="px-8 py-5">
                               <p className="text-xs text-gray-500 max-w-xs truncate italic">{file.notes || '-'}</p>
                            </td>
                            <td className="px-8 py-5 text-xs font-bold text-gray-500">{file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(0)} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}</td>
                            <td className="px-8 py-5 text-right">
                              <div className="flex items-center justify-end space-x-2">
                                <button 
                                  className={`p-2 rounded-lg transition-all ${file.isFavorite ? 'text-amber-500' : 'text-gray-300 hover:text-amber-500'}`}
                                  onClick={(e) => toggleStar(file.id, e)}
                                >
                                  <Star size={18} fill={file.isFavorite ? "currentColor" : "none"} />
                                </button>
                                <button 
                                  className="p-2 text-gray-300 hover:text-red-600 transition-all"
                                  onClick={(e) => { e.stopPropagation(); deleteFile(file.id); }}
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </main>

      {selectedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xl animate-in fade-in">
          <div className={`bg-white rounded-[40px] w-full max-w-7xl h-[90vh] flex flex-col md:flex-row overflow-hidden shadow-2xl transition-all duration-500 ${isZenMode ? 'md:max-w-5xl' : ''}`}>
            <div className="flex-1 bg-black/5 relative flex flex-col">
              <div className="absolute top-6 left-6 right-6 z-10 flex items-center justify-between">
                <div className="flex space-x-2">
                  <button className="bg-white/90 px-4 py-2.5 rounded-[18px] shadow-lg flex items-center space-x-2 font-bold text-sm" onClick={() => { setSelectedFile(null); setIsZenMode(false); }}>
                    <X size={18} /><span>Close</span>
                  </button>
                  <button className="bg-white/90 p-2.5 rounded-[18px] shadow-lg" onClick={() => { 
                    const link = document.createElement('a'); 
                    link.href = URL.createObjectURL(selectedFile.data); 
                    link.download = selectedFile.name; 
                    link.click(); 
                    setTimeout(() => URL.revokeObjectURL(link.href), 100);
                  }}>
                    <Download size={18} />
                  </button>
                </div>
                <button className={`bg-white/90 px-4 py-2.5 rounded-[18px] shadow-lg flex items-center space-x-2 font-bold text-sm ${isZenMode ? 'text-indigo-600' : ''}`} onClick={() => setIsZenMode(!isZenMode)}>
                  {isZenMode ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                  <span>Full Screen</span>
                </button>
              </div>
              
              <div className="flex-1 flex items-center justify-center p-12 overflow-hidden">
                {selectedFile.type === 'image' && selectedFile.previewUrl ? (
                  <img src={selectedFile.previewUrl} alt={selectedFile.name} className="max-w-full max-h-[70vh] rounded-[32px] object-contain shadow-2xl" />
                ) : selectedFile.type === 'text' ? (
                  <div className="bg-white p-12 w-full max-w-3xl h-full rounded-[32px] overflow-y-auto custom-scrollbar shadow-xl border border-gray-100">
                    <pre className="whitespace-pre-wrap font-sans text-gray-700 leading-relaxed text-sm">
                      {textContent || 'Loading content...'}
                    </pre>
                  </div>
                ) : (
                  <div className="text-center bg-white/50 p-16 rounded-[48px] border-2 border-dashed border-gray-300">
                     <FileIcon filename={selectedFile.name} className="fiv-viv-large mb-6 opacity-50" />
                     <p className="text-2xl font-black text-gray-900 mb-2">Preview Unavailable</p>
                     <p className="text-sm text-gray-500">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                )}
              </div>
            </div>

            <div className={`w-full md:w-[420px] flex flex-col bg-white border-l border-gray-50 transition-all duration-500 ${isZenMode ? 'md:w-0 md:opacity-0 md:pointer-events-none' : 'opacity-100'}`}>
              <div className="p-10 flex-1 overflow-y-auto custom-scrollbar">
                <div className="mb-10">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[10px] font-black text-indigo-400 uppercase">Metadata</span>
                      <button onClick={() => toggleStar(selectedFile.id)} className={`p-2 rounded-xl transition-all ${selectedFile.isFavorite ? 'text-amber-500' : 'text-gray-300'}`}>
                        <Star size={20} fill={selectedFile.isFavorite ? "currentColor" : "none"} />
                      </button>
                    </div>
                    {editingFile?.id === selectedFile.id ? (
                      <div className="space-y-4">
                        <input className="text-2xl font-black text-gray-900 outline-none border-b-2 border-indigo-500 w-full" value={editingFile.name} onChange={(e) => setEditingFile({ ...editingFile, name: e.target.value })} autoFocus />
                        <div className="relative">
                          <textarea className="w-full h-40 p-5 rounded-3xl border-2 border-indigo-100 bg-indigo-50/10 outline-none text-sm resize-none" placeholder="Add your private notes here..." value={editingFile.notes} onChange={(e) => setEditingFile({ ...editingFile, notes: e.target.value })} />
                          <StickyNote size={16} className="absolute bottom-4 right-4 text-indigo-300" />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between group break-all mb-4">
                          <h2 className="text-3xl font-black text-gray-900 leading-none">{selectedFile.name}</h2>
                          <button onClick={() => setEditingFile(selectedFile)} className="p-2 bg-gray-50 rounded-xl text-gray-400 hover:text-indigo-600 transition-all opacity-0 group-hover:opacity-100"><Edit3 size={16} /></button>
                        </div>
                        <div className="bg-gray-50/80 p-6 rounded-[32px] border border-gray-100 relative group cursor-pointer" onClick={() => setEditingFile(selectedFile)}>
                          <span className="text-[10px] font-black text-gray-400 absolute top-4 right-6 uppercase">User Note</span>
                          <p className="text-sm text-gray-600 leading-relaxed font-medium">{selectedFile.notes || "No private notes yet. Click to add some."}</p>
                          <Edit3 size={14} className="absolute bottom-4 right-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    )}
                </div>

                <div className="space-y-8">
                  <div>
                    <h3 className="text-[10px] font-black text-indigo-500 mb-4 flex items-center uppercase tracking-[0.2em]">
                      <ArrowUpRight size={14} className="mr-2" />Gemini Analysis
                    </h3>
                    <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-6 rounded-[32px] text-sm leading-relaxed text-white shadow-xl">
                      {selectedFile.smartAnalysis || <div className="flex items-center space-x-2"><Loader2 size={16} className="animate-spin" /><span>Generating insights...</span></div>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-white border-t border-gray-50 flex space-x-3">
                {editingFile?.id === selectedFile.id ? (
                  <>
                    <button className="flex-1 bg-indigo-600 text-white py-4 rounded-[22px] font-black" onClick={() => { updateFile(editingFile); setSelectedFile(editingFile); }}>Save Changes</button>
                    <button className="px-8 bg-gray-50 text-gray-500 py-4 rounded-[22px] font-black" onClick={() => setEditingFile(null)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button className="flex-1 bg-gray-900 text-white py-4 rounded-[22px] font-black shadow-xl" onClick={() => { 
                      const link = document.createElement('a'); 
                      link.href = URL.createObjectURL(selectedFile.data); 
                      link.download = selectedFile.name; 
                      link.click(); 
                      setTimeout(() => URL.revokeObjectURL(link.href), 100);
                    }}>Download</button>
                    <button className="p-4 bg-red-50 text-red-500 rounded-[22px] hover:bg-red-500 hover:text-white transition-all" onClick={() => deleteFile(selectedFile.id)} title="Permanently delete"><Trash2 size={24} /></button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
