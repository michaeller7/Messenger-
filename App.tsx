
import React, { useState, useEffect, useRef, useCallback } from 'react';

// --- Types & Constants ---
enum ConnectionState {
  IDLE = 'IDLE',
  GENERATING = 'GENERATING',
  OFFERING = 'OFFERING',
  ANSWERING = 'ANSWERING',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  FAILED = 'FAILED'
}

type Theme = 'dark' | 'light' | 'modern';
type Language = 'uk' | 'en';
type EncLevel = 'open' | 'standard' | 'personal';

interface Message {
  id: string;
  type: 'sent' | 'received' | 'system';
  content: string;
  timestamp: number;
  file?: {
    name: string;
    mime: string;
    url: string;
  };
}

// Added missing interface
interface CryptoConfig {
  encLevel: EncLevel;
  passphrase?: string;
  useMic: boolean;
}

const DEFAULT_SDP_KEY = "Ultima_Internal_v1_Secret";
const PASSPHRASE_SALT = 'UltimaP2PSalt_2025';
const IV_LENGTH = 16;
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// --- Crypto Utilities ---
const CryptoUtils = {
  async getKeyFromPassphrase(passphrase: string): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      "raw", enc.encode(passphrase), { name: "PBKDF2" }, false, ["deriveKey"]
    );
    return window.crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: enc.encode(PASSPHRASE_SALT), iterations: 100000, hash: "SHA-256" },
      keyMaterial, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]
    );
  },
  async encrypt(text: string, passphrase: string): Promise<string> {
    const key = await this.getKeyFromPassphrase(passphrase);
    const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const encrypted = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(text));
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0); combined.set(new Uint8Array(encrypted), iv.length);
    return btoa(String.fromCharCode(...Array.from(combined)));
  },
  async decrypt(encB64: string, passphrase: string): Promise<string> {
    const key = await this.getKeyFromPassphrase(passphrase);
    const combined = new Uint8Array(atob(encB64).split('').map(c => c.charCodeAt(0)));
    const iv = combined.slice(0, IV_LENGTH);
    const encrypted = combined.slice(IV_LENGTH);
    const decrypted = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);
    return new TextDecoder().decode(decrypted);
  },
  generateRandomId: () => Math.random().toString(36).substring(2, 11)
};

// --- Full Translations (Включаючи все, що було на скріншотах) ---
const translations = {
  uk: {
    title: "Secure P2P 🔒", subtitle: "НАВІТЬ СЕРВЕРИ НЕ БАЧАТЬ ВАШ ЧАТ", secure: "ЗАХИЩЕНО", online: "У мережі", offline: "Офлайн", typing: "друкує",
    host: "Створити код (Host)", join: "Приєднатися (Join)", setupTitle: "Налаштування безпеки", close: "Закрити", voiceToggle: "Голосовий зв'язок",
    voiceHint: "⚠️ Для роботи обидва пристрої повинні увімкнути цей перемикач перед з'єднанням.", placeholder: "Ваше повідомлення...",
    status: "Статус", protocol: "Протокол", cipher: "Шифр", ice: "ICE Транспорт", audio: "Аудіо канал", active: "Активний", inactive: "Неактивний",
    waiting: "Очікування...", connected: "З'єднано", copy: "КОПІЮВАТИ", share: "Поділитись", shareMsg: "Мій секретний код:", 
    howToUseTitle: "ЯК КОРИСТУВАТИСЯ? / ЧОМУ ЦЕ БЕЗПЕЧНО?", howToUseSteps: [
      "1. Виберіть 'Host', скопіюйте код та надішліть партнеру.",
      "2. Партнер вибирає 'Join', вставляє код і надсилає свою відповідь.",
      "3. Вставте відповідь партнера для завершення з'єднання.",
      "⚠️ Утримування 'X' (5 сек) повністю видалить історію чату."
    ],
    lang: "МОВА", theme: "ТЕМА", encLevelLabel: "РІВЕНЬ ЗАХИСТУ РУКОСТИСКАННЯ (SDP):", 
    encStandard: "Стандарт (Внутрішній ключ)", encPersonal: "Особистий пароль", encOpen: "Відкритий обмін",
    passPlaceholder: "Введіть пароль для ключів...", securityData: "Дані шифрування", confirmEnd: { title: "Завершити?", desc: "Закриття через {time} сек.", yes: "Так", no: "Ні" },
    stages: { gen: "Генерація...", paste: "Крок 1: Вставте код", process: "Обробити", sendBack: "ВАШ КОД ДЛЯ ПАРТНЕРА:", reply: "Крок 2: Вставте відповідь", yourReply: "Крок 2: Ваша відповідь" },
    techNote: "Це з'єднання Peer-to-Peer. Ключі шифрування згенеровані на вашому пристрої і не передаються через сервер."
  },
  en: {
    title: "Secure P2P 🔒", subtitle: "DIRECT END-TO-END ENCRYPTION", secure: "SECURE", online: "Online", offline: "Offline", typing: "typing",
    host: "Host Session", join: "Join Session", setupTitle: "Security Settings", close: "Close", voiceToggle: "Voice Call",
    voiceHint: "⚠️ Both must enable this before connecting.", placeholder: "Type a message...",
    status: "Status", protocol: "Protocol", cipher: "Cipher", ice: "ICE Transport", audio: "Audio Channel", active: "Active", inactive: "Inactive",
    waiting: "Waiting...", connected: "Connected", copy: "COPY", share: "Share", shareMsg: "My P2P code:",
    howToUseTitle: "HOW TO USE? / WHY SECURE?", howToUseSteps: [
      "1. Select 'Host', copy code and send to partner.",
      "2. Partner selects 'Join', pastes code and sends back reply.",
      "3. Paste partner's reply to finish connection.",
      "⚠️ Holding 'X' (5 sec) wipes the entire chat history."
    ],
    lang: "LANG", theme: "THEME", encLevelLabel: "HANDSHAKE PROTECTION (SDP):",
    encStandard: "Standard (Internal Key)", encPersonal: "Personal Passphrase", encOpen: "Open Exchange",
    passPlaceholder: "Passphrase for keys...", securityData: "Encryption Data", confirmEnd: { title: "End?", desc: "Closing in {time} sec.", yes: "Yes", no: "No" },
    stages: { gen: "Generating...", paste: "Step 1: Paste Code", process: "Process", sendBack: "YOUR CODE FOR PEER:", reply: "Step 2: Paste Reply", yourReply: "Step 2: Your Reply" },
    techNote: "This is a Peer-to-Peer connection. Encryption keys are generated locally and never touch a server."
  }
};

