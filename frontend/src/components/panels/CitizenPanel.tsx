import React from "react";
import BarChart from "../charts/BarChart";
import MaternalOutcomeChart from "../charts/MaternalOutcomeChart";
import PiramideEtariaChart from "../charts/PiramideEtariaChart";
import SchoolingChart from "../charts/SchoolingChart";
import SymptomsSignatureGrid from "../charts/SymptomsSignatureGrid";
import VaccinationProfileChart from "../charts/VaccinationProfileChart";
import VigilanceDonutChart from "../charts/VigilanceDonutChart";
import KpiCard from "../ui/KpiCard";
import * as Epi from "../../types/epi";

interface CitizenPanelProps {
  loading: boolean;
  pyramid: Epi.PyramidRow[];
  schooling: Epi.CitizenBootstrap["schooling_profile"];
  occupation: Epi.CitizenBootstrap["occupation_profile"];
  animalContact: Epi.CitizenBootstrap["animal_contact"];
  symptomsSignature: Epi.SymptomSignature | null;
  riskFactors: Epi.CitizenBootstrap["risk_factors_full"];
  maternalProfile?: Epi.CitizenBootstrap["maternal_profile"] | null;
  vaccination: Epi.VaccinationProfile | null;
  genderFilter?: string[];
}

const CitizenPanel: React.FC<CitizenPanelProps> = ({
  loading,
  pyramid,
  schooling,
  occupation,
  animalContact,
  symptomsSignature,
  riskFactors,
  maternalProfile,
  vaccination,
  genderFilter = [],
}) => {
  const isOnlyMale = genderFilter.length === 1 && (genderFilter[0] === 'M' || genderFilter[0] === 'Masculino');

  // Logic to find the main manufacturer for the KPI
  const topManufacturer = vaccination?.manufacturers && vaccination.manufacturers.length > 0 
    ? vaccination.manufacturers.sort((a, b) => b.count - a.count)[0]
    : null;

  const topSchooling = [...schooling].sort((a, b) => b.count - a.count)[0]?.label || "N/A";
  
  // Risk factors use .factor instead of .label
  const topRisk = [...riskFactors].sort((a, b) => (b.count as number) - (a.count as number))[0]?.factor || "N/A";
  
  const sortedAnimalContact = [...animalContact].sort((a, b) => b.count - a.count);
  const topAnimal = sortedAnimalContact[0]?.label || "N/A";
  
  const noAnimalContactItem = animalContact.find(a => a.label === "Sem Contato");
  const totalAnimalContact = animalContact.reduce((acc, curr) => acc + curr.count, 0);
  const noAnimalPct = totalAnimalContact > 0 && noAnimalContactItem 
    ? ((noAnimalContactItem.count / totalAnimalContact) * 100).toFixed(1) + "%"
    : "0%";

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

      <div className="kpi-row" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "10px", marginTop: "1.5rem" }}>
        <article className="panel" style={{ background: 'var(--bg-status)', borderRadius: '12px', padding: '14px 16px', border: '1px solid var(--border-subtle)' }}>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', marginRight: '6px', background: '#1D9E75' }}></span>
            Principal espécie
          </p>
          <h2 style={{ fontSize: '22px', fontWeight: 500, color: 'var(--text-main)', margin: 0 }}>{topAnimal}</h2>
        </article>
        <article className="panel" style={{ background: 'var(--bg-status)', borderRadius: '12px', padding: '14px 16px', border: '1px solid var(--border-subtle)' }}>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', marginRight: '6px', background: '#378ADD' }}></span>
            Maior escolaridade
          </p>
          <h2 style={{ fontSize: '22px', fontWeight: 500, color: 'var(--text-main)', margin: 0 }}>{topSchooling}</h2>
        </article>
        <article className="panel" style={{ background: 'var(--bg-status)', borderRadius: '12px', padding: '14px 16px', border: '1px solid var(--border-subtle)' }}>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', marginRight: '6px', background: '#EF9F27' }}></span>
            Principal fator
          </p>
          <h2 style={{ fontSize: '22px', fontWeight: 500, color: 'var(--text-main)', margin: 0 }}>{topRisk}</h2>
        </article>
        <article className="panel" style={{ background: 'var(--bg-status)', borderRadius: '12px', padding: '14px 16px', border: '1px solid var(--border-subtle)' }}>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', marginRight: '6px', background: '#D85A30' }}></span>
            Sem contato animal
          </p>
          <h2 style={{ fontSize: '22px', fontWeight: 500, color: 'var(--text-main)', margin: 0 }}>{noAnimalPct}</h2>
        </article>
      </div>

      {/* GRÁFICOS DE VOLUME (BARRAS) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1.5rem",
          marginTop: "1.5rem",
        }}
      >
        <div className="panel" style={{ padding: "1.25rem" }}>
          <p className="chart-label" style={{ fontSize: "10px", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", margin: "0 0 16px" }}>Escolaridade</p>
          <div className="chart-wrap" style={{ height: "300px", marginTop: 0 }}>
            <SchoolingChart data={schooling || []} />
          </div>
        </div>

        <div className="panel" style={{ padding: "1.25rem" }}>
          <p className="chart-label" style={{ fontSize: "10px", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", margin: "0 0 16px" }}>Ocupação (Top 15)</p>
          <div className="chart-wrap" style={{ height: "300px", marginTop: 0 }}>
            <BarChart 
              labels={occupation.map(o => o.label)} 
              data={occupation.map(o => o.count)} 
              horizontal={true}
              color="#378ADD"
            />
          </div>
        </div>

        <div className="panel" style={{ padding: "1.25rem" }}>
          <p className="chart-label" style={{ fontSize: "10px", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", margin: "0 0 16px" }}>Fatores de Risco</p>
          <div className="chart-wrap" style={{ height: "300px", marginTop: 0 }}>
            <BarChart 
              labels={riskFactors.map(r => String(r.factor))} 
              data={riskFactors.map(r => Number(r.count))} 
              horizontal={true}
              color="#EF9F27"
            />
          </div>
        </div>

        <div className="panel" style={{ padding: "1.25rem" }}>
          <p className="chart-label" style={{ fontSize: "10px", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", margin: "0 0 16px" }}>Contato com Animais</p>
          <div className="chart-wrap" style={{ height: "300px", marginTop: 0 }}>
            <BarChart 
              labels={animalContact.map(a => a.label)} 
              data={animalContact.map(a => a.count)} 
              horizontal={true}
              color="#D85A30"
            />
          </div>
        </div>
      </div>

      {/* SEÇÃO DE DISTRIBUIÇÃO PROPORCIONAL (DONUTS) */}
      <section className="panel" style={{ marginTop: "1.5rem", padding: "1.5rem" }}>
        <p className="chart-label" style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-eyebrow)", marginBottom: "1.5rem", textAlign: 'center' }}>Distribuição Proporcional</p>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
          <div style={{ textAlign: 'center' }}>
            <p className="meta" style={{ marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-main)' }}>Escolaridade</p>
            <div style={{ height: '180px' }}>
              <VigilanceDonutChart title="" data={schooling || []} />
            </div>
          </div>
          
          <div style={{ textAlign: 'center' }}>
            <p className="meta" style={{ marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-main)' }}>Ocupação</p>
            <div style={{ height: '180px' }}>
              <VigilanceDonutChart title="" data={occupation || []} />
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <p className="meta" style={{ marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-main)' }}>Fatores de Risco</p>
            <div style={{ height: '180px' }}>
              <VigilanceDonutChart 
                title="" 
                data={riskFactors.map(r => ({ label: r.factor as string, count: r.count as number }))} 
              />
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <p className="meta" style={{ marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-main)' }}>Contato Animal</p>
            <div style={{ height: '180px' }}>
              <VigilanceDonutChart title="" data={animalContact || []} />
            </div>
          </div>
        </div>
      </section>

      <h3 style={{ marginTop: "3rem" }}>Assinatura Clínica de Sintomas</h3>
      <div className="chart-wrap" style={{ height: "600px" }}>
        {symptomsSignature && (
          <SymptomsSignatureGrid signature={symptomsSignature} />
        )}
      </div>

      {/* PAINEL DE POVOS E COMUNIDADES TRADICIONAIS (OCULTO POR BAIXO VOLUME)
      {traditionalCommunities && traditionalCommunities.length > 0 && (
        <section className="vigilance-block" style={{ marginTop: '3rem' }}>
          <h3 className="block-title">Povos e Comunidades Tradicionais</h3>
          <div className="vigilance-insight-grid" style={{ gridTemplateColumns: '1fr' }}>
            <article className="panel">
              <div className="chart-wrap" style={{ height: '300px' }}>
                <BarChart 
                  labels={traditionalCommunities.map(c => c.label)}
                  data={traditionalCommunities.map(c => c.count)}
                  horizontal={true}
                  color="#8b5cf6" 
                />
              </div>
            </article>
          </div>
        </section>
      )}
      */}

      {/* PAINEL DE IMUNIZAÇÃO REFORMULADO */}
      <section className="vigilance-block" style={{ marginTop: '3rem' }}>
        <h3 className="block-title">Perfil de Imunização</h3>
        <div className="vigilance-insight-grid" style={{ gridTemplateColumns: 'minmax(240px, 0.7fr) minmax(0, 1.3fr)' }}>
          <div className="stack" style={{ gap: '1rem' }}>
            <KpiCard 
              label="Fabricante Predominante" 
              value={topManufacturer ? topManufacturer.label.split('/')[0] : 'N/A'} 
              className="vigilance-metric vigilance-metric--teal" 
            />
            <article className="panel" style={{ padding: '1.25rem', flexGrow: 1 }}>
              <p className="eyebrow" style={{ marginBottom: '0.5rem' }}>Distribuição de Fabricantes</p>
              <div style={{ height: '200px' }}>
                <VigilanceDonutChart title="" data={vaccination?.manufacturers || []} />
              </div>
            </article>
          </div>
          <article className="panel" style={{ padding: '1.5rem' }}>
            <p className="eyebrow" style={{ marginBottom: '1rem' }}>Esquema por Campanha e Dose</p>
            <div className="chart-wrap" style={{ height: "300px" }}>
              {vaccination && (
                <VaccinationProfileChart vaccinationData={vaccination} />
              )}
            </div>
          </article>
        </div>
      </section>
    </div>
  );
};

export default CitizenPanel;
