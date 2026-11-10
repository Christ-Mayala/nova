import type { Config } from 'tailwindcss';

/**
 * Design system « Notion » — palette neutre et sobre, en clair et en sombre.
 * Les couleurs pointent vers des variables CSS (voir globals.css) afin que le
 * thème (clair/sombre/système) et la police (défaut/serif/mono) définis dans les
 * paramètres de l'espace de travail s'appliquent instantanément à toute l'app.
 */
const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        fond: 'var(--fond)',
        'fond-secondaire': 'var(--fond-secondaire)',
        'fond-tertiaire': 'var(--fond-tertiaire)',
        barre: 'var(--fond-barre)',
        texte: 'var(--texte)',
        'texte-doux': 'var(--texte-doux)',
        'texte-faible': 'var(--texte-faible)',
        bordure: 'var(--bordure)',
        'bordure-forte': 'var(--bordure-forte)',
        accent: 'var(--accent)',
        'accent-doux': 'var(--accent-doux)',
        survol: 'var(--survol)',
        surbrillance: 'var(--surbrillance)',
      },
      fontFamily: {
        sans: ['var(--police-sans)'],
        serif: ['var(--police-serif)'],
        mono: ['var(--police-mono)'],
      },
      maxWidth: {
        contenu: '900px',
        'contenu-large': '1200px',
      },
      keyframes: {
        'apparition': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'glissement': {
          '0%': { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'zoom': {
          '0%': { opacity: '0', transform: 'scale(0.98)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        apparition: 'apparition 160ms ease-out',
        glissement: 'glissement 160ms ease-out',
        zoom: 'zoom 140ms ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
