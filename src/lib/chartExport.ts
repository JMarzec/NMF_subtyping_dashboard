import { toast } from "sonner";
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
        // Ensure all text elements have proper styling for export
        const allElements = clonedDoc.body.querySelectorAll('*');
        allElements.forEach((el) => {
          if (el instanceof HTMLElement) {
            const computedStyle = window.getComputedStyle(el);
            el.style.fontFamily = 'Arial, system-ui, sans-serif';
            // Ensure text color is visible on white background
            if (computedStyle.color === 'rgba(0, 0, 0, 0)' || !el.style.color) {
              el.style.color = '#374151';
            }
          }
        });
        // Force SVG text elements to have visible fill
        const svgTexts = clonedDoc.body.querySelectorAll('svg text, svg tspan');
        svgTexts.forEach((el) => {
          if (el instanceof SVGElement) {
            const fill = el.getAttribute('fill');
            if (!fill || fill === 'none' || fill === 'rgba(0, 0, 0, 0)') {
              el.setAttribute('fill', '#374151');
            }
            el.setAttribute('font-family', 'Arial, sans-serif');
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
    toast.error("Chart export failed");
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
        // Ensure all text elements have proper styling for export
        const allElements = clonedDoc.body.querySelectorAll('*');
        allElements.forEach((el) => {
          if (el instanceof HTMLElement) {
            el.style.fontFamily = 'Arial, system-ui, sans-serif';
            // Ensure text color is visible on white background
            const computedColor = window.getComputedStyle(el).color;
            if (computedColor === 'rgba(0, 0, 0, 0)') {
              el.style.color = '#374151';
            }
          }
        });
        // Force SVG text elements to have visible fill
        const svgTexts = clonedDoc.body.querySelectorAll('svg text, svg tspan');
        svgTexts.forEach((el) => {
          if (el instanceof SVGElement) {
            const fill = el.getAttribute('fill');
            if (!fill || fill === 'none' || fill === 'rgba(0, 0, 0, 0)') {
              el.setAttribute('fill', '#374151');
            }
            el.setAttribute('font-family', 'Arial, sans-serif');
          }
        });
      }
    });

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });
  } catch (error) {
    console.error("Failed to export chart:", error);
    toast.error("Chart export failed");
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
        const dominantBaseline = computedStyle?.dominantBaseline;
        
        // Always set font-size with fallback
        el.setAttribute('font-size', fontSize && fontSize !== '0px' ? fontSize : '12px');
        
        // Always set font-family
        el.setAttribute('font-family', fontFamily && fontFamily !== '' ? fontFamily : 'Arial, sans-serif');
        
        if (fontWeight && fontWeight !== 'normal' && fontWeight !== '400') {
          el.setAttribute('font-weight', fontWeight);
        }
        if (textAnchor) {
          el.setAttribute('text-anchor', textAnchor);
        }
        if (dominantBaseline) {
          el.setAttribute('dominant-baseline', dominantBaseline);
        }
        
        // Always ensure text has a visible fill color - check more aggressively
        const effectiveFill = fill || '';
        const effectiveColor = color || '';
        const isTransparent = (c: string) => !c || c === 'none' || c === '' || c === 'rgba(0, 0, 0, 0)' || c === 'transparent';
        
        if (!isTransparent(effectiveFill)) {
          el.setAttribute('fill', effectiveFill);
        } else if (!isTransparent(effectiveColor)) {
          el.setAttribute('fill', effectiveColor);
        } else {
          // Force a default visible color for all text
          el.setAttribute('fill', '#374151');
        }
      }
    }
  });
};

