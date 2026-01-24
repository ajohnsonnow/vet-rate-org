/**
 * Vet-Rate.org - Language Context
 * Full app-wide language switching with native language UI + English form submission
 * 
 * Supports: English (en), Spanish (es), Tagalog (tl), Vietnamese (vi), Korean (ko)
 * 
 * Veterans see the entire app in their native language, but all VA forms
 * are still generated and submitted in English (VA requirement).
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// Storage key for language preference
const LANGUAGE_STORAGE_KEY = 'vetrate_language';

// Supported languages with metadata
// Organized by veteran population significance and military service rates
export const SUPPORTED_LANGUAGES = {
  // === PRIMARY LANGUAGES ===
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇺🇸',
    direction: 'ltr',
    voiceCode: 'en-US',
    region: 'primary',
  },
  es: {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    flag: '🇲🇽',
    direction: 'ltr',
    voiceCode: 'es-MX',
    region: 'primary',
  },
  
  // === PACIFIC ISLANDER (Highest per-capita military service!) ===
  ch: {
    code: 'ch',
    name: 'Chamorro',
    nativeName: 'Chamoru',
    flag: '🇬🇺',
    direction: 'ltr',
    voiceCode: 'en-US', // Fallback
    region: 'pacific',
    note: 'Guam has the highest per-capita military service rate in the US',
  },
  sm: {
    code: 'sm',
    name: 'Samoan',
    nativeName: 'Gagana Sāmoa',
    flag: '🇦🇸',
    direction: 'ltr',
    voiceCode: 'en-US', // Fallback
    region: 'pacific',
    note: 'American Samoa has extremely high military enlistment',
  },
  haw: {
    code: 'haw',
    name: 'Hawaiian',
    nativeName: 'ʻŌlelo Hawaiʻi',
    flag: '🌺',
    direction: 'ltr',
    voiceCode: 'en-US',
    region: 'pacific',
  },
  to: {
    code: 'to',
    name: 'Tongan',
    nativeName: 'Lea Faka-Tonga',
    flag: '🇹🇴',
    direction: 'ltr',
    voiceCode: 'en-US',
    region: 'pacific',
  },
  
  // === ASIAN LANGUAGES ===
  tl: {
    code: 'tl',
    name: 'Tagalog',
    nativeName: 'Tagalog',
    flag: '🇵🇭',
    direction: 'ltr',
    voiceCode: 'fil-PH',
    region: 'asian',
  },
  vi: {
    code: 'vi',
    name: 'Vietnamese',
    nativeName: 'Tiếng Việt',
    flag: '🇻🇳',
    direction: 'ltr',
    voiceCode: 'vi-VN',
    region: 'asian',
  },
  ko: {
    code: 'ko',
    name: 'Korean',
    nativeName: '한국어',
    flag: '🇰🇷',
    direction: 'ltr',
    voiceCode: 'ko-KR',
    region: 'asian',
  },
  zh: {
    code: 'zh',
    name: 'Chinese (Mandarin)',
    nativeName: '中文',
    flag: '🇨🇳',
    direction: 'ltr',
    voiceCode: 'zh-CN',
    region: 'asian',
  },
  ja: {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    flag: '🇯🇵',
    direction: 'ltr',
    voiceCode: 'ja-JP',
    region: 'asian',
  },
  hmn: {
    code: 'hmn',
    name: 'Hmong',
    nativeName: 'Hmoob',
    flag: '🏔️',
    direction: 'ltr',
    voiceCode: 'en-US',
    region: 'asian',
    note: 'Significant veteran community from Vietnam War era',
  },
  th: {
    code: 'th',
    name: 'Thai',
    nativeName: 'ภาษาไทย',
    flag: '🇹🇭',
    direction: 'ltr',
    voiceCode: 'th-TH',
    region: 'asian',
  },
  km: {
    code: 'km',
    name: 'Khmer',
    nativeName: 'ភាសាខ្មែរ',
    flag: '🇰🇭',
    direction: 'ltr',
    voiceCode: 'km-KH',
    region: 'asian',
  },
  lo: {
    code: 'lo',
    name: 'Lao',
    nativeName: 'ພາສາລາວ',
    flag: '🇱🇦',
    direction: 'ltr',
    voiceCode: 'lo-LA',
    region: 'asian',
  },
  hi: {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    flag: '🇮🇳',
    direction: 'ltr',
    voiceCode: 'hi-IN',
    region: 'asian',
  },
  pa: {
    code: 'pa',
    name: 'Punjabi',
    nativeName: 'ਪੰਜਾਬੀ',
    flag: '🇮🇳',
    direction: 'ltr',
    voiceCode: 'pa-IN',
    region: 'asian',
  },
  
  // === AFRICAN LANGUAGES ===
  am: {
    code: 'am',
    name: 'Amharic',
    nativeName: 'አማርኛ',
    flag: '🇪🇹',
    direction: 'ltr',
    voiceCode: 'am-ET',
    region: 'african',
  },
  so: {
    code: 'so',
    name: 'Somali',
    nativeName: 'Soomaali',
    flag: '🇸🇴',
    direction: 'ltr',
    voiceCode: 'so-SO',
    region: 'african',
    note: 'Significant refugee-veteran population',
  },
  sw: {
    code: 'sw',
    name: 'Swahili',
    nativeName: 'Kiswahili',
    flag: '🇰🇪',
    direction: 'ltr',
    voiceCode: 'sw-KE',
    region: 'african',
  },
  ha: {
    code: 'ha',
    name: 'Hausa',
    nativeName: 'Hausa',
    flag: '🇳🇬',
    direction: 'ltr',
    voiceCode: 'ha-NG',
    region: 'african',
  },
  yo: {
    code: 'yo',
    name: 'Yoruba',
    nativeName: 'Yorùbá',
    flag: '🇳🇬',
    direction: 'ltr',
    voiceCode: 'yo-NG',
    region: 'african',
  },
  ig: {
    code: 'ig',
    name: 'Igbo',
    nativeName: 'Igbo',
    flag: '🇳🇬',
    direction: 'ltr',
    voiceCode: 'ig-NG',
    region: 'african',
  },
  zu: {
    code: 'zu',
    name: 'Zulu',
    nativeName: 'isiZulu',
    flag: '🇿🇦',
    direction: 'ltr',
    voiceCode: 'zu-ZA',
    region: 'african',
  },
  xh: {
    code: 'xh',
    name: 'Xhosa',
    nativeName: 'isiXhosa',
    flag: '🇿🇦',
    direction: 'ltr',
    voiceCode: 'xh-ZA',
    region: 'african',
  },
  
  // === MIDDLE EASTERN / ARABIC ===
  ar: {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    flag: '🇸🇦',
    direction: 'rtl',
    voiceCode: 'ar-SA',
    region: 'middle-eastern',
  },
  fa: {
    code: 'fa',
    name: 'Farsi (Persian)',
    nativeName: 'فارسی',
    flag: '🇮🇷',
    direction: 'rtl',
    voiceCode: 'fa-IR',
    region: 'middle-eastern',
  },
  prs: {
    code: 'prs',
    name: 'Dari',
    nativeName: 'دری',
    flag: '🇦🇫',
    direction: 'rtl',
    voiceCode: 'fa-AF',
    region: 'middle-eastern',
    note: 'Afghan interpreters and SIV holders',
  },
  ps: {
    code: 'ps',
    name: 'Pashto',
    nativeName: 'پښتو',
    flag: '🇦🇫',
    direction: 'rtl',
    voiceCode: 'ps-AF',
    region: 'middle-eastern',
    note: 'Afghan interpreters and SIV holders',
  },
  
  // === NATIVE AMERICAN (Honoring Code Talker Heritage) ===
  nv: {
    code: 'nv',
    name: 'Navajo (Diné)',
    nativeName: 'Diné bizaad',
    flag: '🏜️',
    direction: 'ltr',
    voiceCode: 'en-US',
    region: 'native-american',
    note: 'Honoring the Navajo Code Talkers legacy',
  },
  chr: {
    code: 'chr',
    name: 'Cherokee',
    nativeName: 'ᏣᎳᎩ',
    flag: '🪶',
    direction: 'ltr',
    voiceCode: 'en-US',
    region: 'native-american',
  },
  lkt: {
    code: 'lkt',
    name: 'Lakota',
    nativeName: 'Lakȟótiyapi',
    flag: '🦅',
    direction: 'ltr',
    voiceCode: 'en-US',
    region: 'native-american',
  },
  
  // === CARIBBEAN ===
  ht: {
    code: 'ht',
    name: 'Haitian Creole',
    nativeName: 'Kreyòl Ayisyen',
    flag: '🇭🇹',
    direction: 'ltr',
    voiceCode: 'ht-HT',
    region: 'caribbean',
  },
  
  // === EUROPEAN ===
  de: {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    flag: '🇩🇪',
    direction: 'ltr',
    voiceCode: 'de-DE',
    region: 'european',
  },
  fr: {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    flag: '🇫🇷',
    direction: 'ltr',
    voiceCode: 'fr-FR',
    region: 'european',
  },
  pt: {
    code: 'pt',
    name: 'Portuguese',
    nativeName: 'Português',
    flag: '🇧🇷',
    direction: 'ltr',
    voiceCode: 'pt-BR',
    region: 'european',
  },
  ru: {
    code: 'ru',
    name: 'Russian',
    nativeName: 'Русский',
    flag: '🇷🇺',
    direction: 'ltr',
    voiceCode: 'ru-RU',
    region: 'european',
  },
  pl: {
    code: 'pl',
    name: 'Polish',
    nativeName: 'Polski',
    flag: '🇵🇱',
    direction: 'ltr',
    voiceCode: 'pl-PL',
    region: 'european',
  },
  it: {
    code: 'it',
    name: 'Italian',
    nativeName: 'Italiano',
    flag: '🇮🇹',
    direction: 'ltr',
    voiceCode: 'it-IT',
    region: 'european',
  },
  uk: {
    code: 'uk',
    name: 'Ukrainian',
    nativeName: 'Українська',
    flag: '🇺🇦',
    direction: 'ltr',
    voiceCode: 'uk-UA',
    region: 'european',
  },
};

// App-wide translations
// Structure: translations.section.key = { en: '...', es: '...', ... }
export const APP_TRANSLATIONS = {
  // Navigation & Common UI
  common: {
    close: { en: 'Close', es: 'Cerrar', tl: 'Isara', vi: 'Đóng', ko: '닫기' },
    save: { en: 'Save', es: 'Guardar', tl: 'I-save', vi: 'Lưu', ko: '저장' },
    cancel: { en: 'Cancel', es: 'Cancelar', tl: 'Kanselahin', vi: 'Hủy', ko: '취소' },
    next: { en: 'Next', es: 'Siguiente', tl: 'Susunod', vi: 'Tiếp', ko: '다음' },
    back: { en: 'Back', es: 'Atrás', tl: 'Bumalik', vi: 'Quay lại', ko: '뒤로' },
    submit: { en: 'Submit', es: 'Enviar', tl: 'Isumite', vi: 'Gửi', ko: '제출' },
    loading: { en: 'Loading...', es: 'Cargando...', tl: 'Naglo-load...', vi: 'Đang tải...', ko: '로딩...' },
    search: { en: 'Search', es: 'Buscar', tl: 'Maghanap', vi: 'Tìm kiếm', ko: '검색' },
    help: { en: 'Help', es: 'Ayuda', tl: 'Tulong', vi: 'Trợ giúp', ko: '도움말' },
    settings: { en: 'Settings', es: 'Configuración', tl: 'Mga Setting', vi: 'Cài đặt', ko: '설정' },
    error: { en: 'Error', es: 'Error', tl: 'Error', vi: 'Lỗi', ko: '오류' },
    success: { en: 'Success', es: 'Éxito', tl: 'Tagumpay', vi: 'Thành công', ko: '성공' },
    warning: { en: 'Warning', es: 'Advertencia', tl: 'Babala', vi: 'Cảnh báo', ko: '경고' },
    yes: { en: 'Yes', es: 'Sí', tl: 'Oo', vi: 'Có', ko: '예' },
    no: { en: 'No', es: 'No', tl: 'Hindi', vi: 'Không', ko: '아니오' },
    continue: { en: 'Continue', es: 'Continuar', tl: 'Magpatuloy', vi: 'Tiếp tục', ko: '계속' },
    exit: { en: 'Exit', es: 'Salir', tl: 'Lumabas', vi: 'Thoát', ko: '나가기' },
    quickExit: { en: 'Quick Exit', es: 'Salida Rápida', tl: 'Mabilis na Labas', vi: 'Thoát Nhanh', ko: '빠른 종료' },
  },

  // Header & Navigation
  header: {
    title: { en: 'Vet-Rate.org', es: 'Vet-Rate.org', tl: 'Vet-Rate.org', vi: 'Vet-Rate.org', ko: 'Vet-Rate.org' },
    subtitle: { 
      en: 'VA Disability Claims Command Center',
      es: 'Centro de Mando para Reclamaciones de Discapacidad del VA',
      tl: 'Command Center para sa VA Disability Claims',
      vi: 'Trung Tâm Điều Khiển Yêu Cầu Khuyết Tật VA',
      ko: 'VA 장애 청구 관리 센터',
    },
    home: { en: 'Home', es: 'Inicio', tl: 'Home', vi: 'Trang chủ', ko: '홈' },
    tools: { en: 'Tools', es: 'Herramientas', tl: 'Mga Tool', vi: 'Công cụ', ko: '도구' },
    myPacket: { en: 'My Packet', es: 'Mi Paquete', tl: 'Ang Aking Packet', vi: 'Hồ Sơ Của Tôi', ko: '내 패킷' },
    resources: { en: 'Resources', es: 'Recursos', tl: 'Mga Resources', vi: 'Tài nguyên', ko: '자료' },
    aiAssistant: { en: 'AI Assistant', es: 'Asistente IA', tl: 'AI Assistant', vi: 'Trợ lý AI', ko: 'AI 어시스턴트' },
  },

  // Crisis Intervention
  crisis: {
    title: { 
      en: 'Veterans Crisis Line',
      es: 'Línea de Crisis para Veteranos',
      tl: 'Veterans Crisis Line',
      vi: 'Đường Dây Khủng Hoảng Cựu Chiến Binh',
      ko: '재향군인 위기 상담 전화',
    },
    message: {
      en: 'If you or someone you know is in crisis, call 988, press 1',
      es: 'Si usted o alguien que conoce está en crisis, llame al 988, presione 1',
      tl: 'Kung ikaw o kilala mo ay nasa krisis, tumawag sa 988, pindutin ang 1',
      vi: 'Nếu bạn hoặc ai đó bạn biết đang gặp khủng hoảng, gọi 988, nhấn 1',
      ko: '당신이나 아는 분이 위기 상황이라면 988로 전화하고 1을 누르세요',
    },
    youAreNotAlone: {
      en: 'You are not alone. Help is available 24/7.',
      es: 'No estás solo. La ayuda está disponible 24/7.',
      tl: 'Hindi ka nag-iisa. Mayroong tulong 24/7.',
      vi: 'Bạn không đơn độc. Hỗ trợ 24/7.',
      ko: '당신은 혼자가 아닙니다. 24시간 도움을 받을 수 있습니다.',
    },
  },

  // Calculator
  calculator: {
    title: { en: 'VA Rating Calculator', es: 'Calculadora de Rating del VA', tl: 'VA Rating Calculator', vi: 'Máy Tính Xếp Hạng VA', ko: 'VA 등급 계산기' },
    addCondition: { en: 'Add Condition', es: 'Agregar Condición', tl: 'Magdagdag ng Kondisyon', vi: 'Thêm Tình Trạng', ko: '상태 추가' },
    combinedRating: { en: 'Combined Rating', es: 'Rating Combinado', tl: 'Combined Rating', vi: 'Đánh Giá Kết Hợp', ko: '통합 등급' },
    bilateralFactor: { en: 'Bilateral Factor', es: 'Factor Bilateral', tl: 'Bilateral Factor', vi: 'Yếu Tố Song Phương', ko: '양측 요인' },
    monthlyCompensation: { en: 'Monthly Compensation', es: 'Compensación Mensual', tl: 'Buwanang Kompensasyon', vi: 'Bồi Thường Hàng Tháng', ko: '월 보상금' },
  },

  // Voice Features
  voice: {
    enableVoice: { en: 'Enable Voice', es: 'Activar Voz', tl: 'I-enable ang Voice', vi: 'Bật Giọng Nói', ko: '음성 활성화' },
    disableVoice: { en: 'Disable Voice', es: 'Desactivar Voz', tl: 'I-disable ang Voice', vi: 'Tắt Giọng Nói', ko: '음성 비활성화' },
    voiceSettings: { en: 'Voice Settings', es: 'Configuración de Voz', tl: 'Voice Settings', vi: 'Cài Đặt Giọng Nói', ko: '음성 설정' },
    speechRate: { en: 'Speech Rate', es: 'Velocidad del Habla', tl: 'Bilis ng Pagsasalita', vi: 'Tốc Độ Nói', ko: '말하기 속도' },
    speakSlower: { en: 'Speak Slower', es: 'Hablar Más Lento', tl: 'Magsalita ng Mabagal', vi: 'Nói Chậm Hơn', ko: '더 느리게' },
    speakFaster: { en: 'Speak Faster', es: 'Hablar Más Rápido', tl: 'Magsalita ng Mabilis', vi: 'Nói Nhanh Hơn', ko: '더 빠르게' },
    testVoice: { en: 'Test Voice', es: 'Probar Voz', tl: 'Subukan ang Voice', vi: 'Thử Giọng Nói', ko: '음성 테스트' },
    listeningMode: { en: 'Listening...', es: 'Escuchando...', tl: 'Nakikinig...', vi: 'Đang nghe...', ko: '듣는 중...' },
  },

  // Neural Engine / AI
  ai: {
    selectNeuralEngine: { en: 'Select Neural Engine', es: 'Seleccionar Motor Neural', tl: 'Pumili ng Neural Engine', vi: 'Chọn Neural Engine', ko: '뉴럴 엔진 선택' },
    neuralEngineActive: { en: 'Neural Engine Active', es: 'Motor Neural Activo', tl: 'Aktibo ang Neural Engine', vi: 'Neural Engine Đang Hoạt Động', ko: '뉴럴 엔진 활성화됨' },
    initializeAI: { en: 'Initialize AI', es: 'Inicializar IA', tl: 'I-initialize ang AI', vi: 'Khởi Tạo AI', ko: 'AI 초기화' },
    aiReady: { en: 'AI Ready', es: 'IA Lista', tl: 'Handa na ang AI', vi: 'AI Sẵn Sàng', ko: 'AI 준비됨' },
    modelSize: { en: 'Model Size', es: 'Tamaño del Modelo', tl: 'Laki ng Model', vi: 'Kích Thước Model', ko: '모델 크기' },
    vramRequired: { en: 'VRAM Required', es: 'VRAM Requerido', tl: 'Kailangan na VRAM', vi: 'VRAM Cần Thiết', ko: '필요한 VRAM' },
    recommended: { en: 'Recommended', es: 'Recomendado', tl: 'Inirerekomenda', vi: 'Khuyến Nghị', ko: '권장' },
    installed: { en: 'Installed', es: 'Instalado', tl: 'Naka-install', vi: 'Đã Cài Đặt', ko: '설치됨' },
    active: { en: 'Active', es: 'Activo', tl: 'Aktibo', vi: 'Đang Hoạt Động', ko: '활성화' },
    basedOn: { en: 'Based on', es: 'Basado en', tl: 'Batay sa', vi: 'Dựa trên', ko: '기반' },
  },

  // Safety Features
  safety: {
    safeSpace: { 
      en: 'Are you in a safe space?',
      es: '¿Estás en un lugar seguro?',
      tl: 'Nasa ligtas na lugar ka ba?',
      vi: 'Bạn có đang ở nơi an toàn không?',
      ko: '안전한 장소에 계신가요?',
    },
    safeSpaceDesc: {
      en: 'Voice features work best in a private location',
      es: 'Las funciones de voz funcionan mejor en un lugar privado',
      tl: 'Mas mahusay ang voice features sa pribadong lugar',
      vi: 'Tính năng giọng nói hoạt động tốt nhất ở nơi riêng tư',
      ko: '음성 기능은 개인적인 장소에서 가장 잘 작동합니다',
    },
    yesImSafe: { en: "Yes, I'm safe", es: 'Sí, estoy seguro', tl: 'Oo, ligtas ako', vi: 'Vâng, tôi an toàn', ko: '네, 안전합니다' },
    notRightNow: { en: 'Not right now', es: 'Ahora no', tl: 'Hindi ngayon', vi: 'Không phải bây giờ', ko: '지금은 아니요' },
    panicKeyInfo: {
      en: 'Press Escape 3 times quickly to exit immediately',
      es: 'Presiona Escape 3 veces rápido para salir inmediatamente',
      tl: 'Pindutin ang Escape 3 beses para lumabas agad',
      vi: 'Nhấn Escape 3 lần nhanh để thoát ngay',
      ko: 'Escape를 빠르게 3번 누르면 즉시 종료됩니다',
    },
  },

  // Language Settings
  language: {
    selectLanguage: { en: 'Select Language', es: 'Seleccionar Idioma', tl: 'Pumili ng Wika', vi: 'Chọn Ngôn Ngữ', ko: '언어 선택' },
    languageNote: {
      en: 'App will display in your language. VA forms will still be in English.',
      es: 'La app se mostrará en tu idioma. Los formularios del VA seguirán en inglés.',
      tl: 'Makikita mo ang app sa wika mo. Ang VA forms ay mananatiling English.',
      vi: 'Ứng dụng sẽ hiển thị bằng ngôn ngữ của bạn. Các biểu mẫu VA vẫn bằng tiếng Anh.',
      ko: '앱이 선택한 언어로 표시됩니다. VA 양식은 영어로 유지됩니다.',
    },
    currentLanguage: { en: 'Current Language', es: 'Idioma Actual', tl: 'Kasalukuyang Wika', vi: 'Ngôn Ngữ Hiện Tại', ko: '현재 언어' },
  },

  // Branch-specific greetings
  branch: {
    army: { en: 'Hooah, Soldier!', es: '¡Hooah, Soldado!', tl: 'Hooah, Sundalo!', vi: 'Hooah, Chiến sĩ!', ko: 'Hooah, 병사님!' },
    marine: { en: 'Semper Fi, Devil Dog!', es: '¡Semper Fi, Perro del Diablo!', tl: 'Semper Fi, Devil Dog!', vi: 'Semper Fi, Devil Dog!', ko: 'Semper Fi, Devil Dog!' },
    navy: { en: 'Fair winds, Shipmate!', es: '¡Buenos vientos, Marinero!', tl: 'Fair winds, Kasamang Barko!', vi: 'Thuận buồm xuôi gió, Đồng đội!', ko: 'Fair winds, 함께!' },
    airForce: { en: 'Aim High, Airman!', es: '¡Apunta Alto, Aviador!', tl: 'Aim High, Airman!', vi: 'Aim High, Phi công!', ko: 'Aim High, Airman!' },
    coastGuard: { en: 'Semper Paratus, Coastie!', es: '¡Semper Paratus, Guardia Costera!', tl: 'Semper Paratus, Coastie!', vi: 'Semper Paratus, Coastie!', ko: 'Semper Paratus, Coastie!' },
    spaceForce: { en: 'Semper Supra, Guardian!', es: '¡Semper Supra, Guardián!', tl: 'Semper Supra, Guardian!', vi: 'Semper Supra, Guardian!', ko: 'Semper Supra, Guardian!' },
  },

  // Validation messages
  validation: {
    iHearYou: { 
      en: 'I hear you. Your experience is valid.',
      es: 'Te escucho. Tu experiencia es válida.',
      tl: 'Naririnig kita. Valid ang karanasan mo.',
      vi: 'Tôi nghe bạn. Trải nghiệm của bạn là có giá trị.',
      ko: '당신의 말을 듣고 있습니다. 당신의 경험은 소중합니다.',
    },
    youServed: {
      en: 'You served. You earned this. Let\'s get it done.',
      es: 'Serviste. Te lo ganaste. Hagámoslo.',
      tl: 'Naglingkod ka. Nararapat mo ito. Tapusin natin.',
      vi: 'Bạn đã phục vụ. Bạn xứng đáng. Hãy hoàn thành nó.',
      ko: '당신은 복무했습니다. 당신은 이것을 받을 자격이 있습니다. 함께 해결합시다.',
    },
    takingTooLong: {
      en: 'If this is taking too long, it\'s not you - it\'s the system.',
      es: 'Si esto está tomando mucho tiempo, no eres tú - es el sistema.',
      tl: 'Kung matagal ito, hindi ikaw - ang sistema ang problema.',
      vi: 'Nếu điều này mất quá lâu, không phải lỗi của bạn - đó là hệ thống.',
      ko: '이게 오래 걸린다면, 당신 잘못이 아닙니다 - 시스템 문제입니다.',
    },
  },

  // Privacy & Data
  privacy: {
    yourDataStaysHere: {
      en: 'Your data stays on YOUR device. We never see it.',
      es: 'Tus datos permanecen en TU dispositivo. Nosotros nunca los vemos.',
      tl: 'Ang data mo ay nananatili sa SARILI mong device. Hindi namin ito nakikita.',
      vi: 'Dữ liệu của bạn ở trên thiết bị CỦA BẠN. Chúng tôi không bao giờ thấy nó.',
      ko: '당신의 데이터는 당신의 기기에 남습니다. 우리는 절대 보지 않습니다.',
    },
    zeroDataCollection: {
      en: 'Zero data collection. Zero tracking. Your privacy is our honor.',
      es: 'Cero recolección de datos. Cero seguimiento. Tu privacidad es nuestro honor.',
      tl: 'Zero data collection. Zero tracking. Ang privacy mo ay karangalan namin.',
      vi: 'Không thu thập dữ liệu. Không theo dõi. Sự riêng tư của bạn là danh dự của chúng tôi.',
      ko: '데이터 수집 없음. 추적 없음. 당신의 프라이버시는 우리의 명예입니다.',
    },
  },
};

// Create context
const LanguageContext = createContext(null);

/**
 * useLanguage hook - Access language functionality
 */
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

