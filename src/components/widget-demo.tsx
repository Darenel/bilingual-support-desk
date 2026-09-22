"use client";

import { useEffect } from "react";

export function WidgetDemo({ widgetKey }: { widgetKey: string }) {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "/widget.js";
    script.dataset.key = widgetKey;
    script.async = true;
    document.body.append(script);

    return () => {
      script.dispatchEvent(new Event("support-widget-destroy"));
      if (script.isConnected) script.remove();
    };
  }, [widgetKey]);

  return null;
}
