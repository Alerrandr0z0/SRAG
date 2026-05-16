import React from 'react';
import * as Epi from '../../types/epi';

interface AuditPanelProps {
  loading: boolean;
  completeness: Epi.DataCompletenessGroup[];
}

const AuditPanel: React.FC<AuditPanelProps> = ({ loading, completeness }) => {
  if (loading) return <p className="meta">Carregando auditoria de completude...</p>;

  const getScoreColor = (score: number) => {
    if (score >= 90) return '#059669'; // Green 600
    if (score >= 70) return '#0f766e'; // Teal 700
    if (score >= 50) return '#d97706'; // Amber 600
    return '#dc2626'; // Red 600
  };

  return (
    <div className="stack" style={{ gap: '2rem' }}>
      <header>
        <h2 style={{ margin: 0 }}>Auditoria de Completude de Dados</h2>
        <p className="sub">Percentual de campos preenchidos e válidos (não ignorados) na base SIVEP-Gripe.</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {completeness.map((group) => (
          <article key={group.group} className="panel">
            <div className="section-header" style={{ marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{group.group}</h3>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  color: getScoreColor(group.overall_score)
                }}>
                  {group.overall_score}%
                </span>
                <p style={{ margin: 0, fontSize: '10px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700 }}>Média do Bloco</p>
              </div>
            </div>

            <div className="stack" style={{ gap: '1rem' }}>
              {group.fields.map((field) => (
                <div key={field.field}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}>
                    <span style={{ fontWeight: 600, color: '#475569' }}>{field.field}</span>
                    <span style={{ fontWeight: 700, color: getScoreColor(field.rate) }}>{field.rate}%</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${field.rate}%`,
                      height: '100%',
                      background: getScoreColor(field.rate),
                      borderRadius: '4px',
                      transition: 'width 1s ease-out'
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>

      <article className="panel" style={{ background: '#f8fafc', border: '1px dashed #cbd5e1' }}>
        <h4 style={{ margin: '0 0 0.5rem 0' }}>💡 Nota Metodológica</h4>
        <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.6 }}>
          A completude é calculada como a razão entre registros com valores válidos e o total de casos filtrados.
          Valores como "Ignorado" (geralmente código 9), strings vazias ou nulos são considerados dados incompletos.
          Uma alta completude (acima de 90%) é essencial para análises epidemiológicas confiáveis.
        </p>
      </article>
    </div>
  );
};

export default AuditPanel;
