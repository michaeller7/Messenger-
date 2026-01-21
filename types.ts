
export enum ConnectionState {
  IDLE = 'IDLE',
  GENERATING = 'GENERATING',
  OFFERING = 'OFFERING',
  ANSWERING = 'ANSWERING',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  FAILED = 'FAILED'
}

export type Theme = 'dark' | 'light' | 'modern';
export type Language = 'uk' | 'en';
// Fix: Changed 'maximum' to 'personal' to match the usage in App.tsx and translations
export type EncLevel = 'open' | 'standard' | 'personal';

export interface Message {
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

export interface CryptoConfig {
  encLevel: EncLevel;
  passphrase?: string;
  useMic: boolean;
}