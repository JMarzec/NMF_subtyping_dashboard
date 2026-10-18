import { useEffect, useRef } from "react";
export function HeatmapCanvas({values,genes,samples,cellWidth,cellHeight,color,onHover,onLeave}:{values:number[][];genes:number[];samples:number[];cellWidth:number;cellHeight:number;color:(v:number)=>string;onHover:(event:React.MouseEvent,gene:number,sample:number)=>void;onLeave:()=>void}){
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const canvas=ref.current,ctx=canvas?.getContext("2d");if(!canvas||!ctx)return;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    genes.forEach((g,y)=>samples.forEach((s,x)=>{ctx.fillStyle=color(values[g][s]);ctx.fillRect(x*cellWidth,y*cellHeight,cellWidth,cellHeight);}));
  },[values,genes,samples,cellWidth,cellHeight,color]);
  return <canvas ref={ref} width={samples.length*cellWidth} height={genes.length*cellHeight} className="block cursor-crosshair" aria-label="Expression heatmap" onMouseMove={e=>{const r=e.currentTarget.getBoundingClientRect(),x=Math.floor((e.clientX-r.left)/cellWidth),y=Math.floor((e.clientY-r.top)/cellHeight);const g=genes[y],s=samples[x];if(g!==undefined&&s!==undefined)onHover(e,g,s);}} onMouseLeave={onLeave}/>;
}