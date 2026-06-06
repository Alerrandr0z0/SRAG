import React from 'react';
import { useThemeMode } from '../../hooks/useThemeMode';

interface DiagnosticLatencyPhases {
  symptom_to_notification: number;
  notification_to_collection: number;
  collection_to_result: number;
  symptom_to_treatment: number;
}

interface DiagnosticLatencyTimelineProps {
  data: DiagnosticLatencyPhases | null;
}

const DiagnosticLatencyTimeline: React.FC<DiagnosticLatencyTimelineProps> = ({ data }) => {
  const theme = useThemeMode();
  const isDark = theme === 'dark';

  if (!data) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: isDark ? '#94a3b8' : '#64748b' }}>
        Carregando linha do tempo diagnóstica...
      </div>
    );
  }

  const {
    symptom_to_notification,
    notification_to_collection,
    collection_to_result,
    symptom_to_treatment,
  } = data;

  const totalDiagDays = symptom_to_notification + notification_to_collection + collection_to_result;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '1rem 0' }}>
      {/* diagnostic timeline */}
      <div>
        <h4
          style={{
            margin: '0 0 1rem 0',
            fontSize: '0.875rem',
            color: isDark ? '#f1f5f9' : '#0f172a',
          }}
        >
          Cadeia de Latência Diagnóstica (Mediana de Dias Acumulados: {totalDiagDays.toFixed(1)}d)
        </h4>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'relative',
            padding: '1.5rem 1rem',
            background: isDark ? '#1e293b' : '#f8fafc',
            borderRadius: '10px',
            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
            overflowX: 'auto',
          }}
        >
          {/* Step 1: Sintomas */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              zIndex: 1,
              minWidth: '80px',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: '#0f766e',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '0.875rem',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
            >
              1
            </div>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                marginTop: '0.5rem',
                color: isDark ? '#e2e8f0' : '#334155',
              }}
            >
              Sintomas
            </span>
            <span style={{ fontSize: '0.675rem', color: '#94a3b8', marginTop: '0.125rem' }}>
              Dia 0.0
            </span>
          </div>

          {/* Connector 1 */}
          <div
            style={{
              flex: 1,
              height: '4px',
              background: '#e2e8f0',
              margin: '0 10px',
              position: 'relative',
              minWidth: '40px',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '-20px',
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                color: '#0f766e',
              }}
            >
              +{symptom_to_notification.toFixed(1)}d
            </div>
            <div style={{ width: '100%', height: '100%', background: '#0f766e' }} />
          </div>

          {/* Step 2: Notificacao */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              zIndex: 1,
              minWidth: '80px',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: '#0d9488',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '0.875rem',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
            >
              2
            </div>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                marginTop: '0.5rem',
                color: isDark ? '#e2e8f0' : '#334155',
              }}
            >
              Notificação
            </span>
            <span style={{ fontSize: '0.675rem', color: '#94a3b8', marginTop: '0.125rem' }}>
              Dia {symptom_to_notification.toFixed(1)}
            </span>
          </div>

          {/* Connector 2 */}
          <div
            style={{
              flex: 1,
              height: '4px',
              background: '#e2e8f0',
              margin: '0 10px',
              position: 'relative',
              minWidth: '40px',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '-20px',
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                color: '#0d9488',
              }}
            >
              +{notification_to_collection.toFixed(1)}d
            </div>
            <div style={{ width: '100%', height: '100%', background: '#0d9488' }} />
          </div>

          {/* Step 3: Coleta */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              zIndex: 1,
              minWidth: '80px',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: '#06b6d4',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '0.875rem',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
            >
              3
            </div>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                marginTop: '0.5rem',
                color: isDark ? '#e2e8f0' : '#334155',
              }}
            >
              Coleta Amostra
            </span>
            <span style={{ fontSize: '0.675rem', color: '#94a3b8', marginTop: '0.125rem' }}>
              Dia {(symptom_to_notification + notification_to_collection).toFixed(1)}
            </span>
          </div>

          {/* Connector 3 */}
          <div
            style={{
              flex: 1,
              height: '4px',
              background: '#e2e8f0',
              margin: '0 10px',
              position: 'relative',
              minWidth: '40px',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '-20px',
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                color: '#06b6d4',
              }}
            >
              +{collection_to_result.toFixed(1)}d
            </div>
            <div style={{ width: '100%', height: '100%', background: '#06b6d4' }} />
          </div>

          {/* Step 4: Resultado */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              zIndex: 1,
              minWidth: '80px',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: '#3b82f6',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '0.875rem',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
            >
              4
            </div>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                marginTop: '0.5rem',
                color: isDark ? '#e2e8f0' : '#334155',
              }}
            >
              Resultado Lab
            </span>
            <span style={{ fontSize: '0.675rem', color: '#94a3b8', marginTop: '0.125rem' }}>
              Dia {totalDiagDays.toFixed(1)}
            </span>
          </div>
        </div>
      </div>

      {/* treatment timeline */}
      <div>
        <h4
          style={{
            margin: '0 0 1rem 0',
            fontSize: '0.875rem',
            color: isDark ? '#f1f5f9' : '#0f172a',
          }}
        >
          Oportunidade Terapêutica (Início de Sintomas → Início Antiviral)
        </h4>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'relative',
            padding: '1.5rem 1rem',
            background: isDark ? '#1e293b' : '#f8fafc',
            borderRadius: '10px',
            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
            overflowX: 'auto',
          }}
        >
          {/* Step 1: Sintomas */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              zIndex: 1,
              minWidth: '80px',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: '#0f766e',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '0.875rem',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
            >
              1
            </div>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                marginTop: '0.5rem',
                color: isDark ? '#e2e8f0' : '#334155',
              }}
            >
              Sintomas
            </span>
            <span style={{ fontSize: '0.675rem', color: '#94a3b8', marginTop: '0.125rem' }}>
              Dia 0.0
            </span>
          </div>

          {/* Connector */}
          <div
            style={{
              flex: 1,
              height: '4px',
              background: '#e2e8f0',
              margin: '0 10px',
              position: 'relative',
              minWidth: '80px',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '-20px',
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                color: '#ea580c',
              }}
            >
              +{symptom_to_treatment.toFixed(1)} dias
            </div>
            <div style={{ width: '100%', height: '100%', background: '#ea580c' }} />
          </div>

          {/* Step 2: Tratamento */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              zIndex: 1,
              minWidth: '80px',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: '#ea580c',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '0.875rem',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
            >
              💊
            </div>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                marginTop: '0.5rem',
                color: isDark ? '#e2e8f0' : '#334155',
              }}
            >
              Antiviral Iniciado
            </span>
            <span style={{ fontSize: '0.675rem', color: '#94a3b8', marginTop: '0.125rem' }}>
              Dia {symptom_to_treatment.toFixed(1)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiagnosticLatencyTimeline;
