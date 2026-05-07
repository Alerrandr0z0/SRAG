declare const echarts: {
  init: (_container: HTMLDivElement) => {
    setOption: (opt: unknown, notMerge?: boolean) => void;
    resize: () => void;
    dispose: () => void;
  };
};

export default echarts;
