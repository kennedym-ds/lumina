function dataUrlToBlob(dataUrl: string): Blob {
  const [header, payload = ""] = dataUrl.split(",");
  const mimeType = /data:(.*?);base64/.exec(header)?.[1] ?? "image/png";

  const binary = atob(payload);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

  return new Blob([bytes], { type: mimeType });
}

export function useChartClipboard() {
  const copyChart = async (plotlyElement: HTMLElement): Promise<boolean> => {
    if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
      return false;
    }

    try {
      const plotlyModule = await import("plotly.js-dist-min");
      const plotlyApi = (plotlyModule.default ?? plotlyModule) as {
        toImage: (
          element: HTMLElement,
          options: { format: "png"; width: number; height: number },
        ) => Promise<string>;
      };

      const dataUrl = await plotlyApi.toImage(plotlyElement, {
        format: "png",
        width: 1200,
        height: 800,
      });

      const imageBlob = dataUrlToBlob(dataUrl);
      await navigator.clipboard.write([
        new ClipboardItem({
          [imageBlob.type]: imageBlob,
        }),
      ]);

      return true;
    } catch {
      return false;
    }
  };

  return { copyChart };
}
