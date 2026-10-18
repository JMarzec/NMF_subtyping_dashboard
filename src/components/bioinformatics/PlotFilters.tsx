import { createContext, useContext, useState, type ReactNode } from "react";
type Filters={selectedAnnotation:string|null;setSelectedAnnotation:React.Dispatch<React.SetStateAction<string|null>>;excludedSubtypes:Set<string>;setExcludedSubtypes:React.Dispatch<React.SetStateAction<Set<string>>>;excludedAnnotationValues:Set<string>;setExcludedAnnotationValues:React.Dispatch<React.SetStateAction<Set<string>>>};
const Context=createContext<Filters|null>(null);
export function PlotFiltersProvider({children}:{children:ReactNode}){
  const [selectedAnnotation,setSelectedAnnotation]=useState<string|null>(null),[excludedSubtypes,setExcludedSubtypes]=useState(new Set<string>()),[excludedAnnotationValues,setExcludedAnnotationValues]=useState(new Set<string>());
  return <Context.Provider value={{selectedAnnotation,setSelectedAnnotation,excludedSubtypes,setExcludedSubtypes,excludedAnnotationValues,setExcludedAnnotationValues}}>{children}</Context.Provider>;
}
export function usePlotFilters(){const value=useContext(Context);if(!value)throw new Error("Plot filters require their provider");return value;}