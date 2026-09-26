import { useEffect, useState } from "react";

const DESKTOP_QUERY = "(min-width: 1024px)";

function getInitialSidebarState() {
  return typeof window !== "undefined" && window.matchMedia(DESKTOP_QUERY).matches;
}

export function useSidebarState() {
  const [sidebarOpen, setSidebarOpen] = useState(getInitialSidebarState);

  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_QUERY);
    const syncWithViewport = (event) => setSidebarOpen(event.matches);

    mediaQuery.addEventListener("change", syncWithViewport);
    return () => mediaQuery.removeEventListener("change", syncWithViewport);
  }, []);

  return [sidebarOpen, setSidebarOpen];
}