/**
 * LanguageProvider Component
 * Provides app-wide language switching
 */
export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(() => {
    // Try to get saved language, default to English
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved && SUPPORTED_LANGUAGES[saved]) {
      return saved;
    }
    // Try to detect browser language
    const browserLang = navigator.language?.split('-')[0];
    if (browserLang && SUPPORTED_LANGUAGES[browserLang]) {
      return browserLang;
    }
    return 'en';
  });

  // Update language and save to storage
  const setLanguage = useCallback((newLang) => {
    if (SUPPORTED_LANGUAGES[newLang]) {
      setLanguageState(newLang);
      localStorage.setItem(LANGUAGE_STORAGE_KEY, newLang);
      // Update document lang attribute for accessibility
      document.documentElement.lang = newLang;
      document.documentElement.dir = SUPPORTED_LANGUAGES[newLang].direction;
      console.log(`🌐 Language changed to: ${SUPPORTED_LANGUAGES[newLang].nativeName}`);
    }
  }, []);

  // Get translation for a key
  const t = useCallback((section, key) => {
    const sectionData = APP_TRANSLATIONS[section];
    if (!sectionData) {
      console.warn(`Translation section not found: ${section}`);
      return key;
    }
    const keyData = sectionData[key];
    if (!keyData) {
      console.warn(`Translation key not found: ${section}.${key}`);
      return key;
    }
    // Return translation for current language, fallback to English
    return keyData[language] || keyData.en || key;
  }, [language]);

  // Get all translations for a section
  const getSection = useCallback((section) => {
    const sectionData = APP_TRANSLATIONS[section];
    if (!sectionData) {
      return {};
    }
    const result = {};
    for (const [key, translations] of Object.entries(sectionData)) {
      result[key] = translations[language] || translations.en || key;
    }
    return result;
  }, [language]);

  // Get current language metadata
  const getCurrentLanguage = useCallback(() => {
    return SUPPORTED_LANGUAGES[language];
  }, [language]);

  // Get all available languages
  const getAvailableLanguages = useCallback(() => {
    return Object.values(SUPPORTED_LANGUAGES);
  }, []);

  // Check if current language is English
  const isEnglish = language === 'en';

  // Set document language on mount
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = SUPPORTED_LANGUAGES[language].direction;
  }, [language]);

  const value = {
    language,
    setLanguage,
    t,
    getSection,
    getCurrentLanguage,
    getAvailableLanguages,
    isEnglish,
    SUPPORTED_LANGUAGES,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export default LanguageProvider;
