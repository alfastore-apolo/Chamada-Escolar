// ============================================================
//  CHAMADA ESCOLAR — App.jsx
//  Firebase Firestore (tempo real) + Offline/Online + Reset meia-noite
// ============================================================
//
//  DEPENDÊNCIAS (package.json / CDN):
//    react, react-dom, recharts
//    firebase (npm i firebase)
//
//  SUBSTITUA as credenciais abaixo pelas suas do Firebase Console
// ============================================================

import { useState, useEffect, useCallback, useRef } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore, doc, setDoc, getDoc, onSnapshot,
  enableIndexedDbPersistence
} from "firebase/firestore";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend, LineChart, Line,
} from "recharts";

// ─────────────────────────────────────────────────────────────
//  🔥 CONFIGURAÇÃO FIREBASE  ← troque pelos seus dados
// ─────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "SUA_API_KEY",
  authDomain:        "SEU_PROJETO.firebaseapp.com",
  projectId:         "SEU_PROJETO",
  storageBucket:     "SEU_PROJETO.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId:             "SEU_APP_ID",
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// Habilita persistência offline (IndexedDB automático do Firebase)
enableIndexedDbPersistence(db).catch(() => {
  // Pode falhar em múltiplas abas — comportamento normal
  console.warn("Persistência offline não pôde ser habilitada nesta aba.");
});

// ─────────────────────────────────────────────────────────────
//  DEFAULTS
// ─────────────────────────────────────────────────────────────
const DEFAULT_GRUPOS = [
  {
    id: "fundamental", label: "Ensino Fundamental", emoji: "📚",
    cor: { header: "#ea580c", light: "#fff7ed", pale: "#ffedd5" },
    turmas: [
      { id: "8ano1", label: "8º Ano 1" }, { id: "9ano1", label: "9º Ano 1" },
      { id: "9ano2", label: "9º Ano 2" }, { id: "9ano3", label: "9º Ano 3" },
      { id: "9ano4", label: "9º Ano 4" },
    ],
  },
  {
    id: "serie1", label: "1ª Série — Médio", emoji: "🔵",
    cor: { header: "#2563eb", light: "#eff6ff", pale: "#dbeafe" },
    turmas: [
      { id: "1serie1", label: "1ª Série 1" }, { id: "1serie2", label: "1ª Série 2" },
      { id: "1serie3", label: "1ª Série 3" }, { id: "1serie4", label: "1ª Série 4" },
      { id: "1serie5", label: "1ª Série 5" }, { id: "1serie6", label: "1ª Série 6" },
      { id: "1serie7", label: "1ª Série 7" }, { id: "1serie8", label: "1ª Série 8" },
      { id: "1serie9", label: "1ª Série 9" },
    ],
  },
  {
    id: "serie2", label: "2ª Série — Médio", emoji: "🟣",
    cor: { header: "#7c3aed", light: "#faf5ff", pale: "#ede9fe" },
    turmas: [
      { id: "2serie1", label: "2ª Série 1" }, { id: "2serie2", label: "2ª Série 2" },
      { id: "2serie3", label: "2ª Série 3" }, { id: "2serie4", label: "2ª Série 4" },
      { id: "2serie5", label: "2ª Série 5" },
    ],
  },
  {
    id: "serie3", label: "3ª Série — Médio", emoji: "🟢",
    cor: { header: "#16a34a", light: "#f0fdf4", pale: "#dcfce7" },
    turmas: [
      { id: "3serie1", label: "3ª Série 1" }, { id: "3serie2", label: "3ª Série 2" },
      { id: "3serie3", label: "3ª Série 3" },
    ],
  },
];

const EMOJI_OPTIONS = ["📚","🔵","🟣","🟢","🔴","🟡","🟠","⚪","🎓","📖","✏️","🏫"];
const COR_OPTIONS = [
  { header: "#ea580c", light: "#fff7ed", pale: "#ffedd5", name: "Laranja" },
  { header: "#2563eb", light: "#eff6ff", pale: "#dbeafe", name: "Azul" },
  { header: "#7c3aed", light: "#faf5ff", pale: "#ede9fe", name: "Roxo" },
  { header: "#16a34a", light: "#f0fdf4", pale: "#dcfce7", name: "Verde" },
  { header: "#dc2626", light: "#fef2f2", pale: "#fecaca", name: "Vermelho" },
  { header: "#0891b2", light: "#ecfeff", pale: "#cffafe", name: "Ciano" },
  { header: "#d97706", light: "#fffbeb", pale: "#fef3c7", name: "Âmbar" },
  { header: "#db2777", light: "#fdf2f8", pale: "#fce7f3", name: "Rosa" },
];

// ─────────────────────────────────────────────────────────────
//  SENHAS (SHA-256) — admin: "admin123" | viewer: "viewer123"
//  Troque os hashes abaixo para suas senhas reais
// ─────────────────────────────────────────────────────────────
const HASH_ADMIN  = "a6c2221569febb76282953aabf85f648511cbe327a8b20580e6029998184cdeb";
const HASH_VIEWER = "d99903054b52823a734825b7ca7b6d620faec835ba1d9960ff1330ecc3235c45";

const sha256 = async (text) => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
};

// ─────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────
const uid      = () => Math.random().toString(36).slice(2, 8);
const todayStr = () => new Date().toISOString().slice(0, 10);
const yesterdayStr = () => new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const fmtDate  = (d) => new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const fmtDateFull = (d) => new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });

function buildDefault(grupos) {
  const o = {};
  grupos.forEach(g => g.turmas.forEach(t => { o[t.id] = { p: 0, f: 0 }; }));
  return o;
}

// ─────────────────────────────────────────────────────────────
//  FIREBASE HELPERS
//  Todos os dados ficam em:  escola/{schoolId}/...
//  Para múltiplas escolas basta mudar SCHOOL_ID
// ─────────────────────────────────────────────────────────────
const SCHOOL_ID = "ceti-dariana"; // identificador único da escola

const fbGet = async (path) => {
  try {
    const snap = await getDoc(doc(db, path));
    return snap.exists() ? snap.data().value : null;
  } catch { return null; }
};

const fbSet = async (path, value) => {
  try {
    await setDoc(doc(db, path), { value }, { merge: false });
  } catch (e) {
    // Se estiver offline, o Firebase armazena localmente e sincroniza depois
    console.warn("fbSet pendente (offline):", path, e.message);
  }
};

// ─────────────────────────────────────────────────────────────
//  CAMINHOS NO FIRESTORE
// ─────────────────────────────────────────────────────────────
const FK = {
  config:  `escolas/${SCHOOL_ID}/config/grupos`,
  escola:  `escolas/${SCHOOL_ID}/config/escola`,
  history: `escolas/${SCHOOL_ID}/historico/dados`,
  today:   (d) => `escolas/${SCHOOL_ID}/dias/${d}`,
};

// ─────────────────────────────────────────────────────────────
//  COMPONENTES AUXILIARES
// ─────────────────────────────────────────────────────────────
function Counter({ value, onChange, color, pale }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <button
        onClick={(e) => { e.stopPropagation(); onChange(Math.max(0, value - 1)); }}
        style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: "#f1f5f9", color: "#64748b", fontSize: 20, fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}>−</button>
      <span style={{ fontSize: 26, fontWeight: 900, color, minWidth: 36, textAlign: "center", fontFamily: "'Nunito',sans-serif" }}>{value}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onChange(value + 1); }}
        style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: pale, color, fontSize: 20, fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}>+</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  INDICADOR OFFLINE / ONLINE
