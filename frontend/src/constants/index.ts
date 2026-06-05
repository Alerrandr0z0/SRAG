export const COLORS = {
  PRIMARY: '#0f766e', // Teal 700
  SECONDARY: '#1d4ed8', // Blue 700
  ACCENT: '#b45309', // Amber 700
  SUCCESS: '#15803d', // Green 700
  DANGER: '#b91c1c', // Red 700
  WARNING: '#ca8a04', // Yellow 600
  MUTED: '#94a3b8', // Slate 400
  BACKGROUND: '#f8fafc',
  BORDER: '#e2e8f0',
  CHART: ['#0f766e', '#1d4ed8', '#b45309', '#047857', '#dc2626', '#94a3b8'],
  HEATMAP: ['#eff6ff', '#93c5fd', '#1d4ed8'],
};

export const API_ENDPOINTS = {
  SUMMARY: '/summary',
  TRENDS: '/trends',
  VIRUS: '/virus',
  TERRITORY_BOOTSTRAP: '/territory_bootstrap',
  UNITS: '/units',
  CLINICAL_FLOW: '/clinical_flow',
  HOSPITALIZATION_DURATION: '/hospitalization_duration',
  CITIZEN_BOOTSTRAP: '/citizen_bootstrap',
  VACCINATION_PROFILE: '/vaccination_profile',
  VACCINE_SURVIVAL: '/vaccine_survival',
  LABORATORY_NETWORK: '/laboratory_network',
  CONTEXT_TRENDS: '/context_trends',
  MACROSECTOR_HEATPOINTS: '/geo/macrosector_heatpoints',
  SEVERITY_KPIS: '/severity_kpis',
  SEASONAL_TRENDS: '/trends/seasonal',
  SEVERITY_PYRAMID: '/severity_pyramid',
  GRAVITY_CASCADE: '/gravity_cascade',
  HEATMAP_SE_AGE: '/trends/heatmap_se_age',
  COMORBIDITIES_TREEMAP: '/clinical/comorbidities_treemap',
  VENTILATORY_SUPPORT: '/trends/ventilatory_support',
};

export const CHART_DEFAULTS = {
  FONT_FAMILY: "'IBM Plex Sans', system-ui, sans-serif",
  ANIMATION_DURATION: 1000,
};
