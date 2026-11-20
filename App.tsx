import React, { useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, getReactNativePersistence, GoogleAuthProvider, initializeAuth, onAuthStateChanged, signInWithCredential, signOut, User } from "firebase/auth";
import { collection, doc, getFirestore, onSnapshot, orderBy, query, setDoc } from "firebase/firestore";

WebBrowser.maybeCompleteAuthSession();

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};
const configured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
const firebaseApp = configured ? (getApps()[0] ?? initializeApp(firebaseConfig)) : null;
const auth = firebaseApp ? (() => {
  try {
    return initializeAuth(firebaseApp, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    // Fast Refresh can evaluate this module more than once; reuse the initialized instance.
    return getAuth(firebaseApp);
  }
})() : null;
const db = firebaseApp ? getFirestore(firebaseApp) : null;
type Entry = { id: string; expression: string; result: string; createdAt: number };
type RecordItem = { id: string; title: string; amount: string; note: string; createdAt: number };
const HISTORY_KEY = "synccalc.history.v1";
const RECORDS_KEY = "synccalc.records.v1";
const historyKeyFor = (uid?: string) => uid ? `${HISTORY_KEY}.${uid}` : HISTORY_KEY;
const recordsKeyFor = (uid?: string) => uid ? `${RECORDS_KEY}.${uid}` : RECORDS_KEY;

function evaluate(input: string): string {
  const source = input.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/,/g, "");
  let i = 0;
  const ws = () => { while (/\s/.test(source[i] ?? "")) i++; };
  const number = (): number => {
    ws();
    if (source[i] === "+") { i++; return number(); }
    if (source[i] === "-") { i++; return -number(); }
    if (source[i] === "(") { i++; const v = expr(); ws(); if (source[i++] !== ")") throw Error("Missing closing bracket"); return v; }
    const start = i;
    while (/[0-9.]/.test(source[i] ?? "")) i++;
    if (start === i) throw Error("Enter a valid calculation");
    const n = Number(source.slice(start, i));
    if (!Number.isFinite(n)) throw Error("Invalid number");
    return n;
  };
  const power = (): number => { let v = number(); ws(); if (source[i] === "^") { i++; v = Math.pow(v, power()); } return v; };
  const term = (): number => { let v = power(); while (true) { ws(); const op = source[i]; if (op !== "*" && op !== "/" && op !== "%") break; i++; const r = power(); if ((op === "/" || op === "%") && r === 0) throw Error("Cannot divide by zero"); v = op === "*" ? v * r : op === "/" ? v / r : v % r; } return v; };
  const expr = (): number => { let v = term(); while (true) { ws(); const op = source[i]; if (op !== "+" && op !== "-") break; i++; const r = term(); v = op === "+" ? v + r : v - r; } return v; };
  const result = expr(); ws();
  if (i !== source.length) throw Error("Check the expression");
  if (!Number.isFinite(result)) throw Error("Result is outside the supported range");
  return Number(result.toPrecision(12)).toString();
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [history, setHistory] = useState<Entry[]>([]);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [expression, setExpression] = useState("");
  const [tab, setTab] = useState<"calc" | "history" | "records">("calc");
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordTitle, setRecordTitle] = useState("");
  const [recordAmount, setRecordAmount] = useState("");
  const [recordNote, setRecordNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    let active = true;
    async function loadAccountData() {
      try {
        const hKey = historyKeyFor(user?.uid);
        const rKey = recordsKeyFor(user?.uid);
        const [h, r] = await AsyncStorage.multiGet([hKey, rKey]);
        let nextHistory: Entry[] = h[1] ? JSON.parse(h[1]) : [];
        let nextRecords: RecordItem[] = r[1] ? JSON.parse(r[1]) : [];

        // On the first Google sign-in, move anonymous device records into this account.
        if (user) {
          if (!h[1]) {
            const legacy = await AsyncStorage.getItem(HISTORY_KEY);
            if (legacy) nextHistory = JSON.parse(legacy);
          }
          if (!r[1]) {
            const legacy = await AsyncStorage.getItem(RECORDS_KEY);
            if (legacy) nextRecords = JSON.parse(legacy);
          }
          await AsyncStorage.multiSet([
            [hKey, JSON.stringify(nextHistory)],
            [rKey, JSON.stringify(nextRecords)]
          ]);
          if (db) {
            await Promise.all([
              ...nextHistory.map(item => setDoc(doc(db, "users", user.uid, "calculations", item.id), item)),
              ...nextRecords.map(item => setDoc(doc(db, "users", user.uid, "records", item.id), item))
            ]);
          }
        }
        if (active) {
          setHistory(nextHistory);
          setRecords(nextRecords);
        }
      } catch (error) {
        if (active) Alert.alert("Storage", "Could not load or sync saved data. Please try again.");
      }
    }
    void loadAccountData();
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (response?.type !== "success" || !response.params.id_token || !auth) return;
    signInWithCredential(auth, GoogleAuthProvider.credential(response.params.id_token))
      .catch(e => Alert.alert("Google sign-in failed", e.message));
  }, [response]);

  useEffect(() => {
    if (!user || !db) return;
    const unsubHistory = onSnapshot(query(collection(db, "users", user.uid, "calculations"), orderBy("createdAt", "desc")), snap => {
      const cloud = snap.docs.map(d => d.data() as Entry);
      setHistory(current => mergeById(current, cloud));
    });
    const unsubRecords = onSnapshot(query(collection(db, "users", user.uid, "records"), orderBy("createdAt", "desc")), snap => {
      const cloud = snap.docs.map(d => d.data() as RecordItem);
      setRecords(current => mergeById(current, cloud));
    });
    return () => { unsubHistory(); unsubRecords(); };
  }, [user]);

  const result = useMemo(() => {
    if (!expression.trim()) return "";
    try { return evaluate(expression); } catch { return ""; }
  }, [expression]);

  async function persistHistory(items: Entry[]) {
    setHistory(items); await AsyncStorage.setItem(historyKeyFor(user?.uid), JSON.stringify(items));
  }
  async function persistRecords(items: RecordItem[]) {
    setRecords(items); await AsyncStorage.setItem(recordsKeyFor(user?.uid), JSON.stringify(items));
  }
  async function saveCalculation() {
    if (!result) return;
    const entry: Entry = { id: String(Date.now()), expression, result, createdAt: Date.now() };
    const next = [entry, ...history].slice(0, 500);
    await persistHistory(next);
    if (user && db) {
      try { await setDoc(doc(db, "users", user.uid, "calculations", entry.id), entry); }
      catch { Alert.alert("Saved on this device", "Cloud sync failed. Your calculation is safe locally and will be available in your history."); }
    }
    setExpression(result);
  }
  function press(key: string) {
    if (key === "AC") { setExpression(""); return; }
    if (key === "⌫") { setExpression(v => v.slice(0, -1)); return; }
    if (key === "=") { void saveCalculation(); return; }
    if (key === "±") { setExpression(v => v.startsWith("-") ? v.slice(1) : "-" + v); return; }
    if (key === "%") { setExpression(v => v + "%"); return; }
    setExpression(v => v + key);
  }
  async function saveRecord() {
    if (!recordTitle.trim() || !recordAmount.trim()) { Alert.alert("Missing details", "Add a title and amount."); return; }
    const item: RecordItem = { id: String(Date.now()), title: recordTitle.trim(), amount: recordAmount.trim(), note: recordNote.trim(), createdAt: Date.now() };
    const next = [item, ...records]; await persistRecords(next);
    if (user && db) {
      try { await setDoc(doc(db, "users", user.uid, "records", item.id), item); }
      catch { Alert.alert("Saved on this device", "Cloud sync failed. Your record is safe locally; check your connection and try again."); }
    }
    setRecordTitle(""); setRecordAmount(""); setRecordNote(""); setRecordOpen(false);
  }
  async function restore(entry: Entry) { setExpression(entry.expression); setTab("calc"); }
  const keys = ["AC", "⌫", "%", "÷", "7", "8", "9", "×", "4", "5", "6", "−", "1", "2", "3", "+", "±", "0", ".", "="];

  return <View style={s.screen}>
    <StatusBar style="light" />
    <View style={s.header}>
      <View><Text style={s.brand}>SyncCalc</Text><Text style={s.sub}>Your calculations, always with you</Text></View>
      <Pressable style={s.account} onPress={() => user ? Alert.alert("Signed in", user.email ?? "Google account", [{ text: "Cancel" }, { text: "Sign out", style: "destructive", onPress: () => auth && signOut(auth) }]) : configured ? promptAsync() : Alert.alert("Setup required", "Add Firebase and Google OAuth values to your .env file first.")}>
        <Text style={s.accountText}>{user ? "● " + (user.displayName?.split(" ")[0] ?? "Account") : "Continue with Google"}</Text>
      </Pressable>
    </View>
    <View style={s.tabs}>
      {(["calc", "history", "records"] as const).map(t => <Pressable key={t} onPress={() => setTab(t)} style={[s.tab, tab === t && s.activeTab]}><Text style={[s.tabText, tab === t && s.activeTabText]}>{t === "calc" ? "Calculator" : t === "history" ? "History" : "Record book"}</Text></Pressable>)}
    </View>
    {tab === "calc" ? <View style={s.calc}>
      <View style={s.display}><Text style={s.expression} numberOfLines={2}>{expression || "0"}</Text><Text style={s.result} numberOfLines={1}>{result ? "= " + result : " "}</Text></View>
      <View style={s.keypad}>{keys.map((k, idx) => <Pressable key={k + idx} onPress={() => press(k)} style={[s.key, ["÷", "×", "−", "+", "="].includes(k) && s.operator, ["AC", "⌫", "%"].includes(k) && s.utility, k === "=" && s.equals]}><Text style={[s.keyText, ["÷", "×", "−", "+", "="].includes(k) && s.operatorText, k === "=" && s.equalsText]}>{k}</Text></Pressable>)}</View>
      <Text style={s.hint}>Tap = to calculate and save to your history.</Text>
    </View> : tab === "history" ? <View style={s.listPage}>
      <View style={s.sectionHead}><Text style={s.sectionTitle}>Calculation history</Text><Text style={s.muted}>{history.length} saved</Text></View>
      <FlatList data={history} keyExtractor={x => x.id} ListEmptyComponent={<Empty title="No calculations yet" detail="Your saved calculations will appear here." />} renderItem={({item}) => <Pressable style={s.item} onPress={() => void restore(item)}><View style={{flex:1}}><Text style={s.itemMain}>{item.expression}</Text><Text style={s.muted}>{new Date(item.createdAt).toLocaleString()}</Text></View><Text style={s.itemValue}>{item.result}</Text></Pressable>} />
    </View> : <View style={s.listPage}>
      <View style={s.sectionHead}><View><Text style={s.sectionTitle}>Personal record book</Text><Text style={s.muted}>Keep track of amounts and notes</Text></View><Pressable style={s.addButton} onPress={() => setRecordOpen(true)}><Text style={s.addText}>+ Add</Text></Pressable></View>
      <FlatList data={records} keyExtractor={x => x.id} ListEmptyComponent={<Empty title="Your record book is empty" detail="Add expenses, income, or any amount you want to remember." />} renderItem={({item}) => <View style={s.item}><View style={{flex:1}}><Text style={s.itemMain}>{item.title}</Text>{!!item.note && <Text style={s.muted}>{item.note}</Text>}<Text style={s.muted}>{new Date(item.createdAt).toLocaleDateString()}</Text></View><Text style={s.itemValue}>{item.amount}</Text></View>} />
    </View>}
    <Modal visible={recordOpen} transparent animationType="slide" onRequestClose={() => setRecordOpen(false)}><View style={s.modalShade}><View style={s.modal}><Text style={s.sectionTitle}>New record</Text><TextInput value={recordTitle} onChangeText={setRecordTitle} placeholder="Title (e.g. Groceries)" placeholderTextColor="#8490a4" style={s.input}/><TextInput value={recordAmount} onChangeText={setRecordAmount} placeholder="Amount (e.g. ₦25,000)" placeholderTextColor="#8490a4" style={s.input}/><TextInput value={recordNote} onChangeText={setRecordNote} placeholder="Note (optional)" placeholderTextColor="#8490a4" style={s.input}/><View style={s.modalActions}><Pressable onPress={() => setRecordOpen(false)}><Text style={s.muted}>Cancel</Text></Pressable><Pressable style={s.addButton} onPress={() => void saveRecord()}><Text style={s.addText}>Save record</Text></Pressable></View></View></View></Modal>
    <Text style={s.footer}>{user ? "Signed in · Syncing your account" : "Local mode · Sign in to sync across devices"}</Text>
  </View>;
}

function mergeById<T extends {id:string}>(local: T[], cloud: T[]): T[] {
  const map = new Map<string,T>(); [...local, ...cloud].forEach(x => map.set(x.id, x));
  return [...map.values()].sort((a:any,b:any) => b.createdAt - a.createdAt);
}
function Empty({title,detail}:{title:string;detail:string}) { return <View style={s.empty}><Text style={s.emptyTitle}>{title}</Text><Text style={s.muted}>{detail}</Text></View>; }

const s = StyleSheet.create({
  screen:{flex:1,backgroundColor:"#0b1220",paddingTop:Platform.OS==="android"?42:58,paddingHorizontal:18},
  header:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:22},
  brand:{color:"#f8fafc",fontSize:27,fontWeight:"800",letterSpacing:-1},sub:{color:"#8290a5",fontSize:11,marginTop:3},
  account:{backgroundColor:"#1b2940",paddingHorizontal:12,paddingVertical:10,borderRadius:14},accountText:{color:"#dbeafe",fontSize:11,fontWeight:"700"},
  tabs:{flexDirection:"row",backgroundColor:"#121e30",padding:4,borderRadius:14,marginBottom:16},
  tab:{flex:1,paddingVertical:11,alignItems:"center",borderRadius:11},activeTab:{backgroundColor:"#263b59"},tabText:{color:"#8391a7",fontSize:12,fontWeight:"600"},activeTabText:{color:"#fff"},
  calc:{flex:1},display:{flex:1,minHeight:145,justifyContent:"flex-end",alignItems:"flex-end",paddingHorizontal:8,paddingBottom:20},
  expression:{color:"#e8eef8",fontSize:38,fontWeight:"300",textAlign:"right"},result:{color:"#45d6a2",fontSize:25,marginTop:12},
  keypad:{flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between",gap:10},
  key:{width:"22.5%",aspectRatio:1,backgroundColor:"#18263a",borderRadius:19,justifyContent:"center",alignItems:"center"},
  keyText:{color:"#f2f6fc",fontSize:23,fontWeight:"600"},operator:{backgroundColor:"#213b51"},operatorText:{color:"#58d8b0"},
  utility:{backgroundColor:"#29364a"},equals:{backgroundColor:"#25b889"},equalsText:{color:"#071b17"},
  hint:{color:"#68788f",textAlign:"center",fontSize:11,marginTop:14,marginBottom:8},
  listPage:{flex:1},sectionHead:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:16},
  sectionTitle:{color:"#f4f7fb",fontSize:18,fontWeight:"700"},muted:{color:"#8290a5",fontSize:11,marginTop:4},
  item:{flexDirection:"row",alignItems:"center",padding:15,backgroundColor:"#142136",borderRadius:15,marginBottom:9},
  itemMain:{color:"#e8eef8",fontSize:14,fontWeight:"600"},itemValue:{color:"#53d5ad",fontSize:17,fontWeight:"700",marginLeft:12},
  empty:{alignItems:"center",paddingTop:70,gap:8},emptyTitle:{color:"#dce5f2",fontSize:15,fontWeight:"600"},
  addButton:{backgroundColor:"#25b889",paddingHorizontal:15,paddingVertical:10,borderRadius:12},addText:{color:"#062219",fontWeight:"800",fontSize:12},
  modalShade:{flex:1,backgroundColor:"#0009",justifyContent:"flex-end"},modal:{backgroundColor:"#142136",padding:22,borderTopLeftRadius:24,borderTopRightRadius:24,gap:13},
  input:{backgroundColor:"#0c1728",color:"#f4f7fb",padding:14,borderRadius:12,fontSize:14},modalActions:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginTop:8},
  footer:{color:"#64748b",fontSize:10,textAlign:"center",paddingVertical:10}
});