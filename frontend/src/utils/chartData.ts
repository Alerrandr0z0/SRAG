export function limitByWindow<T>(data: T[], weeksWindow: string, getLimit = Number.parseInt) {
  if (weeksWindow === '0') return data;
  const limit = getLimit(weeksWindow, 10);
  return data.slice(-limit);
}

export function topItems<T>(data: T[], limit = 10) {
  return data.slice(0, limit);
}

export function mapCounts<T extends { label: string; count: number }>(data: T[]) {
  return data.map((item) => ({ label: item.label, value: item.count }));
}

export function buildDonutItems<T extends { label: string; count: number }>(data: T[], colors: string[]) {
  return data.map((item, index) => ({
    value: item.count,
    name: item.label,
    color: colors[index % colors.length],
  }));
}

export function buildNotificationDelaySeries(
  data: Array<{ epi_week: string; median_delay: number; record_count: number }>,
  weeksWindow: string,
) {
  const filteredData = limitByWindow(data, weeksWindow);

  return {
    weeks: filteredData.map((d) => d.epi_week),
    delays: filteredData.map((d) => d.median_delay),
    counts: filteredData.map((d) => d.record_count),
  };
}

type TooltipPoint = { seriesName?: string; value?: number };

export function formatNotificationDelayTooltip(
  params: Array<{ name?: string } & TooltipPoint>,
) {
  const week = params[0]?.name ?? '';
  const count = params.find((p) => p.seriesName === 'Volume')?.value ?? 0;
  const delay = params.find((p) => p.seriesName === 'Mediana de Atraso')?.value ?? 0;

  return `Semana: <b>${week}</b><br/>Volume: <b>${count} notificações</b><br/>Mediana: <b>${delay} dias</b>`;
}
