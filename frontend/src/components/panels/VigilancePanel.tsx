import React from 'react';
import LabChart from '../charts/LabChart';
import * as Epi from '../../types/epi';

interface VigilancePanelProps {
  loading: boolean;
  kpis: { total: number; uti: string; death: string; next: string };
  laboratoryNetwork: Epi.LaboratoryNetwork | undefined;
}

const VigilancePanel: React.FC<VigilancePanelProps> = ({
  loading,
  kpis,
  laboratoryNetwork
}) => {
  return (
    <div className="stack">
      <h3>Painel de vigilância</h3>
      <ul className="list">
        <li><span>Total de casos</span><span>{kpis.total}</span></li>
        <li><span>Taxa UTI</span><span>{kpis.uti}</span></li>
        <li><span>Taxa de óbito</span><span>{kpis.death}</span></li>
        <li><span>Previsão próxima semana</span><span>{kpis.next}</span></li>
      </ul>
      
      {loading && <p className="meta">Carregando rede laboratorial...</p>}
      
      <h3>Rede laboratorial (top volume)</h3>
      <div className="chart-wrap">
        {laboratoryNetwork?.labs && <LabChart data={laboratoryNetwork.labs} />}
      </div>
      
      <ul className="list">
        <li>
          <span>Casos testados</span>
          <span>{laboratoryNetwork?.overall?.tested_cases || 0}</span>
        </li>
        <li>
          <span>Positividade geral</span>
          <span>{laboratoryNetwork?.overall?.positive_rate || 0}%</span>
        </li>
        <li>
          <span>Tempo mediano coleta-resultado</span>
          <span>{laboratoryNetwork?.overall?.median_turnaround_days || 0} dias</span>
        </li>
      </ul>
    </div>
  );
};

export default VigilancePanel;
