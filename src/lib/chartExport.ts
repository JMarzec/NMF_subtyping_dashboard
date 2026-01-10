import html2canvas from "html2canvas";

export const downloadChartAsPNG = async (
  element: HTMLElement | null,
  filename: string
): Promise<void> => {
  if (!element) return;

  try {
    const canvas = await html2canvas(element, {
      backgroundColor: "#1a1a2e",
      scale: 2,
      logging: false,
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
