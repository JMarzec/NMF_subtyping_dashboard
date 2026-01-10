import html2canvas from "html2canvas";

export interface ChartExportOptions {
  backgroundColor?: string;
  scale?: number;
  paddingRight?: number;
  paddingBottom?: number;
}

export const downloadChartAsPNG = async (
  element: HTMLElement | null,
  filename: string,
  options: ChartExportOptions = {}
): Promise<void> => {
  if (!element) return;

  const {
    backgroundColor = "#ffffff",
    scale = 4,
    paddingRight = 0,
    paddingBottom = 0,
  } = options;

  try {
    const canvas = await html2canvas(element, {
      backgroundColor,
      scale,
      logging: false,
      useCORS: true,
      allowTaint: true,
      width: element.scrollWidth + paddingRight,
      height: element.scrollHeight + paddingBottom,
      windowWidth: element.scrollWidth + paddingRight,
      windowHeight: element.scrollHeight + paddingBottom,
      onclone: (clonedDoc) => {
        // Ensure all text elements render properly
        const clonedElement = clonedDoc.body.querySelector('[data-heatmap-container]') || clonedDoc.body;
        const textElements = clonedElement.querySelectorAll('*');
        textElements.forEach((el) => {
          if (el instanceof HTMLElement) {
            el.style.fontFamily = 'system-ui, -apple-system, sans-serif';
          }
        });
      }
    });

    const link = document.createElement("a");
    link.download = `${filename}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  } catch (error) {
    console.error("Failed to export chart:", error);
  }
};

export const downloadSVGAsFile = (
  svgElement: SVGElement | null,
  filename: string
): void => {
  if (!svgElement) return;

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svgElement);
  const blob = new Blob([svgString], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.download = `${filename}.svg`;
  link.href = url;
  link.click();

  URL.revokeObjectURL(url);
};

// Export Recharts chart to SVG
export const downloadRechartsAsSVG = (
  containerElement: HTMLElement | null,
  filename: string
): void => {
  if (!containerElement) return;

  const svgElement = containerElement.querySelector('svg');
  if (!svgElement) {
    console.error("No SVG element found in container");
    return;
  }

  // Clone the SVG to modify it
  const clonedSvg = svgElement.cloneNode(true) as SVGElement;
  
  // Add white background
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('width', '100%');
  rect.setAttribute('height', '100%');
  rect.setAttribute('fill', 'white');
  clonedSvg.insertBefore(rect, clonedSvg.firstChild);

  downloadSVGAsFile(clonedSvg, filename);
};
