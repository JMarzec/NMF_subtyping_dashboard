import stats from "jstat";
import { Matrix, inverse } from "ml-matrix";
export const chiSquareTail = (x: number, df: number): number => df > 0 ? Math.max(0, Math.min(1, 1 - stats.jStat.chisquare.cdf(x, df))) : 1;
export function invert(matrix: number[][]): number[][] {
  if (!matrix.length) return [];
  const result = inverse(new Matrix(matrix)).to2DArray();
  if (result.some(row => row.some(v => !Number.isFinite(v)))) throw new Error("Singular information matrix");
  return result;
}
export const dot = (a: number[], b: number[]) => a.reduce((s,v,i) => s + v*b[i],0);
export const multiply = (a: number[][], b: number[]) => a.map(row => dot(row,b));