const App: React.FC = () => {
  const [lang, setLang] = useState<Language>('uk');
  const [theme, setTheme] = useState<Theme>('dark');
  const [connState, setConnState] = useState<ConnectionState>(ConnectionState.IDLE);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [showSetup, setShowSetup] = useState(true);
  const [showSecurity, setShowSecurity] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const [closeProgress, setCloseProgress] = useState(0);
  const [remoteIsTyping, setRemoteIsTyping] = useState(false);
  const [transferProgress, setTransferProgress] = useState<string | null>(null);
  const [showEndConfirmation, setShowEndConfirmation] = useState(false);
  const [endTimer, setEndTimer] = useState(10);
  const [config, setConfig] = useState<CryptoConfig>({ encLevel: 'standard', passphrase: '', useMic: false });
  const [localSdp, setLocalSdp] = useState('');
  const [remoteInput, setRemoteInput] = useState('');

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const incomingFileRef = useRef<{ meta: any, buffer: ArrayBuffer[] }>({ meta: null, buffer: [] });
  const holdTimerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const autoCloseIntervalRef = useRef<number | null>(null);

  const t = translations[lang];
  const isHostMode = connState === ConnectionState.GENERATING || connState === ConnectionState.OFFERING;
  const isJoinMode = connState === ConnectionState.ANSWERING;

  useEffect(() => { document.body.className = `theme-${theme}`; }, [theme]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, remoteIsTyping]);

  const addSysMsg = useCallback((text: string) => {
    setMessages(prev => [...prev, { id: CryptoUtils.generateRandomId(), type: 'system', content: text, timestamp: Date.now() }]);
  }, []);

  const closeSession = useCallback((clearChat: boolean) => {
    if (pcRef.current) pcRef.current.close();
    if (dcRef.current) dcRef.current.close();
    pcRef.current = null; dcRef.current = null;
    setLocalSdp(''); setRemoteInput(''); setConnState(ConnectionState.IDLE);
    setShowSetup(true); setShowEndConfirmation(false); setRemoteIsTyping(false); setTransferProgress(null);
    if (autoCloseIntervalRef.current) clearInterval(autoCloseIntervalRef.current);
    if (clearChat) setMessages([]); else addSysMsg(t.offline);
  }, [addSysMsg, t.offline]);

  useEffect(() => {
    if (showEndConfirmation) {
      setEndTimer(10);
      autoCloseIntervalRef.current = window.setInterval(() => {
        setEndTimer(v => v <= 1 ? (closeSession(false), 0) : v - 1);
      }, 1000);
    } else if (autoCloseIntervalRef.current) {
      clearInterval(autoCloseIntervalRef.current);
    }
  }, [showEndConfirmation, closeSession]);

  const handleCloseStart = () => {
    startTimeRef.current = Date.now();
    setCloseProgress(0);
    holdTimerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const progress = Math.min((elapsed / 5000) * 100, 100);
      setCloseProgress(progress);
      if (elapsed >= 5000) {
        if (holdTimerRef.current) { clearInterval(holdTimerRef.current); holdTimerRef.current = null; }
        closeSession(true); setCloseProgress(0);
      }
    }, 50);
  };

  const handleCloseEnd = () => {
    if (holdTimerRef.current)