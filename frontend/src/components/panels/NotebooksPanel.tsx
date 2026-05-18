import React from 'react';

const NotebooksPanel: React.FC = () => {
  return (
    <div
      className="panel notebooks-panel"
      style={{ height: 'calc(100vh - 4rem)', padding: 0, overflow: 'hidden' }}
    >
      <iframe
        src="http://localhost:8888/lab"
        title="Jupyter Lab"
        style={{ width: '100%', height: '100%', border: 'none' }}
      />
    </div>
  );
};

export default NotebooksPanel;
