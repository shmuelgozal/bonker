const STORAGE_KEY = 'bonker_standard_templates';

export type TemplateMap = Record<string, Record<string, number>>;

export const DEFAULT_TEMPLATES: TemplateMap = {
  'רכב סי': {
    'גומי': 40, 'תחמיש': 58, 'מטול לתאורה': 4, 'מטול גז': 28,
    'ספוג': 28, 'רימון הלם': 18, 'רימון גז': 8, 'רימון עשן': 1,
    'תופי': 1, 'רומה גומי': 1, 'רימון רסס': 8, 'לאו': 1,
  },
  'רכב חפ"ק': {
    'גומי': 40, 'תחמיש': 58, 'מטול לתאורה': 4, 'מטול גז': 28,
    'ספוג': 28, 'רימון הלם': 18, 'רימון גז': 8,
    'רומה גומי': 1, 'רימון רסס': 8, 'לאו': 2,
  },
  'רכב כיתת כוננות': {
    'גומי': 24, 'תחמיש': 58, 'מטול לתאורה': 10, 'מטול גז': 28,
    'ספוג': 28, 'רימון הלם': 18, 'רימון גז': 8, 'רימון עשן': 3,
    'תופי': 1, 'רומה גומי': 2, 'רימון רסס': 16, 'לאו': 2,
  },
  'פילבוקס': {
    'גומי': 48, 'תחמיש': 116, 'מטול לתאורה': 20, 'מטול גז': 56,
    'ספוג': 56, 'רימון הלם': 36, 'רימון גז': 16, 'רימון עשן': 3,
    'תופי': 2, 'רומה גומי': 2,
  },
};

export function getTemplates(): TemplateMap {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as TemplateMap;
  } catch { /* ignore */ }
  return structuredClone(DEFAULT_TEMPLATES);
}

export function saveTemplates(templates: TemplateMap): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}
