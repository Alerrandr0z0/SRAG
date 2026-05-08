import React, { useState } from 'react';

const LabPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);

  // factory=Notebook and mode=single hide the file browser and extra toolbars
  const jupyterUrl = `${window.location.protocol}//${window.location.host}/lab/lab/tree/notebooks/srag_mossoro_analise_previsao.ipynb?factory=Notebook`;

  return (
    <div style={{ height: '90vh', width: '100%', position: 'relative', background: '#fff', borderRadius: '14px', border: '1px solid #d7e4df', overflow: 'hidden' }}>
      {loading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
          <p style={{ color: '#64748b' }}>Conectando ao ambiente de notebooks...</p>
        </div>
      )}
      <iframe
        src={jupyterUrl}
        title="Jupyter Notebook"
        width="100%"
        height="100%"
        style={{ border: 'none', display: loading ? 'none' : 'block' }}
        onLoad={() => setLoading(false)}
        onError={() => setLoading(false)}
      />
    </div>
  );
};

export default LabPanel;