// ─────────────────────────────────────────────────────────────
function OfflineBanner({ isOnline }) {
  if (isOnline) return null;
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
      background: "#f59e0b", color: "#1e293b",
      textAlign: "center", padding: "8px 16px",
      fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 13,
    }}>
      📴 Sem conexão — dados salvos localmente e sincronizarão ao reconectar
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  APP PRINCIPAL
// ─────────────────────────────────────────────────────────────
export default function App() {
  const [grupos, setGrupos]           = useState(DEFAULT_GRUPOS);
  const [dados, setDados]             = useState(() => buildDefault(DEFAULT_GRUPOS));
  const [date, setDate]               = useState(todayStr());
  const [syncing, setSyncing]         = useState(false);
  const [lastSync, setLastSync]       = useState(null);
  const [expandedGrupo, setExpandedGrupo] = useState(null);
  const [history, setHistory]         = useState({});
  const [nomeEscola, setNomeEscola]   = useState("CETI Dariana");
  const [isOnline, setIsOnline]       = useState(navigator.onLine);

  // Admin
  const [showLogin, setShowLogin]     = useState(false);
  const [adminLogado, setAdminLogado] = useState(false);
  const [senhaInput, setSenhaInput]   = useState("");
  const [senhaErro, setSenhaErro]     = useState(false);
  const [adminTab, setAdminTab]       = useState("resumo");
  const [showAdmin, setShowAdmin]     = useState(false);
  const dblRef = useRef(null);

  // Viewer
  const [showViewerLogin, setShowViewerLogin] = useState(false);
  const [viewerLogado, setViewerLogado]       = useState(false);
  const [viewerSenhaInput, setViewerSenhaInput] = useState("");
  const [viewerSenhaErro, setViewerSenhaErro]   = useState(false);
  const [viewerTab, setViewerTab]               = useState("resumo");
  const [showViewer, setShowViewer]             = useState(false);
  const dblRefViewer = useRef(null);

  // Editor state
  const [editingTurmaId, setEditingTurmaId] = useState(null);

  const dadosRef  = useRef(dados);  dadosRef.current  = dados;
  const gruposRef = useRef(grupos); gruposRef.current = grupos;
  const midnightFiredRef = useRef(false);

  // ── 1. Online/Offline detector ──────────────────────────────
  useEffect(() => {
    const goOnline  = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online",  goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online",  goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // ── 2. Carregar config + histórico ao montar ─────────────────
  useEffect(() => {
    (async () => {
      const cfg   = await fbGet(FK.config);
      if (cfg)    setGrupos(cfg);
      const hist  = await fbGet(FK.history);
      if (hist)   setHistory(hist);
      const escola = await fbGet(FK.escola);
      if (escola) setNomeEscola(escola);
    })();
  }, []);

  // ── 3. Escuta em TEMPO REAL os dados do dia atual ────────────
  //       onSnapshot dispara para TODOS os professores conectados
  useEffect(() => {
    const ref = doc(db, FK.today(date));
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const remote = snap.data().value;
        if (JSON.stringify(remote) !== JSON.stringify(dadosRef.current)) {
          setDados(remote);
        }
        setLastSync(new Date());
        setSyncing(false);
      } else {
        // Nenhum dado para este dia → zera
        setDados(buildDefault(gruposRef.current));
        setLastSync(new Date());
      }
    }, (err) => {
      // Erro de rede: Firebase usa cache local automaticamente
      console.warn("onSnapshot error (provavelmente offline):", err.message);
    });
    return () => unsub();
  }, [date]);

  // ── 4. Reset à meia-noite ────────────────────────────────────
  //
  //  COMO FUNCIONA:
  //  a) Ao abrir o app: arquiva ontem se necessário e garante data = hoje
  //  b) Enquanto aberto: verifica a cada 5s se virou meia-noite
  //     → arquiva o dia que acabou no histórico
  //     → grava dados zerados para o novo dia (todos veem o reset)
  //
  useEffect(() => {
    // Ao abrir: garante que ontem foi arquivado
    (async () => {
      const today     = todayStr();
      const yesterday = yesterdayStr();
      const old       = await fbGet(FK.today(yesterday));
      if (old) {
        const hist = await fbGet(FK.history) || {};
        if (!hist[yesterday]) {
          hist[yesterday] = old;
          await fbSet(FK.history, hist);
          setHistory(hist);
        }
      }
      setDate(today);
    })();
  }, []);

  useEffect(() => {
    const checkMidnight = async () => {
      const now = new Date();
      const isExactlyMidnight = now.getHours() === 0 && now.getMinutes() === 0 && now.getSeconds() < 10;

      if (isExactlyMidnight) {
        if (midnightFiredRef.current) return; // já executou neste minuto
        midnightFiredRef.current = true;

        // 1. Arquiva o dia que acabou
        const yesterday = yesterdayStr();
        const old = await fbGet(FK.today(yesterday));
        if (old) {
          const hist = await fbGet(FK.history) || {};
          if (!hist[yesterday]) {
            hist[yesterday] = old;
            await fbSet(FK.history, hist);      // salva no Firestore
            setHistory(hist);
          }
        }

        // 2. Zera os contadores do novo dia e grava no Firestore
        //    → Todos os professores verão o zero instantaneamente via onSnapshot
        const newDados = buildDefault(gruposRef.current);
        await fbSet(FK.today(todayStr()), newDados);  // ← dispara onSnapshot em todos
        setDate(todayStr());

      } else {
        midnightFiredRef.current = false; // reseta para o próximo dia
      }
    };

    const iv = setInterval(checkMidnight, 5000);
    return () => clearInterval(iv);
  }, []);

  // ── 5. Salvar dados (dispara onSnapshot em todos) ────────────
  const saveData = useCallback(async (data) => {
    setSyncing(true);
    await fbSet(FK.today(date), data);
    // setSyncing(false) será chamado pelo próprio onSnapshot ao receber a atualização
  }, [date]);

  const saveGrupos = useCallback(async (g) => {
    setGrupos(g);
    await fbSet(FK.config, g);
  }, []);

  const update = useCallback(async (id, field, val) => {
    const next = { ...dadosRef.current, [id]: { ...dadosRef.current[id], [field]: val } };
    setDados(next);
    await saveData(next);
  }, [saveData]);

  // ── Totais ───────────────────────────────────────────────────
  const totalP = Object.values(dados).reduce((s, v) => s + (v?.p || 0), 0);
  const totalF = Object.values(dados).reduce((s, v) => s + (v?.f || 0), 0);

  // ── Admin login ──────────────────────────────────────────────
  const handleAdminZone = () => {
    if (dblRef.current) {
      clearTimeout(dblRef.current); dblRef.current = null;
      adminLogado
        ? setShowAdmin(true)
        : (() => { setSenhaInput(""); setSenhaErro(false); setShowLogin(true); })();
    } else {
      dblRef.current = setTimeout(() => { dblRef.current = null; }, 400);
    }
  };
  const handleLogin = async () => {
    const h = await sha256(senhaInput);
    if (h === HASH_ADMIN) { setAdminLogado(true); setShowLogin(false); setShowAdmin(true); setSenhaErro(false); }
    else { setSenhaErro(true); setSenhaInput(""); }
  };
  const handleLogout = () => { setAdminLogado(false); setShowAdmin(false); };

  // ── Viewer login ─────────────────────────────────────────────
  const handleViewerZone = () => {
    if (dblRefViewer.current) {
      clearTimeout(dblRefViewer.current); dblRefViewer.current = null;
      viewerLogado
        ? setShowViewer(true)
        : (() => { setViewerSenhaInput(""); setViewerSenhaErro(false); setShowViewerLogin(true); })();
    } else {
      dblRefViewer.current = setTimeout(() => { dblRefViewer.current = null; }, 400);
    }
  };
  const handleViewerLogin = async () => {
    const h = await sha256(viewerSenhaInput);
    if (h === HASH_VIEWER) { setViewerLogado(true); setShowViewerLogin(false); setShowViewer(true); setViewerSenhaErro(false); }
    else { setViewerSenhaErro(true); setViewerSenhaInput(""); }
  };
  const handleViewerLogout = () => { setViewerLogado(false); setShowViewer(false); };

  // ── Grupo editors ────────────────────────────────────────────
  const addGrupo = () => {
    const id = "g_" + uid();
    const novo = { id, label: "Novo Grupo", emoji: "📚", cor: COR_OPTIONS[0], turmas: [] };
    saveGrupos([...gruposRef.current, novo]);
  };
  const deleteGrupo = (gid) => {
    if (!window.confirm("Excluir este grupo e todas as suas turmas?")) return;
    saveGrupos(gruposRef.current.filter(g => g.id !== gid));
  };
  const updateGrupo = (gid, patch) => {
    saveGrupos(gruposRef.current.map(g => g.id === gid ? { ...g, ...patch } : g));
  };
  const addTurma = (gid) => {
    const id = "t_" + uid();
    saveGrupos(gruposRef.current.map(g => g.id === gid ? { ...g, turmas: [...g.turmas, { id, label: "Nova Turma" }] } : g));
    setEditingTurmaId(id);
  };
  const deleteTurma = (gid, tid) => {
    if (!window.confirm("Excluir esta turma?")) return;
    saveGrupos(gruposRef.current.map(g => g.id === gid ? { ...g, turmas: g.turmas.filter(t => t.id !== tid) } : g));
  };
  const updateTurma = (gid, tid, label) => {
    saveGrupos(gruposRef.current.map(g => g.id === gid
      ? { ...g, turmas: g.turmas.map(t => t.id === tid ? { ...t, label } : t) }
      : g));
  };

  // ── Histórico / gráficos ─────────────────────────────────────
  const histDays = Object.keys(history).sort();
  const last7    = histDays.slice(-7);
  const last30   = histDays.slice(-30);

  const chartData7 = last7.map(d => {
    const dh = history[d] || {};
    return { dia: fmtDate(d), Presentes: Object.values(dh).reduce((s, v) => s + (v?.p || 0), 0), Faltosos: Object.values(dh).reduce((s, v) => s + (v?.f || 0), 0) };
  });
  const chartData30 = last30.map(d => {
    const dh = history[d] || {};
    return { dia: fmtDate(d), Presentes: Object.values(dh).reduce((s, v) => s + (v?.p || 0), 0), Faltosos: Object.values(dh).reduce((s, v) => s + (v?.f || 0), 0) };
  });
  const chartDataHoje = [{ dia: fmtDate(date), Presentes: totalP, Faltosos: totalF }];

  const weeklyMap = {};
  histDays.forEach(d => {
    const dt = new Date(d + "T12:00:00");
    const weekNum = Math.ceil(dt.getDate() / 7);
    const key = `Sem ${weekNum}/${dt.toLocaleDateString("pt-BR", { month: "short" })}`;
    const dh = history[d] || {};
    const p = Object.values(dh).reduce((s, v) => s + (v?.p || 0), 0);
    const f = Object.values(dh).reduce((s, v) => s + (v?.f || 0), 0);
    if (!weeklyMap[key]) weeklyMap[key] = { p: [], f: [], order: d };
    weeklyMap[key].p.push(p);
    weeklyMap[key].f.push(f);
  });
  const chartWeek = Object.entries(weeklyMap)
    .sort((a, b) => a[1].order.localeCompare(b[1].order))
    .map(([w, v]) => ({
      dia: w,
      Presentes: Math.round(v.p.reduce((a, b) => a + b, 0) / v.p.length),
      Faltosos:  Math.round(v.f.reduce((a, b) => a + b, 0) / v.f.length),
    }));

  const anoAtual = new Date().getFullYear();
  const MESES_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const monthlyMapAnual = {};
  MESES_PT.forEach((m) => { monthlyMapAnual[m] = { p: [], f: [] }; });
  histDays.forEach(d => {
    const dt = new Date(d + "T12:00:00");
    if (dt.getFullYear() !== anoAtual) return;
    const mes = MESES_PT[dt.getMonth()];
    const dh  = history[d] || {};
    monthlyMapAnual[mes].p.push(Object.values(dh).reduce((s, v) => s + (v?.p || 0), 0));
    monthlyMapAnual[mes].f.push(Object.values(dh).reduce((s, v) => s + (v?.f || 0), 0));
  });
  const chartMonth = MESES_PT.map(m => ({
    dia: m,
    Presentes: monthlyMapAnual[m].p.length > 0 ? Math.round(monthlyMapAnual[m].p.reduce((a, b) => a + b, 0) / monthlyMapAnual[m].p.length) : 0,
    Faltosos:  monthlyMapAnual[m].f.length > 0 ? Math.round(monthlyMapAnual[m].f.reduce((a, b) => a + b, 0) / monthlyMapAnual[m].f.length) : 0,
    temDados:  monthlyMapAnual[m].p.length > 0,
  }));

  // ── Print ────────────────────────────────────────────────────
  const printReport = (period, chartData, histData) => {
    const rows = grupos.map(g => {
      const gp = g.turmas.reduce((s, t) => s + (dados[t.id]?.p || 0), 0);
      const gf = g.turmas.reduce((s, t) => s + (dados[t.id]?.f || 0), 0);
      return `<tr><td>${g.emoji} ${g.label}</td><td style="color:#16a34a;font-weight:800;text-align:center">${gp}</td><td style="color:#dc2626;text-align:center">${gf}</td></tr>`;
    }).join("");
    const turmaRows = grupos.flatMap(g => g.turmas.map(t => {
      const p = dados[t.id]?.p || 0; const f = dados[t.id]?.f || 0;
      return `<tr><td style="padding-left:24px">${t.label}</td><td style="color:#16a34a;font-weight:700;text-align:center">${p}</td><td style="color:#dc2626;text-align:center">${f}</td></tr>`;
    })).join("");
    const histRows = (histData || chartData).map(d =>
      `<tr><td>${d.dia}</td><td style="color:#16a34a;font-weight:700;text-align:center">${d.Presentes}</td><td style="color:#dc2626;text-align:center">${d.Faltosos}</td></tr>`
    ).join("");
    const w = window.open("", "_blank");
    w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório Chamada</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800;900&display=swap');
      body{font-family:'Nunito',Arial,sans-serif;margin:0;padding:32px 40px;color:#1e293b;background:#f8fafc}
      .header{background:linear-gradient(135deg,#1e293b,#334155);color:white;border-radius:16px;padding:24px 28px;margin-bottom:28px}
      .header h1{font-size:22px;font-weight:900;margin:0 0 4px}
      .header p{margin:0;font-size:13px;color:#94a3b8}
      .summary{display:flex;gap:16px;margin-bottom:28px}
      .card{flex:1;border-radius:12px;padding:16px;text-align:center}
      .card-p{background:#f0fdf4;border:2px solid #bbf7d0}
      .card-f{background:#fef2f2;border:2px solid #fecaca}
      .card-big{font-size:36px;font-weight:900;line-height:1}
      h3{font-size:14px;font-weight:800;color:#334155;margin:20px 0 8px;border-bottom:2px solid #e2e8f0;padding-bottom:6px;text-transform:uppercase;letter-spacing:.5px}
      table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:4px}
      th{background:#f1f5f9;padding:8px 14px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#64748b;font-weight:800}
      td{padding:9px 14px;border-bottom:1px solid #f1f5f9}
      tr:hover{background:#fafafa}
      .footer{margin-top:32px;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:16px}
      .no-print{display:inline-flex;align-items:center;gap:8px;margin-top:16px;padding:10px 24px;background:#1e293b;color:white;border:none;border-radius:10px;font-size:14px;font-family:inherit;cursor:pointer;font-weight:800}
      @media print{.no-print{display:none}body{padding:20px;background:white}.header{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
    </style>
    </head><body>
    <div class="header">
      <h1>📋 Relatório de Chamada Escolar</h1>
      <p>Período: <strong>${period}</strong> · Gerado em ${new Date().toLocaleString("pt-BR")}</p>
    </div>
    <div class="summary">
      <div class="card card-p"><div class="card-big" style="color:#16a34a">✅ ${totalP}</div><div style="font-size:12px;font-weight:800;color:#16a34a;margin-top:4px">PRESENTES HOJE</div></div>
      <div class="card card-f"><div class="card-big" style="color:#dc2626">❌ ${totalF}</div><div style="font-size:12px;font-weight:800;color:#dc2626;margin-top:4px">FALTOSOS HOJE</div></div>
    </div>
    <h3>Por Grupo</h3><table><thead><tr><th>Grupo</th><th style="text-align:center">Presentes</th><th style="text-align:center">Faltosos</th></tr></thead><tbody>${rows}</tbody></table>
    <h3>Por Turma</h3><table><thead><tr><th>Turma</th><th style="text-align:center">Presentes</th><th style="text-align:center">Faltosos</th></tr></thead><tbody>${turmaRows}</tbody></table>
    ${(histData || chartData).length ? `<h3>Histórico (${period})</h3><table><thead><tr><th>Período</th><th style="text-align:center">Presentes</th><th style="text-align:center">Faltosos</th></tr></thead><tbody>${histRows}</tbody></table>` : ""}
    <div class="footer">Relatório gerado automaticamente pelo sistema de chamada escolar.</div>
    <button class="no-print" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
    </body></html>`);
    w.document.close();
  };

  // ── RENDER ───────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'Nunito',sans-serif", background: "#f8fafc", minHeight: "100vh", paddingBottom: 80, paddingTop: isOnline ? 0 : 40 }}>
      <OfflineBanner isOnline={isOnline} />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        button{font-family:'Nunito',sans-serif}
        button:active{transform:scale(0.92)}
        .overlay{position:fixed;inset:0;background:rgba(0,0,0,0.52);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px}
        .modal{background:white;border-radius:24px;padding:28px 24px;width:100%;max-width:340px;animation:popIn .2s cubic-bezier(.32,1.5,.6,1)}
        @keyframes popIn{from{transform:scale(.85);opacity:0}to{transform:scale(1);opacity:1}}
        .sheet-wrap{position:fixed;inset:0;background:rgba(0,0,0,0.52);z-index:200;display:flex;align-items:flex-end;justify-content:center}
        .sheet{background:white;border-radius:28px 28px 0 0;width:100%;max-width:520px;max-height:92vh;overflow-y:auto;animation:slideUp .25s cubic-bezier(.32,1.5,.6,1)}
        @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        .input-field{width:100%;border:2px solid #e2e8f0;border-radius:12px;padding:10px 14px;font-size:14px;font-family:'Nunito',sans-serif;outline:none;transition:border .2s}
        .input-field:focus{border-color:#334155}
        .input-senha{width:100%;border:2px solid #e2e8f0;border-radius:12px;padding:12px 16px;font-size:16px;font-family:'Nunito',sans-serif;outline:none;text-align:center;letter-spacing:2px;transition:border .2s}
        .input-senha:focus{border-color:#334155}
        .input-senha.erro{border-color:#dc2626;animation:shake .3s}
        @keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
        .admin-tab{padding:8px 10px;border-radius:99px;border:none;font-weight:800;font-size:12px;cursor:pointer;transition:all .15s}
        .btn-icon{width:32px;height:32px;border-radius:8px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:15px;transition:all .15s;flex-shrink:0}
        .btn-icon:hover{filter:brightness(0.9)}
        .pulse{animation:livePulse 1.5s infinite}
        @keyframes livePulse{0%,100%{opacity:1}50%{opacity:.4}}
        .row-sep{border-bottom:1px solid #f1f5f9}
        .turma-row{display:flex;align-items:center;gap:6px;transition:background .15s;border-radius:10px;padding:3px 4px}
        .turma-row:hover{background:#f1f5f9}
        .grupo-card{border-radius:18px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.08)}
        .chart-section{background:#f8fafc;border-radius:14px;padding:12px 4px 4px;margin-bottom:20px}
        .print-btn{width:100%;border:none;border-radius:14px;padding:13px;font-size:14px;font-weight:800;cursor:pointer;transition:all .15s}
        .print-btn:hover{filter:brightness(0.9);transform:translateY(-1px)}
        .section-title{font-weight:800;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px}
        .add-btn{display:flex;align-items:center;gap:6px;background:#f0f9ff;color:#0369a1;border:2px dashed #7dd3fc;border-radius:10px;padding:7px 12px;font-weight:800;font-size:13px;cursor:pointer;transition:all .15s;font-family:'Nunito',sans-serif}
        .add-btn:hover{background:#e0f2fe}
        .del-btn{background:#fef2f2;color:#dc2626;border:none;border-radius:8px;padding:5px 10px;font-size:12px;font-weight:800;cursor:pointer;transition:all .15s;font-family:'Nunito',sans-serif;white-space:nowrap}
        .del-btn:hover{background:#fee2e2}
      `}</style>

      {/* ── Header ── */}
      <div style={{ background: "linear-gradient(160deg,#0f172a 0%,#1e3a5f 60%,#1e40af 100%)", borderRadius: "0 0 30px 30px", padding: "22px 18px 26px", boxShadow: "0 8px 32px rgba(15,23,42,.28)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
              <div style={{ width: 3, height: 18, background: "linear-gradient(180deg,#38bdf8,#818cf8)", borderRadius: 4 }} />
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: "white", letterSpacing: 2, textTransform: "uppercase" }}>Chamada Escolar</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#94a3b8", marginTop: 1 }}>{nomeEscola}</div>
              </div>
            </div>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.15)", borderRadius: 10, color: "white", fontSize: 15, fontWeight: 800, fontFamily: "'Nunito',sans-serif", outline: "none", padding: "5px 12px", letterSpacing: .3 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            {/* Status sincronização */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: syncing ? "rgba(250,204,21,.12)" : "rgba(34,197,94,.12)", border: `1px solid ${syncing ? "rgba(250,204,21,.3)" : "rgba(34,197,94,.3)"}`, borderRadius: 20, padding: "5px 11px", fontSize: 10, fontWeight: 800, color: syncing ? "#fde68a" : "#4ade80", letterSpacing: .5 }}>
              <div className={syncing ? "pulse" : ""} style={{ width: 6, height: 6, borderRadius: "50%", background: syncing ? "#facc15" : "#4ade80", flexShrink: 0 }} />
              {syncing ? "Salvando..." : lastSync ? `Ao vivo · ${lastSync.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "Conectando..."}
            </div>
            {/* Status online/offline */}
            <div style={{ display: "flex", alignItems: "center", gap: 5, background: isOnline ? "rgba(34,197,94,.1)" : "rgba(245,158,11,.15)", border: `1px solid ${isOnline ? "rgba(34,197,94,.2)" : "rgba(245,158,11,.4)"}`, borderRadius: 20, padding: "4px 10px", fontSize: 10, fontWeight: 800, color: isOnline ? "#4ade80" : "#fbbf24" }}>
              {isOnline ? "🟢 Online" : "🟡 Offline"}
            </div>
          </div>
        </div>

        {/* Cards totais */}
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.10)", borderRadius: 20, padding: "16px 14px 14px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -18, right: -18, width: 72, height: 72, borderRadius: "50%", background: "rgba(34,197,94,.18)" }} />
            <div style={{ fontSize: 9, fontWeight: 800, color: "#4ade80", letterSpacing: 1.8, textTransform: "uppercase", marginBottom: 6 }}>✅ Presentes</div>
            <div style={{ fontSize: 50, fontWeight: 900, color: "white", lineHeight: 1, letterSpacing: -1 }}>{totalP}</div>
            <div style={{ fontSize: 10, color: "#64748b", marginTop: 5, fontWeight: 600 }}>alunos na escola</div>
            <div style={{ marginTop: 10, height: 3, borderRadius: 3, background: "rgba(255,255,255,.08)" }}>
              {(totalP + totalF) > 0 && <div style={{ height: 3, borderRadius: 3, width: `${Math.round(totalP / (totalP + totalF) * 100)}%`, background: "linear-gradient(90deg,#22c55e,#4ade80)" }} />}
            </div>
            {(totalP + totalF) > 0 && <div style={{ fontSize: 9, color: "#4ade80", fontWeight: 800, marginTop: 4 }}>{Math.round(totalP / (totalP + totalF) * 100)}% de presença</div>}
          </div>
          <div style={{ flex: 1, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.10)", borderRadius: 20, padding: "16px 14px 14px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -18, right: -18, width: 72, height: 72, borderRadius: "50%", background: "rgba(239,68,68,.15)" }} />
            <div style={{ fontSize: 9, fontWeight: 800, color: "#f87171", letterSpacing: 1.8, textTransform: "uppercase", marginBottom: 6 }}>❌ Faltosos</div>
            <div style={{ fontSize: 50, fontWeight: 900, color: "white", lineHeight: 1, letterSpacing: -1 }}>{totalF}</div>
            <div style={{ fontSize: 10, color: "#64748b", marginTop: 5, fontWeight: 600 }}>ausências hoje</div>
            <div style={{ marginTop: 10, height: 3, borderRadius: 3, background: "rgba(255,255,255,.08)" }}>
              {(totalP + totalF) > 0 && <div style={{ height: 3, borderRadius: 3, width: `${Math.round(totalF / (totalP + totalF) * 100)}%`, background: "linear-gradient(90deg,#ef4444,#f87171)" }} />}
            </div>
            {(totalP + totalF) > 0 && <div style={{ fontSize: 9, color: "#f87171", fontWeight: 800, marginTop: 4 }}>{Math.round(totalF / (totalP + totalF) * 100)}% de ausência</div>}
          </div>
        </div>
      </div>

      {/* ── Grupos ── */}
      <div style={{ padding: "16px 12px", display: "flex", flexDirection: "column", gap: 12 }}>
        {grupos.map(grupo => {
          const { cor } = grupo;
          const gpP = grupo.turmas.reduce((s, t) => s + (dados[t.id]?.p || 0), 0);
          const gpF = grupo.turmas.reduce((s, t) => s + (dados[t.id]?.f || 0), 0);
          const open = expandedGrupo === grupo.id;
          return (
            <div key={grupo.id} className="grupo-card">
              <div onClick={() => setExpandedGrupo(open ? null : grupo.id)}
                style={{ background: cor.header, color: "white", padding: "14px 16px", cursor: "pointer", userSelect: "none" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 20 }}>{grupo.emoji}</span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>{grupo.label}</div>
                      <div style={{ fontSize: 11, opacity: .75 }}>{grupo.turmas.length} turmas</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ background: "rgba(255,255,255,.2)", borderRadius: 8, padding: "3px 10px", fontWeight: 800, fontSize: 13 }}>✅ {gpP}</span>
                    <span style={{ background: "rgba(0,0,0,.15)", borderRadius: 8, padding: "3px 10px", fontWeight: 800, fontSize: 13 }}>❌ {gpF}</span>
                    <span style={{ fontSize: 14, display: "block", transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}>⌄</span>
                  </div>
                </div>
              </div>
              {open && (
                <div style={{ background: cor.light, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
                  {grupo.turmas.map(turma => {
                    const p = dados[turma.id]?.p || 0;
                    const f = dados[turma.id]?.f || 0;
                    return (
                      <div key={turma.id} style={{ background: "white", borderRadius: 14, padding: "12px 14px", border: `2px solid ${cor.pale}`, boxShadow: "0 1px 6px rgba(0,0,0,.04)" }}>
                        <div style={{ fontWeight: 800, fontSize: 14, color: "#1e293b", marginBottom: 12 }}>{turma.label}</div>
                        <div style={{ display: "flex", gap: 10 }}>
                          <div style={{ flex: 1, background: "#f0fdf4", borderRadius: 12, padding: "10px 12px" }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", marginBottom: 8 }}>✅ Presentes</div>
                            <Counter value={p} onChange={v => update(turma.id, "p", v)} color="#16a34a" pale="#dcfce7" />
                          </div>
                          <div style={{ flex: 1, background: "#fef2f2", borderRadius: 12, padding: "10px 12px" }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", marginBottom: 8 }}>❌ Faltosos</div>
                            <Counter value={f} onChange={v => update(turma.id, "f", v)} color="#dc2626" pale="#fee2e2" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Rodapé ── */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "white", borderTop: "1px solid #f1f5f9", padding: "10px 16px 12px", textAlign: "center", zIndex: 50 }}>
        <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginBottom: 4 }}>
          Desenvolvido por <strong style={{ color: "#64748b" }}>Alfa Store</strong> — Soluções e Tecnologia
        </div>
        <button onClick={() => window.open("https://wa.me/5592994810508", "_blank")}
          style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#22c55e"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          <span style={{ fontSize: 13, fontWeight: 800, color: "#16a34a" }}>Suporte — (92) 99481-0508</span>
        </button>
      </div>

      {/* ── Admin zone ── */}
      <div onClick={handleAdminZone} style={{ position: "fixed", bottom: 0, left: 0, width: 52, height: 52, zIndex: 100, cursor: "default", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {adminLogado && <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b", opacity: .5, boxShadow: "0 0 6px #f59e0b" }} />}
      </div>
      {/* ── Viewer zone ── */}
      <div onClick={handleViewerZone} style={{ position: "fixed", bottom: 0, right: 0, width: 52, height: 52, zIndex: 100, cursor: "default", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {viewerLogado && <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#60a5fa", opacity: .5, boxShadow: "0 0 6px #60a5fa" }} />}
      </div>

      {/* ── Login Admin ── */}
      {showLogin && (
        <div className="overlay" onClick={() => setShowLogin(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🔒</div>
              <div style={{ fontWeight: 900, fontSize: 18, color: "#1e293b" }}>Área Restrita</div>
              <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>Digite a palavra-chave</div>
            </div>
            <input className={`input-senha${senhaErro ? " erro" : ""}`} type="password" placeholder="••••••••"
              value={senhaInput} onChange={e => { setSenhaInput(e.target.value); setSenhaErro(false); }}
              onKeyDown={e => e.key === "Enter" && handleLogin()} autoFocus />
            {senhaErro && <div style={{ color: "#dc2626", fontSize: 12, fontWeight: 700, textAlign: "center", marginTop: 8 }}>Palavra-chave incorreta</div>}
            <button onClick={handleLogin} style={{ marginTop: 16, width: "100%", background: "#1e293b", color: "white", border: "none", borderRadius: 14, padding: "14px", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>Entrar</button>
            <button onClick={() => setShowLogin(false)} style={{ marginTop: 8, width: "100%", background: "transparent", color: "#94a3b8", border: "none", borderRadius: 14, padding: "10px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* ── Admin Panel ── */}
      {showAdmin && (
        <div className="sheet-wrap" onClick={() => setShowAdmin(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div style={{ padding: "20px 20px 0" }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: "#e2e8f0", margin: "0 auto 18px" }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 18, color: "#1e293b" }}>⚙️ Painel Admin</div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>Acesso restrito</div>
                </div>
                <button onClick={handleLogout} style={{ background: "#fef2f2", color: "#dc2626", border: "none", borderRadius: 10, padding: "6px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Sair</button>
              </div>
              <div style={{ display: "flex", gap: 4, background: "#f1f5f9", borderRadius: 14, padding: 4, marginBottom: 20 }}>
                {[["resumo","📊 Resumo"],["editar","✏️ Editar"],["historico","📅 Histórico"]].map(([k, l]) => (
                  <button key={k} className="admin-tab" onClick={() => setAdminTab(k)}
                    style={{ flex: 1, background: adminTab === k ? "white" : "transparent", color: adminTab === k ? "#1e293b" : "#64748b", boxShadow: adminTab === k ? "0 1px 4px rgba(0,0,0,.1)" : "none" }}>{l}</button>
                ))}
              </div>
            </div>
            <div style={{ padding: "0 20px 36px" }}>
              {/* Resumo */}
              {adminTab === "resumo" && (
                <div>
                  <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                    <div style={{ flex: 1, background: "#f0fdf4", borderRadius: 14, padding: "14px", textAlign: "center" }}>
                      <div style={{ fontSize: 32, fontWeight: 900, color: "#16a34a" }}>{totalP}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#16a34a" }}>✅ Presentes</div>
                    </div>
                    <div style={{ flex: 1, background: "#fef2f2", borderRadius: 14, padding: "14px", textAlign: "center" }}>
                      <div style={{ fontSize: 32, fontWeight: 900, color: "#dc2626" }}>{totalF}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#dc2626" }}>❌ Faltosos</div>
                    </div>
                  </div>
                  {grupos.map(g => {
                    const gpP = g.turmas.reduce((s, t) => s + (dados[t.id]?.p || 0), 0);
                    const gpF = g.turmas.reduce((s, t) => s + (dados[t.id]?.f || 0), 0);
                    return (
                      <div key={g.id} className="row-sep" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0" }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>{g.emoji} {g.label}</span>
                        <div style={{ display: "flex", gap: 8 }}>
                          <span style={{ background: "#f0fdf4", color: "#16a34a", borderRadius: 8, padding: "3px 10px", fontWeight: 800, fontSize: 13 }}>✅ {gpP}</span>
                          <span style={{ background: "#fef2f2", color: "#dc2626", borderRadius: 8, padding: "3px 10px", fontWeight: 800, fontSize: 13 }}>❌ {gpF}</span>
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ marginTop: 20 }}>
                    <button className="print-btn" onClick={() => printReport("Hoje · " + fmtDateFull(date), [], [])}
                      style={{ background: "#1e293b", color: "white" }}>🖨️ Imprimir Relatório do Dia</button>
                  </div>
                </div>
              )}

              {/* Editar */}
              {adminTab === "editar" && (
                <div>
                  <div style={{ background: "#f0f9ff", border: "1.5px solid #bae6fd", borderRadius: 14, padding: "14px", marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#0369a1", textTransform: "uppercase", letterSpacing: .5, marginBottom: 8 }}>🏫 Nome da Escola</div>
                    <input className="input-field" value={nomeEscola}
                      onChange={e => setNomeEscola(e.target.value)}
                      onBlur={async () => { await fbSet(FK.escola, nomeEscola); }}
                      placeholder="Ex: CETI Dariana"
                      style={{ fontSize: 15, fontWeight: 800, color: "#0c4a6e" }} />
                    <div style={{ fontSize: 10, color: "#7dd3fc", marginTop: 6 }}>Salvo automaticamente ao sair do campo</div>
                  </div>
                  {grupos.map(grupo => (
                    <div key={grupo.id} style={{ background: "#f8fafc", borderRadius: 16, padding: 14, marginBottom: 12, border: "1px solid #e2e8f0" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <select value={grupo.emoji} onChange={e => updateGrupo(grupo.id, { emoji: e.target.value })}
                          style={{ border: "2px solid #e2e8f0", borderRadius: 8, padding: "4px 6px", fontSize: 18, background: "white", cursor: "pointer", flexShrink: 0 }}>
                          {EMOJI_OPTIONS.map(em => <option key={em} value={em}>{em}</option>)}
                        </select>
                        <input className="input-field" value={grupo.label}
                          onChange={e => updateGrupo(grupo.id, { label: e.target.value })}
                          placeholder="Nome do grupo" style={{ flex: 1, fontSize: 14, fontWeight: 800 }} />
                        <button className="btn-icon del-btn" onClick={() => deleteGrupo(grupo.id)}
                          style={{ background: "#fef2f2", color: "#dc2626", width: "auto", padding: "0 10px" }}>🗑️</button>
                      </div>
                      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginRight: 2 }}>Cor:</span>
                        {COR_OPTIONS.map(c => (
                          <div key={c.name} onClick={() => updateGrupo(grupo.id, { cor: c })}
                            style={{ width: 22, height: 22, borderRadius: "50%", background: c.header, cursor: "pointer", border: grupo.cor.header === c.header ? "3px solid #1e293b" : "3px solid transparent", transition: "border .15s" }} title={c.name} />
                        ))}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: .5, marginBottom: 6 }}>
                        Turmas ({grupo.turmas.length})
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        {grupo.turmas.map(turma => (
                          <div key={turma.id} className="turma-row">
                            <input className="input-field" value={turma.label}
                              onChange={e => updateTurma(grupo.id, turma.id, e.target.value)}
                              style={{ flex: 1, fontSize: 13, padding: "7px 12px" }}
                              autoFocus={turma.id === editingTurmaId}
                              onFocus={() => setEditingTurmaId(turma.id)} />
                            <button className="btn-icon" onClick={() => deleteTurma(grupo.id, turma.id)}
                              style={{ background: "#fef2f2", color: "#dc2626", flexShrink: 0 }}>✕</button>
                          </div>
                        ))}
                      </div>
                      <button className="add-btn" onClick={() => addTurma(grupo.id)}
                        style={{ marginTop: 10, width: "100%", justifyContent: "center", background: grupo.cor.pale, color: grupo.cor.header, border: `1.5px dashed ${grupo.cor.header}` }}>
                        ➕ Adicionar Turma
                      </button>
                    </div>
                  ))}
                  <button onClick={addGrupo}
                    style={{ width: "100%", background: "#f1f5f9", color: "#334155", border: "2px dashed #cbd5e1", borderRadius: 14, padding: "14px", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "'Nunito',sans-serif" }}>
                    ➕ Adicionar Grupo
                  </button>
                </div>
              )}

              {/* Histórico admin */}
              {adminTab === "historico" && (
                <div>
                  {histDays.length === 0 ? (
                    <div style={{ textAlign: "center", color: "#94a3b8", padding: "40px 0", fontSize: 14 }}>
                      <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
                      Nenhum histórico ainda.<br />Os dados são arquivados automaticamente à meia-noite.
                    </div>
                  ) : (
                    <>
                      <div className="section-title">☀️ Hoje — {fmtDateFull(date)}</div>
                      <div className="chart-section">
                        <ResponsiveContainer width="100%" height={140}>
                          <BarChart data={chartDataHoje} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                            <XAxis dataKey="dia" tick={{ fontSize: 12, fill: "#94a3b8" }} />
                            <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                            <Tooltip contentStyle={{ borderRadius: 10, fontSize: 13 }} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Bar dataKey="Presentes" fill="#4ade80" radius={[6,6,0,0]} />
                            <Bar dataKey="Faltosos" fill="#f87171" radius={[6,6,0,0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      {chartData7.length > 0 && (
                        <>
                          <div className="section-title">📅 Últimos 7 dias</div>
                          <div className="chart-section">
                            <ResponsiveContainer width="100%" height={180}>
                              <BarChart data={chartData7} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                                <XAxis dataKey="dia" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                                <Tooltip contentStyle={{ borderRadius: 10, fontSize: 13 }} />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                                <Bar dataKey="Presentes" fill="#4ade80" radius={[4,4,0,0]} />
                                <Bar dataKey="Faltosos" fill="#f87171" radius={[4,4,0,0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </>
                      )}
                      <div className="section-title">🗓️ Meses — {anoAtual}</div>
                      <div className="chart-section">
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={chartMonth} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                            <XAxis dataKey="dia" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                            <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                            <Tooltip contentStyle={{ borderRadius: 10, fontSize: 13 }} formatter={(v, n, p) => p.payload.temDados ? v : "—"} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Bar dataKey="Presentes" fill="#60a5fa" radius={[4,4,0,0]} />
                            <Bar dataKey="Faltosos" fill="#f87171" radius={[4,4,0,0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="section-title">📋 Registros Diários</div>
                      <div style={{ background: "#f8fafc", borderRadius: 14, overflow: "hidden", marginBottom: 20 }}>
                        {histDays.slice().reverse().map(d => {
                          const dh = history[d] || {};
                          const dp = Object.values(dh).reduce((s, v) => s + (v?.p || 0), 0);
                          const df = Object.values(dh).reduce((s, v) => s + (v?.f || 0), 0);
                          const total = dp + df;
                          const pct = total > 0 ? Math.round(dp / total * 100) : 0;
                          return (
                            <div key={d} className="row-sep" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px" }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{fmtDateFull(d)}</span>
                              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                <span style={{ background: "#f0fdf4", color: "#16a34a", borderRadius: 8, padding: "2px 8px", fontWeight: 800, fontSize: 12 }}>✅ {dp}</span>
                                <span style={{ background: "#fef2f2", color: "#dc2626", borderRadius: 8, padding: "2px 8px", fontWeight: 800, fontSize: 12 }}>❌ {df}</span>
                                {total > 0 && <span style={{ background: "#eff6ff", color: "#1d4ed8", borderRadius: 8, padding: "2px 8px", fontWeight: 800, fontSize: 11 }}>{pct}%</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="section-title">🖨️ Imprimir Relatórios</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <button className="print-btn" onClick={() => printReport("Hoje · " + fmtDateFull(date), [], [])} style={{ background: "#334155", color: "white" }}>📄 Relatório do Dia</button>
                        {chartData7.length > 0 && <button className="print-btn" onClick={() => printReport("Últimos 7 dias", chartData7, chartData7)} style={{ background: "#1d4ed8", color: "white" }}>📊 Relatório Semanal (7 dias)</button>}
                        {chartData30.length > 0 && <button className="print-btn" onClick={() => printReport("Últimos 30 dias", chartData30, chartData30)} style={{ background: "#0f172a", color: "white" }}>📅 Relatório Mensal (30 dias)</button>}
                        {chartWeek.length > 0 && <button className="print-btn" onClick={() => printReport("Médias por Semana", chartWeek, chartWeek)} style={{ background: "#ea580c", color: "white" }}>📈 Relatório de Médias Semanais</button>}
                        <button className="print-btn" onClick={() => printReport(`Médias por Mês — ${anoAtual}`, chartMonth, chartMonth)} style={{ background: "#6d28d9", color: "white" }}>🗓️ Relatório Anual por Mês</button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Login Viewer ── */}
      {showViewerLogin && (
        <div className="overlay" onClick={() => setShowViewerLogin(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🔐</div>
              <div style={{ fontWeight: 900, fontSize: 18, color: "#1e293b" }}>Área de Consulta</div>
              <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>Digite a palavra-chave</div>
            </div>
            <input className={`input-senha${viewerSenhaErro ? " erro" : ""}`} type="password" placeholder="••••••••"
              value={viewerSenhaInput} onChange={e => { setViewerSenhaInput(e.target.value); setViewerSenhaErro(false); }}
              onKeyDown={e => e.key === "Enter" && handleViewerLogin()} autoFocus />
            {viewerSenhaErro && <div style={{ color: "#dc2626", fontSize: 12, fontWeight: 700, textAlign: "center", marginTop: 8 }}>Palavra-chave incorreta</div>}
            <button onClick={handleViewerLogin} style={{ marginTop: 16, width: "100%", background: "#1e293b", color: "white", border: "none", borderRadius: 14, padding: "14px", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>Entrar</button>
            <button onClick={() => setShowViewerLogin(false)} style={{ marginTop: 8, width: "100%", background: "transparent", color: "#94a3b8", border: "none", borderRadius: 14, padding: "10px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* ── Viewer Panel ── */}
      {showViewer && (
        <div className="sheet-wrap" onClick={() => setShowViewer(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div style={{ padding: "20px 20px 0" }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: "#e2e8f0", margin: "0 auto 18px" }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 18, color: "#1e293b" }}>📊 Painel de Consulta</div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>Visualização · {nomeEscola}</div>
                </div>
                <button onClick={handleViewerLogout} style={{ background: "#fef2f2", color: "#dc2626", border: "none", borderRadius: 10, padding: "6px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Sair</button>
              </div>
              <div style={{ display: "flex", gap: 6, background: "#f1f5f9", borderRadius: 14, padding: 4, marginBottom: 20 }}>
                {[["resumo","📊 Resumo"],["historico","📅 Histórico"]].map(([k, l]) => (
                  <button key={k} className="admin-tab" onClick={() => setViewerTab(k)}
                    style={{ flex: 1, background: viewerTab === k ? "white" : "transparent", color: viewerTab === k ? "#1e293b" : "#64748b", boxShadow: viewerTab === k ? "0 1px 4px rgba(0,0,0,.1)" : "none" }}>{l}</button>
                ))}
              </div>
            </div>
            <div style={{ padding: "0 20px 36px" }}>
              {viewerTab === "resumo" && (
                <div>
                  <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                    <div style={{ flex: 1, background: "#f0fdf4", borderRadius: 14, padding: "14px", textAlign: "center" }}>
                      <div style={{ fontSize: 32, fontWeight: 900, color: "#16a34a" }}>{totalP}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#16a34a" }}>✅ Presentes</div>
                    </div>
                    <div style={{ flex: 1, background: "#fef2f2", borderRadius: 14, padding: "14px", textAlign: "center" }}>
                      <div style={{ fontSize: 32, fontWeight: 900, color: "#dc2626" }}>{totalF}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#dc2626" }}>❌ Faltosos</div>
                    </div>
                  </div>
                  {grupos.map(g => {
                    const gpP = g.turmas.reduce((s, t) => s + (dados[t.id]?.p || 0), 0);
                    const gpF = g.turmas.reduce((s, t) => s + (dados[t.id]?.f || 0), 0);
                    return (
                      <div key={g.id} className="row-sep" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0" }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>{g.emoji} {g.label}</span>
                        <div style={{ display: "flex", gap: 8 }}>
                          <span style={{ background: "#f0fdf4", color: "#16a34a", borderRadius: 8, padding: "3px 10px", fontWeight: 800, fontSize: 13 }}>✅ {gpP}</span>
                          <span style={{ background: "#fef2f2", color: "#dc2626", borderRadius: 8, padding: "3px 10px", fontWeight: 800, fontSize: 13 }}>❌ {gpF}</span>
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ marginTop: 20 }}>
                    <button className="print-btn" onClick={() => printReport("Hoje · " + fmtDateFull(date), [], [])} style={{ background: "#1e293b", color: "white" }}>🖨️ Imprimir Relatório do Dia</button>
                  </div>
                </div>
              )}
              {viewerTab === "historico" && (
                <div>
                  <div style={{ background: "linear-gradient(135deg,#eff6ff,#dbeafe)", border: "1.5px solid #bfdbfe", borderRadius: 18, padding: "14px 14px 10px", marginBottom: 18 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <span style={{ fontSize: 22 }}>📅</span>
                      <div>
                        <div style={{ fontWeight: 900, fontSize: 14, color: "#1e40af" }}>Últimos 7 dias</div>
                        <div style={{ fontSize: 11, color: "#60a5fa", fontWeight: 700 }}>Frequência diária</div>
                      </div>
                    </div>
                    {chartData7.length === 0 ? (
                      <div style={{ textAlign: "center", color: "#93c5fd", fontSize: 12, padding: "20px 0" }}>
                        <div style={{ fontSize: 28, marginBottom: 6 }}>📭</div>
                        Ainda sem histórico.<br />
                        <span style={{ fontSize: 11 }}>Os dados são arquivados automaticamente à meia-noite.</span>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={chartData7} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                          <XAxis dataKey="dia" tick={{ fontSize: 11, fill: "#60a5fa" }} />
                          <YAxis tick={{ fontSize: 10, fill: "#93c5fd" }} />
                          <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Bar dataKey="Presentes" fill="#4ade80" radius={[5,5,0,0]} />
                          <Bar dataKey="Faltosos" fill="#f87171" radius={[5,5,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                  <div style={{ background: "linear-gradient(135deg,#faf5ff,#ede9fe)", border: "1.5px solid #ddd6fe", borderRadius: 18, padding: "14px 14px 10px", marginBottom: 18 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <span style={{ fontSize: 22 }}>🗓️</span>
                      <div>
                        <div style={{ fontWeight: 900, fontSize: 14, color: "#5b21b6" }}>Meses do Ano — {anoAtual}</div>
                        <div style={{ fontSize: 11, color: "#a78bfa", fontWeight: 700 }}>Média diária por mês</div>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={chartMonth} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "#a78bfa" }} />
                        <YAxis tick={{ fontSize: 10, fill: "#c4b5fd" }} />
                        <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12 }} formatter={(v, n, p) => p.payload.temDados ? v : "—"} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="Presentes" fill="#60a5fa" radius={[5,5,0,0]} />
                        <Bar dataKey="Faltosos" fill="#f87171" radius={[5,5,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  {histDays.length > 0 && (
                    <>
                      <div className="section-title">📋 Registros Diários</div>
                      <div style={{ background: "#f8fafc", borderRadius: 14, overflow: "hidden", marginBottom: 20 }}>
                        {histDays.slice().reverse().map(d => {
                          const dh = history[d] || {};
                          const dp = Object.values(dh).reduce((s, v) => s + (v?.p || 0), 0);
                          const df = Object.values(dh).reduce((s, v) => s + (v?.f || 0), 0);
                          const total = dp + df;
                          const pct = total > 0 ? Math.round(dp / total * 100) : 0;
                          return (
                            <div key={d} className="row-sep" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px" }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{fmtDateFull(d)}</span>
                              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                <span style={{ background: "#f0fdf4", color: "#16a34a", borderRadius: 8, padding: "2px 8px", fontWeight: 800, fontSize: 12 }}>✅ {dp}</span>
                                <span style={{ background: "#fef2f2", color: "#dc2626", borderRadius: 8, padding: "2px 8px", fontWeight: 800, fontSize: 12 }}>❌ {df}</span>
                                {total > 0 && <span style={{ background: "#eff6ff", color: "#1d4ed8", borderRadius: 8, padding: "2px 8px", fontWeight: 800, fontSize: 11 }}>{pct}%</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                  <div className="section-title">🖨️ Imprimir</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <button className="print-btn" onClick={() => printReport("Hoje · " + fmtDateFull(date), [], [])} style={{ background: "#334155", color: "white" }}>📄 Relatório do Dia</button>
                    {chartData7.length > 0 && <button className="print-btn" onClick={() => printReport("Últimos 7 dias", chartData7, chartData7)} style={{ background: "#1d4ed8", color: "white" }}>📊 Relatório Semanal</button>}
                    <button className="print-btn" onClick={() => printReport(`Médias por Mês — ${anoAtual}`, chartMonth, chartMonth)} style={{ background: "#6d28d9", color: "white" }}>🗓️ Relatório Anual</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
