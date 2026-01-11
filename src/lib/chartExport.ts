import html2canvas from "html2canvas";
import JSZip from "jszip";

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

// Returns PNG as blob for ZIP export
export const getChartAsPNGBlob = async (
  element: HTMLElement | null,
  options: ChartExportOptions = {}
): Promise<Blob | null> => {
  if (!element) return null;

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
        const clonedElement = clonedDoc.body.querySelector('[data-heatmap-container]') || clonedDoc.body;
        const textElements = clonedElement.querySelectorAll('*');
        textElements.forEach((el) => {
          if (el instanceof HTMLElement) {
            el.style.fontFamily = 'system-ui, -apple-system, sans-serif';
          }
        });
      }
    });

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });
  } catch (error) {
    console.error("Failed to export chart:", error);
    return null;
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

// Apply computed styles inline to SVG elements for proper export
const applyComputedStylesToSVG = (svgElement: SVGElement, originalSvg: SVGElement): void => {
  const elements = svgElement.querySelectorAll('*');
  const originalElements = originalSvg.querySelectorAll('*');
  
  // Create arrays for direct index matching
  const originalArray = Array.from(originalElements);
  
  elements.forEach((el, idx) => {
    if (el instanceof SVGElement) {
      const originalEl = originalArray[idx];
      const computedStyle = originalEl ? window.getComputedStyle(originalEl) : null;
      
      const tagName = el.tagName.toLowerCase();
      
      // Apply stroke properties for shape elements
      if (['line', 'path', 'polyline', 'polygon', 'circle', 'rect', 'ellipse'].includes(tagName)) {
        const stroke = computedStyle?.stroke;
        const strokeWidth = computedStyle?.strokeWidth;
        const strokeOpacity = computedStyle?.strokeOpacity;
        const strokeDasharray = computedStyle?.strokeDasharray;
        
        // For Recharts axis lines that might have class-based styling
        const hasAxisClass = el.classList.contains('recharts-cartesian-axis-line') ||
                            el.classList.contains('recharts-cartesian-axis-tick-line') ||
                            el.closest('.recharts-xAxis') ||
                            el.closest('.recharts-yAxis');
        
        const hasGridClass = el.classList.contains('recharts-cartesian-grid-horizontal') ||
                            el.classList.contains('recharts-cartesian-grid-vertical') ||
                            el.closest('.recharts-cartesian-grid');
        
        // Set stroke - use defaults for axis/grid if computed style is empty or none
        if (stroke && stroke !== 'none' && stroke !== '' && stroke !== 'rgba(0, 0, 0, 0)') {
          el.setAttribute('stroke', stroke);
        } else if (hasAxisClass) {
          el.setAttribute('stroke', '#666666');
        } else if (hasGridClass) {
          el.setAttribute('stroke', '#e0e0e0');
        }
        
        // Set stroke width
        if (strokeWidth && strokeWidth !== '0' && strokeWidth !== '0px') {
          el.setAttribute('stroke-width', strokeWidth);
        } else if (hasAxisClass || hasGridClass) {
          el.setAttribute('stroke-width', '1');
        }
        
        if (strokeOpacity && strokeOpacity !== '1') {
          el.setAttribute('stroke-opacity', strokeOpacity);
        }
        if (strokeDasharray && strokeDasharray !== 'none') {
          el.setAttribute('stroke-dasharray', strokeDasharray);
        }
        
        // Apply fill
        const fill = computedStyle?.fill;
        if (fill && fill !== 'none' && fill !== '' && fill !== 'rgba(0, 0, 0, 0)') {
          el.setAttribute('fill', fill);
        }
      }
      
      // Apply text properties - ALWAYS set defaults to ensure text is visible
      if (tagName === 'text' || tagName === 'tspan') {
        const fontSize = computedStyle?.fontSize;
        const fontFamily = computedStyle?.fontFamily;
        const fontWeight = computedStyle?.fontWeight;
        const textAnchor = computedStyle?.textAnchor;
        const fill = computedStyle?.fill;
        const color = computedStyle?.color;
        
        // Always set font-size with fallback
        el.setAttribute('font-size', fontSize && fontSize !== '0px' ? fontSize : '12px');
        
        // Always set font-family
        el.setAttribute('font-family', fontFamily && fontFamily !== '' ? fontFamily : 'Arial, sans-serif');
        
        if (fontWeight && fontWeight !== 'normal' && fontWeight !== '400') {
          el.setAttribute('font-weight', fontWeight);
        }
        if (textAnchor && textAnchor !== 'start') {
          el.setAttribute('text-anchor', textAnchor);
        }
        
        // Always ensure text has a visible fill color
        if (fill && fill !== 'none' && fill !== '' && fill !== 'rgba(0, 0, 0, 0)') {
          el.setAttribute('fill', fill);
        } else if (color && color !== '' && color !== 'rgba(0, 0, 0, 0)') {
          el.setAttribute('fill', color);
        } else {
          // Force a default visible color for all text
          el.setAttribute('fill', '#374151');
        }
      }
    }
  });
};

// Returns SVG as string for ZIP export
export const getSVGAsString = (
  containerElement: HTMLElement | null,
  chartType: 'recharts' | 'heatmap' | 'cards' = 'recharts'
): string | null => {
  if (!containerElement) return null;

  // For heatmap, look for the custom SVG export button and trigger it programmatically
  // Or find the heatmap canvas and convert it
  if (chartType === 'heatmap') {
    // Heatmaps use a custom SVG generation - we'll return null here
    // and handle it separately in exportAllAsZip
    return null;
  }

  // Find the chart SVG specifically - look for Recharts container or the largest SVG
  // Avoid icon SVGs (small, typically in buttons) by checking size and context
  const allSvgs = containerElement.querySelectorAll('svg');
  let chartSvg: SVGElement | null = null;
  let maxArea = 0;

  allSvgs.forEach((svg) => {
    // Skip SVGs inside buttons (likely icons)
    if (svg.closest('button')) return;
    
    // Skip very small SVGs (icons are typically < 32px)
    const width = svg.getBoundingClientRect().width;
    const height = svg.getBoundingClientRect().height;
    const area = width * height;
    
    // Look for the largest SVG that's not an icon
    if (width > 50 && height > 50 && area > maxArea) {
      maxArea = area;
      chartSvg = svg as SVGElement;
    }
  });

  // Fallback: try to find SVG in recharts-wrapper or similar chart containers
  if (!chartSvg) {
    chartSvg = containerElement.querySelector('.recharts-wrapper svg') as SVGElement | null;
  }

  if (!chartSvg) return null;

  const clonedSvg = chartSvg.cloneNode(true) as SVGElement;
  
  // Set proper dimensions
  const rect = chartSvg.getBoundingClientRect();
  clonedSvg.setAttribute('width', String(rect.width));
  clonedSvg.setAttribute('height', String(rect.height));
  clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  
  // Apply computed styles from original SVG to cloned SVG
  applyComputedStylesToSVG(clonedSvg, chartSvg);
  
  // Add white background
  const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bgRect.setAttribute('width', '100%');
  bgRect.setAttribute('height', '100%');
  bgRect.setAttribute('fill', 'white');
  clonedSvg.insertBefore(bgRect, clonedSvg.firstChild);

  const serializer = new XMLSerializer();
  return serializer.serializeToString(clonedSvg);
};

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

  const clonedSvg = svgElement.cloneNode(true) as SVGElement;
  
  // Set proper dimensions
  const rect = svgElement.getBoundingClientRect();
  clonedSvg.setAttribute('width', String(rect.width));
  clonedSvg.setAttribute('height', String(rect.height));
  clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  
  // Apply computed styles from original to cloned
  applyComputedStylesToSVG(clonedSvg, svgElement);
  
  const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bgRect.setAttribute('width', '100%');
  bgRect.setAttribute('height', '100%');
  bgRect.setAttribute('fill', 'white');
  clonedSvg.insertBefore(bgRect, clonedSvg.firstChild);

  downloadSVGAsFile(clonedSvg, filename);
};

