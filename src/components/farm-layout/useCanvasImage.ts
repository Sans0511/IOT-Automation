"use client";

import { useEffect, useState } from "react";

export function useCanvasImage(src: string | null): HTMLImageElement | null {
  const [loaded, setLoaded] = useState<{
    src: string;
    image: HTMLImageElement;
  } | null>(null);

  useEffect(() => {
    if (!src) {
      return;
    }

    const nextImage = new window.Image();

    nextImage.onload = () => setLoaded({ src, image: nextImage });
    nextImage.onerror = () => setLoaded(null);
    nextImage.src = src;

    return () => {
      nextImage.onload = null;
      nextImage.onerror = null;
    };
  }, [src]);

  return loaded?.src === src ? loaded.image : null;
}
