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
      width: element.scrollWidth + paddingRight,
      height: element.scrollHeight + paddingBottom,
      windowWidth: element.scrollWidth + paddingRight,
      windowHeight: element.scrollHeight + paddingBottom,
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