export interface ChartRef {
  id: string;
  name: string;
  ref: HTMLElement | null;
  type: 'recharts' | 'heatmap' | 'cards';
  pngOptions?: ChartExportOptions;
  getSVGString?: () => string | null; // Custom SVG generator for heatmap
}

export interface ExportProgress {
  current: number;
  total: number;
  currentChart: string;
}

export const exportAllAsZip = async (
  charts: ChartRef[],
  format: 'png' | 'svg',
  filename: string = 'nmf-visualizations',
  onProgress?: (progress: ExportProgress) => void
): Promise<void> => {
  const zip = new JSZip();
  const folder = zip.folder(filename);
  
  if (!folder) return;

  const validCharts = charts.filter(c => c.ref);
  const total = validCharts.length;

  for (let i = 0; i < validCharts.length; i++) {
    const chart = validCharts[i];
    
    onProgress?.({
      current: i + 1,
      total,
      currentChart: chart.name
    });

    try {
      if (format === 'png') {
        const blob = await getChartAsPNGBlob(chart.ref, chart.pngOptions);
        if (blob) {
          folder.file(`${chart.name}.png`, blob);
        }
      } else {
        // For heatmap, use custom SVG generator if provided
        if (chart.type === 'heatmap' && chart.getSVGString) {
          const svgString = chart.getSVGString();
          if (svgString) {
            folder.file(`${chart.name}.svg`, svgString);
          }
        } else if (chart.type !== 'heatmap') {
          const svgString = getSVGAsString(chart.ref, chart.type);
          if (svgString) {
            folder.file(`${chart.name}.svg`, svgString);
          }
        }
      }
    } catch (error) {
      console.error(`Failed to export ${chart.name}:`, error);
    }
  }

  const content = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(content);
  
  const link = document.createElement("a");
  link.download = `${filename}-${format}.zip`;
  link.href = url;
  link.click();

  URL.revokeObjectURL(url);
};
