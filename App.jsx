import React, { useState, useEffect, useRef } from 'react';
import { Clock, MapPin, Users, Plus, ChevronRight, Bell, Check, Loader2, Trash2, Navigation, Target, Info, Download } from 'lucide-react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, addDoc, updateDoc, doc, onSnapshot, serverTimestamp, increment, deleteDoc } from 'firebase/firestore';

// Firebase Configuration (تأكد من استبدالها بإعداداتك إذا أردت استخدام قاعدة بياناتك الخاصة)
const firebaseConfig = {
  apiKey: "AIzaSyB52I3krWSU8GJSfelTfniyD3FMjbhXKtQ",
  authDomain: "fe-jamaah-app.firebaseapp.com",
  projectId: "fe-jamaah-app",
  storageBucket: "fe-jamaah-app.firebasestorage.app",
  messagingSenderId: "543521329119",
  appId: "1:543521329119:web:f05f65047008981f913e6a"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'fijamaah-v1';

const LeafletStyles = () => (
  <link
    rel="stylesheet"
    href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
    integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
    crossOrigin=""
  />
);

const getCurrentPrayer = () => {
  const hour = new Date().getHours();
  if (hour >= 4 && hour < 11) return 'الفجر';
  if (hour >= 11 && hour < 15) return 'الظهر';
  if (hour >= 15 && hour < 18) return 'العصر';
  if (hour >= 18 && hour < 19) return 'المغرب';
  return 'العشاء';
};

const App = () => {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [mapInitialized, setMapInitialized] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  
  const mapInstance = useRef(null);
  const markerInstance = useRef(null);
  const [form, setForm] = useState({ isSecondGroup: false, manualLat: 24.7136, manualLng: 46.6753 });

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setDeferredPrompt(null);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) { console.error("Auth Error", error); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !authReady) return;
    const colPath = collection(db, 'artifacts', appId, 'public', 'data', 'prayerGroups');
    const unsubscribe = onSnapshot(colPath, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const currentPrayer = getCurrentPrayer();
      setGroups(fetched.filter(g => g.prayer === currentPrayer));
      setLoading(false);
    }, (err) => {
      console.error("Firestore Error", err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user, authReady]);

  useEffect(() => {
    if (activeTab === 'create') {
      const setupMap = () => {
        const container = document.getElementById('map');
        if (window.L && container) {
          if (mapInstance.current) { mapInstance.current.remove(); }
          const map = window.L.map('map', { zoomControl: false }).setView([form.manualLat, form.manualLng], 15);
          window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
          const marker = window.L.marker([form.manualLat, form.manualLng], { draggable: true }).addTo(map);
          marker.on('dragend', (e) => {
            const pos = e.target.getLatLng();
            setForm(f => ({ ...f, manualLat: pos.lat, manualLng: pos.lng }));
          });
          mapInstance.current = map;
          markerInstance.current = marker;
          setMapInitialized(true);
        } else { setTimeout(setupMap, 500); }
      };

      if (!document.getElementById('l-script')) {
        const s = document.createElement('script');
        s.id = 'l-script';
        s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        s.onload = setupMap;
        document.head.appendChild(s);
      } else { setupMap(); }
    }
  }, [activeTab]);

  const saveGroup = async () => {
    if (!user || isPublishing) return;
    setIsPublishing(true);
    try {
      const col = collection(db, 'artifacts', appId, 'public', 'data', 'prayerGroups');
      await addDoc(col, { 
        isSecondGroup: form.isSecondGroup,
        lat: form.manualLat,
        lng: form.manualLng,
        prayer: getCurrentPrayer(),
        participants: 1, 
        hostId: user.uid, 
        createdAt: serverTimestamp(), 
        joinedUsers: [user.uid] 
      });
      setActiveTab('success');
      setTimeout(() => setActiveTab('home'), 3000);
    } catch (e) { console.error(e); }
    setIsPublishing(false);
  };

  if (!authReady) return <div className="h-screen flex items-center justify-center bg-emerald-50"><Loader2 className="animate-spin text-emerald-600" /></div>;

  return (
    <div dir="rtl" className="bg-slate-50 min-h-screen font-sans text-slate-800 pb-24 select-none">
      <LeafletStyles />
      <header className="bg-emerald-900 text-white p-6 pt-12 rounded-b-[3rem] shadow-xl relative z-10">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-2">
            <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm"><Users className="w-5 h-5 text-emerald-200" /></div>
            <h1 className="text-xl font-bold tracking-tight text-white">في جماعة</h1>
          </div>
          {deferredPrompt && (
            <button onClick={handleInstallClick} className="bg-emerald-500 p-2 rounded-full animate-pulse">
              <Download className="w-5 h-5 text-white" />
            </button>
          )}
        </div>
        <div className="text-center py-4">
          <p className="text-emerald-300 text-xs font-bold mb-1">صلاة الآن</p>
          <h2 className="text-5xl font-black mb-2 text-white">{getCurrentPrayer()}</h2>
          <div className="inline-flex items-center gap-2 bg-black/20 px-4 py-1.5 rounded-full text-sm font-medium border border-white/10">
            <Clock className="w-4 h-4" />
            <span>{new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      </header>

      <main className="p-4 -mt-6 relative z-20 space-y-4">
        {activeTab === 'home' ? (
          <>
            <div onClick={() => setActiveTab('create')} className="bg-white p-5 rounded-[2rem] shadow-lg flex items-center gap-4 border border-emerald-100 cursor-pointer active:scale-95 transition-transform">
              <div className="bg-emerald-600 p-3 rounded-2xl text-white shadow-md"><Plus className="w-6 h-6" /></div>
              <div className="text-right">
                <p className="font-bold text-lg text-slate-900">أعلن عن جماعة</p>
                <p className="text-xs text-slate-400">كن سبباً في جمع المصلين</p>
              </div>
            </div>
            <div className="space-y-4 pt-2">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 px-2 text-lg">
                <div className="w-1.5 h-5 bg-emerald-500 rounded-full"></div> الجماعات المتاحة
              </h3>
              {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-emerald-500" /></div>
              ) : groups.length === 0 ? (
                <div className="bg-white py-16 rounded-[2.5rem] text-center border-2 border-dashed border-slate-200 text-slate-400 px-10 font-bold">
                  لا توجد جماعات معلنة حالياً
                </div>
              ) : (
                groups.map(g => (
                  <div key={g.id} className="bg-white p-6 rounded-[2.5rem] shadow-md border border-slate-100 flex flex-col gap-4">
                    <div className="flex justify-between items-start text-right">
                      <div>
                        <div className="flex items-center gap-2">
                           <h4 className="font-bold text-xl text-emerald-900">صلاة {g.prayer}</h4>
                           {g.isSecondGroup && <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-md">جماعة ثانية</span>}
                        </div>
                        <button onClick={() => window.open(`https://www.google.com/maps?q=${g.lat},${g.lng}`)} className="flex items-center gap-1.5 text-emerald-600 text-xs font-bold bg-emerald-50 px-3 py-1 rounded-full mt-2">
                          <MapPin className="w-3 h-3" /> عرض الموقع
                        </button>
                      </div>
                      <div className="bg-slate-50 p-2 px-4 rounded-2xl text-center border border-slate-100">
                        <span className="text-[10px] text-slate-400 block font-bold">مصلين</span>
                        <span className="text-2xl font-black text-emerald-800">{g.participants}</span>
                      </div>
                    </div>
                    <button 
                      onClick={async () => {
                        if (g.joinedUsers.includes(user.uid)) return;
                        const ref = doc(db, 'artifacts', appId, 'public', 'data', 'prayerGroups', g.id);
                        await updateDoc(ref, { participants: increment(1), joinedUsers: [...g.joinedUsers, user.uid] });
                      }}
                      disabled={g.joinedUsers.includes(user.uid)}
                      className={`w-full py-4 rounded-2xl font-bold transition-all ${g.joinedUsers.includes(user.uid) ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-900 text-white active:scale-95'}`}
                    >
                      {g.joinedUsers.includes(user.uid) ? 'تم الانضمام' : 'سأصلي معكم'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        ) : activeTab === 'create' ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2" onClick={() => setActiveTab('home')}>
               <ChevronRight className="w-6 h-6 text-slate-400" />
               <h2 className="text-xl font-bold">تحديد موقع التجمع</h2>
            </div>
            <div className="bg-white p-4 rounded-[2.5rem] shadow-xl space-y-4">
              <div id="map" className="h-[300px] w-full bg-slate-100 rounded-[2rem] border-4 border-slate-50 relative overflow-hidden">
                {!mapInitialized && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="animate-spin text-emerald-600" /></div>}
              </div>
              <div onClick={() => setForm({...form, isSecondGroup: !form.isSecondGroup})} className={`p-5 rounded-2xl border-2 transition-all flex items-center gap-4 cursor-pointer ${form.isSecondGroup ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100 bg-slate-50'}`}>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${form.isSecondGroup ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-300'}`}>
                  {form.isSecondGroup && <Check className="w-4 h-4 text-white" />}
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-900 text-sm">جماعة ثانية (مصلى/منزل/مكان عام)</p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">غير رسمي</p>
                </div>
              </div>
              <button onClick={saveGroup} disabled={isPublishing} className="w-full bg-emerald-800 text-white py-5 rounded-2xl font-bold text-lg shadow-lg active:scale-95 flex items-center justify-center gap-2">
                {isPublishing ? <Loader2 className="animate-spin" /> : <><Navigation className="w-5 h-5" /> نشر الموقع الآن</>}
              </button>
            </div>
          </div>
        ) : (
          <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-4 px-10">
            <div className="bg-emerald-100 p-8 rounded-full animate-bounce"><Check className="w-16 h-16 text-emerald-600" strokeWidth={3} /></div>
            <h2 className="text-3xl font-black text-emerald-900">تم النشر!</h2>
            <p className="text-slate-500 font-medium">موقع جماعتك الآن مرئي للجميع</p>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 inset-x-0 bg-white/80 backdrop-blur-lg border-t border-slate-100 p-4 px-12 flex justify-between items-center z-50 rounded-t-[2.5rem] shadow-2xl">
        <div onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1 cursor-pointer ${activeTab === 'home' ? 'text-emerald-700' : 'text-slate-300'}`}>
          <MapPin className="w-6 h-6" /><span className="text-[10px] font-bold">الرئيسية</span>
        </div>
        <div onClick={() => setActiveTab('create')} className="bg-emerald-800 p-4 rounded-2xl -mt-12 shadow-xl border-4 border-slate-50 text-white active:scale-90 transition-transform cursor-pointer">
          <Plus className="w-8 h-8" />
        </div>
        <div className="flex flex-col items-center gap-1 opacity-30 text-slate-300">
          <Users className="w-6 h-6" /><span className="text-[10px] font-bold">الأصدقاء</span>
        </div>
      </nav>
    </div>
  );
};

export default App;
