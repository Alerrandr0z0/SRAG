export interface ChoroplethStyleInput {
  count: number;
  rangeMin: number;
  rangeMax: number;
  hoverValue: number | null;
  theme: 'light' | 'dark';
  colorForCount: string | null;
}

export function formatRangeValue(value: number): string {
  return value.toLocaleString('pt-BR');
}

export function getChoroplethStyle({
  count,
  rangeMin,
  rangeMax,
  hoverValue,
  theme,
  colorForCount,
}: ChoroplethStyleInput): {
  color: string;
  weight: number;
  fillColor: string;
  fillOpacity: number;
} {
  const inRange = count >= rangeMin && count <= rangeMax;
  const isHovered = hoverValue !== null && Math.abs(count - hoverValue) <= 1;
  const baseFill = colorForCount || (theme === 'dark' ? '#334155' : '#e2e8f0');

  return {
    color: isHovered ? '#0f172a' : theme === 'dark' ? '#f8fafc' : '#0f172a',
    weight: isHovered ? 2.4 : 0.5,
    fillColor: inRange ? baseFill : theme === 'dark' ? '#1e293b' : '#f1f5f9',
    fillOpacity: isHovered ? 1 : inRange ? 0.85 : 0.3,
  };
}
