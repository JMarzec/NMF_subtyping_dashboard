declare module "jstat" {
  const stats: { jStat: { chisquare: { cdf(x: number, df: number): number }; studentt: { inv(p: number, df: number): number } } };
  export default stats;
}