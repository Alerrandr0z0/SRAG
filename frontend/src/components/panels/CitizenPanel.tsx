import React from "react";
import BarChart from "../charts/BarChart";
import MaternalOutcomeChart from "../charts/MaternalOutcomeChart";
import PiramideEtariaChart from "../charts/PiramideEtariaChart";
import SchoolingChart from "../charts/SchoolingChart";
import SymptomsSignatureGrid from "../charts/SymptomsSignatureGrid";
import RiskFactorsChart from "../charts/RiskFactorsChart";
import VaccinationProfileChart from "../charts/VaccinationProfileChart";
import KaplanMeierChart from "../charts/KaplanMeierChart";
import * as Epi from "../../types/epi";

interface CitizenPanelProps {
  loading: boolean;
  pyramid: Epi.PyramidRow[];
  schooling: Epi.CitizenBootstrap["schooling_profile"];
  symptomsSignature: Epi.SymptomSignature | null;
  riskFactors: Epi.CitizenBootstrap["risk_factors_full"];
  maternalProfile?: Epi.CitizenBootstrap["maternal_profile"] | null;
  vaccination: Epi.VaccinationProfile | null;
  survival: Epi.VaccineSurvival | null;
  genderFilter?: string[];
}

const CitizenPanel: React.FC<CitizenPanelProps> = ({
  loading,
  pyramid,
  schooling,
  symptomsSignature,
  riskFactors,
  maternalProfile,
  vaccination,
  survival,
  genderFilter = [],
}) => {
  const isOnlyMale = genderFilter.length === 1 && (genderFilter[0] === 'M' || genderFilter[0] === 'Masculino');

  return (
    <div className="stack">
      {loading && <p className="meta">Carregando dados demográficos...</p>}

      <div className="section-header">
        <h3>Distribuição Etária</h3>
      </div>
      <div style={{ width: "100%", minHeight: "400px" }}>
        <PiramideEtariaChart data={pyramid || []} />
      </div>

      {!isOnlyMale && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.3fr) minmax(240px, 0.7fr)",
            gap: "1rem",
            marginTop: "1.5rem",
          }}
        >
          <div className="panel" style={{ padding: "1rem" }}>
            <div className="section-header">
              <div>
                <h3 style={{ margin: 0 }}>Desfecho por Grupo Materno</h3>
                <p className="meta">Comparação de gravidade (Cura vs UTI vs Óbito) por perfil gestacional.</p>
              </div>
            </div>
            <div className="chart-wrap" style={{ height: "300px" }}>
              {maternalProfile?.maternal_outcomes ? (
                <MaternalOutcomeChart data={maternalProfile.maternal_outcomes} />
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                  <p>Sem dados de perfil materno.</p>
                </div>
              )}
            </div>
          </div>
          <div className="stack">
            <div className="kpi-grid" style={{ gridTemplateColumns: "1fr", gap: "0.75rem" }}>
              <article className="panel">
                <p>Gestantes (Total)</p>
                <h2 style={{ fontSize: '1.5rem' }}>{maternalProfile?.gestantes_total || 0}</h2>
              </article>
              <article className="panel">
                <p>Puérperas (Total)</p>
                <h2 style={{ fontSize: '1.5rem' }}>{maternalProfile?.puerperas_total || 0}</h2>
              </article>
            </div>
          </div>
        </div>
      )}

      {/* Grid Equitativo com Relevo para Escolaridade e Fatores de Risco */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "1.5rem",
          marginTop: "1.5rem",
        }}
      >
        <div
          style={{
            background: "#f8fafc",
            padding: "1.25rem",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
          }}
        >
          <h3
            style={{
              textAlign: "center",
              marginTop: 0,
              marginBottom: "1rem",
              fontSize: "14px",
              color: "#475569",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Escolaridade
          </h3>
          <div className="chart-wrap" style={{ height: "300px", marginTop: 0 }}>
            <SchoolingChart data={schooling || []} />
          </div>
        </div>
        <div
          style={{
            background: "#f8fafc",
            padding: "1.25rem",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
          }}
        >
          <h3
            style={{
              textAlign: "center",
              marginTop: 0,
              marginBottom: "1rem",
              fontSize: "14px",
              color: "#475569",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Fatores de Risco
          </h3>
          <div className="chart-wrap" style={{ height: "300px", marginTop: 0 }}>
            <RiskFactorsChart data={riskFactors || []} />
          </div>
        </div>
      </div>

      <h3 style={{ marginTop: "3rem" }}>Assinatura Clínica de Sintomas</h3>
      <div className="chart-wrap" style={{ height: "600px" }}>
        {symptomsSignature && (
          <SymptomsSignatureGrid signature={symptomsSignature} />
        )}
      </div>

      <h3 style={{ marginTop: "3rem" }}>Perfil de Imunização</h3>
      <div className="chart-wrap" style={{ height: "350px" }}>
        {vaccination && (
          <VaccinationProfileChart vaccinationData={vaccination} />
        )}
      </div>

      <h3 style={{ marginTop: "3rem" }}>Curva de Proteção Vacinal</h3>
      <div className="chart-wrap" style={{ height: "400px" }}>
        {survival && <KaplanMeierChart survivalData={survival} />}
      </div>
    </div>
  );
};

export default CitizenPanel;
