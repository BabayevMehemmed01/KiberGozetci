import { useEffect, useState } from "react";

export function useDocumentTheme(): string {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || "cyber");

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setTheme(root.dataset.theme || "cyber");
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return theme;
}