// Convert HTML element to SVG for cards/non-chart elements
const convertHTMLToSVG = (element: HTMLElement): string => {
  const rect = element.getBoundingClientRect();
  const width = Math.max(rect.width,element.scrollWidth);
  const height = Math.max(rect.height,element.scrollHeight);
  
  // Create SVG with foreignObject containing the HTML
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  
  // Add white background
  const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bgRect.setAttribute('width', '100%');
  bgRect.setAttribute('height', '100%');
  bgRect.setAttribute('fill', 'white');
  svg.appendChild(bgRect);
  
  // Use foreignObject to embed HTML
  const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
  foreignObject.setAttribute('width', String(width));
  foreignObject.setAttribute('height', String(height));
  
  // Clone the element and inline critical styles
  const clonedEl = element.cloneNode(true) as HTMLElement;
  clonedEl.style.margin = '0';
  clonedEl.style.fontFamily = 'Arial, sans-serif';
  
  clonedEl.setAttribute("xmlns","http://www.w3.org/1999/xhtml");
  const originals=[element,...Array.from(element.querySelectorAll("*"))];
  const clones=[clonedEl,...Array.from(clonedEl.querySelectorAll("*"))];
  clones.forEach((child,i)=>{
    const original=originals[i];if(!original)return;
    const computed=window.getComputedStyle(original);
    const css=Array.from(computed).map(key=>`${key}:${computed.getPropertyValue(key)};`).join("");
    child.setAttribute("style",css);
    if(child instanceof HTMLCanvasElement && original instanceof HTMLCanvasElement){
      const image=document.createElement("img");image.src=original.toDataURL();image.width=original.width;image.height=original.height;child.replaceWith(image);
    }
  });
  clonedEl.style.margin="0";
  clonedEl.style.width=`${width}px`;
  clonedEl.style.height=`${height}px`;
  clonedEl.style.overflow="visible";

  foreignObject.appendChild(clonedEl);
  svg.appendChild(foreignObject);
  
  const serializer = new XMLSerializer();
  return serializer.serializeToString(svg);
};

// Returns SVG as string for ZIP export
export const getSVGAsString = (
  containerElement: HTMLElement | null,
  chartType: 'recharts' | 'heatmap' | 'cards' = 'recharts'
): string | null => {
  if (!containerElement) return null;

  // For heatmap, look for the custom SVG export button and trigger it programmatically
  if (chartType === 'heatmap') {
    return null;
  }
  
  // For cards (HTML elements without SVG), use foreignObject approach
  if (chartType === 'cards') {
    return convertHTMLToSVG(containerElement);
  }

  // Preserve every chart, legend, risk table and result in the panel.
  return convertHTMLToSVG(containerElement);
};

export const downloadRechartsAsSVG = (containerElement:HTMLElement|null,filename:string):void => {
  const content=getSVGAsString(containerElement);if(!content){toast.error("No chart available to export");return;}
  const url=URL.createObjectURL(new Blob([content],{type:"image/svg+xml"}));
  const link=document.createElement("a");link.download=`${filename}.svg`;link.href=url;link.click();URL.revokeObjectURL(url);
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
  await document.fonts.ready;
  const failures:string[]=[];
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
        } else failures.push(chart.name);
      } else {
        // For heatmap, use custom SVG generator if provided
        if (chart.type === 'heatmap' && chart.getSVGString) {
          const svgString = chart.getSVGString();
          if (svgString) {
            folder.file(`${chart.name}.svg`, svgString);
          } else failures.push(chart.name);
        } else if (chart.type !== 'heatmap') {
          const svgString = getSVGAsString(chart.ref, chart.type);
          if (svgString) {
            folder.file(`${chart.name}.svg`, svgString);
          } else failures.push(chart.name);
        }
      }
    } catch (error) {
      console.error(`Failed to export ${chart.name}:`, error);
      failures.push(chart.name);
    }
  }

  if(failures.length)throw new Error(`Export incomplete: ${failures.join(", ")}`);
  const content = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(content);
  
  const link = document.createElement("a");
  link.download = `${filename}-${format}.zip`;
  link.href = url;
  link.click();

  URL.revokeObjectURL(url);
};
