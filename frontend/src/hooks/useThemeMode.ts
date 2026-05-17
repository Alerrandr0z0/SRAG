import { useEffect, useState } from 'react';

export function useThemeMode() {
  const [theme, setTheme] = useState<'light' | 'dark'>(
    () => (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light'
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const nextTheme = document.documentElement.getAttribute('data-theme') as 'light' | 'dark' | null;
      setTheme(nextTheme === 'dark' ? 'dark' : 'light');
    });

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  return theme;
}
