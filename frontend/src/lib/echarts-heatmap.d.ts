declare const echarts: {
  init: (
    _container: HTMLDivElement,
    _theme?: string,
  ) => {
    setOption: (opt: unknown, notMerge?: boolean) => void;
    resize: () => void;
    dispose: () => void;
    isDisposed: () => boolean;
  };
};

export default echarts;
