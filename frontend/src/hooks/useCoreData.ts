import { useState, useEffect } from 'react';
import { api } from '../services/api';
import * as Epi from '../types/epi';

interface CoreDataState {
  summary: Epi.SummaryData | null;
  trends: Epi.TrendsData | null;
  virus: Epi.VirusData[] | null;
  laboratoryNetwork?: Epi.LaboratoryNetwork;
}

export function useCoreData(weeksWindow: string, lookback: string, virusDetail: string) {
  const [data, setData] = useState<CoreDataState | null>(null);
  const [status, setStatus] = useState('Conectando...');
  const [lastUpdate, setLastUpdate] = useState('--');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadCore() {
      try {
        setError('');
        setStatus('Carregando...');

        const [summary, trends, virus, lab] = await Promise.all([
          api.fetchSummary(),
          api.fetchTrends(weeksWindow, lookback),
          api.fetchVirus(virusDetail),
          api.fetchLaboratoryNetwork()
        ]);

        if (!active) return;
        
        setData({
          summary,
          trends,
          virus,
          laboratoryNetwork: lab
        });
        
        setStatus('Conectada');
        setLastUpdate(new Date().toLocaleString('pt-BR'));
      } catch (e) {
        if (!active) return;
        setStatus('Indisponível');
        setError('Falha ao consultar API');
      }
    }

    loadCore();
    return () => { active = false; };
  }, [weeksWindow, lookback, virusDetail]);

  return { data, setData, status, setStatus, lastUpdate, error, setError };
}
