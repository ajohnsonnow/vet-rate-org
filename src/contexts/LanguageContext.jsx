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
  ro: {
    code: 'ro',
    name: 'Romanian',
    nativeName: 'Română',
    flag: '🇷🇴',
    direction: 'ltr',
    voiceCode: 'ro-RO',
    region: 'european',
    note: 'NATO coalition partner - Afghanistan & Iraq operations',
  },
  cs: {
    code: 'cs',
    name: 'Czech',
    nativeName: 'Čeština',
    flag: '🇨🇿',
    direction: 'ltr',
    voiceCode: 'cs-CZ',
    region: 'european',
    note: 'NATO coalition partner',
  },
  sk: {
    code: 'sk',
    name: 'Slovak',
    nativeName: 'Slovenčina',
    flag: '🇸🇰',
    direction: 'ltr',
    voiceCode: 'sk-SK',
    region: 'european',
    note: 'NATO coalition partner',
  },
  bg: {
    code: 'bg',
    name: 'Bulgarian',
    nativeName: 'Български',
    flag: '🇧🇬',
    direction: 'ltr',
    voiceCode: 'bg-BG',
    region: 'european',
    note: 'NATO coalition partner',
  },
  sq: {
    code: 'sq',
    name: 'Albanian',
    nativeName: 'Shqip',
    flag: '🇦🇱',
    direction: 'ltr',
    voiceCode: 'sq-AL',
    region: 'european',
    note: 'NATO coalition partner',
  },
  ka: {
    code: 'ka',
    name: 'Georgian',
    nativeName: 'ქართული',
    flag: '🇬🇪',
    direction: 'ltr',
    voiceCode: 'ka-GE',
    region: 'european',
    note: 'Coalition partner in Afghanistan & Iraq',
  },
  hr: {
    code: 'hr',
    name: 'Croatian',
    nativeName: 'Hrvatski',
    flag: '🇭🇷',
    direction: 'ltr',
    voiceCode: 'hr-HR',
    region: 'european',
    note: 'NATO coalition partner',
  },
  sr: {
    code: 'sr',
    name: 'Serbian',
    nativeName: 'Српски',
    flag: '🇷🇸',
    direction: 'ltr',
    voiceCode: 'sr-RS',
    region: 'european',
  },
  bs: {
    code: 'bs',
    name: 'Bosnian',
    nativeName: 'Bosanski',
    flag: '🇧🇦',
    direction: 'ltr',
    voiceCode: 'bs-BA',
    region: 'european',
  },
  mk: {
    code: 'mk',
    name: 'Macedonian',
    nativeName: 'Македонски',
    flag: '🇲🇰',
    direction: 'ltr',
    voiceCode: 'mk-MK',
    region: 'european',
    note: 'NATO coalition partner',
  },
  et: {
    code: 'et',
    name: 'Estonian',
    nativeName: 'Eesti',
    flag: '🇪🇪',
    direction: 'ltr',
    voiceCode: 'et-EE',
    region: 'european',
    note: 'NATO coalition partner',
  },
  lv: {
    code: 'lv',
    name: 'Latvian',
    nativeName: 'Latviešu',
    flag: '🇱🇻',
    direction: 'ltr',
    voiceCode: 'lv-LV',
    region: 'european',
    note: 'NATO coalition partner',
  },
  lt: {
    code: 'lt',
    name: 'Lithuanian',
    nativeName: 'Lietuvių',
    flag: '🇱🇹',
    direction: 'ltr',
    voiceCode: 'lt-LT',
    region: 'european',
    note: 'NATO coalition partner',
  },
  da: {
    code: 'da',
    name: 'Danish',
    nativeName: 'Dansk',
    flag: '🇩🇰',
    direction: 'ltr',
    voiceCode: 'da-DK',
    region: 'european',
    note: 'NATO coalition partner - significant Afghanistan presence',
  },
  no: {
    code: 'no',
    name: 'Norwegian',
    nativeName: 'Norsk',
    flag: '🇳🇴',
    direction: 'ltr',
    voiceCode: 'no-NO',
    region: 'european',
    note: 'NATO coalition partner',
  },
  sv: {
    code: 'sv',
    name: 'Swedish',
    nativeName: 'Svenska',
    flag: '🇸🇪',
    direction: 'ltr',
    voiceCode: 'sv-SE',
    region: 'european',
    note: 'Coalition partner in Afghanistan',
  },
  fi: {
    code: 'fi',
    name: 'Finnish',
    nativeName: 'Suomi',
    flag: '🇫🇮',
    direction: 'ltr',
    voiceCode: 'fi-FI',
    region: 'european',
    note: 'Coalition partner in Afghanistan',
  },
  nl: {
    code: 'nl',
    name: 'Dutch',
    nativeName: 'Nederlands',
    flag: '🇳🇱',
    direction: 'ltr',
    voiceCode: 'nl-NL',
    region: 'european',
    note: 'NATO coalition partner',
  },
  el: {
    code: 'el',
    name: 'Greek',
    nativeName: 'Ελληνικά',
    flag: '🇬🇷',
    direction: 'ltr',
    voiceCode: 'el-GR',
    region: 'european',
    note: 'NATO coalition partner',
  },
  tr: {
    code: 'tr',
    name: 'Turkish',
    nativeName: 'Türkçe',
    flag: '🇹🇷',
    direction: 'ltr',
    voiceCode: 'tr-TR',
    region: 'european',
    note: 'NATO coalition partner',
  },
  hu: {
    code: 'hu',
    name: 'Hungarian',
    nativeName: 'Magyar',
    flag: '🇭🇺',
    direction: 'ltr',
    voiceCode: 'hu-HU',
    region: 'european',
    note: 'NATO coalition partner',
  },
  sl: {
    code: 'sl',
    name: 'Slovenian',
    nativeName: 'Slovenščina',
    flag: '🇸🇮',
    direction: 'ltr',
    voiceCode: 'sl-SI',
    region: 'european',
    note: 'NATO coalition partner',
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
    add: { en: 'Add', es: 'Agregar', tl: 'Idagdag', vi: 'Thêm', ko: '추가' },
    remove: { en: 'Remove', es: 'Eliminar', tl: 'Alisin', vi: 'Xóa', ko: '삭제' },
    edit: { en: 'Edit', es: 'Editar', tl: 'I-edit', vi: 'Chỉnh sửa', ko: '편집' },
    delete: { en: 'Delete', es: 'Borrar', tl: 'Tanggalin', vi: 'Xóa', ko: '삭제' },
    view: { en: 'View', es: 'Ver', tl: 'Tingnan', vi: 'Xem', ko: '보기' },
    download: { en: 'Download', es: 'Descargar', tl: 'I-download', vi: 'Tải xuống', ko: '다운로드' },
    upload: { en: 'Upload', es: 'Subir', tl: 'I-upload', vi: 'Tải lên', ko: '업로드' },
    import: { en: 'Import', es: 'Importar', tl: 'Mag-import', vi: 'Nhập', ko: '가져오기' },
    export: { en: 'Export', es: 'Exportar', tl: 'I-export', vi: 'Xuất', ko: '내보내기' },
    clear: { en: 'Clear', es: 'Limpiar', tl: 'I-clear', vi: 'Xóa', ko: '지우기' },
    clearAll: { en: 'Clear All', es: 'Limpiar Todo', tl: 'I-clear Lahat', vi: 'Xóa Tất Cả', ko: '모두 지우기' },
    select: { en: 'Select', es: 'Seleccionar', tl: 'Pumili', vi: 'Chọn', ko: '선택' },
    selectAll: { en: 'Select All', es: 'Seleccionar Todo', tl: 'Piliin Lahat', vi: 'Chọn Tất Cả', ko: '모두 선택' },
    details: { en: 'Details', es: 'Detalles', tl: 'Mga Detalye', vi: 'Chi tiết', ko: '세부사항' },
    status: { en: 'Status', es: 'Estado', tl: 'Katayuan', vi: 'Trạng thái', ko: '상태' },
    actions: { en: 'Actions', es: 'Acciones', tl: 'Mga Aksyon', vi: 'Hành động', ko: '작업' },
    total: { en: 'Total', es: 'Total', tl: 'Kabuuan', vi: 'Tổng', ko: '총계' },
    none: { en: 'None', es: 'Ninguno', tl: 'Wala', vi: 'Không có', ko: '없음' },
    all: { en: 'All', es: 'Todos', tl: 'Lahat', vi: 'Tất cả', ko: '모두' },
    new: { en: 'New', es: 'Nuevo', tl: 'Bago', vi: 'Mới', ko: '새로운' },
    beta: { en: 'BETA', es: 'BETA', tl: 'BETA', vi: 'BETA', ko: '베타' },
    core: { en: 'CORE', es: 'NÚCLEO', tl: 'CORE', vi: 'LÕI', ko: '코어' },
    free: { en: 'FREE', es: 'GRATIS', tl: 'LIBRE', vi: 'MIỄN PHÍ', ko: '무료' },
    tools: { en: 'Tools', es: 'Herramientas', tl: 'Mga Kagamitan', vi: 'Công cụ', ko: '도구' },
    resources: { en: 'Resources', es: 'Recursos', tl: 'Mga Mapagkukunan', vi: 'Tài nguyên', ko: '자료' },
    conditions: { en: 'Conditions', es: 'Condiciones', tl: 'Mga Kondisyon', vi: 'Tình trạng', ko: '상태' },
    ratings: { en: 'Ratings', es: 'Clasificaciones', tl: 'Mga Rating', vi: 'Xếp hạng', ko: '등급' },
    claims: { en: 'Claims', es: 'Reclamos', tl: 'Mga Claim', vi: 'Yêu cầu', ko: '청구' },
    evidence: { en: 'Evidence', es: 'Evidencia', tl: 'Ebidensya', vi: 'Bằng chứng', ko: '증거' },
    documents: { en: 'Documents', es: 'Documentos', tl: 'Mga Dokumento', vi: 'Tài liệu', ko: '문서' },
    forms: { en: 'Forms', es: 'Formularios', tl: 'Mga Form', vi: 'Biểu mẫu', ko: '양식' },
  },

  // Loading Bunker Component
  loadingBunker: {
    defaultMessage: { 
      en: 'Loading Bunker...', 
      es: 'Cargando Búnker...', 
      tl: 'Naglo-load ng Bunker...', 
      vi: 'Đang Tải Boongke...', 
      ko: '벙커 로딩 중...' 
    },
    ariaLoading: { 
      en: 'Loading content, please wait', 
      es: 'Cargando contenido, por favor espere', 
      tl: 'Naglo-load ng nilalaman, mangyaring maghintay', 
      vi: 'Đang tải nội dung, vui lòng chờ', 
      ko: '콘텐츠 로딩 중, 잠시 기다려 주세요' 
    },
    loadingData: { 
      en: 'Loading your data...', 
      es: 'Cargando tus datos...', 
      tl: 'Naglo-load ng data mo...', 
      vi: 'Đang tải dữ liệu của bạn...', 
      ko: '데이터 로딩 중...' 
    },
    loadingConditions: { 
      en: 'Loading conditions...', 
      es: 'Cargando condiciones...', 
      tl: 'Naglo-load ng mga kondisyon...', 
      vi: 'Đang tải tình trạng...', 
      ko: '상태 로딩 중...' 
    },
    loadingCalculations: { 
      en: 'Calculating your rating...', 
      es: 'Calculando tu calificación...', 
      tl: 'Kinakalkula ang rating mo...', 
      vi: 'Đang tính xếp hạng của bạn...', 
      ko: '등급 계산 중...' 
    },
    loadingPacket: { 
      en: 'Loading your packet...', 
      es: 'Cargando tu paquete...', 
      tl: 'Naglo-load ng packet mo...', 
      vi: 'Đang tải hồ sơ của bạn...', 
      ko: '패킷 로딩 중...' 
    },
    savingData: { 
      en: 'Saving your data...', 
      es: 'Guardando tus datos...', 
      tl: 'Sine-save ang data mo...', 
      vi: 'Đang lưu dữ liệu của bạn...', 
      ko: '데이터 저장 중...' 
    },
    processingDocument: { 
      en: 'Processing document...', 
      es: 'Procesando documento...', 
      tl: 'Pinoproseso ang dokumento...', 
      vi: 'Đang xử lý tài liệu...', 
      ko: '문서 처리 중...' 
    },
    analyzingFile: { 
      en: 'Analyzing file...', 
      es: 'Analizando archivo...', 
      tl: 'Sinusuri ang file...', 
      vi: 'Đang phân tích tệp...', 
      ko: '파일 분석 중...' 
    },
    preparingExport: { 
      en: 'Preparing export...', 
      es: 'Preparando exportación...', 
      tl: 'Inihahanda ang export...', 
      vi: 'Đang chuẩn bị xuất...', 
      ko: '내보내기 준비 중...' 
    },
    syncingCloud: { 
      en: 'Syncing with cloud...', 
      es: 'Sincronizando con la nube...', 
      tl: 'Nagsi-sync sa cloud...', 
      vi: 'Đang đồng bộ với đám mây...', 
      ko: '클라우드 동기화 중...' 
    },
    loadingSecondary: { 
      en: 'Finding linked conditions...', 
      es: 'Buscando condiciones vinculadas...', 
      tl: 'Naghahanap ng linked conditions...', 
      vi: 'Đang tìm tình trạng liên kết...', 
      ko: '연결된 상태 찾는 중...' 
    },
    initializing: { 
      en: 'Initializing...', 
      es: 'Inicializando...', 
      tl: 'Nag-i-initialize...', 
      vi: 'Đang khởi tạo...', 
      ko: '초기화 중...' 
    },
    loadingAI: { 
      en: 'AI analyzing...', 
      es: 'IA analizando...', 
      tl: 'AI nagsa-analyze...', 
      vi: 'AI đang phân tích...', 
      ko: 'AI 분석 중...' 
    },
    tip1: { 
      en: 'Tip: Save your work often using The Bunker!', 
      es: 'Consejo: ¡Guarda tu trabajo frecuentemente usando El Búnker!', 
      tl: 'Tip: I-save ang trabaho mo madalas gamit ang Bunker!', 
      vi: 'Mẹo: Lưu công việc thường xuyên bằng Boongke!', 
      ko: '팁: 벙커를 사용하여 작업을 자주 저장하세요!' 
    },
    tip2: { 
      en: 'Tip: Check Secondary Scout for linked conditions', 
      es: 'Consejo: Revisa Secondary Scout para condiciones vinculadas', 
      tl: 'Tip: Tingnan ang Secondary Scout para sa linked conditions', 
      vi: 'Mẹo: Kiểm tra Secondary Scout để tìm tình trạng liên kết', 
      ko: '팁: 연결된 상태를 위해 Secondary Scout를 확인하세요' 
    },
    tip3: { 
      en: 'Tip: Your data stays on YOUR device - 100% private', 
      es: 'Consejo: Tus datos se quedan en TU dispositivo - 100% privado', 
      tl: 'Tip: Ang data mo ay nananatili sa IYONG device - 100% private', 
      vi: 'Mẹo: Dữ liệu của bạn ở trên thiết bị CỦA BẠN - 100% riêng tư', 
      ko: '팁: 데이터는 당신의 기기에 저장됩니다 - 100% 비공개' 
    },
  },

  // Disclaimer Splash Screen
  splash: {
    welcomeVeteran: { en: 'Welcome, Fellow Veteran', es: 'Bienvenido, Compañero Veterano', tl: 'Maligayang Pagdating, Kapwa Beterano', vi: 'Chào Mừng, Đồng Đội Cựu Chiến Binh', ko: '환영합니다, 동료 재향군인' },
    yourClaimsToolkit: { en: 'Your complete VA claims toolkit - built by one of your own', es: 'Tu kit completo de reclamos VA - creado por uno de los tuyos', tl: 'Ang kumpletong VA claims toolkit mo - gawa ng kapwa mo', vi: 'Bộ công cụ yêu cầu VA đầy đủ của bạn - được xây dựng bởi một người trong số bạn', ko: '당신의 완전한 VA 청구 도구 - 동료가 만든' },
    fromOneVeteran: { en: 'From one veteran to another:', es: 'De un veterano a otro:', tl: 'Mula sa isang beterano sa isa pa:', vi: 'Từ một cựu chiến binh đến một cựu chiến binh khác:', ko: '한 재향군인에서 다른 재향군인에게:' },
    personalMessage: { 
      en: "I built this complete claims arsenal because navigating the VA disability system shouldn't feel like another deployment.",
      es: 'Construí este arsenal completo de reclamos porque navegar el sistema de discapacidad del VA no debería sentirse como otro despliegue.',
      tl: 'Ginawa ko ang kumpletong claims arsenal na ito dahil ang pag-navigate sa VA disability system ay hindi dapat parang isa pang deployment.',
      vi: 'Tôi xây dựng kho vũ khí yêu cầu hoàn chỉnh này vì việc điều hướng hệ thống khuyết tật VA không nên giống như một lần triển khai khác.',
      ko: '저는 VA 장애 시스템 탐색이 또 다른 배치처럼 느껴지지 않도록 이 완전한 청구 무기고를 구축했습니다.'
    },
    noLoginRequired: { en: 'No Login Required', es: 'Sin Inicio de Sesión', tl: 'Walang Login Kailangan', vi: 'Không Cần Đăng Nhập', ko: '로그인 필요 없음' },
    yourPrivacyMatters: { en: 'Your privacy matters', es: 'Tu privacidad importa', tl: 'Mahalaga ang privacy mo', vi: 'Sự riêng tư của bạn quan trọng', ko: '당신의 개인정보가 중요합니다' },
    hundredPercentFree: { en: '100% Free', es: '100% Gratis', tl: '100% Libre', vi: '100% Miễn Phí', ko: '100% 무료' },
    noHiddenFees: { en: 'No hidden fees ever', es: 'Sin cargos ocultos nunca', tl: 'Walang nakatagong bayad', vi: 'Không có phí ẩn', ko: '숨겨진 비용 없음' },
    noDataSold: { en: 'No Data Sold', es: 'Sin Venta de Datos', tl: 'Walang Data na Ibinebenta', vi: 'Không Bán Dữ Liệu', ko: '데이터 판매 없음' },
    youAreNotTracked: { en: "You're not tracked", es: 'No te rastrean', tl: 'Hindi ka tina-track', vi: 'Bạn không bị theo dõi', ko: '추적되지 않습니다' },
    yourClaimsArsenal: { en: 'Your Claims Arsenal Includes', es: 'Tu Arsenal de Reclamos Incluye', tl: 'Ang Claims Arsenal Mo ay May Kasama', vi: 'Kho Vũ Khí Yêu Cầu Của Bạn Bao Gồm', ko: '청구 무기고에 포함된 것' },
    quickNote: { en: 'Quick note:', es: 'Nota rápida:', tl: 'Mabilis na tala:', vi: 'Ghi chú nhanh:', ko: '빠른 메모:' },
    notVSOOrLawFirm: { 
      en: 'This is an educational resource, not a VSO or law firm. For official claims assistance, your local VSO is a great free resource.',
      es: 'Este es un recurso educativo, no un VSO o bufete de abogados. Para asistencia oficial, tu VSO local es un gran recurso gratuito.',
      tl: 'Ito ay isang educational resource, hindi VSO o law firm. Para sa opisyal na tulong, ang lokal mong VSO ay isang mahusay na libreng resource.',
      vi: 'Đây là tài nguyên giáo dục, không phải VSO hoặc công ty luật. Để được hỗ trợ chính thức, VSO địa phương của bạn là nguồn tài nguyên miễn phí tuyệt vời.',
      ko: '이것은 교육 자료이며 VSO나 법률 사무소가 아닙니다. 공식 청구 지원을 위해 지역 VSO가 훌륭한 무료 자료입니다.'
    },
    enterVetRate: { en: 'Enter Vet-Rate.org', es: 'Entrar a Vet-Rate.org', tl: 'Pumasok sa Vet-Rate.org', vi: 'Vào Vet-Rate.org', ko: 'Vet-Rate.org 입장' },
    thankYouForService: { en: "Thank you for your service. Let's get you the information you deserve.", es: 'Gracias por tu servicio. Vamos a darte la información que mereces.', tl: 'Salamat sa iyong serbisyo. Ibigay natin sa iyo ang impormasyong karapat-dapat sa iyo.', vi: 'Cảm ơn bạn đã phục vụ. Hãy để chúng tôi cung cấp cho bạn thông tin bạn xứng đáng.', ko: '복무에 감사드립니다. 당신이 받을 자격이 있는 정보를 드리겠습니다.' },
    fellowDisabledVeteran: { en: 'A fellow service-disabled veteran', es: 'Un compañero veterano discapacitado', tl: 'Isang kapwa service-disabled veteran', vi: 'Một đồng đội cựu chiến binh khuyết tật', ko: '동료 복무 장애 재향군인' },
    // Feature list items
    professionalGradeTools: { en: 'professional-grade tools', es: 'herramientas profesionales', tl: 'mga propesyonal na tool', vi: 'công cụ chuyên nghiệp', ko: '전문 도구' },
    coveringEverything: { en: 'covering everything from initial research through appeals', es: 'cubriendo todo desde la investigación inicial hasta las apelaciones', tl: 'sakop ang lahat mula sa paunang research hanggang sa appeals', vi: 'bao gồm mọi thứ từ nghiên cứu ban đầu đến kháng cáo', ko: '초기 조사부터 항소까지 모든 것을 포함' },
    ratedConditions: { en: 'rated conditions', es: 'condiciones calificadas', tl: 'mga rated conditions', vi: 'tình trạng được đánh giá', ko: '등급 조건' },
    advancedCalculators: { en: 'advanced calculators, AI document analysis, C&P exam prep, and complete evidence builders', es: 'calculadoras avanzadas, análisis de documentos con IA, preparación para exámenes C&P y constructores de evidencia completos', tl: 'mga advanced calculator, AI document analysis, C&P exam prep, at complete evidence builders', vi: 'máy tính nâng cao, phân tích tài liệu AI, chuẩn bị khám C&P và công cụ tạo bằng chứng hoàn chỉnh', ko: '고급 계산기, AI 문서 분석, C&P 시험 준비 및 완전한 증거 작성기' },
    allFreeNoTricks: { en: 'All free, no tricks, no sales pitches.', es: 'Todo gratis, sin trucos, sin argumentos de venta.', tl: 'Lahat libre, walang trick, walang sales pitch.', vi: 'Tất cả miễn phí, không lừa đảo, không quảng cáo.', ko: '모두 무료, 속임수 없음, 판매 설득 없음.' },
    conditionsWithCriteria: { en: 'conditions with official VA rating criteria from 38 CFR Part 4', es: 'condiciones con criterios oficiales de calificación VA de 38 CFR Parte 4', tl: 'mga kondisyon na may opisyal na VA rating criteria mula sa 38 CFR Part 4', vi: 'điều kiện với tiêu chí đánh giá VA chính thức từ 38 CFR Phần 4', ko: '38 CFR 파트 4의 공식 VA 등급 기준이 있는 조건' },
    tacticalCalculatorDesc: { en: 'combined ratings with 2026 pay rates & lifetime projections', es: 'calificaciones combinadas con tasas de pago 2026 y proyecciones de por vida', tl: 'combined ratings na may 2026 pay rates at lifetime projections', vi: 'xếp hạng kết hợp với mức lương 2026 và dự báo trọn đời', ko: '2026년 급여율 및 평생 예상치와 결합된 등급' },
    tacticalCalculator: { en: 'Tactical Calculator', es: 'Calculadora Táctica', tl: 'Tactical Calculator', vi: 'Máy Tính Chiến Thuật', ko: '전술 계산기' },
    secondaryScoutDesc: { en: 'discover 500+ linked conditions to maximize your rating', es: 'descubre más de 500 condiciones vinculadas para maximizar tu calificación', tl: 'tuklasin ang 500+ na linked conditions para ma-maximize ang rating mo', vi: 'khám phá hơn 500 tình trạng liên kết để tối đa hóa xếp hạng của bạn', ko: '등급을 최대화하기 위해 500개 이상의 연결된 상태 발견' },
    secondaryScout: { en: 'Secondary Scout', es: 'Explorador Secundario', tl: 'Secondary Scout', vi: 'Trinh Sát Thứ Cấp', ko: '2차 스카우트' },
    cpExamSimulator: { en: 'C&P Exam Simulator', es: 'Simulador de Examen C&P', tl: 'C&P Exam Simulator', vi: 'Mô Phỏng Khám C&P', ko: 'C&P 시험 시뮬레이터' },
    cpExamSimulatorDesc: { en: 'practice with DBQ-aligned questions', es: 'practica con preguntas alineadas a DBQ', tl: 'mag-practice gamit ang DBQ-aligned questions', vi: 'thực hành với các câu hỏi phù hợp DBQ', ko: 'DBQ 연계 질문으로 연습' },
    cFileAiAnalyzer: { en: 'C-File AI Analyzer', es: 'Analizador de C-File con IA', tl: 'C-File AI Analyzer', vi: 'Phân Tích C-File AI', ko: 'C-File AI 분석기' },
    cFileAiAnalyzerDesc: { en: 'what others charge $500+ for, FREE', es: 'lo que otros cobran $500+, GRATIS', tl: 'ang sinisingil ng iba ng $500+, LIBRE', vi: 'những gì người khác tính phí $500+, MIỄN PHÍ', ko: '다른 곳에서 $500 이상 청구하는 것을 무료로' },
    formsHelperEvidence: { en: 'Forms Helper & Evidence Builders', es: 'Asistente de Formularios y Constructores de Evidencia', tl: 'Forms Helper at Evidence Builders', vi: 'Trợ Giúp Biểu Mẫu & Công Cụ Tạo Bằng Chứng', ko: '양식 도우미 & 증거 작성기' },
    formsHelperEvidenceDesc: { en: 'nexus statements, buddy statements, symptom tracking', es: 'declaraciones de nexo, declaraciones de compañeros, seguimiento de síntomas', tl: 'nexus statements, buddy statements, symptom tracking', vi: 'báo cáo nexus, lời khai đồng đội, theo dõi triệu chứng', ko: '넥서스 진술, 동료 진술, 증상 추적' },
    strategicTools: { en: 'Strategic Tools', es: 'Herramientas Estratégicas', tl: 'Mga Strategic Tools', vi: 'Công Cụ Chiến Lược', ko: '전략적 도구' },
    strategicToolsDesc: { en: 'Pathfinder, Risk Assessment, VSO Finder, State Benefits', es: 'Pathfinder, Evaluación de Riesgos, Buscador de VSO, Beneficios Estatales', tl: 'Pathfinder, Risk Assessment, VSO Finder, State Benefits', vi: 'Pathfinder, Đánh Giá Rủi Ro, Tìm VSO, Lợi Ích Tiểu Bang', ko: '패스파인더, 위험 평가, VSO 찾기, 주 혜택' },
    myPacket: { en: 'My Packet', es: 'Mi Paquete', tl: 'My Packet', vi: 'Hồ Sơ Của Tôi', ko: '내 패킷' },
    myPacketDesc: { en: 'organize all evidence and track your claims', es: 'organiza toda la evidencia y rastrea tus reclamos', tl: 'i-organize ang lahat ng ebidensya at i-track ang iyong claims', vi: 'sắp xếp tất cả bằng chứng và theo dõi yêu cầu của bạn', ko: '모든 증거를 정리하고 청구를 추적' },
    professionalToolsFooter: { en: 'professional tools - everything from research to appeal. All free.', es: 'herramientas profesionales - todo desde investigación hasta apelación. Todo gratis.', tl: 'mga propesyonal na tool - lahat mula research hanggang appeal. Lahat libre.', vi: 'công cụ chuyên nghiệp - mọi thứ từ nghiên cứu đến kháng cáo. Tất cả miễn phí.', ko: '전문 도구 - 연구부터 항소까지 모든 것. 모두 무료.' },
  },


  // Tools Menu Categories
  toolsMenu: {
    calculateYourRating: { en: 'Calculate Your Rating', es: 'Calcula Tu Rating', tl: 'Kalkulahin ang Rating Mo', vi: 'Tính Xếp Hạng Của Bạn', ko: '등급 계산하기' },
    discoverYourClaims: { en: 'Discover Your Claims', es: 'Descubre Tus Reclamos', tl: 'Tuklasin ang Mga Claim Mo', vi: 'Khám Phá Yêu Cầu Của Bạn', ko: '청구 발견하기' },
    buildYourEvidence: { en: 'Build Your Evidence', es: 'Construye Tu Evidencia', tl: 'Buuin ang Ebidensya Mo', vi: 'Xây Dựng Bằng Chứng', ko: '증거 구축하기' },
    qualityControl: { en: 'Quality Control', es: 'Control de Calidad', tl: 'Quality Control', vi: 'Kiểm Soát Chất Lượng', ko: '품질 관리' },
    maximizeYourRating: { en: 'Maximize Your Rating', es: 'Maximiza Tu Rating', tl: 'I-maximize ang Rating Mo', vi: 'Tối Đa Hóa Xếp Hạng', ko: '등급 극대화' },
    supportResources: { en: 'Support & Resources', es: 'Apoyo y Recursos', tl: 'Suporta at Resources', vi: 'Hỗ Trợ & Tài Nguyên', ko: '지원 & 자료' },
  },

  // Individual Tools
  tools: {
    tacticalCalculator: { en: 'Tactical Calculator', es: 'Calculadora Táctica', tl: 'Tactical Calculator', vi: 'Máy Tính Chiến Thuật', ko: '전술 계산기' },
    tacticalCalculatorDesc: { en: 'VA Math calculator with 2026 rates', es: 'Calculadora de matemáticas VA con tasas 2026', tl: 'VA Math calculator na may 2026 rates', vi: 'Máy tính Toán VA với tỷ lệ 2026', ko: '2026년 요율 VA 계산기' },
    millionDollarDashboard: { en: 'Million Dollar Dashboard', es: 'Panel del Millón de Dólares', tl: 'Million Dollar Dashboard', vi: 'Bảng Điều Khiển Triệu Đô', ko: '백만 달러 대시보드' },
    millionDollarDashboardDesc: { en: 'See your lifetime benefits value', es: 'Ve el valor de tus beneficios de por vida', tl: 'Tingnan ang lifetime benefits value mo', vi: 'Xem giá trị lợi ích trọn đời của bạn', ko: '평생 혜택 가치 보기' },
    whatIfSandbox: { en: 'What-If Sandbox', es: 'Sandbox Qué-Si', tl: 'What-If Sandbox', vi: 'Hộp Cát Giả Định', ko: '가정 샌드박스' },
    whatIfSandboxDesc: { en: 'Scenario planner with real VA math', es: 'Planificador de escenarios con matemáticas VA reales', tl: 'Scenario planner na may totoong VA math', vi: 'Công cụ lập kế hoạch kịch bản với toán VA thực', ko: '실제 VA 수학으로 시나리오 계획' },
    retroPayHunter: { en: 'Retro Pay Hunter', es: 'Cazador de Pago Retroactivo', tl: 'Retro Pay Hunter', vi: 'Người Săn Lương Hồi Tố', ko: '소급 급여 헌터' },
    retroPayHunterDesc: { en: 'Find missed back pay & CUE claims', es: 'Encuentra pagos atrasados perdidos y reclamos CUE', tl: 'Hanapin ang mga napalampas na back pay at CUE claims', vi: 'Tìm các khoản lương còn thiếu & yêu cầu CUE', ko: '누락된 급여 및 CUE 청구 찾기' },
    timeMachine: { en: 'Time Machine', es: 'Máquina del Tiempo', tl: 'Time Machine', vi: 'Cỗ Máy Thời Gian', ko: '타임머신' },
    timeMachineDesc: { en: 'Intent to File countdown & backpay tracker', es: 'Cuenta regresiva de Intent to File y rastreador de pagos', tl: 'Intent to File countdown at backpay tracker', vi: 'Đếm ngược Intent to File & theo dõi lương', ko: 'Intent to File 카운트다운 & 급여 추적기' },
    secondaryScout: { en: 'Secondary Scout', es: 'Explorador Secundario', tl: 'Secondary Scout', vi: 'Trinh Sát Thứ Cấp', ko: '2차 스카우트' },
    secondaryScoutDesc: { en: 'Find 500+ linked conditions', es: 'Encuentra más de 500 condiciones vinculadas', tl: 'Hanapin ang 500+ na linked conditions', vi: 'Tìm hơn 500 tình trạng liên kết', ko: '500개 이상의 연결된 상태 찾기' },
    capSimulator: { en: 'C&P Exam Simulator', es: 'Simulador de Examen C&P', tl: 'C&P Exam Simulator', vi: 'Mô Phỏng Khám C&P', ko: 'C&P 시험 시뮬레이터' },
    capSimulatorDesc: { en: 'Practice with DBQ-aligned exam questions + Exam Prep', es: 'Practica con preguntas de examen alineadas a DBQ + Preparación', tl: 'Mag-practice ng DBQ-aligned exam questions + Exam Prep', vi: 'Thực hành câu hỏi khám theo DBQ + Chuẩn bị Khám', ko: 'DBQ 연계 시험 질문 연습 + 시험 준비' },
    pathfinder: { en: 'Pathfinder', es: 'Buscador de Rutas', tl: 'Pathfinder', vi: 'Người Tìm Đường', ko: '패스파인더' },
    pathfinderDesc: { en: 'AI strategy: increases, secondaries & next steps', es: 'Estrategia de IA: aumentos, secundarios y próximos pasos', tl: 'AI strategy: increases, secondaries at next steps', vi: 'Chiến lược AI: tăng, thứ cấp & bước tiếp theo', ko: 'AI 전략: 증가, 2차 및 다음 단계' },
    claimNavigator: { en: 'Claim Navigator', es: 'Navegador de Reclamos', tl: 'Claim Navigator', vi: 'Người Dẫn Đường Yêu Cầu', ko: '청구 내비게이터' },
    claimNavigatorDesc: { en: 'Mission Control: Track claims, deadlines & next steps', es: 'Centro de Control: Rastrea reclamos, fechas límite y próximos pasos', tl: 'Mission Control: I-track ang claims, deadlines at next steps', vi: 'Trung Tâm Điều Khiển: Theo dõi yêu cầu, thời hạn & bước tiếp theo', ko: '미션 컨트롤: 청구, 마감일 및 다음 단계 추적' },
    mosHazardMatcher: { en: 'MOS Hazard Matcher', es: 'Coincidencia de Peligros MOS', tl: 'MOS Hazard Matcher', vi: 'Đối Chiếu Nguy Hiểm MOS', ko: 'MOS 위험 매처' },
    mosHazardMatcherDesc: { en: 'Find injuries linked to your MOS', es: 'Encuentra lesiones vinculadas a tu MOS', tl: 'Hanapin ang mga injury na naka-link sa MOS mo', vi: 'Tìm chấn thương liên quan đến MOS của bạn', ko: 'MOS와 연결된 부상 찾기' },
    pactActNavigator: { en: 'PACT Act Navigator', es: 'Navegador de Ley PACT', tl: 'PACT Act Navigator', vi: 'Hướng Dẫn Đạo Luật PACT', ko: 'PACT 법 내비게이터' },
    pactActNavigatorDesc: { en: 'Find your presumptive conditions', es: 'Encuentra tus condiciones presuntivas', tl: 'Hanapin ang presumptive conditions mo', vi: 'Tìm các tình trạng được suy đoán', ko: '추정 상태 찾기' },
    webOfConditions: { en: 'Web of Conditions', es: 'Red de Condiciones', tl: 'Web of Conditions', vi: 'Mạng Lưới Tình Trạng', ko: '상태 웹' },
    webOfConditionsDesc: { en: 'Visual map of connected conditions', es: 'Mapa visual de condiciones conectadas', tl: 'Visual map ng connected conditions', vi: 'Bản đồ trực quan của các tình trạng kết nối', ko: '연결된 상태의 시각적 지도' },
    cFileAnalyzer: { en: 'C-File Analyzer', es: 'Analizador de C-File', tl: 'C-File Analyzer', vi: 'Phân Tích C-File', ko: 'C-File 분석기' },
    cFileAnalyzerDesc: { en: 'AI analysis of your claims file (worth $500+)', es: 'Análisis de IA de tu archivo de reclamos (valor $500+)', tl: 'AI analysis ng claims file mo (worth $500+)', vi: 'Phân tích AI hồ sơ yêu cầu của bạn (trị giá $500+)', ko: '청구 파일 AI 분석 (가치 $500+)' },
    blueButtonXRay: { en: 'Blue Button X-Ray', es: 'Rayos X de Blue Button', tl: 'Blue Button X-Ray', vi: 'X-Ray Blue Button', ko: '블루 버튼 X-Ray' },
    blueButtonXRayDesc: { en: 'Analyze VA Blue Button health records', es: 'Analiza los registros de salud Blue Button del VA', tl: 'Suriin ang VA Blue Button health records', vi: 'Phân tích hồ sơ sức khỏe Blue Button VA', ko: 'VA Blue Button 건강 기록 분석' },
    recordSearch: { en: 'Record Search', es: 'Búsqueda de Registros', tl: 'Record Search', vi: 'Tìm Kiếm Hồ Sơ', ko: '기록 검색' },
    recordSearchDesc: { en: 'Search 2,000+ page STRs for keywords', es: 'Busca palabras clave en más de 2,000 páginas de STRs', tl: 'Maghanap ng keywords sa 2,000+ page STRs', vi: 'Tìm kiếm từ khóa trong hơn 2,000 trang STR', ko: '2,000+ 페이지 STR에서 키워드 검색' },
    witnessBench: { en: 'Witness Bench', es: 'Banco de Testigos', tl: 'Witness Bench', vi: 'Ghế Nhân Chứng', ko: '증인석' },
    witnessBenchDesc: { en: 'Buddy statement builder', es: 'Creador de declaraciones de compañeros', tl: 'Buddy statement builder', vi: 'Công cụ tạo lời khai đồng đội', ko: '동료 진술서 작성기' },
    nexusBuilder: { en: 'Nexus Builder', es: 'Constructor de Nexus', tl: 'Nexus Builder', vi: 'Xây Dựng Nexus', ko: '넥서스 빌더' },
    nexusBuilderDesc: { en: 'Build medical connection arguments', es: 'Construye argumentos de conexión médica', tl: 'Buuin ang medical connection arguments', vi: 'Xây dựng lập luận kết nối y tế', ko: '의료 연결 논증 구축' },
    formsHelper: { en: 'Forms Helper', es: 'Asistente de Formularios', tl: 'Forms Helper', vi: 'Trợ Giúp Biểu Mẫu', ko: '양식 도우미' },
    formsHelperDesc: { en: 'Guided VA forms with Auto-Scribe', es: 'Formularios VA guiados con Auto-Scribe', tl: 'Guided VA forms na may Auto-Scribe', vi: 'Biểu mẫu VA hướng dẫn với Auto-Scribe', ko: 'Auto-Scribe가 있는 안내 VA 양식' },
    symptomLogger: { en: 'Symptom Logger', es: 'Registro de Síntomas', tl: 'Symptom Logger', vi: 'Nhật Ký Triệu Chứng', ko: '증상 기록기' },
    symptomLoggerDesc: { en: 'Track symptoms with timestamp evidence', es: 'Rastrea síntomas con evidencia de marca de tiempo', tl: 'I-track ang symptoms na may timestamp evidence', vi: 'Theo dõi triệu chứng với bằng chứng thời gian', ko: '타임스탬프 증거로 증상 추적' },
    painPainter: { en: 'Pain Painter', es: 'Pintor de Dolor', tl: 'Pain Painter', vi: 'Vẽ Đau', ko: '통증 화가' },
    somaticTarget: { en: 'Somatic Target', es: 'Objetivo Somático', tl: 'Somatic Target', vi: 'Mục Tiêu Cơ Thể', ko: '신체 타겟' },
    somaticTargetDesc: { en: 'Interactive body map selector', es: 'Selector interactivo de mapa corporal', tl: 'Interactive body map selector', vi: 'Công cụ chọn bản đồ cơ thể tương tác', ko: '대화형 신체 지도 선택기' },
    evidenceTimeline: { en: 'Evidence Timeline', es: 'Línea de Tiempo de Evidencia', tl: 'Evidence Timeline', vi: 'Dòng Thời Gian Bằng Chứng', ko: '증거 타임라인' },
    evidenceTimelineDesc: { en: 'Visual continuity tracker with gap detection', es: 'Rastreador visual de continuidad con detección de brechas', tl: 'Visual continuity tracker na may gap detection', vi: 'Trình theo dõi liên tục trực quan với phát hiện khoảng trống', ko: '갭 감지 기능이 있는 시각적 연속성 추적기' },
    foiaGenerator: { en: 'FOIA Generator', es: 'Generador FOIA', tl: 'FOIA Generator', vi: 'Công Cụ Tạo FOIA', ko: 'FOIA 생성기' },
    foiaKeysmith: { en: 'FOIA Keysmith', es: 'Creador de FOIA', tl: 'FOIA Keysmith', vi: 'Thợ Khóa FOIA', ko: 'FOIA 열쇠공' },
    foiaKeysmithDesc: { en: 'Generate FOIA requests for records', es: 'Genera solicitudes FOIA para registros', tl: 'Gumawa ng FOIA requests para sa records', vi: 'Tạo yêu cầu FOIA cho hồ sơ', ko: '기록을 위한 FOIA 요청 생성' },
    redTeam: { en: 'Red Team', es: 'Equipo Rojo', tl: 'Red Team', vi: 'Đội Đỏ', ko: '레드 팀' },
    redTeamDesc: { en: "Devil's advocate for your claims", es: 'Abogado del diablo para tus reclamos', tl: "Devil's advocate para sa claims mo", vi: 'Người phản biện cho yêu cầu của bạn', ko: '청구를 위한 악마의 변호인' },
    claimStressTest: { en: 'Claim Stress Test', es: 'Prueba de Estrés de Reclamo', tl: 'Claim Stress Test', vi: 'Kiểm Tra Căng Thẳng Yêu Cầu', ko: '청구 스트레스 테스트' },
    theWarGame: { en: 'The War Game', es: 'El Juego de Guerra', tl: 'The War Game', vi: 'Trò Chơi Chiến Tranh', ko: '워 게임' },
    theWarGameDesc: { en: 'Skeptical Examiner stress-tests your claim', es: 'El Examinador Escéptico prueba tu reclamo bajo estrés', tl: 'Ang Skeptical Examiner ang nag-stress-test sa claim mo', vi: 'Người Kiểm Tra Hoài Nghi kiểm tra căng thẳng yêu cầu của bạn', ko: '회의적 심사관이 청구를 스트레스 테스트합니다' },
    decisionDecoder: { en: 'Decision Decoder', es: 'Decodificador de Decisiones', tl: 'Decision Decoder', vi: 'Giải Mã Quyết Định', ko: '결정 디코더' },
    decisionDecoderDesc: { en: 'Analyze VA decision letters', es: 'Analiza cartas de decisión del VA', tl: 'Suriin ang VA decision letters', vi: 'Phân tích thư quyết định VA', ko: 'VA 결정 서신 분석' },
    denialDecoder: { en: 'Denial Decoder', es: 'Decodificador de Denegaciones', tl: 'Denial Decoder', vi: 'Giải Mã Từ Chối', ko: '거부 디코더' },
    denialsDecoder: { en: 'Denials Decoder', es: 'Decodificador de Denegaciones', tl: 'Denials Decoder', vi: 'Giải Mã Từ Chối', ko: '거부 디코더' },
    denialsDecoderDesc: { en: 'Scan denial letters & decode in plain English', es: 'Escanea cartas de denegación y decodifica en inglés simple', tl: 'I-scan ang denial letters at i-decode sa plain English', vi: 'Quét thư từ chối & giải mã bằng tiếng Anh đơn giản', ko: '거부 서신을 스캔하고 평이한 영어로 해독' },
    sharkRadar: { en: 'Shark Radar', es: 'Radar de Tiburones', tl: 'Shark Radar', vi: 'Radar Cá Mập', ko: '상어 레이더' },
    sharkRadarDesc: { en: 'Identify and avoid claims predators', es: 'Identifica y evita depredadores de reclamos', tl: 'Tukuyin at iwasan ang claims predators', vi: 'Xác định và tránh kẻ lừa đảo yêu cầu', ko: '청구 약탈자 식별 및 회피' },
    consistencyEngine: { en: 'Consistency Engine', es: 'Motor de Consistencia', tl: 'Consistency Engine', vi: 'Công Cụ Nhất Quán', ko: '일관성 엔진' },
    consistencyEngineDesc: { en: 'Auto-detect contradictions before VA finds them', es: 'Detecta automáticamente contradicciones antes de que el VA las encuentre', tl: 'Auto-detect ng contradictions bago hanapin ng VA', vi: 'Tự động phát hiện mâu thuẫn trước khi VA tìm thấy', ko: 'VA가 발견하기 전에 모순을 자동 감지' },
    evidenceGapVisualizer: { en: 'Evidence Gap Visualizer', es: 'Visualizador de Brechas', tl: 'Evidence Gap Visualizer', vi: 'Trực Quan Hóa Khoảng Trống', ko: '증거 갭 시각화' },
    evidenceGapFinder: { en: 'Evidence Gap Finder', es: 'Buscador de Brechas de Evidencia', tl: 'Evidence Gap Finder', vi: 'Công Cụ Tìm Khoảng Trống Bằng Chứng', ko: '증거 갭 찾기' },
    evidenceGapFinderDesc: { en: 'See exactly what evidence is missing', es: 'Ve exactamente qué evidencia falta', tl: 'Tingnan kung anong ebidensya ang kulang', vi: 'Xem chính xác bằng chứng nào còn thiếu', ko: '정확히 어떤 증거가 누락되었는지 확인' },
    riskAssessment: { en: 'Risk Assessment', es: 'Evaluación de Riesgos', tl: 'Risk Assessment', vi: 'Đánh Giá Rủi Ro', ko: '위험 평가' },
    riskAssessmentDesc: { en: 'Check protections before filing', es: 'Verifica protecciones antes de presentar', tl: 'Suriin ang protections bago mag-file', vi: 'Kiểm tra bảo vệ trước khi nộp', ko: '제출 전 보호 확인' },
    tdiuBuilder: { en: 'TDIU Builder', es: 'Constructor TDIU', tl: 'TDIU Builder', vi: 'Xây Dựng TDIU', ko: 'TDIU 빌더' },
    tdiuBuilderDesc: { en: 'Total Disability Individual Unemployability', es: 'Discapacidad Total por Desempleo Individual', tl: 'Total Disability Individual Unemployability', vi: 'Tàn Tật Toàn Diện Không Thể Làm Việc', ko: '전체 장애 개인 실업' },
    stateBenefitHunter: { en: 'State Benefit Hunter', es: 'Cazador de Beneficios Estatales', tl: 'State Benefit Hunter', vi: 'Người Săn Lợi Ích Tiểu Bang', ko: '주 혜택 헌터' },
    stateBenefitHunterDesc: { en: 'Find state-specific veteran benefits', es: 'Encuentra beneficios estatales específicos para veteranos', tl: 'Hanapin ang state-specific na benefits para sa veterans', vi: 'Tìm quyền lợi cựu chiến binh theo tiểu bang', ko: '주별 재향군인 혜택 찾기' },
    theTribunal: { en: 'The Tribunal', es: 'El Tribunal', tl: 'The Tribunal', vi: 'Tòa Án', ko: '재판소' },
    theTribunalDesc: { en: 'Mock BVA hearing simulator', es: 'Simulador de audiencia BVA simulada', tl: 'Mock BVA hearing simulator', vi: 'Mô phỏng phiên điều trần BVA', ko: '모의 BVA 청문회 시뮬레이터' },
    legislativeWatchdog: { en: 'Legislative Watchdog', es: 'Vigilante Legislativo', tl: 'Legislative Watchdog', vi: 'Giám Sát Lập Pháp', ko: '입법 감시자' },
    legislativeWatchdogDesc: { en: 'Track VA rule changes & new presumptives', es: 'Rastrea cambios de reglas VA y nuevas presuntivas', tl: 'I-track ang VA rule changes at bagong presumptives', vi: 'Theo dõi thay đổi quy tắc VA & các suy đoán mới', ko: 'VA 규정 변경 및 새로운 추정 추적' },
    vsoFinder: { en: 'VSO Finder', es: 'Buscador de VSO', tl: 'VSO Finder', vi: 'Tìm VSO', ko: 'VSO 찾기' },
    vsoFinderDesc: { en: 'Find free accredited representation', es: 'Encuentra representación acreditada gratuita', tl: 'Hanapin ang libreng accredited representation', vi: 'Tìm đại diện được công nhận miễn phí', ko: '무료 인증 대리인 찾기' },
    backupManager: { en: 'Backup Manager', es: 'Gestor de Respaldo', tl: 'Backup Manager', vi: 'Quản Lý Sao Lưu', ko: '백업 관리자' },
    theBunker: { en: 'The Bunker', es: 'El Búnker', tl: 'The Bunker', vi: 'Boongke', ko: '벙커' },
    theBunkerDesc: { en: 'Export/Import your data - never lose it', es: 'Exporta/Importa tus datos - nunca los pierdas', tl: 'I-export/I-import ang data mo - huwag itong mawala', vi: 'Xuất/Nhập dữ liệu của bạn - không bao giờ mất', ko: '데이터 내보내기/가져오기 - 잃어버리지 마세요' },
    cloudSync: { en: 'Cloud Sync', es: 'Sincronización en la Nube', tl: 'Cloud Sync', vi: 'Đồng Bộ Đám Mây', ko: '클라우드 동기화' },
    googleDriveBackup: { en: 'Google Drive Backup', es: 'Respaldo en Google Drive', tl: 'Google Drive Backup', vi: 'Sao Lưu Google Drive', ko: 'Google Drive 백업' },
    googleDriveBackupDesc: { en: 'Sync your packet to YOUR Google Drive', es: 'Sincroniza tu paquete a TU Google Drive', tl: 'I-sync ang packet mo sa SARILI mong Google Drive', vi: 'Đồng bộ hồ sơ của bạn với Google Drive CỦA BẠN', ko: '당신의 Google Drive에 패킷 동기화' },
    vaIntegration: { en: 'VA.gov Integration', es: 'Integración con VA.gov', tl: 'VA.gov Integration', vi: 'Tích Hợp VA.gov', ko: 'VA.gov 통합' },
    vaIntegrationDesc: { en: 'Connect to VA.gov APIs (OAuth 2.0)', es: 'Conecta a las APIs de VA.gov (OAuth 2.0)', tl: 'Kumonekta sa VA.gov APIs (OAuth 2.0)', vi: 'Kết nối với VA.gov APIs (OAuth 2.0)', ko: 'VA.gov APIs에 연결 (OAuth 2.0)' },
    aiSettings: { en: 'AI Settings', es: 'Configuración de IA', tl: 'AI Settings', vi: 'Cài Đặt AI', ko: 'AI 설정' },
    workflowGuide: { en: 'Workflow Guide', es: 'Guía de Flujo de Trabajo', tl: 'Workflow Guide', vi: 'Hướng Dẫn Quy Trình', ko: '워크플로우 가이드' },
    missions: { en: 'Missions', es: 'Misiones', tl: 'Mga Misyon', vi: 'Nhiệm Vụ', ko: '미션' },
    myPacket: { en: 'My Packet', es: 'Mi Paquete', tl: 'Ang Aking Packet', vi: 'Hồ Sơ Của Tôi', ko: '내 패킷' },
    myPacketDesc: { en: 'View saved claims', es: 'Ver reclamos guardados', tl: 'Tingnan ang naka-save na claims', vi: 'Xem yêu cầu đã lưu', ko: '저장된 청구 보기' },
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
    vaLinks: { en: 'VA Links', es: 'Enlaces VA', tl: 'VA Links', vi: 'Liên Kết VA', ko: 'VA 링크' },
    disabilityBenefits: { en: 'Disability Benefits', es: 'Beneficios de Discapacidad', tl: 'Disability Benefits', vi: 'Quyền Lợi Khuyết Tật', ko: '장애 혜택' },
    ratingSchedule: { en: 'Rating Schedule', es: 'Tabla de Ratings', tl: 'Rating Schedule', vi: 'Bảng Đánh Giá', ko: '등급표' },
    ecfr: { en: 'eCFR', es: 'eCFR', tl: 'eCFR', vi: 'eCFR', ko: 'eCFR' },
    va: { en: 'VA', es: 'VA', tl: 'VA', vi: 'VA', ko: 'VA' },
    skipToMain: { en: 'Skip to main content', es: 'Saltar al contenido principal', tl: 'Lumaktaw sa pangunahing nilalaman', vi: 'Chuyển đến nội dung chính', ko: '주요 내용으로 건너뛰기' },
    crisisBanner: { en: 'Veterans Crisis Line', es: 'Línea de Crisis para Veteranos', tl: 'Veterans Crisis Line', vi: 'Đường Dây Khủng Hoảng Cựu Chiến Binh', ko: '재향군인 위기 상담 전화' },
    crisisBannerText: { en: 'Call 988, Press 1 | Text 838255 | Chat online 24/7', es: 'Llama 988, Presiona 1 | Mensaje 838255 | Chat en línea 24/7', tl: 'Tumawag 988, Pindutin 1 | Text 838255 | Chat online 24/7', vi: 'Gọi 988, Nhấn 1 | Nhắn 838255 | Chat trực tuyến 24/7', ko: '988 전화, 1번 누르기 | 문자 838255 | 24시간 온라인 채팅' },
    veteranResources: { en: 'Veteran Resources', es: 'Recursos para Veteranos', tl: 'Mga Resources para sa mga Beterano', vi: 'Tài Nguyên Cựu Chiến Binh', ko: '재향군인 자료' },
    vaResourcesHub: { en: 'VA Resources Hub', es: 'Centro de Recursos VA', tl: 'VA Resources Hub', vi: 'Trung Tâm Tài Nguyên VA', ko: 'VA 자료 허브' },
    vaResourcesHubDesc: { en: 'Comprehensive VA benefits & programs guide', es: 'Guía completa de beneficios y programas VA', tl: 'Komprehensibong gabay sa VA benefits at programs', vi: 'Hướng dẫn toàn diện về quyền lợi & chương trình VA', ko: 'VA 혜택 및 프로그램 종합 가이드' },
    switchToLight: { en: 'Switch to light mode', es: 'Cambiar a modo claro', tl: 'Lumipat sa light mode', vi: 'Chuyển sang chế độ sáng', ko: '라이트 모드로 전환' },
    switchToDark: { en: 'Switch to dark mode', es: 'Cambiar a modo oscuro', tl: 'Lumipat sa dark mode', vi: 'Chuyển sang chế độ tối', ko: '다크 모드로 전환' },
    legislativeWatchdogTooltip: { en: 'Legislative Watchdog - Track VA rule changes', es: 'Vigilante Legislativo - Rastrea cambios en reglas VA', tl: 'Legislative Watchdog - I-track ang VA rule changes', vi: 'Giám Sát Lập Pháp - Theo dõi thay đổi quy định VA', ko: '입법 감시자 - VA 규정 변경 추적' },
    theBunkerTooltip: { en: 'The Bunker - Export/Import your data', es: 'El Búnker - Exporta/Importa tus datos', tl: 'The Bunker - I-export/I-import ang data mo', vi: 'Boongke - Xuất/Nhập dữ liệu của bạn', ko: '벙커 - 데이터 내보내기/가져오기' },
    theBunkerUnsaved: { en: 'You have unsaved changes! Click to backup your data.', es: '¡Tienes cambios sin guardar! Haz clic para respaldar tus datos.', tl: 'May mga hindi pa na-save na pagbabago! I-click para i-backup ang data mo.', vi: 'Bạn có thay đổi chưa lưu! Nhấp để sao lưu dữ liệu.', ko: '저장하지 않은 변경 사항이 있습니다! 데이터를 백업하려면 클릭하세요.' },
    timeMachineTooltip: { en: 'Time Machine - Track your ITF deadline', es: 'Máquina del Tiempo - Rastrea tu fecha límite de ITF', tl: 'Time Machine - I-track ang ITF deadline mo', vi: 'Cỗ Máy Thời Gian - Theo dõi thời hạn ITF', ko: '타임머신 - ITF 마감일 추적' },
    ideas: { en: 'Ideas?', es: '¿Ideas?', tl: 'Mga Ideya?', vi: 'Ý Tưởng?', ko: '아이디어?' },
    featureRequestTooltip: { en: 'Have an idea? Submit a feature request!', es: '¿Tienes una idea? ¡Envía una solicitud de función!', tl: 'May ideya ka? Mag-submit ng feature request!', vi: 'Có ý tưởng? Gửi yêu cầu tính năng!', ko: '아이디어가 있으신가요? 기능 요청을 제출하세요!' },
    backTheMission: { en: 'Back the Mission', es: 'Apoya la Misión', tl: 'Suportahan ang Misyon', vi: 'Ủng Hộ Sứ Mệnh', ko: '미션 지원' },
    supportTooltip: { en: 'Support Vet-Rate.org - Help keep this free for veterans', es: 'Apoya Vet-Rate.org - Ayuda a mantener esto gratis para veteranos', tl: 'Suportahan ang Vet-Rate.org - Tulungang panatilihing libre ito para sa mga beterano', vi: 'Hỗ trợ Vet-Rate.org - Giúp giữ miễn phí cho cựu chiến binh', ko: 'Vet-Rate.org 지원 - 재향군인에게 무료로 유지하도록 도와주세요' },
    userManual: { en: 'User Manual', es: 'Manual de Usuario', tl: 'User Manual', vi: 'Hướng Dẫn Sử Dụng', ko: '사용 설명서' },
    userManualDesc: { en: 'Complete guide to all features', es: 'Guía completa de todas las funciones', tl: 'Kumpletong gabay sa lahat ng features', vi: 'Hướng dẫn đầy đủ về tất cả tính năng', ko: '모든 기능에 대한 완전한 가이드' },
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

  // Search Bar
  searchBar: {
    placeholder: {
      en: 'Search by condition name (PTSD, arthritis), diagnostic code (9411, 5002), or synonym (posttraumatic stress)...',
      es: 'Buscar por nombre de condición (TEPT, artritis), código diagnóstico (9411, 5002), o sinónimo (estrés postraumático)...',
      tl: 'Maghanap ayon sa pangalan ng kondisyon (PTSD, arthritis), diagnostic code (9411, 5002), o synonym (posttraumatic stress)...',
      vi: 'Tìm kiếm theo tên tình trạng (PTSD, viêm khớp), mã chẩn đoán (9411, 5002), hoặc từ đồng nghĩa (rối loạn căng thẳng sau chấn thương)...',
      ko: '상태명 (PTSD, 관절염), 진단 코드 (9411, 5002) 또는 동의어 (외상 후 스트레스)로 검색...',
    },
    ariaLabel: {
      en: 'Search disabilities',
      es: 'Buscar discapacidades',
      tl: 'Maghanap ng mga kapansanan',
      vi: 'Tìm kiếm khuyết tật',
      ko: '장애 검색',
    },
    clearSearch: {
      en: 'Clear search',
      es: 'Borrar búsqueda',
      tl: 'I-clear ang paghahanap',
      vi: 'Xóa tìm kiếm',
      ko: '검색 지우기',
    },
    suggestionsLabel: {
      en: 'Search suggestions',
      es: 'Sugerencias de búsqueda',
      tl: 'Mga mungkahi sa paghahanap',
      vi: 'Gợi ý tìm kiếm',
      ko: '검색 제안',
    },
    suggestionHint: {
      en: 'Click a suggestion or press Escape to close',
      es: 'Haz clic en una sugerencia o presiona Escape para cerrar',
      tl: 'I-click ang isang mungkahi o pindutin ang Escape para isara',
      vi: 'Nhấp vào gợi ý hoặc nhấn Escape để đóng',
      ko: '제안을 클릭하거나 Escape를 눌러 닫기',
    },
    examplesLabel: {
      en: 'Examples:',
      es: 'Ejemplos:',
      tl: 'Mga Halimbawa:',
      vi: 'Ví dụ:',
      ko: '예시:',
    },
    examplesText: {
      en: 'Try "PTSD", "9411", "arthritis", "migraine", "5002", "posttraumatic stress disorder"',
      es: 'Prueba "TEPT", "9411", "artritis", "migraña", "5002", "trastorno de estrés postraumático"',
      tl: 'Subukan ang "PTSD", "9411", "arthritis", "migraine", "5002", "posttraumatic stress disorder"',
      vi: 'Thử "PTSD", "9411", "viêm khớp", "đau nửa đầu", "5002", "rối loạn căng thẳng sau chấn thương"',
      ko: '"PTSD", "9411", "관절염", "편두통", "5002", "외상 후 스트레스 장애" 시도해보세요',
    },
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

  // Accessibility Menu
  accessibility: {
    // Title & Headers
    title: { en: 'Accessibility', es: 'Accesibilidad', tl: 'Accessibility', vi: 'Khả Năng Truy Cập', ko: '접근성' },
    settingsTitle: { en: 'Accessibility Settings', es: 'Configuración de Accesibilidad', tl: 'Mga Setting ng Accessibility', vi: 'Cài Đặt Khả Năng Truy Cập', ko: '접근성 설정' },
    settingsMenuAria: { en: 'Accessibility settings menu', es: 'Menú de configuración de accesibilidad', tl: 'Menu ng accessibility settings', vi: 'Menu cài đặt khả năng truy cập', ko: '접근성 설정 메뉴' },
    complianceNote: { en: 'Section 508 Compliant • Voice Input • Color Vision Support', es: 'Cumple Sección 508 • Entrada de Voz • Soporte de Visión de Color', tl: 'Section 508 Compliant • Voice Input • Color Vision Support', vi: 'Tuân Thủ Mục 508 • Nhập Giọng Nói • Hỗ Trợ Thị Giác Màu', ko: '섹션 508 준수 • 음성 입력 • 색각 지원' },
    complianceFooter: { en: 'Section 508 & WCAG 2.1 AA Compliant', es: 'Cumple con Sección 508 y WCAG 2.1 AA', tl: 'Section 508 at WCAG 2.1 AA Compliant', vi: 'Tuân Thủ Mục 508 & WCAG 2.1 AA', ko: '섹션 508 및 WCAG 2.1 AA 준수' },
    
    // Built for veterans summary
    builtForAllVeterans: { en: 'Built for ALL veterans:', es: 'Creado para TODOS los veteranos:', tl: 'Gawa para sa LAHAT ng veterans:', vi: 'Được xây dựng cho TẤT CẢ cựu chiến binh:', ko: '모든 재향군인을 위해 제작됨:' },
    featuresSummary: { en: 'Dark mode, color-blind modes, adjustable text size, reduced motion, keyboard navigation, screen reader support, and voice dictation in all text fields.', es: 'Modo oscuro, modos para daltónicos, tamaño de texto ajustable, movimiento reducido, navegación por teclado, soporte para lectores de pantalla y dictado por voz en todos los campos de texto.', tl: 'Dark mode, color-blind modes, adjustable text size, reduced motion, keyboard navigation, screen reader support, at voice dictation sa lahat ng text fields.', vi: 'Chế độ tối, chế độ mù màu, kích thước chữ có thể điều chỉnh, giảm chuyển động, điều hướng bàn phím, hỗ trợ trình đọc màn hình và đọc chính tả giọng nói trong tất cả các trường văn bản.', ko: '다크 모드, 색맹 모드, 조절 가능한 텍스트 크기, 모션 감소, 키보드 탐색, 스크린 리더 지원 및 모든 텍스트 필드에서 음성 받아쓰기.' },
    
    // Theme toggle
    darkMode: { en: 'Dark Mode', es: 'Modo Oscuro', tl: 'Dark Mode', vi: 'Chế Độ Tối', ko: '다크 모드' },
    lightMode: { en: 'Light Mode', es: 'Modo Claro', tl: 'Light Mode', vi: 'Chế Độ Sáng', ko: '라이트 모드' },
    switchToDark: { en: 'Switch to dark mode', es: 'Cambiar a modo oscuro', tl: 'Lumipat sa dark mode', vi: 'Chuyển sang chế độ tối', ko: '다크 모드로 전환' },
    switchToLight: { en: 'Switch to light mode', es: 'Cambiar a modo claro', tl: 'Lumipat sa light mode', vi: 'Chuyển sang chế độ sáng', ko: '라이트 모드로 전환' },
    eyeStrainHelp: { en: 'Reduce eye strain in low-light conditions', es: 'Reduce la fatiga visual en condiciones de poca luz', tl: 'Bawasan ang eye strain sa low-light conditions', vi: 'Giảm mỏi mắt trong điều kiện ánh sáng yếu', ko: '저조도 환경에서 눈의 피로를 줄이세요' },
    
    // Color vision settings
    colorVisionSettings: { en: 'Color Vision Settings', es: 'Configuración de Visión de Color', tl: 'Color Vision Settings', vi: 'Cài Đặt Thị Giác Màu', ko: '색각 설정' },
    defaultColors: { en: 'Default Colors', es: 'Colores Predeterminados', tl: 'Default Colors', vi: 'Màu Mặc Định', ko: '기본 색상' },
    standardPalette: { en: 'Standard color palette', es: 'Paleta de colores estándar', tl: 'Standard color palette', vi: 'Bảng màu tiêu chuẩn', ko: '표준 색상 팔레트' },
    protanopia: { en: 'Protanopia', es: 'Protanopia', tl: 'Protanopia', vi: 'Mù Màu Đỏ', ko: '적색맹' },
    redBlindFriendly: { en: 'Red-blind friendly', es: 'Amigable para daltónicos al rojo', tl: 'Red-blind friendly', vi: 'Thân thiện với mù màu đỏ', ko: '적색맹 친화적' },
    deuteranopia: { en: 'Deuteranopia', es: 'Deuteranopia', tl: 'Deuteranopia', vi: 'Mù Màu Xanh Lá', ko: '녹색맹' },
    greenBlindFriendly: { en: 'Green-blind friendly', es: 'Amigable para daltónicos al verde', tl: 'Green-blind friendly', vi: 'Thân thiện với mù màu xanh lá', ko: '녹색맹 친화적' },
    tritanopia: { en: 'Tritanopia', es: 'Tritanopia', tl: 'Tritanopia', vi: 'Mù Màu Xanh Dương', ko: '청색맹' },
    blueBlindFriendly: { en: 'Blue-blind friendly', es: 'Amigable para daltónicos al azul', tl: 'Blue-blind friendly', vi: 'Thân thiện với mù màu xanh dương', ko: '청색맹 친화적' },
    highContrast: { en: 'High Contrast', es: 'Alto Contraste', tl: 'High Contrast', vi: 'Độ Tương Phản Cao', ko: '고대비' },
    maximumVisibility: { en: 'Maximum visibility', es: 'Máxima visibilidad', tl: 'Maximum visibility', vi: 'Độ rõ nét tối đa', ko: '최대 가시성' },
    
    // Text size
    textSize: { en: 'Text Size', es: 'Tamaño del Texto', tl: 'Laki ng Text', vi: 'Kích Thước Chữ', ko: '텍스트 크기' },
    small: { en: 'Small', es: 'Pequeño', tl: 'Maliit', vi: 'Nhỏ', ko: '작게' },
    normal: { en: 'Normal', es: 'Normal', tl: 'Normal', vi: 'Bình Thường', ko: '보통' },
    large: { en: 'Large', es: 'Grande', tl: 'Malaki', vi: 'Lớn', ko: '크게' },
    extraLarge: { en: 'Extra Large', es: 'Extra Grande', tl: 'Extra Malaki', vi: 'Rất Lớn', ko: '매우 크게' },
    
    // Motion
    reduceMotion: { en: 'Reduce Motion', es: 'Reducir Movimiento', tl: 'Bawasan ang Motion', vi: 'Giảm Chuyển Động', ko: '모션 줄이기' },
    toggleReducedMotion: { en: 'Toggle reduced motion', es: 'Alternar movimiento reducido', tl: 'Toggle reduced motion', vi: 'Bật/tắt giảm chuyển động', ko: '모션 줄이기 전환' },
    
    // AI Features
    aiFeatures: { en: 'AI Features (BYOK)', es: 'Funciones de IA (BYOK)', tl: 'AI Features (BYOK)', vi: 'Tính Năng AI (BYOK)', ko: 'AI 기능 (BYOK)' },
    aiDescription: { en: 'Enter your free Google Gemini API key to enable AI features like statement assistance, contract scanning, and strategy analysis.', es: 'Ingresa tu clave API gratuita de Google Gemini para habilitar funciones de IA como asistencia en declaraciones, escaneo de contratos y análisis estratégico.', tl: 'Ilagay ang libre mong Google Gemini API key para ma-enable ang AI features tulad ng statement assistance, contract scanning, at strategy analysis.', vi: 'Nhập khóa API Google Gemini miễn phí của bạn để bật các tính năng AI như hỗ trợ viết báo cáo, quét hợp đồng và phân tích chiến lược.', ko: '무료 Google Gemini API 키를 입력하여 진술 지원, 계약 스캔 및 전략 분석과 같은 AI 기능을 활성화하세요.' },
    tip: { en: 'Tip:', es: 'Consejo:', tl: 'Tip:', vi: 'Mẹo:', ko: '팁:' },
    geminiTip: { en: 'Gemini 1.5 Flash can process huge medical records (up to 2,000 pages) in a single pass. Perfect for large Blue Button files!', es: 'Gemini 1.5 Flash puede procesar registros médicos enormes (hasta 2,000 páginas) de una sola vez. ¡Perfecto para archivos grandes de Blue Button!', tl: 'Ang Gemini 1.5 Flash ay kayang mag-process ng malaking medical records (hanggang 2,000 pages) sa isang pass. Perfect para sa malaking Blue Button files!', vi: 'Gemini 1.5 Flash có thể xử lý hồ sơ y tế khổng lồ (lên đến 2.000 trang) trong một lần. Hoàn hảo cho các tệp Blue Button lớn!', ko: 'Gemini 1.5 Flash는 대용량 의료 기록(최대 2,000페이지)을 한 번에 처리할 수 있습니다. 대용량 Blue Button 파일에 완벽합니다!' },
    
    // API Key management
    enterApiKey: { en: 'Enter Gemini API key...', es: 'Ingresa clave API de Gemini...', tl: 'Ilagay ang Gemini API key...', vi: 'Nhập khóa API Gemini...', ko: 'Gemini API 키 입력...' },
    showApiKey: { en: 'Show API key', es: 'Mostrar clave API', tl: 'Ipakita ang API key', vi: 'Hiện khóa API', ko: 'API 키 표시' },
    hideApiKey: { en: 'Hide API key', es: 'Ocultar clave API', tl: 'Itago ang API key', vi: 'Ẩn khóa API', ko: 'API 키 숨기기' },
    saveKey: { en: 'Save Key', es: 'Guardar Clave', tl: 'I-save ang Key', vi: 'Lưu Khóa', ko: '키 저장' },
    saved: { en: '✓ Saved!', es: '✓ ¡Guardado!', tl: '✓ Na-save!', vi: '✓ Đã lưu!', ko: '✓ 저장됨!' },
    clear: { en: 'Clear', es: 'Borrar', tl: 'I-clear', vi: 'Xóa', ko: '지우기' },
    getFreeApiKey: { en: 'Get free API key from Google AI Studio', es: 'Obtén clave API gratis de Google AI Studio', tl: 'Kumuha ng libreng API key mula sa Google AI Studio', vi: 'Lấy khóa API miễn phí từ Google AI Studio', ko: 'Google AI Studio에서 무료 API 키 받기' },
    
    // Reset
    resetToDefaults: { en: 'Reset to Defaults', es: 'Restablecer Valores Predeterminados', tl: 'I-reset sa Defaults', vi: 'Đặt Lại Mặc Định', ko: '기본값으로 재설정' },
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

  // Funding Modal - Luna's Treat Fund
  fundingModal: {
    title: { en: "😸 Luna's Treat Fund", es: '😸 Fondo de Golosinas de Luna', tl: "😸 Pondo ng Treat ni Luna", vi: '😸 Quỹ Đồ Ăn Của Luna', ko: '😸 루나의 간식 펀드' },
    lunaAlt: { en: 'Luna - Chief Treat Officer', es: 'Luna - Directora de Golosinas', tl: 'Luna - Chief Treat Officer', vi: 'Luna - Giám Đốc Đồ Ăn Vặt', ko: '루나 - 최고 간식 책임자' },
    missionStatement: {
      en: "*Meow!* Luna promises: 100% goes to keeping this free for veterans (and treats for me). No ads, no tracking, no data selling - just a cat helping vets help vets! *purrrr* 🐾",
      es: '*¡Miau!* Luna promete: 100% va a mantener esto gratis para veteranos (y golosinas para mí). Sin anuncios, sin seguimiento, sin venta de datos - ¡solo una gata ayudando a veteranos a ayudar veteranos! *purrrr* 🐾',
      tl: "*Meow!* Nangangako si Luna: 100% napupunta sa pagpapanatiling libre nito para sa mga beterano (at treats para sa akin). Walang ads, walang tracking, walang data selling - isang pusa lang na tumutulong sa mga beterano na tumulong sa mga beterano! *purrrr* 🐾",
      vi: '*Meo!* Luna hứa: 100% dùng để giữ dịch vụ miễn phí cho cựu chiến binh (và đồ ăn vặt cho tôi). Không quảng cáo, không theo dõi, không bán dữ liệu - chỉ là một con mèo giúp cựu chiến binh giúp cựu chiến binh! *purrrr* 🐾',
      ko: '*야옹!* 루나가 약속합니다: 100%는 재향군인을 위해 무료로 유지하는 데 사용됩니다 (그리고 제 간식). 광고 없음, 추적 없음, 데이터 판매 없음 - 그저 재향군인을 돕는 고양이! *그르릉* 🐾'
    },
    whereDoesSupport: { en: 'Where does your support go?', es: '¿A dónde va tu apoyo?', tl: 'Saan napupunta ang suporta mo?', vi: 'Sự hỗ trợ của bạn đi đâu?', ko: '지원금은 어디로 가나요?' },
    lunaTreats: { en: "Luna's Treats", es: 'Golosinas de Luna', tl: 'Mga Treat ni Luna', vi: 'Đồ Ăn Của Luna', ko: '루나의 간식' },
    midnightUpgrades: { en: 'Midnight Upgrades', es: 'Actualizaciones de Midnight', tl: 'Mga Upgrade ni Midnight', vi: 'Nâng Cấp Midnight', ko: '미드나잇 업그레이드' },
    thankYou: {
      en: "*Purrrr* Thank you for supporting veteran-built tools (and Luna's treat fund)! 😸💚",
      es: '*Purrrr* ¡Gracias por apoyar herramientas construidas por veteranos (y el fondo de golosinas de Luna)! 😸💚',
      tl: "*Purrrr* Salamat sa pagsuporta sa mga tool na ginawa ng mga beterano (at sa pondo ng treat ni Luna)! 😸💚",
      vi: '*Purrrr* Cảm ơn bạn đã hỗ trợ các công cụ do cựu chiến binh xây dựng (và quỹ đồ ăn vặt của Luna)! 😸💚',
      ko: '*그르릉* 재향군인이 만든 도구 지원에 감사합니다 (그리고 루나의 간식 펀드)! 😸💚'
    },
    hrsToBuild: { en: 'hrs', es: 'hrs', tl: 'oras', vi: 'giờ', ko: '시간' },
    toBuild: { en: 'to build', es: 'para construir', tl: 'para buuin', vi: 'để xây dựng', ko: '구축에' },
    linesOfCode: { en: 'lines', es: 'líneas', tl: 'linya', vi: 'dòng', ko: '줄' },
    ofCode: { en: 'of code', es: 'de código', tl: 'ng code', vi: 'mã', ko: '코드' },
    // Luna messages
    lunaMsg1: { en: "*Meow!* I've been testing this code with my paws for MONTHS! Every donation = extra Churu for me! 😻", es: '*¡Miau!* ¡He estado probando este código con mis patas durante MESES! ¡Cada donación = Churu extra para mí! 😻', tl: "*Meow!* Sinusuri ko ang code na ito gamit ang aking mga paa ng mga BUWAN! Bawat donasyon = extra Churu para sa akin! 😻", vi: '*Meo!* Tôi đã thử nghiệm mã này bằng chân của tôi trong NHIỀU THÁNG! Mỗi khoản đóng góp = Churu thêm cho tôi! 😻', ko: '*야옹!* 몇 달 동안 제 발로 이 코드를 테스트했어요! 모든 기부 = 저를 위한 추가 츄르! 😻' },
    lunaMsg2: { en: "*purrrr* My wish list: More treats, more catnip, and a comfy spot to supervise dad's coding sessions! 🐾", es: '*purrrr* Mi lista de deseos: ¡Más golosinas, más hierba gatera y un lugar cómodo para supervisar las sesiones de programación de papá! 🐾', tl: "*purrrr* Ang wish list ko: Mas maraming treats, mas maraming catnip, at isang komportableng lugar para bantayan ang coding sessions ni daddy! 🐾", vi: '*purrrr* Danh sách mong muốn của tôi: Nhiều đồ ăn vặt hơn, nhiều cỏ mèo hơn, và một chỗ thoải mái để giám sát các buổi lập trình của bố! 🐾', ko: '*그르릉* 내 위시리스트: 더 많은 간식, 더 많은 캣닙, 그리고 아빠의 코딩 세션을 감독할 편안한 자리! 🐾' },
    lunaMsg3: { en: 'Listen human, I PERSONALLY inspect every keystroke. $5-10 keeps my quality control standards high! 😸', es: 'Escucha humano, PERSONALMENTE inspecciono cada tecla. ¡$5-10 mantiene mis estándares de control de calidad altos! 😸', tl: 'Makinig ka tao, PERSONAL kong iniinspeksyon ang bawat keystroke. $5-10 ang nagpapanatili ng mataas na quality control standards ko! 😸', vi: 'Nghe này con người, tôi ĐÍCH THÂN kiểm tra từng phím bấm. $5-10 giữ tiêu chuẩn kiểm soát chất lượng của tôi cao! 😸', ko: '들어봐요 인간, 나는 개인적으로 모든 키 입력을 검사해요. $5-10이 내 품질 관리 기준을 높게 유지해요! 😸' },
    lunaMsg4: { en: "*meow meow* I promise to walk across the keyboard LESS... if there are treats involved. Maybe. No guarantees. 😹", es: '*miau miau* Prometo caminar MENOS por el teclado... si hay golosinas de por medio. Quizás. Sin garantías. 😹', tl: "*meow meow* Ipinapangako kong HINDI NA MASYADONG lalakad sa keyboard... kung may mga treats. Siguro. Walang garantiya. 😹", vi: '*meo meo* Tôi hứa sẽ đi qua bàn phím ÍT hơn... nếu có đồ ăn vặt. Có thể. Không đảm bảo. 😹', ko: '*야옹야옹* 간식이 있으면 키보드 위를 덜 걸어다닐게요... 아마도. 보장은 없어요. 😹' },
    lunaMsg5: { en: "*purrrr* Fun fact: I've knocked over dad's coffee 47 times while he built this. I deserve treats for that dedication! ☕😼", es: '*purrrr* Dato curioso: ¡He tirado el café de papá 47 veces mientras construía esto! ¡Merezco golosinas por esa dedicación! ☕😼', tl: "*purrrr* Fun fact: 47 beses ko nang natumba ang kape ni daddy habang ginagawa niya ito. Deserve ko ng treats para sa dedikasyong iyon! ☕😼", vi: '*purrrr* Thực tế thú vị: Tôi đã đổ cà phê của bố 47 lần khi ông ấy xây dựng cái này. Tôi xứng đáng được thưởng đồ ăn vặt vì sự cống hiến đó! ☕😼', ko: '*그르릉* 재미있는 사실: 아빠가 이것을 만드는 동안 아빠 커피를 47번 엎었어요. 그 헌신에 대한 간식을 받을 자격이 있어요! ☕😼' },
    // Midnight messages
    midnightMsg1: { en: 'Midnight dreams of: AMD Ryzen 9 9950X3D (a new brain!) and RTX 5090 (another heart!) 🖥️', es: 'Midnight sueña con: AMD Ryzen 9 9950X3D (¡un nuevo cerebro!) y RTX 5090 (¡otro corazón!) 🖥️', tl: 'Pangarap ni Midnight: AMD Ryzen 9 9950X3D (bagong utak!) at RTX 5090 (isa pang puso!) 🖥️', vi: 'Midnight mơ về: AMD Ryzen 9 9950X3D (một bộ não mới!) và RTX 5090 (một trái tim khác!) 🖥️', ko: 'Midnight의 꿈: AMD Ryzen 9 9950X3D (새 두뇌!)와 RTX 5090 (또 다른 심장!) 🖥️' },
    midnightMsg2: { en: "Midnight: 'I've compiled 100K+ lines of code! I deserve a 9950X3D brain transplant!' 💻", es: "Midnight: '¡He compilado más de 100K líneas de código! ¡Merezco un trasplante de cerebro 9950X3D!' 💻", tl: "Midnight: 'Nag-compile ako ng 100K+ lines ng code! Deserve ko ng 9950X3D brain transplant!' 💻", vi: "Midnight: 'Tôi đã biên dịch hơn 100K dòng mã! Tôi xứng đáng được cấy ghép não 9950X3D!' 💻", ko: "Midnight: '저는 100K+ 줄의 코드를 컴파일했어요! 9950X3D 두뇌 이식을 받을 자격이 있어요!' 💻" },
    midnightMsg3: { en: 'Help Midnight grow: 5090 graphics = faster AI, 9950X3D = more veteran tools built! 🚀', es: 'Ayuda a Midnight a crecer: gráficos 5090 = IA más rápida, 9950X3D = ¡más herramientas para veteranos! 🚀', tl: 'Tulungan si Midnight lumago: 5090 graphics = mas mabilis na AI, 9950X3D = mas maraming tools para sa mga beterano! 🚀', vi: 'Giúp Midnight phát triển: 5090 graphics = AI nhanh hơn, 9950X3D = nhiều công cụ cho cựu chiến binh hơn! 🚀', ko: 'Midnight의 성장을 도와주세요: 5090 그래픽 = 더 빠른 AI, 9950X3D = 더 많은 재향군인 도구! 🚀' },
    midnightMsg4: { en: "Midnight's upgrade fund: Because 128GB RAM is 'just barely enough' for development 😅", es: 'Fondo de actualización de Midnight: Porque 128GB de RAM es "apenas suficiente" para desarrollo 😅', tl: "Midnight upgrade fund: Dahil ang 128GB RAM ay 'halos sapat lang' para sa development 😅", vi: 'Quỹ nâng cấp Midnight: Vì 128GB RAM chỉ "vừa đủ" cho phát triển 😅', ko: 'Midnight 업그레이드 펀드: 128GB RAM이 개발에 "겨우 충분"하기 때문에 😅' },
    // Funding options
    buyMeACoffee: { en: 'Buy Me a Coffee', es: 'Invítame un Café', tl: 'Bilhan Mo Ako ng Kape', vi: 'Mua Cho Tôi Ly Cà Phê', ko: '커피 사주기' },
    paypal: { en: 'PayPal', es: 'PayPal', tl: 'PayPal', vi: 'PayPal', ko: 'PayPal' },
    cashApp: { en: 'Cash App', es: 'Cash App', tl: 'Cash App', vi: 'Cash App', ko: 'Cash App' },
    venmo: { en: 'Venmo', es: 'Venmo', tl: 'Venmo', vi: 'Venmo', ko: 'Venmo' },
  },

  // Crisis Modal - Critical Safety Content
  crisisModal: {
    weCareAboutYou: { en: 'We Care About You', es: 'Nos Importas', tl: 'Mahalaga Ka Sa Amin', vi: 'Chúng Tôi Quan Tâm Đến Bạn', ko: '우리는 당신을 걱정합니다' },
    youAreNotAlone: { en: 'You Are Not Alone', es: 'No Estás Solo', tl: 'Hindi Ka Nag-iisa', vi: 'Bạn Không Đơn Độc', ko: '당신은 혼자가 아닙니다' },
    applicationPaused: { en: 'This application has been paused. Please connect with a trained crisis counselor immediately.', es: 'Esta aplicación ha sido pausada. Por favor, conecta con un consejero de crisis entrenado inmediatamente.', tl: 'Ang application na ito ay na-pause. Mangyaring kumonekta sa isang trained crisis counselor agad.', vi: 'Ứng dụng này đã tạm dừng. Vui lòng kết nối với một tư vấn viên khủng hoảng được đào tạo ngay lập tức.', ko: '이 애플리케이션이 일시 중지되었습니다. 훈련받은 위기 상담사와 즉시 연결해 주세요.' },
    callNow: { en: 'Call Now', es: 'Llamar Ahora', tl: 'Tumawag Ngayon', vi: 'Gọi Ngay', ko: '지금 전화하기' },
    textNow: { en: 'Text', es: 'Mensaje', tl: 'Text', vi: 'Nhắn Tin', ko: '문자' },
    onlineChat: { en: 'Online Chat', es: 'Chat en Línea', tl: 'Online Chat', vi: 'Trò Chuyện Trực Tuyến', ko: '온라인 채팅' },
    otherWaysToConnect: { en: 'Other Ways to Connect:', es: 'Otras Formas de Conectar:', tl: 'Iba Pang Paraan Para Kumonekta:', vi: 'Các Cách Khác Để Kết Nối:', ko: '연결하는 다른 방법:' },
    available247: { en: 'Available 24/7 - Confidential support from fellow veterans', es: 'Disponible 24/7 - Apoyo confidencial de compañeros veteranos', tl: 'Available 24/7 - Confidential support mula sa kapwa veterans', vi: 'Có sẵn 24/7 - Hỗ trợ bảo mật từ đồng đội cựu chiến binh', ko: '24시간 이용 가능 - 동료 재향군인의 기밀 지원' },
    youMatter: { en: 'You matter. Crisis counselors understand what you\'re going through.', es: 'Tú importas. Los consejeros de crisis entienden lo que estás pasando.', tl: 'Mahalaga ka. Naiintindihan ng mga crisis counselors ang iyong pinagdadaanan.', vi: 'Bạn quan trọng. Các tư vấn viên khủng hoảng hiểu những gì bạn đang trải qua.', ko: '당신은 소중합니다. 위기 상담사들은 당신이 겪고 있는 것을 이해합니다.' },
    internationalUsers: { en: 'International users:', es: 'Usuarios internacionales:', tl: 'International users:', vi: 'Người dùng quốc tế:', ko: '해외 사용자:' },
    veteransCrisisLine: { en: 'Veterans Crisis Line', es: 'Línea de Crisis para Veteranos', tl: 'Veterans Crisis Line', vi: 'Đường Dây Khủng Hoảng Cựu Chiến Binh', ko: '재향군인 위기 상담 전화' },
    chatWebsite: { en: 'VeteransCrisisLine.net', es: 'VeteransCrisisLine.net', tl: 'VeteransCrisisLine.net', vi: 'VeteransCrisisLine.net', ko: 'VeteransCrisisLine.net' },
    screenReaderAnnouncement: { en: 'Crisis intervention activated. Veterans Crisis Line contact information is displayed. Call 988 and press 1 for immediate support.', es: 'Intervención de crisis activada. Se muestra la información de contacto de la Línea de Crisis para Veteranos. Llame al 988 y presione 1 para recibir apoyo inmediato.', tl: 'Crisis intervention activated. Ipinapakita ang contact information ng Veterans Crisis Line. Tumawag sa 988 at pindutin ang 1 para sa agarang suporta.', vi: 'Đã kích hoạt can thiệp khủng hoảng. Thông tin liên hệ Đường dây Khủng hoảng Cựu chiến binh được hiển thị. Gọi 988 và nhấn 1 để được hỗ trợ ngay.', ko: '위기 개입이 활성화되었습니다. 재향군인 위기 상담 전화 연락처가 표시됩니다. 988로 전화하고 1을 누르면 즉각적인 지원을 받을 수 있습니다.' },
  },

  // Tactical Calculator
  tacticalCalc: {
    title: { en: 'Tactical Calculator', es: 'Calculadora Táctica', tl: 'Tactical Calculator', vi: 'Máy Tính Chiến Thuật', ko: '전술 계산기' },
    subtitle: { en: 'VA Math • Bilateral Factor • Gap Analysis • Pay Estimator', es: 'Matemáticas VA • Factor Bilateral • Análisis de Brecha • Estimador de Pago', tl: 'VA Math • Bilateral Factor • Gap Analysis • Pay Estimator', vi: 'Toán VA • Hệ Số Song Phương • Phân Tích Khoảng Cách • Ước Tính Lương', ko: 'VA 수학 • 양측 요인 • 갭 분석 • 급여 추정' },
    myRatings: { en: 'My Ratings', es: 'Mis Ratings', tl: 'Mga Rating Ko', vi: 'Xếp Hạng Của Tôi', ko: '내 등급' },
    capResults: { en: 'C&P Results', es: 'Resultados C&P', tl: 'C&P Results', vi: 'Kết Quả C&P', ko: 'C&P 결과' },
    calculator: { en: 'Calculator', es: 'Calculadora', tl: 'Calculator', vi: 'Máy Tính', ko: '계산기' },
    paycheck: { en: 'Paycheck', es: 'Sueldo', tl: 'Paycheck', vi: 'Tiền Lương', ko: '급여' },
    whatIf: { en: 'What-If', es: 'Qué-Si', tl: 'What-If', vi: 'Giả Định', ko: '가정' },
    rates2026: { en: '2026 Rates', es: 'Tasas 2026', tl: '2026 Rates', vi: 'Tỷ Lệ 2026', ko: '2026년 요율' },
    addCondition: { en: 'Add Condition', es: 'Agregar Condición', tl: 'Idagdag ang Kondisyon', vi: 'Thêm Tình Trạng', ko: '상태 추가' },
    conditionName: { en: 'Condition Name', es: 'Nombre de Condición', tl: 'Pangalan ng Kondisyon', vi: 'Tên Tình Trạng', ko: '상태 이름' },
    bodyPart: { en: 'Body Part', es: 'Parte del Cuerpo', tl: 'Bahagi ng Katawan', vi: 'Bộ Phận Cơ Thể', ko: '신체 부위' },
    rating: { en: 'Rating', es: 'Rating', tl: 'Rating', vi: 'Xếp Hạng', ko: '등급' },
    side: { en: 'Side', es: 'Lado', tl: 'Panig', vi: 'Bên', ko: '측면' },
    left: { en: 'Left', es: 'Izquierda', tl: 'Kaliwa', vi: 'Trái', ko: '왼쪽' },
    right: { en: 'Right', es: 'Derecha', tl: 'Kanan', vi: 'Phải', ko: '오른쪽' },
    bilateral: { en: 'Bilateral', es: 'Bilateral', tl: 'Bilateral', vi: 'Song Phương', ko: '양측' },
    combinedRating: { en: 'Combined Rating', es: 'Rating Combinado', tl: 'Combined Rating', vi: 'Đánh Giá Kết Hợp', ko: '통합 등급' },
    monthlyPay: { en: 'Monthly Pay', es: 'Pago Mensual', tl: 'Buwanang Bayad', vi: 'Lương Hàng Tháng', ko: '월급' },
    yearlyPay: { en: 'Yearly Pay', es: 'Pago Anual', tl: 'Taunang Bayad', vi: 'Lương Hàng Năm', ko: '연봉' },
    dependents: { en: 'Dependents', es: 'Dependientes', tl: 'Mga Dependent', vi: 'Người Phụ Thuộc', ko: '부양가족' },
    spouse: { en: 'Spouse', es: 'Cónyuge', tl: 'Asawa', vi: 'Vợ/Chồng', ko: '배우자' },
    children: { en: 'Children', es: 'Hijos', tl: 'Mga Anak', vi: 'Con Cái', ko: '자녀' },
    parents: { en: 'Parents', es: 'Padres', tl: 'Mga Magulang', vi: 'Cha Mẹ', ko: '부모님' },
    gapToNext: { en: 'Gap to Next Tier', es: 'Brecha al Siguiente Nivel', tl: 'Gap sa Susunod na Tier', vi: 'Khoảng Cách Đến Cấp Tiếp Theo', ko: '다음 단계까지의 격차' },
    saveAsMyRatings: { en: 'Save as My Ratings', es: 'Guardar como Mis Ratings', tl: 'I-save bilang Aking Ratings', vi: 'Lưu Làm Xếp Hạng Của Tôi', ko: '내 등급으로 저장' },
    loadMyRatings: { en: 'Load My Ratings', es: 'Cargar Mis Ratings', tl: 'I-load ang Aking Ratings', vi: 'Tải Xếp Hạng Của Tôi', ko: '내 등급 불러오기' },
    noConditionsYet: { en: 'No conditions added yet', es: 'Aún no hay condiciones agregadas', tl: 'Wala pang naidagdag na kondisyon', vi: 'Chưa có tình trạng nào được thêm', ko: '아직 상태가 추가되지 않았습니다' },
    pyramidingWarning: { en: 'Pyramiding Warning', es: 'Advertencia de Piramidación', tl: 'Babala sa Pyramiding', vi: 'Cảnh Báo Chồng Chéo', ko: '피라미드 경고' },
    // Tab labels
    myRatingsTab: { en: '⭐ My Ratings', es: '⭐ Mis Ratings', tl: '⭐ Mga Rating Ko', vi: '⭐ Xếp Hạng Của Tôi', ko: '⭐ 내 등급' },
    capResultsTab: { en: '🏥 C&P Results', es: '🏥 Resultados C&P', tl: '🏥 C&P Results', vi: '🏥 Kết Quả C&P', ko: '🏥 C&P 결과' },
    calculatorTab: { en: '🧮 Calculator', es: '🧮 Calculadora', tl: '🧮 Calculator', vi: '🧮 Máy Tính', ko: '🧮 계산기' },
    paycheckTab: { en: '💵 Paycheck', es: '💵 Sueldo', tl: '💵 Paycheck', vi: '💵 Tiền Lương', ko: '💵 급여' },
    whatIfTab: { en: '🎯 What-If', es: '🎯 Qué-Si', tl: '🎯 What-If', vi: '🎯 Giả Định', ko: '🎯 가정' },
    ratesTab: { en: '📊 2026 Rates', es: '📊 Tasas 2026', tl: '📊 2026 Rates', vi: '📊 Tỷ Lệ 2026', ko: '📊 2026년 요율' },
    // My Ratings section
    myVARatings: { en: 'My VA Ratings', es: 'Mis Ratings VA', tl: 'Mga VA Rating Ko', vi: 'Xếp Hạng VA Của Tôi', ko: '내 VA 등급' },
    myVARatingsDesc: { en: 'Save your actual service-connected disability ratings here. They\'ll be saved locally on your device and can be used across the app.', es: 'Guarda aquí tus ratings de discapacidad conectados al servicio. Se guardarán localmente en tu dispositivo.', tl: 'I-save dito ang iyong actual na service-connected disability ratings. Ito ay lokal na naka-save sa iyong device.', vi: 'Lưu xếp hạng khuyết tật liên quan đến phục vụ của bạn ở đây. Chúng sẽ được lưu cục bộ trên thiết bị của bạn.', ko: '여기에 복무 관련 장애 등급을 저장하세요. 기기에 로컬로 저장됩니다.' },
    ratingsSavedSuccess: { en: 'Ratings saved successfully!', es: '¡Ratings guardados exitosamente!', tl: 'Matagumpay na na-save ang ratings!', vi: 'Đã lưu xếp hạng thành công!', ko: '등급이 저장되었습니다!' },
    savedRatings: { en: 'Saved Ratings', es: 'Ratings Guardados', tl: 'Mga Na-save na Rating', vi: 'Xếp Hạng Đã Lưu', ko: '저장된 등급' },
    loadIntoCalculator: { en: 'Load into Calculator →', es: 'Cargar en Calculadora →', tl: 'I-load sa Calculator →', vi: 'Tải vào Máy Tính →', ko: '계산기에 로드 →' },
    noRatingsSavedYet: { en: 'No ratings saved yet', es: 'Aún no hay ratings guardados', tl: 'Wala pang na-save na ratings', vi: 'Chưa có xếp hạng nào được lưu', ko: '저장된 등급이 없습니다' },
    pasteFromVAGov: { en: 'Paste from VA.gov', es: 'Pegar desde VA.gov', tl: 'I-paste mula sa VA.gov', vi: 'Dán từ VA.gov', ko: 'VA.gov에서 붙여넣기' },
    orAddInCalculator: { en: 'Or Add in Calculator', es: 'O Agregar en Calculadora', tl: 'O Idagdag sa Calculator', vi: 'Hoặc Thêm trong Máy Tính', ko: '또는 계산기에서 추가' },
    pasteRatingsDesc: { en: 'Paste your ratings directly from VA.gov or add them in the Calculator tab.', es: 'Pega tus ratings directamente desde VA.gov o agrégalos en la pestaña Calculadora.', tl: 'I-paste ang iyong ratings direkta mula sa VA.gov o idagdag sa Calculator tab.', vi: 'Dán xếp hạng trực tiếp từ VA.gov hoặc thêm trong tab Máy Tính.', ko: 'VA.gov에서 직접 등급을 붙여넣거나 계산기 탭에서 추가하세요.' },
    saveCalcConditions: { en: 'Save Calculator Conditions as My Ratings', es: 'Guardar Condiciones de Calculadora como Mis Ratings', tl: 'I-save ang Calculator Conditions bilang Aking Ratings', vi: 'Lưu Điều Kiện Máy Tính làm Xếp Hạng Của Tôi', ko: '계산기 조건을 내 등급으로 저장' },
    myCombinedRating: { en: 'My Combined VA Rating', es: 'Mi Rating VA Combinado', tl: 'Ang Combined VA Rating Ko', vi: 'Xếp Hạng VA Kết Hợp Của Tôi', ko: '내 통합 VA 등급' },
    includesBilateral: { en: 'Includes Bilateral Factor', es: 'Incluye Factor Bilateral', tl: 'Kasama ang Bilateral Factor', vi: 'Bao Gồm Hệ Số Song Phương', ko: '양측 요인 포함' },
    estimatedMonthlyPaySolo: { en: 'Estimated Monthly Pay (Solo)', es: 'Pago Mensual Estimado (Solo)', tl: 'Tinatayang Buwanang Bayad (Solo)', vi: 'Lương Hàng Tháng Ước Tính (Đơn)', ko: '예상 월급 (단독)' },
    conditions: { en: 'Conditions', es: 'Condiciones', tl: 'Mga Kondisyon', vi: 'Tình Trạng', ko: '조건' },
    rawScore: { en: 'Raw Score', es: 'Puntuación Bruta', tl: 'Raw Score', vi: 'Điểm Thô', ko: '원점수' },
    gapAnalysis: { en: 'Gap Analysis', es: 'Análisis de Brecha', tl: 'Gap Analysis', vi: 'Phân Tích Khoảng Cách', ko: '갭 분석' },
    awayFromNextTier: { en: 'away from the next rating tier', es: 'para el siguiente nivel de rating', tl: 'mula sa susunod na rating tier', vi: 'còn lại để đến cấp xếp hạng tiếp theo', ko: '다음 등급까지' },
    closeToHundred: { en: 'So close to 100%! Use What-If to explore options.', es: '¡Muy cerca del 100%! Usa Qué-Si para explorar opciones.', tl: 'Malapit na sa 100%! Gamitin ang What-If para i-explore ang mga options.', vi: 'Gần 100% rồi! Sử dụng Giả Định để khám phá các lựa chọn.', ko: '100%에 가까워졌습니다! 가정을 사용하여 옵션을 탐색하세요.' },
    pyramidingAlert: { en: 'Pyramiding Alert', es: 'Alerta de Piramidación', tl: 'Pyramiding Alert', vi: 'Cảnh Báo Chồng Chéo', ko: '피라미드 경고' },
    saveRatingsToSee: { en: 'Save your ratings to see your combined rating and pay estimate here.', es: 'Guarda tus ratings para ver tu rating combinado y estimación de pago aquí.', tl: 'I-save ang iyong ratings para makita ang combined rating at pay estimate dito.', vi: 'Lưu xếp hạng để xem xếp hạng kết hợp và ước tính lương ở đây.', ko: '등급을 저장하면 통합 등급과 급여 추정치를 여기에서 볼 수 있습니다.' },
    proTip: { en: 'Pro Tip', es: 'Consejo Pro', tl: 'Pro Tip', vi: 'Mẹo Pro', ko: '프로 팁' },
    proTipDesc: { en: 'Your saved ratings can be used to:', es: 'Tus ratings guardados pueden usarse para:', tl: 'Ang iyong na-save na ratings ay maaaring gamitin para:', vi: 'Xếp hạng đã lưu của bạn có thể được sử dụng để:', ko: '저장된 등급은 다음에 사용할 수 있습니다:' },
    proTipItem1: { en: 'Quick-load into the Calculator for what-if scenarios', es: 'Cargar rápidamente en la Calculadora para escenarios qué-si', tl: 'Quick-load sa Calculator para sa what-if scenarios', vi: 'Tải nhanh vào Máy Tính cho các tình huống giả định', ko: '가정 시나리오를 위해 계산기에 빠르게 로드' },
    proTipItem2: { en: 'Pre-populate Secondary Scout with your service-connected conditions', es: 'Pre-llenar Secondary Scout con tus condiciones conectadas al servicio', tl: 'Pre-populate ang Secondary Scout gamit ang iyong service-connected conditions', vi: 'Điền trước Secondary Scout với các tình trạng liên quan đến phục vụ', ko: '복무 관련 조건으로 Secondary Scout 미리 채우기' },
    proTipItem3: { en: 'Track your rating progress over time', es: 'Rastrear tu progreso de rating a lo largo del tiempo', tl: 'I-track ang iyong rating progress sa paglipas ng panahon', vi: 'Theo dõi tiến trình xếp hạng theo thời gian', ko: '시간에 따른 등급 진행 상황 추적' },
    proTipItem4: { en: 'Calculate accurate paycheck estimates with dependents', es: 'Calcular estimaciones precisas de pago con dependientes', tl: 'Kalkulahin ang tamang paycheck estimates kasama ang dependents', vi: 'Tính toán ước tính lương chính xác với người phụ thuộc', ko: '부양가족과 함께 정확한 급여 추정 계산' },
    // C&P Results section
    capSimulatorResults: { en: 'C&P Simulator Results', es: 'Resultados del Simulador C&P', tl: 'C&P Simulator Results', vi: 'Kết Quả Mô Phỏng C&P', ko: 'C&P 시뮬레이터 결과' },
    capSimulatorDesc: { en: 'These ratings were predicted from your C&P Exam simulations. Add them to your calculator to see the combined rating impact!', es: 'Estos ratings fueron predichos de tus simulaciones de examen C&P. ¡Agrégalos a tu calculadora para ver el impacto del rating combinado!', tl: 'Ang mga rating na ito ay hinulaan mula sa iyong mga C&P Exam simulation. Idagdag sa calculator para makita ang combined rating impact!', vi: 'Các xếp hạng này được dự đoán từ các mô phỏng khám C&P của bạn. Thêm chúng vào máy tính để xem tác động của xếp hạng kết hợp!', ko: '이 등급들은 C&P 시험 시뮬레이션에서 예측되었습니다. 계산기에 추가하여 통합 등급 영향을 확인하세요!' },
    clearAll: { en: 'Clear All', es: 'Limpiar Todo', tl: 'I-clear Lahat', vi: 'Xóa Tất Cả', ko: '모두 지우기' },
    addToCalculator: { en: 'Add to Calculator', es: 'Agregar a Calculadora', tl: 'Idagdag sa Calculator', vi: 'Thêm vào Máy Tính', ko: '계산기에 추가' },
    saveToMyRatings: { en: 'Save to My Ratings', es: 'Guardar en Mis Ratings', tl: 'I-save sa Aking Ratings', vi: 'Lưu vào Xếp Hạng Của Tôi', ko: '내 등급에 저장' },
    quickPreview: { en: 'Quick Preview', es: 'Vista Previa Rápida', tl: 'Quick Preview', vi: 'Xem Trước Nhanh', ko: '빠른 미리보기' },
    ifYouAddAll: { en: 'If you add all C&P results to your existing conditions:', es: 'Si agregas todos los resultados C&P a tus condiciones existentes:', tl: 'Kung idadagdag mo lahat ng C&P results sa existing conditions mo:', vi: 'Nếu bạn thêm tất cả kết quả C&P vào các điều kiện hiện tại:', ko: '모든 C&P 결과를 기존 조건에 추가하면:' },
    current: { en: 'Current', es: 'Actual', tl: 'Kasalukuyan', vi: 'Hiện Tại', ko: '현재' },
    fromCAP: { en: 'From C&P', es: 'De C&P', tl: 'Mula sa C&P', vi: 'Từ C&P', ko: 'C&P에서' },
    combined: { en: 'Combined', es: 'Combinado', tl: 'Combined', vi: 'Kết Hợp', ko: '통합' },
    addAllToCalculator: { en: 'Add All to Calculator', es: 'Agregar Todo a Calculadora', tl: 'Idagdag Lahat sa Calculator', vi: 'Thêm Tất Cả vào Máy Tính', ko: '모두 계산기에 추가' },
    capRemember: { en: 'Remember: C&P Simulator predictions are based on your self-reported answers. The actual rating from the VA may differ based on the examiner\'s findings and all evidence in your file.', es: 'Recuerda: Las predicciones del Simulador C&P se basan en tus respuestas auto-reportadas. El rating real del VA puede diferir según los hallazgos del examinador y toda la evidencia en tu expediente.', tl: 'Tandaan: Ang mga C&P Simulator predictions ay batay sa iyong self-reported answers. Ang actual na rating mula sa VA ay maaaring magkaiba batay sa mga findings ng examiner at lahat ng evidence sa iyong file.', vi: 'Hãy nhớ: Các dự đoán của Mô phỏng C&P dựa trên câu trả lời tự báo cáo của bạn. Xếp hạng thực tế từ VA có thể khác dựa trên phát hiện của người khám và tất cả bằng chứng trong hồ sơ của bạn.', ko: '기억하세요: C&P 시뮬레이터 예측은 자가 보고한 답변을 기반으로 합니다. VA의 실제 등급은 검사관의 발견과 파일의 모든 증거에 따라 다를 수 있습니다.' },
    // Calculator tab
    youHaveSavedRatings: { en: 'You have saved ratings', es: 'Tienes ratings guardados', tl: 'Mayroon kang na-save na ratings', vi: 'Bạn có xếp hạng đã lưu', ko: '저장된 등급이 있습니다' },
    loadNow: { en: 'Load Now →', es: 'Cargar Ahora →', tl: 'I-load Ngayon →', vi: 'Tải Ngay →', ko: '지금 로드 →' },
    addRatedCondition: { en: 'Add Rated Condition', es: 'Agregar Condición Calificada', tl: 'Idagdag ang Rated Condition', vi: 'Thêm Tình Trạng Được Đánh Giá', ko: '평가된 조건 추가' },
    bodyPartConditionType: { en: 'Body Part / Condition Type', es: 'Parte del Cuerpo / Tipo de Condición', tl: 'Bahagi ng Katawan / Uri ng Kondisyon', vi: 'Bộ Phận Cơ Thể / Loại Tình Trạng', ko: '신체 부위 / 상태 유형' },
    select: { en: '-- Select --', es: '-- Seleccionar --', tl: '-- Pumili --', vi: '-- Chọn --', ko: '-- 선택 --' },
    extremitiesBilateral: { en: 'Extremities (Can be Bilateral)', es: 'Extremidades (Puede ser Bilateral)', tl: 'Mga Extremity (Maaaring Bilateral)', vi: 'Chi (Có Thể Song Phương)', ko: '사지 (양측 가능)' },
    otherBodySystems: { en: 'Other Body Systems', es: 'Otros Sistemas Corporales', tl: 'Iba pang Body Systems', vi: 'Hệ Thống Cơ Thể Khác', ko: '기타 신체 시스템' },
    notBilateral: { en: 'Not Bilateral', es: 'No Bilateral', tl: 'Hindi Bilateral', vi: 'Không Song Phương', ko: '양측 아님' },
    bothBilateral: { en: 'Both (Bilateral)', es: 'Ambos (Bilateral)', tl: 'Pareho (Bilateral)', vi: 'Cả Hai (Song Phương)', ko: '양쪽 (양측)' },
    ratingPercent: { en: 'Rating %', es: 'Rating %', tl: 'Rating %', vi: 'Xếp Hạng %', ko: '등급 %' },
    customLabelOptional: { en: 'Custom Label (optional)', es: 'Etiqueta Personalizada (opcional)', tl: 'Custom Label (opsyonal)', vi: 'Nhãn Tùy Chỉnh (tùy chọn)', ko: '사용자 지정 레이블 (선택사항)' },
    customLabelPlaceholder: { en: 'e.g., Tinnitus, PTSD, etc.', es: 'ej., Tinnitus, TEPT, etc.', tl: 'hal., Tinnitus, PTSD, atbp.', vi: 'ví dụ: Ù tai, PTSD, v.v.', ko: '예: 이명, PTSD 등' },
    addToCalculatorBtn: { en: '➕ Add to Calculator', es: '➕ Agregar a Calculadora', tl: '➕ Idagdag sa Calculator', vi: '➕ Thêm vào Máy Tính', ko: '➕ 계산기에 추가' },
    yourRatedConditions: { en: 'Your Rated Conditions', es: 'Tus Condiciones Calificadas', tl: 'Ang Iyong Rated Conditions', vi: 'Tình Trạng Được Đánh Giá Của Bạn', ko: '귀하의 평가된 조건' },
    noConditionsAddYours: { en: 'Add your service-connected ratings above.', es: 'Agrega tus ratings conectados al servicio arriba.', tl: 'Idagdag ang iyong service-connected ratings sa itaas.', vi: 'Thêm xếp hạng liên quan đến phục vụ của bạn ở trên.', ko: '위에 복무 관련 등급을 추가하세요.' },
    // Results section
    verifiedPer: { en: 'Verified per 38 CFR § 4.25 & § 4.26', es: 'Verificado según 38 CFR § 4.25 y § 4.26', tl: 'Verified ayon sa 38 CFR § 4.25 & § 4.26', vi: 'Đã xác minh theo 38 CFR § 4.25 & § 4.26', ko: '38 CFR § 4.25 & § 4.26에 따라 검증됨' },
    matchesVAGov: { en: 'Matches VA.gov', es: 'Coincide con VA.gov', tl: 'Tugma sa VA.gov', vi: 'Khớp với VA.gov', ko: 'VA.gov와 일치' },
    bilateralFactor: { en: 'Bilateral Factor', es: 'Factor Bilateral', tl: 'Bilateral Factor', vi: 'Hệ Số Song Phương', ko: '양측 요인' },
    youveReached100: { en: "You've reached 100%!", es: '¡Has alcanzado el 100%!', tl: 'Naabot mo na ang 100%!', vi: 'Bạn đã đạt 100%!', ko: '100%에 도달했습니다!' },
    gapTo: { en: 'Gap to', es: 'Brecha a', tl: 'Gap sa', vi: 'Khoảng cách đến', ko: '까지의 격차' },
    away: { en: 'away', es: 'faltante', tl: 'ang kulang', vi: 'còn lại', ko: '남음' },
    toReach90: { en: 'To reach 90%:', es: 'Para alcanzar 90%:', tl: 'Para maabot ang 90%:', vi: 'Để đạt 90%:', ko: '90%에 도달하려면:' },
    toReach100: { en: 'To reach 100%:', es: 'Para alcanzar 100%:', tl: 'Para maabot ang 100%:', vi: 'Để đạt 100%:', ko: '100%에 도달하려면:' },
    needApprox: { en: 'You need approximately', es: 'Necesitas aproximadamente', tl: 'Kailangan mo ng humigit-kumulang', vi: 'Bạn cần khoảng', ko: '대략 필요합니다' },
    moreInNewRatings: { en: 'more in new ratings', es: 'más en nuevos ratings', tl: 'pa sa bagong ratings', vi: 'thêm trong xếp hạng mới', ko: '새 등급에서 더' },
    monthlyPaySolo: { en: 'Monthly Pay (Solo)', es: 'Pago Mensual (Solo)', tl: 'Buwanang Bayad (Solo)', vi: 'Lương Hàng Tháng (Đơn)', ko: '월급 (단독)' },
    addDependents: { en: 'Add Dependents →', es: 'Agregar Dependientes →', tl: 'Idagdag Dependents →', vi: 'Thêm Người Phụ Thuộc →', ko: '부양가족 추가 →' },
    showCalculationSteps: { en: 'Show Calculation Steps', es: 'Mostrar Pasos de Cálculo', tl: 'Ipakita ang Calculation Steps', vi: 'Hiển Thị Các Bước Tính Toán', ko: '계산 단계 표시' },
    hideCalculationSteps: { en: 'Hide Calculation Steps', es: 'Ocultar Pasos de Cálculo', tl: 'Itago ang Calculation Steps', vi: 'Ẩn Các Bước Tính Toán', ko: '계산 단계 숨기기' },
    officialVAMethod: { en: 'Per 38 CFR § 4.25 & § 4.26 - Official VA Combined Ratings Method', es: 'Según 38 CFR § 4.25 y § 4.26 - Método Oficial de Ratings Combinados del VA', tl: 'Ayon sa 38 CFR § 4.25 & § 4.26 - Official VA Combined Ratings Method', vi: 'Theo 38 CFR § 4.25 & § 4.26 - Phương Pháp Xếp Hạng Kết Hợp Chính Thức của VA', ko: '38 CFR § 4.25 & § 4.26에 따름 - 공식 VA 통합 등급 방법' },
    calculationVerified: { en: 'Calculation Verified', es: 'Cálculo Verificado', tl: 'Calculation Verified', vi: 'Đã Xác Minh Tính Toán', ko: '계산 확인됨' },
    matchesCalculators: { en: 'This matches VA.gov, DAV, and Hill & Ponton calculators', es: 'Esto coincide con las calculadoras de VA.gov, DAV y Hill & Ponton', tl: 'Ito ay tugma sa VA.gov, DAV, at Hill & Ponton calculators', vi: 'Điều này khớp với các máy tính VA.gov, DAV và Hill & Ponton', ko: 'VA.gov, DAV 및 Hill & Ponton 계산기와 일치합니다' },
    usingOfficialMethod: { en: 'Using official VA Combined Ratings Table method', es: 'Usando el método oficial de la Tabla de Ratings Combinados del VA', tl: 'Gumagamit ng official VA Combined Ratings Table method', vi: 'Sử dụng phương pháp Bảng Xếp Hạng Kết Hợp VA chính thức', ko: '공식 VA 통합 등급표 방법 사용' },
    automatedCheck: { en: 'Note: This is an automated check. Consult your C-file and 38 CFR schedules to confirm.', es: 'Nota: Esta es una verificación automática. Consulta tu expediente C y los horarios de 38 CFR para confirmar.', tl: 'Paalala: Ito ay automated check. Kumonsulta sa iyong C-file at 38 CFR schedules para kumpirmahin.', vi: 'Lưu ý: Đây là kiểm tra tự động. Tham khảo hồ sơ C và lịch trình 38 CFR để xác nhận.', ko: '참고: 이것은 자동 확인입니다. C-파일과 38 CFR 일정을 참조하여 확인하세요.' },
    affectedConditions: { en: 'Affected conditions', es: 'Condiciones afectadas', tl: 'Mga apektadong kondisyon', vi: 'Các tình trạng bị ảnh hưởng', ko: '영향받는 조건' },
    // Paycheck tab
    yourDependents: { en: 'Your Dependents', es: 'Tus Dependientes', tl: 'Ang Iyong Dependents', vi: 'Người Phụ Thuộc Của Bạn', ko: '귀하의 부양가족' },
    dependentNote: { en: 'Note: Dependent benefits only apply at 30% or higher combined rating.', es: 'Nota: Los beneficios de dependientes solo aplican con un rating combinado de 30% o más.', tl: 'Paalala: Ang dependent benefits ay applicable lamang sa 30% o mas mataas na combined rating.', vi: 'Lưu ý: Quyền lợi người phụ thuộc chỉ áp dụng với xếp hạng kết hợp từ 30% trở lên.', ko: '참고: 부양가족 혜택은 30% 이상의 통합 등급에만 적용됩니다.' },
    married: { en: 'Married', es: 'Casado', tl: 'Kasal', vi: 'Đã Kết Hôn', ko: '기혼' },
    spouseAidAttendance: { en: 'Spouse Needs Aid & Attendance', es: 'Cónyuge Necesita Ayuda y Asistencia', tl: 'Asawa Nangangailangan ng Aid & Attendance', vi: 'Vợ/Chồng Cần Trợ Giúp & Chăm Sóc', ko: '배우자 간호 필요' },
    childrenUnder18: { en: 'Children Under 18', es: 'Hijos Menores de 18', tl: 'Mga Anak Under 18', vi: 'Con Dưới 18 Tuổi', ko: '18세 미만 자녀' },
    childrenInSchool: { en: 'Children 18-23 in School', es: 'Hijos 18-23 en Escuela', tl: 'Mga Anak 18-23 sa School', vi: 'Con 18-23 Tuổi Đang Đi Học', ko: '학교에 다니는 18-23세 자녀' },
    dependentParents: { en: 'Dependent Parents', es: 'Padres Dependientes', tl: 'Dependent Parents', vi: 'Cha Mẹ Phụ Thuộc', ko: '부양 부모' },
    yourEstimatedPay: { en: 'Your Estimated Pay (2025 Rates)', es: 'Tu Pago Estimado (Tasas 2025)', tl: 'Ang Iyong Estimated Pay (2025 Rates)', vi: 'Lương Ước Tính Của Bạn (Tỷ Lệ 2025)', ko: '예상 급여 (2025년 요율)' },
    monthlyCompensation: { en: 'Monthly Compensation', es: 'Compensación Mensual', tl: 'Buwanang Compensation', vi: 'Bồi Thường Hàng Tháng', ko: '월간 보상' },
    breakdown: { en: 'Breakdown', es: 'Desglose', tl: 'Breakdown', vi: 'Chi Tiết', ko: '분석' },
    baseRate: { en: 'Base Rate', es: 'Tasa Base', tl: 'Base Rate', vi: 'Tỷ Lệ Cơ Bản', ko: '기본 요율' },
    spouseAA: { en: 'Spouse A&A', es: 'Cónyuge A&A', tl: 'Asawa A&A', vi: 'Vợ/Chồng A&A', ko: '배우자 A&A' },
    total: { en: 'Total', es: 'Total', tl: 'Kabuuan', vi: 'Tổng', ko: '총계' },
    smcNote: { en: 'SMC Note: At 100%, you may qualify for Special Monthly Compensation (SMC) if you have additional disabilities rated 60%+ or loss of use. This calculator shows base rates only.', es: 'Nota SMC: Al 100%, puedes calificar para Compensación Mensual Especial (SMC) si tienes discapacidades adicionales del 60%+ o pérdida de uso. Esta calculadora muestra solo tasas base.', tl: 'SMC Note: Sa 100%, maaari kang mag-qualify para sa Special Monthly Compensation (SMC) kung mayroon kang additional disabilities na rated 60%+ o loss of use. Ang calculator na ito ay nagpapakita ng base rates lamang.', vi: 'Lưu ý SMC: Ở 100%, bạn có thể đủ điều kiện nhận Bồi Thường Hàng Tháng Đặc Biệt (SMC) nếu bạn có khuyết tật bổ sung được đánh giá 60%+ hoặc mất khả năng sử dụng. Máy tính này chỉ hiển thị tỷ lệ cơ bản.', ko: 'SMC 참고: 100%에서 60% 이상의 추가 장애 또는 사용 손실이 있으면 특별 월간 보상(SMC)을 받을 수 있습니다. 이 계산기는 기본 요율만 표시합니다.' },
    // What-If tab
    whatIfQuestion: { en: 'What If I Got Another Rating?', es: '¿Qué Si Obtengo Otro Rating?', tl: 'Paano Kung Makakuha Ako ng Isa Pang Rating?', vi: 'Nếu Tôi Nhận Được Xếp Hạng Khác Thì Sao?', ko: '다른 등급을 받으면 어떻게 될까요?' },
    whatIfDesc: { en: 'See how adding a new rating would change your combined percentage and monthly pay.', es: 'Ve cómo agregar un nuevo rating cambiaría tu porcentaje combinado y pago mensual.', tl: 'Tingnan kung paano magbabago ang iyong combined percentage at buwanang bayad kapag nagdagdag ng bagong rating.', vi: 'Xem cách thêm xếp hạng mới sẽ thay đổi tỷ lệ kết hợp và lương hàng tháng của bạn.', ko: '새 등급을 추가하면 통합 비율과 월급이 어떻게 변경되는지 확인하세요.' },
    newRatingPercentage: { en: 'New Rating Percentage', es: 'Nuevo Porcentaje de Rating', tl: 'Bagong Rating Percentage', vi: 'Phần Trăm Xếp Hạng Mới', ko: '새 등급 비율' },
    wouldBeBilateral: { en: 'This would be a bilateral condition', es: 'Esta sería una condición bilateral', tl: 'Ito ay magiging bilateral condition', vi: 'Đây sẽ là tình trạng song phương', ko: '이것은 양측 상태가 될 것입니다' },
    addsBilateralBoost: { en: 'Adds 10% bilateral factor boost', es: 'Agrega 10% de impulso de factor bilateral', tl: 'Nagdadagdag ng 10% bilateral factor boost', vi: 'Thêm 10% hệ số song phương', ko: '10% 양측 요인 부스트 추가' },
    projectedImpact: { en: 'Projected Impact', es: 'Impacto Proyectado', tl: 'Projected Impact', vi: 'Tác Động Dự Kiến', ko: '예상 영향' },
    ratingChange: { en: 'Rating Change', es: 'Cambio de Rating', tl: 'Pagbabago sa Rating', vi: 'Thay Đổi Xếp Hạng', ko: '등급 변경' },
    payComparisonSolo: { en: 'Pay Comparison (Solo)', es: 'Comparación de Pago (Solo)', tl: 'Pay Comparison (Solo)', vi: 'So Sánh Lương (Đơn)', ko: '급여 비교 (단독)' },
    projected: { en: 'Projected', es: 'Proyectado', tl: 'Projected', vi: 'Dự Kiến', ko: '예상' },
    monthlyIncrease: { en: 'Monthly Increase', es: 'Aumento Mensual', tl: 'Buwanang Increase', vi: 'Tăng Hàng Tháng', ko: '월간 증가' },
    annualIncrease: { en: 'Annual Increase', es: 'Aumento Anual', tl: 'Taunang Increase', vi: 'Tăng Hàng Năm', ko: '연간 증가' },
    pathfinderTip: { en: 'Use our Pathfinder tool to discover secondary conditions that could help you reach your target rating!', es: '¡Usa nuestra herramienta Pathfinder para descubrir condiciones secundarias que podrían ayudarte a alcanzar tu rating objetivo!', tl: 'Gamitin ang aming Pathfinder tool para matuklasan ang mga secondary conditions na makakatulong sa iyo na maabot ang target rating mo!', vi: 'Sử dụng công cụ Pathfinder của chúng tôi để khám phá các tình trạng thứ cấp có thể giúp bạn đạt được xếp hạng mục tiêu!', ko: 'Pathfinder 도구를 사용하여 목표 등급에 도달하는 데 도움이 될 수 있는 2차 조건을 찾아보세요!' },
    // Rates tab
    vaDisabilityRates2026: { en: '2026 VA Disability Compensation Rates', es: 'Tasas de Compensación por Discapacidad VA 2026', tl: '2026 VA Disability Compensation Rates', vi: 'Tỷ Lệ Bồi Thường Khuyết Tật VA 2026', ko: '2026 VA 장애 보상 요율' },
    effectiveDate: { en: 'Effective December 1, 2025', es: 'Vigente desde el 1 de diciembre de 2025', tl: 'Effective December 1, 2025', vi: 'Có Hiệu Lực từ 1 tháng 12, 2025', ko: '2025년 12월 1일부터 적용' },
    source: { en: 'Source', es: 'Fuente', tl: 'Pinagmulan', vi: 'Nguồn', ko: '출처' },
    veteransWith10to20: { en: 'Veterans with 10% to 20% Rating', es: 'Veteranos con Rating del 10% al 20%', tl: 'Mga Beterano na may 10% hanggang 20% Rating', vi: 'Cựu Chiến Binh với Xếp Hạng 10% đến 20%', ko: '10%에서 20% 등급의 재향군인' },
    noDependentBenefits: { en: 'Note: At 10-20%, you won\'t receive a higher rate even if you have dependents.', es: 'Nota: Al 10-20%, no recibirás una tasa más alta aunque tengas dependientes.', tl: 'Paalala: Sa 10-20%, hindi ka makakatanggap ng mas mataas na rate kahit may dependents ka.', vi: 'Lưu ý: Ở 10-20%, bạn sẽ không nhận được mức cao hơn ngay cả khi có người phụ thuộc.', ko: '참고: 10-20%에서는 부양가족이 있어도 더 높은 요율을 받지 못합니다.' },
    veteranAlone: { en: 'Veteran Alone (No Dependents)', es: 'Veterano Solo (Sin Dependientes)', tl: 'Beterano Lang (Walang Dependents)', vi: 'Cựu Chiến Binh Đơn (Không Người Phụ Thuộc)', ko: '재향군인 단독 (부양가족 없음)' },
    monthly: { en: 'Monthly', es: 'Mensual', tl: 'Buwanan', vi: 'Hàng Tháng', ko: '월간' },
    annual: { en: 'Annual', es: 'Anual', tl: 'Taon-taon', vi: 'Hàng Năm', ko: '연간' },
    withSpouse: { en: 'With Spouse (No Children or Parents)', es: 'Con Cónyuge (Sin Hijos ni Padres)', tl: 'May Asawa (Walang Anak o Magulang)', vi: 'Với Vợ/Chồng (Không Con hoặc Cha Mẹ)', ko: '배우자와 함께 (자녀나 부모 없음)' },
    spouseAdd: { en: 'Spouse Add', es: 'Adición Cónyuge', tl: 'Dagdag ng Asawa', vi: 'Thêm Vợ/Chồng', ko: '배우자 추가' },
    additionalAmounts: { en: 'Additional Amounts for Dependents', es: 'Montos Adicionales por Dependientes', tl: 'Karagdagang Halaga para sa Dependents', vi: 'Số Tiền Bổ Sung cho Người Phụ Thuộc', ko: '부양가족 추가 금액' },
    additionalAmountsNote: { en: 'These amounts are added to your base rate at 30%+ rating.', es: 'Estos montos se agregan a tu tasa base con un rating del 30%+.', tl: 'Ang mga halagang ito ay idinaragdag sa iyong base rate sa 30%+ rating.', vi: 'Các số tiền này được thêm vào tỷ lệ cơ bản của bạn ở xếp hạng 30%+.', ko: '이 금액은 30% 이상 등급에서 기본 요율에 추가됩니다.' },
    dependentType: { en: 'Dependent Type', es: 'Tipo de Dependiente', tl: 'Uri ng Dependent', vi: 'Loại Người Phụ Thuộc', ko: '부양가족 유형' },
    firstChild: { en: 'First Child', es: 'Primer Hijo', tl: 'Unang Anak', vi: 'Con Đầu Tiên', ko: '첫째 자녀' },
    eachAddlChild: { en: 'Each Add\'l Child <18', es: 'Cada Hijo Adicional <18', tl: 'Bawat Karagdagang Anak <18', vi: 'Mỗi Con Thêm <18', ko: '18세 미만 추가 자녀 각각' },
    child18InSchool: { en: 'Child 18+ in School', es: 'Hijo 18+ en Escuela', tl: 'Anak 18+ sa School', vi: 'Con 18+ Đang Đi Học', ko: '학교에 다니는 18세 이상 자녀' },
    oneParent: { en: '1 Parent', es: '1 Padre', tl: '1 Magulang', vi: '1 Cha Mẹ', ko: '부모 1명' },
    twoParents: { en: '2 Parents', es: '2 Padres', tl: '2 Magulang', vi: '2 Cha Mẹ', ko: '부모 2명' },
    veteranAlone100: { en: '100% Veteran Alone', es: '100% Veterano Solo', tl: '100% Beterano Lang', vi: '100% Cựu Chiến Binh Đơn', ko: '100% 재향군인 단독' },
    withSpouse100: { en: '100% with Spouse', es: '100% con Cónyuge', tl: '100% may Asawa', vi: '100% với Vợ/Chồng', ko: '100% 배우자와 함께' },
    withSpouseChild100: { en: '100% with Spouse + Child', es: '100% con Cónyuge + Hijo', tl: '100% may Asawa + Anak', vi: '100% với Vợ/Chồng + Con', ko: '100% 배우자 + 자녀와 함께' },
    colaNote: { en: 'Cost-of-Living Adjustment (COLA): VA is required by law to match the COLA percentage applied to Social Security benefits. This ensures your benefits keep up with inflation.', es: 'Ajuste por Costo de Vida (COLA): El VA está obligado por ley a igualar el porcentaje COLA aplicado a los beneficios del Seguro Social. Esto asegura que tus beneficios mantengan el ritmo de la inflación.', tl: 'Cost-of-Living Adjustment (COLA): Ang VA ay kinakailangan ng batas na itugma ang COLA percentage na inilapat sa Social Security benefits. Tinitiyak nito na ang iyong mga benefits ay nakakasabay sa inflation.', vi: 'Điều Chỉnh Chi Phí Sinh Hoạt (COLA): VA được yêu cầu theo luật để khớp với tỷ lệ COLA áp dụng cho quyền lợi An Sinh Xã Hội. Điều này đảm bảo quyền lợi của bạn theo kịp lạm phát.', ko: '생활비 조정(COLA): VA는 법률에 따라 사회보장 혜택에 적용되는 COLA 비율과 일치시켜야 합니다. 이는 혜택이 인플레이션을 따라가도록 보장합니다.' },
    learnMoreCOLA: { en: 'Learn more about COLA on SSA.gov →', es: 'Aprende más sobre COLA en SSA.gov →', tl: 'Alamin ang higit pa tungkol sa COLA sa SSA.gov →', vi: 'Tìm hiểu thêm về COLA tại SSA.gov →', ko: 'SSA.gov에서 COLA에 대해 자세히 알아보기 →' },
    learnMoreCola: { en: 'Learn more about COLA on SSA.gov', es: 'Aprende más sobre COLA en SSA.gov', tl: 'Alamin ang higit pa tungkol sa COLA sa SSA.gov', vi: 'Tìm hiểu thêm về COLA tại SSA.gov', ko: 'SSA.gov에서 COLA에 대해 자세히 알아보기' },
    colaTitle: { en: 'Cost-of-Living Adjustment (COLA)', es: 'Ajuste por Costo de Vida (COLA)', tl: 'Cost-of-Living Adjustment (COLA)', vi: 'Điều Chỉnh Chi Phí Sinh Hoạt (COLA)', ko: '생활비 조정(COLA)' },
    colaDescription: { en: 'VA is required by law to match the COLA percentage applied to Social Security benefits. This ensures your benefits keep up with inflation.', es: 'El VA está obligado por ley a igualar el porcentaje COLA aplicado a los beneficios del Seguro Social. Esto asegura que tus beneficios mantengan el ritmo de la inflación.', tl: 'Ang VA ay kinakailangan ng batas na itugma ang COLA percentage na inilapat sa Social Security benefits. Tinitiyak nito na ang iyong mga benefits ay nakakasabay sa inflation.', vi: 'VA được yêu cầu theo luật để khớp với tỷ lệ COLA áp dụng cho quyền lợi An Sinh Xã Hội. Điều này đảm bảo quyền lợi của bạn theo kịp lạm phát.', ko: 'VA는 법률에 따라 사회보장 혜택에 적용되는 COLA 비율과 일치시켜야 합니다. 이는 혜택이 인플레이션을 따라가도록 보장합니다.' },
    year: { en: 'year', es: 'año', tl: 'taon', vi: 'năm', ko: '년' },
    addlChildUnder18: { en: "Each Add'l Child <18", es: 'Cada Hijo Adicional <18', tl: 'Bawat Karagdagang Anak <18', vi: 'Mỗi Con Thêm <18', ko: '18세 미만 추가 자녀 각각' },
    childSchool: { en: 'Child 18+ in School', es: 'Hijo 18+ en Escuela', tl: 'Anak 18+ sa School', vi: 'Con 18+ Đang Đi Học', ko: '학교에 다니는 18세 이상 자녀' },
    quickReference: { en: 'Quick Reference', es: 'Referencia Rápida', tl: 'Quick Reference', vi: 'Tham Khảo Nhanh', ko: '빠른 참조' },
    max100Rating: { en: 'Max (100% rating)', es: 'Máx (100% rating)', tl: 'Max (100% rating)', vi: 'Tối đa (100% xếp hạng)', ko: '최대 (100% 등급)' },
    annual100: { en: 'Annual (100%)', es: 'Anual (100%)', tl: 'Taon-taon (100%)', vi: 'Hàng Năm (100%)', ko: '연간 (100%)' },
    minRating10: { en: 'Min (10% rating)', es: 'Mín (10% rating)', tl: 'Min (10% rating)', vi: 'Tối thiểu (10% xếp hạng)', ko: '최소 (10% 등급)' },
    schedularJump: { en: 'Biggest Jump', es: 'Mayor Salto', tl: 'Pinakamalaking Jump', vi: 'Bước Nhảy Lớn Nhất', ko: '가장 큰 도약' },
    // Footer
    basedOn38CFR: { en: 'Based on 38 CFR § 4.25 (Combined Ratings) and 2026 VA Pay Rates (Effective Dec 1, 2025)', es: 'Basado en 38 CFR § 4.25 (Ratings Combinados) y Tasas de Pago VA 2026 (Vigente desde el 1 de dic 2025)', tl: 'Batay sa 38 CFR § 4.25 (Combined Ratings) at 2026 VA Pay Rates (Effective Dec 1, 2025)', vi: 'Dựa trên 38 CFR § 4.25 (Xếp Hạng Kết Hợp) và Tỷ Lệ Thanh Toán VA 2026 (Có Hiệu Lực từ 1 tháng 12, 2025)', ko: '38 CFR § 4.25 (통합 등급) 및 2026 VA 급여 요율 기준 (2025년 12월 1일 적용)' },
    thisIsEstimate: { en: 'This is an estimate. Actual payments may vary.', es: 'Esto es una estimación. Los pagos reales pueden variar.', tl: 'Ito ay estimate. Ang actual na bayad ay maaaring mag-iba.', vi: 'Đây là ước tính. Các khoản thanh toán thực tế có thể khác.', ko: '이것은 추정치입니다. 실제 지불액은 다를 수 있습니다.' },
    close: { en: 'Close', es: 'Cerrar', tl: 'Isara', vi: 'Đóng', ko: '닫기' },
    // Edit modal
    editCondition: { en: 'Edit Condition', es: 'Editar Condición', tl: 'I-edit ang Kondisyon', vi: 'Chỉnh Sửa Tình Trạng', ko: '조건 편집' },
    updateRatingBilateral: { en: 'Update rating and bilateral status', es: 'Actualizar rating y estado bilateral', tl: 'I-update ang rating at bilateral status', vi: 'Cập nhật xếp hạng và trạng thái song phương', ko: '등급 및 양측 상태 업데이트' },
    bodyPartSystem: { en: 'Body Part / System', es: 'Parte del Cuerpo / Sistema', tl: 'Bahagi ng Katawan / Sistema', vi: 'Bộ Phận Cơ Thể / Hệ Thống', ko: '신체 부위 / 시스템' },
    selectBodyPart: { en: 'Select body part...', es: 'Seleccionar parte del cuerpo...', tl: 'Pumili ng bahagi ng katawan...', vi: 'Chọn bộ phận cơ thể...', ko: '신체 부위 선택...' },
    ratingPercentage: { en: 'Rating Percentage', es: 'Porcentaje de Rating', tl: 'Rating Percentage', vi: 'Phần Trăm Xếp Hạng', ko: '등급 비율' },
    sideBilateralFactor: { en: 'Side (Bilateral Factor)', es: 'Lado (Factor Bilateral)', tl: 'Panig (Bilateral Factor)', vi: 'Bên (Hệ Số Song Phương)', ko: '측면 (양측 요인)' },
    bothSides: { en: 'Both Sides', es: 'Ambos Lados', tl: 'Parehong Panig', vi: 'Cả Hai Bên', ko: '양쪽' },
    bilateralExplanation: { en: 'If you have the same condition on both left and right (e.g., both knees), mark each as Left/Right to automatically apply the 10% Bilateral Factor per 38 CFR § 4.26', es: 'Si tienes la misma condición en ambos lados (ej., ambas rodillas), marca cada uno como Izquierda/Derecha para aplicar automáticamente el Factor Bilateral del 10% según 38 CFR § 4.26', tl: 'Kung pareho ang kondisyon sa kaliwa at kanan (hal., parehong tuhod), markahan ang bawat isa bilang Left/Right para awtomatikong mag-apply ang 10% Bilateral Factor ayon sa 38 CFR § 4.26', vi: 'Nếu bạn có cùng tình trạng ở cả hai bên trái và phải (ví dụ: cả hai đầu gối), đánh dấu mỗi bên là Trái/Phải để tự động áp dụng Hệ Số Song Phương 10% theo 38 CFR § 4.26', ko: '좌우 양쪽에 동일한 상태가 있는 경우(예: 양쪽 무릎), 38 CFR § 4.26에 따라 10% 양측 요인을 자동으로 적용하려면 각각 왼쪽/오른쪽으로 표시하세요' },
    bilateralWillApply: { en: 'Bilateral Factor Will Apply', es: 'Se Aplicará Factor Bilateral', tl: 'Mag-aaply ang Bilateral Factor', vi: 'Hệ Số Song Phương Sẽ Được Áp Dụng', ko: '양측 요인이 적용됩니다' },
    bilateralApplyDesc: { en: 'Per 38 CFR § 4.26, if you have paired extremities rated (left + right), you\'ll get an additional 10% boost to the combined bilateral rating.', es: 'Según 38 CFR § 4.26, si tienes extremidades emparejadas calificadas (izquierda + derecha), obtendrás un impulso adicional del 10% al rating bilateral combinado.', tl: 'Ayon sa 38 CFR § 4.26, kung mayroon kang paired extremities na rated (left + right), makakakuha ka ng karagdagang 10% boost sa combined bilateral rating.', vi: 'Theo 38 CFR § 4.26, nếu bạn có các chi được xếp hạng theo cặp (trái + phải), bạn sẽ nhận được 10% tăng thêm cho xếp hạng song phương kết hợp.', ko: '38 CFR § 4.26에 따라, 짝을 이룬 사지가 등급을 받은 경우(좌+우), 통합 양측 등급에 추가 10% 부스트를 받게 됩니다.' },
    cancel: { en: 'Cancel', es: 'Cancelar', tl: 'Kanselahin', vi: 'Hủy', ko: '취소' },
    saveChanges: { en: 'Save Changes', es: 'Guardar Cambios', tl: 'I-save ang Pagbabago', vi: 'Lưu Thay Đổi', ko: '변경 사항 저장' },
    remove: { en: 'Remove', es: 'Eliminar', tl: 'Alisin', vi: 'Xóa', ko: '제거' },
    edit: { en: 'Edit', es: 'Editar', tl: 'I-edit', vi: 'Chỉnh Sửa', ko: '편집' },
    atYourRating: { en: 'at your rating', es: 'a tu rating', tl: 'sa iyong rating', vi: 'ở xếp hạng của bạn', ko: '귀하의 등급에서' },
    addSomeConditionsFirst: { en: 'Add some conditions in the Calculator tab first!', es: '¡Primero agrega algunas condiciones en la pestaña Calculadora!', tl: 'Magdagdag muna ng mga kondisyon sa Calculator tab!', vi: 'Thêm một số tình trạng trong tab Máy Tính trước!', ko: '먼저 계산기 탭에서 일부 조건을 추가하세요!' },
    pleaseSelectBodyPart: { en: 'Please select a body part.', es: 'Por favor selecciona una parte del cuerpo.', tl: 'Mangyaring pumili ng bahagi ng katawan.', vi: 'Vui lòng chọn một bộ phận cơ thể.', ko: '신체 부위를 선택해 주세요.' },
    footerCFR: { en: 'Based on 38 CFR § 4.25 (Combined Ratings) and 2026 VA Pay Rates (Effective Dec 1, 2025)', es: 'Basado en 38 CFR § 4.25 (Ratings Combinados) y Tasas de Pago VA 2026 (Vigente desde el 1 de dic 2025)', tl: 'Batay sa 38 CFR § 4.25 (Combined Ratings) at 2026 VA Pay Rates (Effective Dec 1, 2025)', vi: 'Dựa trên 38 CFR § 4.25 (Xếp Hạng Kết Hợp) và Tỷ Lệ Thanh Toán VA 2026 (Có Hiệu Lực từ 1 tháng 12, 2025)', ko: '38 CFR § 4.25 (통합 등급) 및 2026 VA 급여 요율 기준 (2025년 12월 1일 적용)' },
    footerDisclaimer: { en: 'This is an estimate. Actual payments may vary.', es: 'Esto es una estimación. Los pagos reales pueden variar.', tl: 'Ito ay estimate. Ang actual na bayad ay maaaring mag-iba.', vi: 'Đây là ước tính. Các khoản thanh toán thực tế có thể khác.', ko: '이것은 추정치입니다. 실제 지불액은 다를 수 있습니다.' },
    conditionPlaceholder: { en: 'e.g., PTSD, Knee Pain', es: 'ej., TEPT, Dolor de Rodilla', tl: 'hal., PTSD, Sakit ng Tuhod', vi: 'ví dụ: PTSD, Đau Đầu Gối', ko: '예: PTSD, 무릎 통증' },
    extremitiesGroup: { en: 'Extremities (Can be Bilateral)', es: 'Extremidades (Puede ser Bilateral)', tl: 'Mga Extremity (Maaaring Bilateral)', vi: 'Chi (Có Thể Song Phương)', ko: '사지 (양측 가능)' },
    otherSystems: { en: 'Other Body Systems', es: 'Otros Sistemas Corporales', tl: 'Iba pang Body Systems', vi: 'Hệ Thống Cơ Thể Khác', ko: '기타 신체 시스템' },
    sideBilateral: { en: 'Side (Bilateral Factor)', es: 'Lado (Factor Bilateral)', tl: 'Panig (Bilateral Factor)', vi: 'Bên (Hệ Số Song Phương)', ko: '측면 (양측 요인)' },
    bilateralHint: { en: 'If you have the same condition on both left and right (e.g., both knees), mark each as Left/Right to automatically apply the 10% Bilateral Factor per 38 CFR § 4.26', es: 'Si tienes la misma condición en ambos lados (ej., ambas rodillas), marca cada uno como Izquierda/Derecha para aplicar automáticamente el Factor Bilateral del 10% según 38 CFR § 4.26', tl: 'Kung pareho ang kondisyon sa kaliwa at kanan (hal., parehong tuhod), markahan ang bawat isa bilang Left/Right para awtomatikong mag-apply ang 10% Bilateral Factor ayon sa 38 CFR § 4.26', vi: 'Nếu bạn có cùng tình trạng ở cả hai bên trái và phải (ví dụ: cả hai đầu gối), đánh dấu mỗi bên là Trái/Phải để tự động áp dụng Hệ Số Song Phương 10% theo 38 CFR § 4.26', ko: '좌우 양쪽에 동일한 상태가 있는 경우(예: 양쪽 무릎), 38 CFR § 4.26에 따라 10% 양측 요인을 자동으로 적용하려면 각각 왼쪽/오른쪽으로 표시하세요' },
  },

  // My Packet
  myPacketSection: {
    title: { en: 'My Packet', es: 'Mi Paquete', tl: 'Ang Aking Packet', vi: 'Hồ Sơ Của Tôi', ko: '내 패킷' },
    subtitle: { en: 'Your Claims Command Center', es: 'Tu Centro de Mando de Reclamos', tl: 'Ang Claims Command Center Mo', vi: 'Trung Tâm Điều Khiển Yêu Cầu', ko: '청구 관리 센터' },
    manageDescription: { en: 'Manage your saved claims and generated statements', es: 'Administra tus reclamos guardados y declaraciones generadas', tl: 'Pamahalaan ang iyong naka-save na mga claim at mga nalikhang statement', vi: 'Quản lý các yêu cầu đã lưu và báo cáo đã tạo', ko: '저장된 청구 및 생성된 진술서 관리' },
    claims: { en: 'Claims', es: 'Reclamos', tl: 'Mga Claim', vi: 'Yêu Cầu', ko: '청구' },
    forms: { en: 'Forms', es: 'Formularios', tl: 'Mga Form', vi: 'Biểu Mẫu', ko: '양식' },
    ratings: { en: 'Ratings', es: 'Ratings', tl: 'Mga Rating', vi: 'Xếp Hạng', ko: '등급' },
    serviceHistory: { en: 'Service History', es: 'Historial de Servicio', tl: 'Service History', vi: 'Lịch Sử Phục Vụ', ko: '복무 이력' },
    service: { en: 'Service', es: 'Servicio', tl: 'Serbisyo', vi: 'Phục Vụ', ko: '복무' },
    timeline: { en: 'Timeline', es: 'Línea de Tiempo', tl: 'Timeline', vi: 'Dòng Thời Gian', ko: '타임라인' },
    painMaps: { en: 'Pain Maps', es: 'Mapas de Dolor', tl: 'Pain Maps', vi: 'Bản Đồ Đau', ko: '통증 지도' },
    profile: { en: 'Profile', es: 'Perfil', tl: 'Profile', vi: 'Hồ Sơ', ko: '프로필' },
    noClaims: { en: 'No claims saved yet', es: 'Aún no hay reclamos guardados', tl: 'Wala pang naka-save na claims', vi: 'Chưa có yêu cầu nào được lưu', ko: '저장된 청구가 없습니다' },
    noSavedClaims: { en: 'No Saved Claims', es: 'Sin Reclamos Guardados', tl: 'Walang Naka-save na Claims', vi: 'Không Có Yêu Cầu Đã Lưu', ko: '저장된 청구 없음' },
    noSavedRatings: { en: 'No Saved Ratings', es: 'Sin Ratings Guardados', tl: 'Walang Naka-save na Ratings', vi: 'Không Có Xếp Hạng Đã Lưu', ko: '저장된 등급 없음' },
    noSavedForms: { en: 'No Saved Forms', es: 'Sin Formularios Guardados', tl: 'Walang Naka-save na Forms', vi: 'Không Có Biểu Mẫu Đã Lưu', ko: '저장된 양식 없음' },
    noTimelineEvents: { en: 'No Timeline Events', es: 'Sin Eventos en Línea de Tiempo', tl: 'Walang Timeline Events', vi: 'Không Có Sự Kiện Dòng Thời Gian', ko: '타임라인 이벤트 없음' },
    noPainMaps: { en: 'No Pain Maps Saved', es: 'Sin Mapas de Dolor Guardados', tl: 'Walang Naka-save na Pain Maps', vi: 'Không Có Bản Đồ Đau Đã Lưu', ko: '저장된 통증 지도 없음' },
    addClaim: { en: 'Add Claim', es: 'Agregar Reclamo', tl: 'Idagdag ang Claim', vi: 'Thêm Yêu Cầu', ko: '청구 추가' },
    exportAll: { en: 'Export All', es: 'Exportar Todo', tl: 'I-export Lahat', vi: 'Xuất Tất Cả', ko: '모두 내보내기' },
    importData: { en: 'Import Data', es: 'Importar Datos', tl: 'Mag-import ng Data', vi: 'Nhập Dữ Liệu', ko: '데이터 가져오기' },
    backupData: { en: 'Backup Data', es: 'Respaldar Datos', tl: 'Backup ang Data', vi: 'Sao Lưu Dữ Liệu', ko: '데이터 백업' },
    localBackup: { en: 'Local Backup', es: 'Respaldo Local', tl: 'Local Backup', vi: 'Sao Lưu Cục Bộ', ko: '로컬 백업' },
    restore: { en: 'Restore', es: 'Restaurar', tl: 'I-restore', vi: 'Khôi Phục', ko: '복원' },
    googleDrive: { en: 'Google Drive', es: 'Google Drive', tl: 'Google Drive', vi: 'Google Drive', ko: 'Google Drive' },
    analyzeStrategy: { en: 'Analyze Strategy', es: 'Analizar Estrategia', tl: 'Suriin ang Strategy', vi: 'Phân Tích Chiến Lược', ko: '전략 분석' },
    cloudBackupTip: { en: 'Use Google Drive for automatic cloud backup', es: 'Usa Google Drive para respaldo automático en la nube', tl: 'Gamitin ang Google Drive para sa automatic cloud backup', vi: 'Sử dụng Google Drive để sao lưu đám mây tự động', ko: '자동 클라우드 백업을 위해 Google Drive 사용' },
    statusDrafting: { en: 'Drafting', es: 'Redactando', tl: 'Drafting', vi: 'Đang Soạn Thảo', ko: '초안 작성 중' },
    statusStatementGenerated: { en: 'Statement Generated', es: 'Declaración Generada', tl: 'Nalikha na ang Statement', vi: 'Đã Tạo Báo Cáo', ko: '진술서 생성됨' },
    statusReview: { en: 'Review', es: 'Revisión', tl: 'Review', vi: 'Xem Xét', ko: '검토' },
    statusFiled: { en: 'Filed', es: 'Presentado', tl: 'Na-file', vi: 'Đã Nộp', ko: '제출됨' },
    statusPending: { en: 'Pending', es: 'Pendiente', tl: 'Pending', vi: 'Đang Chờ', ko: '대기 중' },
    statusApproved: { en: 'Approved', es: 'Aprobado', tl: 'Approved', vi: 'Được Chấp Thuận', ko: '승인됨' },
    statusDenied: { en: 'Denied', es: 'Denegado', tl: 'Denied', vi: 'Bị Từ Chối', ko: '거부됨' },
    viewStatement: { en: 'View Statement', es: 'Ver Declaración', tl: 'Tingnan ang Statement', vi: 'Xem Báo Cáo', ko: '진술서 보기' },
    buildStatement: { en: 'Build Statement', es: 'Crear Declaración', tl: 'Gumawa ng Statement', vi: 'Tạo Báo Cáo', ko: '진술서 작성' },
    downloadPDF: { en: 'Download PDF', es: 'Descargar PDF', tl: 'I-download ang PDF', vi: 'Tải PDF', ko: 'PDF 다운로드' },
    downloadWord: { en: 'Download Word', es: 'Descargar Word', tl: 'I-download ang Word', vi: 'Tải Word', ko: 'Word 다운로드' },
    downloadTxt: { en: 'Download .TXT', es: 'Descargar .TXT', tl: 'I-download ang .TXT', vi: 'Tải .TXT', ko: '.TXT 다운로드' },
    download: { en: 'Download', es: 'Descargar', tl: 'I-download', vi: 'Tải Xuống', ko: '다운로드' },
    textTxt: { en: 'Text (.txt)', es: 'Texto (.txt)', tl: 'Text (.txt)', vi: 'Văn bản (.txt)', ko: '텍스트 (.txt)' },
    wordDocx: { en: 'Word (.docx)', es: 'Word (.docx)', tl: 'Word (.docx)', vi: 'Word (.docx)', ko: 'Word (.docx)' },
    pdfPdf: { en: 'PDF (.pdf)', es: 'PDF (.pdf)', tl: 'PDF (.pdf)', vi: 'PDF (.pdf)', ko: 'PDF (.pdf)' },
    remove: { en: 'Remove', es: 'Eliminar', tl: 'Alisin', vi: 'Xóa', ko: '제거' },
    edit: { en: 'Edit', es: 'Editar', tl: 'I-edit', vi: 'Chỉnh Sửa', ko: '편집' },
    save: { en: 'Save', es: 'Guardar', tl: 'I-save', vi: 'Lưu', ko: '저장' },
    cancel: { en: 'Cancel', es: 'Cancelar', tl: 'Kanselahin', vi: 'Hủy', ko: '취소' },
    close: { en: 'Close', es: 'Cerrar', tl: 'Isara', vi: 'Đóng', ko: '닫기' },
    view: { en: 'View', es: 'Ver', tl: 'Tingnan', vi: 'Xem', ko: '보기' },
    clearAll: { en: 'Clear All', es: 'Borrar Todo', tl: 'Burahin Lahat', vi: 'Xóa Tất Cả', ko: '모두 지우기' },
    clearAllClaims: { en: 'Clear All Claims (Privacy Reset)', es: 'Borrar Todos los Reclamos (Reinicio de Privacidad)', tl: 'Burahin Lahat ng Claims (Privacy Reset)', vi: 'Xóa Tất Cả Yêu Cầu (Đặt Lại Quyền Riêng Tư)', ko: '모든 청구 지우기 (개인정보 재설정)' },
    total: { en: 'Total', es: 'Total', tl: 'Kabuuan', vi: 'Tổng', ko: '총계' },
    ready: { en: 'Ready', es: 'Listo', tl: 'Handa', vi: 'Sẵn Sàng', ko: '준비됨' },
    // Ratings tab
    ratingsSaved: { en: 'rating(s) saved', es: 'rating(s) guardado(s)', tl: 'rating(s) na naka-save', vi: 'xếp hạng đã lưu', ko: '저장된 등급' },
    importFromVaGov: { en: 'Import from VA.gov', es: 'Importar desde VA.gov', tl: 'Mag-import mula sa VA.gov', vi: 'Nhập từ VA.gov', ko: 'VA.gov에서 가져오기' },
    importRatingsDescription: { en: 'Import your VA ratings to save them here for use across all tools!', es: 'Importa tus ratings del VA para guardarlos aquí y usarlos en todas las herramientas!', tl: 'I-import ang iyong VA ratings para i-save dito para magamit sa lahat ng tools!', vi: 'Nhập xếp hạng VA của bạn để lưu ở đây để sử dụng trên tất cả các công cụ!', ko: 'VA 등급을 가져와서 모든 도구에서 사용할 수 있도록 저장하세요!' },
    effective: { en: 'Effective', es: 'Vigente', tl: 'Epektibo', vi: 'Có Hiệu Lực', ko: '유효' },
    conditionName: { en: 'Condition name', es: 'Nombre de condición', tl: 'Pangalan ng kondisyon', vi: 'Tên tình trạng', ko: '상태 이름' },
    // Profile tab
    veteranProfile: { en: 'Veteran Profile', es: 'Perfil del Veterano', tl: 'Profile ng Beterano', vi: 'Hồ Sơ Cựu Chiến Binh', ko: '재향군인 프로필' },
    profileDescription: { en: 'Save your information once, and it\'ll automatically fill VA forms throughout the app. All data stays on your device.', es: 'Guarda tu información una vez, y se completará automáticamente en los formularios del VA. Todos los datos permanecen en tu dispositivo.', tl: 'I-save ang iyong impormasyon isang beses, at awtomatikong pupunan ang mga VA forms sa buong app. Lahat ng data ay nananatili sa iyong device.', vi: 'Lưu thông tin của bạn một lần, và nó sẽ tự động điền vào các biểu mẫu VA trong toàn bộ ứng dụng. Tất cả dữ liệu được lưu trên thiết bị của bạn.', ko: '정보를 한 번 저장하면 앱 전체에서 VA 양식이 자동으로 채워집니다. 모든 데이터는 기기에 저장됩니다.' },
    privacyFirst: { en: 'Privacy First', es: 'Privacidad Primero', tl: 'Privacy Muna', vi: 'Quyền Riêng Tư Trước Tiên', ko: '개인정보 보호 우선' },
    privacyDetails: { en: 'All information is stored only on your device. Never sent to any server or database. Only you can see this data. Clear it anytime from The Bunker.', es: 'Toda la información se almacena solo en tu dispositivo. Nunca se envía a ningún servidor o base de datos. Solo tú puedes ver estos datos. Bórralo en cualquier momento desde El Búnker.', tl: 'Lahat ng impormasyon ay naka-store lamang sa iyong device. Hindi kailanman ipinapadala sa anumang server o database. Ikaw lang ang makakakita ng data na ito. I-clear ito anumang oras mula sa The Bunker.', vi: 'Tất cả thông tin chỉ được lưu trữ trên thiết bị của bạn. Không bao giờ gửi đến bất kỳ máy chủ hoặc cơ sở dữ liệu nào. Chỉ bạn có thể xem dữ liệu này. Xóa bất cứ lúc nào từ The Bunker.', ko: '모든 정보는 기기에만 저장됩니다. 서버나 데이터베이스로 전송되지 않습니다. 오직 당신만 이 데이터를 볼 수 있습니다. The Bunker에서 언제든지 삭제하세요.' },
    personalInformation: { en: 'Personal Information', es: 'Información Personal', tl: 'Personal na Impormasyon', vi: 'Thông Tin Cá Nhân', ko: '개인 정보' },
    contactInformation: { en: 'Contact Information', es: 'Información de Contacto', tl: 'Impormasyon ng Pakikipag-ugnay', vi: 'Thông Tin Liên Hệ', ko: '연락처 정보' },
    servicePeriods: { en: 'Service Periods', es: 'Períodos de Servicio', tl: 'Mga Panahon ng Serbisyo', vi: 'Thời Gian Phục Vụ', ko: '복무 기간' },
    servicePeriodsDescription: { en: 'Add all your service periods including Active Duty, Guard, and Reserve time. Each DD214 or NGB 22 is a separate period.', es: 'Agrega todos tus períodos de servicio incluyendo Servicio Activo, Guardia y Reserva. Cada DD214 o NGB 22 es un período separado.', tl: 'Idagdag ang lahat ng iyong mga panahon ng serbisyo kasama ang Active Duty, Guard, at Reserve time. Ang bawat DD214 o NGB 22 ay isang hiwalay na panahon.', vi: 'Thêm tất cả các giai đoạn phục vụ của bạn bao gồm Nghĩa vụ Chính quy, Vệ binh và Dự bị. Mỗi DD214 hoặc NGB 22 là một giai đoạn riêng biệt.', ko: '현역, 주방위군, 예비군 시간을 포함한 모든 복무 기간을 추가하세요. 각 DD214 또는 NGB 22는 별도의 기간입니다.' },
    addServicePeriod: { en: 'Add Service Period', es: 'Agregar Período de Servicio', tl: 'Magdagdag ng Panahon ng Serbisyo', vi: 'Thêm Thời Gian Phục Vụ', ko: '복무 기간 추가' },
    noServicePeriods: { en: 'No service periods added yet.', es: 'Aún no se han agregado períodos de servicio.', tl: 'Wala pang naidagdag na mga panahon ng serbisyo.', vi: 'Chưa có thời gian phục vụ nào được thêm.', ko: '아직 복무 기간이 추가되지 않았습니다.' },
    clickToAddServicePeriod: { en: 'Click "Add Service Period" to add your military service history.', es: 'Haz clic en "Agregar Período de Servicio" para agregar tu historial de servicio militar.', tl: 'I-click ang "Add Service Period" para idagdag ang iyong military service history.', vi: 'Nhấp vào "Thêm Thời Gian Phục Vụ" để thêm lịch sử phục vụ quân đội của bạn.', ko: '"복무 기간 추가"를 클릭하여 군 복무 이력을 추가하세요.' },
    period: { en: 'Period', es: 'Período', tl: 'Panahon', vi: 'Giai Đoạn', ko: '기간' },
    branch: { en: 'Branch', es: 'Rama', tl: 'Sangay', vi: 'Quân Chủng', ko: '군종' },
    component: { en: 'Component', es: 'Componente', tl: 'Sangkap', vi: 'Thành Phần', ko: '구성 요소' },
    activeDuty: { en: 'Active Duty', es: 'Servicio Activo', tl: 'Active Duty', vi: 'Nghĩa Vụ Chính Quy', ko: '현역' },
    nationalGuard: { en: 'National Guard', es: 'Guardia Nacional', tl: 'National Guard', vi: 'Vệ Binh Quốc Gia', ko: '주방위군' },
    reserve: { en: 'Reserve', es: 'Reserva', tl: 'Reserve', vi: 'Dự Bị', ko: '예비군' },
    startDate: { en: 'Start Date', es: 'Fecha de Inicio', tl: 'Petsa ng Simula', vi: 'Ngày Bắt Đầu', ko: '시작일' },
    endDate: { en: 'End Date', es: 'Fecha de Fin', tl: 'Petsa ng Wakas', vi: 'Ngày Kết Thúc', ko: '종료일' },
    dischargeType: { en: 'Discharge Type', es: 'Tipo de Baja', tl: 'Uri ng Discharge', vi: 'Loại Giải Ngũ', ko: '제대 유형' },
    honorable: { en: 'Honorable', es: 'Honorable', tl: 'Honorable', vi: 'Danh Dự', ko: '명예' },
    generalUnderHonorable: { en: 'General Under Honorable', es: 'General Bajo Honorable', tl: 'General Under Honorable', vi: 'Tổng Quát Dưới Danh Dự', ko: '명예 하 일반' },
    otherThanHonorable: { en: 'Other Than Honorable', es: 'Otra que no sea Honorable', tl: 'Other Than Honorable', vi: 'Ngoài Danh Dự', ko: '명예 이외' },
    medical: { en: 'Medical', es: 'Médico', tl: 'Medical', vi: 'Y Tế', ko: '의료' },
    formType: { en: 'Form Type', es: 'Tipo de Formulario', tl: 'Uri ng Form', vi: 'Loại Biểu Mẫu', ko: '양식 유형' },
    mosRank: { en: 'MOS / Rank (optional)', es: 'MOS / Rango (opcional)', tl: 'MOS / Rank (opsyonal)', vi: 'MOS / Cấp Bậc (tùy chọn)', ko: 'MOS / 계급 (선택)' },
    mosRankPlaceholder: { en: 'E.g., 11B Infantry, E-5 Sergeant', es: 'Ej., 11B Infantería, E-5 Sargento', tl: 'Hal., 11B Infantry, E-5 Sergeant', vi: 'Ví dụ, 11B Bộ binh, E-5 Trung sĩ', ko: '예: 11B 보병, E-5 병장' },
    notesOptional: { en: 'Notes (optional)', es: 'Notas (opcional)', tl: 'Mga Tala (opsyonal)', vi: 'Ghi Chú (tùy chọn)', ko: '메모 (선택)' },
    notesPlaceholder: { en: 'E.g., Deployed to Iraq 2008-2009', es: 'Ej., Desplegado en Irak 2008-2009', tl: 'Hal., Deployed sa Iraq 2008-2009', vi: 'Ví dụ, Triển khai đến Iraq 2008-2009', ko: '예: 이라크 파병 2008-2009' },
    saveProfile: { en: 'Save Profile', es: 'Guardar Perfil', tl: 'I-save ang Profile', vi: 'Lưu Hồ Sơ', ko: '프로필 저장' },
    profileSaved: { en: 'Veteran Profile saved! This information will now auto-fill VA forms.', es: '¡Perfil del Veterano guardado! Esta información ahora completará automáticamente los formularios del VA.', tl: 'Na-save ang Veteran Profile! Ang impormasyong ito ay awtomatikong pupunan ang mga VA forms.', vi: 'Hồ sơ Cựu Chiến Binh đã lưu! Thông tin này sẽ tự động điền vào các biểu mẫu VA.', ko: '재향군인 프로필이 저장되었습니다! 이 정보가 이제 VA 양식을 자동으로 채웁니다.' },
    firstName: { en: 'First Name', es: 'Nombre', tl: 'Unang Pangalan', vi: 'Tên', ko: '이름' },
    lastName: { en: 'Last Name', es: 'Apellido', tl: 'Apelyido', vi: 'Họ', ko: '성' },
    middleInitial: { en: 'Middle Initial', es: 'Inicial del Segundo Nombre', tl: 'Gitnang Inisyal', vi: 'Tên Đệm', ko: '중간 이름 이니셜' },
    dateOfBirth: { en: 'Date of Birth', es: 'Fecha de Nacimiento', tl: 'Petsa ng Kapanganakan', vi: 'Ngày Sinh', ko: '생년월일' },
    ssnLast4: { en: 'SSN (Last 4 Digits)', es: 'SSN (Últimos 4 Dígitos)', tl: 'SSN (Huling 4 na Digit)', vi: 'SSN (4 Số Cuối)', ko: 'SSN (마지막 4자리)' },
    vaFileNumber: { en: 'VA File Number', es: 'Número de Archivo VA', tl: 'VA File Number', vi: 'Số Hồ Sơ VA', ko: 'VA 파일 번호' },
    email: { en: 'Email', es: 'Correo Electrónico', tl: 'Email', vi: 'Email', ko: '이메일' },
    phone: { en: 'Phone', es: 'Teléfono', tl: 'Telepono', vi: 'Điện Thoại', ko: '전화' },
    alternatePhone: { en: 'Alternate Phone', es: 'Teléfono Alternativo', tl: 'Alternatibong Telepono', vi: 'Điện Thoại Phụ', ko: '대체 전화' },
    streetAddress: { en: 'Street Address', es: 'Dirección', tl: 'Street Address', vi: 'Địa Chỉ Đường', ko: '도로 주소' },
    city: { en: 'City', es: 'Ciudad', tl: 'Lungsod', vi: 'Thành Phố', ko: '도시' },
    state: { en: 'State', es: 'Estado', tl: 'Estado', vi: 'Tiểu Bang', ko: '주' },
    zipCode: { en: 'ZIP Code', es: 'Código Postal', tl: 'ZIP Code', vi: 'Mã Bưu Chính', ko: '우편번호' },
    select: { en: 'Select...', es: 'Seleccionar...', tl: 'Pumili...', vi: 'Chọn...', ko: '선택...' },
    // Forms tab
    formsDescription: { en: 'Use the Forms Helper to create and save VA forms like buddy statements, personal statements, and more!', es: 'Usa el Asistente de Formularios para crear y guardar formularios del VA como declaraciones de compañeros, declaraciones personales y más!', tl: 'Gamitin ang Forms Helper para gumawa at mag-save ng VA forms tulad ng buddy statements, personal statements, at iba pa!', vi: 'Sử dụng Trợ giúp Biểu mẫu để tạo và lưu các biểu mẫu VA như tuyên bố của đồng đội, tuyên bố cá nhân và hơn thế nữa!', ko: 'Forms Helper를 사용하여 동료 진술서, 개인 진술서 등의 VA 양식을 작성하고 저장하세요!' },
    saved: { en: 'Saved', es: 'Guardado', tl: 'Naka-save', vi: 'Đã Lưu', ko: '저장됨' },
    updated: { en: 'Updated', es: 'Actualizado', tl: 'Na-update', vi: 'Đã Cập Nhật', ko: '업데이트됨' },
    // Service History tab
    dd214Information: { en: 'DD214 Information', es: 'Información del DD214', tl: 'Impormasyon ng DD214', vi: 'Thông Tin DD214', ko: 'DD214 정보' },
    aiReady: { en: 'AI Ready', es: 'IA Lista', tl: 'AI Ready', vi: 'AI Sẵn Sàng', ko: 'AI 준비됨' },
    pasteText: { en: 'Paste Text', es: 'Pegar Texto', tl: 'I-paste ang Text', vi: 'Dán Văn Bản', ko: '텍스트 붙여넣기' },
    fullAnalyzerComingSoon: { en: 'Full Analyzer (Coming Soon)', es: 'Analizador Completo (Próximamente)', tl: 'Full Analyzer (Paparating Na)', vi: 'Trình Phân Tích Đầy Đủ (Sắp Ra Mắt)', ko: '전체 분석기 (곧 출시)' },
    dragDropDD214: { en: 'Drag & Drop DD214 PDF', es: 'Arrastra y Suelta DD214 PDF', tl: 'I-drag at I-drop ang DD214 PDF', vi: 'Kéo & Thả DD214 PDF', ko: 'DD214 PDF 드래그 앤 드롭' },
    dropDD214Here: { en: 'Drop your DD214 here!', es: '¡Suelta tu DD214 aquí!', tl: 'I-drop ang iyong DD214 dito!', vi: 'Thả DD214 của bạn ở đây!', ko: 'DD214를 여기에 놓으세요!' },
    orClickToBrowse: { en: 'or click to browse • Opens in DD214 Analyzer with full OCR support', es: 'o haz clic para navegar • Se abre en el Analizador DD214 con soporte OCR completo', tl: 'o i-click para mag-browse • Magbubukas sa DD214 Analyzer na may full OCR support', vi: 'hoặc nhấp để duyệt • Mở trong Trình phân tích DD214 với hỗ trợ OCR đầy đủ', ko: '또는 클릭하여 찾아보기 • 전체 OCR 지원으로 DD214 분석기에서 열기' },
    dd214PrivacyNote: { en: 'Your DD214 stays 100% private - processed locally on your device', es: 'Tu DD214 permanece 100% privado - procesado localmente en tu dispositivo', tl: 'Ang iyong DD214 ay nananatiling 100% pribado - pinoproseso locally sa iyong device', vi: 'DD214 của bạn vẫn 100% riêng tư - được xử lý cục bộ trên thiết bị của bạn', ko: 'DD214는 100% 비공개로 유지됩니다 - 기기에서 로컬로 처리됩니다' },
    pasteDD214Instructions: { en: 'Paste the text from your DD214 below. AI will extract key information automatically.', es: 'Pega el texto de tu DD214 abajo. La IA extraerá la información clave automáticamente.', tl: 'I-paste ang text mula sa iyong DD214 sa ibaba. Awtomatikong i-e-extract ng AI ang pangunahing impormasyon.', vi: 'Dán văn bản từ DD214 của bạn bên dưới. AI sẽ tự động trích xuất thông tin chính.', ko: '아래에 DD214의 텍스트를 붙여넣으세요. AI가 주요 정보를 자동으로 추출합니다.' },
    dd214SensitiveWarning: { en: 'Your DD214 contains sensitive information - data stays on your device only.', es: 'Tu DD214 contiene información sensible - los datos permanecen solo en tu dispositivo.', tl: 'Ang iyong DD214 ay naglalaman ng sensitibong impormasyon - ang data ay nananatili lamang sa iyong device.', vi: 'DD214 của bạn chứa thông tin nhạy cảm - dữ liệu chỉ được lưu trên thiết bị của bạn.', ko: 'DD214에는 민감한 정보가 포함되어 있습니다 - 데이터는 기기에만 저장됩니다.' },
    pasteDD214Placeholder: { en: 'Paste your DD214 text here (copy from PDF or scanned document)...', es: 'Pega el texto de tu DD214 aquí (copia del PDF o documento escaneado)...', tl: 'I-paste ang iyong DD214 text dito (kopyahin mula sa PDF o scanned document)...', vi: 'Dán văn bản DD214 của bạn ở đây (sao chép từ PDF hoặc tài liệu đã quét)...', ko: 'DD214 텍스트를 여기에 붙여넣으세요 (PDF 또는 스캔한 문서에서 복사)...' },
    extractWithAI: { en: 'Extract with AI', es: 'Extraer con IA', tl: 'I-extract gamit ang AI', vi: 'Trích Xuất Bằng AI', ko: 'AI로 추출' },
    processing: { en: 'Processing...', es: 'Procesando...', tl: 'Pinoproseso...', vi: 'Đang Xử Lý...', ko: '처리 중...' },
    aiSettings: { en: 'AI Settings', es: 'Configuración de IA', tl: 'AI Settings', vi: 'Cài Đặt AI', ko: 'AI 설정' },
    configureAIWarning: { en: 'Configure AI in settings to enable automatic extraction', es: 'Configura la IA en configuración para habilitar la extracción automática', tl: 'I-configure ang AI sa settings para i-enable ang automatic extraction', vi: 'Cấu hình AI trong cài đặt để bật trích xuất tự động', ko: '자동 추출을 활성화하려면 설정에서 AI를 구성하세요' },
    mos: { en: 'MOS', es: 'MOS', tl: 'MOS', vi: 'MOS', ko: 'MOS' },
    mosTitle: { en: 'MOS Title', es: 'Título MOS', tl: 'MOS Title', vi: 'Chức Danh MOS', ko: 'MOS 직책' },
    entryDate: { en: 'Entry Date', es: 'Fecha de Ingreso', tl: 'Petsa ng Pagpasok', vi: 'Ngày Nhập Ngũ', ko: '입대일' },
    separationDate: { en: 'Separation Date', es: 'Fecha de Separación', tl: 'Petsa ng Paghihiwalay', vi: 'Ngày Giải Ngũ', ko: '제대일' },
    timeInService: { en: 'Time in Service', es: 'Tiempo en Servicio', tl: 'Oras sa Serbisyo', vi: 'Thời Gian Phục Vụ', ko: '복무 기간' },
    characterOfService: { en: 'Character of Service', es: 'Carácter del Servicio', tl: 'Character ng Serbisyo', vi: 'Đặc Điểm Phục Vụ', ko: '복무 특성' },
    foreignService: { en: 'Foreign Service', es: 'Servicio Extranjero', tl: 'Foreign Service', vi: 'Phục Vụ Nước Ngoài', ko: '해외 복무' },
    yes: { en: 'Yes', es: 'Sí', tl: 'Oo', vi: 'Có', ko: '예' },
    no: { en: 'No', es: 'No', tl: 'Hindi', vi: 'Không', ko: '아니오' },
    na: { en: 'N/A', es: 'N/A', tl: 'N/A', vi: 'N/A', ko: 'N/A' },
    reprocessDD214: { en: 'Re-process DD214', es: 'Reprocesar DD214', tl: 'I-re-process ang DD214', vi: 'Xử Lý Lại DD214', ko: 'DD214 재처리' },
    clearDD214Data: { en: 'Clear DD214 Data', es: 'Borrar Datos del DD214', tl: 'I-clear ang DD214 Data', vi: 'Xóa Dữ Liệu DD214', ko: 'DD214 데이터 지우기' },
    // Deployments
    deployments: { en: 'Deployments', es: 'Despliegues', tl: 'Mga Deployment', vi: 'Triển Khai', ko: '파병' },
    addDeployment: { en: 'Add Deployment', es: 'Agregar Despliegue', tl: 'Magdagdag ng Deployment', vi: 'Thêm Triển Khai', ko: '파병 추가' },
    theaterOperation: { en: 'Theater/Operation', es: 'Teatro/Operación', tl: 'Theater/Operation', vi: 'Chiến Trường/Chiến Dịch', ko: '작전 지역/작전' },
    location: { en: 'Location', es: 'Ubicación', tl: 'Lokasyon', vi: 'Địa Điểm', ko: '위치' },
    unit: { en: 'Unit', es: 'Unidad', tl: 'Unit', vi: 'Đơn Vị', ko: '부대' },
    combatZone: { en: 'Combat Zone', es: 'Zona de Combate', tl: 'Combat Zone', vi: 'Vùng Chiến Sự', ko: '전투 지역' },
    combat: { en: 'Combat', es: 'Combate', tl: 'Combat', vi: 'Chiến Đấu', ko: '전투' },
    hazardousDuty: { en: 'Hazardous Duty', es: 'Servicio Peligroso', tl: 'Hazardous Duty', vi: 'Nhiệm Vụ Nguy Hiểm', ko: '위험 임무' },
    hazardous: { en: 'Hazardous', es: 'Peligroso', tl: 'Delikado', vi: 'Nguy Hiểm', ko: '위험' },
    saveDeployment: { en: 'Save Deployment', es: 'Guardar Despliegue', tl: 'I-save ang Deployment', vi: 'Lưu Triển Khai', ko: '파병 저장' },
    noDeploymentsYet: { en: 'No deployments added yet. Add your deployments for PACT Act eligibility and exposure tracking.', es: 'Aún no se han agregado despliegues. Agrega tus despliegues para elegibilidad de la Ley PACT y seguimiento de exposición.', tl: 'Wala pang naidagdag na deployments. Idagdag ang iyong mga deployment para sa PACT Act eligibility at exposure tracking.', vi: 'Chưa có triển khai nào được thêm. Thêm các triển khai của bạn để đủ điều kiện theo Đạo luật PACT và theo dõi phơi nhiễm.', ko: '아직 파병이 추가되지 않았습니다. PACT 법 자격 및 노출 추적을 위해 파병을 추가하세요.' },
    present: { en: 'Present', es: 'Presente', tl: 'Kasalukuyan', vi: 'Hiện Tại', ko: '현재' },
    // Awards
    awardsDecorations: { en: 'Awards & Decorations', es: 'Premios y Condecoraciones', tl: 'Mga Award at Dekorasyon', vi: 'Giải Thưởng & Huân Chương', ko: '훈장 및 포상' },
    addAward: { en: 'Add Award', es: 'Agregar Premio', tl: 'Magdagdag ng Award', vi: 'Thêm Giải Thưởng', ko: '훈장 추가' },
    awardName: { en: 'Award Name', es: 'Nombre del Premio', tl: 'Pangalan ng Award', vi: 'Tên Giải Thưởng', ko: '훈장 이름' },
    abbreviation: { en: 'Abbreviation', es: 'Abreviatura', tl: 'Abbreviation', vi: 'Viết Tắt', ko: '약어' },
    dateReceived: { en: 'Date Received', es: 'Fecha de Recepción', tl: 'Petsa ng Pagtanggap', vi: 'Ngày Nhận', ko: '수여일' },
    combatRelatedAward: { en: 'Combat-Related Award', es: 'Premio Relacionado con Combate', tl: 'Combat-Related Award', vi: 'Giải Thưởng Liên Quan Đến Chiến Đấu', ko: '전투 관련 훈장' },
    saveAward: { en: 'Save Award', es: 'Guardar Premio', tl: 'I-save ang Award', vi: 'Lưu Giải Thưởng', ko: '훈장 저장' },
    noAwardsYet: { en: 'No awards added yet. Add your awards and decorations for documentation purposes.', es: 'Aún no se han agregado premios. Agrega tus premios y condecoraciones para fines de documentación.', tl: 'Wala pang naidagdag na mga award. Idagdag ang iyong mga award at dekorasyon para sa documentation purposes.', vi: 'Chưa có giải thưởng nào được thêm. Thêm giải thưởng và huân chương của bạn cho mục đích tài liệu.', ko: '아직 훈장이 추가되지 않았습니다. 문서화를 위해 훈장과 포상을 추가하세요.' },
    serviceHistoryInfo: { en: 'Your service history, deployments, and awards can be used by the PACT Act Navigator to determine toxic exposure eligibility, and by other tools for auto-filling forms and strengthening your claims.', es: 'Tu historial de servicio, despliegues y premios pueden ser utilizados por el Navegador de la Ley PACT para determinar la elegibilidad por exposición tóxica, y por otras herramientas para completar formularios automáticamente y fortalecer tus reclamos.', tl: 'Ang iyong service history, deployments, at awards ay maaaring gamitin ng PACT Act Navigator para matukoy ang toxic exposure eligibility, at ng ibang tools para sa auto-filling forms at pagpapalakas ng iyong mga claim.', vi: 'Lịch sử phục vụ, triển khai và giải thưởng của bạn có thể được sử dụng bởi PACT Act Navigator để xác định đủ điều kiện phơi nhiễm độc hại, và bởi các công cụ khác để tự động điền biểu mẫu và tăng cường yêu cầu của bạn.', ko: '복무 이력, 파병 및 훈장은 PACT 법 내비게이터에서 독성 노출 자격을 결정하고 다른 도구에서 양식을 자동 작성하고 청구를 강화하는 데 사용될 수 있습니다.' },
    whyTrackThis: { en: 'Why track this?', es: '¿Por qué rastrear esto?', tl: 'Bakit i-track ito?', vi: 'Tại sao theo dõi điều này?', ko: '왜 이것을 추적하나요?' },
    // Claims tab
    startExploringSecondaryScout: { en: 'Start by exploring the Secondary Scout to find potential claims', es: 'Comienza explorando el Explorador Secundario para encontrar posibles reclamos', tl: 'Magsimula sa pag-explore ng Secondary Scout para mahanap ang mga potensyal na claim', vi: 'Bắt đầu bằng cách khám phá Secondary Scout để tìm các yêu cầu tiềm năng', ko: '잠재적 청구를 찾으려면 Secondary Scout 탐색으로 시작하세요' },
    exploreSecondaryScout: { en: 'Explore Secondary Scout', es: 'Explorar Explorador Secundario', tl: 'I-explore ang Secondary Scout', vi: 'Khám Phá Secondary Scout', ko: 'Secondary Scout 탐색' },
    secondaryTo: { en: 'Secondary to', es: 'Secundario a', tl: 'Sekundaryong sa', vi: 'Thứ cấp cho', ko: '~에 대한 2차' },
    // Timeline tab
    eventsTracked: { en: 'event(s) tracked', es: 'evento(s) rastreado(s)', tl: 'event(s) na nasubaybayan', vi: 'sự kiện được theo dõi', ko: '추적된 이벤트' },
    timelineDescription: { en: 'Use the Continuity Thread tool to map your evidence timeline and track treatment gaps. Events you save there will appear here.', es: 'Usa la herramienta Hilo de Continuidad para mapear tu línea de tiempo de evidencia y rastrear brechas de tratamiento. Los eventos que guardes allí aparecerán aquí.', tl: 'Gamitin ang Continuity Thread tool para i-map ang iyong evidence timeline at i-track ang mga treatment gaps. Ang mga event na i-save mo doon ay lalabas dito.', vi: 'Sử dụng công cụ Continuity Thread để lập bản đồ dòng thời gian bằng chứng của bạn và theo dõi các khoảng trống điều trị. Các sự kiện bạn lưu ở đó sẽ xuất hiện ở đây.', ko: 'Continuity Thread 도구를 사용하여 증거 타임라인을 매핑하고 치료 공백을 추적하세요. 저장한 이벤트가 여기에 표시됩니다.' },
    goToContinuityThread: { en: 'Go to Continuity Thread', es: 'Ir a Hilo de Continuidad', tl: 'Pumunta sa Continuity Thread', vi: 'Đi Đến Continuity Thread', ko: 'Continuity Thread로 이동' },
    treatment: { en: 'Treatment', es: 'Tratamiento', tl: 'Paggamot', vi: 'Điều Trị', ko: '치료' },
    diagnosis: { en: 'Diagnosis', es: 'Diagnóstico', tl: 'Diagnosis', vi: 'Chẩn Đoán', ko: '진단' },
    military: { en: 'Military', es: 'Militar', tl: 'Militar', vi: 'Quân Sự', ko: '군사' },
    symptom: { en: 'Symptom', es: 'Síntoma', tl: 'Sintomas', vi: 'Triệu Chứng', ko: '증상' },
    hospitalization: { en: 'Hospitalization', es: 'Hospitalización', tl: 'Pagpapaospital', vi: 'Nhập Viện', ko: '입원' },
    event: { en: 'Event', es: 'Evento', tl: 'Event', vi: 'Sự Kiện', ko: '이벤트' },
    relatedTo: { en: 'Related to', es: 'Relacionado con', tl: 'Kaugnay sa', vi: 'Liên Quan Đến', ko: '관련' },
    removeEvent: { en: 'Remove event', es: 'Eliminar evento', tl: 'Alisin ang event', vi: 'Xóa sự kiện', ko: '이벤트 제거' },
    timelineInfo: { en: 'A continuous timeline of treatment and symptoms helps establish service connection and proves your condition has persisted since service. Use Continuity Thread to identify gaps in your evidence.', es: 'Una línea de tiempo continua de tratamiento y síntomas ayuda a establecer la conexión con el servicio y demuestra que tu condición ha persistido desde el servicio. Usa el Hilo de Continuidad para identificar brechas en tu evidencia.', tl: 'Ang tuloy-tuloy na timeline ng paggamot at mga sintomas ay tumutulong na maitaguyod ang service connection at pinatutunayan na ang iyong kondisyon ay nagpatuloy mula noong serbisyo. Gamitin ang Continuity Thread para tukuyin ang mga gaps sa iyong ebidensya.', vi: 'Dòng thời gian liên tục của điều trị và triệu chứng giúp thiết lập kết nối dịch vụ và chứng minh tình trạng của bạn đã tồn tại kể từ khi phục vụ. Sử dụng Continuity Thread để xác định các khoảng trống trong bằng chứng của bạn.', ko: '치료 및 증상의 지속적인 타임라인은 복무 연결을 확립하고 복무 이후 상태가 지속되었음을 증명하는 데 도움이 됩니다. Continuity Thread를 사용하여 증거의 공백을 확인하세요.' },
    // Pain Maps tab
    painMapsDescription: { en: 'Use the Pain Painter tool to visually document your pain locations and generate condition-specific nexus language. Maps you save there will appear here.', es: 'Usa la herramienta Pain Painter para documentar visualmente tus ubicaciones de dolor y generar lenguaje de nexo específico de la condición. Los mapas que guardes allí aparecerán aquí.', tl: 'Gamitin ang Pain Painter tool para biswal na i-document ang iyong mga lokasyon ng sakit at lumikha ng condition-specific nexus language. Ang mga map na i-save mo doon ay lalabas dito.', vi: 'Sử dụng công cụ Pain Painter để ghi lại trực quan vị trí đau của bạn và tạo ngôn ngữ nexus cụ thể cho tình trạng. Các bản đồ bạn lưu ở đó sẽ xuất hiện ở đây.', ko: 'Pain Painter 도구를 사용하여 통증 위치를 시각적으로 문서화하고 상태별 nexus 언어를 생성하세요. 저장한 지도가 여기에 표시됩니다.' },
    goToPainPainter: { en: 'Go to Pain Painter', es: 'Ir a Pain Painter', tl: 'Pumunta sa Pain Painter', vi: 'Đi Đến Pain Painter', ko: 'Pain Painter로 이동' },
    painMapsSaved: { en: 'pain map(s) saved', es: 'mapa(s) de dolor guardado(s)', tl: 'pain map(s) na naka-save', vi: 'bản đồ đau đã lưu', ko: '저장된 통증 지도' },
    painPoints: { en: 'pain points', es: 'puntos de dolor', tl: 'mga pain points', vi: 'điểm đau', ko: '통증 지점' },
    viewDetails: { en: 'View Details', es: 'Ver Detalles', tl: 'Tingnan ang Detalye', vi: 'Xem Chi Tiết', ko: '상세 보기' },
    delete: { en: 'Delete', es: 'Eliminar', tl: 'I-delete', vi: 'Xóa', ko: '삭제' },
    deleteMap: { en: 'Delete Map', es: 'Eliminar Mapa', tl: 'I-delete ang Map', vi: 'Xóa Bản Đồ', ko: '지도 삭제' },
    painMapDetails: { en: 'Pain Map Details', es: 'Detalles del Mapa de Dolor', tl: 'Mga Detalye ng Pain Map', vi: 'Chi Tiết Bản Đồ Đau', ko: '통증 지도 상세' },
    painPointsList: { en: 'Pain Points', es: 'Puntos de Dolor', tl: 'Mga Pain Points', vi: 'Các Điểm Đau', ko: '통증 지점' },
    noPainPointsRecorded: { en: 'No pain points recorded', es: 'No se registraron puntos de dolor', tl: 'Walang na-record na pain points', vi: 'Không có điểm đau nào được ghi nhận', ko: '기록된 통증 지점 없음' },
    nexusLanguage: { en: 'Nexus Language', es: 'Lenguaje de Nexo', tl: 'Nexus Language', vi: 'Ngôn Ngữ Nexus', ko: 'Nexus 언어' },
    type: { en: 'Type', es: 'Tipo', tl: 'Uri', vi: 'Loại', ko: '유형' },
    severity: { en: 'Severity', es: 'Severidad', tl: 'Kalubhaan', vi: 'Mức Độ Nghiêm Trọng', ko: '심각도' },
    severe: { en: 'Severe', es: 'Severo', tl: 'Malubha', vi: 'Nghiêm Trọng', ko: '심각' },
    moderate: { en: 'Moderate', es: 'Moderado', tl: 'Katamtaman', vi: 'Trung Bình', ko: '보통' },
    mild: { en: 'Mild', es: 'Leve', tl: 'Banayad', vi: 'Nhẹ', ko: '경미' },
    noPreviewAvailable: { en: 'No preview available', es: 'Vista previa no disponible', tl: 'Walang available na preview', vi: 'Không có bản xem trước', ko: '미리보기 없음' },
    painMapsInfo: { en: 'Pain maps help visualize your symptoms for C&P exams and provide specific location data that supports accurate diagnostic coding. Each map generates nexus language you can use in your claims.', es: 'Los mapas de dolor ayudan a visualizar tus síntomas para exámenes C&P y proporcionan datos de ubicación específicos que respaldan la codificación diagnóstica precisa. Cada mapa genera lenguaje de nexo que puedes usar en tus reclamos.', tl: 'Ang mga pain map ay tumutulong na i-visualize ang iyong mga sintomas para sa C&P exams at nagbibigay ng specific location data na sumusuporta sa accurate diagnostic coding. Ang bawat map ay gumagawa ng nexus language na maaari mong gamitin sa iyong mga claim.', vi: 'Bản đồ đau giúp hình dung triệu chứng của bạn cho các cuộc khám C&P và cung cấp dữ liệu vị trí cụ thể hỗ trợ mã hóa chẩn đoán chính xác. Mỗi bản đồ tạo ra ngôn ngữ nexus mà bạn có thể sử dụng trong yêu cầu của mình.', ko: '통증 지도는 C&P 검사를 위해 증상을 시각화하고 정확한 진단 코딩을 지원하는 특정 위치 데이터를 제공합니다. 각 지도는 청구에 사용할 수 있는 nexus 언어를 생성합니다.' },
    // Statement viewer
    generatedStatement: { en: 'Generated Statement', es: 'Declaración Generada', tl: 'Nabuong Statement', vi: 'Báo Cáo Đã Tạo', ko: '생성된 진술서' },
    editStatement: { en: 'Edit Statement', es: 'Editar Declaración', tl: 'I-edit ang Statement', vi: 'Chỉnh Sửa Báo Cáo', ko: '진술서 편집' },
    statementInSupportOfClaim: { en: 'Statement in Support of Claim', es: 'Declaración en Apoyo del Reclamo', tl: 'Statement sa Suporta ng Claim', vi: 'Báo Cáo Hỗ Trợ Yêu Cầu', ko: '청구 지원 진술서' },
    doctorsCheatSheet: { en: "Doctor's Cheat Sheet", es: 'Guía del Doctor', tl: "Doctor's Cheat Sheet", vi: 'Bảng Hướng Dẫn Bác Sĩ', ko: '의사용 요약 시트' },
    // Import confirmation
    confirmImport: { en: 'Confirm Import', es: 'Confirmar Importación', tl: 'Kumpirmahin ang Import', vi: 'Xác Nhận Nhập', ko: '가져오기 확인' },
    backupDetails: { en: 'Backup Details', es: 'Detalles del Respaldo', tl: 'Mga Detalye ng Backup', vi: 'Chi Tiết Sao Lưu', ko: '백업 세부 정보' },
    claimsFound: { en: 'claims found', es: 'reclamos encontrados', tl: 'claims na nahanap', vi: 'yêu cầu tìm thấy', ko: '청구 발견' },
    statementsFound: { en: 'statements found', es: 'declaraciones encontradas', tl: 'statements na nahanap', vi: 'báo cáo tìm thấy', ko: '진술서 발견' },
    backupDate: { en: 'Backup date', es: 'Fecha del respaldo', tl: 'Petsa ng backup', vi: 'Ngày sao lưu', ko: '백업 날짜' },
    howToImport: { en: 'How would you like to import this backup?', es: '¿Cómo te gustaría importar este respaldo?', tl: 'Paano mo gustong i-import ang backup na ito?', vi: 'Bạn muốn nhập bản sao lưu này như thế nào?', ko: '이 백업을 어떻게 가져오시겠습니까?' },
    replaceAll: { en: 'Replace All (Fresh Start)', es: 'Reemplazar Todo (Nuevo Comienzo)', tl: 'Palitan Lahat (Fresh Start)', vi: 'Thay Thế Tất Cả (Bắt Đầu Lại)', ko: '모두 교체 (새로 시작)' },
    mergeAddNew: { en: 'Merge (Add New Only)', es: 'Combinar (Solo Agregar Nuevos)', tl: 'Pagsamahin (Magdagdag ng Bago Lamang)', vi: 'Hợp Nhất (Chỉ Thêm Mới)', ko: '병합 (새 항목만 추가)' },
    replaceAllWarning: { en: '"Replace All" will remove your current claims first', es: '"Reemplazar Todo" eliminará primero tus reclamos actuales', tl: 'Ang "Replace All" ay aalisin muna ang iyong kasalukuyang mga claim', vi: '"Thay Thế Tất Cả" sẽ xóa các yêu cầu hiện tại của bạn trước', ko: '"모두 교체"는 먼저 현재 청구를 제거합니다' },
    // Additional missing keys
    claimsDescription: { en: 'Start by exploring the Secondary Scout to find potential claims', es: 'Comienza explorando el Explorador Secundario para encontrar posibles reclamos', tl: 'Magsimula sa pag-explore ng Secondary Scout para mahanap ang mga potensyal na claim', vi: 'Bắt đầu bằng cách khám phá Secondary Scout để tìm các yêu cầu tiềm năng', ko: '잠재적 청구를 찾으려면 Secondary Scout 탐색으로 시작하세요' },
    or: { en: 'or', es: 'o', tl: 'o', vi: 'hoặc', ko: '또는' },
    dd214UseButtonsAbove: { en: 'Use the buttons above to paste text manually or open the full DD214 Analyzer for advanced processing.', es: 'Usa los botones de arriba para pegar texto manualmente o abrir el Analizador DD214 completo para procesamiento avanzado.', tl: 'Gamitin ang mga button sa itaas para mag-paste ng text manually o buksan ang full DD214 Analyzer para sa advanced processing.', vi: 'Sử dụng các nút ở trên để dán văn bản thủ công hoặc mở Trình phân tích DD214 đầy đủ để xử lý nâng cao.', ko: '위의 버튼을 사용하여 수동으로 텍스트를 붙여넣거나 고급 처리를 위해 전체 DD214 분석기를 여세요.' },
    dd214PasteInstructions: { en: 'Paste the text from your DD214 below. AI will extract key information automatically.', es: 'Pega el texto de tu DD214 abajo. La IA extraerá la información clave automáticamente.', tl: 'I-paste ang text mula sa iyong DD214 sa ibaba. Awtomatikong i-e-extract ng AI ang pangunahing impormasyon.', vi: 'Dán văn bản từ DD214 của bạn bên dưới. AI sẽ tự động trích xuất thông tin chính.', ko: '아래에 DD214의 텍스트를 붙여넣으세요. AI가 주요 정보를 자동으로 추출합니다.' },
    dd214TextareaPlaceholder: { en: 'Paste your DD214 text here (copy from PDF or scanned document)...', es: 'Pega el texto de tu DD214 aquí (copia del PDF o documento escaneado)...', tl: 'I-paste ang iyong DD214 text dito (kopyahin mula sa PDF o scanned document)...', vi: 'Dán văn bản DD214 của bạn ở đây (sao chép từ PDF hoặc tài liệu đã quét)...', ko: 'DD214 텍스트를 여기에 붙여넣으세요 (PDF 또는 스캔한 문서에서 복사)...' },
    selectEllipsis: { en: 'Select...', es: 'Seleccionar...', tl: 'Pumili...', vi: 'Chọn...', ko: '선택...' },
    locationPlaceholder: { en: 'e.g., Baghdad, Iraq', es: 'ej., Bagdad, Irak', tl: 'hal., Baghdad, Iraq', vi: 'ví dụ, Baghdad, Iraq', ko: '예: 바그다드, 이라크' },
    unitPlaceholder: { en: 'e.g., 1st Infantry Division', es: 'ej., 1ra División de Infantería', tl: 'hal., 1st Infantry Division', vi: 'ví dụ, Sư đoàn Bộ binh số 1', ko: '예: 제1보병사단' },
    awardNamePlaceholder: { en: 'e.g., Purple Heart', es: 'ej., Corazón Púrpura', tl: 'hal., Purple Heart', vi: 'ví dụ, Purple Heart', ko: '예: 퍼플 하트' },
    abbreviationPlaceholder: { en: 'e.g., PH', es: 'ej., PH', tl: 'hal., PH', vi: 'ví dụ, PH', ko: '예: PH' },
    serviceHistoryBannerText: { en: 'Your service history, deployments, and awards can be used by the PACT Act Navigator to determine toxic exposure eligibility, and by other tools for auto-filling forms and strengthening your claims.', es: 'Tu historial de servicio, despliegues y premios pueden ser utilizados por el Navegador de la Ley PACT para determinar la elegibilidad por exposición tóxica, y por otras herramientas para completar formularios automáticamente y fortalecer tus reclamos.', tl: 'Ang iyong service history, deployments, at awards ay maaaring gamitin ng PACT Act Navigator para matukoy ang toxic exposure eligibility, at ng ibang tools para sa auto-filling forms at pagpapalakas ng iyong mga claim.', vi: 'Lịch sử phục vụ, triển khai và giải thưởng của bạn có thể được sử dụng bởi PACT Act Navigator để xác định đủ điều kiện phơi nhiễm độc hại, và bởi các công cụ khác để tự động điền biểu mẫu và tăng cường yêu cầu của bạn.', ko: '복무 이력, 파병 및 훈장은 PACT 법 내비게이터에서 독성 노출 자격을 결정하고 다른 도구에서 양식을 자동 작성하고 청구를 강화하는 데 사용될 수 있습니다.' },
    drafting: { en: 'Drafting', es: 'Redactando', tl: 'Drafting', vi: 'Đang Soạn Thảo', ko: '초안 작성 중' },
    statementGenerated: { en: 'Statement Generated', es: 'Declaración Generada', tl: 'Nalikha na ang Statement', vi: 'Đã Tạo Báo Cáo', ko: '진술서 생성됨' },
    filed: { en: 'Filed', es: 'Presentado', tl: 'Na-file', vi: 'Đã Nộp', ko: '제출됨' },
    certifyBeforeDownload: { en: 'Please open and certify the statement before downloading', es: 'Por favor abre y certifica la declaración antes de descargar', tl: 'Pakibuksan at i-certify ang statement bago i-download', vi: 'Vui lòng mở và xác nhận báo cáo trước khi tải xuống', ko: '다운로드하기 전에 진술서를 열고 인증하세요' },
    pdfFormat: { en: 'PDF (.pdf)', es: 'PDF (.pdf)', tl: 'PDF (.pdf)', vi: 'PDF (.pdf)', ko: 'PDF (.pdf)' },
    eventTracked: { en: 'event tracked', es: 'evento rastreado', tl: 'event na nasubaybayan', vi: 'sự kiện được theo dõi', ko: '추적된 이벤트' },
    timelineBannerText: { en: 'A continuous timeline of treatment and symptoms helps establish service connection and proves your condition has persisted since service. Use Continuity Thread to identify gaps in your evidence.', es: 'Una línea de tiempo continua de tratamiento y síntomas ayuda a establecer la conexión con el servicio y demuestra que tu condición ha persistido desde el servicio. Usa el Hilo de Continuidad para identificar brechas en tu evidencia.', tl: 'Ang tuloy-tuloy na timeline ng paggamot at mga sintomas ay tumutulong na maitaguyod ang service connection at pinatutunayan na ang iyong kondisyon ay nagpatuloy mula noong serbisyo. Gamitin ang Continuity Thread para tukuyin ang mga gaps sa iyong ebidensya.', vi: 'Dòng thời gian liên tục của điều trị và triệu chứng giúp thiết lập kết nối dịch vụ và chứng minh tình trạng của bạn đã tồn tại kể từ khi phục vụ. Sử dụng Continuity Thread để xác định các khoảng trống trong bằng chứng của bạn.', ko: '치료 및 증상의 지속적인 타임라인은 복무 연결을 확립하고 복무 이후 상태가 지속되었음을 증명하는 데 도움이 됩니다. Continuity Thread를 사용하여 증거의 공백을 확인하세요.' },
    noPainMapsSaved: { en: 'No Pain Maps Saved', es: 'Sin Mapas de Dolor Guardados', tl: 'Walang Naka-save na Pain Maps', vi: 'Không Có Bản Đồ Đau Đã Lưu', ko: '저장된 통증 지도 없음' },
    painMapSaved: { en: 'pain map saved', es: 'mapa de dolor guardado', tl: 'pain map na naka-save', vi: 'bản đồ đau đã lưu', ko: '저장된 통증 지도' },
    confirmClearPainMaps: { en: 'Are you sure you want to clear all pain maps? This cannot be undone.', es: '¿Estás seguro de que quieres borrar todos los mapas de dolor? Esto no se puede deshacer.', tl: 'Sigurado ka bang gusto mong i-clear ang lahat ng pain maps? Hindi ito mababawi.', vi: 'Bạn có chắc chắn muốn xóa tất cả bản đồ đau? Không thể hoàn tác.', ko: '모든 통증 지도를 지우시겠습니까? 이 작업은 취소할 수 없습니다.' },
    untitledPainMap: { en: 'Untitled Pain Map', es: 'Mapa de Dolor Sin Título', tl: 'Walang Pangalan na Pain Map', vi: 'Bản Đồ Đau Chưa Đặt Tên', ko: '제목 없는 통증 지도' },
  },

  // AI Assistant (The Navigator)
  aiAssistant: {
    title: { en: 'The Navigator', es: 'El Navegador', tl: 'The Navigator', vi: 'Người Hướng Dẫn', ko: '내비게이터' },
    subtitleExpanded: { en: 'AI Claims Assistant • Expanded View', es: 'Asistente de Reclamos IA • Vista Expandida', tl: 'AI Claims Assistant • Expanded View', vi: 'Trợ Lý Yêu Cầu AI • Chế Độ Mở Rộng', ko: 'AI 청구 도우미 • 확장 보기' },
    dragToMove: { en: 'Drag to move anywhere', es: 'Arrastra para mover', tl: 'I-drag para ilipat kahit saan', vi: 'Kéo để di chuyển bất cứ đâu', ko: '아무 곳으로나 드래그하여 이동' },
    
    // Welcome message
    welcomeMessage: {
      en: `👋 **Welcome to The Navigator!**

💡 **TIP:** Grab the header to drag me anywhere on your screen!

I'm your AI guide for Vet-Rate.org and the VA claims process. I can help you:

• **Explain any VA term or acronym** - Just ask "What is TDIU?" or "Explain service connection"
• **Guide you through tools** - "How do I use the Rating Calculator?"
• **Answer claims questions** - "What evidence do I need for PTSD?"
• **Recommend next steps** - "What should I do after my C&P exam?"
• **Find the right tool** - "I need help with a nexus letter"

**Try asking me anything!** I use VA regulations (38 CFR) to give accurate answers.`,
      es: `👋 **¡Bienvenido a El Navegador!**

💡 **CONSEJO:** ¡Agarra el encabezado para arrastrarme a cualquier parte de tu pantalla!

Soy tu guía de IA para Vet-Rate.org y el proceso de reclamos del VA. Puedo ayudarte a:

• **Explicar cualquier término o acrónimo del VA** - Solo pregunta "¿Qué es TDIU?" o "Explica la conexión de servicio"
• **Guiarte a través de las herramientas** - "¿Cómo uso la Calculadora de Rating?"
• **Responder preguntas sobre reclamos** - "¿Qué evidencia necesito para TEPT?"
• **Recomendar próximos pasos** - "¿Qué debo hacer después de mi examen C&P?"
• **Encontrar la herramienta correcta** - "Necesito ayuda con una carta de nexo"

**¡Intenta preguntarme cualquier cosa!** Uso las regulaciones del VA (38 CFR) para dar respuestas precisas.`,
      tl: `👋 **Maligayang Pagdating sa The Navigator!**

💡 **TIP:** Hawakan ang header para i-drag ako kahit saan sa screen mo!

Ako ang iyong AI guide para sa Vet-Rate.org at sa proseso ng VA claims. Makakatulong ako sa:

• **Ipaliwanag ang anumang VA term o acronym** - Itanong lang "Ano ang TDIU?" o "Ipaliwanag ang service connection"
• **Gabayan ka sa mga tools** - "Paano ko gamitin ang Rating Calculator?"
• **Sagutin ang mga tanong sa claims** - "Anong ebidensya ang kailangan ko para sa PTSD?"
• **Magrekomenda ng susunod na hakbang** - "Ano ang dapat kong gawin pagkatapos ng C&P exam?"
• **Hanapin ang tamang tool** - "Kailangan ko ng tulong sa nexus letter"

**Subukan mong itanong kahit ano!** Gumagamit ako ng VA regulations (38 CFR) para magbigay ng tumpak na sagot.`,
      vi: `👋 **Chào Mừng Đến Người Hướng Dẫn!**

💡 **MẸO:** Nắm tiêu đề để kéo tôi đến bất cứ đâu trên màn hình của bạn!

Tôi là hướng dẫn AI của bạn cho Vet-Rate.org và quy trình yêu cầu VA. Tôi có thể giúp bạn:

• **Giải thích bất kỳ thuật ngữ hoặc từ viết tắt VA nào** - Chỉ cần hỏi "TDIU là gì?" hoặc "Giải thích kết nối phục vụ"
• **Hướng dẫn bạn qua các công cụ** - "Làm cách nào để sử dụng Máy Tính Xếp Hạng?"
• **Trả lời câu hỏi về yêu cầu** - "Tôi cần bằng chứng gì cho PTSD?"
• **Đề xuất bước tiếp theo** - "Tôi nên làm gì sau khi khám C&P?"
• **Tìm công cụ phù hợp** - "Tôi cần trợ giúp với thư nexus"

**Hãy thử hỏi tôi bất cứ điều gì!** Tôi sử dụng quy định VA (38 CFR) để đưa ra câu trả lời chính xác.`,
      ko: `👋 **내비게이터에 오신 것을 환영합니다!**

💡 **팁:** 헤더를 잡고 화면 어디든지 드래그하세요!

저는 Vet-Rate.org와 VA 청구 절차를 위한 AI 가이드입니다. 다음을 도와드릴 수 있습니다:

• **VA 용어나 약어 설명** - "TDIU가 뭐예요?" 또는 "복무 연결 설명해주세요"라고 물어보세요
• **도구 사용 안내** - "등급 계산기는 어떻게 사용하나요?"
• **청구 질문 답변** - "PTSD에 어떤 증거가 필요하나요?"
• **다음 단계 추천** - "C&P 검사 후에 뭘 해야 하나요?"
• **올바른 도구 찾기** - "넥서스 레터에 도움이 필요해요"

**무엇이든 물어보세요!** VA 규정(38 CFR)을 사용하여 정확한 답변을 드립니다.`
    },
    
    // Tooltips
    minimizedTooltip: { en: 'Drag to move • Click to open AI Navigator', es: 'Arrastra para mover • Haz clic para abrir el Navegador IA', tl: 'I-drag para ilipat • I-click para buksan ang AI Navigator', vi: 'Kéo để di chuyển • Nhấp để mở Người Hướng Dẫn AI', ko: '드래그하여 이동 • 클릭하여 AI 내비게이터 열기' },
    clickToExpand: { en: 'Click to expand Navigator 💬', es: 'Haz clic para expandir el Navegador 💬', tl: 'I-click para i-expand ang Navigator 💬', vi: 'Nhấp để mở rộng Người Hướng Dẫn 💬', ko: '클릭하여 내비게이터 확장 💬' },
    shrinkTooltip: { en: 'Shrink to floating window', es: 'Reducir a ventana flotante', tl: 'Paliitin sa floating window', vi: 'Thu nhỏ thành cửa sổ nổi', ko: '플로팅 창으로 축소' },
    expandTooltip: { en: 'Expand to full screen', es: 'Expandir a pantalla completa', tl: 'I-expand sa full screen', vi: 'Mở rộng toàn màn hình', ko: '전체 화면으로 확장' },
    minimizeTooltip: { en: 'Minimize', es: 'Minimizar', tl: 'I-minimize', vi: 'Thu nhỏ', ko: '최소화' },
    
    // UI Labels
    quickQuestions: { en: 'Quick questions:', es: 'Preguntas rápidas:', tl: 'Mga mabilis na tanong:', vi: 'Câu hỏi nhanh:', ko: '빠른 질문:' },
    send: { en: 'Send', es: 'Enviar', tl: 'Ipadala', vi: 'Gửi', ko: '보내기' },
    analyzing: { en: 'Analyzing your question...', es: 'Analizando tu pregunta...', tl: 'Sinusuri ang tanong mo...', vi: 'Đang phân tích câu hỏi của bạn...', ko: '질문 분석 중...' },
    analyzingShort: { en: 'Analyzing...', es: 'Analizando...', tl: 'Sinusuri...', vi: 'Đang phân tích...', ko: '분석 중...' },
    
    // Mode indicators
    modeLocal: { en: '🔒 Local', es: '🔒 Local', tl: '🔒 Local', vi: '🔒 Cục bộ', ko: '🔒 로컬' },
    modeCloud: { en: '☁️ Cloud', es: '☁️ Nube', tl: '☁️ Cloud', vi: '☁️ Đám mây', ko: '☁️ 클라우드' },
    
    // Placeholders
    placeholder: { en: 'Ask me anything about VA claims, regulations, or how to use Vet-Rate tools...', es: 'Pregúntame cualquier cosa sobre reclamos VA, regulaciones o cómo usar las herramientas de Vet-Rate...', tl: 'Itanong mo sa akin ang kahit ano tungkol sa VA claims, regulations, o paano gamitin ang mga Vet-Rate tools...', vi: 'Hỏi tôi bất cứ điều gì về yêu cầu VA, quy định, hoặc cách sử dụng công cụ Vet-Rate...', ko: 'VA 청구, 규정 또는 Vet-Rate 도구 사용 방법에 대해 무엇이든 물어보세요...' },
    placeholderHelper: { en: 'Ask me anything about VA claims... or tap the mic to speak', es: 'Pregúntame cualquier cosa sobre reclamos VA... o toca el micrófono para hablar', tl: 'Itanong mo sa akin ang kahit ano tungkol sa VA claims... o i-tap ang mic para magsalita', vi: 'Hỏi tôi bất cứ điều gì về yêu cầu VA... hoặc nhấn mic để nói', ko: 'VA 청구에 대해 무엇이든 물어보세요... 또는 마이크를 탭하여 말하세요' },
    placeholderShort: { en: 'Ask me anything... or tap the mic', es: 'Pregúntame cualquier cosa... o toca el micrófono', tl: 'Itanong mo kahit ano... o i-tap ang mic', vi: 'Hỏi bất cứ điều gì... hoặc nhấn mic', ko: '무엇이든 물어보세요... 또는 마이크 탭' },
    placeholderHelperShort: { en: 'Ask me anything about VA claims... or tap the mic', es: 'Pregúntame sobre reclamos VA... o toca el micrófono', tl: 'Itanong tungkol sa VA claims... o i-tap ang mic', vi: 'Hỏi về yêu cầu VA... hoặc nhấn mic', ko: 'VA 청구에 대해 물어보세요... 또는 마이크 탭' },
    
    // Keyboard hints
    keyboardHints: { en: 'Press Enter to send • Shift+Enter for new line • 🎤 Voice input available', es: 'Presiona Enter para enviar • Shift+Enter para nueva línea • 🎤 Entrada de voz disponible', tl: 'Pindutin ang Enter para ipadala • Shift+Enter para sa bagong linya • 🎤 Voice input available', vi: 'Nhấn Enter để gửi • Shift+Enter xuống dòng • 🎤 Nhập giọng nói khả dụng', ko: 'Enter로 보내기 • Shift+Enter로 줄바꿈 • 🎤 음성 입력 가능' },
    keyboardHintsShort: { en: 'Press Enter to send • 🎤 Tap mic to speak (stays on your device)', es: 'Presiona Enter para enviar • 🎤 Toca el mic para hablar (se queda en tu dispositivo)', tl: 'Pindutin ang Enter para ipadala • 🎤 I-tap ang mic para magsalita (nananatili sa device mo)', vi: 'Nhấn Enter để gửi • 🎤 Nhấn mic để nói (lưu trên thiết bị của bạn)', ko: 'Enter로 보내기 • 🎤 마이크 탭하여 말하기 (기기에 저장)' },
    helperModeActive: { en: '• 💝 Helper Mode Active', es: '• 💝 Modo Ayudante Activo', tl: '• 💝 Aktibo ang Helper Mode', vi: '• 💝 Chế Độ Trợ Giúp Đang Hoạt Động', ko: '• 💝 도우미 모드 활성화' },
    
    // Error messages
    errorGeneric: { en: 'I encountered an error. Please try again.', es: 'Encontré un error. Por favor intenta de nuevo.', tl: 'Nagkaroon ng error. Subukan ulit.', vi: 'Tôi gặp lỗi. Vui lòng thử lại.', ko: '오류가 발생했습니다. 다시 시도해 주세요.' },
    errorCrisis: { en: '⚠️ I detected language that may indicate distress. Please reach out to the Veterans Crisis Line: **Call 988, Press 1** or text 838255. You can also chat at VeteransCrisisLine.net. Help is available 24/7.', es: '⚠️ Detecté un lenguaje que puede indicar angustia. Por favor comunícate con la Línea de Crisis para Veteranos: **Llama al 988, Presiona 1** o envía un mensaje de texto al 838255. También puedes chatear en VeteransCrisisLine.net. La ayuda está disponible 24/7.', tl: '⚠️ Nakita ko ang wika na maaaring magpahiwatig ng pagkabalisa. Mangyaring makipag-ugnay sa Veterans Crisis Line: **Tumawag sa 988, Pindutin ang 1** o mag-text sa 838255. Maaari ka ring mag-chat sa VeteransCrisisLine.net. Available ang tulong 24/7.', vi: '⚠️ Tôi phát hiện ngôn ngữ có thể cho thấy sự đau khổ. Vui lòng liên hệ Đường dây Khủng hoảng Cựu chiến binh: **Gọi 988, Nhấn 1** hoặc nhắn tin 838255. Bạn cũng có thể trò chuyện tại VeteransCrisisLine.net. Hỗ trợ 24/7.', ko: '⚠️ 고통을 나타낼 수 있는 언어를 감지했습니다. 재향군인 위기 상담 전화에 연락해 주세요: **988로 전화, 1을 누르세요** 또는 838255로 문자. VeteransCrisisLine.net에서 채팅도 가능합니다. 24시간 도움을 받을 수 있습니다.' },
    errorNoAI: { en: '⚠️ AI is not configured. Please set up Cloud AI (Gemini API key) or Local AI in Settings.', es: '⚠️ La IA no está configurada. Por favor configura la IA en la Nube (clave API de Gemini) o la IA Local en Configuración.', tl: '⚠️ Hindi naka-configure ang AI. Mangyaring i-setup ang Cloud AI (Gemini API key) o Local AI sa Settings.', vi: '⚠️ AI chưa được cấu hình. Vui lòng thiết lập Cloud AI (khóa API Gemini) hoặc Local AI trong Cài đặt.', ko: '⚠️ AI가 구성되지 않았습니다. 설정에서 클라우드 AI(Gemini API 키) 또는 로컬 AI를 설정해 주세요.' },
    errorDisabled: { en: '⚠️ AI features are temporarily unavailable. Please try again later.', es: '⚠️ Las funciones de IA no están disponibles temporalmente. Por favor intenta más tarde.', tl: '⚠️ Ang mga AI features ay pansamantalang hindi available. Subukan ulit mamaya.', vi: '⚠️ Các tính năng AI tạm thời không khả dụng. Vui lòng thử lại sau.', ko: '⚠️ AI 기능을 일시적으로 사용할 수 없습니다. 나중에 다시 시도해 주세요.' },
    errorEmptyResponse: { en: '⚠️ AI returned an empty response. This can happen with Local AI sometimes. Please try:\n• Rephrasing your question\n• Using a shorter prompt\n• Checking if the model is fully loaded', es: '⚠️ La IA devolvió una respuesta vacía. Esto puede ocurrir con la IA Local a veces. Por favor intenta:\n• Reformular tu pregunta\n• Usar un prompt más corto\n• Verificar si el modelo está completamente cargado', tl: '⚠️ Nagbalik ng walang laman na sagot ang AI. Ito ay nangyayari minsan sa Local AI. Subukan:\n• Baguhin ang pagkakalatag ng tanong mo\n• Gumamit ng mas maikling prompt\n• I-check kung fully loaded na ang model', vi: '⚠️ AI trả về phản hồi trống. Điều này đôi khi xảy ra với Local AI. Vui lòng thử:\n• Diễn đạt lại câu hỏi của bạn\n• Sử dụng prompt ngắn hơn\n• Kiểm tra xem mô hình đã tải đầy đủ chưa', ko: '⚠️ AI가 빈 응답을 반환했습니다. 로컬 AI에서 가끔 발생할 수 있습니다. 다음을 시도해 보세요:\n• 질문 다시 표현하기\n• 더 짧은 프롬프트 사용\n• 모델이 완전히 로드되었는지 확인' },
    errorNotReady: { en: '⚠️ Local AI is not ready yet. Please wait for the model to finish loading, or configure Cloud AI in Settings.', es: '⚠️ La IA Local aún no está lista. Por favor espera a que el modelo termine de cargar, o configura la IA en la Nube en Configuración.', tl: '⚠️ Hindi pa handa ang Local AI. Maghintay na matapos mag-load ang model, o i-configure ang Cloud AI sa Settings.', vi: '⚠️ Local AI chưa sẵn sàng. Vui lòng đợi mô hình tải xong, hoặc cấu hình Cloud AI trong Cài đặt.', ko: '⚠️ 로컬 AI가 아직 준비되지 않았습니다. 모델 로딩이 완료될 때까지 기다리거나 설정에서 클라우드 AI를 구성해 주세요.' },
    
    // Quick questions - Home
    quickQ_home1: { en: 'What should I do first to file a claim?', es: '¿Qué debo hacer primero para presentar un reclamo?', tl: 'Ano ang dapat kong gawin muna para mag-file ng claim?', vi: 'Tôi nên làm gì đầu tiên để nộp yêu cầu?', ko: '청구를 제출하려면 먼저 무엇을 해야 하나요?' },
    quickQ_home2: { en: 'How does the VA rating system work?', es: '¿Cómo funciona el sistema de rating del VA?', tl: 'Paano gumagana ang VA rating system?', vi: 'Hệ thống xếp hạng VA hoạt động như thế nào?', ko: 'VA 등급 시스템은 어떻게 작동하나요?' },
    quickQ_home3: { en: 'What tools should I use for a PTSD claim?', es: '¿Qué herramientas debo usar para un reclamo de TEPT?', tl: 'Anong tools ang dapat kong gamitin para sa PTSD claim?', vi: 'Tôi nên sử dụng công cụ nào cho yêu cầu PTSD?', ko: 'PTSD 청구에 어떤 도구를 사용해야 하나요?' },
    
    // Quick questions - Disability Search
    quickQ_search1: { en: 'How do I find the right diagnostic code?', es: '¿Cómo encuentro el código diagnóstico correcto?', tl: 'Paano ko mahahanap ang tamang diagnostic code?', vi: 'Làm thế nào để tìm mã chẩn đoán phù hợp?', ko: '올바른 진단 코드를 어떻게 찾나요?' },
    quickQ_search2: { en: 'What does "bilateral factor" mean?', es: '¿Qué significa "factor bilateral"?', tl: 'Ano ang ibig sabihin ng "bilateral factor"?', vi: '"Yếu tố song phương" có nghĩa là gì?', ko: '"양측 요인"이 무슨 뜻인가요?' },
    quickQ_search3: { en: 'Can you explain how ratings are assigned?', es: '¿Puedes explicar cómo se asignan los ratings?', tl: 'Maaari mo bang ipaliwanag kung paano binibigyan ng ratings?', vi: 'Bạn có thể giải thích cách xếp hạng được phân bổ không?', ko: '등급이 어떻게 부여되는지 설명해 주실 수 있나요?' },
    
    // Quick questions - Rating Calculator
    quickQ_calc1: { en: 'How does VA math work?', es: '¿Cómo funciona las matemáticas del VA?', tl: 'Paano gumagana ang VA math?', vi: 'Toán VA hoạt động như thế nào?', ko: 'VA 수학은 어떻게 작동하나요?' },
    quickQ_calc2: { en: 'What is the bilateral factor?', es: '¿Qué es el factor bilateral?', tl: 'Ano ang bilateral factor?', vi: 'Yếu tố song phương là gì?', ko: '양측 요인이 무엇인가요?' },
    quickQ_calc3: { en: 'Can I get 100% with multiple conditions?', es: '¿Puedo obtener 100% con múltiples condiciones?', tl: 'Maaari ba akong makakuha ng 100% na may maraming kondisyon?', vi: 'Tôi có thể đạt 100% với nhiều tình trạng không?', ko: '여러 조건으로 100%를 받을 수 있나요?' },
    
    // Quick questions - Secondary Scout
    quickQ_secondary1: { en: 'What are secondary conditions?', es: '¿Qué son las condiciones secundarias?', tl: 'Ano ang secondary conditions?', vi: 'Tình trạng thứ cấp là gì?', ko: '2차 상태란 무엇인가요?' },
    quickQ_secondary2: { en: 'How do I prove a condition is secondary?', es: '¿Cómo demuestro que una condición es secundaria?', tl: 'Paano ko papatunayan na secondary ang isang kondisyon?', vi: 'Làm thế nào để chứng minh một tình trạng là thứ cấp?', ko: '상태가 2차임을 어떻게 증명하나요?' },
    quickQ_secondary3: { en: 'What evidence do I need for secondary claims?', es: '¿Qué evidencia necesito para reclamos secundarios?', tl: 'Anong ebidensya ang kailangan ko para sa secondary claims?', vi: 'Tôi cần bằng chứng gì cho yêu cầu thứ cấp?', ko: '2차 청구에 어떤 증거가 필요한가요?' },
    
    // Quick questions - C-File Analyzer
    quickQ_cfile1: { en: 'How do I get my C-File?', es: '¿Cómo obtengo mi C-File?', tl: 'Paano ko makukuha ang C-File ko?', vi: 'Làm thế nào để lấy C-File của tôi?', ko: 'C-File을 어떻게 받나요?' },
    quickQ_cfile2: { en: 'What should I look for in my C-File?', es: '¿Qué debo buscar en mi C-File?', tl: 'Ano ang dapat kong hanapin sa C-File ko?', vi: 'Tôi nên tìm gì trong C-File của tôi?', ko: 'C-File에서 무엇을 찾아야 하나요?' },
    quickQ_cfile3: { en: 'Can you help me analyze a denial?', es: '¿Puedes ayudarme a analizar una denegación?', tl: 'Maaari mo ba akong tulungan na suriin ang isang denial?', vi: 'Bạn có thể giúp tôi phân tích một lần từ chối không?', ko: '거부를 분석하는 데 도움을 줄 수 있나요?' },
    
    // Quick questions - Nexus Builder
    quickQ_nexus1: { en: 'What is a nexus letter?', es: '¿Qué es una carta de nexo?', tl: 'Ano ang nexus letter?', vi: 'Thư nexus là gì?', ko: '넥서스 레터란 무엇인가요?' },
    quickQ_nexus2: { en: 'What should a nexus letter include?', es: '¿Qué debe incluir una carta de nexo?', tl: 'Ano ang dapat kasama sa nexus letter?', vi: 'Thư nexus nên bao gồm những gì?', ko: '넥서스 레터에는 무엇이 포함되어야 하나요?' },
    quickQ_nexus3: { en: 'Do I need a doctor to write this?', es: '¿Necesito un doctor para escribir esto?', tl: 'Kailangan ko ba ng doktor para isulat ito?', vi: 'Tôi có cần bác sĩ viết thư này không?', ko: '이것을 쓰려면 의사가 필요한가요?' },
    
    // Quick questions - PACT Act Navigator
    quickQ_pact1: { en: 'Am I covered under the PACT Act?', es: '¿Estoy cubierto por la Ley PACT?', tl: 'Sakop ba ako ng PACT Act?', vi: 'Tôi có được bảo hiểm theo Đạo luật PACT không?', ko: 'PACT 법에 적용되나요?' },
    quickQ_pact2: { en: 'What are presumptive conditions?', es: '¿Qué son las condiciones presuntivas?', tl: 'Ano ang presumptive conditions?', vi: 'Các tình trạng được suy đoán là gì?', ko: '추정 조건이란 무엇인가요?' },
    quickQ_pact3: { en: 'How do I file a PACT Act claim?', es: '¿Cómo presento un reclamo de la Ley PACT?', tl: 'Paano ako mag-file ng PACT Act claim?', vi: 'Làm thế nào để nộp yêu cầu theo Đạo luật PACT?', ko: 'PACT 법 청구는 어떻게 제출하나요?' },
    
    // Quick questions - TDIU Builder
    quickQ_tdiu1: { en: 'What is TDIU?', es: '¿Qué es TDIU?', tl: 'Ano ang TDIU?', vi: 'TDIU là gì?', ko: 'TDIU가 무엇인가요?' },
    quickQ_tdiu2: { en: 'Do I qualify for TDIU?', es: '¿Califico para TDIU?', tl: 'Kwalipikado ba ako para sa TDIU?', vi: 'Tôi có đủ điều kiện cho TDIU không?', ko: 'TDIU 자격이 되나요?' },
    quickQ_tdiu3: { en: 'What evidence do I need for TDIU?', es: '¿Qué evidencia necesito para TDIU?', tl: 'Anong ebidensya ang kailangan ko para sa TDIU?', vi: 'Tôi cần bằng chứng gì cho TDIU?', ko: 'TDIU에 어떤 증거가 필요한가요?' },
  },

  // Secondary Scout
  secondaryScoutSection: {
    title: { en: 'Secondary Scout', es: 'Explorador Secundario', tl: 'Secondary Scout', vi: 'Trinh Sát Thứ Cấp', ko: '2차 스카우트' },
    subtitle: { en: 'Find conditions linked to your service-connected disabilities', es: 'Encuentra condiciones vinculadas a tus discapacidades conectadas al servicio', tl: 'Hanapin ang mga kondisyon na naka-link sa iyong service-connected disabilities', vi: 'Tìm các tình trạng liên kết với khuyết tật của bạn liên quan đến phục vụ', ko: '복무 관련 장애와 연결된 상태 찾기' },
    potentialClaimsSubtitle: { en: 'Potential secondary claims based on your service-connected disabilities (38 CFR § 3.310)', es: 'Posibles reclamos secundarios basados en tus discapacidades conectadas al servicio (38 CFR § 3.310)', tl: 'Potensyal na secondary claims batay sa iyong service-connected disabilities (38 CFR § 3.310)', vi: 'Yêu cầu thứ cấp tiềm năng dựa trên khuyết tật liên quan đến phục vụ của bạn (38 CFR § 3.310)', ko: '복무 관련 장애에 기반한 잠재적 2차 청구 (38 CFR § 3.310)' },
    enterDisabilitiesInfo: { en: 'Enter your current service-connected disabilities to discover potential secondary claims you may be eligible for under 38 CFR § 3.310.', es: 'Ingresa tus discapacidades actuales conectadas al servicio para descubrir posibles reclamos secundarios bajo 38 CFR § 3.310.', tl: 'Ilagay ang iyong kasalukuyang service-connected disabilities para matuklasan ang potensyal na secondary claims na maaari kang maging karapat-dapat sa ilalim ng 38 CFR § 3.310.', vi: 'Nhập các khuyết tật liên quan đến phục vụ hiện tại của bạn để khám phá các yêu cầu thứ cấp tiềm năng mà bạn có thể đủ điều kiện theo 38 CFR § 3.310.', ko: '38 CFR § 3.310에 따라 자격이 될 수 있는 잠재적 2차 청구를 발견하려면 현재 복무 관련 장애를 입력하세요.' },
    foundConditions: { en: 'potential secondary conditions found', es: 'posibles condiciones secundarias encontradas', tl: 'potensyal na secondary conditions na nahanap', vi: 'tình trạng thứ cấp tiềm năng được tìm thấy', ko: '잠재적 2차 상태 발견' },
    totalSuggestions: { en: 'Total Suggestions', es: 'Sugerencias Totales', tl: 'Kabuuang Mga Suhestiyon', vi: 'Tổng Gợi Ý', ko: '총 제안' },
    highProbability: { en: 'High Probability', es: 'Alta Probabilidad', tl: 'Mataas na Probabilidad', vi: 'Xác Suất Cao', ko: '높은 확률' },
    mediumProbability: { en: 'Medium Probability', es: 'Probabilidad Media', tl: 'Katamtamang Probabilidad', vi: 'Xác Suất Trung Bình', ko: '중간 확률' },
    medicationRelated: { en: 'Medication-Related', es: 'Relacionado con Medicamentos', tl: 'May-kaugnayan sa Gamot', vi: 'Liên Quan Đến Thuốc', ko: '약물 관련' },
    biomechanical: { en: 'Biomechanical', es: 'Biomecánico', tl: 'Biomechanical', vi: 'Cơ Sinh Học', ko: '생체역학적' },
    filterByProbability: { en: 'Filter by Probability', es: 'Filtrar por Probabilidad', tl: 'I-filter ayon sa Probabilidad', vi: 'Lọc theo Xác Suất', ko: '확률로 필터' },
    highOnly: { en: 'High Only', es: 'Solo Alta', tl: 'Mataas Lamang', vi: 'Chỉ Cao', ko: '높음만' },
    highAndMedium: { en: 'High & Medium', es: 'Alta y Media', tl: 'Mataas at Katamtaman', vi: 'Cao & Trung Bình', ko: '높음 & 중간' },
    selectAll: { en: 'Select All', es: 'Seleccionar Todo', tl: 'Piliin Lahat', vi: 'Chọn Tất Cả', ko: '모두 선택' },
    clearSelection: { en: 'Clear Selection', es: 'Limpiar Selección', tl: 'I-clear ang Pinili', vi: 'Xóa Lựa Chọn', ko: '선택 지우기' },
    claimsSelected: { en: 'claim(s) selected', es: 'reclamo(s) seleccionado(s)', tl: 'claim(s) na napili', vi: 'yêu cầu đã chọn', ko: '청구 선택됨' },
    saved: { en: 'Saved', es: 'Guardado', tl: 'Na-save', vi: 'Đã Lưu', ko: '저장됨' },
    addToPacket: { en: 'Add to Packet', es: 'Agregar al Paquete', tl: 'Idagdag sa Packet', vi: 'Thêm Vào Hồ Sơ', ko: '패킷에 추가' },
    noSuggestionsFilter: { en: 'No suggestions match the current filter. Try selecting "High & Medium".', es: 'Ninguna sugerencia coincide con el filtro actual. Intenta seleccionar "Alta y Media".', tl: 'Walang mga suhestiyon na tumugma sa kasalukuyang filter. Subukang piliin ang "Mataas at Katamtaman".', vi: 'Không có gợi ý nào phù hợp với bộ lọc hiện tại. Hãy thử chọn "Cao & Trung Bình".', ko: '현재 필터와 일치하는 제안이 없습니다. "높음 & 중간"을 선택해 보세요.' },
    important: { en: 'Important', es: 'Importante', tl: 'Mahalaga', vi: 'Quan Trọng', ko: '중요' },
    disclaimerText: { en: 'These suggestions are educational tools based on 38 CFR § 3.310 principles. Consult with a VA-accredited representative or medical professional before filing a secondary claim. A medical nexus opinion from a qualified physician is required to establish service connection.', es: 'Estas sugerencias son herramientas educativas basadas en los principios de 38 CFR § 3.310. Consulta con un representante acreditado del VA o un profesional médico antes de presentar un reclamo secundario. Se requiere una opinión de nexo médico de un médico calificado para establecer la conexión de servicio.', tl: 'Ang mga suhestiyon na ito ay mga educational tools batay sa mga prinsipyo ng 38 CFR § 3.310. Kumonsulta sa isang VA-accredited representative o medical professional bago mag-file ng secondary claim. Kinakailangan ang medical nexus opinion mula sa isang kwalipikadong doktor para maitatag ang service connection.', vi: 'Những gợi ý này là công cụ giáo dục dựa trên các nguyên tắc 38 CFR § 3.310. Tham khảo ý kiến đại diện được VA công nhận hoặc chuyên gia y tế trước khi nộp yêu cầu thứ cấp. Cần có ý kiến nexus y tế từ bác sĩ có trình độ để thiết lập kết nối phục vụ.', ko: '이러한 제안은 38 CFR § 3.310 원칙에 기반한 교육 도구입니다. 2차 청구를 제출하기 전에 VA 공인 대리인 또는 의료 전문가와 상담하세요. 복무 연결을 확립하려면 자격을 갖춘 의사의 의료 넥서스 의견이 필요합니다.' },
    secondaryTo: { en: 'Secondary to', es: 'Secundario a', tl: 'Secondary sa', vi: 'Thứ cấp của', ko: '2차 대상' },
    learnHow: { en: 'Learn How', es: 'Aprende Cómo', tl: 'Alamin Kung Paano', vi: 'Tìm Hiểu Cách', ko: '방법 알아보기' },
    alreadySaved: { en: 'Already Saved', es: 'Ya Guardado', tl: 'Naka-save Na', vi: 'Đã Lưu', ko: '이미 저장됨' },
    selectPrimary: { en: 'Select your primary conditions to find secondary claims', es: 'Selecciona tus condiciones primarias para encontrar reclamos secundarios', tl: 'Piliin ang iyong primary conditions para mahanap ang secondary claims', vi: 'Chọn các tình trạng chính để tìm yêu cầu thứ cấp', ko: '2차 청구를 찾으려면 주요 상태를 선택하세요' },
    mechanism: { en: 'Mechanism', es: 'Mecanismo', tl: 'Mekanismo', vi: 'Cơ Chế', ko: '메커니즘' },
    medicalEvidence: { en: 'Medical Evidence', es: 'Evidencia Médica', tl: 'Medical Evidence', vi: 'Bằng Chứng Y Tế', ko: '의료 증거' },
    nexusTheory: { en: 'Nexus Theory', es: 'Teoría de Nexo', tl: 'Nexus Theory', vi: 'Lý Thuyết Nexus', ko: '넥서스 이론' },
    connectionType: { en: 'Connection Type', es: 'Tipo de Conexión', tl: 'Uri ng Koneksyon', vi: 'Loại Kết Nối', ko: '연결 유형' },
    note: { en: 'Note', es: 'Nota', tl: 'Paalala', vi: 'Ghi Chú', ko: '참고' },
    medicalLiteratureSupport: { en: 'Medical Literature Support', es: 'Apoyo de Literatura Médica', tl: 'Medical Literature Support', vi: 'Hỗ Trợ Tài Liệu Y Tế', ko: '의학 문헌 지원' },
    buildStatement: { en: 'Build Statement (VA Form 21-4138)', es: 'Crear Declaración (VA Form 21-4138)', tl: 'Gumawa ng Statement (VA Form 21-4138)', vi: 'Tạo Tuyên Bố (VA Form 21-4138)', ko: '진술서 작성 (VA 양식 21-4138)' },
    getDoctorsPacket: { en: "Get Doctor's Packet (AI)", es: 'Obtener Paquete Médico (IA)', tl: "Kumuha ng Doctor's Packet (AI)", vi: 'Lấy Gói Bác Sĩ (AI)', ko: '의사 패킷 받기 (AI)' },
    savedViewPacket: { en: 'Saved (View Packet)', es: 'Guardado (Ver Paquete)', tl: 'Na-save (Tingnan ang Packet)', vi: 'Đã Lưu (Xem Hồ Sơ)', ko: '저장됨 (패킷 보기)' },
    saveForLater: { en: 'Save for Later', es: 'Guardar para Después', tl: 'I-save para Mamaya', vi: 'Lưu Để Sau', ko: '나중을 위해 저장' },
    // Mechanism explanations
    directCausation: { en: 'Direct Causation', es: 'Causación Directa', tl: 'Direktang Sanhi', vi: 'Nguyên Nhân Trực Tiếp', ko: '직접적 원인' },
    directCausationDesc: { en: 'The primary service-connected condition directly causes the secondary condition through physiological or psychological mechanisms. This is the most straightforward type of secondary connection.', es: 'La condición primaria conectada al servicio causa directamente la condición secundaria a través de mecanismos fisiológicos o psicológicos. Este es el tipo más directo de conexión secundaria.', tl: 'Ang pangunahing service-connected condition ay direktang nagiging sanhi ng secondary condition sa pamamagitan ng physiological o psychological mechanisms. Ito ang pinakasimpleng uri ng secondary connection.', vi: 'Tình trạng kết nối phục vụ chính trực tiếp gây ra tình trạng thứ cấp thông qua các cơ chế sinh lý hoặc tâm lý. Đây là loại kết nối thứ cấp đơn giản nhất.', ko: '주요 복무 관련 상태가 생리적 또는 심리적 메커니즘을 통해 2차 상태를 직접 유발합니다. 이것은 가장 직접적인 2차 연결 유형입니다.' },
    directCausationExample: { en: 'Example: PTSD directly causes anxiety through chronic stress responses and hyperarousal.', es: 'Ejemplo: El TEPT causa directamente ansiedad a través de respuestas de estrés crónico e hiperactivación.', tl: 'Halimbawa: Ang PTSD ay direktang nagdudulot ng anxiety sa pamamagitan ng chronic stress responses at hyperarousal.', vi: 'Ví dụ: PTSD trực tiếp gây ra lo âu thông qua phản ứng căng thẳng mãn tính và tăng kích thích.', ko: '예: PTSD는 만성 스트레스 반응과 과각성을 통해 직접적으로 불안을 유발합니다.' },
    iatrogenic: { en: 'Iatrogenic (Medication-Induced)', es: 'Iatrogénico (Inducido por Medicamentos)', tl: 'Iatrogenic (Dulot ng Gamot)', vi: 'Do Điều Trị (Do Thuốc Gây Ra)', ko: '의인성 (약물 유발)' },
    iatrogenicDesc: { en: 'The medications or treatments necessary to manage the primary service-connected condition cause the secondary condition as a side effect. This is also called "proximate cause via treatment."', es: 'Los medicamentos o tratamientos necesarios para manejar la condición primaria conectada al servicio causan la condición secundaria como efecto secundario. Esto también se llama "causa próxima a través del tratamiento."', tl: 'Ang mga gamot o treatment na kinakailangan para pamahalaan ang pangunahing service-connected condition ay nagdudulot ng secondary condition bilang side effect. Ito ay tinatawag din na "proximate cause via treatment."', vi: 'Các loại thuốc hoặc phương pháp điều trị cần thiết để quản lý tình trạng kết nối phục vụ chính gây ra tình trạng thứ cấp như một tác dụng phụ. Điều này còn được gọi là "nguyên nhân gần thông qua điều trị."', ko: '주요 복무 관련 상태를 관리하는 데 필요한 약물이나 치료가 부작용으로 2차 상태를 유발합니다. 이것은 "치료를 통한 근접 원인"이라고도 합니다.' },
    iatrogenicExample: { en: 'Example: NSAIDs taken for back pain cause GERD by disrupting the gastric mucosal barrier.', es: 'Ejemplo: Los AINEs tomados para el dolor de espalda causan ERGE al interrumpir la barrera mucosa gástrica.', tl: 'Halimbawa: Ang NSAIDs na iniinom para sa sakit ng likod ay nagdudulot ng GERD sa pamamagitan ng pag-abala sa gastric mucosal barrier.', vi: 'Ví dụ: NSAIDs dùng cho đau lưng gây GERD bằng cách phá vỡ hàng rào niêm mạc dạ dày.', ko: '예: 허리 통증을 위해 복용하는 NSAIDs가 위 점막 장벽을 파괴하여 GERD를 유발합니다.' },
    biomechanicalCompensation: { en: 'Biomechanical Compensation', es: 'Compensación Biomecánica', tl: 'Biomechanical Compensation', vi: 'Bù Trừ Cơ Sinh Học', ko: '생체역학적 보상' },
    biomechanicalCompensationDesc: { en: 'The primary condition requires altered movement patterns, posture, or gait that place abnormal stress on other body parts, causing or aggravating secondary conditions. This is part of the "kinetic chain" concept.', es: 'La condición primaria requiere patrones de movimiento alterados, postura o marcha que ejercen estrés anormal en otras partes del cuerpo, causando o agravando condiciones secundarias. Esto es parte del concepto de "cadena cinética."', tl: 'Ang pangunahing kondisyon ay nangangailangan ng altered movement patterns, posture, o gait na naglalagay ng abnormal stress sa ibang bahagi ng katawan, na nagdudulot o nagpapalala ng secondary conditions. Ito ay bahagi ng "kinetic chain" concept.', vi: 'Tình trạng chính đòi hỏi các mẫu chuyển động, tư thế hoặc dáng đi thay đổi gây căng thẳng bất thường lên các bộ phận cơ thể khác, gây ra hoặc làm trầm trọng thêm các tình trạng thứ cấp. Đây là một phần của khái niệm "chuỗi động học."', ko: '주요 상태로 인해 변경된 움직임 패턴, 자세 또는 보행이 다른 신체 부위에 비정상적인 스트레스를 가하여 2차 상태를 유발하거나 악화시킵니다. 이것은 "운동 사슬" 개념의 일부입니다.' },
    biomechanicalCompensationExample: { en: 'Example: A right knee injury causes altered gait, placing excess stress on the left knee and lumbar spine.', es: 'Ejemplo: Una lesión en la rodilla derecha causa una marcha alterada, ejerciendo estrés excesivo en la rodilla izquierda y la columna lumbar.', tl: 'Halimbawa: Ang injury sa kanang tuhod ay nagdudulot ng altered gait, na naglalagay ng labis na stress sa kaliwang tuhod at lumbar spine.', vi: 'Ví dụ: Chấn thương đầu gối phải gây ra dáng đi thay đổi, tạo căng thẳng quá mức lên đầu gối trái và cột sống thắt lưng.', ko: '예: 오른쪽 무릎 부상이 변경된 보행을 유발하여 왼쪽 무릎과 요추에 과도한 스트레스를 가합니다.' },
  },

  // Disclaimer
  disclaimer: {
    importantDisclaimer: { en: 'IMPORTANT DISCLAIMER', es: 'AVISO IMPORTANTE', tl: 'MAHALAGANG PAALALA', vi: 'TUYÊN BỐ QUAN TRỌNG', ko: '중요 고지' },
    educationalResource: { en: 'Educational Resource', es: 'Recurso Educativo', tl: 'Educational Resource', vi: 'Tài Nguyên Giáo Dục', ko: '교육 자료' },
    notLegalAdvice: { en: 'Not legal or medical advice', es: 'No es asesoramiento legal o médico', tl: 'Hindi legal o medical advice', vi: 'Không phải lời khuyên pháp lý hoặc y tế', ko: '법률 또는 의료 조언이 아님' },
    yourPrivacy: { en: 'Your Privacy', es: 'Tu Privacidad', tl: 'Ang Privacy Mo', vi: 'Quyền Riêng Tư Của Bạn', ko: '개인정보 보호' },
    noDataCollected: { en: 'No data collected or sold', es: 'Sin recolección ni venta de datos', tl: 'Walang data na kinokolekta o ibinebenta', vi: 'Không thu thập hoặc bán dữ liệu', ko: '데이터 수집 또는 판매 없음' },
    veteranBuilt: { en: 'Veteran-Built', es: 'Hecho por Veterano', tl: 'Gawa ng Beterano', vi: 'Được Cựu Chiến Binh Xây Dựng', ko: '재향군인이 만듦' },
    byServiceDisabledVet: { en: 'By a service-disabled vet', es: 'Por un veterano discapacitado', tl: 'Ng isang service-disabled veteran', vi: 'Bởi một cựu chiến binh khuyết tật', ko: '복무 장애 재향군인 제작' },
    consultVSO: { en: 'For official claims assistance, consult an accredited VSO or VA representative.', es: 'Para asistencia oficial, consulta a un VSO acreditado o representante del VA.', tl: 'Para sa opisyal na tulong, kumonsulta sa isang accredited VSO o VA representative.', vi: 'Để được hỗ trợ chính thức, hãy tham khảo VSO được công nhận hoặc đại diện VA.', ko: '공식 청구 지원을 위해 인증된 VSO 또는 VA 담당자와 상담하세요.' },
    informationalOnly: { en: 'This website is for informational purposes only', es: 'Este sitio web es solo para fines informativos', tl: 'Ang website na ito ay para sa informational purposes lamang', vi: 'Trang web này chỉ dành cho mục đích thông tin', ko: '이 웹사이트는 정보 제공 목적으로만 사용됩니다' },
  },

  // About Us
  about: {
    aboutVetRate: { en: 'About Vet-Rate.org', es: 'Acerca de Vet-Rate.org', tl: 'Tungkol sa Vet-Rate.org', vi: 'Về Vet-Rate.org', ko: 'Vet-Rate.org 소개' },
    ourMission: { en: 'Our Mission', es: 'Nuestra Misión', tl: 'Ang Aming Misyon', vi: 'Sứ Mệnh Của Chúng Tôi', ko: '우리의 미션' },
    myMission: { en: 'My Mission', es: 'Mi Misión', tl: 'Ang Aking Misyon', vi: 'Sứ Mệnh Của Tôi', ko: '나의 미션' },
    builtByVeterans: { en: 'Built by Veterans, for Veterans', es: 'Hecho por Veteranos, para Veteranos', tl: 'Gawa ng mga Beterano, para sa mga Beterano', vi: 'Được Xây Dựng Bởi Cựu Chiến Binh, Cho Cựu Chiến Binh', ko: '재향군인에 의해, 재향군인을 위해 제작' },
    builtByVeteranForVeterans: { en: 'Built by a Veteran, For Veterans.', es: 'Hecho por un Veterano, Para Veteranos.', tl: 'Gawa ng isang Beterano, Para sa mga Beterano.', vi: 'Được Xây Dựng Bởi Một Cựu Chiến Binh, Cho Cựu Chiến Binh.', ko: '재향군인이 만들고, 재향군인을 위해.' },
    contact: { en: 'Contact', es: 'Contacto', tl: 'Makipag-ugnay', vi: 'Liên Hệ', ko: '연락처' },
    contactFeedback: { en: 'Contact & Feedback', es: 'Contacto y Comentarios', tl: 'Makipag-ugnay at Feedback', vi: 'Liên Hệ & Phản Hồi', ko: '연락처 및 피드백' },
    version: { en: 'Version', es: 'Versión', tl: 'Bersyon', vi: 'Phiên Bản', ko: '버전' },
    changelog: { en: 'Changelog', es: 'Registro de Cambios', tl: 'Changelog', vi: 'Nhật Ký Thay Đổi', ko: '변경 로그' },
    whatsNew: { en: "What's New", es: 'Novedades', tl: 'Ano ang Bago', vi: 'Có Gì Mới', ko: '새로운 기능' },
    features: { en: 'Features', es: 'Características', tl: 'Mga Feature', vi: 'Tính Năng', ko: '기능' },
    bugFix: { en: 'Bug Fix', es: 'Corrección de Error', tl: 'Bug Fix', vi: 'Sửa Lỗi', ko: '버그 수정' },
    improvement: { en: 'Improvement', es: 'Mejora', tl: 'Pagpapabuti', vi: 'Cải Tiến', ko: '개선' },
    security: { en: 'Security', es: 'Seguridad', tl: 'Seguridad', vi: 'Bảo Mật', ko: '보안' },
    // The Vet-Rate Promise
    theVetRatePromise: { en: 'The Vet-Rate Promise', es: 'La Promesa de Vet-Rate', tl: 'Ang Pangako ng Vet-Rate', vi: 'Lời Hứa Vet-Rate', ko: 'Vet-Rate 약속' },
    promiseIntro: { en: 'I am Anthony Johnson, an instructor and developer based in Portland, OR. I built Vet-Rate because I believe you shouldn\'t need a law degree - or pay thousands to a "claim shark" - to get the benefits you earned.', es: 'Soy Anthony Johnson, instructor y desarrollador en Portland, OR. Construí Vet-Rate porque creo que no deberías necesitar un título de abogado, ni pagar miles a un "tiburón de reclamaciones" para obtener los beneficios que ganaste.', tl: 'Ako si Anthony Johnson, isang instructor at developer sa Portland, OR. Ginawa ko ang Vet-Rate dahil naniniwala ako na hindi mo kailangan ng law degree - o magbayad ng libo-libo sa "claim shark" - para makuha ang mga benepisyo na kinita mo.', vi: 'Tôi là Anthony Johnson, giảng viên và nhà phát triển tại Portland, OR. Tôi xây dựng Vet-Rate vì tôi tin rằng bạn không cần bằng luật - hay trả hàng nghìn đô cho "cá mập yêu cầu" - để nhận được quyền lợi bạn đã kiếm được.', ko: '저는 포틀랜드, OR에 있는 강사이자 개발자 Anthony Johnson입니다. 당신이 얻은 혜택을 받기 위해 법학 학위가 필요하거나 "청구 상어"에게 수천 달러를 지불할 필요가 없다고 믿기 때문에 Vet-Rate를 만들었습니다.' },
    zeroCost: { en: 'ZERO COST', es: 'COSTO CERO', tl: 'WALANG BAYAD', vi: 'MIỄN PHÍ', ko: '무료' },
    zeroCostDesc: { en: 'No subscriptions. No hidden fees. Ever.', es: 'Sin suscripciones. Sin tarifas ocultas. Nunca.', tl: 'Walang subscription. Walang nakatagong bayad. Kailanman.', vi: 'Không đăng ký. Không phí ẩn. Mãi mãi.', ko: '구독 없음. 숨겨진 수수료 없음. 영원히.' },
    hundredPercentPrivate: { en: '100% PRIVATE', es: '100% PRIVADO', tl: '100% PRIBADO', vi: '100% RIÊNG TƯ', ko: '100% 비공개' },
    privateDesc: { en: 'Your data stays on YOUR device.', es: 'Tus datos permanecen en TU dispositivo.', tl: 'Ang data mo ay nananatili sa IYONG device.', vi: 'Dữ liệu của bạn nằm trên thiết bị CỦA BẠN.', ko: '귀하의 데이터는 귀하의 장치에 남습니다.' },
    noTracking: { en: 'NO TRACKING', es: 'SIN RASTREO', tl: 'WALANG TRACKING', vi: 'KHÔNG THEO DÕI', ko: '추적 없음' },
    noTrackingDesc: { en: 'No analytics. No selling data.', es: 'Sin análisis. Sin venta de datos.', tl: 'Walang analytics. Walang pagbebenta ng data.', vi: 'Không phân tích. Không bán dữ liệu.', ko: '분석 없음. 데이터 판매 없음.' },
    localAiModels: { en: 'LOCAL AI MODELS', es: 'MODELOS IA LOCALES', tl: 'LOCAL AI MODELS', vi: 'MÔ HÌNH AI CỤC BỘ', ko: '로컬 AI 모델' },
    localAiDesc: { en: 'AI runs in YOUR browser. Offline capable.', es: 'La IA funciona en TU navegador. Funciona sin conexión.', tl: 'Ang AI ay tumatakbo sa IYONG browser. Offline capable.', vi: 'AI chạy trong trình duyệt CỦA BẠN. Có thể ngoại tuyến.', ko: 'AI가 귀하의 브라우저에서 실행됩니다. 오프라인 가능.' },
    toolToEmpower: { en: 'This is a tool to empower you to tell your own story.', es: 'Esta es una herramienta para empoderarte a contar tu propia historia.', tl: 'Ito ay isang tool para bigyang kapangyarihan ka na ikuwento ang iyong sariling kwento.', vi: 'Đây là công cụ giúp bạn kể câu chuyện của riêng mình.', ko: '이것은 당신이 자신의 이야기를 들려줄 수 있게 해주는 도구입니다.' },
    // Mission section
    missionDescription: { en: 'is the most comprehensive free VA claims toolkit available - professional-grade tools built to empower veterans with everything needed from initial research through appeals. The VA system is complex, but your path through it doesn\'t have to be.', es: 'es el kit de herramientas gratuito más completo para reclamaciones del VA - herramientas de grado profesional construidas para empoderar a los veteranos con todo lo necesario desde la investigación inicial hasta las apelaciones.', tl: 'ay ang pinaka-komprehensibong libreng VA claims toolkit - mga professional-grade tools na ginawa para bigyang kapangyarihan ang mga beterano sa lahat ng kailangan mula sa paunang pananaliksik hanggang sa mga apela.', vi: 'là bộ công cụ yêu cầu VA miễn phí toàn diện nhất - các công cụ chuyên nghiệp được xây dựng để trao quyền cho cựu chiến binh với mọi thứ cần thiết từ nghiên cứu ban đầu đến kháng cáo.', ko: '은 가장 포괄적인 무료 VA 청구 도구 키트입니다 - 초기 연구부터 항소까지 필요한 모든 것을 재향군인에게 제공하기 위해 만들어진 전문 도구입니다.' },
    // Complete Claims Arsenal
    completeClaimsArsenal: { en: 'Complete Claims Arsenal', es: 'Arsenal Completo de Reclamaciones', tl: 'Kumpletong Claims Arsenal', vi: 'Kho Vũ Khí Yêu Cầu Hoàn Chỉnh', ko: '완전한 청구 무기고' },
    professionalTools: { en: 'Professional Tools', es: 'Herramientas Profesionales', tl: 'Mga Professional Tools', vi: 'Công Cụ Chuyên Nghiệp', ko: '전문 도구' },
    arsenalDescription: { en: 'This comprehensive toolkit provides everything you need from initial research through appeals:', es: 'Este kit de herramientas integral proporciona todo lo que necesitas desde la investigación inicial hasta las apelaciones:', tl: 'Ang komprehensibong toolkit na ito ay nagbibigay ng lahat ng kailangan mo mula sa paunang pananaliksik hanggang sa mga apela:', vi: 'Bộ công cụ toàn diện này cung cấp mọi thứ bạn cần từ nghiên cứu ban đầu đến kháng cáo:', ko: '이 포괄적인 도구 키트는 초기 연구부터 항소까지 필요한 모든 것을 제공합니다:' },
    arsenalHighlight: { en: 'professional-grade tools - completely free. What claim sharks charge thousands for.', es: 'herramientas de grado profesional - completamente gratis. Lo que los tiburones de reclamaciones cobran miles.', tl: 'mga professional-grade tools - completamente libre. Ang sinisingil ng mga claim sharks ng libo-libo.', vi: 'công cụ chuyên nghiệp - hoàn toàn miễn phí. Những gì cá mập yêu cầu tính hàng nghìn đô.', ko: '전문 도구 - 완전 무료. 청구 상어가 수천 달러를 청구하는 것.' },
    tools: { en: 'tools', es: 'herramientas', tl: 'mga tool', vi: 'công cụ', ko: '도구' },
    // Data Sources
    dataSources: { en: 'Data Sources', es: 'Fuentes de Datos', tl: 'Mga Data Source', vi: 'Nguồn Dữ Liệu', ko: '데이터 소스' },
    dataSourcesIntro: { en: 'Our comprehensive knowledge base has been fully validated against the official eCFR (Electronic Code of Federal Regulations):', es: 'Nuestra base de conocimiento integral ha sido completamente validada contra el eCFR oficial (Código Electrónico de Regulaciones Federales):', tl: 'Ang aming komprehensibong knowledge base ay na-validate laban sa opisyal na eCFR (Electronic Code of Federal Regulations):', vi: 'Cơ sở kiến thức toàn diện của chúng tôi đã được xác thực đầy đủ với eCFR chính thức (Bộ Quy Tắc Liên Bang Điện Tử):', ko: '우리의 포괄적인 지식 기반은 공식 eCFR (연방 규정 전자 코드)에 대해 완전히 검증되었습니다:' },
    cfrPart3Verified: { en: '38 CFR Part 3 - Verified:', es: '38 CFR Parte 3 - Verificado:', tl: '38 CFR Part 3 - Verified:', vi: '38 CFR Phần 3 - Đã Xác Minh:', ko: '38 CFR 파트 3 - 검증됨:' },
    cfrPart3Desc: { en: 'Adjudication rules, eligibility requirements, and claims procedures cross-referenced with official VA regulations', es: 'Reglas de adjudicación, requisitos de elegibilidad y procedimientos de reclamaciones cruzados con las regulaciones oficiales del VA', tl: 'Adjudication rules, eligibility requirements, at claims procedures na cross-referenced sa opisyal na VA regulations', vi: 'Quy tắc phán quyết, yêu cầu đủ điều kiện và thủ tục yêu cầu được tham chiếu chéo với quy định chính thức của VA', ko: '판결 규칙, 자격 요건 및 청구 절차가 공식 VA 규정과 상호 참조됨' },
    cfrPart4Verified: { en: '38 CFR Part 4 - Verified:', es: '38 CFR Parte 4 - Verificado:', tl: '38 CFR Part 4 - Verified:', vi: '38 CFR Phần 4 - Đã Xác Minh:', ko: '38 CFR 파트 4 - 검증됨:' },
    cfrPart4Desc: { en: 'Every diagnostic code, rating percentage, and evaluation criteria has been cross-referenced with the official VA Schedule for Rating Disabilities', es: 'Cada código diagnóstico, porcentaje de calificación y criterios de evaluación ha sido cruzado con el Programa oficial del VA para Calificar Discapacidades', tl: 'Bawat diagnostic code, rating percentage, at evaluation criteria ay na-cross-reference sa opisyal na VA Schedule for Rating Disabilities', vi: 'Mỗi mã chẩn đoán, phần trăm đánh giá và tiêu chí đánh giá đã được tham chiếu chéo với Lịch Đánh Giá Khuyết Tật chính thức của VA', ko: '모든 진단 코드, 평가 비율 및 평가 기준이 공식 VA 장애 평가 일정과 상호 참조되었습니다' },
    vaDisabilitiesCompleteCoverage: { en: 'VA Disabilities - Complete Coverage:', es: 'Discapacidades del VA - Cobertura Completa:', tl: 'VA Disabilities - Kumpletong Coverage:', vi: 'Khuyết Tật VA - Phủ Sóng Hoàn Chỉnh:', ko: 'VA 장애 - 완전한 범위:' },
    allBodySystems: { en: 'All body systems thoroughly documented (Musculoskeletal System, Organs of Special Sense, Systemic Diseases, Respiratory System, Cardiovascular System, Digestive System, Genitourinary System, Gynecological Conditions, Hemic and Lymphatic Systems, Skin, Endocrine System, Neurological Conditions, Mental Disorders, Dental and Oral Conditions, and Infectious Diseases)', es: 'Todos los sistemas corporales documentados exhaustivamente', tl: 'Lahat ng body systems ay dokumentado', vi: 'Tất cả các hệ thống cơ thể được ghi chép đầy đủ', ko: '모든 신체 시스템이 철저히 문서화되었습니다' },
    ratingCriteriaValidated: { en: '100% Rating Criteria Validated:', es: '100% Criterios de Calificación Validados:', tl: '100% Rating Criteria Validated:', vi: '100% Tiêu Chí Đánh Giá Đã Xác Minh:', ko: '100% 평가 기준 검증됨:' },
    ratingCriteriaDesc: { en: 'All conditions include detailed percentage breakdowns verified against current 38 CFR regulations', es: 'Todas las condiciones incluyen desgloses detallados de porcentajes verificados contra las regulaciones actuales del 38 CFR', tl: 'Lahat ng conditions ay may detailed percentage breakdowns na verified laban sa kasalukuyang 38 CFR regulations', vi: 'Tất cả các tình trạng bao gồm phân tích phần trăm chi tiết được xác minh theo quy định 38 CFR hiện hành', ko: '모든 조건에는 현재 38 CFR 규정에 대해 검증된 상세한 비율 분석이 포함됩니다' },
    secondaryConditionsDatabase: { en: 'Secondary Conditions Database:', es: 'Base de Datos de Condiciones Secundarias:', tl: 'Secondary Conditions Database:', vi: 'Cơ Sở Dữ Liệu Tình Trạng Thứ Cấp:', ko: '이차 상태 데이터베이스:' },
    secondaryConditionsDesc: { en: 'Medically-recognized secondary conditions linked to primary disabilities with supporting documentation', es: 'Condiciones secundarias médicamente reconocidas vinculadas a discapacidades primarias con documentación de apoyo', tl: 'Medically-recognized secondary conditions na nakalink sa primary disabilities na may supporting documentation', vi: 'Các tình trạng thứ cấp được y tế công nhận liên kết với khuyết tật chính kèm tài liệu hỗ trợ', ko: '의학적으로 인정된 이차 상태가 지원 문서와 함께 주요 장애에 연결됨' },
    lastValidated: { en: 'Last validated:', es: 'Última validación:', tl: 'Huling na-validate:', vi: 'Xác thực lần cuối:', ko: '마지막 검증:' },
    againstEcfr: { en: 'against eCFR Title 38, Parts 3 & 4', es: 'contra el eCFR Título 38, Partes 3 y 4', tl: 'laban sa eCFR Title 38, Parts 3 at 4', vi: 'so với eCFR Tiêu đề 38, Phần 3 & 4', ko: 'eCFR Title 38, Parts 3 & 4에 대해' },
    // Why I Built This
    whyIBuiltThis: { en: 'Why I Built This', es: 'Por Qué Construí Esto', tl: 'Bakit Ko Ito Ginawa', vi: 'Tại Sao Tôi Xây Dựng Điều Này', ko: '내가 이것을 만든 이유' },
    whyIBuiltThisDesc1: { en: 'Too many veterans struggle because the VA system is scattered, technical, and predatory services charge thousands for basic help. I\'ve been there myself.', es: 'Demasiados veteranos luchan porque el sistema del VA está disperso, es técnico, y los servicios depredadores cobran miles por ayuda básica. Yo he estado ahí.', tl: 'Napakaraming beterano ang nahihirapan dahil ang VA system ay kalat, teknikal, at ang mga predatory services ay nangongolekta ng libo-libo para sa basic help. Naranasan ko ito mismo.', vi: 'Quá nhiều cựu chiến binh gặp khó khăn vì hệ thống VA rải rác, kỹ thuật, và các dịch vụ săn mồi tính hàng nghìn đô cho sự giúp đỡ cơ bản. Tôi đã ở đó.', ko: '너무 많은 재향군인들이 VA 시스템이 산만하고 기술적이며 약탈적 서비스가 기본 도움에 수천 달러를 청구하기 때문에 어려움을 겪습니다. 저도 그랬습니다.' },
    whyIBuiltThisDesc2: { en: 'No expensive consultants. No endless Google searches. No predatory "claim sharks" taking 30% of your backpay. Just the complete arsenal you need to take charge of your claim - from initial research through appeals - all in one place.', es: 'Sin consultores costosos. Sin búsquedas interminables en Google. Sin "tiburones de reclamaciones" depredadores tomando el 30% de tu pago retroactivo. Solo el arsenal completo que necesitas para tomar control de tu reclamación - desde la investigación inicial hasta las apelaciones - todo en un lugar.', tl: 'Walang mamahaling consultants. Walang walang katapusang Google searches. Walang predatory "claim sharks" na kumukuha ng 30% ng iyong backpay. Ang kumpletong arsenal lang na kailangan mo para kontrolin ang iyong claim - mula sa paunang pananaliksik hanggang sa mga apela - lahat sa isang lugar.', vi: 'Không có tư vấn đắt tiền. Không tìm kiếm Google vô tận. Không có "cá mập yêu cầu" lấy 30% tiền lương truy lĩnh của bạn. Chỉ là kho vũ khí hoàn chỉnh bạn cần để kiểm soát yêu cầu của mình - từ nghiên cứu ban đầu đến kháng cáo - tất cả trong một nơi.', ko: '비싼 컨설턴트 없음. 끝없는 구글 검색 없음. 소급금의 30%를 가져가는 약탈적 "청구 상어" 없음. 청구를 담당하는 데 필요한 완전한 무기고 - 초기 연구부터 항소까지 - 모두 한 곳에.' },
    whyIBuiltThisDesc3: { en: 'This comprehensive platform is 100% free and runs entirely in your browser - no accounts, no data collection, and no PII storage. Your searches, calculations, and documents remain private.', es: 'Esta plataforma integral es 100% gratuita y funciona completamente en tu navegador - sin cuentas, sin recopilación de datos, y sin almacenamiento de PII. Tus búsquedas, cálculos y documentos permanecen privados.', tl: 'Ang komprehensibong platform na ito ay 100% libre at tumatakbo sa iyong browser - walang accounts, walang data collection, at walang PII storage. Ang iyong mga searches, calculations, at documents ay nananatiling pribado.', vi: 'Nền tảng toàn diện này hoàn toàn miễn phí và chạy hoàn toàn trong trình duyệt của bạn - không có tài khoản, không thu thập dữ liệu và không lưu trữ PII. Các tìm kiếm, tính toán và tài liệu của bạn vẫn riêng tư.', ko: '이 포괄적인 플랫폼은 100% 무료이며 브라우저에서 완전히 실행됩니다 - 계정 없음, 데이터 수집 없음, PII 저장 없음. 검색, 계산 및 문서는 비공개로 유지됩니다.' },
    // Who I Am
    whoIAm: { en: 'Who I Am', es: 'Quién Soy', tl: 'Sino Ako', vi: 'Tôi Là Ai', ko: '나는 누구인가' },
    whoIAmDesc1: { en: 'Vet-Rate.org is an independent educational resource created by a fellow service-disabled veteran passionate about helping other veterans navigate the VA disability system. This is not an official VA website, law firm, or medical service. I am simply providing a tool that makes publicly available information easier to access and understand.', es: 'Vet-Rate.org es un recurso educativo independiente creado por un compañero veterano discapacitado apasionado por ayudar a otros veteranos a navegar el sistema de discapacidad del VA. Este no es un sitio web oficial del VA, bufete de abogados o servicio médico.', tl: 'Ang Vet-Rate.org ay isang independiyenteng educational resource na ginawa ng isang kapwa service-disabled veteran na masigasig sa pagtulong sa ibang mga beterano na i-navigate ang VA disability system. Hindi ito opisyal na VA website, law firm, o medical service.', vi: 'Vet-Rate.org là nguồn tài liệu giáo dục độc lập được tạo bởi một cựu chiến binh khuyết tật đam mê giúp đỡ các cựu chiến binh khác điều hướng hệ thống khuyết tật VA. Đây không phải là trang web VA chính thức, công ty luật hoặc dịch vụ y tế.', ko: 'Vet-Rate.org는 다른 재향군인들이 VA 장애 시스템을 탐색하도록 돕는 것에 열정적인 동료 서비스 장애 재향군인이 만든 독립적인 교육 자원입니다. 이것은 공식 VA 웹사이트, 법률 회사 또는 의료 서비스가 아닙니다.' },
    whoIAmDesc2: { en: 'As a veteran who has navigated the VA system myself, I understand the frustration of trying to decode complex regulations and figure out what benefits you\'re entitled to. That\'s why I built this tool - to make the process clearer for all of us who served.', es: 'Como veterano que ha navegado el sistema del VA, entiendo la frustración de tratar de decodificar regulaciones complejas y descubrir a qué beneficios tienes derecho. Por eso construí esta herramienta - para hacer el proceso más claro para todos los que servimos.', tl: 'Bilang isang beterano na nag-navigate sa VA system, naiintindihan ko ang frustration ng pagtatangkang mag-decode ng mga komplikadong regulasyon at alamin kung anong mga benepisyo ang karapatan mo. Kaya ko ginawa ang tool na ito - para gawing mas malinaw ang proseso para sa lahat ng nagsilbi.', vi: 'Là một cựu chiến binh đã điều hướng hệ thống VA, tôi hiểu sự thất vọng khi cố giải mã các quy định phức tạp và tìm hiểu quyền lợi bạn được hưởng. Đó là lý do tôi xây dựng công cụ này - để làm cho quá trình rõ ràng hơn cho tất cả chúng ta đã phục vụ.', ko: 'VA 시스템을 탐색한 재향군인으로서, 복잡한 규정을 해독하고 어떤 혜택을 받을 자격이 있는지 알아내려는 좌절감을 이해합니다. 그래서 이 도구를 만들었습니다 - 우리 모두 복무한 사람들을 위해 과정을 더 명확하게 하기 위해.' },
    // Development Team
    developmentTeam: { en: 'The Development Team', es: 'El Equipo de Desarrollo', tl: 'Ang Development Team', vi: 'Đội Ngũ Phát Triển', ko: '개발팀' },
    developmentTeamIntro: { en: 'Behind every late-night coding session is a dedicated team:', es: 'Detrás de cada sesión de programación nocturna hay un equipo dedicado:', tl: 'Sa likod ng bawat late-night coding session ay isang dedikadong team:', vi: 'Đằng sau mỗi phiên viết mã đêm khuya là một đội ngũ tận tâm:', ko: '매일 밤늦은 코딩 세션 뒤에는 헌신적인 팀이 있습니다:' },
    chiefMoraleOfficer: { en: 'Chief Morale Officer & Keyboard Supervisor', es: 'Oficial Jefe de Moral y Supervisor de Teclado', tl: 'Chief Morale Officer at Keyboard Supervisor', vi: 'Giám Đốc Tinh Thần & Giám Sát Bàn Phím', ko: '최고 사기 책임자 & 키보드 감독관' },
    lunaDescription: { en: 'Specializes in walking across the keyboard at critical moments and demanding attention during important debugging sessions.', es: 'Se especializa en caminar sobre el teclado en momentos críticos y exigir atención durante sesiones de depuración importantes.', tl: 'Espesyalista sa paglakad sa keyboard sa mga kritikal na sandali at paghingi ng atensyon sa mga importanteng debugging sessions.', vi: 'Chuyên đi ngang bàn phím vào những thời điểm quan trọng và đòi hỏi sự chú ý trong các phiên gỡ lỗi quan trọng.', ko: '중요한 순간에 키보드를 가로질러 걷고 중요한 디버깅 세션 중에 관심을 요구하는 것을 전문으로 합니다.' },
    viewGallery: { en: 'View Gallery', es: 'Ver Galería', tl: 'Tingnan ang Gallery', vi: 'Xem Thư Viện', ko: '갤러리 보기' },
    theWorkstation: { en: 'The Workstation', es: 'La Estación de Trabajo', tl: 'Ang Workstation', vi: 'Trạm Làm Việc', ko: '워크스테이션' },
    midnightDescription: { en: 'The tireless machine that brought Vet-Rate.org to life. Running countless builds, tests, and deployments without complaint (mostly).', es: 'La máquina incansable que dio vida a Vet-Rate.org. Ejecutando innumerables compilaciones, pruebas y despliegues sin quejas (mayormente).', tl: 'Ang walang pagod na machine na nagbigay buhay sa Vet-Rate.org. Nagpapatakbo ng walang bilang na builds, tests, at deployments nang walang reklamo (halos).', vi: 'Cỗ máy không mệt mỏi đã mang Vet-Rate.org đến cuộc sống. Chạy vô số bản dựng, kiểm tra và triển khai mà không phàn nàn (hầu hết).', ko: 'Vet-Rate.org를 생명으로 가져온 지칠 줄 모르는 기계. 불평 없이 (대부분) 수많은 빌드, 테스트 및 배포를 실행합니다.' },
    viewSpecs: { en: 'View Specs', es: 'Ver Especificaciones', tl: 'Tingnan ang Specs', vi: 'Xem Thông Số', ko: '사양 보기' },
    theCodebase: { en: 'The Codebase', es: 'El Código', tl: 'Ang Codebase', vi: 'Mã Nguồn', ko: '코드베이스' },
    builtWithLove: { en: 'Built with', es: 'Hecho con', tl: 'Ginawa nang may', vi: 'Được xây dựng với', ko: '사랑으로 제작' },
    codebaseDescription: { en: 'A labor of love, countless hours, and a whole lot of caffeine. Here\'s what powers Vet-Rate.org under the hood.', es: 'Un trabajo de amor, incontables horas, y mucha cafeína. Esto es lo que impulsa Vet-Rate.org bajo el capó.', tl: 'Isang labor of love, walang bilang na oras, at maraming caffeine. Ito ang nagpapatakbo sa Vet-Rate.org sa ilalim ng hood.', vi: 'Một công việc của tình yêu, vô số giờ, và rất nhiều caffeine. Đây là những gì cung cấp năng lượng cho Vet-Rate.org bên trong.', ko: '사랑의 노동, 셀 수 없는 시간, 그리고 많은 카페인. Vet-Rate.org를 내부에서 구동하는 것입니다.' },
    viewCodebaseStats: { en: 'View Codebase Stats', es: 'Ver Estadísticas del Código', tl: 'Tingnan ang Codebase Stats', vi: 'Xem Thống Kê Mã Nguồn', ko: '코드베이스 통계 보기' },
    // How This Was Built
    howThisWasBuilt: { en: 'How This Was Built', es: 'Cómo Se Construyó Esto', tl: 'Paano Ito Ginawa', vi: 'Cách Này Được Xây Dựng', ko: '이것이 어떻게 만들어졌는가' },
    howBuiltIntro: { en: 'Vet-Rate.org was developed using modern tools and AI-assisted development:', es: 'Vet-Rate.org fue desarrollado usando herramientas modernas y desarrollo asistido por IA:', tl: 'Ang Vet-Rate.org ay ginawa gamit ang mga modernong tools at AI-assisted development:', vi: 'Vet-Rate.org được phát triển bằng các công cụ hiện đại và phát triển hỗ trợ AI:', ko: 'Vet-Rate.org는 현대적인 도구와 AI 지원 개발을 사용하여 개발되었습니다:' },
    dataSource: { en: 'Data Source:', es: 'Fuente de Datos:', tl: 'Data Source:', vi: 'Nguồn Dữ Liệu:', ko: '데이터 소스:' },
    dataSourceDesc: { en: 'All disability information was meticulously extracted and structured from the official eCFR (Electronic Code of Federal Regulations)', es: 'Toda la información de discapacidad fue extraída y estructurada meticulosamente del eCFR oficial', tl: 'Lahat ng disability information ay maingat na na-extract at na-structure mula sa opisyal na eCFR', vi: 'Tất cả thông tin khuyết tật được trích xuất và cấu trúc tỉ mỉ từ eCFR chính thức', ko: '모든 장애 정보는 공식 eCFR에서 꼼꼼하게 추출하고 구조화했습니다' },
    developmentEnvironment: { en: 'Development Environment:', es: 'Entorno de Desarrollo:', tl: 'Development Environment:', vi: 'Môi Trường Phát Triển:', ko: '개발 환경:' },
    aiAssistedDevelopment: { en: 'AI-Assisted Development:', es: 'Desarrollo Asistido por IA:', tl: 'AI-Assisted Development:', vi: 'Phát Triển Hỗ Trợ AI:', ko: 'AI 지원 개발:' },
    modernStack: { en: 'Modern Stack:', es: 'Stack Moderno:', tl: 'Modern Stack:', vi: 'Stack Hiện Đại:', ko: '현대 스택:' },
    aiDevelopmentNote: { en: 'AI-assisted development allowed a single veteran to build a comprehensive tool that would have otherwise required a full development team. The future is now!', es: 'El desarrollo asistido por IA permitió a un solo veterano construir una herramienta integral que de otro modo habría requerido un equipo de desarrollo completo. ¡El futuro es ahora!', tl: 'Ang AI-assisted development ay nagpahintulot sa isang beterano na gumawa ng komprehensibong tool na kung hindi ay mangangailangan ng buong development team. Ang kinabukasan ay ngayon!', vi: 'Phát triển hỗ trợ AI cho phép một cựu chiến binh xây dựng một công cụ toàn diện mà nếu không sẽ cần một đội phát triển đầy đủ. Tương lai là bây giờ!', ko: 'AI 지원 개발을 통해 한 명의 재향군인이 전체 개발팀이 필요했을 포괄적인 도구를 구축할 수 있었습니다. 미래는 지금입니다!' },
    // Important Disclaimers
    importantDisclaimers: { en: 'Important Disclaimers', es: 'Descargos de Responsabilidad Importantes', tl: 'Mga Mahalagang Disclaimer', vi: 'Tuyên Bố Từ Chối Quan Trọng', ko: '중요한 면책 조항' },
    notLegalOrMedicalAdvice: { en: 'Not Legal or Medical Advice:', es: 'No es Asesoría Legal o Médica:', tl: 'Hindi Legal o Medical Advice:', vi: 'Không Phải Tư Vấn Pháp Lý hoặc Y Tế:', ko: '법률 또는 의료 조언이 아님:' },
    notLegalOrMedicalAdviceDesc: { en: 'This tool provides educational information only. It does not constitute legal or medical advice. Always consult with qualified professionals for guidance specific to your situation.', es: 'Esta herramienta proporciona solo información educativa. No constituye asesoría legal o médica. Siempre consulta con profesionales calificados para orientación específica a tu situación.', tl: 'Ang tool na ito ay nagbibigay ng educational information lamang. Hindi ito legal o medical advice. Palaging kumonsulta sa mga qualified professionals para sa guidance na specific sa iyong sitwasyon.', vi: 'Công cụ này chỉ cung cấp thông tin giáo dục. Nó không cấu thành tư vấn pháp lý hoặc y tế. Luôn tham khảo ý kiến chuyên gia có trình độ để được hướng dẫn cụ thể cho tình huống của bạn.', ko: '이 도구는 교육 정보만 제공합니다. 법률 또는 의료 조언을 구성하지 않습니다. 귀하의 상황에 맞는 지침을 위해 항상 자격을 갖춘 전문가와 상담하세요.' },
    notAffiliatedWithVA: { en: 'Not Affiliated with the VA:', es: 'No Afiliado con el VA:', tl: 'Hindi Kaanib ng VA:', vi: 'Không Liên Kết với VA:', ko: 'VA와 제휴되지 않음:' },
    notAffiliatedWithVADesc: { en: 'Vet-Rate.org is an independent resource and is not endorsed by, affiliated with, or approved by the U.S. Department of Veterans Affairs.', es: 'Vet-Rate.org es un recurso independiente y no está respaldado, afiliado ni aprobado por el Departamento de Asuntos de Veteranos de EE.UU.', tl: 'Ang Vet-Rate.org ay isang independiyenteng resource at hindi endorsed, affiliated, o approved ng U.S. Department of Veterans Affairs.', vi: 'Vet-Rate.org là nguồn tài liệu độc lập và không được xác nhận, liên kết hoặc phê duyệt bởi Bộ Cựu Chiến Binh Hoa Kỳ.', ko: 'Vet-Rate.org는 독립적인 자원이며 미국 재향군인부에서 승인, 제휴 또는 보증하지 않습니다.' },
    // How This Project Is Funded
    howProjectFunded: { en: 'How This Project Is Funded', es: 'Cómo Se Financia Este Proyecto', tl: 'Paano Pinopondohan ang Project na Ito', vi: 'Dự Án Này Được Tài Trợ Như Thế Nào', ko: '이 프로젝트의 자금 조달 방법' },
    fundingIntro: { en: 'Building and maintaining professional-grade tools with hosting costs, AI capabilities, and continuous development requires resources. To keep this comprehensive platform free for all veterans, this project relies entirely on voluntary support from the veteran community:', es: 'Construir y mantener herramientas de grado profesional con costos de hosting, capacidades de IA y desarrollo continuo requiere recursos. Para mantener esta plataforma integral gratuita para todos los veteranos, este proyecto depende completamente del apoyo voluntario de la comunidad de veteranos:', tl: 'Ang pagbuo at pagpapanatili ng mga professional-grade tools na may hosting costs, AI capabilities, at patuloy na development ay nangangailangan ng resources. Para mapanatiling libre ang komprehensibong platform na ito para sa lahat ng beterano, ang project na ito ay ganap na umaasa sa voluntary support mula sa veteran community:', vi: 'Xây dựng và duy trì các công cụ chuyên nghiệp với chi phí lưu trữ, khả năng AI và phát triển liên tục đòi hỏi nguồn lực. Để giữ nền tảng toàn diện này miễn phí cho tất cả cựu chiến binh, dự án này hoàn toàn dựa vào sự hỗ trợ tự nguyện từ cộng đồng cựu chiến binh:', ko: '호스팅 비용, AI 기능 및 지속적인 개발을 통해 전문 도구를 구축하고 유지하려면 리소스가 필요합니다. 이 포괄적인 플랫폼을 모든 재향군인에게 무료로 유지하기 위해 이 프로젝트는 전적으로 재향군인 커뮤니티의 자발적인 지원에 의존합니다:' },
    buyMeACoffee: { en: 'Buy Me a Coffee', es: 'Invítame un Café', tl: 'Bilhan Mo Ako ng Kape', vi: 'Mua Cho Tôi Một Cốc Cà Phê', ko: '커피 한 잔 사주기' },
    supportHelpsKeepFree: { en: 'Your support helps keep this tool free and accessible for all veterans. We intentionally avoid using advertising networks to protect veteran privacy - no third-party trackers, no data collection.', es: 'Tu apoyo ayuda a mantener esta herramienta gratuita y accesible para todos los veteranos. Evitamos intencionalmente usar redes de publicidad para proteger la privacidad de los veteranos - sin rastreadores de terceros, sin recopilación de datos.', tl: 'Ang iyong suporta ay nakakatulong na mapanatiling libre at accessible ang tool na ito para sa lahat ng beterano. Sinadya naming iwasan ang paggamit ng advertising networks para protektahan ang privacy ng mga beterano - walang third-party trackers, walang data collection.', vi: 'Sự hỗ trợ của bạn giúp giữ công cụ này miễn phí và có thể truy cập cho tất cả cựu chiến binh. Chúng tôi cố ý tránh sử dụng mạng quảng cáo để bảo vệ quyền riêng tư của cựu chiến binh - không có trình theo dõi bên thứ ba, không thu thập dữ liệu.', ko: '귀하의 지원은 이 도구를 모든 재향군인에게 무료로 접근 가능하게 유지하는 데 도움이 됩니다. 재향군인 개인 정보를 보호하기 위해 의도적으로 광고 네트워크 사용을 피합니다 - 제3자 추적기 없음, 데이터 수집 없음.' },
    allContributionsGo: { en: '100% of contributions go toward hosting, development, and keeping Vet-Rate.org running for the veteran community.', es: 'El 100% de las contribuciones van hacia hosting, desarrollo y mantener Vet-Rate.org funcionando para la comunidad de veteranos.', tl: '100% ng mga kontribusyon ay napupunta sa hosting, development, at pagpapanatili ng Vet-Rate.org na tumatakbo para sa veteran community.', vi: '100% đóng góp dành cho lưu trữ, phát triển và duy trì Vet-Rate.org hoạt động cho cộng đồng cựu chiến binh.', ko: '기부금의 100%는 호스팅, 개발 및 재향군인 커뮤니티를 위해 Vet-Rate.org를 운영하는 데 사용됩니다.' },
    // My Commitment to Veterans
    myCommitmentToVeterans: { en: 'My Commitment to Veterans', es: 'Mi Compromiso con los Veteranos', tl: 'Ang Aking Pangako sa mga Beterano', vi: 'Cam Kết Của Tôi Với Cựu Chiến Binh', ko: '재향군인에 대한 나의 약속' },
    commitmentIntro: { en: 'I am committed to:', es: 'Me comprometo a:', tl: 'Ako ay nakatalaga sa:', vi: 'Tôi cam kết:', ko: '나는 다음을 약속합니다:' },
    commitment1: { en: 'Keeping all professional tools 100% free forever - no paywalls, ever', es: 'Mantener todas las herramientas profesionales 100% gratis para siempre - sin muros de pago, nunca', tl: 'Panatilihing lahat ng professional tools ay 100% libre magpakailanman - walang paywalls, kailanman', vi: 'Giữ tất cả các công cụ chuyên nghiệp miễn phí 100% mãi mãi - không có tường phí, mãi mãi', ko: '모든 전문 도구를 영원히 100% 무료로 유지 - 페이월 없음, 영원히' },
    commitment2: { en: 'Protecting your privacy - no ads, no tracking, no data collection, no claim sharks', es: 'Proteger tu privacidad - sin anuncios, sin seguimiento, sin recopilación de datos, sin tiburones de reclamaciones', tl: 'Protektahan ang iyong privacy - walang ads, walang tracking, walang data collection, walang claim sharks', vi: 'Bảo vệ quyền riêng tư của bạn - không quảng cáo, không theo dõi, không thu thập dữ liệu, không cá mập yêu cầu', ko: '귀하의 개인 정보 보호 - 광고 없음, 추적 없음, 데이터 수집 없음, 청구 상어 없음' },
    commitment3: { en: 'Providing accurate, up-to-date information from official 38 CFR sources', es: 'Proporcionar información precisa y actualizada de fuentes oficiales del 38 CFR', tl: 'Magbigay ng tama at napapanahong impormasyon mula sa opisyal na 38 CFR sources', vi: 'Cung cấp thông tin chính xác, cập nhật từ các nguồn 38 CFR chính thức', ko: '공식 38 CFR 소스에서 정확하고 최신 정보 제공' },
    commitment4: { en: 'Continuously adding new tools and improving features based on veteran feedback', es: 'Agregar continuamente nuevas herramientas y mejorar funciones basadas en comentarios de veteranos', tl: 'Patuloy na magdagdag ng mga bagong tools at pagbutihin ang mga features batay sa feedback ng mga beterano', vi: 'Liên tục thêm công cụ mới và cải thiện tính năng dựa trên phản hồi của cựu chiến binh', ko: '재향군인 피드백을 기반으로 새로운 도구 추가 및 기능 개선 지속' },
    commitment5: { en: 'Maintaining transparency - open about AI use, data handling, and limitations', es: 'Mantener transparencia - abierto sobre el uso de IA, manejo de datos y limitaciones', tl: 'Mapanatili ang transparency - bukas tungkol sa AI use, data handling, at limitations', vi: 'Duy trì tính minh bạch - cởi mở về việc sử dụng AI, xử lý dữ liệu và hạn chế', ko: '투명성 유지 - AI 사용, 데이터 처리 및 제한에 대해 공개' },
    // Thank You
    thankYouForService: { en: 'Thank You for Your Service', es: 'Gracias por Tu Servicio', tl: 'Salamat sa Iyong Serbisyo', vi: 'Cảm Ơn Sự Phục Vụ Của Bạn', ko: '복무해 주셔서 감사합니다' },
    thankYouMessage: { en: 'Every veteran who navigates their claim successfully with these tools - instead of paying thousands to predatory services - is a victory. I\'m honored to serve my fellow veterans by making this comprehensive professional arsenal freely available to all who served.', es: 'Cada veterano que navega su reclamación exitosamente con estas herramientas - en lugar de pagar miles a servicios depredadores - es una victoria. Me siento honrado de servir a mis compañeros veteranos haciendo este arsenal profesional integral disponible gratuitamente para todos los que sirvieron.', tl: 'Bawat beterano na matagumpay na nag-navigate ng kanilang claim gamit ang mga tools na ito - sa halip na magbayad ng libo-libo sa mga predatory services - ay isang tagumpay. Ako ay napaparangalan na maglingkod sa aking kapwa mga beterano sa pamamagitan ng paggawa ng komprehensibong professional arsenal na ito na libreng available para sa lahat ng nagsilbi.', vi: 'Mỗi cựu chiến binh điều hướng yêu cầu thành công với các công cụ này - thay vì trả hàng nghìn cho các dịch vụ săn mồi - là một chiến thắng. Tôi vinh dự được phục vụ đồng đội cựu chiến binh bằng cách cung cấp miễn phí kho vũ khí chuyên nghiệp toàn diện này cho tất cả những người đã phục vụ.', ko: '수천 달러를 약탈적 서비스에 지불하는 대신 이러한 도구로 청구를 성공적으로 탐색하는 모든 재향군인은 승리입니다. 이 포괄적인 전문 무기고를 복무한 모든 사람에게 무료로 제공함으로써 동료 재향군인을 섬기게 되어 영광입니다.' },
    builtWithLoveForVeterans: { en: 'Built with ❤️ for Veterans', es: 'Hecho con ❤️ para Veteranos', tl: 'Ginawa nang may ❤️ para sa mga Beterano', vi: 'Được xây dựng với ❤️ cho Cựu Chiến Binh', ko: '재향군인을 위해 ❤️로 제작' },
    contactPageLink: { en: 'Have suggestions, found an error, or want to say thanks? I\'d love to hear from you! Visit the Contact page to get in touch.', es: '¿Tienes sugerencias, encontraste un error, o quieres dar las gracias? ¡Me encantaría saber de ti! Visita la página de Contacto para comunicarte.', tl: 'May mga suhestyon, nakakita ng error, o gustong magpasalamat? Gusto kong marinig ka! Bisitahin ang Contact page para makipag-ugnay.', vi: 'Có đề xuất, tìm thấy lỗi, hoặc muốn cảm ơn? Tôi rất muốn nghe từ bạn! Truy cập trang Liên hệ để liên lạc.', ko: '제안이 있거나, 오류를 발견했거나, 감사를 표하고 싶으신가요? 여러분의 의견을 듣고 싶습니다! 연락처 페이지를 방문하여 연락하세요.' },
    dismissed: { en: 'Dismissed', es: 'Despedido', tl: 'Dismissed', vi: 'Giải Tán', ko: '해산' },
    zonkMessage: { en: 'ZONK! You\'re dismissed! Get outta here!', es: '¡ZONK! ¡Estás despedido! ¡Vete de aquí!', tl: 'ZONK! Dismissed ka! Alis dito!', vi: 'ZONK! Bạn được giải tán! Ra khỏi đây!', ko: 'ZONK! 해산입니다! 여기서 나가세요!' },
    zonkThanks: { en: 'Just kidding, thanks for using Vet-Rate!', es: '¡Es broma, gracias por usar Vet-Rate!', tl: 'Joke lang, salamat sa paggamit ng Vet-Rate!', vi: 'Chỉ đùa thôi, cảm ơn bạn đã sử dụng Vet-Rate!', ko: '농담이에요, Vet-Rate를 사용해 주셔서 감사합니다!' },
  },

  // VA Resources Hub - Full Component Translations
  vaResources: {
    // Header
    title: { en: 'VA Resources Hub', es: 'Centro de Recursos del VA', tl: 'VA Resources Hub', vi: 'Trung Tâm Tài Nguyên VA', ko: 'VA 자료 허브' },
    subtitle: { en: 'Official VA programs, benefits, and support for Veterans', es: 'Programas, beneficios y apoyo oficial del VA para Veteranos', tl: 'Opisyal na VA programs, benefits, at suporta para sa mga Beterano', vi: 'Chương trình, quyền lợi và hỗ trợ chính thức của VA cho Cựu Chiến Binh', ko: '재향군인을 위한 공식 VA 프로그램, 혜택 및 지원' },
    closeVaResources: { en: 'Close VA Resources', es: 'Cerrar Recursos del VA', tl: 'Isara ang VA Resources', vi: 'Đóng Tài Nguyên VA', ko: 'VA 자료 닫기' },
    
    // Crisis Banner
    veteransCrisisLine: { en: 'Veterans Crisis Line:', es: 'Línea de Crisis para Veteranos:', tl: 'Veterans Crisis Line:', vi: 'Đường Dây Khủng Hoảng Cựu Chiến Binh:', ko: '재향군인 위기 상담 전화:' },
    dialPress1: { en: 'Dial 988, Press 1', es: 'Marca 988, Presiona 1', tl: 'I-dial ang 988, Pindutin ang 1', vi: 'Gọi 988, Nhấn 1', ko: '988로 전화, 1번 누르기' },
    text838255: { en: 'Text 838255', es: 'Mensaje de texto 838255', tl: 'Text 838255', vi: 'Nhắn 838255', ko: '문자 838255' },
    chatOnline247: { en: 'Chat Online 24/7', es: 'Chat en Línea 24/7', tl: 'Chat Online 24/7', vi: 'Chat Trực Tuyến 24/7', ko: '24시간 온라인 채팅' },
    
    // PACT Act Banner
    pactActTitle: { en: 'PACT Act: Largest VA Health Care Expansion in History', es: 'Ley PACT: La Mayor Expansión de Atención Médica del VA en la Historia', tl: 'PACT Act: Pinakamalaking VA Health Care Expansion sa Kasaysayan', vi: 'Đạo Luật PACT: Mở Rộng Chăm Sóc Sức Khỏe VA Lớn Nhất Trong Lịch Sử', ko: 'PACT 법: 역사상 가장 큰 VA 의료 확장' },
    pactActDescription: { en: 'If you served in Vietnam, the Gulf War, Iraq, Afghanistan, or any combat zone after 9/11, you may now be eligible for VA health care and benefits - even if you were denied before.', es: 'Si sirvió en Vietnam, la Guerra del Golfo, Irak, Afganistán o cualquier zona de combate después del 11 de septiembre, ahora puede ser elegible para atención médica y beneficios del VA, incluso si fue rechazado antes.', tl: 'Kung nagserbisyo ka sa Vietnam, Gulf War, Iraq, Afghanistan, o anumang combat zone pagkatapos ng 9/11, maaari ka na ngayong maging eligible para sa VA health care at benefits - kahit na tinanggihan ka dati.', vi: 'Nếu bạn phục vụ tại Việt Nam, Chiến tranh Vùng Vịnh, Iraq, Afghanistan, hoặc bất kỳ vùng chiến đấu nào sau 11/9, bạn có thể đủ điều kiện nhận chăm sóc sức khỏe và quyền lợi VA - ngay cả khi bạn đã bị từ chối trước đây.', ko: '베트남, 걸프전, 이라크, 아프가니스탄 또는 9/11 이후 전투 지역에서 복무했다면 이전에 거부당했더라도 VA 의료 및 혜택을 받을 자격이 있을 수 있습니다.' },
    learnAboutPactAct: { en: 'Learn About PACT Act', es: 'Conoce la Ley PACT', tl: 'Alamin ang PACT Act', vi: 'Tìm Hiểu Về Đạo Luật PACT', ko: 'PACT 법 알아보기' },
    fileClaimNow: { en: 'File a Claim Now', es: 'Presenta una Reclamación Ahora', tl: 'Mag-file ng Claim Ngayon', vi: 'Nộp Yêu Cầu Ngay', ko: '지금 청구 제출' },
    
    // Category Titles
    pactActToxicExposure: { en: 'PACT Act & Toxic Exposure Benefits', es: 'Ley PACT y Beneficios por Exposición Tóxica', tl: 'PACT Act at Toxic Exposure Benefits', vi: 'Đạo Luật PACT & Quyền Lợi Phơi Nhiễm Độc Hại', ko: 'PACT 법 & 독성 노출 혜택' },
    pactActCategoryDesc: { en: 'The largest expansion of VA health care and benefits in history', es: 'La mayor expansión de atención médica y beneficios del VA en la historia', tl: 'Ang pinakamalaking expansion ng VA health care at benefits sa kasaysayan', vi: 'Mở rộng lớn nhất về chăm sóc sức khỏe và quyền lợi VA trong lịch sử', ko: '역사상 가장 큰 VA 의료 및 혜택 확장' },
    
    militaryExposures: { en: 'Military Environmental Exposures', es: 'Exposiciones Ambientales Militares', tl: 'Military Environmental Exposures', vi: 'Phơi Nhiễm Môi Trường Quân Sự', ko: '군사 환경 노출' },
    militaryExposuresDesc: { en: 'Information about toxic exposures and health assessments', es: 'Información sobre exposiciones tóxicas y evaluaciones de salud', tl: 'Impormasyon tungkol sa toxic exposures at health assessments', vi: 'Thông tin về phơi nhiễm độc hại và đánh giá sức khỏe', ko: '독성 노출 및 건강 평가 정보' },
    
    mentalHealthPTSD: { en: 'Mental Health & PTSD', es: 'Salud Mental y TEPT', tl: 'Mental Health at PTSD', vi: 'Sức Khỏe Tâm Thần & PTSD', ko: '정신 건강 & PTSD' },
    mentalHealthDesc: { en: '24/7 crisis support and comprehensive mental health services', es: 'Apoyo de crisis 24/7 y servicios integrales de salud mental', tl: '24/7 crisis support at comprehensive mental health services', vi: 'Hỗ trợ khủng hoảng 24/7 và dịch vụ sức khỏe tâm thần toàn diện', ko: '24/7 위기 지원 및 종합 정신 건강 서비스' },
    
    specializedPrograms: { en: 'Specialized Veteran Programs', es: 'Programas Especializados para Veteranos', tl: 'Specialized Veteran Programs', vi: 'Chương Trình Cựu Chiến Binh Chuyên Biệt', ko: '전문 재향군인 프로그램' },
    specializedProgramsDesc: { en: 'Programs for specific veteran populations and needs', es: 'Programas para poblaciones y necesidades específicas de veteranos', tl: 'Programs para sa specific na veteran populations at needs', vi: 'Chương trình cho các nhóm cựu chiến binh và nhu cầu cụ thể', ko: '특정 재향군인 집단 및 요구에 맞는 프로그램' },
    
    healthCareEligibility: { en: 'Health Care & Eligibility', es: 'Atención Médica y Elegibilidad', tl: 'Health Care at Eligibility', vi: 'Chăm Sóc Sức Khỏe & Điều Kiện', ko: '의료 & 자격' },
    healthCareDesc: { en: 'Apply for VA health care and understand eligibility', es: 'Solicite atención médica del VA y comprenda la elegibilidad', tl: 'Mag-apply para sa VA health care at unawain ang eligibility', vi: 'Đăng ký chăm sóc sức khỏe VA và hiểu điều kiện đủ tiêu chuẩn', ko: 'VA 의료 신청 및 자격 이해' },
    
    benefitsSupport: { en: 'Benefits & Support', es: 'Beneficios y Apoyo', tl: 'Benefits at Support', vi: 'Quyền Lợi & Hỗ Trợ', ko: '혜택 & 지원' },
    benefitsSupportDesc: { en: 'Disability compensation, education, housing, and more', es: 'Compensación por discapacidad, educación, vivienda y más', tl: 'Disability compensation, education, housing, at higit pa', vi: 'Bồi thường khuyết tật, giáo dục, nhà ở và hơn thế nữa', ko: '장애 보상, 교육, 주택 등' },
    
    regulationsRights: { en: '38 CFR Part 3 - Your Rights & The Rules', es: '38 CFR Parte 3 - Tus Derechos y Las Reglas', tl: '38 CFR Part 3 - Ang Iyong Mga Karapatan at Mga Patakaran', vi: '38 CFR Phần 3 - Quyền Của Bạn & Các Quy Tắc', ko: '38 CFR 파트 3 - 당신의 권리 & 규정' },
    regulationsDesc: { en: 'Know the regulations VA must follow when deciding your claim', es: 'Conozca las regulaciones que el VA debe seguir al decidir su reclamación', tl: 'Alamin ang mga regulasyon na dapat sundin ng VA kapag nagpapasya sa iyong claim', vi: 'Biết các quy định VA phải tuân theo khi quyết định yêu cầu của bạn', ko: '청구 결정 시 VA가 따라야 하는 규정 알아보기' },
    
    // Key Information
    keyInformation: { en: 'Key Information:', es: 'Información Clave:', tl: 'Mahalagang Impormasyon:', vi: 'Thông Tin Quan Trọng:', ko: '핵심 정보:' },
    
    // PACT Act Key Info
    pactKeyInfo1: { en: 'Adds 20+ presumptive conditions for burn pits, Agent Orange, and toxic exposures', es: 'Agrega más de 20 condiciones presuntivas para fosas de quema, Agente Naranja y exposiciones tóxicas', tl: 'Nagdadagdag ng 20+ presumptive conditions para sa burn pits, Agent Orange, at toxic exposures', vi: 'Thêm hơn 20 tình trạng được suy đoán cho hố đốt, Agent Orange và phơi nhiễm độc hại', ko: '소각 구덩이, 에이전트 오렌지 및 독성 노출에 대한 20개 이상의 추정 조건 추가' },
    pactKeyInfo2: { en: 'Expands eligibility for Vietnam, Gulf War, and post-9/11 Veterans', es: 'Amplía la elegibilidad para Veteranos de Vietnam, Guerra del Golfo y posteriores al 11 de septiembre', tl: 'Pinapalawak ang eligibility para sa Vietnam, Gulf War, at post-9/11 Veterans', vi: 'Mở rộng điều kiện cho Cựu Chiến Binh Việt Nam, Chiến tranh Vùng Vịnh và sau 11/9', ko: '베트남, 걸프전 및 9/11 이후 재향군인 자격 확대' },
    pactKeyInfo3: { en: 'No need to prove service connection for presumptive conditions', es: 'No es necesario probar conexión de servicio para condiciones presuntivas', tl: 'Hindi kailangang patunayan ang service connection para sa presumptive conditions', vi: 'Không cần chứng minh kết nối phục vụ cho các tình trạng được suy đoán', ko: '추정 조건에 대한 복무 연결 증명 불필요' },
    pactKeyInfo4: { en: 'Free toxic exposure screening for all enrolled Veterans', es: 'Evaluación gratuita de exposición tóxica para todos los Veteranos inscritos', tl: 'Libreng toxic exposure screening para sa lahat ng enrolled Veterans', vi: 'Sàng lọc phơi nhiễm độc hại miễn phí cho tất cả Cựu Chiến Binh đã đăng ký', ko: '등록된 모든 재향군인을 위한 무료 독성 노출 검사' },
    
    // Exposures Key Info
    exposuresKeyInfo1: { en: 'Toxic Exposure Screening (TES) every 5 years for enrolled Veterans', es: 'Evaluación de Exposición Tóxica (TES) cada 5 años para Veteranos inscritos', tl: 'Toxic Exposure Screening (TES) bawat 5 taon para sa enrolled Veterans', vi: 'Sàng lọc Phơi nhiễm Độc hại (TES) mỗi 5 năm cho Cựu Chiến Binh đã đăng ký', ko: '등록된 재향군인을 위한 5년마다 독성 노출 검사(TES)' },
    exposuresKeyInfo2: { en: 'MEEA is not required for disability claims but can support them', es: 'MEEA no es requerido para reclamaciones de discapacidad pero puede apoyarlas', tl: 'Ang MEEA ay hindi kinakailangan para sa disability claims pero maaaring suportahan ang mga ito', vi: 'MEEA không bắt buộc cho yêu cầu khuyết tật nhưng có thể hỗ trợ', ko: 'MEEA는 장애 청구에 필수는 아니지만 지원할 수 있음' },
    exposuresKeyInfo3: { en: 'Exposure categories: chemicals, radiation, air pollutants, warfare agents', es: 'Categorías de exposición: químicos, radiación, contaminantes del aire, agentes de guerra', tl: 'Exposure categories: chemicals, radiation, air pollutants, warfare agents', vi: 'Các loại phơi nhiễm: hóa chất, bức xạ, ô nhiễm không khí, tác nhân chiến tranh', ko: '노출 범주: 화학물질, 방사선, 대기오염물질, 전쟁 작용제' },
    exposuresKeyInfo4: { en: 'Wars covered: Vietnam, Gulf War, Iraq, Afghanistan, and more', es: 'Guerras cubiertas: Vietnam, Guerra del Golfo, Irak, Afganistán y más', tl: 'Mga digmaang sakop: Vietnam, Gulf War, Iraq, Afghanistan, at higit pa', vi: 'Các cuộc chiến được bao gồm: Việt Nam, Chiến tranh Vùng Vịnh, Iraq, Afghanistan và hơn thế nữa', ko: '대상 전쟁: 베트남, 걸프전, 이라크, 아프가니스탄 등' },
    
    // Mental Health Key Info
    mentalHealthKeyInfo1: { en: 'No copays for first 3 outpatient mental health visits per year (through 2027)', es: 'Sin copagos para las primeras 3 visitas ambulatorias de salud mental por año (hasta 2027)', tl: 'Walang copays para sa unang 3 outpatient mental health visits bawat taon (hanggang 2027)', vi: 'Không đồng thanh toán cho 3 lần khám sức khỏe tâm thần ngoại trú đầu tiên mỗi năm (đến 2027)', ko: '연간 처음 3회 외래 정신 건강 방문에 대한 공동부담금 없음 (2027년까지)' },
    mentalHealthKeyInfo2: { en: 'PTSD and MST treatment available even without discharge upgrade', es: 'Tratamiento de TEPT y MST disponible incluso sin mejora de baja', tl: 'PTSD at MST treatment available kahit walang discharge upgrade', vi: 'Điều trị PTSD và MST có sẵn ngay cả khi không có nâng cấp xuất ngũ', ko: '전역 업그레이드 없이도 PTSD 및 MST 치료 가능' },
    mentalHealthKeyInfo3: { en: 'Telehealth and in-person options available', es: 'Opciones de telesalud y en persona disponibles', tl: 'Telehealth at in-person options available', vi: 'Có sẵn các tùy chọn telehealth và trực tiếp', ko: '원격 의료 및 대면 옵션 이용 가능' },
    mentalHealthKeyInfo4: { en: 'Effective treatments include CPT, PE, and EMDR therapy', es: 'Los tratamientos efectivos incluyen CPT, PE y terapia EMDR', tl: 'Effective treatments kasama ang CPT, PE, at EMDR therapy', vi: 'Các phương pháp điều trị hiệu quả bao gồm CPT, PE và liệu pháp EMDR', ko: '효과적인 치료에는 CPT, PE 및 EMDR 치료 포함' },
    
    // Health Care Key Info
    healthCareKeyInfo1: { en: 'Expanded eligibility for toxic exposure Veterans under PACT Act', es: 'Elegibilidad ampliada para Veteranos de exposición tóxica bajo la Ley PACT', tl: 'Expanded eligibility para sa toxic exposure Veterans sa ilalim ng PACT Act', vi: 'Mở rộng điều kiện cho Cựu Chiến Binh phơi nhiễm độc hại theo Đạo luật PACT', ko: 'PACT 법에 따른 독성 노출 재향군인 자격 확대' },
    healthCareKeyInfo2: { en: '10-year enhanced eligibility for combat Veterans', es: 'Elegibilidad mejorada de 10 años para Veteranos de combate', tl: '10-year enhanced eligibility para sa combat Veterans', vi: 'Điều kiện nâng cao 10 năm cho Cựu Chiến Binh tham chiến', ko: '전투 재향군인을 위한 10년 강화 자격' },
    healthCareKeyInfo3: { en: 'No enrollment fee for VA health care', es: 'Sin tarifa de inscripción para atención médica del VA', tl: 'Walang enrollment fee para sa VA health care', vi: 'Không phí đăng ký chăm sóc sức khỏe VA', ko: 'VA 의료 등록비 없음' },
    healthCareKeyInfo4: { en: 'Copays may be waived based on disability rating or income', es: 'Los copagos pueden ser eximidos según la calificación de discapacidad o ingresos', tl: 'Maaaring i-waive ang copays batay sa disability rating o income', vi: 'Có thể miễn đồng thanh toán dựa trên mức độ khuyết tật hoặc thu nhập', ko: '장애 등급 또는 소득에 따라 공동부담금 면제 가능' },
    
    // Regulations Key Info
    regulationsKeyInfo1: { en: 'Benefit of the Doubt (§3.102): When evidence is equal, the tie goes to you', es: 'Beneficio de la Duda (§3.102): Cuando la evidencia es igual, el empate es a tu favor', tl: 'Benefit of the Doubt (§3.102): Kapag pantay ang ebidensya, ikaw ang panalo', vi: 'Lợi ích của Nghi ngờ (§3.102): Khi bằng chứng ngang nhau, bạn được ưu tiên', ko: '의심의 이익 (§3.102): 증거가 동등할 때 결정은 당신에게 유리하게' },
    regulationsKeyInfo2: { en: 'Duty to Assist (§3.159): VA must help gather evidence for your claim', es: 'Deber de Asistir (§3.159): El VA debe ayudar a reunir evidencia para tu reclamación', tl: 'Duty to Assist (§3.159): Dapat tumulong ang VA sa pagtitipon ng ebidensya para sa iyong claim', vi: 'Nghĩa vụ Hỗ trợ (§3.159): VA phải giúp thu thập bằng chứng cho yêu cầu của bạn', ko: '지원 의무 (§3.159): VA는 청구에 대한 증거 수집을 도와야 함' },
    regulationsKeyInfo3: { en: 'Intent to File (§3.155): Protects your effective date for up to 1 year', es: 'Intención de Presentar (§3.155): Protege tu fecha efectiva hasta por 1 año', tl: 'Intent to File (§3.155): Pinoprotektahan ang effective date mo hanggang 1 taon', vi: 'Ý định Nộp hồ sơ (§3.155): Bảo vệ ngày có hiệu lực của bạn trong tối đa 1 năm', ko: '제출 의사 (§3.155): 최대 1년간 유효 날짜 보호' },
    regulationsKeyInfo4: { en: 'Rating Stabilization (§3.344): Ratings held 5+ years have extra protection', es: 'Estabilización de Calificación (§3.344): Las calificaciones mantenidas por más de 5 años tienen protección adicional', tl: 'Rating Stabilization (§3.344): Ang ratings na hawak ng 5+ taon ay may extra protection', vi: 'Ổn định Xếp hạng (§3.344): Xếp hạng giữ hơn 5 năm có bảo vệ bổ sung', ko: '등급 안정화 (§3.344): 5년 이상 유지된 등급은 추가 보호' },
    regulationsKeyInfo5: { en: 'One Year from Decision: File appeal within 1 year or decision becomes final', es: 'Un Año desde la Decisión: Presenta apelación dentro de 1 año o la decisión se vuelve final', tl: 'One Year from Decision: Mag-file ng appeal sa loob ng 1 taon o magiging final ang decision', vi: 'Một Năm từ Quyết định: Nộp kháng cáo trong vòng 1 năm hoặc quyết định trở thành cuối cùng', ko: '결정 후 1년: 1년 이내에 항소하지 않으면 결정이 최종 확정' },
    
    // Resource Names and Descriptions
    pactActOverview: { en: 'PACT Act Overview', es: 'Resumen de la Ley PACT', tl: 'PACT Act Overview', vi: 'Tổng Quan Đạo Luật PACT', ko: 'PACT 법 개요' },
    pactActOverviewDesc: { en: 'Learn about eligibility, presumptive conditions, and how to file claims', es: 'Conozca la elegibilidad, condiciones presuntivas y cómo presentar reclamaciones', tl: 'Alamin ang eligibility, presumptive conditions, at paano mag-file ng claims', vi: 'Tìm hiểu về điều kiện, tình trạng được suy đoán và cách nộp yêu cầu', ko: '자격, 추정 조건 및 청구 제출 방법 알아보기' },
    fileDisabilityClaim: { en: 'File a Disability Claim', es: 'Presentar Reclamación de Discapacidad', tl: 'Mag-file ng Disability Claim', vi: 'Nộp Yêu Cầu Khuyết Tật', ko: '장애 청구 제출' },
    fileDisabilityClaimDesc: { en: 'Submit your PACT Act-related disability claim online', es: 'Envíe su reclamación de discapacidad relacionada con la Ley PACT en línea', tl: 'Isumite ang iyong PACT Act-related disability claim online', vi: 'Gửi yêu cầu khuyết tật liên quan đến Đạo luật PACT trực tuyến', ko: 'PACT 법 관련 장애 청구를 온라인으로 제출' },
    applyVAHealthCare: { en: 'Apply for VA Health Care', es: 'Solicitar Atención Médica del VA', tl: 'Mag-apply para sa VA Health Care', vi: 'Đăng Ký Chăm Sóc Sức Khỏe VA', ko: 'VA 의료 신청' },
    applyVAHealthCareDesc: { en: 'Expanded eligibility under PACT Act - apply now', es: 'Elegibilidad ampliada bajo la Ley PACT - solicite ahora', tl: 'Expanded eligibility sa ilalim ng PACT Act - mag-apply na', vi: 'Mở rộng điều kiện theo Đạo luật PACT - đăng ký ngay', ko: 'PACT 법에 따른 확대된 자격 - 지금 신청' },
    pactActDashboard: { en: 'PACT Act Performance Dashboard', es: 'Panel de Rendimiento de la Ley PACT', tl: 'PACT Act Performance Dashboard', vi: 'Bảng Điều Khiển Hiệu Suất Đạo Luật PACT', ko: 'PACT 법 실적 대시보드' },
    pactActDashboardDesc: { en: "Track VA's progress on PACT Act implementation", es: 'Rastree el progreso del VA en la implementación de la Ley PACT', tl: 'I-track ang progreso ng VA sa PACT Act implementation', vi: 'Theo dõi tiến độ thực hiện Đạo luật PACT của VA', ko: 'PACT 법 시행에 대한 VA 진행 상황 추적' },
    campLejeune: { en: 'Camp Lejeune Water Contamination', es: 'Contaminación del Agua de Camp Lejeune', tl: 'Camp Lejeune Water Contamination', vi: 'Ô Nhiễm Nước Camp Lejeune', ko: '캠프 르준 수질 오염' },
    campLejeuneDesc: { en: 'Information for veterans exposed to contaminated water at Camp Lejeune', es: 'Información para veteranos expuestos a agua contaminada en Camp Lejeune', tl: 'Impormasyon para sa mga veteran na na-expose sa contaminated water sa Camp Lejeune', vi: 'Thông tin cho cựu chiến binh tiếp xúc với nước bị ô nhiễm tại Camp Lejeune', ko: '캠프 르준에서 오염된 물에 노출된 재향군인을 위한 정보' },
    
    // Military Exposures Resources
    militaryExposuresOverview: { en: 'Military Exposures Overview', es: 'Resumen de Exposiciones Militares', tl: 'Military Exposures Overview', vi: 'Tổng Quan Phơi Nhiễm Quân Sự', ko: '군사 노출 개요' },
    militaryExposuresOverviewDesc: { en: 'Comprehensive information on chemical, physical, and environmental hazards', es: 'Información completa sobre peligros químicos, físicos y ambientales', tl: 'Komprehensibong impormasyon sa chemical, physical, at environmental hazards', vi: 'Thông tin toàn diện về các nguy hiểm hóa học, vật lý và môi trường', ko: '화학, 물리 및 환경 위험에 대한 종합 정보' },
    meeaAssessment: { en: 'Military Environmental Exposures Assessment (MEEA)', es: 'Evaluación de Exposiciones Ambientales Militares (MEEA)', tl: 'Military Environmental Exposures Assessment (MEEA)', vi: 'Đánh Giá Phơi Nhiễm Môi Trường Quân Sự (MEEA)', ko: '군사 환경 노출 평가 (MEEA)' },
    meeaAssessmentDesc: { en: 'Free 60-minute evaluation for exposure-related health concerns', es: 'Evaluación gratuita de 60 minutos para preocupaciones de salud relacionadas con exposición', tl: 'Libreng 60-minute evaluation para sa exposure-related health concerns', vi: 'Đánh giá miễn phí 60 phút cho các vấn đề sức khỏe liên quan đến phơi nhiễm', ko: '노출 관련 건강 문제에 대한 무료 60분 평가' },
    vetHomeTelehealth: { en: 'VET-HOME Telehealth MEEAs', es: 'MEEAs de Telesalud VET-HOME', tl: 'VET-HOME Telehealth MEEAs', vi: 'MEEA Telehealth VET-HOME', ko: 'VET-HOME 원격 의료 MEEA' },
    vetHomeTelehealthDesc: { en: 'Free telehealth assessments available nationwide', es: 'Evaluaciones de telesalud gratuitas disponibles en todo el país', tl: 'Libreng telehealth assessments available nationwide', vi: 'Đánh giá telehealth miễn phí có sẵn trên toàn quốc', ko: '전국적으로 이용 가능한 무료 원격 의료 평가' },
    agentOrange: { en: 'Agent Orange Information', es: 'Información sobre Agente Naranja', tl: 'Agent Orange Information', vi: 'Thông Tin Agent Orange', ko: '에이전트 오렌지 정보' },
    agentOrangeDesc: { en: 'Agent Orange related diseases and presumptive locations', es: 'Enfermedades relacionadas con Agente Naranja y ubicaciones presuntivas', tl: 'Agent Orange related diseases at presumptive locations', vi: 'Các bệnh liên quan đến Agent Orange và địa điểm được suy đoán', ko: '에이전트 오렌지 관련 질병 및 추정 위치' },
    gulfWarIllnesses: { en: "Gulf War Veterans' Illnesses", es: 'Enfermedades de Veteranos de la Guerra del Golfo', tl: "Gulf War Veterans' Illnesses", vi: 'Bệnh Cựu Chiến Binh Chiến Tranh Vùng Vịnh', ko: '걸프전 재향군인 질병' },
    gulfWarIllnessesDesc: { en: 'Information for Gulf War era Veterans', es: 'Información para Veteranos de la era de la Guerra del Golfo', tl: 'Impormasyon para sa Gulf War era Veterans', vi: 'Thông tin cho Cựu Chiến Binh thời kỳ Chiến tranh Vùng Vịnh', ko: '걸프전 시대 재향군인을 위한 정보' },
    burnPitHazards: { en: 'Burn Pit & Airborne Hazards', es: 'Fosas de Quema y Peligros Aéreos', tl: 'Burn Pit at Airborne Hazards', vi: 'Hố Đốt & Nguy Hiểm Trong Không Khí', ko: '소각 구덩이 & 공기 중 위험' },
    burnPitHazardsDesc: { en: 'Health information for burn pit and airborne hazard exposure', es: 'Información de salud para exposición a fosas de quema y peligros aéreos', tl: 'Health information para sa burn pit at airborne hazard exposure', vi: 'Thông tin sức khỏe về phơi nhiễm hố đốt và nguy hiểm trong không khí', ko: '소각 구덩이 및 공기 중 위험 노출에 대한 건강 정보' },
    burnPitRegistry: { en: 'Airborne Hazards and Open Burn Pit Registry', es: 'Registro de Peligros Aéreos y Fosas de Quema Abiertas', tl: 'Airborne Hazards and Open Burn Pit Registry', vi: 'Đăng Ký Nguy Hiểm Trong Không Khí và Hố Đốt Mở', ko: '공기 중 위험 및 개방형 소각 구덩이 등록부' },
    burnPitRegistryDesc: { en: 'Register your exposure and track health over time - helps VA research', es: 'Registre su exposición y rastree su salud con el tiempo - ayuda a la investigación del VA', tl: 'I-register ang exposure mo at i-track ang health sa paglipas ng panahon - tumutulong sa VA research', vi: 'Đăng ký phơi nhiễm và theo dõi sức khỏe theo thời gian - giúp nghiên cứu VA', ko: '노출을 등록하고 시간에 따른 건강을 추적 - VA 연구 지원' },
    envHealthCoordinators: { en: 'Environmental Health Coordinators', es: 'Coordinadores de Salud Ambiental', tl: 'Environmental Health Coordinators', vi: 'Điều Phối Viên Sức Khỏe Môi Trường', ko: '환경 건강 코디네이터' },
    envHealthCoordinatorsDesc: { en: 'Find your local Environmental Health Coordinator', es: 'Encuentre su Coordinador de Salud Ambiental local', tl: 'Hanapin ang iyong local na Environmental Health Coordinator', vi: 'Tìm Điều phối viên Sức khỏe Môi trường địa phương của bạn', ko: '지역 환경 건강 코디네이터 찾기' },
    
    // Mental Health Resources
    veteransCrisisLineResource: { en: 'Veterans Crisis Line', es: 'Línea de Crisis para Veteranos', tl: 'Veterans Crisis Line', vi: 'Đường Dây Khủng Hoảng Cựu Chiến Binh', ko: '재향군인 위기 상담 전화' },
    veteransCrisisLineDesc: { en: 'Immediate crisis support available 24/7', es: 'Apoyo de crisis inmediato disponible 24/7', tl: 'Agarang crisis support available 24/7', vi: 'Hỗ trợ khủng hoảng ngay lập tức có sẵn 24/7', ko: '24/7 즉시 위기 지원 가능' },
    vaMentalHealthServices: { en: 'VA Mental Health Services', es: 'Servicios de Salud Mental del VA', tl: 'VA Mental Health Services', vi: 'Dịch Vụ Sức Khỏe Tâm Thần VA', ko: 'VA 정신 건강 서비스' },
    vaMentalHealthServicesDesc: { en: 'Treatment options, resources, and appointment information', es: 'Opciones de tratamiento, recursos e información de citas', tl: 'Treatment options, resources, at appointment information', vi: 'Các tùy chọn điều trị, tài nguyên và thông tin cuộc hẹn', ko: '치료 옵션, 자료 및 예약 정보' },
    ptsdCenter: { en: 'PTSD: National Center for PTSD', es: 'TEPT: Centro Nacional para el TEPT', tl: 'PTSD: National Center for PTSD', vi: 'PTSD: Trung Tâm Quốc Gia về PTSD', ko: 'PTSD: 국립 PTSD 센터' },
    ptsdCenterDesc: { en: "World's leading research and educational center on PTSD", es: 'Centro de investigación y educación líder mundial en TEPT', tl: "World's leading research and educational center on PTSD", vi: 'Trung tâm nghiên cứu và giáo dục hàng đầu thế giới về PTSD', ko: '세계 최고의 PTSD 연구 및 교육 센터' },
    ptsdDecisionAid: { en: 'PTSD Treatment Decision Aid', es: 'Ayuda para Decisiones de Tratamiento de TEPT', tl: 'PTSD Treatment Decision Aid', vi: 'Hỗ Trợ Quyết Định Điều Trị PTSD', ko: 'PTSD 치료 결정 지원' },
    ptsdDecisionAidDesc: { en: 'Interactive tool to explore treatment options', es: 'Herramienta interactiva para explorar opciones de tratamiento', tl: 'Interactive tool para i-explore ang treatment options', vi: 'Công cụ tương tác để khám phá các tùy chọn điều trị', ko: '치료 옵션 탐색을 위한 대화형 도구' },
    aboutFace: { en: 'AboutFace - Veteran Stories', es: 'AboutFace - Historias de Veteranos', tl: 'AboutFace - Veteran Stories', vi: 'AboutFace - Câu Chuyện Cựu Chiến Binh', ko: 'AboutFace - 재향군인 이야기' },
    aboutFaceDesc: { en: 'Videos of Veterans sharing their PTSD experiences', es: 'Videos de Veteranos compartiendo sus experiencias con TEPT', tl: 'Videos ng mga Veteran na nagbabahagi ng kanilang PTSD experiences', vi: 'Video của Cựu Chiến Binh chia sẻ trải nghiệm PTSD', ko: '재향군인들이 PTSD 경험을 공유하는 동영상' },
    makeTheConnection: { en: 'Make the Connection', es: 'Haz la Conexión', tl: 'Make the Connection', vi: 'Tạo Kết Nối', ko: '연결하기' },
    makeTheConnectionDesc: { en: 'Veteran stories and resources for mental health', es: 'Historias de veteranos y recursos para la salud mental', tl: 'Veteran stories at resources para sa mental health', vi: 'Câu chuyện cựu chiến binh và tài nguyên sức khỏe tâm thần', ko: '재향군인 이야기 및 정신 건강 자료' },
    mstSupport: { en: 'Military Sexual Trauma (MST)', es: 'Trauma Sexual Militar (MST)', tl: 'Military Sexual Trauma (MST)', vi: 'Chấn Thương Tình Dục Quân Sự (MST)', ko: '군사 성적 트라우마 (MST)' },
    mstSupportDesc: { en: 'Support and treatment for survivors of MST', es: 'Apoyo y tratamiento para sobrevivientes de MST', tl: 'Support at treatment para sa survivors ng MST', vi: 'Hỗ trợ và điều trị cho những người sống sót sau MST', ko: 'MST 생존자를 위한 지원 및 치료' },
    substanceUseTreatment: { en: 'Substance Use Treatment', es: 'Tratamiento por Uso de Sustancias', tl: 'Substance Use Treatment', vi: 'Điều Trị Sử Dụng Chất', ko: '물질 사용 치료' },
    substanceUseTreatmentDesc: { en: 'Help for substance use disorders', es: 'Ayuda para trastornos por uso de sustancias', tl: 'Tulong para sa substance use disorders', vi: 'Giúp đỡ cho các rối loạn sử dụng chất', ko: '물질 사용 장애에 대한 도움' },
    
    // Specialized Programs Resources
    homelessVeteransPrograms: { en: 'Homeless Veterans Programs', es: 'Programas para Veteranos Sin Hogar', tl: 'Homeless Veterans Programs', vi: 'Chương Trình Cựu Chiến Binh Vô Gia Cư', ko: '노숙 재향군인 프로그램' },
    homelessVeteransProgramsDesc: { en: 'Housing assistance, outreach, and support services', es: 'Asistencia de vivienda, alcance y servicios de apoyo', tl: 'Housing assistance, outreach, at support services', vi: 'Hỗ trợ nhà ở, tiếp cận và dịch vụ hỗ trợ', ko: '주거 지원, 아웃리치 및 지원 서비스' },
    centerWomenVeterans: { en: 'Center for Women Veterans', es: 'Centro para Mujeres Veteranas', tl: 'Center for Women Veterans', vi: 'Trung Tâm Nữ Cựu Chiến Binh', ko: '여성 재향군인 센터' },
    centerWomenVeteransDesc: { en: 'Benefits, services, and resources for women Veterans', es: 'Beneficios, servicios y recursos para mujeres veteranas', tl: 'Benefits, services, at resources para sa women Veterans', vi: 'Quyền lợi, dịch vụ và tài nguyên cho nữ cựu chiến binh', ko: '여성 재향군인을 위한 혜택, 서비스 및 자료' },
    centerMinorityVeterans: { en: 'Center for Minority Veterans', es: 'Centro para Veteranos Minoritarios', tl: 'Center for Minority Veterans', vi: 'Trung Tâm Cựu Chiến Binh Thiểu Số', ko: '소수민족 재향군인 센터' },
    centerMinorityVeteransDesc: { en: 'Advocacy and outreach for minority Veterans', es: 'Defensa y alcance para veteranos minoritarios', tl: 'Advocacy at outreach para sa minority Veterans', vi: 'Vận động và tiếp cận cho cựu chiến binh thiểu số', ko: '소수민족 재향군인을 위한 옹호 및 아웃리치' },
    lgbtqCareProgram: { en: 'LGBTQ+ Veteran Care Program', es: 'Programa de Atención para Veteranos LGBTQ+', tl: 'LGBTQ+ Veteran Care Program', vi: 'Chương Trình Chăm Sóc Cựu Chiến Binh LGBTQ+', ko: 'LGBTQ+ 재향군인 케어 프로그램' },
    lgbtqCareProgramDesc: { en: 'Health care and support for LGBTQ+ Veterans with dedicated coordinators at every VA facility', es: 'Atención médica y apoyo para veteranos LGBTQ+ con coordinadores dedicados en cada instalación del VA', tl: 'Health care at support para sa LGBTQ+ Veterans na may dedicated coordinators sa bawat VA facility', vi: 'Chăm sóc sức khỏe và hỗ trợ cho Cựu Chiến Binh LGBTQ+ với các điều phối viên chuyên trách tại mọi cơ sở VA', ko: '모든 VA 시설에 전담 코디네이터가 있는 LGBTQ+ 재향군인을 위한 의료 및 지원' },
    findLgbtqCoordinator: { en: 'Find Your LGBTQ+ Veteran Care Coordinator', es: 'Encuentre su Coordinador de Atención para Veteranos LGBTQ+', tl: 'Hanapin ang Iyong LGBTQ+ Veteran Care Coordinator', vi: 'Tìm Điều Phối Viên Chăm Sóc Cựu Chiến Binh LGBTQ+ Của Bạn', ko: 'LGBTQ+ 재향군인 케어 코디네이터 찾기' },
    findLgbtqCoordinatorDesc: { en: 'Connect with a dedicated LGBTQ+ VCC at your local VA - available at every medical center', es: 'Conéctese con un VCC LGBTQ+ dedicado en su VA local - disponible en cada centro médico', tl: 'Kumonekta sa isang dedicated LGBTQ+ VCC sa iyong local na VA - available sa bawat medical center', vi: 'Kết nối với VCC LGBTQ+ chuyên trách tại VA địa phương của bạn - có sẵn tại mọi trung tâm y tế', ko: '지역 VA에서 전담 LGBTQ+ VCC와 연결 - 모든 의료 센터에서 이용 가능' },
    dischargeUpgradeLgbtq: { en: 'Discharge Upgrade for LGBTQ+ Veterans', es: 'Mejora de Baja para Veteranos LGBTQ+', tl: 'Discharge Upgrade para sa LGBTQ+ Veterans', vi: 'Nâng Cấp Xuất Ngũ cho Cựu Chiến Binh LGBTQ+', ko: 'LGBTQ+ 재향군인을 위한 전역 업그레이드' },
    dischargeUpgradeLgbtqDesc: { en: 'If discharged due to sexual orientation or gender identity, you may qualify for a discharge upgrade and full benefits', es: 'Si fue dado de baja debido a orientación sexual o identidad de género, puede calificar para una mejora de baja y beneficios completos', tl: 'Kung na-discharge dahil sa sexual orientation o gender identity, maaari kang ma-qualify para sa discharge upgrade at full benefits', vi: 'Nếu xuất ngũ do xu hướng tình dục hoặc nhận dạng giới tính, bạn có thể đủ điều kiện nâng cấp xuất ngũ và đầy đủ quyền lợi', ko: '성적 지향 또는 성별 정체성으로 인해 전역한 경우 전역 업그레이드 및 전액 혜택 자격이 될 수 있습니다' },
    adaptiveSports: { en: 'Adaptive Sports & Special Events', es: 'Deportes Adaptativos y Eventos Especiales', tl: 'Adaptive Sports at Special Events', vi: 'Thể Thao Thích Ứng & Sự Kiện Đặc Biệt', ko: '적응 스포츠 & 특별 이벤트' },
    adaptiveSportsDesc: { en: 'Paralympic sports, events, and recreation programs', es: 'Deportes paralímpicos, eventos y programas recreativos', tl: 'Paralympic sports, events, at recreation programs', vi: 'Thể thao Paralympic, sự kiện và chương trình giải trí', ko: '패럴림픽 스포츠, 이벤트 및 레크리에이션 프로그램' },
    veteranSmallBusiness: { en: 'Veteran Small Business Programs', es: 'Programas de Pequeñas Empresas para Veteranos', tl: 'Veteran Small Business Programs', vi: 'Chương Trình Doanh Nghiệp Nhỏ Cựu Chiến Binh', ko: '재향군인 소기업 프로그램' },
    veteranSmallBusinessDesc: { en: 'Support for Veteran-owned small businesses', es: 'Apoyo para pequeñas empresas propiedad de veteranos', tl: 'Support para sa Veteran-owned small businesses', vi: 'Hỗ trợ cho các doanh nghiệp nhỏ thuộc sở hữu của cựu chiến binh', ko: '재향군인 소유 소기업 지원' },
    nationalResourceDirectory: { en: 'National Resource Directory', es: 'Directorio Nacional de Recursos', tl: 'National Resource Directory', vi: 'Thư Mục Tài Nguyên Quốc Gia', ko: '국가 자원 디렉토리' },
    nationalResourceDirectoryDesc: { en: 'DoD/VA comprehensive database connecting service members, veterans, families, and caregivers to 10,000+ vetted resources nationwide', es: 'Base de datos completa de DoD/VA que conecta a miembros del servicio, veteranos, familias y cuidadores con más de 10,000 recursos verificados en todo el país', tl: 'DoD/VA comprehensive database na nag-kokonekta sa service members, veterans, families, at caregivers sa 10,000+ vetted resources nationwide', vi: 'Cơ sở dữ liệu toàn diện DoD/VA kết nối quân nhân, cựu chiến binh, gia đình và người chăm sóc với hơn 10.000 tài nguyên đã được xác minh trên toàn quốc', ko: 'DoD/VA 종합 데이터베이스로 군인, 재향군인, 가족 및 간병인을 전국 10,000개 이상의 검증된 자원에 연결' },
    
    // Health Care Resources
    healthCareEligibilityResource: { en: 'Health Care Eligibility', es: 'Elegibilidad para Atención Médica', tl: 'Health Care Eligibility', vi: 'Điều Kiện Chăm Sóc Sức Khỏe', ko: '의료 자격' },
    healthCareEligibilityDesc: { en: 'Find out if you qualify for VA health care', es: 'Averigüe si califica para la atención médica del VA', tl: 'Alamin kung kwalipikado ka para sa VA health care', vi: 'Tìm hiểu xem bạn có đủ điều kiện nhận chăm sóc sức khỏe VA không', ko: 'VA 의료 자격이 있는지 확인' },
    priorityGroups: { en: 'Priority Groups', es: 'Grupos Prioritarios', tl: 'Priority Groups', vi: 'Nhóm Ưu Tiên', ko: '우선 순위 그룹' },
    priorityGroupsDesc: { en: 'Understand how priority groups affect your benefits', es: 'Comprenda cómo los grupos prioritarios afectan sus beneficios', tl: 'Unawain kung paano nakakaapekto ang priority groups sa iyong benefits', vi: 'Hiểu cách các nhóm ưu tiên ảnh hưởng đến quyền lợi của bạn', ko: '우선 순위 그룹이 혜택에 어떤 영향을 미치는지 이해' },
    vaHealthCareAccess: { en: 'VA Health Care Access & Quality', es: 'Acceso y Calidad de Atención Médica del VA', tl: 'VA Health Care Access at Quality', vi: 'Tiếp Cận & Chất Lượng Chăm Sóc Sức Khỏe VA', ko: 'VA 의료 접근 및 품질' },
    vaHealthCareAccessDesc: { en: 'Compare wait times and quality at VA facilities', es: 'Compare tiempos de espera y calidad en instalaciones del VA', tl: 'Ihambing ang wait times at quality sa VA facilities', vi: 'So sánh thời gian chờ đợi và chất lượng tại các cơ sở VA', ko: 'VA 시설의 대기 시간 및 품질 비교' },
    findVALocation: { en: 'Find a VA Location', es: 'Encontrar una Ubicación del VA', tl: 'Maghanap ng VA Location', vi: 'Tìm Địa Điểm VA', ko: 'VA 위치 찾기' },
    findVALocationDesc: { en: 'Locate VA medical centers, clinics, and Vet Centers', es: 'Localice centros médicos del VA, clínicas y Centros de Veteranos', tl: 'Hanapin ang VA medical centers, clinics, at Vet Centers', vi: 'Tìm trung tâm y tế VA, phòng khám và Trung tâm Cựu chiến binh', ko: 'VA 의료 센터, 클리닉 및 Vet 센터 찾기' },
    myHealtheVet: { en: 'My HealtheVet', es: 'My HealtheVet', tl: 'My HealtheVet', vi: 'My HealtheVet', ko: 'My HealtheVet' },
    myHealtheVetDesc: { en: 'Manage your health care and prescriptions online', es: 'Administre su atención médica y recetas en línea', tl: 'I-manage ang health care at prescriptions mo online', vi: 'Quản lý chăm sóc sức khỏe và đơn thuốc trực tuyến', ko: '온라인으로 건강 관리 및 처방전 관리' },
    
    // Benefits & Support Resources
    vaOutreachEvents: { en: 'VA Outreach Events', es: 'Eventos de Alcance del VA', tl: 'VA Outreach Events', vi: 'Sự Kiện Tiếp Cận VA', ko: 'VA 아웃리치 이벤트' },
    vaOutreachEventsDesc: { en: 'Find VA events and town halls near you', es: 'Encuentre eventos del VA y reuniones comunitarias cerca de usted', tl: 'Maghanap ng VA events at town halls malapit sa iyo', vi: 'Tìm sự kiện VA và hội trường gần bạn', ko: '가까운 VA 이벤트 및 타운홀 찾기' },
    getHelpVSO: { en: 'Get Help from a VSO', es: 'Obtenga Ayuda de un VSO', tl: 'Humingi ng Tulong sa VSO', vi: 'Nhận Trợ Giúp từ VSO', ko: 'VSO로부터 도움 받기' },
    getHelpVSODesc: { en: 'Free help filing claims from accredited representatives', es: 'Ayuda gratuita para presentar reclamaciones de representantes acreditados', tl: 'Libreng tulong sa pag-file ng claims mula sa accredited representatives', vi: 'Trợ giúp miễn phí nộp yêu cầu từ đại diện được công nhận', ko: '공인 대리인의 무료 청구 제출 도움' },
    vaForms: { en: 'VA Forms', es: 'Formularios del VA', tl: 'VA Forms', vi: 'Biểu Mẫu VA', ko: 'VA 양식' },
    vaFormsDesc: { en: 'Find and download official VA forms', es: 'Encuentre y descargue formularios oficiales del VA', tl: 'Hanapin at i-download ang official VA forms', vi: 'Tìm và tải xuống biểu mẫu VA chính thức', ko: '공식 VA 양식 찾기 및 다운로드' },
    vaMobileApps: { en: 'VA Mobile Apps', es: 'Aplicaciones Móviles del VA', tl: 'VA Mobile Apps', vi: 'Ứng Dụng Di Động VA', ko: 'VA 모바일 앱' },
    vaMobileAppsDesc: { en: 'Official VA apps for managing benefits', es: 'Aplicaciones oficiales del VA para administrar beneficios', tl: 'Official VA apps para sa pamamahala ng benefits', vi: 'Ứng dụng VA chính thức để quản lý quyền lợi', ko: '혜택 관리를 위한 공식 VA 앱' },
    stateVAOffices: { en: 'State VA Offices', es: 'Oficinas Estatales del VA', tl: 'State VA Offices', vi: 'Văn Phòng VA Tiểu Bang', ko: '주 VA 사무소' },
    stateVAOfficesDesc: { en: 'Find your state Veterans Affairs office', es: 'Encuentre su oficina estatal de Asuntos de Veteranos', tl: 'Hanapin ang iyong state Veterans Affairs office', vi: 'Tìm văn phòng Các Vấn đề Cựu Chiến binh của tiểu bang', ko: '주 재향군인부 사무소 찾기' },
    vaWelcomeKit: { en: 'Your VA Welcome Kit', es: 'Su Kit de Bienvenida del VA', tl: 'Ang Iyong VA Welcome Kit', vi: 'Bộ Chào Đón VA Của Bạn', ko: '귀하의 VA 환영 키트' },
    vaWelcomeKitDesc: { en: 'Comprehensive guide to VA benefits and services', es: 'Guía completa de beneficios y servicios del VA', tl: 'Komprehensibong gabay sa VA benefits at services', vi: 'Hướng dẫn toàn diện về quyền lợi và dịch vụ VA', ko: 'VA 혜택 및 서비스에 대한 종합 가이드' },
    
    // Regulations Resources
    regulationsReference: { en: '38 CFR Part 3 Regulations Reference', es: 'Referencia de Regulaciones 38 CFR Parte 3', tl: '38 CFR Part 3 Regulations Reference', vi: 'Tham Chiếu Quy Định 38 CFR Phần 3', ko: '38 CFR 파트 3 규정 참조' },
    regulationsReferenceDesc: { en: 'Interactive guide to all major claims regulations, deadlines, forms, and your rights', es: 'Guía interactiva de todas las regulaciones principales de reclamaciones, plazos, formularios y sus derechos', tl: 'Interactive guide sa lahat ng major claims regulations, deadlines, forms, at iyong mga karapatan', vi: 'Hướng dẫn tương tác về tất cả các quy định yêu cầu chính, thời hạn, biểu mẫu và quyền của bạn', ko: '모든 주요 청구 규정, 마감일, 양식 및 권리에 대한 대화형 가이드' },
    ecfrPart3: { en: '38 CFR Part 3 - Full Text (eCFR)', es: '38 CFR Parte 3 - Texto Completo (eCFR)', tl: '38 CFR Part 3 - Buong Teksto (eCFR)', vi: '38 CFR Phần 3 - Toàn Văn (eCFR)', ko: '38 CFR 파트 3 - 전체 텍스트 (eCFR)' },
    ecfrPart3Desc: { en: 'Official regulations governing adjudication of claims', es: 'Regulaciones oficiales que rigen la adjudicación de reclamaciones', tl: 'Opisyal na regulations na namamahala sa adjudication ng claims', vi: 'Quy định chính thức quản lý việc xét xử yêu cầu', ko: '청구 판결을 관장하는 공식 규정' },
    ecfrPart4: { en: '38 CFR Part 4 - Rating Schedule (eCFR)', es: '38 CFR Parte 4 - Tabla de Calificación (eCFR)', tl: '38 CFR Part 4 - Rating Schedule (eCFR)', vi: '38 CFR Phần 4 - Bảng Đánh Giá (eCFR)', ko: '38 CFR 파트 4 - 등급표 (eCFR)' },
    ecfrPart4Desc: { en: 'Official disability rating criteria and diagnostic codes', es: 'Criterios oficiales de calificación de discapacidad y códigos de diagnóstico', tl: 'Opisyal na disability rating criteria at diagnostic codes', vi: 'Tiêu chí đánh giá khuyết tật chính thức và mã chẩn đoán', ko: '공식 장애 등급 기준 및 진단 코드' },
    m21Manual: { en: 'M21-1 Adjudication Manual', es: 'Manual de Adjudicación M21-1', tl: 'M21-1 Adjudication Manual', vi: 'Sổ Tay Xét Xử M21-1', ko: 'M21-1 판결 매뉴얼' },
    m21ManualDesc: { en: 'VA internal manual for processing disability claims', es: 'Manual interno del VA para procesar reclamaciones de discapacidad', tl: 'VA internal manual para sa pagproseso ng disability claims', vi: 'Sổ tay nội bộ VA để xử lý yêu cầu khuyết tật', ko: '장애 청구 처리를 위한 VA 내부 매뉴얼' },
    bvaAppeals: { en: 'Board of Veterans Appeals (BVA)', es: 'Junta de Apelaciones de Veteranos (BVA)', tl: 'Board of Veterans Appeals (BVA)', vi: 'Hội Đồng Kháng Cáo Cựu Chiến Binh (BVA)', ko: '재향군인 항소 위원회 (BVA)' },
    bvaAppealsDesc: { en: "Appeal decisions directly to VA's highest internal authority", es: 'Apele decisiones directamente a la máxima autoridad interna del VA', tl: 'I-appeal ang decisions direkta sa pinakamataas na internal authority ng VA', vi: 'Kháng cáo quyết định trực tiếp lên cơ quan nội bộ cao nhất của VA', ko: 'VA의 최고 내부 기관에 직접 결정 항소' },
    decisionReviewProcess: { en: 'Decision Review Process', es: 'Proceso de Revisión de Decisiones', tl: 'Decision Review Process', vi: 'Quy Trình Xem Xét Quyết Định', ko: '결정 검토 프로세스' },
    decisionReviewProcessDesc: { en: 'Understand your options: Supplemental Claim, Higher-Level Review, or Board Appeal', es: 'Comprenda sus opciones: Reclamación Suplementaria, Revisión de Nivel Superior o Apelación ante la Junta', tl: 'Unawain ang iyong mga opsyon: Supplemental Claim, Higher-Level Review, o Board Appeal', vi: 'Hiểu các tùy chọn của bạn: Yêu cầu Bổ sung, Xem xét Cấp cao hơn hoặc Kháng cáo Hội đồng', ko: '옵션 이해: 보충 청구, 상위 검토 또는 위원회 항소' },
    
    // Footer
    needHelp: { en: 'Need Help?', es: '¿Necesita Ayuda?', tl: 'Kailangan ng Tulong?', vi: 'Cần Trợ Giúp?', ko: '도움이 필요하신가요?' },
    callMainLine: { en: 'Call the VA main information line at', es: 'Llame a la línea principal de información del VA al', tl: 'Tumawag sa VA main information line sa', vi: 'Gọi đường dây thông tin chính của VA tại', ko: 'VA 주요 정보 라인으로 전화' },
    tty711: { en: '(TTY: 711)', es: '(TTY: 711)', tl: '(TTY: 711)', vi: '(TTY: 711)', ko: '(TTY: 711)' },
    orFindVSO: { en: 'or', es: 'o', tl: 'o', vi: 'hoặc', ko: '또는' },
    findVSOHelp: { en: 'find a VSO to help with your claim', es: 'encuentre un VSO para ayudar con su reclamación', tl: 'maghanap ng VSO para tumulong sa iyong claim', vi: 'tìm VSO để giúp đỡ yêu cầu của bạn', ko: '청구를 도와줄 VSO 찾기' },
  },

  // Buttons and Actions
  buttons: {
    getStarted: { en: 'Get Started', es: 'Empezar', tl: 'Magsimula', vi: 'Bắt Đầu', ko: '시작하기' },
    learnMore: { en: 'Learn More', es: 'Más Información', tl: 'Alamin Pa', vi: 'Tìm Hiểu Thêm', ko: '더 알아보기' },
    tryIt: { en: 'Try It', es: 'Pruébalo', tl: 'Subukan', vi: 'Thử Ngay', ko: '시도하기' },
    openTool: { en: 'Open Tool', es: 'Abrir Herramienta', tl: 'Buksan ang Tool', vi: 'Mở Công Cụ', ko: '도구 열기' },
    generate: { en: 'Generate', es: 'Generar', tl: 'I-generate', vi: 'Tạo', ko: '생성' },
    analyze: { en: 'Analyze', es: 'Analizar', tl: 'Suriin', vi: 'Phân Tích', ko: '분석' },
    calculate: { en: 'Calculate', es: 'Calcular', tl: 'Kalkulahin', vi: 'Tính Toán', ko: '계산' },
    compare: { en: 'Compare', es: 'Comparar', tl: 'Ihambing', vi: 'So Sánh', ko: '비교' },
    copy: { en: 'Copy', es: 'Copiar', tl: 'Kopyahin', vi: 'Sao Chép', ko: '복사' },
    copied: { en: 'Copied!', es: '¡Copiado!', tl: 'Nakopya!', vi: 'Đã Sao Chép!', ko: '복사됨!' },
    share: { en: 'Share', es: 'Compartir', tl: 'I-share', vi: 'Chia Sẻ', ko: '공유' },
    print: { en: 'Print', es: 'Imprimir', tl: 'I-print', vi: 'In', ko: '인쇄' },
    refresh: { en: 'Refresh', es: 'Actualizar', tl: 'I-refresh', vi: 'Làm Mới', ko: '새로고침' },
    reset: { en: 'Reset', es: 'Restablecer', tl: 'I-reset', vi: 'Đặt Lại', ko: '재설정' },
    confirm: { en: 'Confirm', es: 'Confirmar', tl: 'Kumpirmahin', vi: 'Xác Nhận', ko: '확인' },
    reportBug: { en: 'Report Bug', es: 'Reportar Error', tl: 'Mag-report ng Bug', vi: 'Báo Lỗi', ko: '버그 신고' },
    featureRequest: { en: 'Feature Request', es: 'Solicitar Función', tl: 'Request ng Feature', vi: 'Yêu Cầu Tính Năng', ko: '기능 요청' },
    donate: { en: 'Donate', es: 'Donar', tl: 'Mag-donate', vi: 'Quyên Góp', ko: '기부' },
    supportProject: { en: 'Support This Project', es: 'Apoyar Este Proyecto', tl: 'Suportahan ang Project na Ito', vi: 'Hỗ Trợ Dự Án', ko: '이 프로젝트 지원' },
  },

  // Status Messages
  status: {
    processing: { en: 'Processing...', es: 'Procesando...', tl: 'Pinoproseso...', vi: 'Đang Xử Lý...', ko: '처리 중...' },
    analyzing: { en: 'Analyzing...', es: 'Analizando...', tl: 'Sinusuri...', vi: 'Đang Phân Tích...', ko: '분석 중...' },
    generating: { en: 'Generating...', es: 'Generando...', tl: 'Ginagawa...', vi: 'Đang Tạo...', ko: '생성 중...' },
    saving: { en: 'Saving...', es: 'Guardando...', tl: 'Sine-save...', vi: 'Đang Lưu...', ko: '저장 중...' },
    saved: { en: 'Saved!', es: '¡Guardado!', tl: 'Na-save!', vi: 'Đã Lưu!', ko: '저장됨!' },
    deleted: { en: 'Deleted', es: 'Eliminado', tl: 'Tinanggal', vi: 'Đã Xóa', ko: '삭제됨' },
    updated: { en: 'Updated', es: 'Actualizado', tl: 'Na-update', vi: 'Đã Cập Nhật', ko: '업데이트됨' },
    noResults: { en: 'No results found', es: 'No se encontraron resultados', tl: 'Walang nahanap na resulta', vi: 'Không Tìm Thấy Kết Quả', ko: '결과 없음' },
    errorOccurred: { en: 'An error occurred', es: 'Ocurrió un error', tl: 'May naganap na error', vi: 'Đã Xảy Ra Lỗi', ko: '오류가 발생했습니다' },
    tryAgain: { en: 'Please try again', es: 'Por favor intenta de nuevo', tl: 'Pakisubukan muli', vi: 'Vui Lòng Thử Lại', ko: '다시 시도해 주세요' },
    connectionError: { en: 'Connection error', es: 'Error de conexión', tl: 'Error sa koneksyon', vi: 'Lỗi Kết Nối', ko: '연결 오류' },
    offlineMode: { en: 'Offline mode', es: 'Modo sin conexión', tl: 'Offline mode', vi: 'Chế Độ Ngoại Tuyến', ko: '오프라인 모드' },
  },

  // Form Labels
  formLabels: {
    name: { en: 'Name', es: 'Nombre', tl: 'Pangalan', vi: 'Tên', ko: '이름' },
    email: { en: 'Email', es: 'Correo Electrónico', tl: 'Email', vi: 'Email', ko: '이메일' },
    phone: { en: 'Phone', es: 'Teléfono', tl: 'Telepono', vi: 'Điện Thoại', ko: '전화' },
    address: { en: 'Address', es: 'Dirección', tl: 'Address', vi: 'Địa Chỉ', ko: '주소' },
    date: { en: 'Date', es: 'Fecha', tl: 'Petsa', vi: 'Ngày', ko: '날짜' },
    description: { en: 'Description', es: 'Descripción', tl: 'Paglalarawan', vi: 'Mô Tả', ko: '설명' },
    notes: { en: 'Notes', es: 'Notas', tl: 'Mga Tala', vi: 'Ghi Chú', ko: '메모' },
    comments: { en: 'Comments', es: 'Comentarios', tl: 'Mga Komento', vi: 'Bình Luận', ko: '댓글' },
    required: { en: 'Required', es: 'Requerido', tl: 'Kinakailangan', vi: 'Bắt Buộc', ko: '필수' },
    optional: { en: 'Optional', es: 'Opcional', tl: 'Opsyonal', vi: 'Tùy Chọn', ko: '선택사항' },
    selectOption: { en: 'Select an option', es: 'Selecciona una opción', tl: 'Pumili ng opsyon', vi: 'Chọn Một Tùy Chọn', ko: '옵션 선택' },
    enterText: { en: 'Enter text...', es: 'Ingresa texto...', tl: 'Maglagay ng text...', vi: 'Nhập văn bản...', ko: '텍스트 입력...' },
    searchPlaceholder: { en: 'Search...', es: 'Buscar...', tl: 'Maghanap...', vi: 'Tìm kiếm...', ko: '검색...' },
  },

  // Nexus Builder Component
  nexusBuilder: {
    // Header
    title: { en: 'Nexus Builder', es: 'Constructor de Nexus', tl: 'Nexus Builder', vi: 'Xây Dựng Nexus', ko: '넥서스 빌더' },
    editStatement: { en: 'Edit Statement', es: 'Editar Declaración', tl: 'I-edit ang Statement', vi: 'Chỉnh Sửa Báo Cáo', ko: '진술서 편집' },
    statementFor: { en: 'Statement for:', es: 'Declaración para:', tl: 'Statement para sa:', vi: 'Báo cáo cho:', ko: '진술서 대상:' },
    updatingFor: { en: 'Updating', es: 'Actualizando', tl: 'Ina-update', vi: 'Đang cập nhật', ko: '업데이트 중' },
    secondaryTo: { en: 'Secondary to', es: 'Secundario a', tl: 'Secondary sa', vi: 'Thứ cấp của', ko: '2차 대상' },
    beta: { en: 'BETA', es: 'BETA', tl: 'BETA', vi: 'BETA', ko: '베타' },
    close: { en: 'Close', es: 'Cerrar', tl: 'Isara', vi: 'Đóng', ko: '닫기' },
    
    // Progress
    stepOf: { en: 'Step {current} of {total}', es: 'Paso {current} de {total}', tl: 'Hakbang {current} ng {total}', vi: 'Bước {current} / {total}', ko: '단계 {current} / {total}' },
    complete: { en: 'Complete', es: 'Completo', tl: 'Kumpleto', vi: 'Hoàn thành', ko: '완료' },
    
    // Editing mode notice
    editingMode: { en: 'Editing Mode:', es: 'Modo de Edición:', tl: 'Editing Mode:', vi: 'Chế Độ Chỉnh Sửa:', ko: '편집 모드:' },
    editingModeDesc: { en: 'Your previous answers have been loaded. Make changes as needed.', es: 'Tus respuestas anteriores se han cargado. Haz cambios según sea necesario.', tl: 'Na-load na ang iyong mga nakaraang sagot. Gumawa ng mga pagbabago kung kinakailangan.', vi: 'Câu trả lời trước đó của bạn đã được tải. Thực hiện thay đổi nếu cần.', ko: '이전 답변이 로드되었습니다. 필요에 따라 변경하세요.' },
    
    // AI Tip
    aiTip: { en: 'Tip:', es: 'Consejo:', tl: 'Tip:', vi: 'Mẹo:', ko: '팁:' },
    aiTipText: { en: 'Click the sparkle ✨ icon next to any field for AI writing suggestions!', es: '¡Haz clic en el icono de destello ✨ junto a cualquier campo para sugerencias de escritura con IA!', tl: 'I-click ang sparkle ✨ icon sa tabi ng anumang field para sa AI writing suggestions!', vi: 'Nhấp vào biểu tượng lấp lánh ✨ bên cạnh bất kỳ trường nào để nhận gợi ý viết AI!', ko: 'AI 작성 제안을 받으려면 필드 옆의 반짝임 ✨ 아이콘을 클릭하세요!' },
    
    // Step 1: Timeline
    timelineInfo: { en: 'Timeline Information', es: 'Información de Cronología', tl: 'Timeline Information', vi: 'Thông Tin Dòng Thời Gian', ko: '타임라인 정보' },
    whenFirstNotice: { en: 'When did you first notice symptoms of {condition}?', es: '¿Cuándo notaste por primera vez los síntomas de {condition}?', tl: 'Kailan mo unang napansin ang mga sintomas ng {condition}?', vi: 'Bạn lần đầu tiên nhận thấy triệu chứng của {condition} khi nào?', ko: '{condition}의 증상을 처음 느낀 것은 언제입니까?' },
    onsetPlaceholder: { en: 'e.g., Spring 2020, June 2019, After deployment in 2018', es: 'ej., Primavera 2020, Junio 2019, Después del despliegue en 2018', tl: 'hal., Spring 2020, June 2019, Pagkatapos ng deployment noong 2018', vi: 'ví dụ: Mùa xuân 2020, Tháng 6 năm 2019, Sau khi triển khai năm 2018', ko: '예: 2020년 봄, 2019년 6월, 2018년 배치 후' },
    approximateDates: { en: 'Approximate dates are acceptable', es: 'Las fechas aproximadas son aceptables', tl: 'Ang mga approximate dates ay tinatanggap', vi: 'Ngày tương đối cũng được chấp nhận', ko: '대략적인 날짜도 괜찮습니다' },
    soughtTreatment: { en: 'Have you sought medical treatment for this condition?', es: '¿Has buscado tratamiento médico para esta condición?', tl: 'Naghanap ka ba ng medical treatment para sa kondisyong ito?', vi: 'Bạn đã tìm kiếm điều trị y tế cho tình trạng này chưa?', ko: '이 상태에 대해 치료를 받은 적이 있습니까?' },
    yesVA: { en: 'Yes, through the VA', es: 'Sí, a través del VA', tl: 'Oo, sa pamamagitan ng VA', vi: 'Có, qua VA', ko: '예, VA를 통해' },
    yesPrivate: { en: 'Yes, through private healthcare', es: 'Sí, a través de atención médica privada', tl: 'Oo, sa pamamagitan ng private healthcare', vi: 'Có, qua y tế tư nhân', ko: '예, 민간 의료를 통해' },
    yesBoth: { en: 'Both VA and private', es: 'Tanto VA como privado', tl: 'Pareho ang VA at private', vi: 'Cả VA và tư nhân', ko: 'VA와 민간 모두' },
    noTreatment: { en: 'No formal treatment yet', es: 'Aún no hay tratamiento formal', tl: 'Wala pang pormal na treatment', vi: 'Chưa có điều trị chính thức', ko: '아직 정식 치료 없음' },
    
    // Step 2: Connection (Secondary)
    connectionTitle: { en: 'Connection (Nexus) to Your Service-Connected Condition', es: 'Conexión (Nexus) con Tu Condición Conectada al Servicio', tl: 'Koneksyon (Nexus) sa Iyong Service-Connected Condition', vi: 'Kết Nối (Nexus) với Tình Trạng Liên Quan Đến Phục Vụ', ko: '복무 관련 상태에 대한 연결 (넥서스)' },
    howCausesAggravates: { en: 'How does your {primary} cause or aggravate your {condition}?', es: '¿Cómo tu {primary} causa o agrava tu {condition}?', tl: 'Paano ang iyong {primary} nagiging sanhi o nagpapalala ng iyong {condition}?', vi: '{primary} của bạn gây ra hoặc làm trầm trọng thêm {condition} như thế nào?', ko: '{primary}이(가) {condition}을(를) 유발하거나 악화시키는 방식은?' },
    aggravationStress: { en: 'Stress and anxiety from primary condition causes flare-ups', es: 'El estrés y la ansiedad de la condición primaria causa brotes', tl: 'Ang stress at anxiety mula sa primary condition ay nagdudulot ng flare-ups', vi: 'Căng thẳng và lo âu từ tình trạng chính gây ra các đợt bùng phát', ko: '주요 상태로 인한 스트레스와 불안이 악화를 유발' },
    aggravationMedication: { en: 'Medication side effects from treating primary condition', es: 'Efectos secundarios de medicamentos para tratar la condición primaria', tl: 'Medication side effects mula sa paggamot ng primary condition', vi: 'Tác dụng phụ của thuốc điều trị tình trạng chính', ko: '주요 상태 치료를 위한 약물 부작용' },
    aggravationPhysical: { en: 'Physical limitations or compensatory behaviors', es: 'Limitaciones físicas o comportamientos compensatorios', tl: 'Physical limitations o compensatory behaviors', vi: 'Hạn chế thể chất hoặc hành vi bù đắp', ko: '신체적 제한 또는 보상 행동' },
    aggravationSleep: { en: 'Sleep disruption from primary condition', es: 'Interrupción del sueño por la condición primaria', tl: 'Sleep disruption mula sa primary condition', vi: 'Rối loạn giấc ngủ từ tình trạng chính', ko: '주요 상태로 인한 수면 장애' },
    aggravationWeight: { en: 'Weight gain or metabolic changes', es: 'Aumento de peso o cambios metabólicos', tl: 'Weight gain o metabolic changes', vi: 'Tăng cân hoặc thay đổi chuyển hóa', ko: '체중 증가 또는 대사 변화' },
    aggravationInflammation: { en: 'Chronic inflammation or immune dysfunction', es: 'Inflamación crónica o disfunción inmune', tl: 'Chronic inflammation o immune dysfunction', vi: 'Viêm mãn tính hoặc rối loạn miễn dịch', ko: '만성 염증 또는 면역 기능 장애' },
    aggravationOther: { en: 'Other (please explain below)', es: 'Otro (por favor explica abajo)', tl: 'Iba pa (pakipaliwanag sa ibaba)', vi: 'Khác (vui lòng giải thích bên dưới)', ko: '기타 (아래에 설명해 주세요)' },
    explainInOwnWords: { en: 'Explain in your own words how {primary} affects your {condition}:', es: 'Explica con tus propias palabras cómo {primary} afecta tu {condition}:', tl: 'Ipaliwanag sa sarili mong mga salita kung paano ang {primary} ay nakakaapekto sa iyong {condition}:', vi: 'Giải thích bằng lời của bạn cách {primary} ảnh hưởng đến {condition} của bạn:', ko: '{primary}이(가) {condition}에 어떤 영향을 미치는지 자신의 말로 설명하세요:' },
    explainPlaceholder: { en: 'Example: My PTSD causes severe anxiety and hypervigilance, which prevents me from falling asleep and staying asleep. The constant state of alertness disrupts my breathing patterns during sleep...', es: 'Ejemplo: Mi TEPT causa ansiedad severa e hipervigilancia, lo que me impide conciliar y mantener el sueño...', tl: 'Halimbawa: Ang PTSD ko ay nagdudulot ng matinding anxiety at hypervigilance, na pumipigil sa akin na makatulog at manatiling tulog...', vi: 'Ví dụ: PTSD của tôi gây ra lo âu nghiêm trọng và cảnh giác cao độ, ngăn tôi ngủ và duy trì giấc ngủ...', ko: '예: 제 PTSD는 심한 불안과 과각성을 유발하여 잠들고 수면을 유지하는 것을 방해합니다...' },
    describeIncident: { en: 'Describe a specific recent incident where these two conditions interacted:', es: 'Describe un incidente reciente específico donde estas dos condiciones interactuaron:', tl: 'Ilarawan ang isang partikular na kamakailang insidente kung saan ang dalawang kondisyong ito ay nag-interact:', vi: 'Mô tả một sự việc cụ thể gần đây khi hai tình trạng này tương tác:', ko: '이 두 상태가 상호 작용한 최근 사건을 구체적으로 설명하세요:' },
    incidentPlaceholder: { en: 'Example: Last month, I had a PTSD episode triggered by fireworks. That night, my sleep apnea symptoms worsened significantly - I woke up gasping for air multiple times, which my partner witnessed...', es: 'Ejemplo: El mes pasado, tuve un episodio de TEPT provocado por fuegos artificiales. Esa noche, mis síntomas de apnea del sueño empeoraron significativamente...', tl: 'Halimbawa: Noong nakaraang buwan, nagkaroon ako ng PTSD episode na na-trigger ng fireworks. Nang gabing iyon, lumala ang mga sintomas ng aking sleep apnea...', vi: 'Ví dụ: Tháng trước, tôi bị cơn PTSD do pháo hoa kích hoạt. Đêm đó, các triệu chứng ngưng thở khi ngủ của tôi trở nên tồi tệ hơn đáng kể...', ko: '예: 지난 달, 불꽃놀이로 인해 PTSD 에피소드가 발생했습니다. 그날 밤, 수면 무호흡증 증상이 크게 악화되었습니다...' },
    
    // Step 3: Severity
    severityTitle: { en: 'Severity and Daily Impact', es: 'Severidad e Impacto Diario', tl: 'Kalubhaan at Pang-araw-araw na Epekto', vi: 'Mức Độ Nghiêm Trọng và Tác Động Hàng Ngày', ko: '심각도 및 일상 영향' },
    howAffectsWork: { en: 'How does {condition} affect your ability to work?', es: '¿Cómo afecta {condition} tu capacidad de trabajar?', tl: 'Paano nakakaapekto ang {condition} sa kakayahan mong magtrabaho?', vi: '{condition} ảnh hưởng đến khả năng làm việc của bạn như thế nào?', ko: '{condition}이(가) 일할 수 있는 능력에 어떤 영향을 미칩니까?' },
    workPlaceholder: { en: 'Example: I have difficulty concentrating due to fatigue from poor sleep. I\'ve missed 15+ days of work in the past year. My supervisor has documented performance issues related to exhaustion...', es: 'Ejemplo: Tengo dificultad para concentrarme debido a la fatiga por mal sueño. He faltado más de 15 días de trabajo en el último año...', tl: 'Halimbawa: Nahihirapan akong mag-concentrate dahil sa pagkapagod mula sa masamang tulog. Nag-miss ako ng 15+ araw ng trabaho sa nakaraang taon...', vi: 'Ví dụ: Tôi khó tập trung do mệt mỏi vì ngủ kém. Tôi đã nghỉ làm hơn 15 ngày trong năm qua...', ko: '예: 수면 부족으로 인한 피로로 집중하기 어렵습니다. 지난 1년간 15일 이상 결근했습니다...' },
    howAffectsSocial: { en: 'How does {condition} affect your social and family life?', es: '¿Cómo afecta {condition} tu vida social y familiar?', tl: 'Paano nakakaapekto ang {condition} sa iyong social at family life?', vi: '{condition} ảnh hưởng đến đời sống xã hội và gia đình của bạn như thế nào?', ko: '{condition}이(가) 사회 및 가정생활에 어떤 영향을 미칩니까?' },
    socialPlaceholder: { en: 'Example: I avoid social gatherings because I\'m exhausted. My spouse says I\'m irritable and moody due to poor sleep. I\'ve had to stop participating in activities I used to enjoy...', es: 'Ejemplo: Evito reuniones sociales porque estoy agotado. Mi cónyuge dice que estoy irritable y de mal humor debido al mal sueño...', tl: 'Halimbawa: Iniiwasan ko ang mga social gatherings dahil pagod ako. Sabi ng asawa ko, irritable at moody ako dahil sa masamang tulog...', vi: 'Ví dụ: Tôi tránh các cuộc tụ họp xã hội vì kiệt sức. Vợ/chồng tôi nói tôi cáu kỉnh và hay thay đổi tâm trạng do ngủ kém...', ko: '예: 피곤해서 사교 모임을 피합니다. 배우자는 수면 부족으로 제가 짜증이 많고 기분이 변덕스럽다고 합니다...' },
    specificExamples: { en: 'Provide specific examples of how this condition limits your daily activities:', es: 'Proporciona ejemplos específicos de cómo esta condición limita tus actividades diarias:', tl: 'Magbigay ng mga partikular na halimbawa kung paano nililimitahan ng kondisyong ito ang iyong pang-araw-araw na aktibidad:', vi: 'Cung cấp các ví dụ cụ thể về cách tình trạng này hạn chế các hoạt động hàng ngày của bạn:', ko: '이 상태가 일상 활동을 어떻게 제한하는지 구체적인 예를 제공하세요:' },
    examplesPlaceholder: { en: 'Example: I can no longer drive long distances safely due to fatigue. I need to take frequent breaks during simple tasks. My memory and focus have noticeably declined...', es: 'Ejemplo: Ya no puedo conducir largas distancias de forma segura debido a la fatiga. Necesito tomar descansos frecuentes durante tareas simples...', tl: 'Halimbawa: Hindi na ako makapag-drive ng matagal na distansya nang ligtas dahil sa pagkapagod. Kailangan kong mag-break nang madalas sa mga simpleng gawain...', vi: 'Ví dụ: Tôi không còn có thể lái xe đường dài an toàn do mệt mỏi. Tôi cần nghỉ ngơi thường xuyên trong các công việc đơn giản...', ko: '예: 피로로 인해 더 이상 장거리 운전을 안전하게 할 수 없습니다. 간단한 작업 중에도 자주 휴식이 필요합니다...' },
    
    // Step 4: Review
    reviewTitle: { en: 'Review Your Statement', es: 'Revisa Tu Declaración', tl: 'Suriin ang Iyong Statement', vi: 'Xem Lại Báo Cáo Của Bạn', ko: '진술서 검토' },
    enhanceWithAI: { en: 'Enhance with AI', es: 'Mejorar con IA', tl: 'Pahusayin gamit ang AI', vi: 'Nâng cao với AI', ko: 'AI로 향상' },
    aiIsWriting: { en: 'AI is writing...', es: 'La IA está escribiendo...', tl: 'Nagsusulat ang AI...', vi: 'AI đang viết...', ko: 'AI가 작성 중...' },
    versionLabel: { en: 'Version:', es: 'Versión:', tl: 'Bersyon:', vi: 'Phiên bản:', ko: '버전:' },
    standardVersion: { en: 'Standard', es: 'Estándar', tl: 'Standard', vi: 'Tiêu chuẩn', ko: '표준' },
    aiEnhanced: { en: 'AI Enhanced', es: 'Mejorado con IA', tl: 'AI Enhanced', vi: 'Đã Nâng Cao AI', ko: 'AI 향상' },
    aiPoweredBy: { en: 'AI-enhanced statement • Powered by Google Gemini • Review before downloading', es: 'Declaración mejorada con IA • Impulsado por Google Gemini • Revisa antes de descargar', tl: 'AI-enhanced statement • Powered by Google Gemini • Suriin bago i-download', vi: 'Báo cáo được AI nâng cao • Hỗ trợ bởi Google Gemini • Xem lại trước khi tải xuống', ko: 'AI 향상 진술서 • Google Gemini 제공 • 다운로드 전 검토' },
    tryAgain: { en: 'Try again', es: 'Intentar de nuevo', tl: 'Subukan muli', vi: 'Thử lại', ko: '다시 시도' },
    statementFormTitle: { en: 'Statement in Support of Claim (VA Form 21-4138)', es: 'Declaración en Apoyo del Reclamo (VA Form 21-4138)', tl: 'Statement sa Suporta ng Claim (VA Form 21-4138)', vi: 'Báo Cáo Hỗ Trợ Yêu Cầu (VA Form 21-4138)', ko: '청구 지원 진술서 (VA 양식 21-4138)' },
    doctorsCheatSheet: { en: "Doctor's Cheat Sheet", es: 'Guía del Doctor', tl: "Doctor's Cheat Sheet", vi: 'Bảng Hướng Dẫn Bác Sĩ', ko: '의사용 요약 시트' },
    doctorsCheatSheetDesc: { en: 'Hand this to your healthcare provider to help them document the nexus', es: 'Entrega esto a tu proveedor de salud para ayudarles a documentar el nexo', tl: 'Ibigay ito sa iyong healthcare provider para tulungan silang i-dokumento ang nexus', vi: 'Đưa tài liệu này cho nhà cung cấp dịch vụ y tế để giúp họ ghi nhận mối liên kết', ko: '의료진이 넥서스를 문서화하는 데 도움이 되도록 전달하세요' },
    
    // Doctor's Packet
    doctorsPacketTitle: { en: "Doctor's Packet Generator (AI)", es: 'Generador de Paquete Médico (IA)', tl: "Doctor's Packet Generator (AI)", vi: 'Công Cụ Tạo Gói Bác Sĩ (AI)', ko: '의사 패킷 생성기 (AI)' },
    doctorsPacketDesc: { en: 'Generate a comprehensive medical research brief explaining the pathophysiological connection between {primary} and {secondary}. Includes medical literature references and a physician template letter.', es: 'Genera un informe de investigación médica completo que explica la conexión fisiopatológica entre {primary} y {secondary}. Incluye referencias de literatura médica y una carta modelo para el médico.', tl: 'Gumawa ng komprehensibong medical research brief na nagpapaliwanag ng pathophysiological connection sa pagitan ng {primary} at {secondary}. Kasama ang medical literature references at physician template letter.', vi: 'Tạo tài liệu nghiên cứu y tế toàn diện giải thích mối liên kết sinh lý bệnh giữa {primary} và {secondary}. Bao gồm tài liệu y khoa và mẫu thư cho bác sĩ.', ko: '{primary}과(와) {secondary} 사이의 병태생리학적 연결을 설명하는 포괄적인 의료 연구 요약을 생성합니다. 의학 문헌 참조 및 의사용 템플릿 서신이 포함됩니다.' },
    generateDoctorsPacket: { en: "Generate Doctor's Packet", es: 'Generar Paquete Médico', tl: "Gumawa ng Doctor's Packet", vi: 'Tạo Gói Bác Sĩ', ko: '의사 패킷 생성' },
    
    // AI Help button
    aiHelp: { en: 'AI Help', es: 'Ayuda de IA', tl: 'AI Help', vi: 'Trợ Giúp AI', ko: 'AI 도움' },
    writing: { en: 'Writing...', es: 'Escribiendo...', tl: 'Nagsusulat...', vi: 'Đang viết...', ko: '작성 중...' },
    
    // Navigation buttons
    back: { en: 'Back', es: 'Atrás', tl: 'Bumalik', vi: 'Quay lại', ko: '뒤로' },
    nextStep: { en: 'Next Step', es: 'Siguiente Paso', tl: 'Susunod na Hakbang', vi: 'Bước Tiếp Theo', ko: '다음 단계' },
    downloadStatement: { en: 'Download Statement', es: 'Descargar Declaración', tl: 'I-download ang Statement', vi: 'Tải Xuống Báo Cáo', ko: '진술서 다운로드' },
    saveToPacket: { en: 'Save to Packet', es: 'Guardar en Paquete', tl: 'I-save sa Packet', vi: 'Lưu Vào Hồ Sơ', ko: '패킷에 저장' },
    
    // Download menu
    textFormat: { en: 'Text (.txt)', es: 'Texto (.txt)', tl: 'Text (.txt)', vi: 'Văn bản (.txt)', ko: '텍스트 (.txt)' },
    wordFormat: { en: 'Word (.docx)', es: 'Word (.docx)', tl: 'Word (.docx)', vi: 'Word (.docx)', ko: 'Word (.docx)' },
    pdfFormat: { en: 'PDF (.pdf)', es: 'PDF (.pdf)', tl: 'PDF (.pdf)', vi: 'PDF (.pdf)', ko: 'PDF (.pdf)' },
    
    // Certification
    certifyBeforeDownload: { en: 'Please certify that you have reviewed this document first', es: 'Por favor certifica que has revisado este documento primero', tl: 'Pakikumpirma na nasuri mo na ang dokumentong ito', vi: 'Vui lòng xác nhận rằng bạn đã xem lại tài liệu này trước', ko: '먼저 이 문서를 검토했음을 인증해 주세요' },
    
    // Error messages
    noApiKey: { en: 'No API key configured. Add your Gemini API key in Settings to use AI assistance.', es: 'Sin clave API configurada. Agrega tu clave API de Gemini en Configuración para usar asistencia de IA.', tl: 'Walang naka-configure na API key. Idagdag ang iyong Gemini API key sa Settings para magamit ang AI assistance.', vi: 'Chưa cấu hình khóa API. Thêm khóa API Gemini của bạn trong Cài đặt để sử dụng trợ giúp AI.', ko: 'API 키가 구성되지 않았습니다. AI 지원을 사용하려면 설정에서 Gemini API 키를 추가하세요.' },
    fieldHelpError: { en: 'Failed to generate suggestion. Please try again.', es: 'Error al generar sugerencia. Por favor intenta de nuevo.', tl: 'Nabigo sa paglikha ng suhestiyon. Subukan muli.', vi: 'Không thể tạo gợi ý. Vui lòng thử lại.', ko: '제안을 생성하지 못했습니다. 다시 시도해 주세요.' },
    aiEnhanceError: { en: 'An unexpected error occurred. Please try again or use the standard template.', es: 'Ocurrió un error inesperado. Por favor intenta de nuevo o usa la plantilla estándar.', tl: 'May hindi inaasahang error na naganap. Subukan muli o gamitin ang standard template.', vi: 'Đã xảy ra lỗi không mong muốn. Vui lòng thử lại hoặc sử dụng mẫu tiêu chuẩn.', ko: '예기치 않은 오류가 발생했습니다. 다시 시도하거나 표준 템플릿을 사용하세요.' },
  },

  // VSO Finder Component
  vsoFinder: {
    // Header
    title: { en: 'VSO Finder', es: 'Buscador de VSO', tl: 'VSO Finder', vi: 'Tìm VSO', ko: 'VSO 찾기' },
    subtitle: { en: 'Find FREE, Accredited Help Near You', es: 'Encuentra Ayuda GRATUITA y Acreditada Cerca de Ti', tl: 'Maghanap ng LIBRENG, Accredited na Tulong Malapit sa Iyo', vi: 'Tìm Trợ Giúp MIỄN PHÍ, Được Công Nhận Gần Bạn', ko: '가까운 무료 공인 도움 찾기' },
    close: { en: 'Close', es: 'Cerrar', tl: 'Isara', vi: 'Đóng', ko: '닫기' },
    
    // Warning Banner
    bewareClaimSharks: { en: 'BEWARE OF CLAIM SHARKS!', es: '¡CUIDADO CON LOS ESTAFADORES DE RECLAMOS!', tl: 'MAG-INGAT SA MGA CLAIM SHARKS!', vi: 'CẢNH GIÁC VỚI NHỮNG KẺ LỪA ĐẢO!', ko: '청구 사기꾼을 조심하세요!' },
    neverPayFees: { en: 'NEVER pay fees for filing an initial VA disability claim!', es: '¡NUNCA pagues por presentar un reclamo inicial de discapacidad del VA!', tl: 'HUWAG kailanman magbayad para mag-file ng initial VA disability claim!', vi: 'KHÔNG BAO GIỜ trả phí để nộp đơn yêu cầu khuyết tật VA ban đầu!', ko: '초기 VA 장애 청구 제출에 절대 비용을 지불하지 마세요!' },
    legitimateVSOsFree: { en: 'Legitimate VSOs provide FREE assistance. If someone asks for money upfront to file your claim, they are likely a predatory "Claim Shark."', es: 'Los VSO legítimos proporcionan asistencia GRATUITA. Si alguien te pide dinero por adelantado para presentar tu reclamo, probablemente sea un "Estafador de Reclamos."', tl: 'Ang mga lehitimong VSO ay nagbibigay ng LIBRENG tulong. Kung may humihingi ng pera upfront para i-file ang iyong claim, malamang na "Claim Shark" sila.', vi: 'Các VSO hợp pháp cung cấp hỗ trợ MIỄN PHÍ. Nếu ai đó yêu cầu tiền trước để nộp đơn yêu cầu của bạn, họ có thể là "Kẻ Lừa Đảo."', ko: '합법적인 VSO는 무료 지원을 제공합니다. 누군가 청구 제출을 위해 선불을 요구하면 약탈적인 "청구 사기꾼"일 가능성이 높습니다.' },
    alwaysVerify: { en: 'Always verify your representative is ACCREDITED with the VA before signing any appointment forms.', es: 'Siempre verifica que tu representante esté ACREDITADO con el VA antes de firmar cualquier formulario.', tl: 'Laging i-verify na ang representative mo ay ACCREDITED sa VA bago pumirma ng anumang appointment forms.', vi: 'Luôn xác minh đại diện của bạn được VA CÔNG NHẬN trước khi ký bất kỳ mẫu đơn ủy quyền nào.', ko: '약속 양식에 서명하기 전에 대리인이 VA에 공인되었는지 항상 확인하세요.' },
    
    // Search Form
    findAccreditedHelp: { en: 'Find Accredited Help', es: 'Encuentra Ayuda Acreditada', tl: 'Maghanap ng Accredited na Tulong', vi: 'Tìm Trợ Giúp Được Công Nhận', ko: '공인 도움 찾기' },
    yourZipCode: { en: 'Your ZIP Code', es: 'Tu Código Postal', tl: 'Ang Iyong ZIP Code', vi: 'Mã Bưu Điện Của Bạn', ko: '우편번호' },
    enterZipCode: { en: 'Enter 5-digit ZIP code', es: 'Ingresa código postal de 5 dígitos', tl: 'Ilagay ang 5-digit na ZIP code', vi: 'Nhập mã bưu điện 5 chữ số', ko: '5자리 우편번호 입력' },
    searchOfficialVA: { en: 'Search Official VA Database', es: 'Buscar en Base de Datos Oficial del VA', tl: 'Maghanap sa Official VA Database', vi: 'Tìm Trong Cơ Sở Dữ Liệu Chính Thức VA', ko: '공식 VA 데이터베이스 검색' },
    findLocalVSOsAI: { en: 'Find Local VSOs via AI', es: 'Encontrar VSOs Locales con IA', tl: 'Maghanap ng Local VSOs gamit ang AI', vi: 'Tìm VSO Địa Phương qua AI', ko: 'AI로 지역 VSO 찾기' },
    searching: { en: 'Searching...', es: 'Buscando...', tl: 'Naghahanap...', vi: 'Đang tìm kiếm...', ko: '검색 중...' },
    officialVADisclaimer: { en: 'The Official VA Database is the authoritative source. AI results should be verified.', es: 'La Base de Datos Oficial del VA es la fuente autorizada. Los resultados de IA deben verificarse.', tl: 'Ang Official VA Database ang authoritative source. Dapat i-verify ang AI results.', vi: 'Cơ sở dữ liệu VA chính thức là nguồn có thẩm quyền. Kết quả AI nên được xác minh.', ko: '공식 VA 데이터베이스가 권위 있는 출처입니다. AI 결과는 확인이 필요합니다.' },
    
    // AI Consultation
    askAIAboutVSO: { en: 'Ask AI About VSO Representation', es: 'Pregunta a la IA Sobre Representación VSO', tl: 'Magtanong sa AI Tungkol sa VSO Representation', vi: 'Hỏi AI Về Đại Diện VSO', ko: 'VSO 대표에 대해 AI에게 문의' },
    aiConsultationDesc: { en: 'Have questions about VSOs, accreditation, or how to choose representation? Ask our AI advisor.', es: '¿Tienes preguntas sobre VSOs, acreditación o cómo elegir representación? Pregunta a nuestro asesor de IA.', tl: 'May mga tanong tungkol sa VSOs, accreditation, o kung paano pumili ng representation? Magtanong sa aming AI advisor.', vi: 'Có câu hỏi về VSO, chứng nhận hoặc cách chọn đại diện? Hỏi cố vấn AI của chúng tôi.', ko: 'VSO, 인증 또는 대리인 선택에 대한 질문이 있으신가요? AI 고문에게 문의하세요.' },
    aiQuestionPlaceholder: { en: "Example: What's the difference between a County VSO and a National VSO like DAV?", es: '¿Cuál es la diferencia entre un VSO del Condado y un VSO Nacional como DAV?', tl: 'Halimbawa: Ano ang pagkakaiba ng County VSO at National VSO tulad ng DAV?', vi: 'Ví dụ: Sự khác biệt giữa VSO Quận và VSO Quốc gia như DAV là gì?', ko: '예: 카운티 VSO와 DAV 같은 전국 VSO의 차이점은 무엇인가요?' },
    consultingAI: { en: 'Consulting AI...', es: 'Consultando IA...', tl: 'Kinokonsulta ang AI...', vi: 'Đang tham vấn AI...', ko: 'AI 상담 중...' },
    getAIAdvice: { en: 'Get AI Advice', es: 'Obtener Consejo de IA', tl: 'Kumuha ng AI Advice', vi: 'Nhận Lời Khuyên AI', ko: 'AI 조언 받기' },
    aiAdvisorResponse: { en: 'AI Advisor Response:', es: 'Respuesta del Asesor de IA:', tl: 'Sagot ng AI Advisor:', vi: 'Phản Hồi Cố Vấn AI:', ko: 'AI 고문 응답:' },
    
    // Error Messages
    invalidZipCode: { en: 'Please enter a valid 5-digit ZIP code.', es: 'Por favor ingresa un código postal válido de 5 dígitos.', tl: 'Pakiusap maglagay ng valid na 5-digit na ZIP code.', vi: 'Vui lòng nhập mã bưu điện 5 chữ số hợp lệ.', ko: '유효한 5자리 우편번호를 입력해 주세요.' },
    aiNotAvailable: { en: 'AI features are not available. Please add your Gemini API key in Settings to use the AI Locator.', es: 'Las funciones de IA no están disponibles. Agrega tu clave API de Gemini en Configuración para usar el Localizador de IA.', tl: 'Hindi available ang AI features. Idagdag ang iyong Gemini API key sa Settings para magamit ang AI Locator.', vi: 'Tính năng AI không khả dụng. Vui lòng thêm khóa API Gemini trong Cài đặt để sử dụng Trình định vị AI.', ko: 'AI 기능을 사용할 수 없습니다. AI 로케이터를 사용하려면 설정에서 Gemini API 키를 추가하세요.' },
    searchFailed: { en: 'Failed to find VSOs. Please try the official VA search.', es: 'Error al buscar VSOs. Por favor intenta la búsqueda oficial del VA.', tl: 'Nabigo sa paghahanap ng VSOs. Subukan ang official VA search.', vi: 'Không tìm được VSO. Vui lòng thử tìm kiếm VA chính thức.', ko: 'VSO를 찾지 못했습니다. 공식 VA 검색을 시도해 주세요.' },
    errorOccurred: { en: 'An error occurred. Please try the official VA search instead.', es: 'Ocurrió un error. Por favor intenta la búsqueda oficial del VA.', tl: 'May error na naganap. Subukan ang official VA search.', vi: 'Đã xảy ra lỗi. Vui lòng thử tìm kiếm VA chính thức.', ko: '오류가 발생했습니다. 대신 공식 VA 검색을 시도해 주세요.' },
    aiConsultationError: { en: 'An error occurred during AI consultation.', es: 'Ocurrió un error durante la consulta de IA.', tl: 'May error na naganap sa AI consultation.', vi: 'Đã xảy ra lỗi trong quá trình tư vấn AI.', ko: 'AI 상담 중 오류가 발생했습니다.' },
    aiRequiresKey: { en: 'AI features require an API key. Please configure AI in Settings.', es: 'Las funciones de IA requieren una clave API. Configura la IA en Configuración.', tl: 'Ang AI features ay nangangailangan ng API key. I-configure ang AI sa Settings.', vi: 'Tính năng AI yêu cầu khóa API. Vui lòng cấu hình AI trong Cài đặt.', ko: 'AI 기능에는 API 키가 필요합니다. 설정에서 AI를 구성하세요.' },
    failedAIResponse: { en: 'Failed to get AI response.', es: 'Error al obtener respuesta de IA.', tl: 'Nabigo sa pagkuha ng AI response.', vi: 'Không nhận được phản hồi AI.', ko: 'AI 응답을 받지 못했습니다.' },
    
    // Results Display
    localVSOsNear: { en: 'Local VSOs Near', es: 'VSOs Locales Cerca de', tl: 'Local VSOs Malapit sa', vi: 'VSO Địa Phương Gần', ko: '근처 지역 VSO' },
    found: { en: 'found', es: 'encontrados', tl: 'nahanap', vi: 'đã tìm thấy', ko: '발견됨' },
    nationalVSOResources: { en: 'National VSO Resources', es: 'Recursos Nacionales de VSO', tl: 'National VSO Resources', vi: 'Tài Nguyên VSO Quốc Gia', ko: '전국 VSO 자원' },
    findLocalOffice: { en: 'Find Local Office', es: 'Encontrar Oficina Local', tl: 'Maghanap ng Local Office', vi: 'Tìm Văn Phòng Địa Phương', ko: '지역 사무소 찾기' },
    visitWebsite: { en: 'Visit Website', es: 'Visitar Sitio Web', tl: 'Bisitahin ang Website', vi: 'Truy Cập Trang Web', ko: '웹사이트 방문' },
    
    // Organization Types
    countyVSO: { en: 'County VSO', es: 'VSO del Condado', tl: 'County VSO', vi: 'VSO Quận', ko: '카운티 VSO' },
    stateVAOffice: { en: 'State VA Office', es: 'Oficina Estatal del VA', tl: 'State VA Office', vi: 'Văn Phòng VA Tiểu Bang', ko: '주 VA 사무소' },
    nationalOrganization: { en: 'National Organization', es: 'Organización Nacional', tl: 'National Organization', vi: 'Tổ Chức Quốc Gia', ko: '전국 조직' },
    
    // Verification Section
    verifyAccreditation: { en: 'Verify Accreditation', es: 'Verificar Acreditación', tl: 'I-verify ang Accreditation', vi: 'Xác Minh Chứng Nhận', ko: '인증 확인' },
    alwaysConfirmVSO: { en: 'Always confirm your VSO is officially accredited', es: 'Siempre confirma que tu VSO está oficialmente acreditado', tl: 'Laging kumpirmahin na ang VSO mo ay opisyal na accredited', vi: 'Luôn xác nhận VSO của bạn được công nhận chính thức', ko: '항상 VSO가 공식적으로 인증되었는지 확인하세요' },
    verifyAtVA: { en: 'Verify at VA.gov', es: 'Verificar en VA.gov', tl: 'I-verify sa VA.gov', vi: 'Xác Minh tại VA.gov', ko: 'VA.gov에서 확인' },
    
    // Disclaimer
    disclaimer: { en: 'Disclaimer:', es: 'Aviso:', tl: 'Disclaimer:', vi: 'Tuyên bố từ chối:', ko: '면책조항:' },
    disclaimerText: { en: 'This information is provided for educational purposes. AI-generated results may not be complete or current. Always verify VSO information and accreditation status through the official VA database before signing any appointment forms.', es: 'Esta información se proporciona con fines educativos. Los resultados generados por IA pueden no estar completos o actualizados. Siempre verifica la información del VSO y el estado de acreditación a través de la base de datos oficial del VA antes de firmar cualquier formulario.', tl: 'Ang impormasyong ito ay ibinibigay para sa educational purposes. Ang AI-generated results ay maaaring hindi kumpleto o kasalukuyan. Laging i-verify ang VSO information at accreditation status sa official VA database bago pumirma ng anumang appointment forms.', vi: 'Thông tin này được cung cấp cho mục đích giáo dục. Kết quả do AI tạo có thể không đầy đủ hoặc cập nhật. Luôn xác minh thông tin VSO và trạng thái chứng nhận qua cơ sở dữ liệu VA chính thức trước khi ký bất kỳ mẫu đơn ủy quyền nào.', ko: '이 정보는 교육 목적으로 제공됩니다. AI 생성 결과가 완전하거나 최신이 아닐 수 있습니다. 약속 양식에 서명하기 전에 항상 공식 VA 데이터베이스를 통해 VSO 정보와 인증 상태를 확인하세요.' },
    
    // Loading State
    searchingForVSOs: { en: 'Searching for VSOs near', es: 'Buscando VSOs cerca de', tl: 'Naghahanap ng VSOs malapit sa', vi: 'Đang tìm VSO gần', ko: 'VSO 검색 중' },
    findingAccredited: { en: 'Finding accredited representatives in your area', es: 'Encontrando representantes acreditados en tu área', tl: 'Naghahanap ng accredited representatives sa iyong area', vi: 'Tìm đại diện được công nhận trong khu vực của bạn', ko: '귀하 지역의 공인 대리인 찾기' },
    checkingCountyVSOs: { en: 'Checking County VSOs...', es: 'Verificando VSOs del Condado...', tl: 'Sinusuri ang County VSOs...', vi: 'Đang kiểm tra VSO Quận...', ko: '카운티 VSO 확인 중...' },
    findingStateVA: { en: 'Finding State VA Offices...', es: 'Encontrando Oficinas Estatales del VA...', tl: 'Naghahanap ng State VA Offices...', vi: 'Đang tìm Văn phòng VA Tiểu Bang...', ko: '주 VA 사무소 찾는 중...' },
    locatingNationalOrgs: { en: 'Locating National Organizations...', es: 'Localizando Organizaciones Nacionales...', tl: 'Hinahanap ang National Organizations...', vi: 'Đang tìm Tổ chức Quốc gia...', ko: '전국 조직 찾는 중...' },
    usuallyTakes: { en: 'This usually takes 10-30 seconds', es: 'Esto generalmente toma 10-30 segundos', tl: 'Karaniwang tumatagal ng 10-30 segundo', vi: 'Thường mất 10-30 giây', ko: '보통 10-30초 소요됩니다' },
    
    // Empty State
    enterZipToFind: { en: 'Enter your ZIP code to find help near you', es: 'Ingresa tu código postal para encontrar ayuda cerca de ti', tl: 'Ilagay ang iyong ZIP code para mahanap ang tulong malapit sa iyo', vi: 'Nhập mã bưu điện để tìm trợ giúp gần bạn', ko: '가까운 도움을 찾으려면 우편번호를 입력하세요' },
    willHelpFind: { en: "We'll help you find County VSOs, State VA Offices, and National Organizations like DAV, VFW, and American Legion", es: 'Te ayudaremos a encontrar VSOs del Condado, Oficinas Estatales del VA y Organizaciones Nacionales como DAV, VFW y American Legion', tl: 'Tutulungan ka naming mahanap ang County VSOs, State VA Offices, at National Organizations tulad ng DAV, VFW, at American Legion', vi: 'Chúng tôi sẽ giúp bạn tìm VSO Quận, Văn phòng VA Tiểu Bang và các Tổ chức Quốc gia như DAV, VFW và American Legion', ko: '카운티 VSO, 주 VA 사무소 및 DAV, VFW, American Legion과 같은 전국 조직을 찾는 데 도움을 드리겠습니다' },
    
    // What is a VSO section
    whatIsVSO: { en: 'What is a VSO?', es: '¿Qué es un VSO?', tl: 'Ano ang VSO?', vi: 'VSO là gì?', ko: 'VSO란 무엇인가요?' },
    vsoExplanation: { en: 'Veterans Service Organizations (VSOs) are non-profit organizations that provide FREE assistance to veterans with VA claims. They employ accredited representatives who can legally represent you before the VA.', es: 'Las Organizaciones de Servicios para Veteranos (VSOs) son organizaciones sin fines de lucro que brindan asistencia GRATUITA a veteranos con reclamos del VA. Emplean representantes acreditados que pueden representarte legalmente ante el VA.', tl: 'Ang Veterans Service Organizations (VSOs) ay non-profit organizations na nagbibigay ng LIBRENG tulong sa mga veterans sa VA claims. Gumagamit sila ng accredited representatives na maaaring legal na kumatawan sa iyo sa VA.', vi: 'Các Tổ chức Dịch vụ Cựu chiến binh (VSO) là các tổ chức phi lợi nhuận cung cấp hỗ trợ MIỄN PHÍ cho cựu chiến binh với các yêu cầu VA. Họ sử dụng các đại diện được công nhận có thể đại diện hợp pháp cho bạn trước VA.', ko: '재향군인 서비스 조직(VSO)은 VA 청구에 대해 재향군인에게 무료 지원을 제공하는 비영리 조직입니다. 그들은 VA 앞에서 법적으로 귀하를 대리할 수 있는 공인 대리인을 고용합니다.' },
    commonVSOs: { en: 'Common VSOs include:', es: 'Los VSOs comunes incluyen:', tl: 'Kasama sa mga karaniwang VSO:', vi: 'Các VSO phổ biến bao gồm:', ko: '일반적인 VSO에는 다음이 포함됩니다:' },
    commonVSOsList: { en: 'Disabled American Veterans (DAV), Veterans of Foreign Wars (VFW), American Legion, and your County Veterans Service Office.', es: 'Disabled American Veterans (DAV), Veterans of Foreign Wars (VFW), American Legion y la Oficina de Servicios para Veteranos de tu Condado.', tl: 'Disabled American Veterans (DAV), Veterans of Foreign Wars (VFW), American Legion, at ang County Veterans Service Office mo.', vi: 'Disabled American Veterans (DAV), Veterans of Foreign Wars (VFW), American Legion và Văn phòng Dịch vụ Cựu chiến binh Quận của bạn.', ko: 'Disabled American Veterans (DAV), Veterans of Foreign Wars (VFW), American Legion 및 귀하의 카운티 재향군인 서비스 사무소.' },
    whyUseVSO: { en: 'Why use a VSO?', es: '¿Por qué usar un VSO?', tl: 'Bakit gumamit ng VSO?', vi: 'Tại sao sử dụng VSO?', ko: '왜 VSO를 사용해야 하나요?' },
    whyUseVSOText: { en: "They know the VA system, can access your records, attend hearings with you, and help ensure you get the benefits you've earned - all at NO COST.", es: 'Conocen el sistema del VA, pueden acceder a tus registros, asistir a audiencias contigo y ayudar a asegurar que obtengas los beneficios que te has ganado - todo SIN COSTO.', tl: 'Alam nila ang VA system, ma-access ang iyong records, dumalo sa hearings kasama mo, at tumulong na matiyak na makuha mo ang benefits na pinaghirapan mo - lahat ng ito WALANG BAYAD.', vi: 'Họ biết hệ thống VA, có thể truy cập hồ sơ của bạn, tham dự các phiên điều trần với bạn và giúp đảm bảo bạn nhận được các quyền lợi bạn đã kiếm được - tất cả đều MIỄN PHÍ.', ko: '그들은 VA 시스템을 알고, 귀하의 기록에 접근하고, 청문회에 동행하며, 귀하가 얻은 혜택을 받을 수 있도록 도와줍니다 - 모두 무료입니다.' },
  },

  // Forms Helper Component
  formsHelper: {
    // Header
    title: { en: 'VA Forms Helper', es: 'Asistente de Formularios VA', tl: 'VA Forms Helper', vi: 'Trợ Giúp Biểu Mẫu VA', ko: 'VA 양식 도우미' },
    subtitle: { en: 'Guided help for VA claim forms', es: 'Ayuda guiada para formularios de reclamos VA', tl: 'Gabay na tulong para sa VA claim forms', vi: 'Hướng dẫn điền biểu mẫu yêu cầu VA', ko: 'VA 청구 양식 안내' },
    beta: { en: 'BETA', es: 'BETA', tl: 'BETA', vi: 'BETA', ko: '베타' },
    selectFormPrompt: { en: 'Select a form to get guided help filling it out. We\'ll generate a draft you can review and submit.', es: 'Selecciona un formulario para obtener ayuda guiada. Generaremos un borrador que puedes revisar y enviar.', tl: 'Pumili ng form para makakuha ng gabay. Gagawa kami ng draft na maaari mong suriin at isumite.', vi: 'Chọn biểu mẫu để được hướng dẫn điền. Chúng tôi sẽ tạo bản nháp để bạn xem xét và gửi.', ko: '양식을 선택하면 작성 안내를 받을 수 있습니다. 검토하고 제출할 초안을 생성해 드립니다.' },
    formsAvailable: { en: 'Forms Available', es: 'Formularios Disponibles', tl: 'Mga Available na Form', vi: 'Biểu Mẫu Có Sẵn', ko: '사용 가능한 양식' },
    
    // Profile Section
    editYourProfile: { en: 'Edit Your Profile', es: 'Editar Tu Perfil', tl: 'I-edit ang Profile Mo', vi: 'Chỉnh Sửa Hồ Sơ', ko: '프로필 편집' },
    setUpProfile: { en: 'Set Up Profile (Enter Info Once!)', es: 'Configurar Perfil (¡Ingresa Datos Una Vez!)', tl: 'I-setup ang Profile (Ilagay ang Info Isang Beses!)', vi: 'Thiết Lập Hồ Sơ (Nhập Thông Tin Một Lần!)', ko: '프로필 설정 (한 번만 입력!)' },
    profileTitle: { en: 'Your Information (Enter Once, Use Everywhere!)', es: 'Tu Información (¡Ingresa Una Vez, Usa en Todas Partes!)', tl: 'Ang Impormasyon Mo (Ilagay Isang Beses, Gamitin Kahit Saan!)', vi: 'Thông Tin Của Bạn (Nhập Một Lần, Dùng Mọi Nơi!)', ko: '정보 입력 (한 번 입력, 어디서나 사용!)' },
    profileDesc: { en: 'Enter your information here once and it will automatically fill in ALL VA forms. Your data stays 100% on your device.', es: 'Ingresa tu información aquí una vez y se llenará automáticamente en TODOS los formularios VA. Tus datos permanecen 100% en tu dispositivo.', tl: 'Ilagay ang impormasyon mo dito isang beses at automatic itong magfi-fill sa LAHAT ng VA forms. Ang data mo ay nananatili 100% sa device mo.', vi: 'Nhập thông tin một lần và nó sẽ tự động điền vào TẤT CẢ biểu mẫu VA. Dữ liệu của bạn 100% ở trên thiết bị.', ko: '정보를 한 번 입력하면 모든 VA 양식에 자동으로 입력됩니다. 데이터는 100% 기기에 저장됩니다.' },
    saved: { en: 'Saved!', es: '¡Guardado!', tl: 'Na-save!', vi: 'Đã Lưu!', ko: '저장됨!' },
    saveProfile: { en: 'Save Profile', es: 'Guardar Perfil', tl: 'I-save ang Profile', vi: 'Lưu Hồ Sơ', ko: '프로필 저장' },
    profileSavedMsg: { en: 'Profile saved! Your info will auto-fill in all forms.', es: '¡Perfil guardado! Tu información se llenará automáticamente en todos los formularios.', tl: 'Na-save ang profile! Automatic na mafi-fill ang info mo sa lahat ng forms.', vi: 'Đã lưu hồ sơ! Thông tin sẽ tự động điền vào tất cả biểu mẫu.', ko: '프로필 저장됨! 모든 양식에 자동으로 입력됩니다.' },
    
    // Backup/Restore
    backupAllData: { en: 'Backup All Data', es: 'Respaldar Todos los Datos', tl: 'I-backup Lahat ng Data', vi: 'Sao Lưu Tất Cả Dữ Liệu', ko: '모든 데이터 백업' },
    restoreFromBackup: { en: 'Restore from Backup', es: 'Restaurar desde Respaldo', tl: 'I-restore mula sa Backup', vi: 'Khôi Phục từ Bản Sao Lưu', ko: '백업에서 복원' },
    backupCreated: { en: 'Backup created successfully!', es: '¡Respaldo creado exitosamente!', tl: 'Matagumpay na nagawa ang backup!', vi: 'Đã tạo bản sao lưu thành công!', ko: '백업이 성공적으로 생성되었습니다!' },
    selectJsonFile: { en: 'Please select a .json backup file', es: 'Por favor selecciona un archivo .json de respaldo', tl: 'Pumili ng .json backup file', vi: 'Vui lòng chọn tệp sao lưu .json', ko: '.json 백업 파일을 선택하세요' },
    invalidBackupFile: { en: 'Invalid backup file format', es: 'Formato de archivo de respaldo inválido', tl: 'Invalid na backup file format', vi: 'Định dạng tệp sao lưu không hợp lệ', ko: '잘못된 백업 파일 형식' },
    formSavedToPacket: { en: 'Form saved to My Packet!', es: '¡Formulario guardado en Mi Paquete!', tl: 'Na-save ang form sa My Packet!', vi: 'Đã lưu biểu mẫu vào Hồ Sơ!', ko: '양식이 내 패킷에 저장되었습니다!' },
    
    // Form Fields
    firstName: { en: 'First Name', es: 'Nombre', tl: 'Pangalan', vi: 'Tên', ko: '이름' },
    middleInitial: { en: 'Middle Initial', es: 'Inicial del Segundo Nombre', tl: 'Middle Initial', vi: 'Chữ Cái Đệm', ko: '중간 이니셜' },
    lastName: { en: 'Last Name', es: 'Apellido', tl: 'Apelyido', vi: 'Họ', ko: '성' },
    lastFourSSN: { en: 'Last 4 of SSN', es: 'Últimos 4 del SSN', tl: 'Huling 4 ng SSN', vi: '4 Số Cuối SSN', ko: 'SSN 마지막 4자리' },
    mostFormsOnlyNeedLast4: { en: 'Most forms only need last 4', es: 'La mayoría de formularios solo necesitan los últimos 4', tl: 'Karamihan ng forms ay kailangan lang ang huling 4', vi: 'Hầu hết biểu mẫu chỉ cần 4 số cuối', ko: '대부분의 양식은 마지막 4자리만 필요합니다' },
    dateOfBirth: { en: 'Date of Birth', es: 'Fecha de Nacimiento', tl: 'Petsa ng Kapanganakan', vi: 'Ngày Sinh', ko: '생년월일' },
    vaFileNumber: { en: 'VA File Number', es: 'Número de Archivo VA', tl: 'VA File Number', vi: 'Số Hồ Sơ VA', ko: 'VA 파일 번호' },
    optionalIfDifferent: { en: 'Optional - if different from SSN', es: 'Opcional - si es diferente del SSN', tl: 'Optional - kung iba sa SSN', vi: 'Tùy chọn - nếu khác SSN', ko: '선택 - SSN과 다른 경우' },
    phoneNumber: { en: 'Phone Number', es: 'Número de Teléfono', tl: 'Numero ng Telepono', vi: 'Số Điện Thoại', ko: '전화번호' },
    emailAddress: { en: 'Email Address', es: 'Correo Electrónico', tl: 'Email Address', vi: 'Địa Chỉ Email', ko: '이메일 주소' },
    serviceBranch: { en: 'Service Branch', es: 'Rama de Servicio', tl: 'Branch ng Serbisyo', vi: 'Ngành Phục Vụ', ko: '복무 군종' },
    selectBranch: { en: 'Select Branch', es: 'Seleccionar Rama', tl: 'Pumili ng Branch', vi: 'Chọn Ngành', ko: '군종 선택' },
    streetAddress: { en: 'Street Address', es: 'Dirección', tl: 'Street Address', vi: 'Địa Chỉ', ko: '거리 주소' },
    aptUnit: { en: 'Apt/Unit', es: 'Apt/Unidad', tl: 'Apt/Unit', vi: 'Căn Hộ/Đơn Vị', ko: '아파트/유닛' },
    city: { en: 'City', es: 'Ciudad', tl: 'Lungsod', vi: 'Thành Phố', ko: '도시' },
    state: { en: 'State', es: 'Estado', tl: 'Estado', vi: 'Tiểu Bang', ko: '주' },
    zipCode: { en: 'ZIP Code', es: 'Código Postal', tl: 'ZIP Code', vi: 'Mã Bưu Điện', ko: '우편번호' },
    country: { en: 'Country', es: 'País', tl: 'Bansa', vi: 'Quốc Gia', ko: '국가' },
    
    // Military Service Details
    militaryServiceDetails: { en: 'Military Service Details (for form autofill)', es: 'Detalles del Servicio Militar (para autocompletar)', tl: 'Military Service Details (para sa form autofill)', vi: 'Chi Tiết Nghĩa Vụ Quân Sự (để tự động điền)', ko: '군 복무 세부사항 (자동 입력용)' },
    serviceNumber: { en: 'Service Number', es: 'Número de Servicio', tl: 'Service Number', vi: 'Số Quân Nhân', ko: '군번' },
    rankAtDischarge: { en: 'Rank at Discharge', es: 'Rango al Salir', tl: 'Rank sa Discharge', vi: 'Cấp Bậc Khi Giải Ngũ', ko: '전역 계급' },
    payGrade: { en: 'Pay Grade', es: 'Grado de Pago', tl: 'Pay Grade', vi: 'Bậc Lương', ko: '급여 등급' },
    mosRatingCode: { en: 'MOS/Rating Code', es: 'Código MOS/Rating', tl: 'MOS/Rating Code', vi: 'Mã MOS/Rating', ko: 'MOS/등급 코드' },
    serviceStartDate: { en: 'Service Start Date', es: 'Fecha de Inicio de Servicio', tl: 'Service Start Date', vi: 'Ngày Bắt Đầu Phục Vụ', ko: '복무 시작일' },
    serviceEndDate: { en: 'Service End Date', es: 'Fecha de Fin de Servicio', tl: 'Service End Date', vi: 'Ngày Kết Thúc Phục Vụ', ko: '복무 종료일' },
    characterOfService: { en: 'Character of Service', es: 'Carácter del Servicio', tl: 'Character of Service', vi: 'Đặc Điểm Phục Vụ', ko: '복무 특성' },
    placeOfBirth: { en: 'Place of Birth', es: 'Lugar de Nacimiento', tl: 'Lugar ng Kapanganakan', vi: 'Nơi Sinh', ko: '출생지' },
    
    // Sensitive Info Section
    sensitiveInfo: { en: 'Sensitive Information (Full SSN - Optional)', es: 'Información Sensible (SSN Completo - Opcional)', tl: 'Sensitive Information (Full SSN - Optional)', vi: 'Thông Tin Nhạy Cảm (SSN Đầy Đủ - Tùy Chọn)', ko: '민감한 정보 (전체 SSN - 선택)' },
    localStorageOnly: { en: 'Local storage only', es: 'Solo almacenamiento local', tl: 'Local storage lang', vi: 'Chỉ lưu trữ cục bộ', ko: '로컬 저장소만' },
    privacyNotice: { en: 'Privacy Notice:', es: 'Aviso de Privacidad:', tl: 'Privacy Notice:', vi: 'Thông Báo Bảo Mật:', ko: '개인정보 안내:' },
    privacyNoticeText: { en: 'Full SSN is only needed for certain forms. This data is stored locally on your device only and is never sent to any server. Clear your browser data to remove this information.', es: 'El SSN completo solo se necesita para ciertos formularios. Estos datos se almacenan solo localmente en tu dispositivo y nunca se envían a ningún servidor.', tl: 'Ang full SSN ay kailangan lang para sa ilang forms. Ang data na ito ay naka-store locally sa device mo lang at hindi kailanman ipinapadala sa anumang server.', vi: 'SSN đầy đủ chỉ cần cho một số biểu mẫu nhất định. Dữ liệu này chỉ được lưu trữ cục bộ trên thiết bị của bạn và không bao giờ được gửi đến bất kỳ máy chủ nào.', ko: '전체 SSN은 특정 양식에만 필요합니다. 이 데이터는 기기에만 로컬로 저장되며 서버로 전송되지 않습니다.' },
    fullSSN: { en: 'Full SSN', es: 'SSN Completo', tl: 'Full SSN', vi: 'SSN Đầy Đủ', ko: '전체 SSN' },
    onlyNeededForCertainForms: { en: 'Only needed for certain VA forms', es: 'Solo necesario para ciertos formularios VA', tl: 'Kailangan lang para sa ilang VA forms', vi: 'Chỉ cần cho một số biểu mẫu VA', ko: '특정 VA 양식에만 필요' },
    homeOfRecord: { en: 'Home of Record', es: 'Lugar de Origen', tl: 'Home of Record', vi: 'Nơi Đăng Ký Gốc', ko: '원적지' },
    dataStoredLocally: { en: 'Your data is stored locally on your device. Nothing is sent to any server.', es: 'Tus datos se almacenan localmente en tu dispositivo. Nada se envía a ningún servidor.', tl: 'Ang data mo ay naka-store locally sa device mo. Walang ipinapadala sa anumang server.', vi: 'Dữ liệu của bạn được lưu trữ cục bộ trên thiết bị. Không có gì được gửi đến máy chủ.', ko: '데이터는 기기에 로컬로 저장됩니다. 서버로 전송되지 않습니다.' },
    
    // Pro Tips
    proTip: { en: 'Pro Tip:', es: 'Consejo Pro:', tl: 'Pro Tip:', vi: 'Mẹo Hay:', ko: '프로 팁:' },
    buddyStatementsPowerful: { en: 'Buddy Statements Are Powerful!', es: '¡Las Declaraciones de Compañeros Son Poderosas!', tl: 'Makapangyarihan ang Buddy Statements!', vi: 'Lời Khai Đồng Đội Rất Mạnh!', ko: '동료 진술서는 강력합니다!' },
    buddyStatementsDesc: { en: 'Many veterans don\'t realize that statements from family, friends, and fellow service members can be critical evidence for their claim. These "buddy statements" help prove symptoms, in-service events, and daily impact - especially when medical records are incomplete.', es: 'Muchos veteranos no se dan cuenta de que las declaraciones de familiares, amigos y compañeros de servicio pueden ser evidencia crítica para su reclamo.', tl: 'Maraming veterans ang hindi nakakaalam na ang mga statement mula sa pamilya, mga kaibigan, at kapwa service members ay maaaring maging kritikal na ebidensya para sa kanilang claim.', vi: 'Nhiều cựu chiến binh không nhận ra rằng lời khai từ gia đình, bạn bè và đồng đội có thể là bằng chứng quan trọng cho yêu cầu của họ.', ko: '많은 재향군인들이 가족, 친구, 동료 복무자의 진술이 청구에 중요한 증거가 될 수 있다는 것을 모릅니다.' },
    
    // Quick Links
    quickLinksToForms: { en: 'Quick Links to Official VA Forms', es: 'Enlaces Rápidos a Formularios Oficiales del VA', tl: 'Mga Mabilis na Link sa Official VA Forms', vi: 'Liên Kết Nhanh đến Biểu Mẫu VA Chính Thức', ko: '공식 VA 양식 빠른 링크' },
    
    // Tips Section
    tipsForSuccess: { en: 'Tips for Success', es: 'Consejos para el Éxito', tl: 'Mga Tip para sa Tagumpay', vi: 'Mẹo Để Thành Công', ko: '성공 팁' },
    
    // Buttons
    startGuidedBuilder: { en: 'Start Guided Builder', es: 'Iniciar Constructor Guiado', tl: 'Simulan ang Guided Builder', vi: 'Bắt Đầu Trình Tạo Hướng Dẫn', ko: '안내 빌더 시작' },
    goToVAForm: { en: 'Go to VA.gov Form', es: 'Ir al Formulario de VA.gov', tl: 'Pumunta sa VA.gov Form', vi: 'Đi đến Biểu Mẫu VA.gov', ko: 'VA.gov 양식으로 이동' },
    officialForm: { en: 'Official Form', es: 'Formulario Oficial', tl: 'Official Form', vi: 'Biểu Mẫu Chính Thức', ko: '공식 양식' },
    backToAllForms: { en: 'Back to all forms', es: 'Volver a todos los formularios', tl: 'Bumalik sa lahat ng forms', vi: 'Quay lại tất cả biểu mẫu', ko: '모든 양식으로 돌아가기' },
    generateStatement: { en: 'Generate Statement', es: 'Generar Declaración', tl: 'I-generate ang Statement', vi: 'Tạo Tuyên Bố', ko: '명세서 생성' },
    editAnswers: { en: 'Edit Answers', es: 'Editar Respuestas', tl: 'I-edit ang mga Sagot', vi: 'Chỉnh Sửa Câu Trả Lời', ko: '답변 편집' },
    startNewForm: { en: 'Start New Form', es: 'Iniciar Nuevo Formulario', tl: 'Magsimula ng Bagong Form', vi: 'Bắt Đầu Biểu Mẫu Mới', ko: '새 양식 시작' },
    submitAtVA: { en: 'Submit at VA.gov', es: 'Enviar en VA.gov', tl: 'Isumite sa VA.gov', vi: 'Gửi tại VA.gov', ko: 'VA.gov에서 제출' },
    
    // Wizard Steps
    stepOf: { en: 'Step', es: 'Paso', tl: 'Hakbang', vi: 'Bước', ko: '단계' },
    of: { en: 'of', es: 'de', tl: 'ng', vi: 'trên', ko: '/' },
    
    // Generated Content
    statementGenerated: { en: 'Statement Generated!', es: '¡Declaración Generada!', tl: 'Na-generate na ang Statement!', vi: 'Đã Tạo Tuyên Bố!', ko: '명세서가 생성되었습니다!' },
    reviewStatementDesc: { en: 'Review your statement below, then download. You can get a ready-to-sign PDF or text formats.', es: 'Revisa tu declaración abajo, luego descarga. Puedes obtener un PDF listo para firmar o formatos de texto.', tl: 'Suriin ang statement mo sa ibaba, pagkatapos i-download. Makukuha mo ang ready-to-sign PDF o text formats.', vi: 'Xem lại tuyên bố bên dưới, sau đó tải xuống. Bạn có thể nhận PDF sẵn sàng ký hoặc định dạng văn bản.', ko: '아래에서 명세서를 검토한 후 다운로드하세요. 서명 준비된 PDF 또는 텍스트 형식을 받을 수 있습니다.' },
    
    // AI Enhancement
    aiStatementAssistant: { en: 'AI Statement Assistant', es: 'Asistente de Declaración IA', tl: 'AI Statement Assistant', vi: 'Trợ Lý Tuyên Bố AI', ko: 'AI 명세서 어시스턴트' },
    localAI: { en: 'Local AI', es: 'IA Local', tl: 'Local AI', vi: 'AI Cục Bộ', ko: '로컬 AI' },
    cloudAI: { en: 'Cloud AI', es: 'IA en la Nube', tl: 'Cloud AI', vi: 'AI Đám Mây', ko: '클라우드 AI' },
    enhanceDesc: { en: 'Enhance your statement with AI to make it more professional and compelling. Uses the "Three Pillars" approach for effective VA claim statements.', es: 'Mejora tu declaración con IA para hacerla más profesional y convincente. Usa el enfoque de "Tres Pilares" para declaraciones efectivas.', tl: 'Pahusayin ang statement mo gamit ang AI para gawin itong mas professional at compelling. Gumagamit ng "Three Pillars" approach.', vi: 'Cải thiện tuyên bố của bạn bằng AI để làm cho nó chuyên nghiệp và thuyết phục hơn. Sử dụng phương pháp "Ba Trụ Cột".', ko: 'AI로 명세서를 개선하여 더 전문적이고 설득력 있게 만드세요. "세 기둥" 접근법을 사용합니다.' },
    allAIModelsWork: { en: 'All AI models work great for statement writing!', es: '¡Todos los modelos de IA funcionan muy bien para escribir declaraciones!', tl: 'Lahat ng AI models ay maganda para sa pagsulat ng statement!', vi: 'Tất cả các mô hình AI đều hoạt động tốt cho việc viết tuyên bố!', ko: '모든 AI 모델이 명세서 작성에 잘 작동합니다!' },
    privateDataNeverLeaves: { en: '100% Private - Your data never leaves your device', es: '100% Privado - Tus datos nunca salen de tu dispositivo', tl: '100% Private - Hindi kailanman aalis ang data mo sa device mo', vi: '100% Riêng Tư - Dữ liệu không bao giờ rời khỏi thiết bị', ko: '100% 비공개 - 데이터가 기기를 떠나지 않습니다' },
    enhanceWithAI: { en: 'Enhance with AI', es: 'Mejorar con IA', tl: 'I-enhance gamit ang AI', vi: 'Cải Thiện bằng AI', ko: 'AI로 개선' },
    enhancing: { en: 'Enhancing...', es: 'Mejorando...', tl: 'Nag-e-enhance...', vi: 'Đang Cải Thiện...', ko: '개선 중...' },
    aiVersion: { en: 'AI Version', es: 'Versión IA', tl: 'AI Version', vi: 'Phiên Bản AI', ko: 'AI 버전' },
    original: { en: 'Original', es: 'Original', tl: 'Original', vi: 'Bản Gốc', ko: '원본' },
    viewingAIEnhanced: { en: 'Viewing AI-enhanced version', es: 'Viendo versión mejorada con IA', tl: 'Tinitingnan ang AI-enhanced version', vi: 'Đang xem phiên bản cải thiện AI', ko: 'AI 개선 버전 보기' },
    viewingOriginal: { en: 'Viewing original template version', es: 'Viendo versión de plantilla original', tl: 'Tinitingnan ang original template version', vi: 'Đang xem phiên bản mẫu gốc', ko: '원본 템플릿 버전 보기' },
    aiEnhancementAvailable: { en: 'AI Enhancement Available', es: 'Mejora de IA Disponible', tl: 'Available ang AI Enhancement', vi: 'Có Sẵn Cải Thiện AI', ko: 'AI 개선 사용 가능' },
    configureAI: { en: 'Configure AI', es: 'Configurar IA', tl: 'I-configure ang AI', vi: 'Cấu Hình AI', ko: 'AI 설정' },
    
    // Download Section
    downloadYourForm: { en: 'Download Your Form', es: 'Descarga Tu Formulario', tl: 'I-download ang Form Mo', vi: 'Tải Xuống Biểu Mẫu', ko: '양식 다운로드' },
    officialVAFormPDF: { en: 'Official VA Form PDF', es: 'PDF del Formulario VA Oficial', tl: 'Official VA Form PDF', vi: 'PDF Biểu Mẫu VA Chính Thức', ko: '공식 VA 양식 PDF' },
    readyToSignSubmit: { en: 'Ready to sign & submit', es: 'Listo para firmar y enviar', tl: 'Handa nang pirmahan at isumite', vi: 'Sẵn sàng ký và gửi', ko: '서명 및 제출 준비 완료' },
    
    // Save to Packet
    saveToMyPacket: { en: 'Save to My Packet', es: 'Guardar en Mi Paquete', tl: 'I-save sa My Packet', vi: 'Lưu vào Hồ Sơ', ko: '내 패킷에 저장' },
    saveToPacketDesc: { en: 'Keep this form with your other claims for easy access and backup', es: 'Guarda este formulario con tus otros reclamos para fácil acceso y respaldo', tl: 'Itabi ang form na ito kasama ng ibang claims mo para sa madaling access at backup', vi: 'Giữ biểu mẫu này cùng với các yêu cầu khác để dễ truy cập và sao lưu', ko: '쉬운 접근과 백업을 위해 다른 청구와 함께 이 양식을 보관하세요' },
    saveToPacket: { en: 'Save to Packet', es: 'Guardar en Paquete', tl: 'I-save sa Packet', vi: 'Lưu vào Hồ Sơ', ko: '패킷에 저장' },
    
    // Preview
    textPreview: { en: 'Text Preview', es: 'Vista Previa de Texto', tl: 'Text Preview', vi: 'Xem Trước Văn Bản', ko: '텍스트 미리보기' },
    clickToExpand: { en: 'click to expand', es: 'clic para expandir', tl: 'i-click para palawakin', vi: 'nhấp để mở rộng', ko: '확장하려면 클릭' },
    aiEnhanced: { en: 'AI-Enhanced', es: 'Mejorado con IA', tl: 'AI-Enhanced', vi: 'Cải Thiện AI', ko: 'AI 개선' },
    
    // Additional Form Labels
    ssnLast4: { en: 'Last 4 of SSN', es: 'Últimos 4 del SSN', tl: 'Huling 4 ng SSN', vi: '4 Số Cuối SSN', ko: 'SSN 마지막 4자리' },
    ssnLast4Helper: { en: 'Most forms only need last 4', es: 'La mayoría de formularios solo necesitan los últimos 4', tl: 'Karamihan ng forms ay kailangan lang ang huling 4', vi: 'Hầu hết biểu mẫu chỉ cần 4 số cuối', ko: '대부분의 양식은 마지막 4자리만 필요합니다' },
    vaFileNumberPlaceholder: { en: 'Optional - if different from SSN', es: 'Opcional - si es diferente del SSN', tl: 'Optional - kung iba sa SSN', vi: 'Tùy chọn - nếu khác SSN', ko: '선택 - SSN과 다른 경우' },
    sensitiveInfoOptional: { en: 'Sensitive Information (Full SSN - Optional)', es: 'Información Sensible (SSN Completo - Opcional)', tl: 'Sensitive Information (Full SSN - Optional)', vi: 'Thông Tin Nhạy Cảm (SSN Đầy Đủ - Tùy Chọn)', ko: '민감한 정보 (전체 SSN - 선택)' },
    privacyLocalStorage: { en: 'Your data is stored locally on your device. Nothing is sent to any server.', es: 'Tus datos se almacenan localmente en tu dispositivo. Nada se envía a ningún servidor.', tl: 'Ang data mo ay naka-store locally sa device mo. Walang ipinapadala sa anumang server.', vi: 'Dữ liệu của bạn được lưu trữ cục bộ trên thiết bị. Không có gì được gửi đến máy chủ.', ko: '데이터는 기기에 로컬로 저장됩니다. 서버로 전송되지 않습니다.' },
    edit: { en: 'Edit', es: 'Editar', tl: 'I-edit', vi: 'Chỉnh Sửa', ko: '편집' },
    cancel: { en: 'Cancel', es: 'Cancelar', tl: 'Kanselahin', vi: 'Hủy', ko: '취소' },
    back: { en: 'Back', es: 'Atrás', tl: 'Bumalik', vi: 'Quay Lại', ko: '뒤로' },
    next: { en: 'Next', es: 'Siguiente', tl: 'Susunod', vi: 'Tiếp Theo', ko: '다음' },
    
    // AI Enhancement Additional
    aiEnhanceDesc: { en: 'Enhance your statement with AI to make it more professional and compelling. Uses the "Three Pillars" approach for effective VA claim statements.', es: 'Mejora tu declaración con IA para hacerla más profesional y convincente. Usa el enfoque de "Tres Pilares" para declaraciones efectivas.', tl: 'Pahusayin ang statement mo gamit ang AI para gawin itong mas professional at compelling. Gumagamit ng "Three Pillars" approach.', vi: 'Cải thiện tuyên bố của bạn bằng AI để làm cho nó chuyên nghiệp và thuyết phục hơn. Sử dụng phương pháp "Ba Trụ Cột".', ko: 'AI로 명세서를 개선하여 더 전문적이고 설득력 있게 만드세요. "세 기둥" 접근법을 사용합니다.' },
    tip: { en: 'Tip', es: 'Consejo', tl: 'Tip', vi: 'Mẹo', ko: '팁' },
    aiTipAllModels: { en: 'All AI models work great for statement writing!', es: '¡Todos los modelos de IA funcionan muy bien para escribir declaraciones!', tl: 'Lahat ng AI models ay maganda para sa pagsulat ng statement!', vi: 'Tất cả các mô hình AI đều hoạt động tốt cho việc viết tuyên bố!', ko: '모든 AI 모델이 명세서 작성에 잘 작동합니다!' },
    aiPrivateNotice: { en: '100% Private - Your data never leaves your device', es: '100% Privado - Tus datos nunca salen de tu dispositivo', tl: '100% Private - Hindi kailanman aalis ang data mo sa device mo', vi: '100% Riêng Tư - Dữ liệu không bao giờ rời khỏi thiết bị', ko: '100% 비공개 - 데이터가 기기를 떠나지 않습니다' },
    viewingAIVersion: { en: 'Viewing AI-enhanced version', es: 'Viendo versión mejorada con IA', tl: 'Tinitingnan ang AI-enhanced version', vi: 'Đang xem phiên bản cải thiện AI', ko: 'AI 개선 버전 보기' },
    aiEnhancementAvailableDesc: { en: 'This form can be enhanced with AI to make your statement more professional and compelling using the "Three Pillars" approach.', es: 'Este formulario puede mejorarse con IA para hacer tu declaración más profesional y convincente usando el enfoque de "Tres Pilares".', tl: 'Ang form na ito ay maaaring pahusayin gamit ang AI para gawin ang statement mo na mas professional at compelling gamit ang "Three Pillars" approach.', vi: 'Biểu mẫu này có thể được cải thiện bằng AI để làm cho tuyên bố của bạn chuyên nghiệp và thuyết phục hơn bằng phương pháp "Ba Trụ Cột".', ko: '이 양식은 "세 기둥" 접근법을 사용하여 명세서를 더 전문적이고 설득력 있게 만들기 위해 AI로 개선할 수 있습니다.' },
    
    // Download Section Additional
    officialVAFormPdf: { en: 'Official VA Form PDF', es: 'PDF del Formulario VA Oficial', tl: 'Official VA Form PDF', vi: 'PDF Biểu Mẫu VA Chính Thức', ko: '공식 VA 양식 PDF' },
    readyToSign: { en: 'Ready to sign & submit', es: 'Listo para firmar y enviar', tl: 'Handa nang pirmahan at isumite', vi: 'Sẵn sàng ký và gửi', ko: '서명 및 제출 준비 완료' },
    saveToPacketBtn: { en: 'Save to Packet', es: 'Guardar en Paquete', tl: 'I-save sa Packet', vi: 'Lưu vào Hồ Sơ', ko: '패킷에 저장' },
    
    // Statement Generated
    statementGeneratedDesc: { en: 'Review your statement below, then download. You can get a ready-to-sign PDF or text formats.', es: 'Revisa tu declaración abajo, luego descarga. Puedes obtener un PDF listo para firmar o formatos de texto.', tl: 'Suriin ang statement mo sa ibaba, pagkatapos i-download. Makukuha mo ang ready-to-sign PDF o text formats.', vi: 'Xem lại tuyên bố bên dưới, sau đó tải xuống. Bạn có thể nhận PDF sẵn sàng ký hoặc định dạng văn bản.', ko: '아래에서 명세서를 검토한 후 다운로드하세요. 서명 준비된 PDF 또는 텍스트 형식을 받을 수 있습니다.' },
    yourGeneratedStatement: { en: 'Your Generated Statement', es: 'Tu Declaración Generada', tl: 'Ang Na-generate Mong Statement', vi: 'Tuyên Bố Đã Tạo Của Bạn', ko: '생성된 명세서' },
    
    // Next Steps Section
    nextSteps: { en: 'Next Steps', es: 'Próximos Pasos', tl: 'Mga Susunod na Hakbang', vi: 'Các Bước Tiếp Theo', ko: '다음 단계' },
    download: { en: 'Download', es: 'Descargar', tl: 'I-download', vi: 'Tải Xuống', ko: '다운로드' },
    review: { en: 'Review', es: 'Revisar', tl: 'Suriin', vi: 'Xem Lại', ko: '검토' },
    print: { en: 'Print', es: 'Imprimir', tl: 'I-print', vi: 'In', ko: '인쇄' },
    sign: { en: 'Sign', es: 'Firmar', tl: 'Pirmahan', vi: 'Ký', ko: '서명' },
    submit: { en: 'Submit', es: 'Enviar', tl: 'Isumite', vi: 'Gửi', ko: '제출' },
    nextStepDownload: { en: 'the "Official VA Form PDF" above - it\'s already filled out!', es: 'el "PDF del Formulario VA Oficial" arriba - ¡ya está llenado!', tl: 'ang "Official VA Form PDF" sa itaas - naka-fill na!', vi: '"PDF Biểu Mẫu VA Chính Thức" ở trên - đã được điền sẵn!', ko: '위의 "공식 VA 양식 PDF" - 이미 작성되어 있습니다!' },
    nextStepReview: { en: 'the PDF to make sure all information is correct', es: 'el PDF para asegurarte de que toda la información sea correcta', tl: 'ang PDF para matiyak na tama ang lahat ng impormasyon', vi: 'PDF để đảm bảo tất cả thông tin chính xác', ko: 'PDF를 검토하여 모든 정보가 올바른지 확인하세요' },
    nextStepPrint: { en: 'the completed form', es: 'el formulario completado', tl: 'ang nakumpletong form', vi: 'biểu mẫu đã hoàn thành', ko: '완성된 양식을' },
    nextStepSign: { en: 'and date where indicated', es: 'y fecha donde se indica', tl: 'at lagyan ng petsa kung saan ipinapakita', vi: 'và ghi ngày ở nơi được chỉ định', ko: '표시된 곳에 날짜를 기입하세요' },
    nextStepSubmit: { en: 'online at', es: 'en línea en', tl: 'online sa', vi: 'trực tuyến tại', ko: '온라인으로' },
    orMailTo: { en: 'or mail to your VA Regional Office', es: 'o por correo a tu Oficina Regional del VA', tl: 'o ipadala sa iyong VA Regional Office', vi: 'hoặc gửi qua đường bưu điện đến Văn phòng VA Khu vực', ko: '또는 VA 지역 사무소로 우편 발송' },
    
    // Footer
    footerPrivacy: { en: 'All data stays in your browser. We never store your personal information.', es: 'Todos los datos permanecen en tu navegador. Nunca almacenamos tu información personal.', tl: 'Lahat ng data ay nananatili sa browser mo. Hindi namin kailanman iniimbak ang personal na impormasyon mo.', vi: 'Tất cả dữ liệu ở trong trình duyệt của bạn. Chúng tôi không bao giờ lưu trữ thông tin cá nhân của bạn.', ko: '모든 데이터는 브라우저에 남습니다. 개인 정보를 저장하지 않습니다.' },
  },

  // DD214 Analyzer
  // Pathfinder Tool
  pathfinder: {
    // Header
    title: { en: 'The Pathfinder', es: 'El Pathfinder', tl: 'Ang Pathfinder', vi: 'Người Tìm Đường', ko: '패스파인더' },
    subtitle: { en: 'Strategic claims analysis powered by AI. Enter your current ratings and discover high-probability secondary claims you may be missing.', es: 'Análisis estratégico de reclamos impulsado por IA. Ingresa tus calificaciones actuales y descubre reclamos secundarios de alta probabilidad que puedes estar perdiendo.', tl: 'Strategic claims analysis na pinapagana ng AI. Ilagay ang iyong kasalukuyang ratings at tuklasin ang high-probability secondary claims na maaaring hindi mo nakukuha.', vi: 'Phân tích yêu cầu chiến lược được hỗ trợ bởi AI. Nhập xếp hạng hiện tại của bạn và khám phá các yêu cầu thứ cấp có khả năng cao mà bạn có thể đang bỏ lỡ.', ko: 'AI 기반 전략적 청구 분석. 현재 등급을 입력하고 놓치고 있을 수 있는 높은 확률의 2차 청구를 발견하세요.' },
    
    // Consent/Privacy
    privacyFirst: { en: 'Privacy First', es: 'Privacidad Primero', tl: 'Privacy Muna', vi: 'Quyền Riêng Tư Trước Tiên', ko: '개인정보 보호 우선' },
    privacyReviewPrompt: { en: 'Before analyzing, please review how we protect your information.', es: 'Antes de analizar, por favor revisa cómo protegemos tu información.', tl: 'Bago mag-analyze, mangyaring suriin kung paano namin pinoprotektahan ang iyong impormasyon.', vi: 'Trước khi phân tích, vui lòng xem cách chúng tôi bảo vệ thông tin của bạn.', ko: '분석하기 전에 정보 보호 방법을 검토해 주세요.' },
    iUnderstandContinue: { en: 'I Understand, Continue', es: 'Entiendo, Continuar', tl: 'Nauunawaan Ko, Magpatuloy', vi: 'Tôi Hiểu, Tiếp Tục', ko: '이해했습니다, 계속하기' },
    viewPrivacyInfo: { en: 'View Privacy Information', es: 'Ver Información de Privacidad', tl: 'Tingnan ang Privacy Information', vi: 'Xem Thông Tin Quyền Riêng Tư', ko: '개인정보 보호 정보 보기' },
    hidePrivacyInfo: { en: 'Hide Privacy Information', es: 'Ocultar Información de Privacidad', tl: 'Itago ang Privacy Information', vi: 'Ẩn Thông Tin Quyền Riêng Tư', ko: '개인정보 보호 정보 숨기기' },
    
    // AI Setup
    aiRequiredTitle: { en: 'AI Required for Analysis', es: 'IA Requerida para Análisis', tl: 'Kailangan ng AI para sa Analysis', vi: 'Cần AI để Phân Tích', ko: '분석에 AI 필요' },
    aiRequiredDesc: { en: 'Click the AI Status button in the header above to load your secure Local AI (100% private) or enter your Gemini API key.', es: 'Haz clic en el botón de Estado de IA en el encabezado para cargar tu IA Local segura (100% privada) o ingresa tu clave API de Gemini.', tl: 'I-click ang AI Status button sa header sa itaas para i-load ang iyong secure Local AI (100% private) o ilagay ang iyong Gemini API key.', vi: 'Nhấp vào nút Trạng thái AI ở tiêu đề phía trên để tải AI Cục bộ an toàn của bạn (100% riêng tư) hoặc nhập khóa API Gemini của bạn.', ko: '위 헤더의 AI 상태 버튼을 클릭하여 보안 로컬 AI(100% 비공개)를 로드하거나 Gemini API 키를 입력하세요.' },
    aiTip: { en: 'Tip:', es: 'Consejo:', tl: 'Tip:', vi: 'Mẹo:', ko: '팁:' },
    aiTipText: { en: 'All AI models analyze your ratings quickly. Strategy generation takes just seconds!', es: 'Todos los modelos de IA analizan tus calificaciones rápidamente. ¡La generación de estrategia toma solo segundos!', tl: 'Lahat ng AI models ay nag-aanalyze ng iyong ratings nang mabilis. Ang strategy generation ay ilang segundo lang!', vi: 'Tất cả các mô hình AI phân tích xếp hạng của bạn nhanh chóng. Việc tạo chiến lược chỉ mất vài giây!', ko: '모든 AI 모델은 등급을 빠르게 분석합니다. 전략 생성은 몇 초면 됩니다!' },
    
    // Input Section
    currentRatingsTitle: { en: 'Your Current Service-Connected Ratings', es: 'Tus Calificaciones Actuales Conectadas al Servicio', tl: 'Ang Iyong Kasalukuyang Service-Connected Ratings', vi: 'Xếp Hạng Liên Quan Đến Phục Vụ Hiện Tại Của Bạn', ko: '현재 복무 관련 등급' },
    loadMyRatings: { en: 'Load My Ratings', es: 'Cargar Mis Calificaciones', tl: 'I-load ang Aking Ratings', vi: 'Tải Xếp Hạng Của Tôi', ko: '내 등급 불러오기' },
    pasteFromVaGov: { en: 'Paste from VA.gov', es: 'Pegar desde VA.gov', tl: 'I-paste mula sa VA.gov', vi: 'Dán từ VA.gov', ko: 'VA.gov에서 붙여넣기' },
    dropInFile: { en: 'Drop In File', es: 'Soltar Archivo', tl: 'I-drop ang File', vi: 'Thả Tệp Vào', ko: '파일 드롭' },
    loadFromPacket: { en: 'Load from My Packet', es: 'Cargar desde Mi Paquete', tl: 'I-load mula sa My Packet', vi: 'Tải từ Hồ Sơ Của Tôi', ko: '내 패킷에서 불러오기' },
    loadedFromPacket: { en: 'Loaded conditions from your saved packet. Add rating percentages if known.', es: 'Condiciones cargadas desde tu paquete guardado. Agrega porcentajes de calificación si los conoces.', tl: 'Na-load ang conditions mula sa naka-save mong packet. Idagdag ang rating percentages kung alam.', vi: 'Đã tải các tình trạng từ hồ sơ đã lưu của bạn. Thêm phần trăm xếp hạng nếu biết.', ko: '저장된 패킷에서 조건을 불러왔습니다. 알고 있다면 등급 비율을 추가하세요.' },
    addAnotherRating: { en: 'Add Another Rating', es: 'Agregar Otra Calificación', tl: 'Magdagdag ng Isa Pang Rating', vi: 'Thêm Xếp Hạng Khác', ko: '다른 등급 추가' },
    selectCondition: { en: 'Select condition...', es: 'Seleccionar condición...', tl: 'Pumili ng kondisyon...', vi: 'Chọn tình trạng...', ko: '상태 선택...' },
    enterConditionName: { en: 'Enter condition name...', es: 'Ingresa el nombre de la condición...', tl: 'Ilagay ang pangalan ng kondisyon...', vi: 'Nhập tên tình trạng...', ko: '상태 이름 입력...' },
    
    // Additional Context
    additionalContext: { en: 'Additional Context (Optional)', es: 'Contexto Adicional (Opcional)', tl: 'Karagdagang Konteksto (Opsyonal)', vi: 'Bối Cảnh Bổ Sung (Tùy Chọn)', ko: '추가 컨텍스트 (선택사항)' },
    additionalContextPlaceholder: { en: 'Symptoms you experience, medications you take, or any other relevant information...', es: 'Síntomas que experimentas, medicamentos que tomas, o cualquier otra información relevante...', tl: 'Mga sintomas na nararanasan mo, gamot na iniinom, o anumang iba pang kaugnay na impormasyon...', vi: 'Các triệu chứng bạn gặp phải, thuốc bạn dùng, hoặc bất kỳ thông tin liên quan nào khác...', ko: '경험하는 증상, 복용하는 약물, 또는 기타 관련 정보...' },
    
    // Actions
    clearAll: { en: 'Clear All', es: 'Limpiar Todo', tl: 'I-clear Lahat', vi: 'Xóa Tất Cả', ko: '모두 지우기' },
    analyzeMyStrategy: { en: 'Analyze My Strategy', es: 'Analizar Mi Estrategia', tl: 'Suriin ang Aking Strategy', vi: 'Phân Tích Chiến Lược Của Tôi', ko: '내 전략 분석' },
    analyzingStrategy: { en: 'Analyzing Strategy...', es: 'Analizando Estrategia...', tl: 'Sinusuri ang Strategy...', vi: 'Đang Phân Tích Chiến Lược...', ko: '전략 분석 중...' },
    analyzeDifferentRatings: { en: 'Analyze Different Ratings', es: 'Analizar Diferentes Calificaciones', tl: 'Suriin ang Ibang Ratings', vi: 'Phân Tích Xếp Hạng Khác', ko: '다른 등급 분석' },
    
    // Error Messages
    errorAddRating: { en: 'Please add at least one current rating', es: 'Por favor agrega al menos una calificación actual', tl: 'Mangyaring magdagdag ng kahit isang kasalukuyang rating', vi: 'Vui lòng thêm ít nhất một xếp hạng hiện tại', ko: '최소한 하나의 현재 등급을 추가해 주세요' },
    errorNoAI: { en: 'No AI available. Please set up an API key or enable Local AI in settings.', es: 'No hay IA disponible. Por favor configura una clave API o habilita IA Local en configuración.', tl: 'Walang AI na available. Mangyaring mag-set up ng API key o i-enable ang Local AI sa settings.', vi: 'Không có AI khả dụng. Vui lòng thiết lập khóa API hoặc bật AI Cục bộ trong cài đặt.', ko: 'AI를 사용할 수 없습니다. API 키를 설정하거나 설정에서 로컬 AI를 활성화하세요.' },
    errorNoSavedRatings: { en: 'No saved ratings found. Use "Paste from VA.gov" or enter ratings in Secondary Scout first.', es: 'No se encontraron calificaciones guardadas. Usa "Pegar desde VA.gov" o ingresa calificaciones en Secondary Scout primero.', tl: 'Walang nakitang naka-save na ratings. Gamitin ang "I-paste mula sa VA.gov" o ilagay ang ratings sa Secondary Scout muna.', vi: 'Không tìm thấy xếp hạng đã lưu. Sử dụng "Dán từ VA.gov" hoặc nhập xếp hạng trong Secondary Scout trước.', ko: '저장된 등급을 찾을 수 없습니다. "VA.gov에서 붙여넣기"를 사용하거나 먼저 Secondary Scout에서 등급을 입력하세요.' },
    errorUnsupportedFile: { en: 'Unsupported file type. Please use PDF, Word (.docx), Text, or RTF files.', es: 'Tipo de archivo no soportado. Por favor usa archivos PDF, Word (.docx), Texto o RTF.', tl: 'Hindi suportadong uri ng file. Mangyaring gumamit ng PDF, Word (.docx), Text, o RTF files.', vi: 'Loại tệp không được hỗ trợ. Vui lòng sử dụng tệp PDF, Word (.docx), Text hoặc RTF.', ko: '지원되지 않는 파일 형식입니다. PDF, Word(.docx), 텍스트 또는 RTF 파일을 사용하세요.' },
    errorProcessingFile: { en: 'Failed to process file:', es: 'Error al procesar el archivo:', tl: 'Nabigong i-proseso ang file:', vi: 'Không thể xử lý tệp:', ko: '파일 처리 실패:' },
    noRatingsExtracted: { en: 'No structured ratings found in the document. The text has been added as additional context. Please enter your ratings manually.', es: 'No se encontraron calificaciones estructuradas en el documento. El texto se ha agregado como contexto adicional. Por favor ingresa tus calificaciones manualmente.', tl: 'Walang nahanap na structured ratings sa dokumento. Ang text ay naidagdag bilang additional context. Mangyaring ilagay ang iyong ratings nang manual.', vi: 'Không tìm thấy xếp hạng có cấu trúc trong tài liệu. Văn bản đã được thêm làm bối cảnh bổ sung. Vui lòng nhập xếp hạng của bạn thủ công.', ko: '문서에서 구조화된 등급을 찾을 수 없습니다. 텍스트가 추가 컨텍스트로 추가되었습니다. 수동으로 등급을 입력해 주세요.' },
    
    // Results - Strategy Overview
    strategyAnalysis: { en: 'Strategy Analysis', es: 'Análisis de Estrategia', tl: 'Strategy Analysis', vi: 'Phân Tích Chiến Lược', ko: '전략 분석' },
    currentEstimated: { en: 'Current Estimated', es: 'Estimado Actual', tl: 'Kasalukuyang Estimate', vi: 'Ước Tính Hiện Tại', ko: '현재 추정' },
    potentialWithOpportunities: { en: 'Potential With Opportunities', es: 'Potencial Con Oportunidades', tl: 'Potensyal na may Opportunities', vi: 'Tiềm Năng Với Cơ Hội', ko: '기회가 있는 잠재력' },
    
    // Results - Opportunities
    strategicOpportunities: { en: 'Strategic Opportunities', es: 'Oportunidades Estratégicas', tl: 'Mga Strategic Opportunities', vi: 'Cơ Hội Chiến Lược', ko: '전략적 기회' },
    secondaryTo: { en: 'Secondary to:', es: 'Secundario a:', tl: 'Secondary sa:', vi: 'Thứ cấp từ:', ko: '~의 2차:' },
    probability: { en: 'Probability', es: 'Probabilidad', tl: 'Probability', vi: 'Xác Suất', ko: '확률' },
    typical: { en: 'Typical:', es: 'Típico:', tl: 'Typical:', vi: 'Điển hình:', ko: '일반적:' },
    evidenceNeeded: { en: 'Evidence Needed:', es: 'Evidencia Necesaria:', tl: 'Kailangan na Ebidensya:', vi: 'Bằng Chứng Cần Thiết:', ko: '필요한 증거:' },
    nextStep: { en: 'Next Step:', es: 'Próximo Paso:', tl: 'Susunod na Hakbang:', vi: 'Bước Tiếp Theo:', ko: '다음 단계:' },
    buildNexus: { en: 'Build Nexus', es: 'Construir Nexus', tl: 'Buuin ang Nexus', vi: 'Xây Dựng Nexus', ko: '넥서스 구축' },
    practiceExam: { en: 'Practice Exam', es: 'Examen de Práctica', tl: 'Practice Exam', vi: 'Khám Thực Hành', ko: '연습 시험' },
    
    // Results - Missing Diagnoses
    potentialUndiagnosedConditions: { en: 'Potential Undiagnosed Conditions', es: 'Condiciones Potenciales No Diagnosticadas', tl: 'Mga Potensyal na Undiagnosed Conditions', vi: 'Tình Trạng Tiềm Năng Chưa Được Chẩn Đoán', ko: '잠재적 미진단 상태' },
    linkedTo: { en: 'Linked to:', es: 'Vinculado a:', tl: 'Naka-link sa:', vi: 'Liên kết với:', ko: '연결됨:' },
    
    // Results - Increase Opportunities
    potentialRatingIncreases: { en: 'Potential Rating Increases', es: 'Posibles Aumentos de Calificación', tl: 'Mga Potensyal na Rating Increases', vi: 'Tăng Xếp Hạng Tiềm Năng', ko: '잠재적 등급 증가' },
    criteria: { en: 'Criteria:', es: 'Criterios:', tl: 'Criteria:', vi: 'Tiêu Chí:', ko: '기준:' },
    action: { en: 'Action:', es: 'Acción:', tl: 'Aksyon:', vi: 'Hành Động:', ko: '조치:' },
    
    // Results - Strategic Notes
    strategicNotes: { en: 'Strategic Notes', es: 'Notas Estratégicas', tl: 'Mga Strategic Notes', vi: 'Ghi Chú Chiến Lược', ko: '전략적 메모' },
    
    // File Upload Modal
    uploadDocument: { en: 'Upload Document', es: 'Subir Documento', tl: 'I-upload ang Dokumento', vi: 'Tải Tài Liệu Lên', ko: '문서 업로드' },
    uploadDocumentDesc: { en: 'Upload VA decision letter, rating sheet, or notes', es: 'Sube carta de decisión del VA, hoja de calificación o notas', tl: 'I-upload ang VA decision letter, rating sheet, o mga notes', vi: 'Tải lên thư quyết định VA, bảng xếp hạng hoặc ghi chú', ko: 'VA 결정서, 등급표 또는 메모 업로드' },
    dropFileHere: { en: 'Drop file here or click to browse', es: 'Suelta el archivo aquí o haz clic para navegar', tl: 'I-drop ang file dito o mag-click para mag-browse', vi: 'Thả tệp vào đây hoặc nhấp để duyệt', ko: '여기에 파일을 놓거나 클릭하여 찾아보기' },
    supportsFormats: { en: 'Supports: PDF, Word (.docx), Text, RTF', es: 'Soporta: PDF, Word (.docx), Texto, RTF', tl: 'Suportado: PDF, Word (.docx), Text, RTF', vi: 'Hỗ trợ: PDF, Word (.docx), Text, RTF', ko: '지원: PDF, Word(.docx), 텍스트, RTF' },
    maxFileSize: { en: 'Maximum file size: 50MB', es: 'Tamaño máximo del archivo: 50MB', tl: 'Maximum file size: 50MB', vi: 'Kích thước tệp tối đa: 50MB', ko: '최대 파일 크기: 50MB' },
    whatHappensNext: { en: 'What happens next:', es: 'Qué sucede después:', tl: 'Ano ang mangyayari:', vi: 'Điều gì xảy ra tiếp theo:', ko: '다음에 일어날 일:' },
    whatHappensNextDesc: { en: "We'll extract any ratings found in your document and pre-fill the form. You can review and edit before analyzing.", es: 'Extraeremos las calificaciones encontradas en tu documento y pre-llenaremos el formulario. Puedes revisar y editar antes de analizar.', tl: "I-e-extract namin ang mga ratings na makikita sa dokumento mo at i-pre-fill ang form. Maaari mong i-review at i-edit bago mag-analyze.", vi: 'Chúng tôi sẽ trích xuất bất kỳ xếp hạng nào tìm thấy trong tài liệu của bạn và điền sẵn vào biểu mẫu. Bạn có thể xem lại và chỉnh sửa trước khi phân tích.', ko: '문서에서 발견된 등급을 추출하고 양식을 미리 채웁니다. 분석하기 전에 검토하고 편집할 수 있습니다.' },
    extractAndLoad: { en: 'Extract & Load', es: 'Extraer y Cargar', tl: 'I-extract at I-load', vi: 'Trích Xuất & Tải', ko: '추출 및 불러오기' },
    processing: { en: 'Processing...', es: 'Procesando...', tl: 'Pinoproseso...', vi: 'Đang xử lý...', ko: '처리 중...' },
  },

  dd214Analyzer: {
    // Header
    title: { en: 'DD214 Analyzer', es: 'Analizador DD214', tl: 'DD214 Analyzer', vi: 'Trình Phân Tích DD214', ko: 'DD214 분석기' },
    beta: { en: 'BETA', es: 'BETA', tl: 'BETA', vi: 'BETA', ko: '베타' },
    subtitle: { en: 'Extract & analyze your service records', es: 'Extrae y analiza tus registros de servicio', tl: 'I-extract at suriin ang iyong mga service records', vi: 'Trích xuất & phân tích hồ sơ phục vụ của bạn', ko: '복무 기록 추출 및 분석' },
    
    // Privacy Notice
    privateProcessing: { en: '100% Private Processing', es: 'Procesamiento 100% Privado', tl: '100% Private Processing', vi: 'Xử Lý 100% Riêng Tư', ko: '100% 비공개 처리' },
    privateProcessingLocal: { en: 'Your DD214 is processed entirely on your device. Nothing is sent to external servers.', es: 'Tu DD214 se procesa completamente en tu dispositivo. Nada se envía a servidores externos.', tl: 'Ang DD214 mo ay pinoproseso nang buo sa device mo. Walang ipinapadala sa external servers.', vi: 'DD214 của bạn được xử lý hoàn toàn trên thiết bị của bạn. Không gì được gửi đến máy chủ bên ngoài.', ko: 'DD214는 기기에서 완전히 처리됩니다. 외부 서버로 아무것도 전송되지 않습니다.' },
    privateProcessingCloud: { en: 'Using Cloud AI - your data is sent to Google\'s servers for processing. For maximum privacy, switch to Local AI in settings.', es: 'Usando IA en la Nube - tus datos se envían a los servidores de Google para procesamiento. Para máxima privacidad, cambia a IA Local en configuración.', tl: 'Gumagamit ng Cloud AI - ang data mo ay ipinapadala sa Google servers para sa processing. Para sa maximum privacy, lumipat sa Local AI sa settings.', vi: 'Sử dụng AI Đám Mây - dữ liệu của bạn được gửi đến máy chủ của Google để xử lý. Để có quyền riêng tư tối đa, chuyển sang AI Cục Bộ trong cài đặt.', ko: '클라우드 AI 사용 중 - 데이터가 처리를 위해 Google 서버로 전송됩니다. 최대 개인정보 보호를 위해 설정에서 로컬 AI로 전환하세요.' },
    
    // Input Methods
    pasteText: { en: 'Paste Text', es: 'Pegar Texto', tl: 'I-paste ang Text', vi: 'Dán Văn Bản', ko: '텍스트 붙여넣기' },
    dropInPdf: { en: 'Drop In PDF', es: 'Soltar PDF', tl: 'I-drop ang PDF', vi: 'Thả PDF', ko: 'PDF 끌어놓기' },
    manualEntry: { en: 'Manual Entry', es: 'Entrada Manual', tl: 'Manual Entry', vi: 'Nhập Thủ Công', ko: '수동 입력' },
    
    // Paste Input
    pasteYourDD214: { en: 'Paste your DD214 text below:', es: 'Pega el texto de tu DD214 abajo:', tl: 'I-paste ang DD214 text mo sa ibaba:', vi: 'Dán văn bản DD214 của bạn bên dưới:', ko: '아래에 DD214 텍스트를 붙여넣으세요:' },
    pasteTextPlaceholder: { en: 'Copy text from your DD214 PDF and paste here...\n\nTip: If you have multiple DD214s (re-enlistments), paste them all together. The AI will identify and consolidate them.', es: 'Copia el texto de tu DD214 PDF y pégalo aquí...\n\nConsejo: Si tienes múltiples DD214s (re-alistamientos), pégalos todos juntos. La IA los identificará y consolidará.', tl: 'Kopyahin ang text mula sa DD214 PDF mo at i-paste dito...\n\nTip: Kung may maraming DD214s ka (re-enlistments), i-paste silang lahat. Tutukuyin at ikokonsolida ng AI.', vi: 'Sao chép văn bản từ DD214 PDF của bạn và dán vào đây...\n\nMẹo: Nếu bạn có nhiều DD214 (tái nhập ngũ), dán tất cả cùng nhau. AI sẽ xác định và tổng hợp chúng.', ko: 'DD214 PDF에서 텍스트를 복사하여 여기에 붙여넣으세요...\n\n팁: 여러 DD214(재입대)가 있는 경우 모두 함께 붙여넣으세요. AI가 식별하고 통합합니다.' },
    piiWarning: { en: '⚠️ Your DD214 contains sensitive PII. Data stays on your device only.', es: '⚠️ Tu DD214 contiene información personal sensible. Los datos permanecen solo en tu dispositivo.', tl: '⚠️ Ang DD214 mo ay naglalaman ng sensitibong PII. Ang data ay nananatili sa device mo lamang.', vi: '⚠️ DD214 của bạn chứa PII nhạy cảm. Dữ liệu chỉ được lưu trên thiết bị của bạn.', ko: '⚠️ DD214에는 민감한 개인정보가 포함되어 있습니다. 데이터는 기기에만 저장됩니다.' },
    
    // Manual Entry
    buildManually: { en: 'Build Your DD214 Manually', es: 'Construye Tu DD214 Manualmente', tl: 'Buuin ang DD214 Mo Nang Manual', vi: 'Xây Dựng DD214 Thủ Công', ko: 'DD214 수동으로 작성' },
    manualEntryDesc: { en: 'Type or paste information directly into DD214 form fields. Perfect for when you have a physical DD214 or want to enter specific information block-by-block.', es: 'Escribe o pega información directamente en los campos del formulario DD214. Perfecto cuando tienes un DD214 físico o quieres ingresar información específica bloque por bloque.', tl: 'I-type o i-paste ang impormasyon direkta sa DD214 form fields. Perpekto kapag may physical DD214 ka o gusto mong mag-enter ng specific information block-by-block.', vi: 'Nhập hoặc dán thông tin trực tiếp vào các trường biểu mẫu DD214. Hoàn hảo khi bạn có DD214 vật lý hoặc muốn nhập thông tin cụ thể theo từng khối.', ko: 'DD214 양식 필드에 직접 정보를 입력하거나 붙여넣으세요. 실물 DD214가 있거나 블록별로 특정 정보를 입력하려는 경우에 적합합니다.' },
    allBlocksIncluded: { en: 'All standard DD214 blocks included', es: 'Todos los bloques estándar del DD214 incluidos', tl: 'Lahat ng standard DD214 blocks ay kasama', vi: 'Bao gồm tất cả các khối DD214 tiêu chuẩn', ko: '모든 표준 DD214 블록 포함' },
    saveMultipleDD214s: { en: 'Save multiple DD214s to My Packet', es: 'Guarda múltiples DD214s en Mi Paquete', tl: 'I-save ang maraming DD214s sa My Packet', vi: 'Lưu nhiều DD214 vào My Packet', ko: '여러 DD214를 내 패킷에 저장' },
    dataStaysPrivate: { en: 'Data stays 100% on your device', es: 'Los datos permanecen 100% en tu dispositivo', tl: 'Ang data ay nananatili 100% sa device mo', vi: 'Dữ liệu được lưu 100% trên thiết bị của bạn', ko: '데이터는 100% 기기에 저장됩니다' },
    guidedFormLabels: { en: 'Guided form with field labels', es: 'Formulario guiado con etiquetas de campos', tl: 'Guided form na may field labels', vi: 'Biểu mẫu hướng dẫn với nhãn trường', ko: '필드 레이블이 있는 안내 양식' },
    openFormBuilder: { en: 'Open Form Builder', es: 'Abrir Constructor de Formularios', tl: 'Buksan ang Form Builder', vi: 'Mở Trình Tạo Biểu Mẫu', ko: '양식 빌더 열기' },
    
    // Upload Input
    dropPdfFiles: { en: 'Drop PDF files here', es: 'Suelta archivos PDF aquí', tl: 'I-drop ang PDF files dito', vi: 'Thả tệp PDF vào đây', ko: 'PDF 파일을 여기에 놓으세요' },
    dragDropOrClick: { en: 'Drag & drop DD214 PDFs or click to browse', es: 'Arrastra y suelta DD214 PDFs o haz clic para navegar', tl: 'I-drag at i-drop ang DD214 PDFs o mag-click para mag-browse', vi: 'Kéo & thả DD214 PDF hoặc nhấp để duyệt', ko: 'DD214 PDF를 드래그 앤 드롭하거나 클릭하여 찾아보기' },
    supportedFormats: { en: 'Supports PDF, Word (.docx), Text, RTF • Scanned PDFs auto-OCR • Multiple files OK', es: 'Soporta PDF, Word (.docx), Texto, RTF • PDFs escaneados auto-OCR • Múltiples archivos OK', tl: 'Suportado ang PDF, Word (.docx), Text, RTF • Scanned PDFs auto-OCR • Maraming files OK', vi: 'Hỗ trợ PDF, Word (.docx), Text, RTF • PDF quét tự động OCR • Nhiều tệp OK', ko: 'PDF, Word(.docx), 텍스트, RTF 지원 • 스캔된 PDF 자동 OCR • 여러 파일 가능' },
    unsupportedFormat: { en: 'Please drop supported files: PDF, Word (.docx), Text (.txt), or RTF', es: 'Por favor suelta archivos soportados: PDF, Word (.docx), Texto (.txt), o RTF', tl: 'Mangyaring mag-drop ng supported files: PDF, Word (.docx), Text (.txt), o RTF', vi: 'Vui lòng thả các tệp được hỗ trợ: PDF, Word (.docx), Text (.txt) hoặc RTF', ko: '지원되는 파일을 놓으세요: PDF, Word(.docx), 텍스트(.txt) 또는 RTF' },
    
    // File List
    loadedFiles: { en: 'Loaded Files', es: 'Archivos Cargados', tl: 'Na-load na Files', vi: 'Tệp Đã Tải', ko: '로드된 파일' },
    runOcr: { en: 'Run OCR', es: 'Ejecutar OCR', tl: 'Patakbuhin ang OCR', vi: 'Chạy OCR', ko: 'OCR 실행' },
    processing: { en: 'Processing...', es: 'Procesando...', tl: 'Pinoproseso...', vi: 'Đang xử lý...', ko: '처리 중...' },
    pages: { en: 'pages', es: 'páginas', tl: 'mga pahina', vi: 'trang', ko: '페이지' },
    ocr: { en: 'OCR', es: 'OCR', tl: 'OCR', vi: 'OCR', ko: 'OCR' },
    hybrid: { en: 'Hybrid', es: 'Híbrido', tl: 'Hybrid', vi: 'Kết hợp', ko: '하이브리드' },
    text: { en: 'Text', es: 'Texto', tl: 'Text', vi: 'Văn bản', ko: '텍스트' },
    readyForOcrOrVision: { en: 'Ready for OCR or Vision AI', es: 'Listo para OCR o IA de Visión', tl: 'Handa na para sa OCR o Vision AI', vi: 'Sẵn sàng cho OCR hoặc AI Thị giác', ko: 'OCR 또는 비전 AI 준비 완료' },
    filesLoadedTip: { en: 'Files loaded! Click "Run OCR" above to extract text from your PDF, then "Analyze with AI".', es: '¡Archivos cargados! Haz clic en "Ejecutar OCR" arriba para extraer texto de tu PDF, luego "Analizar con IA".', tl: 'Na-load na ang files! I-click ang "Run OCR" sa itaas para i-extract ang text mula sa PDF mo, pagkatapos "Analyze with AI".', vi: 'Đã tải tệp! Nhấp "Chạy OCR" ở trên để trích xuất văn bản từ PDF, sau đó "Phân tích bằng AI".', ko: '파일이 로드되었습니다! 위의 "OCR 실행"을 클릭하여 PDF에서 텍스트를 추출한 다음 "AI로 분석"을 클릭하세요.' },
    allFilesProcessed: { en: 'All files have already been processed.', es: 'Todos los archivos ya han sido procesados.', tl: 'Lahat ng files ay naproseso na.', vi: 'Tất cả các tệp đã được xử lý.', ko: '모든 파일이 이미 처리되었습니다.' },
    
    // Error Messages
    error: { en: 'Error', es: 'Error', tl: 'Error', vi: 'Lỗi', ko: '오류' },
    runOcrFirst: { en: 'Please click "Run OCR" first to extract text from your PDF files, then analyze.', es: 'Por favor haz clic en "Ejecutar OCR" primero para extraer texto de tus archivos PDF, luego analiza.', tl: 'Mangyaring i-click muna ang "Run OCR" para i-extract ang text mula sa PDF files mo, pagkatapos i-analyze.', vi: 'Vui lòng nhấp "Chạy OCR" trước để trích xuất văn bản từ tệp PDF, sau đó phân tích.', ko: '먼저 "OCR 실행"을 클릭하여 PDF 파일에서 텍스트를 추출한 다음 분석하세요.' },
    pasteOrDropFirst: { en: 'Please paste DD214 text or drop in PDF files first.', es: 'Por favor pega el texto del DD214 o suelta archivos PDF primero.', tl: 'Mangyaring i-paste muna ang DD214 text o mag-drop ng PDF files.', vi: 'Vui lòng dán văn bản DD214 hoặc thả tệp PDF trước.', ko: 'DD214 텍스트를 붙여넣거나 PDF 파일을 먼저 놓으세요.' },
    aiNotAvailable: { en: 'AI is not available. Please configure AI settings first.', es: 'La IA no está disponible. Por favor configura los ajustes de IA primero.', tl: 'Hindi available ang AI. Mangyaring i-configure muna ang AI settings.', vi: 'AI không khả dụng. Vui lòng cấu hình cài đặt AI trước.', ko: 'AI를 사용할 수 없습니다. 먼저 AI 설정을 구성하세요.' },
    parseError: { en: 'Could not parse AI response. Please try again.', es: 'No se pudo analizar la respuesta de IA. Por favor intenta de nuevo.', tl: 'Hindi ma-parse ang AI response. Mangyaring subukan muli.', vi: 'Không thể phân tích phản hồi AI. Vui lòng thử lại.', ko: 'AI 응답을 파싱할 수 없습니다. 다시 시도하세요.' },
    analysisFailed: { en: 'Analysis failed. Please try again.', es: 'El análisis falló. Por favor intenta de nuevo.', tl: 'Nabigo ang pagsusuri. Mangyaring subukan muli.', vi: 'Phân tích thất bại. Vui lòng thử lại.', ko: '분석에 실패했습니다. 다시 시도하세요.' },
    saveFailed: { en: 'Failed to save results. Please try again.', es: 'Error al guardar los resultados. Por favor intenta de nuevo.', tl: 'Nabigong i-save ang mga resulta. Mangyaring subukan muli.', vi: 'Không thể lưu kết quả. Vui lòng thử lại.', ko: '결과 저장에 실패했습니다. 다시 시도하세요.' },
    prepareError: { en: 'Failed to prepare data for import. Please try again.', es: 'Error al preparar los datos para importar. Por favor intenta de nuevo.', tl: 'Nabigong ihanda ang data para sa pag-import. Mangyaring subukan muli.', vi: 'Không thể chuẩn bị dữ liệu để nhập. Vui lòng thử lại.', ko: '가져오기 위한 데이터 준비에 실패했습니다. 다시 시도하세요.' },
    
    // Analysis Results
    analysisComplete: { en: 'Analysis Complete', es: 'Análisis Completo', tl: 'Tapos na ang Pagsusuri', vi: 'Phân Tích Hoàn Tất', ko: '분석 완료' },
    dd214sConsolidated: { en: 'DD214s consolidated', es: 'DD214s consolidados', tl: 'DD214s consolidated', vi: 'DD214 được tổng hợp', ko: 'DD214 통합됨' },
    branch: { en: 'Branch', es: 'Rama', tl: 'Sangay', vi: 'Quân Chủng', ko: '군종' },
    mos: { en: 'MOS', es: 'MOS', tl: 'MOS', vi: 'MOS', ko: 'MOS' },
    timeInService: { en: 'Time in Service', es: 'Tiempo en Servicio', tl: 'Oras sa Serbisyo', vi: 'Thời Gian Phục Vụ', ko: '복무 기간' },
    separation: { en: 'Separation', es: 'Separación', tl: 'Paghihiwalay', vi: 'Giải Ngũ', ko: '제대' },
    na: { en: 'N/A', es: 'N/A', tl: 'N/A', vi: 'N/A', ko: 'N/A' },
    
    // Combat Service
    combatServiceVerified: { en: 'Combat Service Verified', es: 'Servicio de Combate Verificado', tl: 'Na-verify ang Combat Service', vi: 'Đã Xác Minh Phục Vụ Chiến Đấu', ko: '전투 복무 확인됨' },
    
    // Awards
    awardsDecorations: { en: 'Awards & Decorations', es: 'Premios y Condecoraciones', tl: 'Mga Award at Dekorasyon', vi: 'Giải Thưởng & Huân Chương', ko: '훈장 및 포상' },
    with: { en: 'w/', es: 'con', tl: 'na may', vi: 'với', ko: '~와' },
    
    // Extraction Notes
    notes: { en: 'Notes', es: 'Notas', tl: 'Mga Tala', vi: 'Ghi Chú', ko: '메모' },
    
    // Buttons
    clearAll: { en: 'Clear All', es: 'Limpiar Todo', tl: 'I-clear Lahat', vi: 'Xóa Tất Cả', ko: '모두 지우기' },
    saveToProfile: { en: 'Save to Profile', es: 'Guardar en Perfil', tl: 'I-save sa Profile', vi: 'Lưu vào Hồ Sơ', ko: '프로필에 저장' },
    analyzeWithAi: { en: 'Analyze with AI', es: 'Analizar con IA', tl: 'Suriin gamit ang AI', vi: 'Phân Tích bằng AI', ko: 'AI로 분석' },
    analyzing: { en: 'Analyzing...', es: 'Analizando...', tl: 'Sinusuri...', vi: 'Đang phân tích...', ko: '분석 중...' },
    close: { en: 'Close', es: 'Cerrar', tl: 'Isara', vi: 'Đóng', ko: '닫기' },
    
    // OCR Progress
    processingFile: { en: 'Processing', es: 'Procesando', tl: 'Pinoproseso', vi: 'Đang xử lý', ko: '처리 중' },
    pageOf: { en: 'Page', es: 'Página', tl: 'Pahina', vi: 'Trang', ko: '페이지' },
    of: { en: 'of', es: 'de', tl: 'ng', vi: 'trên', ko: '/' },
    
    // Saved DD214s
    savedDD214s: { en: 'Saved DD214s', es: 'DD214s Guardados', tl: 'Naka-save na DD214s', vi: 'DD214 Đã Lưu', ko: '저장된 DD214' },
    untitledDD214: { en: 'Untitled DD214', es: 'DD214 Sin Título', tl: 'Walang Pamagat na DD214', vi: 'DD214 Chưa Đặt Tên', ko: '제목 없는 DD214' },
    sep: { en: 'Sep:', es: 'Sep:', tl: 'Sep:', vi: 'Giải ngũ:', ko: '제대:' },
    manual: { en: 'Manual', es: 'Manual', tl: 'Manual', vi: 'Thủ công', ko: '수동' },
    ai: { en: 'AI', es: 'IA', tl: 'AI', vi: 'AI', ko: 'AI' },
    
    // Save Confirmation
    dd214DataSaved: { en: 'DD214 data saved!', es: '¡Datos del DD214 guardados!', tl: 'Na-save na ang DD214 data!', vi: 'Đã lưu dữ liệu DD214!', ko: 'DD214 데이터가 저장되었습니다!' },
    serviceHistoryUpdated: { en: 'Service history updated', es: 'Historial de servicio actualizado', tl: 'Na-update ang service history', vi: 'Lịch sử phục vụ đã cập nhật', ko: '복무 이력이 업데이트되었습니다' },
    awardsRecorded: { en: 'awards recorded', es: 'premios registrados', tl: 'mga award na naitala', vi: 'giải thưởng được ghi lại', ko: '훈장이 기록되었습니다' },
    profileFieldsImported: { en: 'profile field(s) imported', es: 'campo(s) de perfil importado(s)', tl: 'profile field(s) na-import', vi: 'trường hồ sơ đã nhập', ko: '프로필 필드 가져옴' },
  },

  // Exam Prep Room
  examPrepRoom: {
    // Header
    title: { en: 'Exam Prep Room', es: 'Sala de Preparación para el Examen', tl: 'Exam Prep Room', vi: 'Phòng Chuẩn Bị Khám', ko: '시험 준비실' },
    subtitle: { en: 'See the DBQ before the examiner does', es: 'Ve el DBQ antes que el examinador', tl: 'Tingnan ang DBQ bago ang examiner', vi: 'Xem DBQ trước người khám', ko: '심사관보다 먼저 DBQ 확인하기' },
    
    // Open Book Test Section
    openBookTest: { en: 'The Open Book Test', es: 'El Examen de Libro Abierto', tl: 'Ang Open Book Test', vi: 'Bài Kiểm Tra Sách Mở', ko: '오픈 북 테스트' },
    openBookDescription1: { en: "Your C&P examiner isn't improvising-they're checking boxes on a standardized form called a", es: 'Tu examinador C&P no está improvisando-está marcando casillas en un formulario estandarizado llamado', tl: 'Ang iyong C&P examiner ay hindi nag-iimbento-nagtse-check lang sila ng boxes sa isang standardized form na tinatawag na', vi: 'Người khám C&P của bạn không ngẫu hứng-họ đang đánh dấu vào các ô trên một biểu mẫu tiêu chuẩn gọi là', ko: 'C&P 심사관은 즉흥적으로 하는 것이 아닙니다-' },
    dbqFull: { en: 'Disability Benefits Questionnaire (DBQ)', es: 'Cuestionario de Beneficios por Discapacidad (DBQ)', tl: 'Disability Benefits Questionnaire (DBQ)', vi: 'Bảng Câu Hỏi Quyền Lợi Khuyết Tật (DBQ)', ko: '장애 혜택 설문지(DBQ)' },
    openBookDescription2: { en: 'This tool shows you the', es: 'Esta herramienta te muestra las', tl: 'Ipinapakita sa iyo ng tool na ito ang', vi: 'Công cụ này cho bạn thấy', ko: '이 도구는 다음을 보여줍니다' },
    exactQuestions: { en: 'exact questions', es: 'preguntas exactas', tl: 'eksaktong mga tanong', vi: 'câu hỏi chính xác', ko: '정확한 질문' },
    theyWillAskAnd: { en: "they'll ask and", es: 'que te harán y', tl: 'na itatanong nila at', vi: 'họ sẽ hỏi và', ko: '심사관이 물어볼 질문과' },
    strategicTips: { en: 'strategic tips', es: 'consejos estratégicos', tl: 'mga strategic tips', vi: 'mẹo chiến lược', ko: '전략적 팁' },
    howToAnswerHonestly: { en: 'on how to answer honestly without underselling your symptoms.', es: 'sobre cómo responder honestamente sin subestimar tus síntomas.', tl: 'kung paano sumagot ng matapat nang hindi ini-undersell ang iyong mga sintomas.', vi: 'về cách trả lời trung thực mà không đánh giá thấp triệu chứng của bạn.', ko: '증상을 과소평가하지 않고 정직하게 대답하는 방법에 대한 팁' },
    
    // Search Section
    searchForCondition: { en: 'Search for your condition:', es: 'Busca tu condición:', tl: 'Maghanap ng iyong kondisyon:', vi: 'Tìm kiếm tình trạng của bạn:', ko: '상태 검색:' },
    searchPlaceholder: { en: 'e.g., PTSD, Knee, Tinnitus, Migraine...', es: 'ej., PTSD, Rodilla, Tinnitus, Migraña...', tl: 'hal., PTSD, Tuhod, Tinnitus, Migraine...', vi: 'vd., PTSD, Đầu gối, Ù tai, Đau nửa đầu...', ko: '예: PTSD, 무릎, 이명, 편두통...' },
    
    // Condition List
    selectCondition: { en: 'Select a condition', es: 'Selecciona una condición', tl: 'Pumili ng kondisyon', vi: 'Chọn một tình trạng', ko: '상태 선택' },
    available: { en: 'available', es: 'disponibles', tl: 'available', vi: 'có sẵn', ko: '사용 가능' },
    noConditionsFound: { en: 'No conditions found matching', es: 'No se encontraron condiciones que coincidan con', tl: 'Walang kondisyon na nahanap na tumutugma sa', vi: 'Không tìm thấy tình trạng nào phù hợp với', ko: '일치하는 상태를 찾을 수 없습니다' },
    tryDifferentSearch: { en: 'Try a different search term or browse all conditions above.', es: 'Prueba un término de búsqueda diferente o explora todas las condiciones arriba.', tl: 'Subukan ang ibang search term o mag-browse ng lahat ng kondisyon sa itaas.', vi: 'Thử một từ khóa tìm kiếm khác hoặc duyệt tất cả các tình trạng ở trên.', ko: '다른 검색어를 시도하거나 위의 모든 상태를 찾아보세요.' },
    
    // DBQ Questions Screen
    backToConditionList: { en: '← Back to condition list', es: '← Volver a la lista de condiciones', tl: '← Bumalik sa listahan ng kondisyon', vi: '← Quay lại danh sách tình trạng', ko: '← 상태 목록으로 돌아가기' },
    diagnosticCode: { en: 'Diagnostic Code', es: 'Código de Diagnóstico', tl: 'Diagnostic Code', vi: 'Mã Chẩn Đoán', ko: '진단 코드' },
    
    // Strategic Tips Section
    strategicTipsForCondition: { en: 'Strategic Tips for This Condition', es: 'Consejos Estratégicos para Esta Condición', tl: 'Mga Strategic Tips para sa Kondisyong Ito', vi: 'Mẹo Chiến Lược cho Tình Trạng Này', ko: '이 상태에 대한 전략적 팁' },
    tipsHelpYouAnswer: { en: 'These tips help you answer honestly while ensuring the examiner understands the full impact of your condition.', es: 'Estos consejos te ayudan a responder honestamente mientras aseguras que el examinador entienda el impacto total de tu condición.', tl: 'Ang mga tip na ito ay tumutulong sa iyong sumagot ng matapat habang tinitiyak na naiintindihan ng examiner ang buong impact ng iyong kondisyon.', vi: 'Những mẹo này giúp bạn trả lời trung thực trong khi đảm bảo người khám hiểu đầy đủ tác động của tình trạng của bạn.', ko: '이러한 팁은 심사관이 귀하의 상태의 전체 영향을 이해하도록 하면서 정직하게 대답하는 데 도움이 됩니다.' },
    
    // Questions Section
    questionsExaminerWillAsk: { en: 'Questions the Examiner Will Ask', es: 'Preguntas que el Examinador Hará', tl: 'Mga Tanong na Itatanong ng Examiner', vi: 'Câu Hỏi Người Khám Sẽ Hỏi', ko: '심사관이 물어볼 질문' },
    actualQuestionsFromDBQ: { en: 'These are the actual questions from the DBQ form. Click each one to see what the examiner is really looking for.', es: 'Estas son las preguntas reales del formulario DBQ. Haz clic en cada una para ver qué está buscando realmente el examinador.', tl: 'Ito ang mga aktwal na tanong mula sa DBQ form. I-click ang bawat isa para makita kung ano talaga ang hinahanap ng examiner.', vi: 'Đây là các câu hỏi thực tế từ biểu mẫu DBQ. Nhấp vào từng câu để xem người khám thực sự đang tìm kiếm điều gì.', ko: '이것은 DBQ 양식의 실제 질문입니다. 각 질문을 클릭하여 심사관이 실제로 찾고 있는 것을 확인하세요.' },
    requiredQuestion: { en: 'Required Question', es: 'Pregunta Requerida', tl: 'Kinakailangang Tanong', vi: 'Câu Hỏi Bắt Buộc', ko: '필수 질문' },
    whatTheyReallyLookingFor: { en: "What They're Really Looking For:", es: 'Lo que Realmente Están Buscando:', tl: 'Ang Talagang Hinahanap Nila:', vi: 'Điều Họ Thực Sự Tìm Kiếm:', ko: '그들이 실제로 찾고 있는 것:' },
    officialDefinition: { en: 'Official Definition:', es: 'Definición Oficial:', tl: 'Opisyal na Kahulugan:', vi: 'Định Nghĩa Chính Thức:', ko: '공식 정의:' },
    possibleAnswers: { en: 'Possible Answers:', es: 'Respuestas Posibles:', tl: 'Posibleng Mga Sagot:', vi: 'Câu Trả Lời Có Thể:', ko: '가능한 답변:' },
    impactLevel: { en: 'Impact level', es: 'Nivel de impacto', tl: 'Antas ng impact', vi: 'Mức độ ảnh hưởng', ko: '영향 수준' },
    
    // Important Notes
    importantNotes: { en: 'Important Notes:', es: 'Notas Importantes:', tl: 'Mahahalagang Tala:', vi: 'Ghi Chú Quan Trọng:', ko: '중요 참고사항:' },
    
    // Ready Section
    readyForExam: { en: 'Ready for Your Exam', es: 'Listo para Tu Examen', tl: 'Handa na para sa Iyong Exam', vi: 'Sẵn Sàng cho Buổi Khám', ko: '시험 준비 완료' },
    readyDescription: { en: "Now you know exactly what questions are coming. Walk in prepared, answer honestly, and don't undersell your symptoms. The examiner is checking boxes-make sure they check the right ones.", es: 'Ahora sabes exactamente qué preguntas vienen. Entra preparado, responde honestamente y no subestimes tus síntomas. El examinador está marcando casillas-asegúrate de que marque las correctas.', tl: 'Ngayon alam mo na kung anong mga tanong ang darating. Pumasok na handa, sumagot ng matapat, at huwag i-undersell ang iyong mga sintomas. Nagtse-check ng boxes ang examiner-siguraduhing tama ang ma-check nila.', vi: 'Bây giờ bạn biết chính xác những câu hỏi sẽ đến. Bước vào đã chuẩn bị, trả lời trung thực, và đừng đánh giá thấp triệu chứng của bạn. Người khám đang đánh dấu các ô-hãy đảm bảo họ đánh dấu đúng.', ko: '이제 어떤 질문이 나올지 정확히 알게 되었습니다. 준비된 상태로 들어가고, 정직하게 대답하고, 증상을 과소평가하지 마세요. 심사관은 체크박스를 표시하고 있습니다-올바른 것을 표시하도록 하세요.' },
    viewAnotherCondition: { en: '← View Another Condition', es: '← Ver Otra Condición', tl: '← Tingnan ang Ibang Kondisyon', vi: '← Xem Tình Trạng Khác', ko: '← 다른 상태 보기' },
    closePrepRoom: { en: 'Close Prep Room', es: 'Cerrar Sala de Preparación', tl: 'Isara ang Prep Room', vi: 'Đóng Phòng Chuẩn Bị', ko: '준비실 닫기' },
    
    // Strategic Tips Titles (from STRATEGIC_TIPS constant)
    tipProstrating: { en: "What 'Prostrating' Really Means", es: "Lo que 'Postrante' Realmente Significa", tl: "Ano Talaga ang Ibig Sabihin ng 'Prostrating'", vi: "'Bất Lực' Thực Sự Có Nghĩa Là Gì", ko: "'쇠약하게 하는'의 진정한 의미" },
    tipRom: { en: 'Range of Motion (ROM) Testing', es: 'Prueba de Rango de Movimiento (ROM)', tl: 'Range of Motion (ROM) Testing', vi: 'Kiểm Tra Phạm Vi Chuyển Động (ROM)', ko: '관절 가동 범위(ROM) 검사' },
    tipFlareUps: { en: 'Flare-Ups Matter More Than You Think', es: 'Los Brotes Importan Más de lo que Piensas', tl: 'Mas Importante ang Flare-Ups Kaysa sa Iniisip Mo', vi: 'Các Đợt Bùng Phát Quan Trọng Hơn Bạn Nghĩ', ko: '악화 기간은 생각보다 중요합니다' },
    tipSocialImpairment: { en: 'Occupational and Social Impairment Keywords', es: 'Palabras Clave de Deterioro Ocupacional y Social', tl: 'Mga Keyword ng Occupational at Social Impairment', vi: 'Từ Khóa Suy Giảm Nghề Nghiệp và Xã Hội', ko: '직업 및 사회적 장애 키워드' },
    tipMedicationSideEffects: { en: 'Medication Side Effects Count', es: 'Los Efectos Secundarios de la Medicación Cuentan', tl: 'Mahalaga ang Medication Side Effects', vi: 'Tác Dụng Phụ của Thuốc Được Tính', ko: '약물 부작용도 고려됩니다' },
    tipSleepDisturbance: { en: 'Sleep Issues Are Powerful Evidence', es: 'Los Problemas de Sueño Son Evidencia Poderosa', tl: 'Malakas na Ebidensya ang mga Problema sa Pagtulog', vi: 'Vấn Đề Giấc Ngủ Là Bằng Chứng Mạnh Mẽ', ko: '수면 문제는 강력한 증거입니다' },
    tipFrequency: { en: 'Frequency Determines Your Rating', es: 'La Frecuencia Determina Tu Rating', tl: 'Ang Frequency ang Nagde-determine ng Rating Mo', vi: 'Tần Suất Quyết Định Xếp Hạng Của Bạn', ko: '빈도가 등급을 결정합니다' },
    tipLossOfUse: { en: 'Loss of Use = Higher Rating', es: 'Pérdida de Uso = Rating Más Alto', tl: 'Loss of Use = Mas Mataas na Rating', vi: 'Mất Khả Năng Sử Dụng = Xếp Hạng Cao Hơn', ko: '사용 상실 = 더 높은 등급' },
    
    // Strategic Tips Content
    tipProstrationContent: { en: "The CFR defines 'prostrating' as attacks so severe you MUST stop all activity and lie down, usually in a dark/quiet room. If you can 'power through' the pain, it's NOT prostrating. Be honest-if you sometimes have to lie down, say that specifically.", es: "El CFR define 'postrante' como ataques tan severos que DEBES detener toda actividad y acostarte, usualmente en una habitación oscura/tranquila. Si puedes 'aguantar' el dolor, NO es postrante. Sé honesto-si a veces tienes que acostarte, dilo específicamente.", tl: "Ang CFR ay nagde-define ng 'prostrating' bilang mga atake na sobrang severe na DAPAT mong itigil ang lahat ng aktibidad at humiga, kadalasan sa isang madilim/tahimik na kwarto. Kung kaya mong 'i-power through' ang sakit, HINDI ito prostrating. Maging matapat-kung minsan kailangan mong humiga, sabihin iyon ng espesipiko.", vi: "CFR định nghĩa 'bất lực' là các cơn tấn công nghiêm trọng đến mức bạn PHẢI dừng mọi hoạt động và nằm xuống, thường là trong phòng tối/yên tĩnh. Nếu bạn có thể 'chịu đựng' được cơn đau, đó KHÔNG phải là bất lực. Hãy trung thực-nếu đôi khi bạn phải nằm xuống, hãy nói cụ thể điều đó.", ko: "CFR은 '쇠약하게 하는'을 모든 활동을 멈추고 누워야 할 정도로 심한 발작으로 정의합니다. 보통 어둡고 조용한 방에서. 통증을 '참을 수 있다면' 쇠약하게 하는 것이 아닙니다. 정직하세요-때때로 누워야 한다면 구체적으로 말하세요." },
    tipRomContent: { en: "Stop moving EXACTLY when you first feel pain or discomfort. Do NOT push past the pain to show the examiner you're 'trying.' If you demonstrate a full range of motion, they will mark you as 'Normal' regardless of how much it hurts.", es: "Deja de moverte EXACTAMENTE cuando sientas dolor o malestar por primera vez. NO empujes más allá del dolor para mostrar al examinador que estás 'intentando'. Si demuestras un rango completo de movimiento, te marcarán como 'Normal' sin importar cuánto duela.", tl: "Tumigil sa paggalaw EKSAKTO kapag una kang nakaramdam ng sakit o discomfort. HUWAG i-push ang sakit para ipakita sa examiner na 'sinusubukan mo'. Kung nagpapakita ka ng full range of motion, ima-mark ka nila na 'Normal' kahit gaano kasakit.", vi: "Dừng di chuyển CHÍNH XÁC khi bạn lần đầu cảm thấy đau hoặc khó chịu. KHÔNG cố vượt qua cơn đau để cho người khám thấy bạn đang 'cố gắng'. Nếu bạn thể hiện phạm vi chuyển động đầy đủ, họ sẽ đánh dấu bạn là 'Bình thường' bất kể đau đến mức nào.", ko: "처음 통증이나 불편함을 느낄 때 정확히 움직임을 멈추세요. 심사관에게 '노력하고 있다'는 것을 보여주려고 통증을 넘어서지 마세요. 전체 관절 가동 범위를 보여주면 얼마나 아프든 '정상'으로 표시됩니다." },
    tipFlareUpsContent: { en: "The VA rates you based on your WORST flare-ups, not your average day. If your back 'locks up' 3-4 times per year requiring bed rest, that's a flare-up. Document the frequency, duration, and what triggers them.", es: "El VA te califica basándose en tus PEORES brotes, no en tu día promedio. Si tu espalda 'se bloquea' 3-4 veces al año requiriendo reposo en cama, eso es un brote. Documenta la frecuencia, duración y qué los desencadena.", tl: "Ang VA ay nagra-rate sa iyo batay sa iyong PINAKAMASAMANG flare-ups, hindi sa average mong araw. Kung ang likod mo ay 'nala-lock up' 3-4 na beses sa isang taon na nangangailangan ng bed rest, iyon ay flare-up. I-document ang frequency, duration, at kung ano ang nagti-trigger sa kanila.", vi: "VA đánh giá bạn dựa trên các đợt bùng phát TỆ NHẤT của bạn, không phải ngày bình thường. Nếu lưng của bạn 'cứng' 3-4 lần mỗi năm cần nghỉ ngơi trên giường, đó là một đợt bùng phát. Ghi lại tần suất, thời gian và những gì kích hoạt chúng.", ko: "VA는 평균적인 날이 아닌 최악의 악화 기간을 기준으로 등급을 매깁니다. 등이 1년에 3-4번 '경직'되어 침상 안정이 필요하다면 그것이 악화입니다. 빈도, 기간 및 유발 요인을 기록하세요." },
    tipSocialImpairmentContent: { en: "For mental health claims, use these specific terms if they apply to you: 'panic attacks,' 'memory loss,' 'difficulty concentrating,' 'suicidal ideation,' 'neglecting hygiene,' 'inability to establish relationships.' These are the exact phrases in the rating criteria.", es: "Para reclamos de salud mental, usa estos términos específicos si te aplican: 'ataques de pánico', 'pérdida de memoria', 'dificultad para concentrarse', 'ideación suicida', 'descuido de la higiene', 'incapacidad para establecer relaciones'. Estas son las frases exactas en los criterios de calificación.", tl: "Para sa mental health claims, gamitin ang mga specific terms na ito kung applicable sa iyo: 'panic attacks', 'memory loss', 'difficulty concentrating', 'suicidal ideation', 'neglecting hygiene', 'inability to establish relationships'. Ito ang eksaktong mga phrases sa rating criteria.", vi: "Đối với các yêu cầu sức khỏe tâm thần, hãy sử dụng các thuật ngữ cụ thể này nếu chúng áp dụng cho bạn: 'cơn hoảng loạn', 'mất trí nhớ', 'khó tập trung', 'ý tưởng tự tử', 'bỏ bê vệ sinh', 'không thể thiết lập mối quan hệ'. Đây là những cụm từ chính xác trong tiêu chí đánh giá.", ko: "정신 건강 청구의 경우, 해당되는 경우 다음 특정 용어를 사용하세요: '공황 발작', '기억 상실', '집중 곤란', '자살 충동', '위생 무시', '관계 형성 불능'. 이것들은 등급 기준의 정확한 문구입니다." },
    tipMedicationSideEffectsContent: { en: "The medications you take for your service-connected condition can affect your rating. Mention side effects like: drowsiness affecting work, weight gain, sexual dysfunction, GI distress. These are 'residuals of treatment' and factor into your rating.", es: "Los medicamentos que tomas para tu condición conectada al servicio pueden afectar tu rating. Menciona efectos secundarios como: somnolencia afectando el trabajo, aumento de peso, disfunción sexual, malestar GI. Estos son 'residuos del tratamiento' y se consideran en tu rating.", tl: "Ang mga gamot na iniinom mo para sa iyong service-connected condition ay pwedeng makaapekto sa rating mo. Banggitin ang mga side effects tulad ng: antok na nakakaapekto sa trabaho, weight gain, sexual dysfunction, GI distress. Ang mga ito ay 'residuals of treatment' at naka-factor sa rating mo.", vi: "Các loại thuốc bạn dùng cho tình trạng liên quan đến phục vụ có thể ảnh hưởng đến xếp hạng của bạn. Đề cập đến các tác dụng phụ như: buồn ngủ ảnh hưởng đến công việc, tăng cân, rối loạn chức năng tình dục, khó chịu tiêu hóa. Đây là 'di chứng của điều trị' và được tính vào xếp hạng của bạn.", ko: "복무 관련 상태에 복용하는 약물이 등급에 영향을 줄 수 있습니다. 졸음이 업무에 영향, 체중 증가, 성기능 장애, 소화기 불편 등의 부작용을 언급하세요. 이것들은 '치료의 후유증'이며 등급에 반영됩니다." },
    tipSleepDisturbanceContent: { en: "Chronic sleep impairment affects nearly every condition rating. Be specific: How many hours do you sleep? Do you wake up? How often? Do you have nightmares? Sleep separately from your spouse? This impacts both mental and physical ratings.", es: "El deterioro crónico del sueño afecta casi todos los ratings de condiciones. Sé específico: ¿Cuántas horas duermes? ¿Te despiertas? ¿Con qué frecuencia? ¿Tienes pesadillas? ¿Duermes separado de tu cónyuge? Esto impacta tanto los ratings mentales como físicos.", tl: "Ang chronic sleep impairment ay nakakaapekto sa halos lahat ng condition rating. Maging specific: Ilang oras ka natutulog? Nagigising ka ba? Gaano kadalas? May mga bangungot ka ba? Magkahiwalay ba kayong natutulog ng asawa mo? Nakakaapekto ito sa parehong mental at physical ratings.", vi: "Suy giảm giấc ngủ mãn tính ảnh hưởng đến hầu hết mọi đánh giá tình trạng. Hãy cụ thể: Bạn ngủ bao nhiêu giờ? Bạn có thức dậy không? Bao lâu một lần? Bạn có ác mộng không? Ngủ riêng với vợ/chồng? Điều này ảnh hưởng đến cả đánh giá tâm thần và thể chất.", ko: "만성 수면 장애는 거의 모든 상태 등급에 영향을 미칩니다. 구체적으로: 몇 시간 자나요? 깨나요? 얼마나 자주? 악몽을 꾸나요? 배우자와 따로 자나요? 이것은 정신 및 신체 등급 모두에 영향을 미칩니다." },
    tipFrequencyContent: { en: "Don't just say 'often' or 'sometimes.' The examiner needs specifics: 'Once per month,' 'Three times per week,' '10-15 episodes per year.' Keep a symptom log for 30 days before your exam if possible.", es: "No digas solo 'a menudo' o 'a veces'. El examinador necesita específicos: 'Una vez al mes', 'Tres veces por semana', '10-15 episodios por año'. Mantén un registro de síntomas por 30 días antes de tu examen si es posible.", tl: "Huwag lang sabihin na 'madalas' o 'minsan'. Kailangan ng examiner ng specifics: 'Isang beses sa isang buwan', 'Tatlong beses sa isang linggo', '10-15 episodes sa isang taon'. Mag-keep ng symptom log ng 30 araw bago ang exam mo kung pwede.", vi: "Đừng chỉ nói 'thường xuyên' hoặc 'đôi khi'. Người khám cần cụ thể: 'Một lần mỗi tháng', 'Ba lần mỗi tuần', '10-15 lần mỗi năm'. Giữ nhật ký triệu chứng trong 30 ngày trước buổi khám nếu có thể.", ko: "'자주' 또는 '가끔'이라고만 말하지 마세요. 심사관은 구체적인 정보가 필요합니다: '한 달에 한 번', '일주일에 세 번', '연간 10-15회'. 가능하면 시험 전 30일 동안 증상 기록을 유지하세요." },
    tipLossOfUseContent: { en: "If you can't perform a specific function (e.g., can't grip tools, can't squat, can't climb stairs), say that explicitly. Partial loss of use still qualifies. Example: 'I can no longer tie my shoes without assistance' is more powerful than 'My hands hurt.'", es: "Si no puedes realizar una función específica (ej., no puedes agarrar herramientas, no puedes agacharte, no puedes subir escaleras), dilo explícitamente. La pérdida parcial de uso también califica. Ejemplo: 'Ya no puedo atarme los zapatos sin ayuda' es más poderoso que 'Me duelen las manos'.", tl: "Kung hindi mo magawa ang isang specific function (hal., hindi makahawak ng tools, hindi makaupo ng squats, hindi makaakyat ng stairs), sabihin iyon explicitly. Ang partial loss of use ay qualify pa rin. Halimbawa: 'Hindi ko na kaya itali ang sapatos ko nang walang tulong' ay mas powerful kaysa 'Masakit ang kamay ko'.", vi: "Nếu bạn không thể thực hiện một chức năng cụ thể (ví dụ: không thể cầm nắm công cụ, không thể ngồi xổm, không thể leo cầu thang), hãy nói rõ ràng điều đó. Mất một phần khả năng sử dụng vẫn đủ điều kiện. Ví dụ: 'Tôi không còn có thể tự buộc dây giày' mạnh hơn 'Tay tôi đau'.", ko: "특정 기능을 수행할 수 없다면 (예: 도구를 쥘 수 없음, 쪼그려 앉을 수 없음, 계단을 오를 수 없음) 명시적으로 말하세요. 부분적인 사용 상실도 자격이 됩니다. 예: '더 이상 도움 없이 신발 끈을 묶을 수 없습니다'가 '손이 아픕니다'보다 더 강력합니다." },
  },

  // Witness Bench (Buddy Letter Wizard)
  witnessBench: {
    // Header
    title: { en: 'The Witness Bench', es: 'El Banco de Testigos', tl: 'Ang Witness Bench', vi: 'Ghế Nhân Chứng', ko: '증인석' },
    subtitle: { en: 'Buddy Letter Wizard (VA Form 21-10210)', es: 'Asistente de Carta de Compañero (Formulario VA 21-10210)', tl: 'Buddy Letter Wizard (VA Form 21-10210)', vi: 'Trình Hướng Dẫn Thư Đồng Đội (Mẫu VA 21-10210)', ko: '동료 편지 마법사 (VA Form 21-10210)' },
    aiBadge: { en: 'AI', es: 'IA', tl: 'AI', vi: 'AI', ko: 'AI' },
    betaBadge: { en: 'BETA', es: 'BETA', tl: 'BETA', vi: 'BETA', ko: '베타' },
    
    // Relationship Types
    relationshipSpouse: { en: 'Spouse / Partner', es: 'Cónyuge / Pareja', tl: 'Asawa / Kasintahan', vi: 'Vợ/Chồng / Bạn Đời', ko: '배우자 / 파트너' },
    relationshipParent: { en: 'Parent', es: 'Padre/Madre', tl: 'Magulang', vi: 'Cha Mẹ', ko: '부모' },
    relationshipChild: { en: 'Adult Child', es: 'Hijo Adulto', tl: 'Adult na Anak', vi: 'Con Trưởng Thành', ko: '성인 자녀' },
    relationshipSibling: { en: 'Sibling', es: 'Hermano/a', tl: 'Kapatid', vi: 'Anh Chị Em', ko: '형제자매' },
    relationshipFriend: { en: 'Close Friend', es: 'Amigo Cercano', tl: 'Malapit na Kaibigan', vi: 'Bạn Thân', ko: '친한 친구' },
    relationshipBuddy: { en: 'Battle Buddy / Fellow Veteran', es: 'Compañero de Batalla / Veterano', tl: 'Battle Buddy / Kapwa Beterano', vi: 'Đồng Đội Chiến Đấu / Cựu Chiến Binh', ko: '전우 / 동료 재향군인' },
    relationshipCoworker: { en: 'Coworker / Supervisor', es: 'Compañero de Trabajo / Supervisor', tl: 'Katrabaho / Supervisor', vi: 'Đồng Nghiệp / Giám Sát', ko: '동료 / 상사' },
    relationshipNeighbor: { en: 'Neighbor', es: 'Vecino', tl: 'Kapitbahay', vi: 'Hàng Xóm', ko: '이웃' },
    
    // Condition Categories
    categoryMental: { en: 'Mental Health (PTSD, Depression, Anxiety)', es: 'Salud Mental (TEPT, Depresión, Ansiedad)', tl: 'Mental Health (PTSD, Depression, Anxiety)', vi: 'Sức Khỏe Tâm Thần (PTSD, Trầm Cảm, Lo Âu)', ko: '정신 건강 (PTSD, 우울증, 불안)' },
    categoryPhysical: { en: 'Musculoskeletal / Pain (Back, Knee, Neck)', es: 'Musculoesquelético / Dolor (Espalda, Rodilla, Cuello)', tl: 'Musculoskeletal / Sakit (Likod, Tuhod, Leeg)', vi: 'Cơ Xương / Đau (Lưng, Đầu Gối, Cổ)', ko: '근골격계 / 통증 (허리, 무릎, 목)' },
    categoryNeurological: { en: 'Neurological (TBI, Headaches, Neuropathy)', es: 'Neurológico (TBI, Dolores de Cabeza, Neuropatía)', tl: 'Neurological (TBI, Headaches, Neuropathy)', vi: 'Thần Kinh (TBI, Đau Đầu, Bệnh Thần Kinh)', ko: '신경계 (TBI, 두통, 신경병증)' },
    categoryHearing: { en: 'Hearing / Tinnitus', es: 'Audición / Tinnitus', tl: 'Pandinig / Tinnitus', vi: 'Thính Giác / Ù Tai', ko: '청력 / 이명' },
    categoryRespiratory: { en: 'Respiratory (Asthma, Sleep Apnea, COPD)', es: 'Respiratorio (Asma, Apnea del Sueño, EPOC)', tl: 'Respiratory (Asthma, Sleep Apnea, COPD)', vi: 'Hô Hấp (Hen Suyễn, Ngưng Thở Khi Ngủ, COPD)', ko: '호흡기 (천식, 수면 무호흡증, COPD)' },
    categoryOther: { en: 'Other Condition', es: 'Otra Condición', tl: 'Iba Pang Kondisyon', vi: 'Tình Trạng Khác', ko: '기타 상태' },
    
    // Step 1: Setup
    step1Title: { en: 'Step 1: Who is writing this statement?', es: 'Paso 1: ¿Quién escribe esta declaración?', tl: 'Hakbang 1: Sino ang sumusulat ng statement na ito?', vi: 'Bước 1: Ai đang viết bản tuyên bố này?', ko: '1단계: 누가 이 진술서를 작성하나요?' },
    step2Title: { en: 'Step 2: What condition is the veteran claiming?', es: 'Paso 2: ¿Qué condición está reclamando el veterano?', tl: 'Hakbang 2: Anong kondisyon ang cinalaim ng beterano?', vi: 'Bước 2: Cựu chiến binh đang yêu cầu tình trạng gì?', ko: '2단계: 재향군인이 어떤 상태를 청구하나요?' },
    step3Title: { en: 'Step 3: Witness Name', es: 'Paso 3: Nombre del Testigo', tl: 'Hakbang 3: Pangalan ng Saksi', vi: 'Bước 3: Tên Nhân Chứng', ko: '3단계: 증인 이름' },
    conditionPlaceholder: { en: 'e.g., PTSD, Lower Back Pain, Tinnitus, Sleep Apnea', es: 'ej., TEPT, Dolor de Espalda Baja, Tinnitus, Apnea del Sueño', tl: 'hal., PTSD, Lower Back Pain, Tinnitus, Sleep Apnea', vi: 'vd., PTSD, Đau Lưng Dưới, Ù Tai, Ngưng Thở Khi Ngủ', ko: '예: PTSD, 허리 통증, 이명, 수면 무호흡증' },
    conditionHelpText: { en: 'Enter the specific condition or disability being claimed', es: 'Ingresa la condición o discapacidad específica que se reclama', tl: 'Ilagay ang specific na kondisyon o disability na cinalaim', vi: 'Nhập tình trạng hoặc khuyết tật cụ thể đang được yêu cầu', ko: '청구 중인 특정 상태 또는 장애를 입력하세요' },
    witnessNamePlaceholder: { en: 'e.g., Jane Smith, John Doe', es: 'ej., María García, Juan Pérez', tl: 'hal., Maria Santos, Juan dela Cruz', vi: 'vd., Nguyễn Văn A, Trần Thị B', ko: '예: 홍길동, 김철수' },
    witnessNameHelpText: { en: 'Full name of the person providing this witness statement', es: 'Nombre completo de la persona que proporciona esta declaración', tl: 'Buong pangalan ng taong nagbibigay ng witness statement na ito', vi: 'Họ tên đầy đủ của người cung cấp bản tuyên bố nhân chứng này', ko: '이 증인 진술서를 제공하는 사람의 전체 이름' },
    
    // AI Toggle Section
    aiPoweredInterview: { en: 'AI-Powered Interview', es: 'Entrevista con IA', tl: 'AI-Powered Interview', vi: 'Phỏng Vấn Hỗ Trợ AI', ko: 'AI 지원 인터뷰' },
    aiAvailableDesc: { en: 'Generate custom interview questions tailored to the relationship and condition', es: 'Genera preguntas de entrevista personalizadas según la relación y condición', tl: 'Gumawa ng custom na interview questions na naka-tailor sa relationship at condition', vi: 'Tạo câu hỏi phỏng vấn tùy chỉnh phù hợp với mối quan hệ và tình trạng', ko: '관계와 상태에 맞춤화된 인터뷰 질문 생성' },
    aiNotConfigured: { en: 'AI not configured - using standard interview questions', es: 'IA no configurada - usando preguntas de entrevista estándar', tl: 'Hindi naka-configure ang AI - gumagamit ng standard interview questions', vi: 'AI chưa được cấu hình - sử dụng câu hỏi phỏng vấn tiêu chuẩn', ko: 'AI 미구성 - 표준 인터뷰 질문 사용' },
    usingLocalAI: { en: 'Using: 🔒 Local AI (Private)', es: 'Usando: 🔒 IA Local (Privada)', tl: 'Ginagamit: 🔒 Local AI (Private)', vi: 'Đang sử dụng: 🔒 AI Cục Bộ (Riêng Tư)', ko: '사용 중: 🔒 로컬 AI (비공개)' },
    usingCloudAI: { en: 'Using: ☁️ Cloud AI (Gemini)', es: 'Usando: ☁️ IA en la Nube (Gemini)', tl: 'Ginagamit: ☁️ Cloud AI (Gemini)', vi: 'Đang sử dụng: ☁️ AI Đám Mây (Gemini)', ko: '사용 중: ☁️ 클라우드 AI (Gemini)' },
    configureAI: { en: 'Configure AI', es: 'Configurar IA', tl: 'I-configure ang AI', vi: 'Cấu Hình AI', ko: 'AI 구성' },
    standardQuestionsWork: { en: 'Standard questions work great!', es: '¡Las preguntas estándar funcionan muy bien!', tl: 'Mahusay ang standard questions!', vi: 'Câu hỏi tiêu chuẩn hoạt động tốt!', ko: '표준 질문이 잘 작동합니다!' },
    aiOptionalNote: { en: 'AI is optional and creates additional tailored questions based on the specific relationship and condition.', es: 'La IA es opcional y crea preguntas adicionales adaptadas según la relación y condición específica.', tl: 'Optional lang ang AI at gumagawa ng additional tailored questions batay sa specific na relationship at condition.', vi: 'AI là tùy chọn và tạo thêm các câu hỏi phù hợp dựa trên mối quan hệ và tình trạng cụ thể.', ko: 'AI는 선택 사항이며 특정 관계와 상태에 맞는 추가 질문을 생성합니다.' },
    
    // Error Messages
    selectRelationshipAndCondition: { en: 'Please select a relationship and enter the condition.', es: 'Por favor selecciona una relación e ingresa la condición.', tl: 'Mangyaring pumili ng relationship at ilagay ang condition.', vi: 'Vui lòng chọn mối quan hệ và nhập tình trạng.', ko: '관계를 선택하고 상태를 입력해 주세요.' },
    
    // Start Button
    preparingInterview: { en: 'Preparing Interview...', es: 'Preparando Entrevista...', tl: 'Inihahanda ang Interview...', vi: 'Đang Chuẩn Bị Phỏng Vấn...', ko: '인터뷰 준비 중...' },
    startInterview: { en: 'Start Interview', es: 'Iniciar Entrevista', tl: 'Simulan ang Interview', vi: 'Bắt Đầu Phỏng Vấn', ko: '인터뷰 시작' },
    
    // Step 2: Interview
    questionOf: { en: 'Question {current} of {total}', es: 'Pregunta {current} de {total}', tl: 'Tanong {current} ng {total}', vi: 'Câu hỏi {current} trong số {total}', ko: '{total}개 중 {current}번째 질문' },
    answered: { en: 'answered', es: 'respondidas', tl: 'nasagot', vi: 'đã trả lời', ko: '답변됨' },
    voiceInputTip: { en: "Voice Input: Click the microphone to speak - your voice stays on your device, not our servers. Be specific with examples.", es: 'Entrada de Voz: Haz clic en el micrófono para hablar - tu voz permanece en tu dispositivo, no en nuestros servidores. Sé específico con ejemplos.', tl: 'Voice Input: I-click ang microphone para magsalita - ang boses mo ay nananatili sa device mo, hindi sa servers namin. Maging specific sa mga halimbawa.', vi: 'Nhập Giọng Nói: Nhấp vào micrô để nói - giọng nói của bạn ở trên thiết bị của bạn, không phải máy chủ của chúng tôi. Hãy cụ thể với các ví dụ.', ko: '음성 입력: 마이크를 클릭하여 말하세요 - 음성은 서버가 아닌 장치에 저장됩니다. 예시와 함께 구체적으로 말하세요.' },
    ctrlEnterTip: { en: 'Tip: Press Ctrl+Enter to advance, or use the microphone to speak your answer', es: 'Consejo: Presiona Ctrl+Enter para avanzar, o usa el micrófono para decir tu respuesta', tl: 'Tip: Pindutin ang Ctrl+Enter para mag-advance, o gamitin ang microphone para sabihin ang sagot mo', vi: 'Mẹo: Nhấn Ctrl+Enter để tiến lên, hoặc sử dụng micrô để nói câu trả lời của bạn', ko: '팁: Ctrl+Enter를 눌러 진행하거나 마이크를 사용하여 답변을 말하세요' },
    previous: { en: '← Previous', es: '← Anterior', tl: '← Nakaraan', vi: '← Trước', ko: '← 이전' },
    next: { en: 'Next →', es: 'Siguiente →', tl: 'Susunod →', vi: 'Tiếp →', ko: '다음 →' },
    generating: { en: 'Generating...', es: 'Generando...', tl: 'Ginagawa...', vi: 'Đang Tạo...', ko: '생성 중...' },
    generateStatement: { en: 'Generate Statement', es: 'Generar Declaración', tl: 'Gumawa ng Statement', vi: 'Tạo Bản Tuyên Bố', ko: '진술서 생성' },
    jumpToQuestion: { en: 'Jump to question:', es: 'Ir a la pregunta:', tl: 'Pumunta sa tanong:', vi: 'Chuyển đến câu hỏi:', ko: '질문으로 이동:' },
    
    // Step 3: Output
    statementGenerated: { en: 'Statement Generated!', es: '¡Declaración Generada!', tl: 'Nagawa na ang Statement!', vi: 'Đã Tạo Bản Tuyên Bố!', ko: '진술서 생성 완료!' },
    reviewEditDownload: { en: 'Review, edit if needed, then download for VA Form 21-10210', es: 'Revisa, edita si es necesario, luego descarga para el Formulario VA 21-10210', tl: 'I-review, i-edit kung kailangan, pagkatapos i-download para sa VA Form 21-10210', vi: 'Xem xét, chỉnh sửa nếu cần, sau đó tải xuống cho Mẫu VA 21-10210', ko: '검토하고 필요시 편집한 후 VA Form 21-10210용으로 다운로드' },
    yourBuddyStatement: { en: 'Your Buddy Statement', es: 'Tu Declaración de Compañero', tl: 'Ang Iyong Buddy Statement', vi: 'Bản Tuyên Bố Đồng Đội Của Bạn', ko: '귀하의 동료 진술서' },
    copy: { en: 'Copy', es: 'Copiar', tl: 'Kopyahin', vi: 'Sao Chép', ko: '복사' },
    download: { en: 'Download', es: 'Descargar', tl: 'I-download', vi: 'Tải Xuống', ko: '다운로드' },
    saveToMyPacket: { en: 'Save to My Packet', es: 'Guardar en Mi Paquete', tl: 'I-save sa My Packet', vi: 'Lưu vào Hồ Sơ Của Tôi', ko: '내 패킷에 저장' },
    savedToMyPacket: { en: 'Saved to My Packet', es: 'Guardado en Mi Paquete', tl: 'Na-save sa My Packet', vi: 'Đã Lưu vào Hồ Sơ Của Tôi', ko: '내 패킷에 저장됨' },
    downloadAsPDF: { en: 'Download as PDF', es: 'Descargar como PDF', tl: 'I-download bilang PDF', vi: 'Tải Xuống dạng PDF', ko: 'PDF로 다운로드' },
    downloadAsDOCX: { en: 'Download as DOCX', es: 'Descargar como DOCX', tl: 'I-download bilang DOCX', vi: 'Tải Xuống dạng DOCX', ko: 'DOCX로 다운로드' },
    statementCopied: { en: 'Statement copied to clipboard!', es: '¡Declaración copiada al portapapeles!', tl: 'Nakopya ang statement sa clipboard!', vi: 'Đã sao chép bản tuyên bố vào clipboard!', ko: '진술서가 클립보드에 복사되었습니다!' },
    
    // Next Steps
    nextStepsTitle: { en: 'Next Steps:', es: 'Próximos Pasos:', tl: 'Mga Susunod na Hakbang:', vi: 'Các Bước Tiếp Theo:', ko: '다음 단계:' },
    nextStep1: { en: 'Review and edit the statement for accuracy', es: 'Revisa y edita la declaración para mayor precisión', tl: 'I-review at i-edit ang statement para sa accuracy', vi: 'Xem xét và chỉnh sửa bản tuyên bố cho chính xác', ko: '정확성을 위해 진술서를 검토하고 편집하세요' },
    nextStep2: { en: 'Have the witness read and approve the final version', es: 'Haz que el testigo lea y apruebe la versión final', tl: 'Ipabasa at ipa-approve sa saksi ang final version', vi: 'Cho nhân chứng đọc và phê duyệt phiên bản cuối cùng', ko: '증인이 최종 버전을 읽고 승인하도록 하세요' },
    nextStep3: { en: 'Witness signs and dates the statement', es: 'El testigo firma y fecha la declaración', tl: 'Pipirma at lalagyan ng petsa ng saksi ang statement', vi: 'Nhân chứng ký và ghi ngày trên bản tuyên bố', ko: '증인이 진술서에 서명하고 날짜를 기입합니다' },
    nextStep4: { en: 'Submit with your VA claim as supporting evidence', es: 'Envía con tu reclamo VA como evidencia de apoyo', tl: 'I-submit kasama ng VA claim mo bilang supporting evidence', vi: 'Gửi cùng với yêu cầu VA như bằng chứng hỗ trợ', ko: 'VA 청구서와 함께 지원 증거로 제출하세요' },
    
    // Start Over
    startNewStatement: { en: 'Start New Statement', es: 'Iniciar Nueva Declaración', tl: 'Magsimula ng Bagong Statement', vi: 'Bắt Đầu Bản Tuyên Bố Mới', ko: '새 진술서 시작' },
    
    // Info Banners
    whyBuddyStatementsMatter: { en: 'Why Buddy Statements Matter', es: 'Por Qué Importan las Declaraciones de Compañeros', tl: 'Bakit Mahalaga ang Buddy Statements', vi: 'Tại Sao Các Bản Tuyên Bố Đồng Đội Quan Trọng', ko: '동료 진술서가 중요한 이유' },
    buddyStatementExplanation: { en: 'Veterans often downplay their symptoms. A spouse who sees them scream in their sleep, or a friend who watches them struggle to walk, provides powerful third-party evidence the VA takes seriously.', es: 'Los veteranos a menudo minimizan sus síntomas. Un cónyuge que los ve gritar mientras duermen, o un amigo que los ve luchar para caminar, proporciona evidencia poderosa de terceros que el VA toma en serio.', tl: 'Madalas na mina-minimize ng mga beterano ang kanilang mga sintomas. Ang asawa na nakakakita sa kanilang sumisigaw habang natutulog, o kaibigan na nakikita silang nahihirapang maglakad, nagbibigay ng malakas na third-party evidence na sineseryoso ng VA.', vi: 'Cựu chiến binh thường đánh giá thấp triệu chứng của họ. Vợ/chồng thấy họ la hét trong giấc ngủ, hoặc bạn bè thấy họ vật lộn để đi bộ, cung cấp bằng chứng bên thứ ba mạnh mẽ mà VA coi trọng.', ko: '재향군인들은 종종 증상을 과소평가합니다. 잠에서 소리 지르는 것을 보는 배우자나 걷기 힘들어하는 것을 보는 친구는 VA가 진지하게 받아들이는 강력한 제3자 증거를 제공합니다.' },
    aiRequiredTitle: { en: 'AI Required for Analysis', es: 'IA Requerida para el Análisis', tl: 'Kinakailangan ang AI para sa Analysis', vi: 'Yêu Cầu AI cho Phân Tích', ko: '분석에 AI 필요' },
    aiRequiredExplanation: { en: 'Click the AI Status button in the header above to load your secure Local AI (100% private) or enter your Gemini API key.', es: 'Haz clic en el botón Estado de IA en el encabezado para cargar tu IA Local segura (100% privada) o ingresa tu clave API de Gemini.', tl: 'I-click ang AI Status button sa header sa itaas para i-load ang secure Local AI mo (100% private) o ilagay ang Gemini API key mo.', vi: 'Nhấp vào nút Trạng Thái AI trong tiêu đề phía trên để tải AI Cục Bộ an toàn của bạn (100% riêng tư) hoặc nhập khóa API Gemini của bạn.', ko: '위 헤더의 AI 상태 버튼을 클릭하여 보안 로컬 AI(100% 비공개)를 로드하거나 Gemini API 키를 입력하세요.' },
  },

  // C-File Analyzer
  cfileAnalyzer: {
    // Header
    title: { en: 'C-File Analyzer', es: 'Analizador de C-File', tl: 'C-File Analyzer', vi: 'Phân Tích C-File', ko: 'C-File 분석기' },
    subtitle: { en: 'AI-powered claims evidence discovery', es: 'Descubrimiento de evidencia de reclamos impulsado por IA', tl: 'AI-powered claims evidence discovery', vi: 'Khám phá bằng chứng yêu cầu bằng AI', ko: 'AI 기반 청구 증거 발견' },
    beta: { en: 'BETA', es: 'BETA', tl: 'BETA', vi: 'BETA', ko: '베타' },
    ai: { en: 'AI', es: 'IA', tl: 'AI', vi: 'AI', ko: 'AI' },
    vaUsesSimilarAi: { en: 'VA Uses Similar AI', es: 'El VA Usa IA Similar', tl: 'Gumagamit din ang VA ng Similar AI', vi: 'VA Sử Dụng AI Tương Tự', ko: 'VA도 유사한 AI 사용' },
    
    // Security Notice
    securityNotice: { en: 'Security Notice', es: 'Aviso de Seguridad', tl: 'Security Notice', vi: 'Thông Báo Bảo Mật', ko: '보안 알림' },
    securityNoticeDesc: { en: 'Your C-File contains highly sensitive information. This tool processes everything locally in your browser. Only the extracted text is sent to Google\'s AI service using YOUR API key. We never see or store your data.', es: 'Tu C-File contiene información altamente sensible. Esta herramienta procesa todo localmente en tu navegador. Solo el texto extraído se envía al servicio de IA de Google usando TU clave API. Nunca vemos ni almacenamos tus datos.', tl: 'Ang C-File mo ay naglalaman ng highly sensitive na impormasyon. Pinoproseso ng tool na ito ang lahat locally sa browser mo. Ang extracted text lang ang ipinapadala sa Google AI service gamit ang API key MO. Hindi namin nakikita o sino-store ang data mo.', vi: 'C-File của bạn chứa thông tin rất nhạy cảm. Công cụ này xử lý mọi thứ cục bộ trong trình duyệt của bạn. Chỉ văn bản đã trích xuất được gửi đến dịch vụ AI của Google bằng khóa API CỦA BẠN. Chúng tôi không bao giờ xem hoặc lưu trữ dữ liệu của bạn.', ko: 'C-File에는 매우 민감한 정보가 포함되어 있습니다. 이 도구는 브라우저에서 모든 것을 로컬로 처리합니다. 추출된 텍스트만 귀하의 API 키를 사용하여 Google AI 서비스로 전송됩니다. 우리는 귀하의 데이터를 보거나 저장하지 않습니다.' },
    
    // AI Tip
    unlimitedFileSize: { en: 'Unlimited File Size:', es: 'Tamaño de Archivo Ilimitado:', tl: 'Unlimited File Size:', vi: 'Kích Thước Tệp Không Giới Hạn:', ko: '무제한 파일 크기:' },
    unlimitedFileSizeDesc: { en: 'Drop in C-Files of ANY size (even 300MB+). Large files are automatically split into chunks and analyzed, then merged into a complete report.', es: 'Suelta C-Files de CUALQUIER tamaño (incluso 300MB+). Los archivos grandes se dividen automáticamente en fragmentos y se analizan, luego se fusionan en un informe completo.', tl: 'I-drop ang C-Files ng ANUMANG size (kahit 300MB+). Ang malalaking files ay awtomatikong hinahati sa chunks at sinusuri, pagkatapos ay pinagsasama sa isang kumpletong report.', vi: 'Thả C-File có BẤT KỲ kích thước nào (thậm chí 300MB+). Các tệp lớn được tự động chia thành các phần và phân tích, sau đó hợp nhất thành một báo cáo hoàn chỉnh.', ko: '어떤 크기의 C-File도 드롭하세요 (300MB 이상도 가능). 큰 파일은 자동으로 청크로 분할되어 분석된 후 완전한 보고서로 병합됩니다.' },
    
    // Drop Zone
    dropYourCFile: { en: 'Drop your C-File PDF here', es: 'Suelta tu PDF de C-File aquí', tl: 'I-drop ang C-File PDF mo dito', vi: 'Thả PDF C-File của bạn vào đây', ko: 'C-File PDF를 여기에 놓으세요' },
    orClickToBrowse: { en: 'or click to browse', es: 'o haz clic para navegar', tl: 'o mag-click para mag-browse', vi: 'hoặc nhấp để duyệt', ko: '또는 클릭하여 찾아보기' },
    supportsPdfUpTo: { en: 'Supports PDF files up to 500MB', es: 'Soporta archivos PDF hasta 500MB', tl: 'Suportado ang PDF files hanggang 500MB', vi: 'Hỗ trợ tệp PDF lên đến 500MB', ko: '최대 500MB PDF 파일 지원' },
    removeFile: { en: 'Remove and choose different file', es: 'Eliminar y elegir archivo diferente', tl: 'Alisin at pumili ng ibang file', vi: 'Xóa và chọn tệp khác', ko: '삭제하고 다른 파일 선택' },
    
    // Errors
    pleaseDropPdf: { en: 'Please drop in a PDF file.', es: 'Por favor suelta un archivo PDF.', tl: 'Mangyaring mag-drop ng PDF file.', vi: 'Vui lòng thả tệp PDF.', ko: 'PDF 파일을 놓으세요.' },
    pleaseUploadPdf: { en: 'Please upload a PDF file.', es: 'Por favor sube un archivo PDF.', tl: 'Mangyaring mag-upload ng PDF file.', vi: 'Vui lòng tải lên tệp PDF.', ko: 'PDF 파일을 업로드하세요.' },
    pleaseDropFileFirst: { en: 'Please drop in a file first.', es: 'Por favor suelta un archivo primero.', tl: 'Mangyaring mag-drop muna ng file.', vi: 'Vui lòng thả tệp trước.', ko: '먼저 파일을 놓으세요.' },
    noAiAvailable: { en: 'No AI available. Please set up an API key or enable Local AI in settings.', es: 'No hay IA disponible. Por favor configura una clave API o habilita IA Local en configuración.', tl: 'Walang available na AI. Mangyaring mag-set up ng API key o i-enable ang Local AI sa settings.', vi: 'Không có AI khả dụng. Vui lòng thiết lập khóa API hoặc bật AI Cục bộ trong cài đặt.', ko: 'AI를 사용할 수 없습니다. API 키를 설정하거나 설정에서 로컬 AI를 활성화하세요.' },
    scannedImageError: { en: 'This PDF appears to be a scanned image with minimal text', es: 'Este PDF parece ser una imagen escaneada con texto mínimo', tl: 'Ang PDF na ito ay mukhang scanned image na may minimal na text', vi: 'PDF này có vẻ là hình ảnh quét với văn bản tối thiểu', ko: '이 PDF는 최소한의 텍스트가 있는 스캔 이미지로 보입니다' },
    scannedImageSolution: { en: 'Please use OCR software (like Adobe Acrobat "Recognize Text" or a free online OCR tool) to make it searchable first, then drop it in again.', es: 'Por favor usa software OCR (como "Reconocer Texto" de Adobe Acrobat o una herramienta OCR gratuita en línea) para hacerlo buscable primero, luego suéltalo de nuevo.', tl: 'Mangyaring gumamit ng OCR software (tulad ng Adobe Acrobat "Recognize Text" o isang libreng online OCR tool) para gawin itong searchable, pagkatapos i-drop ulit.', vi: 'Vui lòng sử dụng phần mềm OCR (như Adobe Acrobat "Nhận dạng văn bản" hoặc công cụ OCR trực tuyến miễn phí) để làm cho nó có thể tìm kiếm được trước, sau đó thả lại.', ko: 'OCR 소프트웨어(Adobe Acrobat "텍스트 인식" 또는 무료 온라인 OCR 도구 등)를 사용하여 먼저 검색 가능하게 만든 다음 다시 놓으세요.' },
    analysisError: { en: 'An error occurred during analysis.', es: 'Ocurrió un error durante el análisis.', tl: 'May error na naganap habang nag-a-analyze.', vi: 'Đã xảy ra lỗi trong quá trình phân tích.', ko: '분석 중 오류가 발생했습니다.' },
    
    // AI Status Warning
    aiRequiredForAnalysis: { en: 'AI Required for Analysis', es: 'IA Requerida para el Análisis', tl: 'Kinakailangan ang AI para sa Analysis', vi: 'Yêu Cầu AI cho Phân Tích', ko: '분석에 AI 필요' },
    aiRequiredDesc: { en: 'Click the AI Status button in the header above to load your secure Local AI (100% private) or enter your Gemini API key.', es: 'Haz clic en el botón Estado de IA en el encabezado para cargar tu IA Local segura (100% privada) o ingresa tu clave API de Gemini.', tl: 'I-click ang AI Status button sa header sa itaas para i-load ang secure Local AI mo (100% private) o ilagay ang Gemini API key mo.', vi: 'Nhấp vào nút Trạng Thái AI trong tiêu đề phía trên để tải AI Cục Bộ an toàn của bạn (100% riêng tư) hoặc nhập khóa API Gemini của bạn.', ko: '위 헤더의 AI 상태 버튼을 클릭하여 보안 로컬 AI(100% 비공개)를 로드하거나 Gemini API 키를 입력하세요.' },
    
    // Buttons
    analyzeMyFile: { en: 'Analyze My C-File', es: 'Analizar Mi C-File', tl: 'I-analyze ang C-File Ko', vi: 'Phân Tích C-File Của Tôi', ko: '내 C-File 분석' },
    estimatedProcessingTime: { en: 'Estimated processing time:', es: 'Tiempo estimado de procesamiento:', tl: 'Estimated processing time:', vi: 'Thời gian xử lý ước tính:', ko: '예상 처리 시간:' },
    analyzeAnotherFile: { en: 'Analyze Another File', es: 'Analizar Otro Archivo', tl: 'Mag-analyze ng Ibang File', vi: 'Phân Tích Tệp Khác', ko: '다른 파일 분석' },
    
    // Privacy Consent Modal
    privacyDataHandling: { en: 'Privacy & Data Handling', es: 'Privacidad y Manejo de Datos', tl: 'Privacy at Data Handling', vi: 'Quyền Riêng Tư & Xử Lý Dữ Liệu', ko: '개인정보 및 데이터 처리' },
    cancel: { en: 'Cancel', es: 'Cancelar', tl: 'Kanselahin', vi: 'Hủy', ko: '취소' },
    iUnderstandStart: { en: 'I Understand - Start Analysis', es: 'Entiendo - Iniciar Análisis', tl: 'Naiintindihan Ko - Simulan ang Analysis', vi: 'Tôi Hiểu - Bắt Đầu Phân Tích', ko: '이해했습니다 - 분석 시작' },
    
    // Processing States
    readingPdf: { en: 'Reading PDF file...', es: 'Leyendo archivo PDF...', tl: 'Binabasa ang PDF file...', vi: 'Đang đọc tệp PDF...', ko: 'PDF 파일 읽는 중...' },
    extractingText: { en: 'Extracting text from PDF...', es: 'Extrayendo texto del PDF...', tl: 'Kine-extract ang text mula sa PDF...', vi: 'Đang trích xuất văn bản từ PDF...', ko: 'PDF에서 텍스트 추출 중...' },
    analyzingWithAi: { en: 'Analyzing with AI...', es: 'Analizando con IA...', tl: 'Sinusuri gamit ang AI...', vi: 'Đang phân tích bằng AI...', ko: 'AI로 분석 중...' },
    processingLargeCFile: { en: 'Processing Large C-File...', es: 'Procesando C-File Grande...', tl: 'Pinoproseso ang Malaking C-File...', vi: 'Đang Xử Lý C-File Lớn...', ko: '대용량 C-File 처리 중...' },
    analyzingYourCFile: { en: 'Analyzing Your C-File...', es: 'Analizando Tu C-File...', tl: 'Sinusuri ang C-File Mo...', vi: 'Đang Phân Tích C-File Của Bạn...', ko: 'C-File 분석 중...' },
    pageOf: { en: 'Page {current} of {total}', es: 'Página {current} de {total}', tl: 'Pahina {current} ng {total}', vi: 'Trang {current} trên {total}', ko: '{total}개 중 {current}페이지' },
    chunkOf: { en: 'Chunk {current} of {total}', es: 'Fragmento {current} de {total}', tl: 'Chunk {current} ng {total}', vi: 'Phần {current} trên {total}', ko: '{total}개 중 {current}청크' },
    analyzingPages: { en: 'Analyzing pages {start} - {end}', es: 'Analizando páginas {start} - {end}', tl: 'Sinusuri ang mga pahina {start} - {end}', vi: 'Đang phân tích trang {start} - {end}', ko: '{start} - {end}페이지 분석 중' },
    mergingChunks: { en: 'Merging {total} chunks into final report...', es: 'Fusionando {total} fragmentos en el informe final...', tl: 'Pinagsasama ang {total} chunks sa final report...', vi: 'Đang hợp nhất {total} phần vào báo cáo cuối cùng...', ko: '{total}개 청크를 최종 보고서로 병합 중...' },
    largeFileDetected: { en: 'Large file detected! Processing in {total} chunks. This may take 5-15 minutes. Please keep this tab open.', es: '¡Archivo grande detectado! Procesando en {total} fragmentos. Esto puede tomar 5-15 minutos. Por favor mantén esta pestaña abierta.', tl: 'Malaking file ang na-detect! Pinoproseso sa {total} chunks. Maaaring tumagal ng 5-15 minuto. Mangyaring panatilihing bukas ang tab na ito.', vi: 'Phát hiện tệp lớn! Đang xử lý trong {total} phần. Có thể mất 5-15 phút. Vui lòng giữ tab này mở.', ko: '큰 파일이 감지되었습니다! {total}개 청크로 처리 중. 5-15분이 소요될 수 있습니다. 이 탭을 열어두세요.' },
    largeFileMayTake: { en: 'Large files may take several minutes. Please keep this tab open.', es: 'Los archivos grandes pueden tardar varios minutos. Por favor mantén esta pestaña abierta.', tl: 'Ang malalaking files ay maaaring tumagal ng ilang minuto. Mangyaring panatilihing bukas ang tab na ito.', vi: 'Các tệp lớn có thể mất vài phút. Vui lòng giữ tab này mở.', ko: '큰 파일은 몇 분이 걸릴 수 있습니다. 이 탭을 열어두세요.' },
    
    // Analysis Complete Dashboard
    analysisComplete: { en: 'Analysis Complete', es: 'Análisis Completo', tl: 'Tapos na ang Analysis', vi: 'Phân Tích Hoàn Tất', ko: '분석 완료' },
    pagesAnalyzed: { en: 'pages analyzed', es: 'páginas analizadas', tl: 'mga pahina na nasuri', vi: 'trang đã phân tích', ko: '페이지 분석됨' },
    charactersExtracted: { en: 'characters extracted', es: 'caracteres extraídos', tl: 'mga character na na-extract', vi: 'ký tự đã trích xuất', ko: '문자 추출됨' },
    processedInChunks: { en: 'Processed in {count} chunks', es: 'Procesado en {count} fragmentos', tl: 'Naproseso sa {count} chunks', vi: 'Đã xử lý trong {count} phần', ko: '{count}개 청크로 처리됨' },
    
    // Executive Summary
    executiveSummary: { en: 'Executive Summary', es: 'Resumen Ejecutivo', tl: 'Executive Summary', vi: 'Tóm Tắt Điều Hành', ko: '요약' },
    branch: { en: 'Branch', es: 'Rama', tl: 'Sangay', vi: 'Quân Chủng', ko: '군종' },
    mos: { en: 'MOS', es: 'MOS', tl: 'MOS', vi: 'MOS', ko: 'MOS' },
    entryDate: { en: 'Entry Date', es: 'Fecha de Ingreso', tl: 'Petsa ng Pagpasok', vi: 'Ngày Nhập Ngũ', ko: '입대일' },
    separationDate: { en: 'Separation Date', es: 'Fecha de Separación', tl: 'Petsa ng Paghihiwalay', vi: 'Ngày Giải Ngũ', ko: '제대일' },
    
    // Tab Navigation
    tabPotentialClaims: { en: 'Potential Claims', es: 'Reclamos Potenciales', tl: 'Mga Posibleng Claim', vi: 'Yêu Cầu Tiềm Năng', ko: '잠재적 청구' },
    tabTimeline: { en: 'Timeline', es: 'Línea de Tiempo', tl: 'Timeline', vi: 'Dòng Thời Gian', ko: '타임라인' },
    tabExposures: { en: 'Exposures', es: 'Exposiciones', tl: 'Mga Exposure', vi: 'Phơi Nhiễm', ko: '노출' },
    tabMentalHealth: { en: 'Mental Health', es: 'Salud Mental', tl: 'Mental Health', vi: 'Sức Khỏe Tâm Thần', ko: '정신 건강' },
    tabActionItems: { en: 'Action Items', es: 'Elementos de Acción', tl: 'Mga Action Items', vi: 'Hành Động Cần Làm', ko: '조치 항목' },
    
    // Exposures Tab
    toxicExposures: { en: 'Toxic Exposures & Presumptive Conditions', es: 'Exposiciones Tóxicas y Condiciones Presuntivas', tl: 'Toxic Exposures at Presumptive Conditions', vi: 'Phơi Nhiễm Độc Hại & Điều Kiện Suy Đoán', ko: '독성 노출 및 추정 상태' },
    noExposuresFound: { en: 'No toxic exposures identified in the records.', es: 'No se identificaron exposiciones tóxicas en los registros.', tl: 'Walang toxic exposures na natukoy sa mga records.', vi: 'Không xác định được phơi nhiễm độc hại trong hồ sơ.', ko: '기록에서 독성 노출이 확인되지 않았습니다.' },
    presumptiveConditions: { en: 'Presumptive Conditions:', es: 'Condiciones Presuntivas:', tl: 'Presumptive Conditions:', vi: 'Điều Kiện Suy Đoán:', ko: '추정 상태:' },
    page: { en: 'Page', es: 'Página', tl: 'Pahina', vi: 'Trang', ko: '페이지' },
    
    // Mental Health Tab
    mentalHealthIndicators: { en: 'Mental Health Indicators', es: 'Indicadores de Salud Mental', tl: 'Mental Health Indicators', vi: 'Chỉ Số Sức Khỏe Tâm Thần', ko: '정신 건강 지표' },
    diagnosesFound: { en: 'Diagnoses Found', es: 'Diagnósticos Encontrados', tl: 'Mga Diagnosis na Natagpuan', vi: 'Chẩn Đoán Tìm Thấy', ko: '발견된 진단' },
    indicators: { en: 'Indicators', es: 'Indicadores', tl: 'Mga Indicator', vi: 'Chỉ Số', ko: '지표' },
    documentedStressors: { en: 'Documented Stressors', es: 'Estresores Documentados', tl: 'Mga Documented Stressors', vi: 'Các Yếu Tố Gây Căng Thẳng Được Ghi Nhận', ko: '문서화된 스트레스 요인' },
    seePages: { en: 'See pages:', es: 'Ver páginas:', tl: 'Tingnan ang mga pahina:', vi: 'Xem các trang:', ko: '페이지 참조:' },
    noMentalHealthIndicators: { en: 'No mental health indicators identified in the records.', es: 'No se identificaron indicadores de salud mental en los registros.', tl: 'Walang mental health indicators na natukoy sa mga records.', vi: 'Không xác định được chỉ số sức khỏe tâm thần trong hồ sơ.', ko: '기록에서 정신 건강 지표가 확인되지 않았습니다.' },
    
    // Action Items Tab
    recommendedNextSteps: { en: 'Recommended Next Steps', es: 'Próximos Pasos Recomendados', tl: 'Mga Inirerekumendang Susunod na Hakbang', vi: 'Các Bước Tiếp Theo Được Đề Xuất', ko: '권장 다음 단계' },
    noActionItems: { en: 'No specific action items identified.', es: 'No se identificaron elementos de acción específicos.', tl: 'Walang specific action items na natukoy.', vi: 'Không có hành động cụ thể nào được xác định.', ko: '확인된 특정 조치 항목이 없습니다.' },
    
    // Red Flags Section
    attentionNeeded: { en: 'Attention Needed', es: 'Atención Necesaria', tl: 'Kailangan ng Atensyon', vi: 'Cần Chú Ý', ko: '주의 필요' },
    
    // Combat Indicators Section
    combatIndicatorsFound: { en: 'Combat Indicators Found', es: 'Indicadores de Combate Encontrados', tl: 'Mga Combat Indicators na Natagpuan', vi: 'Tìm Thấy Các Chỉ Số Chiến Đấu', ko: '전투 지표 발견' },
    
    // Footer Disclaimer
    footerDisclaimer: { en: 'This tool provides general information only and is not legal or medical advice. AI analysis may contain errors. Always verify findings with your official records and consult with a VA-accredited representative for claims decisions.', es: 'Esta herramienta proporciona solo información general y no es asesoramiento legal ni médico. El análisis de IA puede contener errores. Siempre verifica los hallazgos con tus registros oficiales y consulta con un representante acreditado por el VA para decisiones de reclamos.', tl: 'Ang tool na ito ay nagbibigay lamang ng pangkalahatang impormasyon at hindi legal o medikal na payo. Maaaring may mga error ang AI analysis. Laging i-verify ang mga natuklasan sa iyong opisyal na mga record at kumunsulta sa isang VA-accredited representative para sa mga desisyon sa claim.', vi: 'Công cụ này chỉ cung cấp thông tin chung và không phải là tư vấn pháp lý hoặc y tế. Phân tích AI có thể chứa lỗi. Luôn xác minh các phát hiện với hồ sơ chính thức của bạn và tham khảo ý kiến ​​của đại diện được VA công nhận cho các quyết định yêu cầu.', ko: '이 도구는 일반 정보만 제공하며 법률 또는 의료 조언이 아닙니다. AI 분석에는 오류가 포함될 수 있습니다. 항상 공식 기록으로 결과를 확인하고 청구 결정에 대해서는 VA 공인 대리인과 상담하세요.' },
    
    // Close button
    closeCFileAnalyzer: { en: 'Close C-File Analyzer', es: 'Cerrar Analizador de C-File', tl: 'Isara ang C-File Analyzer', vi: 'Đóng Trình Phân Tích C-File', ko: 'C-File 분석기 닫기' },
  },

  // Denial Decoder
  denialDecoder: {
    // Header
    title: { en: 'The Denials Decoder', es: 'El Decodificador de Denegaciones', tl: 'Ang Denials Decoder', vi: 'Giải Mã Từ Chối', ko: '거부 디코더' },
    subtitle: { en: 'Scan your VA denial letter for plain-English analysis', es: 'Escanea tu carta de denegación del VA para un análisis en inglés simple', tl: 'I-scan ang VA denial letter mo para sa plain-English analysis', vi: 'Quét thư từ chối VA của bạn để phân tích bằng tiếng Anh đơn giản', ko: 'VA 거부 서신을 스캔하여 평이한 영어로 분석' },
    ai: { en: 'AI', es: 'IA', tl: 'AI', vi: 'AI', ko: 'AI' },
    
    // Privacy Notice
    privacyProtected: { en: '100% Privacy Protected', es: '100% Privacidad Protegida', tl: '100% Privacy Protected', vi: '100% Bảo Vệ Quyền Riêng Tư', ko: '100% 개인정보 보호' },
    ocrProcessingLocal: { en: 'OCR processing happens locally in your browser.', es: 'El procesamiento OCR ocurre localmente en tu navegador.', tl: 'Ang OCR processing ay nangyayari locally sa browser mo.', vi: 'Xử lý OCR diễn ra cục bộ trong trình duyệt của bạn.', ko: 'OCR 처리는 브라우저에서 로컬로 수행됩니다.' },
    aiAnalysisLocal: { en: 'AI analysis also runs locally - your data never leaves your device!', es: 'El análisis de IA también se ejecuta localmente - ¡tus datos nunca salen de tu dispositivo!', tl: 'Ang AI analysis ay tumatakbo rin locally - hindi aalis ang data mo sa device mo!', vi: 'Phân tích AI cũng chạy cục bộ - dữ liệu của bạn không bao giờ rời khỏi thiết bị!', ko: 'AI 분석도 로컬에서 실행됩니다 - 데이터가 기기를 떠나지 않습니다!' },
    onlyTextSentToAi: { en: 'Only the extracted text (not the image) is sent to AI for analysis.', es: 'Solo el texto extraído (no la imagen) se envía a la IA para el análisis.', tl: 'Ang extracted text lang (hindi ang image) ang ipinapadala sa AI para sa analysis.', vi: 'Chỉ văn bản đã trích xuất (không phải hình ảnh) được gửi đến AI để phân tích.', ko: '추출된 텍스트만 (이미지 아님) AI로 분석을 위해 전송됩니다.' },
    
    // AI Setup
    aiRequired: { en: 'AI Required', es: 'IA Requerida', tl: 'Kinakailangan ang AI', vi: 'Yêu Cầu AI', ko: 'AI 필요' },
    aiSetupMessage: { en: 'Click the AI button in the header above to load your secure Local AI or enter your Gemini API key to analyze denial letters.', es: 'Haz clic en el botón de IA en el encabezado para cargar tu IA Local segura o ingresa tu clave API de Gemini para analizar cartas de denegación.', tl: 'I-click ang AI button sa header sa itaas para i-load ang secure Local AI mo o ilagay ang Gemini API key mo para mag-analyze ng denial letters.', vi: 'Nhấp vào nút AI trong tiêu đề phía trên để tải AI Cục Bộ an toàn của bạn hoặc nhập khóa API Gemini để phân tích thư từ chối.', ko: '위 헤더의 AI 버튼을 클릭하여 보안 로컬 AI를 로드하거나 Gemini API 키를 입력하여 거부 서신을 분석하세요.' },
    
    // Upload Buttons
    takePhoto: { en: 'Take Photo', es: 'Tomar Foto', tl: 'Kumuha ng Litrato', vi: 'Chụp Ảnh', ko: '사진 찍기' },
    useYourCamera: { en: 'Use your camera', es: 'Usa tu cámara', tl: 'Gamitin ang camera mo', vi: 'Sử dụng camera của bạn', ko: '카메라 사용' },
    uploadImage: { en: 'Upload Image', es: 'Subir Imagen', tl: 'Mag-upload ng Larawan', vi: 'Tải Lên Hình Ảnh', ko: '이미지 업로드' },
    selectFromFiles: { en: 'Select from files', es: 'Seleccionar de archivos', tl: 'Pumili mula sa files', vi: 'Chọn từ tệp', ko: '파일에서 선택' },
    
    // Tips
    tipsTitle: { en: '📸 Tips for Best Results:', es: '📸 Consejos para Mejores Resultados:', tl: '📸 Mga Tip para sa Pinakamahusay na Resulta:', vi: '📸 Mẹo để Có Kết Quả Tốt Nhất:', ko: '📸 최상의 결과를 위한 팁:' },
    tipWellLit: { en: 'Make sure the letter is well-lit and flat', es: 'Asegúrate de que la carta esté bien iluminada y plana', tl: 'Siguruhing maliwanag at patag ang letter', vi: 'Đảm bảo thư được chiếu sáng tốt và phẳng', ko: '서신이 밝고 평평한지 확인하세요' },
    tipNoShadows: { en: 'Avoid shadows and glare', es: 'Evita sombras y reflejos', tl: 'Iwasan ang shadows at glare', vi: 'Tránh bóng và ánh sáng chói', ko: '그림자와 눈부심을 피하세요' },
    tipEntirePage: { en: 'Capture the entire page if possible', es: 'Captura la página completa si es posible', tl: 'I-capture ang buong page kung posible', vi: 'Chụp toàn bộ trang nếu có thể', ko: '가능하면 전체 페이지를 캡처하세요' },
    tipSteady: { en: 'Hold your phone steady for a clear shot', es: 'Mantén tu teléfono firme para una foto clara', tl: 'Hawakan ng matatag ang phone mo para sa malinaw na shot', vi: 'Giữ điện thoại ổn định để có ảnh rõ nét', ko: '깨끗한 사진을 위해 휴대폰을 안정적으로 잡으세요' },
    
    // Processing States
    readingLetter: { en: 'Reading Your Letter...', es: 'Leyendo Tu Carta...', tl: 'Binabasa ang Letter Mo...', vi: 'Đang Đọc Thư Của Bạn...', ko: '서신 읽는 중...' },
    processingLocally: { en: 'Processing locally on your device', es: 'Procesando localmente en tu dispositivo', tl: 'Pinoproseso locally sa device mo', vi: 'Đang xử lý cục bộ trên thiết bị của bạn', ko: '기기에서 로컬로 처리 중' },
    analyzingDenialReason: { en: 'Analyzing Denial Reason...', es: 'Analizando Motivo de Denegación...', tl: 'Sinusuri ang Dahilan ng Denial...', vi: 'Đang Phân Tích Lý Do Từ Chối...', ko: '거부 사유 분석 중...' },
    translatingLegalese: { en: 'Translating legalese into plain English', es: 'Traduciendo jerga legal a inglés simple', tl: 'Isinasalin ang legalese sa plain English', vi: 'Đang dịch thuật ngữ pháp lý sang tiếng Anh đơn giản', ko: '법률 용어를 평이한 영어로 번역 중' },
    
    // Results
    whyDenied: { en: 'Why They Denied Your Claim:', es: 'Por Qué Denegaron Tu Reclamo:', tl: 'Bakit Tinanggihan ang Claim Mo:', vi: 'Tại Sao Họ Từ Chối Yêu Cầu Của Bạn:', ko: '왜 청구가 거부되었는지:' },
    inPlainEnglish: { en: 'In Plain English:', es: 'En Inglés Simple:', tl: 'Sa Plain English:', vi: 'Bằng Tiếng Anh Đơn Giản:', ko: '쉬운 영어로:' },
    whatWasMissing: { en: 'What Was Missing:', es: 'Qué Faltaba:', tl: 'Ano ang Kulang:', vi: 'Điều Gì Còn Thiếu:', ko: '누락된 것:' },
    appealDeadline: { en: 'Appeal Deadline:', es: 'Fecha Límite de Apelación:', tl: 'Deadline ng Appeal:', vi: 'Thời Hạn Kháng Cáo:', ko: '항소 마감일:' },
    yourNextSteps: { en: 'Your Next Steps:', es: 'Tus Próximos Pasos:', tl: 'Ang Susunod Mong mga Hakbang:', vi: 'Các Bước Tiếp Theo Của Bạn:', ko: '다음 단계:' },
    
    // Actions
    showExtractedText: { en: 'Show Extracted Text', es: 'Mostrar Texto Extraído', tl: 'Ipakita ang Extracted Text', vi: 'Hiển Thị Văn Bản Đã Trích Xuất', ko: '추출된 텍스트 표시' },
    hideExtractedText: { en: 'Hide Extracted Text', es: 'Ocultar Texto Extraído', tl: 'Itago ang Extracted Text', vi: 'Ẩn Văn Bản Đã Trích Xuất', ko: '추출된 텍스트 숨기기' },
    scanAnotherLetter: { en: 'Scan Another Letter', es: 'Escanear Otra Carta', tl: 'Mag-scan ng Ibang Letter', vi: 'Quét Thư Khác', ko: '다른 서신 스캔' },
    
    // Errors
    ocrError: { en: 'Could not extract enough text from image. Make sure the image is clear and well-lit.', es: 'No se pudo extraer suficiente texto de la imagen. Asegúrate de que la imagen esté clara y bien iluminada.', tl: 'Hindi sapat ang text na na-extract mula sa image. Siguruhing malinaw at maliwanag ang image.', vi: 'Không thể trích xuất đủ văn bản từ hình ảnh. Đảm bảo hình ảnh rõ ràng và được chiếu sáng tốt.', ko: '이미지에서 충분한 텍스트를 추출할 수 없습니다. 이미지가 선명하고 밝은지 확인하세요.' },
    noAiAvailable: { en: 'No AI available. Please configure an API key or enable Local AI in settings.', es: 'No hay IA disponible. Por favor configura una clave API o habilita IA Local en configuración.', tl: 'Walang available na AI. Mangyaring mag-configure ng API key o i-enable ang Local AI sa settings.', vi: 'Không có AI khả dụng. Vui lòng cấu hình khóa API hoặc bật AI Cục bộ trong cài đặt.', ko: 'AI를 사용할 수 없습니다. API 키를 구성하거나 설정에서 로컬 AI를 활성화하세요.' },
    parseError: { en: 'Could not understand the denial letter. Please try manual review.', es: 'No se pudo entender la carta de denegación. Por favor intenta revisión manual.', tl: 'Hindi naintindihan ang denial letter. Mangyaring subukan ang manual review.', vi: 'Không thể hiểu thư từ chối. Vui lòng thử xem xét thủ công.', ko: '거부 서신을 이해할 수 없습니다. 수동 검토를 시도해 주세요.' },
    analysisError: { en: 'Failed to analyze denial letter. Check your internet connection.', es: 'Error al analizar la carta de denegación. Verifica tu conexión a internet.', tl: 'Nabigo sa pag-analyze ng denial letter. Suriin ang internet connection mo.', vi: 'Không thể phân tích thư từ chối. Kiểm tra kết nối internet của bạn.', ko: '거부 서신 분석에 실패했습니다. 인터넷 연결을 확인하세요.' },
    imageProcessError: { en: 'Failed to process image. Please try again with a clearer photo.', es: 'Error al procesar imagen. Por favor intenta de nuevo con una foto más clara.', tl: 'Nabigo sa pag-process ng image. Mangyaring subukan ulit na may mas malinaw na litrato.', vi: 'Không thể xử lý hình ảnh. Vui lòng thử lại với ảnh rõ hơn.', ko: '이미지 처리에 실패했습니다. 더 선명한 사진으로 다시 시도해 주세요.' },
  },

  // DBQ Finder Component
  dbqFinder: {
    // Header
    title: { en: 'DBQ Finder', es: 'Buscador de DBQ', tl: 'DBQ Finder', vi: 'Tìm DBQ', ko: 'DBQ 검색기' },
    subtitle: { en: 'Find the right Disability Benefits Questionnaire for your condition', es: 'Encuentra el Cuestionario de Beneficios por Discapacidad correcto para tu condición', tl: 'Hanapin ang tamang Disability Benefits Questionnaire para sa kondisyon mo', vi: 'Tìm Bảng Câu Hỏi Quyền Lợi Khuyết Tật phù hợp cho tình trạng của bạn', ko: '귀하의 상태에 맞는 장애 혜택 설문지 찾기' },
    
    // Info Banner
    whatIsDbq: { en: 'What is a DBQ?', es: '¿Qué es un DBQ?', tl: 'Ano ang DBQ?', vi: 'DBQ là gì?', ko: 'DBQ란 무엇인가요?' },
    dbqDescription: { en: 'A <strong>Disability Benefits Questionnaire (DBQ)</strong> is a standardized VA form that your private doctor can fill out to document your condition. Having a completed DBQ can <strong>eliminate the need for a VA C&P exam</strong> and speeds up your claim.', es: 'Un <strong>Cuestionario de Beneficios por Discapacidad (DBQ)</strong> es un formulario estandarizado del VA que su médico privado puede completar para documentar su condición. Tener un DBQ completo puede <strong>eliminar la necesidad de un examen C&P del VA</strong> y acelera su reclamo.', tl: 'Ang <strong>Disability Benefits Questionnaire (DBQ)</strong> ay isang standardized VA form na pwedeng punan ng private doctor mo para idokumento ang kondisyon mo. Ang pagkakaroon ng completed DBQ ay <strong>maaaring mag-eliminate ng pangangailangan ng VA C&P exam</strong> at pinapabilis ang claim mo.', vi: '<strong>Bảng Câu Hỏi Quyền Lợi Khuyết Tật (DBQ)</strong> là một biểu mẫu VA tiêu chuẩn mà bác sĩ tư nhân của bạn có thể điền để ghi nhận tình trạng của bạn. Có DBQ hoàn chỉnh có thể <strong>loại bỏ nhu cầu khám C&P của VA</strong> và đẩy nhanh yêu cầu của bạn.', ko: '<strong>장애 혜택 설문지(DBQ)</strong>는 개인 의사가 귀하의 상태를 문서화하기 위해 작성할 수 있는 표준화된 VA 양식입니다. 완성된 DBQ가 있으면 <strong>VA C&P 검사의 필요성을 없앨 수 있고</strong> 청구 절차가 빨라집니다.' },
    
    // Search
    searchPlaceholder: { en: 'Search by condition (e.g., Sleep Apnea, PTSD, Knee Pain...)', es: 'Buscar por condición (ej., Apnea del Sueño, TEPT, Dolor de Rodilla...)', tl: 'Maghanap ayon sa kondisyon (hal., Sleep Apnea, PTSD, Knee Pain...)', vi: 'Tìm theo tình trạng (ví dụ: Ngưng Thở Khi Ngủ, PTSD, Đau Đầu Gối...)', ko: '상태로 검색 (예: 수면무호흡증, PTSD, 무릎 통증...)' },
    recentSearches: { en: 'Recent Searches', es: 'Búsquedas Recientes', tl: 'Mga Kamakailang Paghahanap', vi: 'Tìm Kiếm Gần Đây', ko: '최근 검색' },
    
    // Results
    foundForms: { en: 'Found {count} DBQ Form{s}', es: 'Encontrado{s} {count} Formulario{s} DBQ', tl: 'Natagpuan ang {count} DBQ Form{s}', vi: 'Tìm Thấy {count} Biểu Mẫu DBQ', ko: '{count}개의 DBQ 양식 발견' },
    officialDbq: { en: 'Official DBQ', es: 'DBQ Oficial', tl: 'Opisyal na DBQ', vi: 'DBQ Chính Thức', ko: '공식 DBQ' },
    lastUpdated: { en: 'Last Updated', es: 'Última Actualización', tl: 'Huling Na-update', vi: 'Cập Nhật Lần Cuối', ko: '최근 업데이트' },
    pages: { en: 'page(s)', es: 'página(s)', tl: 'pahina', vi: 'trang', ko: '페이지' },
    
    // Buttons
    downloadPdf: { en: 'Download PDF', es: 'Descargar PDF', tl: 'I-download ang PDF', vi: 'Tải PDF', ko: 'PDF 다운로드' },
    onlineTool: { en: 'Online Tool', es: 'Herramienta en Línea', tl: 'Online Tool', vi: 'Công Cụ Trực Tuyến', ko: '온라인 도구' },
    
    // Browse Categories
    browseByCategory: { en: 'Browse by Category', es: 'Buscar por Categoría', tl: 'Mag-browse ayon sa Kategorya', vi: 'Duyệt theo Danh Mục', ko: '카테고리별 찾기' },
    
    // Category Labels
    catMentalHealth: { en: 'Mental Health', es: 'Salud Mental', tl: 'Kalusugang Pangkaisipan', vi: 'Sức Khỏe Tâm Thần', ko: '정신 건강' },
    catMentalHealthDesc: { en: 'Depression, PTSD, anxiety, TBI, and other psychological conditions', es: 'Depresión, TEPT, ansiedad, TBI y otras condiciones psicológicas', tl: 'Depresyon, PTSD, anxiety, TBI, at iba pang kondisyong sikolohikal', vi: 'Trầm cảm, PTSD, lo âu, TBI và các tình trạng tâm lý khác', ko: '우울증, PTSD, 불안, TBI 및 기타 심리적 상태' },
    catMusculoskeletal: { en: 'Musculoskeletal', es: 'Musculoesquelético', tl: 'Musculoskeletal', vi: 'Cơ Xương Khớp', ko: '근골격계' },
    catMusculoskeletalDesc: { en: 'Joint conditions, range of motion, arthritis, spine issues', es: 'Condiciones articulares, rango de movimiento, artritis, problemas de columna', tl: 'Mga kondisyon ng kasukasuan, range of motion, arthritis, problema sa spine', vi: 'Tình trạng khớp, phạm vi chuyển động, viêm khớp, vấn đề cột sống', ko: '관절 상태, 운동 범위, 관절염, 척추 문제' },
    catRespiratory: { en: 'Respiratory', es: 'Respiratorio', tl: 'Respiratory', vi: 'Hô Hấp', ko: '호흡기' },
    catRespiratoryDesc: { en: 'Sleep apnea, breathing conditions, sinus problems', es: 'Apnea del sueño, condiciones respiratorias, problemas de sinusitis', tl: 'Sleep apnea, breathing conditions, sinus problems', vi: 'Ngưng thở khi ngủ, tình trạng hô hấp, vấn đề xoang', ko: '수면무호흡증, 호흡 상태, 부비동 문제' },
    catCardiovascular: { en: 'Cardiovascular', es: 'Cardiovascular', tl: 'Cardiovascular', vi: 'Tim Mạch', ko: '심혈관' },
    catCardiovascularDesc: { en: 'Heart conditions, high blood pressure, circulation', es: 'Condiciones cardíacas, presión arterial alta, circulación', tl: 'Mga kondisyon sa puso, high blood pressure, sirkulasyon', vi: 'Tình trạng tim, huyết áp cao, tuần hoàn', ko: '심장 상태, 고혈압, 순환' },
    catNeurological: { en: 'Neurological', es: 'Neurológico', tl: 'Neurological', vi: 'Thần Kinh', ko: '신경계' },
    catNeurologicalDesc: { en: 'Migraines, nerve damage, seizures, neuropathy', es: 'Migrañas, daño nervioso, convulsiones, neuropatía', tl: 'Migraines, nerve damage, seizures, neuropathy', vi: 'Đau nửa đầu, tổn thương thần kinh, co giật, bệnh lý thần kinh', ko: '편두통, 신경 손상, 발작, 신경병증' },
    catDigestive: { en: 'Digestive', es: 'Digestivo', tl: 'Digestive', vi: 'Tiêu Hóa', ko: '소화기' },
    catDigestiveDesc: { en: 'GERD, IBS, liver conditions, digestive disorders', es: 'ERGE, SII, condiciones hepáticas, trastornos digestivos', tl: 'GERD, IBS, liver conditions, digestive disorders', vi: 'GERD, IBS, tình trạng gan, rối loạn tiêu hóa', ko: 'GERD, IBS, 간 상태, 소화 장애' },
    catSkin: { en: 'Skin', es: 'Piel', tl: 'Balat', vi: 'Da', ko: '피부' },
    catSkinDesc: { en: 'Skin conditions, scars, burn injuries', es: 'Condiciones de la piel, cicatrices, quemaduras', tl: 'Mga kondisyon sa balat, scars, burn injuries', vi: 'Tình trạng da, sẹo, bỏng', ko: '피부 상태, 흉터, 화상' },
    catHearingVision: { en: 'Hearing/Vision', es: 'Audición/Visión', tl: 'Pandinig/Paningin', vi: 'Thính Giác/Thị Giác', ko: '청력/시력' },
    catHearingVisionDesc: { en: 'Hearing loss, tinnitus, eye conditions', es: 'Pérdida auditiva, tinnitus, condiciones oculares', tl: 'Hearing loss, tinnitus, eye conditions', vi: 'Mất thính lực, ù tai, tình trạng mắt', ko: '청력 상실, 이명, 눈 상태' },
    
    // Footer
    footerNote: { en: 'Forms fetched directly from VA.gov • Always current', es: 'Formularios obtenidos directamente de VA.gov • Siempre actualizados', tl: 'Forms direktang kinuha mula sa VA.gov • Palaging updated', vi: 'Biểu mẫu lấy trực tiếp từ VA.gov • Luôn cập nhật', ko: 'VA.gov에서 직접 가져온 양식 • 항상 최신' },
    
    // Errors
    minCharsError: { en: 'Please enter at least 2 characters to search', es: 'Por favor ingrese al menos 2 caracteres para buscar', tl: 'Mangyaring maglagay ng kahit 2 character para maghanap', vi: 'Vui lòng nhập ít nhất 2 ký tự để tìm kiếm', ko: '검색하려면 최소 2자 이상 입력하세요' },
    noResultsError: { en: 'No DBQ forms found for "{query}". Try a different search term or browse categories below.', es: 'No se encontraron formularios DBQ para "{query}". Intente con otro término de búsqueda o explore las categorías a continuación.', tl: 'Walang nahanap na DBQ forms para sa "{query}". Subukan ang ibang search term o mag-browse ng categories sa ibaba.', vi: 'Không tìm thấy biểu mẫu DBQ cho "{query}". Thử từ khóa khác hoặc duyệt danh mục bên dưới.', ko: '"{query}"에 대한 DBQ 양식을 찾을 수 없습니다. 다른 검색어를 시도하거나 아래 카테고리를 찾아보세요.' },
    searchError: { en: 'Failed to search forms. Please try again.', es: 'Error al buscar formularios. Por favor intente de nuevo.', tl: 'Nabigo sa paghahanap ng forms. Mangyaring subukan muli.', vi: 'Không thể tìm kiếm biểu mẫu. Vui lòng thử lại.', ko: '양식 검색에 실패했습니다. 다시 시도해 주세요.' },
  },

  // BootCampTour Component
  bootCampTour: {
    // Navigation buttons
    nextBtn: { en: 'Next →', es: 'Siguiente →', tl: 'Susunod →', vi: 'Tiếp →', ko: '다음 →' },
    prevBtn: { en: '← Back', es: '← Atrás', tl: '← Bumalik', vi: '← Quay lại', ko: '← 뒤로' },
    doneBtn: { en: 'Start My Claim! 🚀', es: '¡Iniciar Mi Reclamo! 🚀', tl: 'Simulan ang Claim Ko! 🚀', vi: 'Bắt Đầu Yêu Cầu! 🚀', ko: '청구 시작하기! 🚀' },
    
    // Welcome step
    welcomeTitle: { en: '🎖️ Welcome to Vet-Rate.org', es: '🎖️ Bienvenido a Vet-Rate.org', tl: '🎖️ Maligayang Pagdating sa Vet-Rate.org', vi: '🎖️ Chào Mừng Đến Với Vet-Rate.org', ko: '🎖️ Vet-Rate.org에 오신 것을 환영합니다' },
    welcomeIntro: { en: "Let's show you around!", es: '¡Te mostraremos el sitio!', tl: 'Ipapakilala namin sa iyo!', vi: 'Hãy để chúng tôi giới thiệu!', ko: '둘러보시겠습니까!' },
    welcomeSubtitle: { en: 'This quick tour covers the essentials so you know exactly where to start.', es: 'Este tour rápido cubre lo esencial para que sepas exactamente por dónde empezar.', tl: 'Ang mabilis na tour na ito ay sumasaklaw sa mga esensyal para alam mo kung saan magsisimula.', vi: 'Hướng dẫn nhanh này bao gồm những điều cần thiết để bạn biết chính xác nơi bắt đầu.', ko: '이 빠른 투어는 정확히 어디서 시작해야 하는지 알 수 있도록 필수 사항을 다룹니다.' },
    welcomeDuration: { en: 'Takes about 60 seconds. You can skip or exit anytime.', es: 'Toma unos 60 segundos. Puedes saltar o salir en cualquier momento.', tl: 'Mga 60 segundo lang. Pwede kang lumaktaw o lumabas anumang oras.', vi: 'Mất khoảng 60 giây. Bạn có thể bỏ qua hoặc thoát bất cứ lúc nào.', ko: '약 60초 소요됩니다. 언제든지 건너뛰거나 종료할 수 있습니다.' },
    welcomeTip: { en: '💡 You can restart this tour anytime from the Help menu.', es: '💡 Puedes reiniciar este tour en cualquier momento desde el menú de Ayuda.', tl: '💡 Pwede mong i-restart ang tour na ito anumang oras mula sa Help menu.', vi: '💡 Bạn có thể khởi động lại hướng dẫn này bất cứ lúc nào từ menu Trợ giúp.', ko: '💡 도움말 메뉴에서 언제든지 이 투어를 다시 시작할 수 있습니다.' },
    
    // Search step
    searchTitle: { en: '🔍 Start With Search', es: '🔍 Comienza Con Búsqueda', tl: '🔍 Magsimula Sa Paghahanap', vi: '🔍 Bắt Đầu Với Tìm Kiếm', ko: '🔍 검색으로 시작하기' },
    searchIntro: { en: 'This search bar is where most people begin.', es: 'Esta barra de búsqueda es donde la mayoría de las personas comienzan.', tl: 'Ang search bar na ito ay kung saan nagsisimula ang karamihan.', vi: 'Thanh tìm kiếm này là nơi hầu hết mọi người bắt đầu.', ko: '이 검색창은 대부분의 사람들이 시작하는 곳입니다.' },
    searchLookup: { en: 'Look up any VA disability condition by:', es: 'Busca cualquier condición de discapacidad del VA por:', tl: 'Hanapin ang anumang VA disability condition sa pamamagitan ng:', vi: 'Tra cứu bất kỳ tình trạng khuyết tật VA nào theo:', ko: '다음으로 VA 장애 상태를 찾아보세요:' },
    searchByName: { en: 'Name: Try "PTSD" or "tinnitus"', es: 'Nombre: Prueba "PTSD" o "tinnitus"', tl: 'Pangalan: Subukan ang "PTSD" o "tinnitus"', vi: 'Tên: Thử "PTSD" hoặc "tinnitus"', ko: '이름: "PTSD" 또는 "이명" 시도' },
    searchByBody: { en: 'Body part: "knee" or "shoulder"', es: 'Parte del cuerpo: "rodilla" u "hombro"', tl: 'Bahagi ng katawan: "tuhod" o "balikat"', vi: 'Bộ phận cơ thể: "đầu gối" hoặc "vai"', ko: '신체 부위: "무릎" 또는 "어깨"' },
    searchByCode: { en: 'Diagnostic code: "9411" or "6260"', es: 'Código diagnóstico: "9411" o "6260"', tl: 'Diagnostic code: "9411" o "6260"', vi: 'Mã chẩn đoán: "9411" hoặc "6260"', ko: '진단 코드: "9411" 또는 "6260"' },
    searchCoverage: { en: 'We cover all {count} conditions from the official VA rating schedule.', es: 'Cubrimos las {count} condiciones del calendario oficial de calificaciones del VA.', tl: 'Sinasaklaw namin ang lahat ng {count} na kondisyon mula sa opisyal na VA rating schedule.', vi: 'Chúng tôi bao gồm tất cả {count} tình trạng từ lịch đánh giá VA chính thức.', ko: '공식 VA 등급표의 모든 {count}개 조건을 포함합니다.' },
    
    // Quick Picker step
    quickPickerTitle: { en: '⚡ Quick Add (Skip the Search)', es: '⚡ Agregar Rápido (Saltar Búsqueda)', tl: '⚡ Mabilis na Pagdagdag (Laktawan ang Paghahanap)', vi: '⚡ Thêm Nhanh (Bỏ Qua Tìm Kiếm)', ko: '⚡ 빠른 추가 (검색 건너뛰기)' },
    quickPickerIntro: { en: 'Already know what you\'re claiming?', es: '¿Ya sabes qué estás reclamando?', tl: 'Alam mo na ba kung ano ang i-claim mo?', vi: 'Đã biết bạn đang yêu cầu gì?', ko: '무엇을 청구하는지 이미 알고 계신가요?' },
    quickPickerShortcut: { en: 'Use this shortcut!', es: '¡Usa este atajo!', tl: 'Gamitin ang shortcut na ito!', vi: 'Sử dụng phím tắt này!', ko: '이 바로가기를 사용하세요!' },
    quickPickerDesc: { en: 'The Quick Picker lets you add conditions directly to your packet without searching.', es: 'El Quick Picker te permite agregar condiciones directamente a tu paquete sin buscar.', tl: 'Ang Quick Picker ay nagbibigay-daan sa iyo na magdagdag ng mga kondisyon direkta sa packet mo nang hindi naghahanap.', vi: 'Quick Picker cho phép bạn thêm các tình trạng trực tiếp vào hồ sơ mà không cần tìm kiếm.', ko: 'Quick Picker를 사용하면 검색 없이 조건을 패킷에 직접 추가할 수 있습니다.' },
    quickPickerHowTo: { en: 'Just click → Pick a body system → Select your condition → Done!', es: '¡Solo haz clic → Elige un sistema corporal → Selecciona tu condición → Listo!', tl: 'I-click lang → Pumili ng body system → Piliin ang kondisyon mo → Tapos na!', vi: 'Chỉ cần nhấp → Chọn hệ thống cơ thể → Chọn tình trạng của bạn → Xong!', ko: '클릭 → 신체 시스템 선택 → 조건 선택 → 완료!' },
    
    // My Packet step
    myPacketTitle: { en: '📦 Your Personal Workspace', es: '📦 Tu Espacio de Trabajo Personal', tl: '📦 Ang Personal Mong Workspace', vi: '📦 Không Gian Làm Việc Cá Nhân Của Bạn', ko: '📦 개인 작업 공간' },
    myPacketIntro: { en: 'This is "My Packet" - your claims command center.', es: 'Esto es "Mi Paquete" - tu centro de comando de reclamos.', tl: 'Ito ay "My Packet" - ang claims command center mo.', vi: 'Đây là "Hồ Sơ Của Tôi" - trung tâm điều khiển yêu cầu của bạn.', ko: '이것은 "내 패킷" - 청구 관리 센터입니다.' },
    myPacketEverything: { en: 'Everything you save appears here:', es: 'Todo lo que guardes aparece aquí:', tl: 'Lahat ng sine-save mo ay lumilitaw dito:', vi: 'Mọi thứ bạn lưu đều xuất hiện ở đây:', ko: '저장한 모든 것이 여기에 나타납니다:' },
    myPacketConditions: { en: 'All your tracked conditions', es: 'Todas tus condiciones rastreadas', tl: 'Lahat ng mga naka-track mong kondisyon', vi: 'Tất cả các tình trạng được theo dõi', ko: '추적된 모든 조건' },
    myPacketStatements: { en: 'Personal statements you\'ve written', es: 'Declaraciones personales que has escrito', tl: 'Mga personal statement na isinulat mo', vi: 'Các tuyên bố cá nhân bạn đã viết', ko: '작성한 개인 진술서' },
    myPacketEvidence: { en: 'Evidence checklist and progress', es: 'Lista de verificación de evidencia y progreso', tl: 'Evidence checklist at progreso', vi: 'Danh sách kiểm tra bằng chứng và tiến độ', ko: '증거 체크리스트 및 진행 상황' },
    myPacketDocs: { en: 'Documents and notes', es: 'Documentos y notas', tl: 'Mga dokumento at tala', vi: 'Tài liệu và ghi chú', ko: '문서 및 메모' },
    myPacketHomeBase: { en: 'Think of it as your claim\'s home base.', es: 'Piensa en ello como la base de tu reclamo.', tl: 'Isipin ito bilang home base ng iyong claim.', vi: 'Hãy coi đây là cơ sở của yêu cầu của bạn.', ko: '청구의 홈 베이스라고 생각하세요.' },
    
    // Workflow Guide step
    workflowTitle: { en: '🗺️ Step-by-Step Guides', es: '🗺️ Guías Paso a Paso', tl: '🗺️ Mga Step-by-Step na Gabay', vi: '🗺️ Hướng Dẫn Từng Bước', ko: '🗺️ 단계별 가이드' },
    workflowIntro: { en: 'Not sure what to do first?', es: '¿No estás seguro qué hacer primero?', tl: 'Hindi sigurado kung ano ang gagawin muna?', vi: 'Không chắc phải làm gì trước?', ko: '무엇을 먼저 해야 할지 모르시겠어요?' },
    workflowCovered: { en: 'This button has you covered.', es: 'Este botón te tiene cubierto.', tl: 'Sakop ka ng button na ito.', vi: 'Nút này sẽ giúp bạn.', ko: '이 버튼이 도와드립니다.' },
    workflowWalks: { en: 'The Workflow Guide walks you through:', es: 'La Guía de Flujo de Trabajo te guía a través de:', tl: 'Ang Workflow Guide ay gagabayan ka sa:', vi: 'Hướng dẫn quy trình hướng dẫn bạn qua:', ko: '워크플로우 가이드가 안내합니다:' },
    workflowFirstClaim: { en: '📝 Filing your first claim', es: '📝 Presentar tu primer reclamo', tl: '📝 Pag-file ng unang claim mo', vi: '📝 Nộp yêu cầu đầu tiên của bạn', ko: '📝 첫 번째 청구 제출' },
    workflowAppeal: { en: '🔄 Appealing a denial', es: '🔄 Apelar una denegación', tl: '🔄 Pag-appeal ng denial', vi: '🔄 Kháng cáo từ chối', ko: '🔄 거부에 대한 항소' },
    workflowIncrease: { en: '⬆️ Increasing an existing rating', es: '⬆️ Aumentar una calificación existente', tl: '⬆️ Pagpapataas ng existing rating', vi: '⬆️ Tăng xếp hạng hiện có', ko: '⬆️ 기존 등급 인상' },
    workflowSpecial: { en: '🎖️ Applying for special benefits (TDIU/SMC)', es: '🎖️ Solicitar beneficios especiales (TDIU/SMC)', tl: '🎖️ Pag-apply para sa special benefits (TDIU/SMC)', vi: '🎖️ Đăng ký quyền lợi đặc biệt (TDIU/SMC)', ko: '🎖️ 특별 혜택 신청 (TDIU/SMC)' },
    workflowLost: { en: 'Completely lost?', es: '¿Completamente perdido?', tl: 'Totally lost?', vi: 'Hoàn toàn mất phương hướng?', ko: '완전히 길을 잃으셨나요?' },
    workflowStartHere: { en: 'Start here!', es: '¡Comienza aquí!', tl: 'Magsimula dito!', vi: 'Bắt đầu ở đây!', ko: '여기서 시작하세요!' },
    
    // Tools Menu step
    toolsTitle: { en: '🛠️ Your Claims Toolkit', es: '🛠️ Tu Kit de Herramientas de Reclamos', tl: '🛠️ Ang Claims Toolkit Mo', vi: '🛠️ Bộ Công Cụ Yêu Cầu Của Bạn', ko: '🛠️ 청구 도구 키트' },
    toolsIntro: { en: 'Ready for the advanced features?', es: '¿Listo para las funciones avanzadas?', tl: 'Handa ka na ba sa advanced features?', vi: 'Sẵn sàng cho các tính năng nâng cao?', ko: '고급 기능을 사용할 준비가 되셨나요?' },
    toolsCount: { en: 'We\'ve got {count}+ specialized tools:', es: 'Tenemos {count}+ herramientas especializadas:', tl: 'Mayroon kaming {count}+ na specialized tools:', vi: 'Chúng tôi có {count}+ công cụ chuyên dụng:', ko: '{count}개 이상의 전문 도구가 있습니다:' },
    toolsSecondaryScout: { en: '🔍 Secondary Scout - Discover related conditions', es: '🔍 Secondary Scout - Descubre condiciones relacionadas', tl: '🔍 Secondary Scout - Tuklasin ang mga kaugnay na kondisyon', vi: '🔍 Secondary Scout - Khám phá các tình trạng liên quan', ko: '🔍 Secondary Scout - 관련 조건 발견' },
    toolsCPSimulator: { en: '✅ C&P Simulator - Practice for your exam', es: '✅ C&P Simulator - Practica para tu examen', tl: '✅ C&P Simulator - Mag-practice para sa exam mo', vi: '✅ C&P Simulator - Thực hành cho kỳ khám của bạn', ko: '✅ C&P Simulator - 시험 연습' },
    toolsCalculator: { en: '🧮 Rating Calculator - Calculate your total %', es: '🧮 Rating Calculator - Calcula tu % total', tl: '🧮 Rating Calculator - Kalkulahin ang kabuuang % mo', vi: '🧮 Rating Calculator - Tính tổng % của bạn', ko: '🧮 Rating Calculator - 총 % 계산' },
    toolsNexus: { en: '📝 Nexus Builder - Generate medical statements', es: '📝 Nexus Builder - Genera declaraciones médicas', tl: '📝 Nexus Builder - Gumawa ng medical statements', vi: '📝 Nexus Builder - Tạo báo cáo y tế', ko: '📝 Nexus Builder - 의료 진술서 생성' },
    toolsMore: { en: '...and 35+ more!', es: '...¡y más de 35 más!', tl: '...at 35+ pa!', vi: '...và hơn 35 công cụ khác!', ko: '...그리고 35개 이상!' },
    toolsClickAnytime: { en: 'Click "Tools" whenever you need something specific.', es: 'Haz clic en "Tools" cuando necesites algo específico.', tl: 'I-click ang "Tools" kapag kailangan mo ng partikular na bagay.', vi: 'Nhấp "Công cụ" bất cứ khi nào bạn cần điều gì cụ thể.', ko: '특정한 것이 필요할 때 "도구"를 클릭하세요.' },
    
    // AI Navigator step
    navigatorTitle: { en: '🧭 Your AI Assistant', es: '🧭 Tu Asistente de IA', tl: '🧭 Ang AI Assistant Mo', vi: '🧭 Trợ Lý AI Của Bạn', ko: '🧭 AI 어시스턴트' },
    navigatorLookCorner: { en: 'Look in the bottom-left corner!', es: '¡Mira en la esquina inferior izquierda!', tl: 'Tingnan sa ibaba-kaliwang sulok!', vi: 'Nhìn góc dưới bên trái!', ko: '왼쪽 하단 모서리를 보세요!' },
    navigatorOpens: { en: 'The 🧭 button opens The Navigator - your personal claims guide!', es: 'El botón 🧭 abre El Navegador - ¡tu guía personal de reclamos!', tl: 'Ang 🧭 button ay nagbubukas ng Navigator - ang personal mong claims guide!', vi: 'Nút 🧭 mở Navigator - hướng dẫn yêu cầu cá nhân của bạn!', ko: '🧭 버튼을 누르면 Navigator가 열립니다 - 개인 청구 가이드!' },
    navigatorCan: { en: 'The Navigator can:', es: 'El Navegador puede:', tl: 'Ang Navigator ay maaaring:', vi: 'Navigator có thể:', ko: 'Navigator 기능:' },
    navigatorAnswer: { en: '💬 Answer questions about the VA process', es: '💬 Responder preguntas sobre el proceso del VA', tl: '💬 Sumagot ng mga tanong tungkol sa VA process', vi: '💬 Trả lời câu hỏi về quy trình VA', ko: '💬 VA 프로세스에 대한 질문에 답변' },
    navigatorExplain: { en: '📚 Explain confusing regulations in plain English', es: '📚 Explicar regulaciones confusas en inglés simple', tl: '📚 Ipaliwanag ang nakakalitong regulations sa plain English', vi: '📚 Giải thích các quy định phức tạp bằng tiếng Anh đơn giản', ko: '📚 복잡한 규정을 쉬운 영어로 설명' },
    navigatorWalk: { en: '🤝 Walk you through any tool', es: '🤝 Guiarte a través de cualquier herramienta', tl: '🤝 Gabayan ka sa anumang tool', vi: '🤝 Hướng dẫn bạn qua bất kỳ công cụ nào', ko: '🤝 모든 도구 사용법 안내' },
    navigatorSuggest: { en: '🎯 Suggest what to do next', es: '🎯 Sugerir qué hacer a continuación', tl: '🎯 Magmungkahi kung ano ang susunod na gagawin', vi: '🎯 Đề xuất việc cần làm tiếp theo', ko: '🎯 다음 할 일 제안' },
    navigatorDrag: { en: '💡 Pro tip: You can drag it anywhere on your screen!', es: '💡 Consejo: ¡Puedes arrastrarlo a cualquier parte de tu pantalla!', tl: '💡 Pro tip: Pwede mo itong i-drag kahit saan sa screen mo!', vi: '💡 Mẹo: Bạn có thể kéo nó đến bất cứ đâu trên màn hình!', ko: '💡 프로 팁: 화면 어디든지 드래그할 수 있습니다!' },
    navigatorOpenEnd: { en: 'We\'ll open it for you at the end of this tour!', es: '¡Lo abriremos para ti al final de este tour!', tl: 'Bubuksan namin ito para sa iyo sa dulo ng tour na ito!', vi: 'Chúng tôi sẽ mở nó cho bạn ở cuối hướng dẫn này!', ko: '투어 끝에 열어드리겠습니다!' },
    
    // Help step
    helpTitle: { en: '📖 When You Need Help', es: '📖 Cuando Necesites Ayuda', tl: '📖 Kapag Kailangan Mo ng Tulong', vi: '📖 Khi Bạn Cần Trợ Giúp', ko: '📖 도움이 필요할 때' },
    helpStuck: { en: 'Stuck? Confused?', es: '¿Atascado? ¿Confundido?', tl: 'Natigil? Nalilito?', vi: 'Bị kẹt? Bối rối?', ko: '막혔나요? 혼란스러우신가요?' },
    helpFriend: { en: 'The User Manual is your friend.', es: 'El Manual de Usuario es tu amigo.', tl: 'Ang User Manual ay kaibigan mo.', vi: 'Hướng dẫn sử dụng là bạn của bạn.', ko: '사용 설명서가 도움이 됩니다.' },
    helpInside: { en: 'Inside you\'ll find:', es: 'Dentro encontrarás:', tl: 'Sa loob mahahanap mo:', vi: 'Bên trong bạn sẽ tìm thấy:', ko: '내부에서 찾을 수 있는 것:' },
    helpDocs: { en: 'Complete documentation for every tool', es: 'Documentación completa para cada herramienta', tl: 'Kumpletong dokumentasyon para sa bawat tool', vi: 'Tài liệu đầy đủ cho mọi công cụ', ko: '모든 도구에 대한 완전한 문서' },
    helpGuides: { en: 'Step-by-step how-to guides', es: 'Guías paso a paso', tl: 'Mga step-by-step na gabay', vi: 'Hướng dẫn từng bước', ko: '단계별 방법 가이드' },
    helpFAQ: { en: 'Answers to common questions', es: 'Respuestas a preguntas comunes', tl: 'Mga sagot sa mga karaniwang tanong', vi: 'Câu trả lời cho các câu hỏi phổ biến', ko: '자주 묻는 질문에 대한 답변' },
    helpRestart: { en: 'A way to restart this tour', es: 'Una forma de reiniciar este tour', tl: 'Isang paraan para i-restart ang tour na ito', vi: 'Cách khởi động lại hướng dẫn này', ko: '이 투어를 다시 시작하는 방법' },
    helpBackup: { en: '💾 Don\'t forget to backup your data regularly!', es: '💾 ¡No olvides hacer respaldo de tus datos regularmente!', tl: '💾 Huwag kalimutang i-backup ang data mo regularly!', vi: '💾 Đừng quên sao lưu dữ liệu thường xuyên!', ko: '💾 정기적으로 데이터를 백업하는 것을 잊지 마세요!' },
    
    // Final step
    finalTitle: { en: '🚀 You\'re All Set!', es: '🚀 ¡Estás Listo!', tl: '🚀 Handa Ka Na!', vi: '🚀 Bạn Đã Sẵn Sàng!', ko: '🚀 모든 준비가 완료되었습니다!' },
    finalThatsIt: { en: 'That\'s the tour!', es: '¡Eso es el tour!', tl: 'Yun na ang tour!', vi: 'Đó là hướng dẫn!', ko: '투어가 끝났습니다!' },
    finalKnowEssentials: { en: 'You now know the essentials.', es: 'Ahora conoces lo esencial.', tl: 'Alam mo na ngayon ang mga esensyal.', vi: 'Bây giờ bạn đã biết những điều cần thiết.', ko: '이제 필수 사항을 알게 되었습니다.' },
    finalDemoData: { en: '✅ Want to see an example? Click "Load Demo Data" to explore a sample claim with all the features filled out.', es: '✅ ¿Quieres ver un ejemplo? Haz clic en "Cargar Datos Demo" para explorar un reclamo de muestra con todas las funciones completadas.', tl: '✅ Gusto mong makakita ng halimbawa? I-click ang "Load Demo Data" para mag-explore ng sample claim na may lahat ng features na napunan.', vi: '✅ Muốn xem ví dụ? Nhấp "Tải Dữ Liệu Demo" để khám phá một yêu cầu mẫu với tất cả các tính năng được điền.', ko: '✅ 예시를 보고 싶으신가요? "데모 데이터 로드"를 클릭하여 모든 기능이 채워진 샘플 청구를 탐색하세요.' },
    finalRemember: { en: 'Remember: The 📖 Help menu and 🧭 Navigator are always here if you need guidance.', es: 'Recuerda: El menú de 📖 Ayuda y el 🧭 Navegador siempre están aquí si necesitas orientación.', tl: 'Tandaan: Ang 📖 Help menu at 🧭 Navigator ay laging nandito kung kailangan mo ng gabay.', vi: 'Nhớ rằng: Menu 📖 Trợ giúp và 🧭 Navigator luôn ở đây nếu bạn cần hướng dẫn.', ko: '기억하세요: 📖 도움말 메뉴와 🧭 Navigator는 안내가 필요할 때 항상 여기 있습니다.' },
    finalMotto: { en: '"Built by a Veteran, For Veterans."', es: '"Construido por un Veterano, Para Veteranos."', tl: '"Ginawa ng isang Beterano, Para sa mga Beterano."', vi: '"Được Xây Dựng Bởi Một Cựu Chiến Binh, Cho Các Cựu Chiến Binh."', ko: '"재향군인이 재향군인을 위해 만들었습니다."' },
  },

  // User Manual Component
  userManual: {
    // Header & Navigation
    title: { en: '📖 User Manual', es: '📖 Manual de Usuario', tl: '📖 Manual ng User', vi: '📖 Hướng Dẫn Sử Dụng', ko: '📖 사용자 매뉴얼' },
    searchPlaceholder: { en: 'Search documentation...', es: 'Buscar documentación...', tl: 'Maghanap ng dokumentasyon...', vi: 'Tìm kiếm tài liệu...', ko: '문서 검색...' },
    searchResults: { en: 'SEARCH RESULTS', es: 'RESULTADOS DE BÚSQUEDA', tl: 'MGA RESULTA NG PAGHAHANAP', vi: 'KẾT QUẢ TÌM KIẾM', ko: '검색 결과' },
    noResultsFound: { en: 'No results found', es: 'No se encontraron resultados', tl: 'Walang nahanap na resulta', vi: 'Không tìm thấy kết quả', ko: '결과 없음' },
    overview: { en: 'Overview', es: 'Resumen', tl: 'Pangkalahatang-ideya', vi: 'Tổng quan', ko: '개요' },
    home: { en: 'Home', es: 'Inicio', tl: 'Tahanan', vi: 'Trang chủ', ko: '홈' },
    backToHome: { en: '← Back to Home', es: '← Volver al Inicio', tl: '← Bumalik sa Tahanan', vi: '← Quay lại Trang chủ', ko: '← 홈으로 돌아가기' },
    closeManual: { en: 'Close Manual', es: 'Cerrar Manual', tl: 'Isara ang Manual', vi: 'Đóng Hướng dẫn', ko: '매뉴얼 닫기' },
    startTour: { en: '🎓 Start Interactive Tour', es: '🎓 Iniciar Tour Interactivo', tl: '🎓 Simulan ang Interactive Tour', vi: '🎓 Bắt Đầu Hướng Dẫn Tương Tác', ko: '🎓 대화형 투어 시작' },
    restartTour: { en: '🎓 Restart Interactive Tour', es: '🎓 Reiniciar Tour Interactivo', tl: '🎓 I-restart ang Interactive Tour', vi: '🎓 Khởi Động Lại Hướng Dẫn', ko: '🎓 대화형 투어 다시 시작' },
    reportBug: { en: '🐛 Report a Bug', es: '🐛 Reportar un Error', tl: '🐛 Mag-report ng Bug', vi: '🐛 Báo Cáo Lỗi', ko: '🐛 버그 신고' },

    // Navigation Category Headers
    catGettingStarted: { en: 'Getting Started', es: 'Primeros Pasos', tl: 'Pagsisimula', vi: 'Bắt Đầu', ko: '시작하기' },
    catSearchExplore: { en: 'Search & Explore', es: 'Buscar y Explorar', tl: 'Maghanap at Mag-explore', vi: 'Tìm Kiếm & Khám Phá', ko: '검색 및 탐색' },
    catCalculate: { en: '📊 Calculate', es: '📊 Calcular', tl: '📊 Kalkulahin', vi: '📊 Tính Toán', ko: '📊 계산' },
    catDiscover: { en: '🔍 Discover', es: '🔍 Descubrir', tl: '🔍 Tuklasin', vi: '🔍 Khám Phá', ko: '🔍 발견' },
    catBuildEvidence: { en: '📋 Build Evidence', es: '📋 Construir Evidencia', tl: '📋 Bumuo ng Ebidensya', vi: '📋 Xây Dựng Bằng Chứng', ko: '📋 증거 구축' },
    catQualityControl: { en: '🎯 Quality Control', es: '🎯 Control de Calidad', tl: '🎯 Quality Control', vi: '🎯 Kiểm Soát Chất Lượng', ko: '🎯 품질 관리' },
    catAdvancedStrategy: { en: '⚡ Advanced Strategy', es: '⚡ Estrategia Avanzada', tl: '⚡ Advanced Strategy', vi: '⚡ Chiến Lược Nâng Cao', ko: '⚡ 고급 전략' },
    catShockAwe: { en: '💎 Shock & Awe', es: '💎 Impacto y Asombro', tl: '💎 Shock at Awe', vi: '💎 Ấn Tượng & Ngỡ Ngàng', ko: '💎 충격과 경외' },
    catSupport: { en: '🤝 Support', es: '🤝 Soporte', tl: '🤝 Suporta', vi: '🤝 Hỗ Trợ', ko: '🤝 지원' },
    catDataSettings: { en: '📁 Data & Settings', es: '📁 Datos y Configuración', tl: '📁 Data at Settings', vi: '📁 Dữ Liệu & Cài Đặt', ko: '📁 데이터 및 설정' },

    // Main Section Titles
    navHome: { en: 'Home', es: 'Inicio', tl: 'Tahanan', vi: 'Trang chủ', ko: '홈' },
    navGettingStarted: { en: 'Getting Started', es: 'Primeros Pasos', tl: 'Pagsisimula', vi: 'Bắt Đầu', ko: '시작하기' },
    navFirstVisit: { en: 'Your First Visit', es: 'Tu Primera Visita', tl: 'Ang Iyong Unang Pagbisita', vi: 'Lần Đầu Ghé Thăm', ko: '첫 방문' },
    navInterfaceOverview: { en: 'Interface Overview', es: 'Visión General de la Interfaz', tl: 'Pangkalahatang-ideya ng Interface', vi: 'Tổng Quan Giao Diện', ko: '인터페이스 개요' },
    navAccessibility: { en: 'Accessibility', es: 'Accesibilidad', tl: 'Accessibility', vi: 'Khả Năng Tiếp Cận', ko: '접근성' },
    navSearchExplore: { en: 'Search & Explore', es: 'Buscar y Explorar', tl: 'Maghanap at Mag-explore', vi: 'Tìm Kiếm & Khám Phá', ko: '검색 및 탐색' },
    navHowToSearch: { en: 'How to Search', es: 'Cómo Buscar', tl: 'Paano Maghanap', vi: 'Cách Tìm Kiếm', ko: '검색 방법' },
    navSearchResults: { en: 'Search Results', es: 'Resultados de Búsqueda', tl: 'Mga Resulta ng Paghahanap', vi: 'Kết Quả Tìm Kiếm', ko: '검색 결과' },
    navDisabilityDetails: { en: 'Disability Details', es: 'Detalles de Discapacidad', tl: 'Mga Detalye ng Disability', vi: 'Chi Tiết Khuyết Tật', ko: '장애 세부정보' },
    navRatingCriteria: { en: 'Rating Criteria', es: 'Criterios de Calificación', tl: 'Mga Pamantayan ng Rating', vi: 'Tiêu Chí Đánh Giá', ko: '평가 기준' },
    navTacticalCalculator: { en: 'Tactical Calculator', es: 'Calculadora Táctica', tl: 'Tactical Calculator', vi: 'Máy Tính Chiến Thuật', ko: '전술 계산기' },
    navCalcOverview: { en: 'How VA Math Works', es: 'Cómo Funciona la Matemática del VA', tl: 'Paano Gumagana ang VA Math', vi: 'Cách Tính Toán VA Hoạt Động', ko: 'VA 수학 작동 방식' },
    navCalcBilateral: { en: 'Bilateral Factor', es: 'Factor Bilateral', tl: 'Bilateral Factor', vi: 'Hệ Số Song Phương', ko: '양측 요인' },
    navCalcDependents: { en: 'Dependent Benefits', es: 'Beneficios de Dependientes', tl: 'Mga Benepisyo ng Dependents', vi: 'Quyền Lợi Người Phụ Thuộc', ko: '부양가족 혜택' },
    navCalcWhatIf: { en: 'What-If Scenarios', es: 'Escenarios Hipotéticos', tl: 'What-If Scenarios', vi: 'Kịch Bản Giả Định', ko: '가정 시나리오' },
    navSecondaryScout: { en: 'Secondary Scout', es: 'Scout Secundario', tl: 'Secondary Scout', vi: 'Scout Thứ Cấp', ko: '2차 스카우트' },
    navScoutLaunching: { en: 'Launching Scout', es: 'Iniciando Scout', tl: 'Paglulunsad ng Scout', vi: 'Khởi Động Scout', ko: '스카우트 시작' },
    navScoutResults: { en: 'Understanding Results', es: 'Entendiendo Resultados', tl: 'Pag-unawa sa mga Resulta', vi: 'Hiểu Kết Quả', ko: '결과 이해' },
    navScoutAddToPacket: { en: 'Add to Packet', es: 'Agregar al Paquete', tl: 'Idagdag sa Packet', vi: 'Thêm vào Hồ Sơ', ko: '패킷에 추가' },
    navCPExamSimulator: { en: 'C&P Exam Simulator', es: 'Simulador de Examen C&P', tl: 'C&P Exam Simulator', vi: 'Mô Phỏng Khám C&P', ko: 'C&P 시험 시뮬레이터' },
    navSimulatorGettingStarted: { en: 'Getting Started', es: 'Primeros Pasos', tl: 'Pagsisimula', vi: 'Bắt Đầu', ko: '시작하기' },
    navConditionSelection: { en: 'Condition Selection', es: 'Selección de Condición', tl: 'Pagpili ng Kondisyon', vi: 'Chọn Tình Trạng', ko: '상태 선택' },
    navTakingSimulation: { en: 'Taking the Simulation', es: 'Tomando la Simulación', tl: 'Pagsagawa ng Simulation', vi: 'Thực Hiện Mô Phỏng', ko: '시뮬레이션 진행' },
    navSimulatorResults: { en: 'Results & Feedback', es: 'Resultados y Retroalimentación', tl: 'Mga Resulta at Feedback', vi: 'Kết Quả & Phản Hồi', ko: '결과 및 피드백' },
    navFlashcards: { en: 'Flashcard Mode', es: 'Modo de Tarjetas', tl: 'Flashcard Mode', vi: 'Chế Độ Thẻ Ghi Nhớ', ko: '플래시카드 모드' },
    navDBQLibrary: { en: 'DBQ Library', es: 'Biblioteca DBQ', tl: 'DBQ Library', vi: 'Thư Viện DBQ', ko: 'DBQ 라이브러리' },
    navDBQOverview: { en: 'What are DBQs?', es: '¿Qué son los DBQs?', tl: 'Ano ang DBQs?', vi: 'DBQ Là Gì?', ko: 'DBQ란 무엇인가요?' },
    navDBQBrowse: { en: 'Browsing DBQs', es: 'Navegando DBQs', tl: 'Pag-browse ng DBQs', vi: 'Duyệt DBQ', ko: 'DBQ 찾아보기' },
    navDBQUsage: { en: 'Using DBQs', es: 'Usando DBQs', tl: 'Paggamit ng DBQs', vi: 'Sử Dụng DBQ', ko: 'DBQ 사용법' },
    navPathfinder: { en: 'Pathfinder', es: 'Pathfinder', tl: 'Pathfinder', vi: 'Pathfinder', ko: '패스파인더' },
    navWorkflowGuide: { en: 'Workflow Guide', es: 'Guía de Flujo de Trabajo', tl: 'Workflow Guide', vi: 'Hướng Dẫn Quy Trình', ko: '워크플로우 가이드' },
    navWorkflowOverview: { en: 'Mission Briefings', es: 'Briefings de Misión', tl: 'Mission Briefings', vi: 'Tóm Tắt Nhiệm Vụ', ko: '임무 브리핑' },
    navWorkflowProgress: { en: 'Tracking Progress', es: 'Seguimiento de Progreso', tl: 'Pag-track ng Progress', vi: 'Theo Dõi Tiến Độ', ko: '진행 상황 추적' },
    navCFileAnalyzer: { en: 'C-File AI Analyzer', es: 'Analizador de C-File con IA', tl: 'C-File AI Analyzer', vi: 'Phân Tích C-File AI', ko: 'C-File AI 분석기' },
    navCFileWhatIs: { en: 'What is a C-File?', es: '¿Qué es un C-File?', tl: 'Ano ang C-File?', vi: 'C-File Là Gì?', ko: 'C-File이란?' },
    navCFileUpload: { en: 'Dropping In Records', es: 'Cargando Registros', tl: 'Pag-drop ng Records', vi: 'Tải Lên Hồ Sơ', ko: '기록 업로드' },
    navCFileAnalysis: { en: 'Understanding Results', es: 'Entendiendo Resultados', tl: 'Pag-unawa sa mga Resulta', vi: 'Hiểu Kết Quả', ko: '결과 이해' },
    navBlueButtonXRay: { en: 'Blue Button X-Ray', es: 'Blue Button X-Ray', tl: 'Blue Button X-Ray', vi: 'Blue Button X-Ray', ko: 'Blue Button X-Ray' },
    navBlueOverview: { en: 'What Is Blue Button?', es: '¿Qué es Blue Button?', tl: 'Ano ang Blue Button?', vi: 'Blue Button Là Gì?', ko: 'Blue Button이란?' },
    navBlueExtract: { en: 'Extracting Evidence', es: 'Extrayendo Evidencia', tl: 'Pag-extract ng Ebidensya', vi: 'Trích Xuất Bằng Chứng', ko: '증거 추출' },
    navWitnessBench: { en: 'Witness Bench', es: 'Banco de Testigos', tl: 'Witness Bench', vi: 'Ghế Nhân Chứng', ko: '증인석' },
    navWitnessOverview: { en: 'Buddy Statements', es: 'Declaraciones de Compañeros', tl: 'Buddy Statements', vi: 'Lời Khai Đồng Đội', ko: '동료 진술' },
    navWitnessInterview: { en: 'The Interview', es: 'La Entrevista', tl: 'Ang Panayam', vi: 'Phỏng Vấn', ko: '인터뷰' },
    navWitnessOutput: { en: 'Statement Output', es: 'Salida de Declaración', tl: 'Output ng Statement', vi: 'Kết Quả Tuyên Bố', ko: '진술 출력' },
    navNexusBuilder: { en: 'Nexus Builder', es: 'Constructor de Nexus', tl: 'Nexus Builder', vi: 'Xây Dựng Nexus', ko: '넥서스 빌더' },
    navWhatIsNexus: { en: 'What is a Nexus?', es: '¿Qué es un Nexus?', tl: 'Ano ang Nexus?', vi: 'Nexus Là Gì?', ko: '넥서스란?' },
    navBuildingStatement: { en: 'Building Your Statement', es: 'Construyendo Tu Declaración', tl: 'Pagbuo ng Statement Mo', vi: 'Xây Dựng Tuyên Bố', ko: '진술서 작성' },
    navDoctorCheatSheet: { en: "Doctor's Cheat Sheet", es: 'Guía Rápida del Doctor', tl: "Doctor's Cheat Sheet", vi: 'Bảng Hướng Dẫn Bác Sĩ', ko: '의사용 요약 시트' },
    navDownloadOptions: { en: 'Download Options', es: 'Opciones de Descarga', tl: 'Mga Opsyon sa Pag-download', vi: 'Tùy Chọn Tải Xuống', ko: '다운로드 옵션' },
    navFormsHelper: { en: 'Forms Helper', es: 'Asistente de Formularios', tl: 'Forms Helper', vi: 'Trợ Giúp Biểu Mẫu', ko: '양식 도우미' },
    navAvailableForms: { en: 'Available Forms', es: 'Formularios Disponibles', tl: 'Mga Available na Form', vi: 'Biểu Mẫu Có Sẵn', ko: '사용 가능한 양식' },
    navBuddyStatements: { en: 'Buddy Statements', es: 'Declaraciones de Compañeros', tl: 'Buddy Statements', vi: 'Lời Khai Đồng Đội', ko: '동료 진술' },
    navIntentToFile: { en: 'Intent to File', es: 'Intención de Presentar', tl: 'Intent to File', vi: 'Ý Định Nộp Đơn', ko: '제출 의향' },
    navPTSDStressor: { en: 'PTSD Stressor', es: 'Estresor de TEPT', tl: 'PTSD Stressor', vi: 'Yếu Tố Gây PTSD', ko: 'PTSD 스트레스 요인' },
    navVeteranProfile: { en: 'Veteran Profile', es: 'Perfil del Veterano', tl: 'Veteran Profile', vi: 'Hồ Sơ Cựu Chiến Binh', ko: '재향군인 프로필' },
    navRedTeamSimulator: { en: 'Red Team Simulator', es: 'Simulador Red Team', tl: 'Red Team Simulator', vi: 'Mô Phỏng Đội Đỏ', ko: '레드팀 시뮬레이터' },
    navRedOverview: { en: 'What is Red Team?', es: '¿Qué es Red Team?', tl: 'Ano ang Red Team?', vi: 'Red Team Là Gì?', ko: '레드팀이란?' },
    navRedAnalysis: { en: 'Weakness Analysis', es: 'Análisis de Debilidades', tl: 'Pagsusuri ng Kahinaan', vi: 'Phân Tích Điểm Yếu', ko: '약점 분석' },
    navDecisionDecoder: { en: 'Decision Decoder', es: 'Decodificador de Decisiones', tl: 'Decision Decoder', vi: 'Giải Mã Quyết Định', ko: '결정 디코더' },
    navDecoderOverview: { en: 'Overview', es: 'Resumen', tl: 'Pangkalahatang-ideya', vi: 'Tổng Quan', ko: '개요' },
    navDecoderUpload: { en: 'Drop In Decision', es: 'Cargar Decisión', tl: 'I-drop ang Decision', vi: 'Tải Lên Quyết Định', ko: '결정 업로드' },
    navDecoderAppeal: { en: 'Appeal Options', es: 'Opciones de Apelación', tl: 'Mga Opsyon sa Appeal', vi: 'Tùy Chọn Kháng Cáo', ko: '항소 옵션' },
    navSharkRadar: { en: 'Shark Radar', es: 'Radar de Tiburones', tl: 'Shark Radar', vi: 'Radar Cá Mập', ko: '상어 레이더' },
    navTDIUBuilder: { en: 'TDIU Builder', es: 'Constructor de TDIU', tl: 'TDIU Builder', vi: 'Xây Dựng TDIU', ko: 'TDIU 빌더' },
    navTDIUOverview: { en: 'What is TDIU?', es: '¿Qué es TDIU?', tl: 'Ano ang TDIU?', vi: 'TDIU Là Gì?', ko: 'TDIU란?' },
    navTDIUEligibility: { en: 'Eligibility Check', es: 'Verificación de Elegibilidad', tl: 'Pagsusuri ng Eligibility', vi: 'Kiểm Tra Đủ Điều Kiện', ko: '자격 확인' },
    navRiskAssessment: { en: 'Risk Assessment', es: 'Evaluación de Riesgo', tl: 'Risk Assessment', vi: 'Đánh Giá Rủi Ro', ko: '위험 평가' },
    navSymptomLogger: { en: 'Symptom Logger', es: 'Registro de Síntomas', tl: 'Symptom Logger', vi: 'Ghi Chép Triệu Chứng', ko: '증상 기록기' },
    navSymptomOverview: { en: 'Why Track Symptoms?', es: '¿Por qué Rastrear Síntomas?', tl: 'Bakit Mag-track ng mga Sintomas?', vi: 'Tại Sao Theo Dõi Triệu Chứng?', ko: '증상을 추적하는 이유?' },
    navSymptomLogging: { en: 'Logging Symptoms', es: 'Registrando Síntomas', tl: 'Pag-log ng mga Sintomas', vi: 'Ghi Chép Triệu Chứng', ko: '증상 기록' },
    navSymptomReports: { en: 'Reports & Export', es: 'Reportes y Exportación', tl: 'Mga Ulat at Export', vi: 'Báo Cáo & Xuất', ko: '보고서 및 내보내기' },
    navPACTActNavigator: { en: 'PACT Act Navigator', es: 'Navegador de la Ley PACT', tl: 'PACT Act Navigator', vi: 'Điều Hướng Đạo Luật PACT', ko: 'PACT법 네비게이터' },
    navPACTOverview: { en: 'What is PACT Act?', es: '¿Qué es la Ley PACT?', tl: 'Ano ang PACT Act?', vi: 'Đạo Luật PACT Là Gì?', ko: 'PACT법이란?' },
    navPACTConditions: { en: 'Covered Conditions', es: 'Condiciones Cubiertas', tl: 'Mga Covered Conditions', vi: 'Tình Trạng Được Bảo Hiểm', ko: '적용 상태' },
    navPACTLocations: { en: 'Covered Locations', es: 'Ubicaciones Cubiertas', tl: 'Mga Covered Locations', vi: 'Địa Điểm Được Bảo Hiểm', ko: '적용 위치' },
    navFOIAKeysmith: { en: 'FOIA Keysmith', es: 'FOIA Keysmith', tl: 'FOIA Keysmith', vi: 'FOIA Keysmith', ko: 'FOIA 키스미스' },
    navMillionDollar: { en: 'Million Dollar Dashboard', es: 'Panel del Millón de Dólares', tl: 'Million Dollar Dashboard', vi: 'Bảng Điều Khiển Triệu Đô', ko: '백만 달러 대시보드' },
    navMOSHazardMatcher: { en: 'MOS Hazard Matcher', es: 'Comparador de Riesgos MOS', tl: 'MOS Hazard Matcher', vi: 'Đối Chiếu Nguy Hiểm MOS', ko: 'MOS 위험 매처' },
    navWebOfConditions: { en: 'Web of Conditions', es: 'Red de Condiciones', tl: 'Web ng mga Kondisyon', vi: 'Mạng Lưới Tình Trạng', ko: '상태 웹' },
    navVSOFinder: { en: 'VSO Finder', es: 'Buscador de VSO', tl: 'VSO Finder', vi: 'Tìm VSO', ko: 'VSO 찾기' },
    navStateBenefitHunter: { en: 'State Benefit Hunter', es: 'Buscador de Beneficios Estatales', tl: 'State Benefit Hunter', vi: 'Tìm Quyền Lợi Tiểu Bang', ko: '주 혜택 찾기' },
    navMyPacket: { en: 'My Packet', es: 'Mi Paquete', tl: 'Ang Packet Ko', vi: 'Hồ Sơ Của Tôi', ko: '내 패킷' },
    navManagingClaims: { en: 'Managing Claims', es: 'Gestionando Reclamos', tl: 'Pamamahala ng mga Claim', vi: 'Quản Lý Yêu Cầu', ko: '청구 관리' },
    navSavedForms: { en: 'Saved Forms', es: 'Formularios Guardados', tl: 'Mga Na-save na Form', vi: 'Biểu Mẫu Đã Lưu', ko: '저장된 양식' },
    navBackupRestore: { en: 'Backup & Restore', es: 'Respaldo y Restauración', tl: 'Backup at Restore', vi: 'Sao Lưu & Khôi Phục', ko: '백업 및 복원' },
    navExportingData: { en: 'Exporting Data', es: 'Exportando Datos', tl: 'Pag-export ng Data', vi: 'Xuất Dữ Liệu', ko: '데이터 내보내기' },
    navVAResources: { en: 'VA Resources', es: 'Recursos del VA', tl: 'Mga Resource ng VA', vi: 'Tài Nguyên VA', ko: 'VA 리소스' },
    navOnlinePortals: { en: 'Online Portals', es: 'Portales en Línea', tl: 'Mga Online Portal', vi: 'Cổng Trực Tuyến', ko: '온라인 포털' },
    navPhoneNumbers: { en: 'Phone Numbers', es: 'Números de Teléfono', tl: 'Mga Numero ng Telepono', vi: 'Số Điện Thoại', ko: '전화번호' },
    navExternalResources: { en: 'External Resources', es: 'Recursos Externos', tl: 'Mga External Resources', vi: 'Tài Nguyên Bên Ngoài', ko: '외부 리소스' },
    navSettings: { en: 'Settings', es: 'Configuración', tl: 'Mga Setting', vi: 'Cài Đặt', ko: '설정' },
    navDisplayMode: { en: 'Display Mode', es: 'Modo de Visualización', tl: 'Display Mode', vi: 'Chế Độ Hiển Thị', ko: '표시 모드' },
    navAccessibilityOptions: { en: 'Accessibility Options', es: 'Opciones de Accesibilidad', tl: 'Mga Accessibility Options', vi: 'Tùy Chọn Trợ Năng', ko: '접근성 옵션' },
    navDataManagement: { en: 'Data Management', es: 'Gestión de Datos', tl: 'Pamamahala ng Data', vi: 'Quản Lý Dữ Liệu', ko: '데이터 관리' },
    navAISettings: { en: 'AI Settings', es: 'Configuración de IA', tl: 'Mga Setting ng AI', vi: 'Cài Đặt AI', ko: 'AI 설정' },
    navLocalAIOverview: { en: 'Local AI Overview', es: 'Resumen de IA Local', tl: 'Pangkalahatang-ideya ng Local AI', vi: 'Tổng Quan AI Cục Bộ', ko: '로컬 AI 개요' },
    navModelSelection: { en: 'Choosing the Right Model', es: 'Eligiendo el Modelo Correcto', tl: 'Pagpili ng Tamang Model', vi: 'Chọn Đúng Mô Hình', ko: '올바른 모델 선택' },
    navCloudVsLocal: { en: 'Cloud vs Local AI', es: 'IA en la Nube vs Local', tl: 'Cloud vs Local AI', vi: 'AI Đám Mây vs Cục Bộ', ko: '클라우드 vs 로컬 AI' },
  },

  // What's New Modal
  whatsNew: {
    title: { en: "What's New in Vet-Rate.org", es: 'Novedades en Vet-Rate.org', tl: "Ano'ng Bago sa Vet-Rate.org", vi: 'Có Gì Mới Tại Vet-Rate.org', ko: 'Vet-Rate.org의 새로운 기능' },
    version: { en: 'Version', es: 'Versión', tl: 'Bersyon', vi: 'Phiên Bản', ko: '버전' },
    freshIntel: { en: 'Fresh Intel', es: 'Información Fresca', tl: 'Bagong Intel', vi: 'Thông Tin Mới', ko: '새로운 정보' },
    justDeployed: { en: 'Just Deployed 🚀', es: '¡Recién Desplegado! 🚀', tl: 'Kakatapos Lang i-Deploy 🚀', vi: 'Vừa Triển Khai 🚀', ko: '방금 배포됨 🚀' },
    platformHighlights: { en: 'Platform Highlights', es: 'Aspectos Destacados de la Plataforma', tl: 'Mga Highlight ng Platform', vi: 'Điểm Nổi Bật Của Nền Tảng', ko: '플랫폼 하이라이트' },
    bugsSquashed: { en: 'Bugs Squashed 🪲💀', es: '¡Errores Eliminados! 🪲💀', tl: 'Mga Bug na Naayos 🪲💀', vi: 'Lỗi Đã Sửa 🪲💀', ko: '수정된 버그 🪲💀' },
    justFixed: { en: 'JUST FIXED', es: 'RECIÉN ARREGLADO', tl: 'KAKAAAYOS LANG', vi: 'VỪA SỬA', ko: '방금 수정됨' },
    noChangelog: { en: 'No changelog available for this version.', es: 'No hay registro de cambios disponible para esta versión.', tl: 'Walang changelog na available para sa bersyong ito.', vi: 'Không có nhật ký thay đổi cho phiên bản này.', ko: '이 버전에 대한 변경 로그가 없습니다.' },
    foundBug: { en: '🐛 Found a bug? Use the Bug Squasher in the footer to report it!', es: '🐛 ¿Encontraste un error? ¡Usa el Aplasta-Bugs en el pie de página para reportarlo!', tl: '🐛 May nakitang bug? Gamitin ang Bug Squasher sa footer para i-report!', vi: '🐛 Tìm thấy lỗi? Sử dụng Bug Squasher ở chân trang để báo cáo!', ko: '🐛 버그를 발견하셨나요? 푸터의 Bug Squasher를 사용하여 신고하세요!' },
    missionReadyTitle: { en: '💪 Mission Ready:', es: '💪 Listo para la Misión:', tl: '💪 Handa na sa Misyon:', vi: '💪 Sẵn Sàng Nhiệm Vụ:', ko: '💪 임무 준비 완료:' },
    missionReadyMessage: { en: 'Your app has been updated and is ready to continue serving you. All your saved data has been preserved.', es: 'Tu aplicación ha sido actualizada y está lista para seguir sirviéndote. Todos tus datos guardados han sido preservados.', tl: 'Ang app mo ay na-update na at handang magpatuloy sa pag-serve sa iyo. Lahat ng naka-save mong data ay napreserba.', vi: 'Ứng dụng của bạn đã được cập nhật và sẵn sàng tiếp tục phục vụ bạn. Tất cả dữ liệu đã lưu của bạn đã được bảo toàn.', ko: '앱이 업데이트되었으며 계속해서 서비스할 준비가 되었습니다. 저장된 모든 데이터가 보존되었습니다.' },
    rogerThat: { en: "Roger That, Let's Go! 🎯", es: '¡Entendido, Vamos! 🎯', tl: 'Sige, Tara Na! 🎯', vi: 'Đã Hiểu, Bắt Đầu Thôi! 🎯', ko: '알겠습니다, 시작합시다! 🎯' },
    labelNew: { en: '🆕 NEW', es: '🆕 NUEVO', tl: '🆕 BAGO', vi: '🆕 MỚI', ko: '🆕 새로운' },
    labelFeature: { en: 'Feature', es: 'Función', tl: 'Feature', vi: 'Tính Năng', ko: '기능' },
    labelBugFix: { en: 'Bug Fix', es: 'Corrección', tl: 'Bug Fix', vi: 'Sửa Lỗi', ko: '버그 수정' },
    labelSecurity: { en: 'Security', es: 'Seguridad', tl: 'Seguridad', vi: 'Bảo Mật', ko: '보안' },
    labelImprovement: { en: 'Improvement', es: 'Mejora', tl: 'Pagpapabuti', vi: 'Cải Tiến', ko: '개선' },
    labelChange: { en: 'Change', es: 'Cambio', tl: 'Pagbabago', vi: 'Thay Đổi', ko: '변경' },
    labelUpdate: { en: 'Update', es: 'Actualización', tl: 'Update', vi: 'Cập Nhật', ko: '업데이트' },
  },

  // Feature Request Component
  featureRequest: {
    // Header
    title: { en: 'Feature Request', es: 'Solicitud de Función', tl: 'Kahilingan ng Feature', vi: 'Yêu Cầu Tính Năng', ko: '기능 요청' },
    subtitle: { en: 'Share your ideas to make Vet-Rate.org better', es: 'Comparte tus ideas para mejorar Vet-Rate.org', tl: 'Ibahagi ang iyong mga ideya para mapabuti ang Vet-Rate.org', vi: 'Chia sẻ ý tưởng của bạn để cải thiện Vet-Rate.org', ko: 'Vet-Rate.org를 더 좋게 만들 아이디어를 공유하세요' },
    closeAriaLabel: { en: 'Close feature request', es: 'Cerrar solicitud de función', tl: 'Isara ang kahilingan ng feature', vi: 'Đóng yêu cầu tính năng', ko: '기능 요청 닫기' },
    
    // Step labels
    step1Label: { en: 'Category & Priority', es: 'Categoría y Prioridad', tl: 'Kategorya at Priyoridad', vi: 'Danh Mục & Ưu Tiên', ko: '카테고리 & 우선순위' },
    step2Label: { en: 'Your Idea', es: 'Tu Idea', tl: 'Ang Iyong Ideya', vi: 'Ý Tưởng Của Bạn', ko: '당신의 아이디어' },
    step3Label: { en: 'Review & Submit', es: 'Revisar y Enviar', tl: 'Suriin at Isumite', vi: 'Xem Lại & Gửi', ko: '검토 & 제출' },
    
    // Step 1 - Category & Priority
    ideasMatterTitle: { en: 'Your ideas matter!', es: '¡Tus ideas importan!', tl: 'Mahalaga ang mga ideya mo!', vi: 'Ý tưởng của bạn quan trọng!', ko: '당신의 아이디어가 중요합니다!' },
    ideasMatterText: { en: 'Every feature on Vet-Rate.org came from veteran feedback. Share your idea and help me build tools that make a difference.', es: 'Cada función en Vet-Rate.org provino de comentarios de veteranos. Comparte tu idea y ayúdame a construir herramientas que marquen la diferencia.', tl: 'Ang bawat feature sa Vet-Rate.org ay galing sa feedback ng mga beterano. Ibahagi ang iyong ideya at tulungan akong gumawa ng mga tool na may pagkakaiba.', vi: 'Mọi tính năng trên Vet-Rate.org đều đến từ phản hồi của cựu chiến binh. Chia sẻ ý tưởng của bạn và giúp tôi xây dựng công cụ tạo nên sự khác biệt.', ko: 'Vet-Rate.org의 모든 기능은 재향군인 피드백에서 비롯되었습니다. 아이디어를 공유하고 차이를 만드는 도구를 만드는 데 도움을 주세요.' },
    categoryLabel: { en: 'Feature Category', es: 'Categoría de Función', tl: 'Kategorya ng Feature', vi: 'Danh Mục Tính Năng', ko: '기능 카테고리' },
    selectCategoryPlaceholder: { en: 'Select a category...', es: 'Selecciona una categoría...', tl: 'Pumili ng kategorya...', vi: 'Chọn danh mục...', ko: '카테고리 선택...' },
    relatedModuleLabel: { en: 'Related Module (optional)', es: 'Módulo Relacionado (opcional)', tl: 'Kaugnay na Module (opsyonal)', vi: 'Module Liên Quan (tùy chọn)', ko: '관련 모듈 (선택사항)' },
    priorityLabel: { en: 'How important is this to you?', es: '¿Qué tan importante es esto para ti?', tl: 'Gaano kahalaga ito sa iyo?', vi: 'Điều này quan trọng với bạn như thế nào?', ko: '이것이 당신에게 얼마나 중요합니까?' },
    
    // Categories
    categoryNEW_TOOL: { en: 'New Tool/Feature', es: 'Nueva Herramienta/Función', tl: 'Bagong Tool/Feature', vi: 'Công Cụ/Tính Năng Mới', ko: '새 도구/기능' },
    categoryENHANCEMENT: { en: 'Improvement to Existing Tool', es: 'Mejora a Herramienta Existente', tl: 'Pagpapabuti sa Umiiral na Tool', vi: 'Cải Tiến Công Cụ Hiện Có', ko: '기존 도구 개선' },
    categoryUI_UX: { en: 'User Interface/Experience', es: 'Interfaz/Experiencia de Usuario', tl: 'Interface/Karanasan ng User', vi: 'Giao Diện/Trải Nghiệm Người Dùng', ko: '사용자 인터페이스/경험' },
    categoryACCESSIBILITY: { en: 'Accessibility', es: 'Accesibilidad', tl: 'Accessibility', vi: 'Khả Năng Tiếp Cận', ko: '접근성' },
    categoryINTEGRATION: { en: 'VA Integration/API', es: 'Integración VA/API', tl: 'VA Integration/API', vi: 'Tích Hợp VA/API', ko: 'VA 통합/API' },
    categoryMOBILE: { en: 'Mobile Experience', es: 'Experiencia Móvil', tl: 'Mobile Experience', vi: 'Trải Nghiệm Di Động', ko: '모바일 경험' },
    categoryDATA: { en: 'Data/Calculations', es: 'Datos/Cálculos', tl: 'Data/Calculations', vi: 'Dữ Liệu/Tính Toán', ko: '데이터/계산' },
    categoryDOCUMENTATION: { en: 'Documentation/Help', es: 'Documentación/Ayuda', tl: 'Documentation/Help', vi: 'Tài Liệu/Trợ Giúp', ko: '문서/도움말' },
    categoryOTHER: { en: 'Other', es: 'Otro', tl: 'Iba Pa', vi: 'Khác', ko: '기타' },
    
    // Modules
    moduleSEARCH: { en: 'Search / Condition Lookup', es: 'Búsqueda / Consulta de Condiciones', tl: 'Paghahanap / Condition Lookup', vi: 'Tìm Kiếm / Tra Cứu Tình Trạng', ko: '검색 / 상태 조회' },
    moduleCAP_SIMULATOR: { en: 'C&P Exam Simulator', es: 'Simulador de Examen C&P', tl: 'C&P Exam Simulator', vi: 'Mô Phỏng Khám C&P', ko: 'C&P 검사 시뮬레이터' },
    moduleNEXUS_BUILDER: { en: 'Nexus Letter Builder', es: 'Constructor de Carta Nexus', tl: 'Nexus Letter Builder', vi: 'Trình Tạo Thư Nexus', ko: '넥서스 레터 빌더' },
    moduleMY_PACKET: { en: 'My Packet', es: 'Mi Paquete', tl: 'Aking Packet', vi: 'Hồ Sơ Của Tôi', ko: '내 패킷' },
    moduleSECONDARY_SCOUT: { en: 'Secondary Scout', es: 'Scout Secundario', tl: 'Secondary Scout', vi: 'Secondary Scout', ko: '세컨더리 스카우트' },
    moduleTACTICAL_CALCULATOR: { en: 'Tactical Calculator', es: 'Calculadora Táctica', tl: 'Tactical Calculator', vi: 'Máy Tính Chiến Thuật', ko: '전술 계산기' },
    moduleCFILE_ANALYZER: { en: 'C-File Analyzer', es: 'Analizador C-File', tl: 'C-File Analyzer', vi: 'Phân Tích C-File', ko: 'C-File 분석기' },
    moduleFORMS_HELPER: { en: 'Forms Helper', es: 'Asistente de Formularios', tl: 'Forms Helper', vi: 'Trợ Giúp Biểu Mẫu', ko: '양식 도우미' },
    moduleVSO_FINDER: { en: 'VSO Finder', es: 'Buscador de VSO', tl: 'VSO Finder', vi: 'Tìm VSO', ko: 'VSO 찾기' },
    moduleGENERAL: { en: 'General / Site-wide', es: 'General / Todo el Sitio', tl: 'General / Buong Site', vi: 'Chung / Toàn Trang', ko: '일반 / 사이트 전체' },
    moduleOTHER: { en: 'Other', es: 'Otro', tl: 'Iba Pa', vi: 'Khác', ko: '기타' },
    
    // Priority levels
    priorityCRITICALLabel: { en: 'Critical Need', es: 'Necesidad Crítica', tl: 'Kritikal na Pangangailangan', vi: 'Nhu Cầu Cấp Thiết', ko: '긴급 필요' },
    priorityCRITICALDesc: { en: 'Missing feature blocking my claim process', es: 'Función faltante que bloquea mi proceso de reclamo', tl: 'Nawawalang feature na humaharang sa proseso ng claim ko', vi: 'Tính năng thiếu cản trở quy trình yêu cầu của tôi', ko: '청구 프로세스를 막는 기능 누락' },
    priorityHIGHLabel: { en: 'High Priority', es: 'Alta Prioridad', tl: 'Mataas na Priyoridad', vi: 'Ưu Tiên Cao', ko: '높은 우선순위' },
    priorityHIGHDesc: { en: 'Would significantly improve my workflow', es: 'Mejoraría significativamente mi flujo de trabajo', tl: 'Magpapabuti nang malaki sa workflow ko', vi: 'Sẽ cải thiện đáng kể quy trình làm việc của tôi', ko: '작업 흐름을 크게 개선할 것' },
    priorityMEDIUMLabel: { en: 'Medium Priority', es: 'Prioridad Media', tl: 'Katamtamang Priyoridad', vi: 'Ưu Tiên Trung Bình', ko: '중간 우선순위' },
    priorityMEDIUMDesc: { en: 'Nice to have, would make things easier', es: 'Sería bueno tenerlo, facilitaría las cosas', tl: 'Maganda kung meron, mapapadali ang mga bagay', vi: 'Có thì tốt, sẽ làm mọi thứ dễ dàng hơn', ko: '있으면 좋고, 일을 더 쉽게 만들 것' },
    priorityLOWLabel: { en: 'Low Priority', es: 'Baja Prioridad', tl: 'Mababang Priyoridad', vi: 'Ưu Tiên Thấp', ko: '낮은 우선순위' },
    priorityLOWDesc: { en: 'Idea for the future, no rush', es: 'Idea para el futuro, sin prisa', tl: 'Ideya para sa hinaharap, walang apura', vi: 'Ý tưởng cho tương lai, không gấp', ko: '미래를 위한 아이디어, 급하지 않음' },
    
    // Step 2 - Feature Details
    featureTitleLabel: { en: 'Feature Title', es: 'Título de la Función', tl: 'Pamagat ng Feature', vi: 'Tiêu Đề Tính Năng', ko: '기능 제목' },
    featureTitlePlaceholder: { en: 'Brief title for your feature idea...', es: 'Título breve para tu idea de función...', tl: 'Maikling pamagat para sa iyong ideya ng feature...', vi: 'Tiêu đề ngắn gọn cho ý tưởng tính năng của bạn...', ko: '기능 아이디어에 대한 간단한 제목...' },
    describeIdeaLabel: { en: 'Describe Your Idea', es: 'Describe Tu Idea', tl: 'Ilarawan ang Iyong Ideya', vi: 'Mô Tả Ý Tưởng Của Bạn', ko: '아이디어 설명' },
    describeIdeaPlaceholder: { en: 'Explain your feature idea in detail. What would it do? How would it work?', es: 'Explica tu idea de función en detalle. ¿Qué haría? ¿Cómo funcionaría?', tl: 'Ipaliwanag ang iyong ideya ng feature nang detalyado. Ano ang gagawin nito? Paano ito gagana?', vi: 'Giải thích chi tiết ý tưởng tính năng của bạn. Nó sẽ làm gì? Nó sẽ hoạt động như thế nào?', ko: '기능 아이디어를 자세히 설명하세요. 무엇을 할 것인가요? 어떻게 작동할까요?' },
    problemSolvedLabel: { en: 'What problem would this solve?', es: '¿Qué problema resolvería esto?', tl: 'Anong problema ang malulutas nito?', vi: 'Vấn đề này sẽ giải quyết điều gì?', ko: '이것이 어떤 문제를 해결할까요?' },
    problemSolvedPlaceholder: { en: 'What pain point or challenge would this feature address?', es: '¿Qué punto de dolor o desafío abordaría esta función?', tl: 'Anong pain point o hamon ang aayusin ng feature na ito?', vi: 'Tính năng này sẽ giải quyết điểm khó khăn hoặc thách thức nào?', ko: '이 기능이 어떤 어려움이나 과제를 해결할까요?' },
    proposedSolutionLabel: { en: 'Your Proposed Solution (optional)', es: 'Tu Solución Propuesta (opcional)', tl: 'Ang Iyong Iminumungkahing Solusyon (opsyonal)', vi: 'Giải Pháp Đề Xuất Của Bạn (tùy chọn)', ko: '제안하는 해결책 (선택사항)' },
    proposedSolutionPlaceholder: { en: 'If you have specific ideas for how this could be implemented...', es: 'Si tienes ideas específicas de cómo esto podría implementarse...', tl: 'Kung may mga specific na ideya ka kung paano ito maipapatupad...', vi: 'Nếu bạn có ý tưởng cụ thể về cách thực hiện...', ko: '구현 방법에 대한 구체적인 아이디어가 있다면...' },
    alternativesLabel: { en: "Alternatives You've Considered (optional)", es: 'Alternativas que Has Considerado (opcional)', tl: 'Mga Alternatibong Isinaalang-alang Mo (opsyonal)', vi: 'Các Phương Án Thay Thế Bạn Đã Cân Nhắc (tùy chọn)', ko: '고려한 대안 (선택사항)' },
    alternativesPlaceholder: { en: 'Have you tried any workarounds? What other solutions have you considered?', es: '¿Has probado alguna solución alternativa? ¿Qué otras soluciones has considerado?', tl: 'May sinubukan ka bang workaround? Anong iba pang solusyon ang isinaalang-alang mo?', vi: 'Bạn đã thử giải pháp tạm thời nào chưa? Bạn đã cân nhắc những giải pháp nào khác?', ko: '임시 해결책을 시도해 보셨나요? 어떤 다른 해결책을 고려하셨나요?' },
    additionalContextLabel: { en: 'Additional Context', es: 'Contexto Adicional', tl: 'Karagdagang Konteksto', vi: 'Ngữ Cảnh Bổ Sung', ko: '추가 맥락' },
    additionalContextPlaceholder: { en: 'Any other details, screenshots links, or examples that would help explain your idea?', es: '¿Algún otro detalle, enlaces de capturas de pantalla o ejemplos que ayuden a explicar tu idea?', tl: 'Anumang ibang detalye, screenshot links, o mga halimbawa na makakatulong ipaliwanag ang iyong ideya?', vi: 'Bất kỳ chi tiết, liên kết ảnh chụp màn hình hoặc ví dụ nào khác giúp giải thích ý tưởng của bạn?', ko: '아이디어 설명에 도움이 되는 기타 세부사항, 스크린샷 링크 또는 예시가 있나요?' },
    characters: { en: 'characters', es: 'caracteres', tl: 'mga karakter', vi: 'ký tự', ko: '문자' },
    minCharsRequired: { en: 'minimum characters required', es: 'caracteres mínimos requeridos', tl: 'minimum na karakter na kailangan', vi: 'số ký tự tối thiểu cần thiết', ko: '최소 필요 문자 수' },
    
    // Privacy & Tracking
    privacyTrackingTitle: { en: 'Privacy & Tracking Options', es: 'Opciones de Privacidad y Seguimiento', tl: 'Mga Opsyon sa Privacy at Tracking', vi: 'Tùy Chọn Quyền Riêng Tư & Theo Dõi', ko: '개인정보 보호 & 추적 옵션' },
    saveToMyTicketsLabel: { en: 'Save to My Tickets', es: 'Guardar en Mis Tickets', tl: 'I-save sa Aking Tickets', vi: 'Lưu vào Vé Của Tôi', ko: '내 티켓에 저장' },
    saveToMyTicketsDesc: { en: "Track this request in your My Packet. You'll be notified when it's implemented!", es: '¡Rastrea esta solicitud en tu Mi Paquete. Serás notificado cuando se implemente!', tl: "I-track ang kahilingang ito sa iyong My Packet. Maa-notify ka kapag naipatupad na!", vi: 'Theo dõi yêu cầu này trong Hồ Sơ Của Tôi. Bạn sẽ được thông báo khi nó được triển khai!', ko: '내 패킷에서 이 요청을 추적하세요. 구현되면 알림을 받습니다!' },
    emailOptionalLabel: { en: 'Email Address (Optional)', es: 'Dirección de Correo (Opcional)', tl: 'Email Address (Opsyonal)', vi: 'Địa Chỉ Email (Tùy Chọn)', ko: '이메일 주소 (선택사항)' },
    emailPrivacyNote: { en: "We respect your privacy. Leave blank to stay anonymous. Only fill this in if you'd like me to email you when the feature is added.", es: 'Respetamos tu privacidad. Déjalo en blanco para permanecer anónimo. Solo completa esto si deseas que te envíe un correo cuando se agregue la función.', tl: 'Nirerespeto namin ang iyong privacy. Iwanan itong blangko para manatiling anonymous. Punan lang ito kung gusto mong i-email ka kapag naidagdag na ang feature.', vi: 'Chúng tôi tôn trọng quyền riêng tư của bạn. Để trống nếu muốn ẩn danh. Chỉ điền nếu bạn muốn tôi gửi email khi tính năng được thêm.', ko: '우리는 귀하의 개인정보를 존중합니다. 익명으로 유지하려면 비워두세요. 기능이 추가될 때 이메일을 받고 싶으시면 입력하세요.' },
    emailInvalidError: { en: 'Please enter a valid email address (e.g., name@example.com)', es: 'Por favor ingresa una dirección de correo válida (ej., nombre@ejemplo.com)', tl: 'Mangyaring maglagay ng valid na email address (hal., pangalan@halimbawa.com)', vi: 'Vui lòng nhập địa chỉ email hợp lệ (vd., ten@example.com)', ko: '유효한 이메일 주소를 입력하세요 (예: name@example.com)' },
    
    // Step 3 - Review & Submit
    successTitle: { en: 'Request Saved Successfully!', es: '¡Solicitud Guardada con Éxito!', tl: 'Matagumpay na Na-save ang Kahilingan!', vi: 'Yêu Cầu Đã Được Lưu Thành Công!', ko: '요청이 성공적으로 저장되었습니다!' },
    successMessage: { en: 'Your feature request has been saved to My Tickets and the report is copied to your clipboard!', es: '¡Tu solicitud de función ha sido guardada en Mis Tickets y el reporte se ha copiado a tu portapapeles!', tl: 'Ang iyong kahilingan ng feature ay na-save sa My Tickets at ang report ay nakopya sa iyong clipboard!', vi: 'Yêu cầu tính năng của bạn đã được lưu vào Vé Của Tôi và báo cáo đã được sao chép vào clipboard!', ko: '기능 요청이 내 티켓에 저장되었고 보고서가 클립보드에 복사되었습니다!' },
    whatHappensNext: { en: 'What happens next:', es: 'Qué sucede después:', tl: 'Ano ang susunod na mangyayari:', vi: 'Điều gì xảy ra tiếp theo:', ko: '다음 단계:' },
    nextStepReview: { en: "I'll review your idea personally", es: 'Revisaré tu idea personalmente', tl: 'Personal kong susuriin ang iyong ideya', vi: 'Tôi sẽ xem xét ý tưởng của bạn cá nhân', ko: '아이디어를 직접 검토하겠습니다' },
    nextStepCheckTickets: { en: 'Check "My Tickets" in My Packet for status updates', es: 'Revisa "Mis Tickets" en Mi Paquete para actualizaciones de estado', tl: 'Tingnan ang "My Tickets" sa My Packet para sa status updates', vi: 'Kiểm tra "Vé Của Tôi" trong Hồ Sơ Của Tôi để cập nhật trạng thái', ko: '내 패킷의 "내 티켓"에서 상태 업데이트를 확인하세요' },
    nextStepEmailNotify: { en: "I'll email you when this feature is implemented", es: 'Te enviaré un correo cuando esta función sea implementada', tl: 'I-email kita kapag naipatupad na ang feature na ito', vi: 'Tôi sẽ gửi email cho bạn khi tính năng này được triển khai', ko: '이 기능이 구현되면 이메일로 알려드리겠습니다' },
    requestIdLabel: { en: 'Request ID', es: 'ID de Solicitud', tl: 'Request ID', vi: 'Mã Yêu Cầu', ko: '요청 ID' },
    savedToTicketsNote: { en: 'Saved to your My Tickets for tracking', es: 'Guardado en tus Mis Tickets para seguimiento', tl: 'Na-save sa iyong My Tickets para sa tracking', vi: 'Đã lưu vào Vé Của Tôi để theo dõi', ko: '추적을 위해 내 티켓에 저장됨' },
    requestReadyMessage: { en: 'Feature request ready! Review it below and click "Submit Request" to send it directly.', es: '¡Solicitud de función lista! Revísala abajo y haz clic en "Enviar Solicitud" para enviarla directamente.', tl: 'Handa na ang kahilingan ng feature! Suriin ito sa ibaba at i-click ang "Submit Request" para ipadala ito direkta.', vi: 'Yêu cầu tính năng đã sẵn sàng! Xem lại bên dưới và nhấp "Gửi Yêu Cầu" để gửi trực tiếp.', ko: '기능 요청이 준비되었습니다! 아래에서 검토하고 "요청 제출"을 클릭하여 직접 보내세요.' },
    copied: { en: 'Copied!', es: '¡Copiado!', tl: 'Nakopya!', vi: 'Đã Sao Chép!', ko: '복사됨!' },
    copy: { en: 'Copy', es: 'Copiar', tl: 'Kopyahin', vi: 'Sao Chép', ko: '복사' },
    submittingRequest: { en: 'Submitting Request...', es: 'Enviando Solicitud...', tl: 'Isinusumite ang Kahilingan...', vi: 'Đang Gửi Yêu Cầu...', ko: '요청 제출 중...' },
    submitRequestButton: { en: 'Submit Request', es: 'Enviar Solicitud', tl: 'Isumite ang Kahilingan', vi: 'Gửi Yêu Cầu', ko: '요청 제출' },
    sendDirectlyNote: { en: 'Sends directly to the developer - no email app needed!', es: '¡Se envía directamente al desarrollador - no se necesita aplicación de correo!', tl: 'Direktang ipinapadala sa developer - hindi kailangan ng email app!', vi: 'Gửi trực tiếp đến nhà phát triển - không cần ứng dụng email!', ko: '개발자에게 직접 전송 - 이메일 앱 필요 없음!' },
    generateRequestButton: { en: 'Generate Request', es: 'Generar Solicitud', tl: 'Gumawa ng Kahilingan', vi: 'Tạo Yêu Cầu', ko: '요청 생성' },
    doneButton: { en: 'Done', es: 'Hecho', tl: 'Tapos Na', vi: 'Xong', ko: '완료' },
    
    // Validation messages
    validationTitleAndDesc: { en: 'Title (5+ chars) and description (20+ chars) required', es: 'Se requiere título (5+ caracteres) y descripción (20+ caracteres)', tl: 'Kailangan ang pamagat (5+ karakter) at paglalarawan (20+ karakter)', vi: 'Cần tiêu đề (5+ ký tự) và mô tả (20+ ký tự)', ko: '제목(5자 이상)과 설명(20자 이상)이 필요합니다' },
    validationTitleOnly: { en: 'Title needs at least 5 characters', es: 'El título necesita al menos 5 caracteres', tl: 'Kailangan ng pamagat ng kahit 5 karakter', vi: 'Tiêu đề cần ít nhất 5 ký tự', ko: '제목은 최소 5자 이상이어야 합니다' },
    validationDescOnly: { en: 'Description needs at least 20 characters', es: 'La descripción necesita al menos 20 caracteres', tl: 'Kailangan ng paglalarawan ng kahit 20 karakter', vi: 'Mô tả cần ít nhất 20 ký tự', ko: '설명은 최소 20자 이상이어야 합니다' },
    validationEmailFix: { en: 'Fix email format to continue', es: 'Corrige el formato del correo para continuar', tl: 'Ayusin ang format ng email para magpatuloy', vi: 'Sửa định dạng email để tiếp tục', ko: '계속하려면 이메일 형식을 수정하세요' },
    
    // Error messages
    submitErrorMessage: { en: 'Could not send request. Your request was saved locally. The report is copied to your clipboard - you can email it manually to', es: 'No se pudo enviar la solicitud. Tu solicitud fue guardada localmente. El reporte se copió a tu portapapeles - puedes enviarlo por correo manualmente a', tl: 'Hindi maipadala ang kahilingan. Ang kahilingan mo ay na-save locally. Ang report ay nakopya sa iyong clipboard - maaari mo itong i-email nang mano-mano sa', vi: 'Không thể gửi yêu cầu. Yêu cầu của bạn đã được lưu cục bộ. Báo cáo đã được sao chép vào clipboard - bạn có thể gửi email thủ công đến', ko: '요청을 보낼 수 없습니다. 요청이 로컬에 저장되었습니다. 보고서가 클립보드에 복사되었습니다 - 수동으로 이메일을 보낼 수 있습니다' },
    
    // Report format strings
    notSpecified: { en: 'Not specified', es: 'No especificado', tl: 'Hindi tinukoy', vi: 'Không xác định', ko: '미지정' },
    noneMentioned: { en: 'None mentioned', es: 'Ninguno mencionado', tl: 'Walang nabanggit', vi: 'Không đề cập', ko: '언급 없음' },
    anonymousNoReply: { en: 'Anonymous (no reply requested)', es: 'Anónimo (sin respuesta solicitada)', tl: 'Anonymous (walang hinihinging tugon)', vi: 'Ẩn danh (không yêu cầu phản hồi)', ko: '익명 (답변 요청 없음)' },
    thankYouMessage: { en: 'Thank you for helping make Vet-Rate.org better for all veterans!', es: '¡Gracias por ayudar a mejorar Vet-Rate.org para todos los veteranos!', tl: 'Salamat sa pagtulong na mapabuti ang Vet-Rate.org para sa lahat ng beterano!', vi: 'Cảm ơn bạn đã giúp Vet-Rate.org tốt hơn cho tất cả cựu chiến binh!', ko: 'Vet-Rate.org를 모든 재향군인을 위해 더 좋게 만드는 데 도움을 주셔서 감사합니다!' },
  },

  // Bug Lookup Admin Interface
  bugLookup: {
    // Header
    title: { en: 'Bug Squasher - Admin Lookup', es: 'Aplasta-Bugs - Búsqueda Admin', tl: 'Bug Squasher - Admin Lookup', vi: 'Bug Squasher - Tra Cứu Admin', ko: '버그 스쿼셔 - 관리자 조회' },
    subtitle: { en: 'Search and manage bug reports', es: 'Buscar y gestionar reportes de bugs', tl: 'Maghanap at pamahalaan ang mga bug reports', vi: 'Tìm kiếm và quản lý báo cáo lỗi', ko: '버그 보고서 검색 및 관리' },
    
    // Status indicators
    dbOnline: { en: 'DB Online', es: 'BD En Línea', tl: 'DB Online', vi: 'DB Trực Tuyến', ko: 'DB 온라인' },
    fallbackMode: { en: 'Fallback Mode', es: 'Modo Alternativo', tl: 'Fallback Mode', vi: 'Chế Độ Dự Phòng', ko: '대체 모드' },
    exportAllReports: { en: 'Export All Reports', es: 'Exportar Todos los Reportes', tl: 'I-export Lahat ng Reports', vi: 'Xuất Tất Cả Báo Cáo', ko: '모든 보고서 내보내기' },
    
    // Search
    searchPlaceholder: { en: 'Enter Bug ID (e.g., BUG-MKNCUI1I) or search text...', es: 'Ingrese ID de Bug (ej., BUG-MKNCUI1I) o texto de búsqueda...', tl: 'Ilagay ang Bug ID (hal., BUG-MKNCUI1I) o search text...', vi: 'Nhập Bug ID (vd., BUG-MKNCUI1I) hoặc văn bản tìm kiếm...', ko: 'Bug ID 입력 (예: BUG-MKNCUI1I) 또는 검색 텍스트...' },
    
    // Filters
    filterStatus: { en: 'Status', es: 'Estado', tl: 'Status', vi: 'Trạng Thái', ko: '상태' },
    filterSeverity: { en: 'Severity', es: 'Severidad', tl: 'Severity', vi: 'Mức Độ', ko: '심각도' },
    applyFilters: { en: 'Apply Filters', es: 'Aplicar Filtros', tl: 'I-apply ang Filters', vi: 'Áp Dụng Bộ Lọc', ko: '필터 적용' },
    
    // Severity levels
    severityCritical: { en: 'Critical', es: 'Crítico', tl: 'Critical', vi: 'Nghiêm Trọng', ko: '치명적' },
    severityHigh: { en: 'High', es: 'Alto', tl: 'Mataas', vi: 'Cao', ko: '높음' },
    severityMedium: { en: 'Medium', es: 'Medio', tl: 'Katamtaman', vi: 'Trung Bình', ko: '중간' },
    severityLow: { en: 'Low', es: 'Bajo', tl: 'Mababa', vi: 'Thấp', ko: '낮음' },
    
    // Status labels
    statusResolved: { en: 'Resolved', es: 'Resuelto', tl: 'Naayos Na', vi: 'Đã Giải Quyết', ko: '해결됨' },
    statusUnresolved: { en: 'Unresolved', es: 'Sin Resolver', tl: 'Hindi Pa Naayos', vi: 'Chưa Giải Quyết', ko: '미해결' },
    statusOpen: { en: 'Open', es: 'Abierto', tl: 'Bukas', vi: 'Mở', ko: '열림' },
    
    // Statistics
    statsTotal: { en: 'Total', es: 'Total', tl: 'Kabuuan', vi: 'Tổng', ko: '전체' },
    statsUnresolved: { en: 'Unresolved', es: 'Sin Resolver', tl: 'Hindi Pa Naayos', vi: 'Chưa Giải Quyết', ko: '미해결' },
    statsCritical: { en: 'Critical', es: 'Crítico', tl: 'Critical', vi: 'Nghiêm Trọng', ko: '치명적' },
    statsLast24h: { en: 'Last 24h', es: 'Últimas 24h', tl: 'Huling 24h', vi: '24h Qua', ko: '최근 24시간' },
    
    // Empty states
    noReportsFound: { en: 'No bug reports found', es: 'No se encontraron reportes de bugs', tl: 'Walang nakitang bug reports', vi: 'Không tìm thấy báo cáo lỗi', ko: '버그 보고서가 없습니다' },
    reportsWillAppear: { en: 'Reports will appear here when users submit them', es: 'Los reportes aparecerán aquí cuando los usuarios los envíen', tl: 'Lalabas dito ang reports kapag nag-submit ang users', vi: 'Báo cáo sẽ xuất hiện ở đây khi người dùng gửi', ko: '사용자가 제출하면 보고서가 여기에 표시됩니다' },
    noReportsMatching: { en: 'No reports found matching', es: 'No se encontraron reportes que coincidan con', tl: 'Walang nakitang reports na tumutugma sa', vi: 'Không tìm thấy báo cáo phù hợp với', ko: '일치하는 보고서를 찾을 수 없음' },
    noDescription: { en: 'No description', es: 'Sin descripción', tl: 'Walang paglalarawan', vi: 'Không có mô tả', ko: '설명 없음' },
    noDescriptionProvided: { en: '(No description provided)', es: '(Sin descripción proporcionada)', tl: '(Walang paglalarawang ibinigay)', vi: '(Không có mô tả)', ko: '(설명이 제공되지 않음)' },
    
    // Detail view labels
    created: { en: 'Created', es: 'Creado', tl: 'Nilikha', vi: 'Đã Tạo', ko: '생성됨' },
    
    // Action buttons
    copyJson: { en: 'Copy JSON', es: 'Copiar JSON', tl: 'Kopyahin ang JSON', vi: 'Sao Chép JSON', ko: 'JSON 복사' },
    copied: { en: 'Copied!', es: '¡Copiado!', tl: 'Nakopya!', vi: 'Đã Sao Chép!', ko: '복사됨!' },
    markResolved: { en: 'Mark Resolved', es: 'Marcar Resuelto', tl: 'Markahan bilang Naayos', vi: 'Đánh Dấu Đã Giải Quyết', ko: '해결됨으로 표시' },
    
    // Resolve modal
    markAsResolved: { en: 'Mark as Resolved', es: 'Marcar como Resuelto', tl: 'Markahan bilang Naayos', vi: 'Đánh Dấu Đã Giải Quyết', ko: '해결됨으로 표시' },
    resolutionNotesLabel: { en: 'Resolution Notes', es: 'Notas de Resolución', tl: 'Resolution Notes', vi: 'Ghi Chú Giải Quyết', ko: '해결 메모' },
    resolutionNotesPlaceholder: { en: 'How was this bug fixed? (optional)', es: '¿Cómo se corrigió este bug? (opcional)', tl: 'Paano naayos ang bug na ito? (optional)', vi: 'Lỗi này được sửa như thế nào? (tùy chọn)', ko: '이 버그는 어떻게 수정되었나요? (선택사항)' },
    saving: { en: 'Saving...', es: 'Guardando...', tl: 'Sine-save...', vi: 'Đang Lưu...', ko: '저장 중...' },
    
    // Section titles
    sectionUserDescription: { en: 'User Description', es: 'Descripción del Usuario', tl: 'Paglalarawan ng User', vi: 'Mô Tả Người Dùng', ko: '사용자 설명' },
    sectionErrorMessage: { en: 'Error Message', es: 'Mensaje de Error', tl: 'Error Message', vi: 'Thông Báo Lỗi', ko: '오류 메시지' },
    sectionStackTrace: { en: 'Stack Trace', es: 'Stack Trace', tl: 'Stack Trace', vi: 'Stack Trace', ko: '스택 추적' },
    sectionStepsToReproduce: { en: 'Steps to Reproduce', es: 'Pasos para Reproducir', tl: 'Mga Hakbang para I-reproduce', vi: 'Các Bước Tái Tạo', ko: '재현 단계' },
    sectionClientEnvironment: { en: 'Client Environment', es: 'Entorno del Cliente', tl: 'Client Environment', vi: 'Môi Trường Khách', ko: '클라이언트 환경' },
    sectionResolutionNotes: { en: 'Resolution Notes', es: 'Notas de Resolución', tl: 'Resolution Notes', vi: 'Ghi Chú Giải Quyết', ko: '해결 메모' },
    sectionAuditLog: { en: 'Audit Log', es: 'Registro de Auditoría', tl: 'Audit Log', vi: 'Nhật Ký Kiểm Tra', ko: '감사 로그' },
    
    // Environment labels
    envBrowser: { en: 'Browser', es: 'Navegador', tl: 'Browser', vi: 'Trình Duyệt', ko: '브라우저' },
    envOS: { en: 'OS', es: 'SO', tl: 'OS', vi: 'HĐH', ko: 'OS' },
    envScreen: { en: 'Screen', es: 'Pantalla', tl: 'Screen', vi: 'Màn Hình', ko: '화면' },
    envWindow: { en: 'Window', es: 'Ventana', tl: 'Window', vi: 'Cửa Sổ', ko: '창' },
    
    // Audit log
    auditBy: { en: 'by', es: 'por', tl: 'ni', vi: 'bởi', ko: '작성자' },
    
    // Privacy section
    privacyProtected: { en: 'Privacy Protected', es: 'Privacidad Protegida', tl: 'Privacy Protected', vi: 'Bảo Vệ Quyền Riêng Tư', ko: '개인정보 보호됨' },
    privacyMessage: { en: 'This report was sanitized before storage. All PII (SSN, email, tokens) has been redacted. Viewing this log does not expose user data.', es: 'Este reporte fue sanitizado antes de almacenarse. Toda la información personal (SSN, email, tokens) ha sido eliminada. Ver este registro no expone datos del usuario.', tl: 'Ang report na ito ay na-sanitize bago i-store. Lahat ng PII (SSN, email, tokens) ay tinanggal. Ang pagtingin sa log na ito ay hindi nagpapakita ng user data.', vi: 'Báo cáo này đã được làm sạch trước khi lưu trữ. Tất cả PII (SSN, email, token) đã được biên tập. Xem nhật ký này không tiết lộ dữ liệu người dùng.', ko: '이 보고서는 저장 전에 정화되었습니다. 모든 PII(SSN, 이메일, 토큰)가 삭제되었습니다. 이 로그를 보는 것은 사용자 데이터를 노출하지 않습니다.' },
    sanitized: { en: 'Sanitized', es: 'Sanitizado', tl: 'Na-sanitize', vi: 'Đã Làm Sạch', ko: '정화됨' },
    
    // Error messages
    errorLoadReports: { en: 'Failed to load bug reports', es: 'Error al cargar reportes de bugs', tl: 'Nabigong i-load ang bug reports', vi: 'Không thể tải báo cáo lỗi', ko: '버그 보고서를 불러오지 못했습니다' },
    errorSearchFailed: { en: 'Search failed. Please try again.', es: 'Búsqueda fallida. Por favor intente de nuevo.', tl: 'Nabigo ang paghahanap. Pakisubukan ulit.', vi: 'Tìm kiếm thất bại. Vui lòng thử lại.', ko: '검색 실패. 다시 시도해 주세요.' },
    errorResolve: { en: 'Failed to mark as resolved', es: 'Error al marcar como resuelto', tl: 'Nabigong markahan bilang naayos', vi: 'Không thể đánh dấu đã giải quyết', ko: '해결됨으로 표시하지 못했습니다' },
    errorDelete: { en: 'Failed to delete report', es: 'Error al eliminar reporte', tl: 'Nabigong tanggalin ang report', vi: 'Không thể xóa báo cáo', ko: '보고서를 삭제하지 못했습니다' },
    errorExport: { en: 'Failed to export reports', es: 'Error al exportar reportes', tl: 'Nabigong i-export ang reports', vi: 'Không thể xuất báo cáo', ko: '보고서를 내보내지 못했습니다' },
    confirmDelete: { en: 'Are you sure you want to delete this bug report? This cannot be undone.', es: '¿Está seguro de que desea eliminar este reporte de bug? Esta acción no se puede deshacer.', tl: 'Sigurado ka bang gusto mong tanggalin ang bug report na ito? Hindi ito maaaring i-undo.', vi: 'Bạn có chắc chắn muốn xóa báo cáo lỗi này? Không thể hoàn tác.', ko: '이 버그 보고서를 삭제하시겠습니까? 되돌릴 수 없습니다.' },
  },

  // Contact Us Page
  contactUs: {
    title: { en: 'Contact Us', es: 'Contáctenos', tl: 'Makipag-ugnayan', vi: 'Liên Hệ', ko: '문의하기' },
    introText: { 
      en: "Have questions, feedback, or suggestions? I'd love to hear from you! Whether you've found an error, want to suggest a feature, or just want to say thanks, feel free to reach out.", 
      es: '¿Tiene preguntas, comentarios o sugerencias? ¡Me encantaría saber de usted! Ya sea que haya encontrado un error, quiera sugerir una función o simplemente quiera dar las gracias, no dude en comunicarse.', 
      tl: 'May mga tanong, feedback, o mungkahi? Gusto kong marinig mula sa iyo! Kung may nakita kang error, gusto mong magmungkahi ng feature, o gusto mo lang magpasalamat, huwag mag-atubiling makipag-ugnayan.', 
      vi: 'Có câu hỏi, phản hồi hoặc đề xuất? Tôi rất muốn nghe từ bạn! Dù bạn tìm thấy lỗi, muốn đề xuất tính năng, hay chỉ muốn nói lời cảm ơn, hãy liên hệ.', 
      ko: '질문, 피드백 또는 제안이 있으신가요? 여러분의 의견을 듣고 싶습니다! 오류를 발견하셨거나, 기능을 제안하고 싶거나, 감사 인사를 전하고 싶으시다면 언제든 연락해 주세요.' 
    },
    successTitle: { en: 'Your email client will open shortly!', es: '¡Su cliente de correo se abrirá en breve!', tl: 'Magbubukas ang iyong email client sa ilang sandali!', vi: 'Ứng dụng email của bạn sẽ mở ngay!', ko: '이메일 클라이언트가 곧 열립니다!' },
    successMessage: { en: "Thank you for reaching out. We'll get back to you as soon as possible.", es: 'Gracias por comunicarse. Le responderemos lo antes posible.', tl: 'Salamat sa pakikipag-ugnayan. Babalikan ka namin sa lalong madaling panahon.', vi: 'Cảm ơn bạn đã liên hệ. Chúng tôi sẽ phản hồi sớm nhất có thể.', ko: '연락해 주셔서 감사합니다. 최대한 빨리 답변 드리겠습니다.' },
    nameLabel: { en: 'Your Name', es: 'Su Nombre', tl: 'Iyong Pangalan', vi: 'Tên Của Bạn', ko: '이름' },
    namePlaceholder: { en: 'John Doe', es: 'Juan Pérez', tl: 'Juan dela Cruz', vi: 'Nguyễn Văn A', ko: '홍길동' },
    emailLabel: { en: 'Your Email', es: 'Su Correo Electrónico', tl: 'Iyong Email', vi: 'Email Của Bạn', ko: '이메일' },
    emailPlaceholder: { en: 'john.doe@example.com', es: 'juan.perez@ejemplo.com', tl: 'juan.delacruz@halimbawa.com', vi: 'nguyenvana@example.com', ko: 'example@email.com' },
    subjectLabel: { en: 'Subject', es: 'Asunto', tl: 'Paksa', vi: 'Chủ Đề', ko: '제목' },
    subjectPlaceholder: { en: 'Question about rating criteria', es: 'Pregunta sobre criterios de calificación', tl: 'Tanong tungkol sa rating criteria', vi: 'Câu hỏi về tiêu chí đánh giá', ko: '평가 기준에 대한 질문' },
    messageLabel: { en: 'Message', es: 'Mensaje', tl: 'Mensahe', vi: 'Tin Nhắn', ko: '메시지' },
    messagePlaceholder: { en: "Tell us what's on your mind...", es: 'Cuéntenos lo que piensa...', tl: 'Sabihin mo sa amin kung ano ang nasa isip mo...', vi: 'Hãy cho chúng tôi biết suy nghĩ của bạn...', ko: '궁금한 점을 알려주세요...' },
    noteLabel: { en: 'Note', es: 'Nota', tl: 'Paalala', vi: 'Lưu ý', ko: '참고' },
    noteText: { en: 'This will open your default email client. If you prefer, you can email us directly at', es: 'Esto abrirá su cliente de correo predeterminado. Si lo prefiere, puede enviarnos un correo directamente a', tl: 'Ito ay magbubukas ng iyong default na email client. Kung gusto mo, maaari kang mag-email sa amin direkta sa', vi: 'Điều này sẽ mở ứng dụng email mặc định của bạn. Nếu bạn muốn, bạn có thể gửi email trực tiếp cho chúng tôi tại', ko: '기본 이메일 클라이언트가 열립니다. 원하시면 다음 주소로 직접 이메일을 보내실 수 있습니다:' },
    sendButton: { en: 'Send Message', es: 'Enviar Mensaje', tl: 'Ipadala ang Mensahe', vi: 'Gửi Tin Nhắn', ko: '메시지 보내기' },
    otherWaysTitle: { en: 'Other Ways to Connect', es: 'Otras Formas de Conectarse', tl: 'Iba Pang Paraan para Makipag-ugnayan', vi: 'Các Cách Liên Hệ Khác', ko: '다른 연락 방법' },
    githubLabel: { en: 'GitHub', es: 'GitHub', tl: 'GitHub', vi: 'GitHub', ko: 'GitHub' },
    reportIssueLabel: { en: 'Report an Issue', es: 'Reportar un Problema', tl: 'Mag-ulat ng Isyu', vi: 'Báo Cáo Vấn Đề', ko: '문제 신고' },
    reportIssueText: { en: 'Found a bug? Open an issue on our', es: '¿Encontró un error? Abra un problema en nuestra', tl: 'May nakitang bug? Mag-bukas ng isyu sa aming', vi: 'Tìm thấy lỗi? Mở một vấn đề trên', ko: '버그를 발견하셨나요? 다음에서 이슈를 열어주세요:' },
    githubIssuesPage: { en: 'GitHub Issues page', es: 'página de Issues de GitHub', tl: 'GitHub Issues page', vi: 'trang GitHub Issues', ko: 'GitHub Issues 페이지' },
    faqTitle: { en: 'Frequently Asked Questions', es: 'Preguntas Frecuentes', tl: 'Mga Madalas na Tanong', vi: 'Câu Hỏi Thường Gặp', ko: '자주 묻는 질문' },
    faq1Question: { en: 'Q: Is this an official VA website?', es: 'P: ¿Es este un sitio web oficial del VA?', tl: 'T: Ito ba ay opisyal na website ng VA?', vi: 'H: Đây có phải là trang web chính thức của VA không?', ko: 'Q: 이것은 공식 VA 웹사이트인가요?' },
    faq1Answer: { en: 'No, Vet-Rate.org is an independent educational tool created by a service-connected disabled veteran. This site is not affiliated with the U.S. Department of Veterans Affairs.', es: 'No, Vet-Rate.org es una herramienta educativa independiente creada por un veterano discapacitado conectado al servicio. Este sitio no está afiliado con el Departamento de Asuntos de Veteranos de EE.UU.', tl: 'Hindi, ang Vet-Rate.org ay isang independyenteng educational tool na nilikha ng isang service-connected disabled veteran. Ang site na ito ay hindi kaanib ng U.S. Department of Veterans Affairs.', vi: 'Không, Vet-Rate.org là một công cụ giáo dục độc lập được tạo bởi một cựu chiến binh khuyết tật liên quan đến dịch vụ. Trang web này không liên kết với Bộ Cựu chiến binh Hoa Kỳ.', ko: '아니요, Vet-Rate.org는 복무 관련 장애 재향군인이 만든 독립적인 교육 도구입니다. 이 사이트는 미국 재향군인부와 관련이 없습니다.' },
    faq2Question: { en: 'Q: Do you provide legal or medical advice?', es: 'P: ¿Proporcionan asesoramiento legal o médico?', tl: 'T: Nagbibigay ba kayo ng legal o medikal na payo?', vi: 'H: Bạn có cung cấp tư vấn pháp lý hoặc y tế không?', ko: 'Q: 법률 또는 의료 조언을 제공하나요?' },
    faq2Answer: { en: 'No, this tool is for educational purposes only. Please consult qualified professionals for advice specific to your situation.', es: 'No, esta herramienta es solo para fines educativos. Consulte a profesionales calificados para obtener asesoramiento específico para su situación.', tl: 'Hindi, ang tool na ito ay para lamang sa educational purposes. Mangyaring kumonsulta sa mga kwalipikadong propesyonal para sa payo na specific sa iyong sitwasyon.', vi: 'Không, công cụ này chỉ dành cho mục đích giáo dục. Vui lòng tham khảo ý kiến của các chuyên gia có trình độ để được tư vấn cụ thể cho tình huống của bạn.', ko: '아니요, 이 도구는 교육 목적으로만 사용됩니다. 귀하의 상황에 맞는 조언은 자격을 갖춘 전문가와 상담하세요.' },
    faq3Question: { en: 'Q: How can I support this project?', es: 'P: ¿Cómo puedo apoyar este proyecto?', tl: 'T: Paano ko masusuportahan ang proyektong ito?', vi: 'H: Tôi có thể hỗ trợ dự án này như thế nào?', ko: 'Q: 이 프로젝트를 어떻게 지원할 수 있나요?' },
    faq3Answer: { en: 'Share it with fellow veterans! You can also support this project by donating via Buy Me a Coffee or simply by using the tool and providing feedback.', es: '¡Compártalo con otros veteranos! También puede apoyar este proyecto donando a través de Buy Me a Coffee o simplemente usando la herramienta y proporcionando comentarios.', tl: 'I-share ito sa mga kapwa beterano! Maaari mo ring suportahan ang proyektong ito sa pamamagitan ng pag-donate sa Buy Me a Coffee o simpleng paggamit ng tool at pagbibigay ng feedback.', vi: 'Chia sẻ với những cựu chiến binh khác! Bạn cũng có thể hỗ trợ dự án này bằng cách quyên góp qua Buy Me a Coffee hoặc đơn giản là sử dụng công cụ và cung cấp phản hồi.', ko: '동료 재향군인들과 공유하세요! Buy Me a Coffee를 통해 기부하거나 도구를 사용하고 피드백을 제공하여 이 프로젝트를 지원할 수도 있습니다.' },
  },

  // Privacy Policy Page
  privacyPolicy: {
    title: { en: '🔒 Privacy Policy', es: '🔒 Política de Privacidad', tl: '🔒 Patakaran sa Privacy', vi: '🔒 Chính Sách Quyền Riêng Tư', ko: '🔒 개인정보 처리방침' },
    lastUpdated: { en: 'Last Updated:', es: 'Última Actualización:', tl: 'Huling Na-update:', vi: 'Cập Nhật Lần Cuối:', ko: '최종 업데이트:' },
    closeButton: { en: 'Close', es: 'Cerrar', tl: 'Isara', vi: 'Đóng', ko: '닫기' },
    closeAriaLabel: { en: 'Close', es: 'Cerrar', tl: 'Isara', vi: 'Đóng', ko: '닫기' },
    
    // Section 1: Introduction
    section1Title: { en: '1. Introduction', es: '1. Introducción', tl: '1. Panimula', vi: '1. Giới Thiệu', ko: '1. 소개' },
    section1Text: { 
      en: "Welcome to Vet-Rate.org. I'm a service-connected disabled veteran who built this site to help fellow veterans navigate the VA disability rating process. This Privacy Policy explains how information is handled when you visit this website. By using this site, you agree to the practices described in this policy.",
      es: 'Bienvenido a Vet-Rate.org. Soy un veterano discapacitado conectado al servicio que construyó este sitio para ayudar a otros veteranos a navegar el proceso de calificación de discapacidad del VA. Esta Política de Privacidad explica cómo se maneja la información cuando visitas este sitio web. Al usar este sitio, aceptas las prácticas descritas en esta política.',
      tl: 'Maligayang pagdating sa Vet-Rate.org. Ako ay isang service-connected disabled veteran na gumawa ng site na ito para tulungan ang mga kapwa beterano na mag-navigate sa VA disability rating process. Ang Privacy Policy na ito ay nagpapaliwanag kung paano hinahandle ang impormasyon kapag binisita mo ang website na ito. Sa paggamit ng site na ito, sumasang-ayon ka sa mga kasanayan na inilarawan sa patakaran na ito.',
      vi: 'Chào mừng đến với Vet-Rate.org. Tôi là một cựu chiến binh khuyết tật liên quan đến dịch vụ đã xây dựng trang web này để giúp đồng đội cựu chiến binh điều hướng quy trình đánh giá khuyết tật VA. Chính sách Quyền riêng tư này giải thích cách thông tin được xử lý khi bạn truy cập trang web này. Bằng cách sử dụng trang web này, bạn đồng ý với các thực hành được mô tả trong chính sách này.',
      ko: 'Vet-Rate.org에 오신 것을 환영합니다. 저는 동료 재향군인들이 VA 장애 등급 절차를 탐색할 수 있도록 이 사이트를 구축한 복무 관련 장애 재향군인입니다. 이 개인정보 처리방침은 이 웹사이트를 방문할 때 정보가 어떻게 처리되는지 설명합니다. 이 사이트를 사용함으로써 이 정책에 설명된 관행에 동의하는 것입니다.'
    },
    
    // Section 2: Information Collection
    section2Title: { en: '2. Information Collection', es: '2. Recopilación de Información', tl: '2. Pagkolekta ng Impormasyon', vi: '2. Thu Thập Thông Tin', ko: '2. 정보 수집' },
    section2_1Title: { en: '2.1 Personal Information', es: '2.1 Información Personal', tl: '2.1 Personal na Impormasyon', vi: '2.1 Thông Tin Cá Nhân', ko: '2.1 개인 정보' },
    section2_1Text: { 
      en: 'This site does NOT collect Personally Identifiable Information (PII). The application operates entirely client-side in your browser. No data is stored, transmitted, or processed including:',
      es: 'Este sitio NO recopila Información de Identificación Personal (PII). La aplicación opera completamente del lado del cliente en tu navegador. No se almacena, transmite ni procesa ningún dato, incluyendo:',
      tl: 'Ang site na ito ay HINDI nangongolekta ng Personally Identifiable Information (PII). Ang application ay gumagana entirely client-side sa browser mo. Walang data na sine-store, transmit, o process kabilang ang:',
      vi: 'Trang web này KHÔNG thu thập Thông tin Nhận dạng Cá nhân (PII). Ứng dụng hoạt động hoàn toàn phía máy khách trong trình duyệt của bạn. Không có dữ liệu nào được lưu trữ, truyền hoặc xử lý bao gồm:',
      ko: '이 사이트는 개인 식별 정보(PII)를 수집하지 않습니다. 애플리케이션은 브라우저에서 완전히 클라이언트 측에서 작동합니다. 다음을 포함하여 데이터가 저장, 전송 또는 처리되지 않습니다:'
    },
    piiItem1: { en: 'Names, addresses, or contact information', es: 'Nombres, direcciones o información de contacto', tl: 'Mga pangalan, address, o contact information', vi: 'Tên, địa chỉ hoặc thông tin liên lạc', ko: '이름, 주소 또는 연락처 정보' },
    piiItem2: { en: 'Social Security Numbers or military service records', es: 'Números de Seguro Social o registros de servicio militar', tl: 'Social Security Numbers o military service records', vi: 'Số An sinh Xã hội hoặc hồ sơ quân ngũ', ko: '사회보장번호 또는 군 복무 기록' },
    piiItem3: { en: 'Medical information or disability details', es: 'Información médica o detalles de discapacidad', tl: 'Medical information o disability details', vi: 'Thông tin y tế hoặc chi tiết khuyết tật', ko: '의료 정보 또는 장애 세부 정보' },
    piiItem4: { en: 'Search queries or browsing history', es: 'Consultas de búsqueda o historial de navegación', tl: 'Search queries o browsing history', vi: 'Truy vấn tìm kiếm hoặc lịch sử duyệt web', ko: '검색 쿼리 또는 검색 기록' },
    
    // Section 2.2: Analytics
    section2_2Title: { en: '2.2 Minimal Analytics (GoatCounter)', es: '2.2 Analíticas Mínimas (GoatCounter)', tl: '2.2 Minimal Analytics (GoatCounter)', vi: '2.2 Phân Tích Tối Thiểu (GoatCounter)', ko: '2.2 최소 분석 (GoatCounter)' },
    analyticsTransparency: { en: 'Transparency:', es: 'Transparencia:', tl: 'Transparency:', vi: 'Minh Bạch:', ko: '투명성:' },
    analyticsIntro: { 
      en: 'We use GoatCounter, a privacy-respecting, open-source analytics tool to understand basic site usage.',
      es: 'Usamos GoatCounter, una herramienta de análisis de código abierto que respeta la privacidad para entender el uso básico del sitio.',
      tl: 'Gumagamit kami ng GoatCounter, isang privacy-respecting, open-source analytics tool para maintindihan ang basic na paggamit ng site.',
      vi: 'Chúng tôi sử dụng GoatCounter, một công cụ phân tích mã nguồn mở tôn trọng quyền riêng tư để hiểu cách sử dụng trang web cơ bản.',
      ko: '기본적인 사이트 사용을 이해하기 위해 개인정보를 존중하는 오픈소스 분석 도구인 GoatCounter를 사용합니다.'
    },
    analyticsCollects: { en: 'What GoatCounter collects:', es: 'Qué recopila GoatCounter:', tl: 'Ano ang kinokolekta ng GoatCounter:', vi: 'GoatCounter thu thập gì:', ko: 'GoatCounter가 수집하는 것:' },
    analyticsItem1: { en: 'Page views (which pages are visited)', es: 'Vistas de página (qué páginas se visitan)', tl: 'Page views (anong mga page ang binisita)', vi: 'Lượt xem trang (trang nào được truy cập)', ko: '페이지 조회수 (어떤 페이지가 방문되었는지)' },
    analyticsItem2: { en: 'Referrer (how you found the site)', es: 'Referente (cómo encontraste el sitio)', tl: 'Referrer (paano mo nahanap ang site)', vi: 'Nguồn giới thiệu (cách bạn tìm thấy trang web)', ko: '리퍼러 (사이트를 어떻게 찾았는지)' },
    analyticsItem3: { en: 'Browser type and screen size (aggregated)', es: 'Tipo de navegador y tamaño de pantalla (agregado)', tl: 'Browser type at screen size (aggregated)', vi: 'Loại trình duyệt và kích thước màn hình (tổng hợp)', ko: '브라우저 유형 및 화면 크기 (집계)' },
    analyticsItem4: { en: 'Country-level location (no city or precise location)', es: 'Ubicación a nivel de país (sin ciudad ni ubicación precisa)', tl: 'Country-level location (walang city o precise location)', vi: 'Vị trí cấp quốc gia (không có thành phố hoặc vị trí chính xác)', ko: '국가 수준 위치 (도시 또는 정확한 위치 없음)' },
    analyticsNotCollect: { en: 'What GoatCounter does NOT collect:', es: 'Qué NO recopila GoatCounter:', tl: 'Ano ang HINDI kinokolekta ng GoatCounter:', vi: 'GoatCounter KHÔNG thu thập gì:', ko: 'GoatCounter가 수집하지 않는 것:' },
    analyticsNotItem1: { en: 'No cookies are used', es: 'No se usan cookies', tl: 'Walang cookies na ginagamit', vi: 'Không sử dụng cookie', ko: '쿠키 사용 안 함' },
    analyticsNotItem2: { en: 'No personal identifiers or fingerprinting', es: 'Sin identificadores personales ni fingerprinting', tl: 'Walang personal identifiers o fingerprinting', vi: 'Không có định danh cá nhân hoặc dấu vân tay', ko: '개인 식별자 또는 핑거프린팅 없음' },
    analyticsNotItem3: { en: 'No tracking across sites', es: 'Sin rastreo entre sitios', tl: 'Walang tracking across sites', vi: 'Không theo dõi qua các trang web', ko: '사이트 간 추적 없음' },
    analyticsNotItem4: { en: 'No IP address storage', es: 'Sin almacenamiento de direcciones IP', tl: 'Walang IP address storage', vi: 'Không lưu trữ địa chỉ IP', ko: 'IP 주소 저장 없음' },
    analyticsNotItem5: { en: 'No advertising profiles', es: 'Sin perfiles publicitarios', tl: 'Walang advertising profiles', vi: 'Không có hồ sơ quảng cáo', ko: '광고 프로필 없음' },
    analyticsGDPR: { en: 'GoatCounter is GDPR-compliant by design. You can read their privacy policy.', es: 'GoatCounter cumple con GDPR por diseño. Puedes leer su política de privacidad.', tl: 'Ang GoatCounter ay GDPR-compliant by design. Maaari mong basahin ang privacy policy nila.', vi: 'GoatCounter tuân thủ GDPR theo thiết kế. Bạn có thể đọc chính sách bảo mật của họ.', ko: 'GoatCounter는 설계상 GDPR을 준수합니다. 그들의 개인정보 처리방침을 읽을 수 있습니다.' },
    
    // Section 2.3: Hosting
    section2_3Title: { en: '2.3 Hosting Metrics (Render.com)', es: '2.3 Métricas de Alojamiento (Render.com)', tl: '2.3 Hosting Metrics (Render.com)', vi: '2.3 Số Liệu Lưu Trữ (Render.com)', ko: '2.3 호스팅 지표 (Render.com)' },
    section2_3Text: { 
      en: 'Our hosting provider (Render.com) collects standard server logs including IP addresses, timestamps, and request URLs. This is standard for all web hosting and is required for security and abuse prevention. These logs are not used for tracking or advertising.',
      es: 'Nuestro proveedor de alojamiento (Render.com) recopila registros de servidor estándar, incluyendo direcciones IP, marcas de tiempo y URLs de solicitud. Esto es estándar para todo el alojamiento web y es necesario para la seguridad y prevención de abuso. Estos registros no se utilizan para rastreo o publicidad.',
      tl: 'Ang hosting provider namin (Render.com) ay nangongolekta ng standard server logs kabilang ang IP addresses, timestamps, at request URLs. Ito ay standard para sa lahat ng web hosting at kinakailangan para sa security at abuse prevention. Ang mga log na ito ay hindi ginagamit para sa tracking o advertising.',
      vi: 'Nhà cung cấp lưu trữ của chúng tôi (Render.com) thu thập nhật ký máy chủ tiêu chuẩn bao gồm địa chỉ IP, dấu thời gian và URL yêu cầu. Điều này là tiêu chuẩn cho tất cả lưu trữ web và được yêu cầu để bảo mật và ngăn chặn lạm dụng. Những nhật ký này không được sử dụng để theo dõi hoặc quảng cáo.',
      ko: '호스팅 제공업체(Render.com)는 IP 주소, 타임스탬프 및 요청 URL을 포함한 표준 서버 로그를 수집합니다. 이것은 모든 웹 호스팅에 표준이며 보안 및 남용 방지에 필요합니다. 이러한 로그는 추적이나 광고에 사용되지 않습니다.'
    },
    
    // Section 2.4: No Advertising
    section2_4Title: { en: '2.4 No Advertising Networks', es: '2.4 Sin Redes Publicitarias', tl: '2.4 Walang Advertising Networks', vi: '2.4 Không Có Mạng Quảng Cáo', ko: '2.4 광고 네트워크 없음' },
    section2_4Text: { 
      en: 'This site does not use advertising networks or third-party trackers. To protect veteran privacy, I have intentionally avoided implementing any tracking technologies that could collect your personal data or create advertising profiles.',
      es: 'Este sitio no utiliza redes publicitarias ni rastreadores de terceros. Para proteger la privacidad de los veteranos, he evitado intencionalmente implementar cualquier tecnología de rastreo que pueda recopilar tus datos personales o crear perfiles publicitarios.',
      tl: 'Ang site na ito ay hindi gumagamit ng advertising networks o third-party trackers. Para protektahan ang privacy ng mga beterano, sinadya kong iwasan ang pag-implement ng anumang tracking technologies na maaaring mangolekta ng personal data mo o lumikha ng advertising profiles.',
      vi: 'Trang web này không sử dụng mạng quảng cáo hoặc trình theo dõi của bên thứ ba. Để bảo vệ quyền riêng tư của cựu chiến binh, tôi đã cố ý tránh triển khai bất kỳ công nghệ theo dõi nào có thể thu thập dữ liệu cá nhân của bạn hoặc tạo hồ sơ quảng cáo.',
      ko: '이 사이트는 광고 네트워크나 제3자 추적기를 사용하지 않습니다. 재향군인의 개인정보를 보호하기 위해 개인 데이터를 수집하거나 광고 프로필을 생성할 수 있는 추적 기술의 구현을 의도적으로 피했습니다.'
    },
    
    // Section 3: Cookies
    section3Title: { en: '3. Cookies and Tracking', es: '3. Cookies y Rastreo', tl: '3. Cookies at Tracking', vi: '3. Cookie và Theo Dõi', ko: '3. 쿠키 및 추적' },
    section3Text: { 
      en: 'This site does not use cookies for tracking or advertising purposes. Any cookies used are strictly for essential functionality (such as saving your preferences locally in your browser). No information is shared with third-party advertisers.',
      es: 'Este sitio no utiliza cookies con fines de rastreo o publicidad. Cualquier cookie utilizada es estrictamente para funcionalidad esencial (como guardar tus preferencias localmente en tu navegador). No se comparte información con anunciantes de terceros.',
      tl: 'Ang site na ito ay hindi gumagamit ng cookies para sa tracking o advertising purposes. Anumang cookies na ginagamit ay strictly para sa essential functionality (tulad ng pag-save ng preferences mo locally sa browser mo). Walang impormasyon na shine-share sa third-party advertisers.',
      vi: 'Trang web này không sử dụng cookie cho mục đích theo dõi hoặc quảng cáo. Bất kỳ cookie nào được sử dụng đều hoàn toàn dành cho chức năng thiết yếu (chẳng hạn như lưu tùy chọn của bạn cục bộ trong trình duyệt). Không có thông tin nào được chia sẻ với các nhà quảng cáo bên thứ ba.',
      ko: '이 사이트는 추적 또는 광고 목적으로 쿠키를 사용하지 않습니다. 사용되는 모든 쿠키는 필수 기능(예: 브라우저에 로컬로 기본 설정 저장)에만 사용됩니다. 제3자 광고주와 정보가 공유되지 않습니다.'
    },
    
    // Section 4: How Information Is Used
    section4Title: { en: '4. How Information Is Used', es: '4. Cómo Se Usa la Información', tl: '4. Paano Ginagamit ang Impormasyon', vi: '4. Thông Tin Được Sử Dụng Như Thế Nào', ko: '4. 정보 사용 방법' },
    section4Intro: { en: 'Since this site does not collect PII or use tracking technologies:', es: 'Dado que este sitio no recopila PII ni utiliza tecnologías de rastreo:', tl: 'Dahil ang site na ito ay hindi nangongolekta ng PII o gumagamit ng tracking technologies:', vi: 'Vì trang web này không thu thập PII hoặc sử dụng công nghệ theo dõi:', ko: '이 사이트는 PII를 수집하거나 추적 기술을 사용하지 않으므로:' },
    section4Item1: { en: 'Your search queries remain private in your browser', es: 'Tus consultas de búsqueda permanecen privadas en tu navegador', tl: 'Ang search queries mo ay nananatiling private sa browser mo', vi: 'Các truy vấn tìm kiếm của bạn vẫn riêng tư trong trình duyệt của bạn', ko: '검색 쿼리가 브라우저에서 비공개로 유지됩니다' },
    section4Item2: { en: 'Your disability research is never transmitted to any server', es: 'Tu investigación sobre discapacidad nunca se transmite a ningún servidor', tl: 'Ang disability research mo ay hindi kailanman nai-transmit sa anumang server', vi: 'Nghiên cứu về khuyết tật của bạn không bao giờ được truyền đến bất kỳ máy chủ nào', ko: '장애 연구가 어떤 서버로도 전송되지 않습니다' },
    section4Item3: { en: "Your \"My Packet\" saved items are stored only in your browser's local storage", es: 'Tus elementos guardados en "Mi Paquete" se almacenan solo en el almacenamiento local de tu navegador', tl: 'Ang mga naka-save na item sa "My Packet" mo ay naka-store lang sa local storage ng browser mo', vi: 'Các mục "Hồ Sơ Của Tôi" đã lưu của bạn chỉ được lưu trữ trong bộ nhớ cục bộ của trình duyệt', ko: '"내 패킷"에 저장된 항목은 브라우저의 로컬 저장소에만 저장됩니다' },
    section4Item4: { en: 'No advertising profiles are created about you', es: 'No se crean perfiles publicitarios sobre ti', tl: 'Walang advertising profiles na ginagawa tungkol sa iyo', vi: 'Không có hồ sơ quảng cáo nào được tạo về bạn', ko: '귀하에 대한 광고 프로필이 생성되지 않습니다' },
    
    // Section 5: Data Sharing
    section5Title: { en: '5. Data Sharing and Disclosure', es: '5. Compartir y Divulgación de Datos', tl: '5. Data Sharing at Disclosure', vi: '5. Chia Sẻ và Tiết Lộ Dữ Liệu', ko: '5. 데이터 공유 및 공개' },
    section5Text: { 
      en: 'Your personal information is never sold, traded, rented, or shared with anyone. Since no data is collected, there is nothing to share. Your privacy is protected by design.',
      es: 'Tu información personal nunca se vende, intercambia, alquila ni comparte con nadie. Como no se recopilan datos, no hay nada que compartir. Tu privacidad está protegida por diseño.',
      tl: 'Ang personal information mo ay hindi kailanman ibinebenta, itinatrade, pinapaupa, o shine-share sa kahit sino. Dahil walang data na kinokolekta, walang maiishe-share. Ang privacy mo ay protektado by design.',
      vi: 'Thông tin cá nhân của bạn không bao giờ được bán, trao đổi, cho thuê hoặc chia sẻ với bất kỳ ai. Vì không có dữ liệu nào được thu thập, nên không có gì để chia sẻ. Quyền riêng tư của bạn được bảo vệ theo thiết kế.',
      ko: '귀하의 개인 정보는 절대 판매, 거래, 임대 또는 누구와도 공유되지 않습니다. 데이터가 수집되지 않으므로 공유할 것이 없습니다. 귀하의 개인정보는 설계에 의해 보호됩니다.'
    },
    
    // Section 6: Your Privacy Rights
    section6Title: { en: '6. Your Privacy Rights', es: '6. Tus Derechos de Privacidad', tl: '6. Ang Privacy Rights Mo', vi: '6. Quyền Riêng Tư Của Bạn', ko: '6. 귀하의 개인정보 권리' },
    section6Intro: { en: 'Since this site does not collect personal data, your privacy is inherently protected. However, you always have the right to:', es: 'Dado que este sitio no recopila datos personales, tu privacidad está inherentemente protegida. Sin embargo, siempre tienes derecho a:', tl: 'Dahil ang site na ito ay hindi nangongolekta ng personal data, ang privacy mo ay inherently protected. Gayunpaman, lagi mong may karapatan na:', vi: 'Vì trang web này không thu thập dữ liệu cá nhân, quyền riêng tư của bạn được bảo vệ vốn có. Tuy nhiên, bạn luôn có quyền:', ko: '이 사이트는 개인 데이터를 수집하지 않으므로 귀하의 개인정보는 본질적으로 보호됩니다. 그러나 귀하는 항상 다음 권리가 있습니다:' },
    section6Item1Title: { en: 'Clear Local Storage:', es: 'Limpiar Almacenamiento Local:', tl: 'I-clear ang Local Storage:', vi: 'Xóa Bộ Nhớ Cục Bộ:', ko: '로컬 저장소 지우기:' },
    section6Item1Text: { en: 'Delete any locally saved preferences from your browser', es: 'Elimina cualquier preferencia guardada localmente de tu navegador', tl: 'Tanggalin ang anumang locally saved preferences mula sa browser mo', vi: 'Xóa bất kỳ tùy chọn đã lưu cục bộ nào khỏi trình duyệt của bạn', ko: '브라우저에서 로컬에 저장된 기본 설정을 삭제합니다' },
    section6Item2Title: { en: 'Browse Privately:', es: 'Navegar en Privado:', tl: 'Mag-browse ng Privately:', vi: 'Duyệt Web Riêng Tư:', ko: '비공개 브라우징:' },
    section6Item2Text: { en: "Use your browser's private/incognito mode", es: 'Usa el modo privado/incógnito de tu navegador', tl: 'Gamitin ang private/incognito mode ng browser mo', vi: 'Sử dụng chế độ riêng tư/ẩn danh của trình duyệt', ko: '브라우저의 비공개/시크릿 모드 사용' },
    section6Item3Title: { en: 'Contact Me:', es: 'Contáctame:', tl: 'Makipag-ugnayan sa Akin:', vi: 'Liên Hệ Với Tôi:', ko: '문의하기:' },
    section6Item3Text: { en: 'Ask questions about the privacy practices on this site', es: 'Haz preguntas sobre las prácticas de privacidad en este sitio', tl: 'Magtanong tungkol sa privacy practices sa site na ito', vi: 'Hỏi câu hỏi về các thực hành quyền riêng tư trên trang web này', ko: '이 사이트의 개인정보 관행에 대해 질문하기' },
    
    // Section 7: AI Processing
    section7Title: { en: '7. AI Processing & Data Retention', es: '7. Procesamiento de IA y Retención de Datos', tl: '7. AI Processing at Data Retention', vi: '7. Xử Lý AI & Lưu Giữ Dữ Liệu', ko: '7. AI 처리 및 데이터 보존' },
    section7OptionalAI: { en: 'Optional AI Features:', es: 'Funciones de IA Opcionales:', tl: 'Optional AI Features:', vi: 'Tính Năng AI Tùy Chọn:', ko: '선택적 AI 기능:' },
    section7OptionalAIText: { en: 'When you choose to use AI-powered features (such as statement enhancement), your text is processed by third-party AI providers (Google Gemini or Anthropic Claude).', es: 'Cuando eliges usar funciones impulsadas por IA (como mejora de declaraciones), tu texto es procesado por proveedores de IA de terceros (Google Gemini o Anthropic Claude).', tl: 'Kapag pinili mong gamitin ang AI-powered features (tulad ng statement enhancement), ang text mo ay processed ng third-party AI providers (Google Gemini o Anthropic Claude).', vi: 'Khi bạn chọn sử dụng các tính năng được hỗ trợ bởi AI (chẳng hạn như cải thiện tuyên bố), văn bản của bạn được xử lý bởi các nhà cung cấp AI bên thứ ba (Google Gemini hoặc Anthropic Claude).', ko: 'AI 기반 기능(예: 진술 개선)을 사용하기로 선택하면 텍스트가 제3자 AI 제공업체(Google Gemini 또는 Anthropic Claude)에 의해 처리됩니다.' },
    section7WhatThisMeans: { en: 'What This Means:', es: 'Qué Significa Esto:', tl: 'Ano ang Ibig Sabihin Nito:', vi: 'Điều Này Có Nghĩa Là:', ko: '이것이 의미하는 것:' },
    section7AIItem1: { en: 'Data is processed solely for text generation purposes', es: 'Los datos se procesan únicamente para fines de generación de texto', tl: 'Ang data ay processed solely para sa text generation purposes', vi: 'Dữ liệu chỉ được xử lý cho mục đích tạo văn bản', ko: '데이터는 텍스트 생성 목적으로만 처리됩니다' },
    section7AIItem2: { en: 'Vet-Rate.org does not store this data on our servers', es: 'Vet-Rate.org no almacena estos datos en nuestros servidores', tl: 'Ang Vet-Rate.org ay hindi nag-store ng data na ito sa servers namin', vi: 'Vet-Rate.org không lưu trữ dữ liệu này trên máy chủ của chúng tôi', ko: 'Vet-Rate.org는 이 데이터를 서버에 저장하지 않습니다' },
    section7AIItem3: { en: 'AI providers may process data according to their own policies', es: 'Los proveedores de IA pueden procesar datos según sus propias políticas', tl: 'Ang AI providers ay maaaring mag-process ng data ayon sa sarili nilang policies', vi: 'Các nhà cung cấp AI có thể xử lý dữ liệu theo chính sách riêng của họ', ko: 'AI 제공업체는 자체 정책에 따라 데이터를 처리할 수 있습니다' },
    section7AIItem4: { en: 'You control what information you send to AI features', es: 'Tú controlas qué información envías a las funciones de IA', tl: 'Ikaw ang nagko-control kung anong impormasyon ang ipinapadala mo sa AI features', vi: 'Bạn kiểm soát thông tin bạn gửi đến các tính năng AI', ko: '귀하가 AI 기능에 보내는 정보를 제어합니다' },
    section7TransparencyNote: { en: "Transparency: Before using AI features, please review Google's Gemini API Terms and Anthropic's Privacy Policy. We strive to use zero-retention settings where available.", es: 'Transparencia: Antes de usar las funciones de IA, revisa los Términos de la API de Gemini de Google y la Política de Privacidad de Anthropic. Nos esforzamos por usar configuraciones de cero retención donde estén disponibles.', tl: 'Transparency: Bago gamitin ang AI features, mangyaring suriin ang Google\'s Gemini API Terms at Anthropic\'s Privacy Policy. Sinisikap naming gamitin ang zero-retention settings kung available.', vi: 'Minh bạch: Trước khi sử dụng các tính năng AI, vui lòng xem lại Điều khoản API Gemini của Google và Chính sách Bảo mật của Anthropic. Chúng tôi cố gắng sử dụng cài đặt không lưu giữ nếu có sẵn.', ko: '투명성: AI 기능을 사용하기 전에 Google의 Gemini API 약관과 Anthropic의 개인정보 처리방침을 검토하세요. 가능한 경우 제로 보존 설정을 사용하려고 노력합니다.' },
    
    // Section 8: Children's Privacy
    section8Title: { en: "8. Children's Privacy", es: '8. Privacidad de los Niños', tl: '8. Privacy ng mga Bata', vi: '8. Quyền Riêng Tư Của Trẻ Em', ko: '8. 아동 개인정보 보호' },
    section8Text: { en: 'This website is not intended for children under the age of 13. No information is knowingly collected from children under 13. If you believe any such information has been inadvertently collected, please contact me immediately.', es: 'Este sitio web no está destinado a niños menores de 13 años. No se recopila información a sabiendas de niños menores de 13 años. Si crees que se ha recopilado inadvertidamente dicha información, contáctame de inmediato.', tl: 'Ang website na ito ay hindi para sa mga batang wala pang 13 taong gulang. Walang impormasyon na knowingly kinokolekta mula sa mga bata na wala pang 13. Kung naniniwala ka na may ganitong impormasyon na inadvertently nakolekta, mangyaring makipag-ugnayan sa akin agad.', vi: 'Trang web này không dành cho trẻ em dưới 13 tuổi. Không có thông tin nào được cố ý thu thập từ trẻ em dưới 13 tuổi. Nếu bạn tin rằng bất kỳ thông tin nào như vậy đã vô tình được thu thập, vui lòng liên hệ với tôi ngay lập tức.', ko: '이 웹사이트는 13세 미만의 어린이를 대상으로 하지 않습니다. 13세 미만의 어린이로부터 고의로 정보를 수집하지 않습니다. 이러한 정보가 실수로 수집되었다고 생각되면 즉시 연락해 주세요.' },
    
    // Section 9: Security
    section9Title: { en: '9. Security', es: '9. Seguridad', tl: '9. Seguridad', vi: '9. Bảo Mật', ko: '9. 보안' },
    section9Text: { en: 'This application operates entirely client-side and does not transmit or store PII. Your searches and interactions remain private on your device. We use only GoatCounter for minimal, privacy-respecting analytics. No advertising networks or invasive tracking services are used.', es: 'Esta aplicación opera completamente del lado del cliente y no transmite ni almacena PII. Tus búsquedas e interacciones permanecen privadas en tu dispositivo. Solo usamos GoatCounter para análisis mínimos que respetan la privacidad. No se utilizan redes publicitarias ni servicios de rastreo invasivos.', tl: 'Ang application na ito ay gumagana entirely client-side at hindi nag-transmit o nag-store ng PII. Ang searches at interactions mo ay nananatiling private sa device mo. Gumagamit lang kami ng GoatCounter para sa minimal, privacy-respecting analytics. Walang advertising networks o invasive tracking services na ginagamit.', vi: 'Ứng dụng này hoạt động hoàn toàn phía máy khách và không truyền hoặc lưu trữ PII. Các tìm kiếm và tương tác của bạn vẫn riêng tư trên thiết bị của bạn. Chúng tôi chỉ sử dụng GoatCounter cho phân tích tối thiểu, tôn trọng quyền riêng tư. Không sử dụng mạng quảng cáo hoặc dịch vụ theo dõi xâm phạm.', ko: '이 애플리케이션은 완전히 클라이언트 측에서 작동하며 PII를 전송하거나 저장하지 않습니다. 검색 및 상호작용은 기기에서 비공개로 유지됩니다. 최소한의 개인정보 보호 분석을 위해 GoatCounter만 사용합니다. 광고 네트워크나 침해적인 추적 서비스는 사용되지 않습니다.' },
    
    // Section 10: Changes
    section10Title: { en: '10. Changes to This Privacy Policy', es: '10. Cambios a Esta Política de Privacidad', tl: '10. Mga Pagbabago sa Privacy Policy na Ito', vi: '10. Thay Đổi Chính Sách Quyền Riêng Tư Này', ko: '10. 이 개인정보 처리방침의 변경' },
    section10Text: { en: 'This Privacy Policy may be updated from time to time. Changes will be posted on this page with an updated "Last Updated" date. Your continued use of the website after changes constitutes acceptance of the updated policy.', es: 'Esta Política de Privacidad puede actualizarse de vez en cuando. Los cambios se publicarán en esta página con una fecha de "Última Actualización" actualizada. Tu uso continuado del sitio web después de los cambios constituye la aceptación de la política actualizada.', tl: 'Ang Privacy Policy na ito ay maaaring i-update paminsan-minsan. Ang mga pagbabago ay ipo-post sa page na ito na may updated na "Huling Na-update" na petsa. Ang patuloy mong paggamit ng website pagkatapos ng mga pagbabago ay nangangahulugang pagtanggap sa updated policy.', vi: 'Chính sách Quyền riêng tư này có thể được cập nhật theo thời gian. Các thay đổi sẽ được đăng trên trang này với ngày "Cập nhật lần cuối" được cập nhật. Việc bạn tiếp tục sử dụng trang web sau khi thay đổi đồng nghĩa với việc chấp nhận chính sách cập nhật.', ko: '이 개인정보 처리방침은 수시로 업데이트될 수 있습니다. 변경 사항은 업데이트된 "최종 업데이트" 날짜와 함께 이 페이지에 게시됩니다. 변경 후 웹사이트를 계속 사용하면 업데이트된 정책에 동의하는 것입니다.' },
    
    // Section 11: Contact
    section11Title: { en: '11. Contact', es: '11. Contacto', tl: '11. Makipag-ugnayan', vi: '11. Liên Hệ', ko: '11. 연락처' },
    section11Text: { en: 'If you have questions about this Privacy Policy, please reach out via the Contact page.', es: 'Si tienes preguntas sobre esta Política de Privacidad, comunícate a través de la página de Contacto.', tl: 'Kung may mga tanong ka tungkol sa Privacy Policy na ito, mangyaring makipag-ugnayan sa pamamagitan ng Contact page.', vi: 'Nếu bạn có câu hỏi về Chính sách Quyền riêng tư này, vui lòng liên hệ qua trang Liên hệ.', ko: '이 개인정보 처리방침에 대한 질문이 있으시면 문의 페이지를 통해 연락해 주세요.' },
    
    // Privacy First Design Banner
    privacyFirstTitle: { en: '🛡️ Privacy-First Design:', es: '🛡️ Diseño con Privacidad Primero:', tl: '🛡️ Privacy-First Design:', vi: '🛡️ Thiết Kế Ưu Tiên Quyền Riêng Tư:', ko: '🛡️ 개인정보 보호 우선 설계:' },
    privacyFirstText: { en: 'Vet-Rate.org is built with veteran privacy as a top priority. This site does not collect, store, or transmit your personal information. We use only GoatCounter for minimal, cookie-free analytics. No advertising networks or invasive trackers are used. Your searches and disability research remain completely private.', es: 'Vet-Rate.org está construido con la privacidad del veterano como máxima prioridad. Este sitio no recopila, almacena ni transmite tu información personal. Solo usamos GoatCounter para análisis mínimos sin cookies. No se usan redes publicitarias ni rastreadores invasivos. Tus búsquedas e investigación sobre discapacidad permanecen completamente privadas.', tl: 'Ang Vet-Rate.org ay binuo na ang veteran privacy ang top priority. Ang site na ito ay hindi nangongolekta, nag-store, o nag-transmit ng personal information mo. Gumagamit lang kami ng GoatCounter para sa minimal, cookie-free analytics. Walang advertising networks o invasive trackers na ginagamit. Ang searches mo at disability research ay nananatiling completely private.', vi: 'Vet-Rate.org được xây dựng với quyền riêng tư của cựu chiến binh là ưu tiên hàng đầu. Trang web này không thu thập, lưu trữ hoặc truyền thông tin cá nhân của bạn. Chúng tôi chỉ sử dụng GoatCounter cho phân tích tối thiểu, không có cookie. Không sử dụng mạng quảng cáo hoặc trình theo dõi xâm phạm. Các tìm kiếm và nghiên cứu về khuyết tật của bạn vẫn hoàn toàn riêng tư.', ko: 'Vet-Rate.org는 재향군인의 개인정보 보호를 최우선으로 하여 구축되었습니다. 이 사이트는 개인 정보를 수집, 저장 또는 전송하지 않습니다. 최소한의 쿠키 없는 분석을 위해 GoatCounter만 사용합니다. 광고 네트워크나 침해적인 추적기는 사용되지 않습니다. 귀하의 검색 및 장애 연구는 완전히 비공개로 유지됩니다.' },
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
