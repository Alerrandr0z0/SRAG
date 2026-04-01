import React from "react";
import PiramideEtariaChart from "../charts/PiramideEtariaChart";
import SchoolingChart from "../charts/SchoolingChart";
import SymptomsSignatureGrid from "../charts/SymptomsSignatureGrid";
import VaccinationProfileChart from "../charts/VaccinationProfileChart";
import KaplanMeierChart from "../charts/KaplanMeierChart";
import AggregatedSwimmerPlot from "../charts/AggregatedSwimmerPlot";
import RiskFactorsChart from "../charts/RiskFactorsChart";
import * as Epi from "../../types/epi";

interface CitizenPanelProps {
  loading: boolean;
  pyramid: Epi.PyramidRow[];
  schooling: Epi.CitizenBootstrap["schooling_profile"];
  symptomsSignature: Epi.SymptomSignature | null;
  riskFactors: Epi.CitizenBootstrap["risk_factors_full"];
  vaccination: Epi.VaccinationProfile | null;
  survival: Epi.VaccineSurvival | null;
  timelineData: Epi.AggregatedTimeline[];
  swimmerVirus: "covid" | "gripe";
  setSwimmerVirus: (v: "covid" | "gripe") => void;
}

const CitizenPanel: React.FC<CitizenPanelProps> = ({
  loading,
  pyramid,
  schooling,
  symptomsSignature,
  riskFactors,
  vaccination,
  survival,
  timelineData,
  swimmerVirus,
  setSwimmerVirus,
}) => {
  return (
    <div className="stack">
      {loading && <p className="meta">Carregando dados filtrados...</p>}

      <div className="section-header">
        <h3>Pirâmide Etária</h3>
      </div>
      <div className="chart-wrap">
        <PiramideEtariaChart rows={pyramid} />
      </div>

      <h3>Escolaridade</h3>
      <div className="chart-wrap">
        <SchoolingChart data={schooling} />
      </div>

      <h3>Assinatura Clínica por Patógeno (Prevalência %)</h3>
      <div className="chart-wrap" style={{ height: "650px" }}>
        {symptomsSignature && (
          <SymptomsSignatureGrid signature={symptomsSignature} />
        )}
      </div>

      <h3>Fatores de risco</h3>
      <div className="chart-wrap">
        <RiskFactorsChart data={riskFactors} />
      </div>

      <h3>Perfil de Imunização</h3>
      <p className="meta">
        Comparação proporcional do esquema vacinal no grupo selecionado.
      </p>
      <div className="chart-wrap" style={{ height: "350px" }}>
        <VaccinationProfileChart vaccinationData={vaccination} />
      </div>

      <h3>Curva de Proteção Vacinal</h3>
      <div className="chart-wrap" style={{ height: "400px" }}>
        <KaplanMeierChart survivalData={survival} />
      </div>

      {/* Versão Simplificada do Swimmer Plot focada em Waning Immunity */}
      <div
        className="section-header"
        style={{
          marginTop: "30px",
          borderTop: "1px solid #f1f5f9",
          paddingTop: "20px",
        }}
      >
        <h3>Histórico Vacinal até o Adoecimento</h3>
        <div className="filters">
          <select
            value={swimmerVirus}
            onChange={(e) => setSwimmerVirus(e.target.value as any)}
            style={{ padding: "4px 8px", borderRadius: "6px" }}
          >
            <option value="covid">Visão COVID-19</option>
            <option value="gripe">Visão Influenza</option>
          </select>
        </div>
      </div>
      <p className="meta">
        Atraso médio (mediana) entre a última dose e o início dos sintomas para
        cada coorte.
      </p>
      <div style={{ marginTop: "10px" }}>
        <AggregatedSwimmerPlot data={timelineData} mode="simplified" />
      </div>
    </div>
  );
};

export default CitizenPanel;
