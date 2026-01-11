# NMF Molecular Subtyping Dashboard

Interactive bioinformatics visualization tool for exploring Non-negative Matrix Factorization (NMF) clustering results. Built with React, TypeScript, and Recharts for publication-ready figures.

![Dashboard Preview](https://img.shields.io/badge/React-18.3-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue) ![License](https://img.shields.io/badge/License-MIT-green)

## Features

- **Expression Heatmap** — Hierarchical clustering with Ward/Average/Complete/Single linkage, Z-score normalization, and interactive dendrograms
- **PCA & UMAP Scatter Plots** — Dimensionality reduction with toggleable data sources (Expression vs NMF Scores)
- **PCA Scree Plot** — Variance explained for up to 50 principal components
- **Kaplan-Meier Survival Curves** — Subtype-stratified survival analysis
- **Marker Genes Table** — Interleaved top genes with CSV/TSV export
- **Cophenetic Correlation Plot** — NMF rank selection metrics
- **Clustering Quality Metrics** — Silhouette, Davies-Bouldin, Calinski-Harabasz indices
- **Custom Annotation Overlays** — TSV/CSV metadata for secondary heatmap bars and scatter plot coloring
- **High-Fidelity Export** — PNG (4x scale) and SVG for all visualizations
- **Batch Export** — Download all charts as a ZIP with progress tracking

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18.x
- npm or [bun](https://bun.sh/)

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME

# Install dependencies
npm install
# or
bun install

# Start development server
npm run dev
# or
bun dev
```

The dashboard will be available at `http://localhost:8080`

### Build for Production

```bash
npm run build
npm run preview
```

## Data Format Specifications

The dashboard accepts a JSON file containing NMF analysis results. Below is the complete schema:

### Required JSON Structure

```json
{
  "summary": {
    "dataset": "GSE62254",
    "totalSamples": 300,
    "totalGenes": 5000,
    "optimalRank": 4,
    "method": "brunet",
    "dateGenerated": "2024-01-15"
  },
  "subtypeCounts": {
    "Subtype1": 75,
    "Subtype2": 80,
    "Subtype3": 70,
    "Subtype4": 75
  },
  "subtypeColors": {
    "Subtype1": "#E41A1C",
    "Subtype2": "#377EB8",
    "Subtype3": "#4DAF4A",
    "Subtype4": "#984EA3"
  },
  "samples": [...],
  "markerGenes": [...],
  "rankMetrics": [...],
  "survivalData": [...],
  "heatmapData": {...}
}
```

### Sample Results Array

Each sample in the `samples` (or `sampleResults`) array:

```json
{
  "sampleId": "GSM1523727",
  "assignedSubtype": "Subtype1",
  "silhouetteScore": 0.72,
  "nmfScores": [0.85, 0.12, 0.02, 0.01],
  "pcaCoordinates": { "pc1": 2.34, "pc2": -1.56 },
  "umapCoordinates": { "umap1": 5.67, "umap2": 3.21 }
}
```

### Marker Genes Array

Each entry in `markerGenes` (or `marker_genes`):

```json
{
  "gene": "TP53",
  "subtype": "Subtype1",
  "score": 0.95,
  "pValue": 0.0001,
  "foldChange": 3.2,
  "rank": 1
}
```

### Rank Metrics Array

For cophenetic correlation plots:

```json
{
  "rank": 2,
  "cophenetic": 0.89,
  "dispersion": 0.76,
  "silhouette": 0.65,
  "residuals": 0.42
}
```

### Survival Data Array

Kaplan-Meier survival probabilities:

```json
{
  "subtype": "Subtype1",
  "timePoints": [
    { "time": 0, "survival": 1.0 },
    { "time": 12, "survival": 0.92 },
    { "time": 24, "survival": 0.85 },
    { "time": 36, "survival": 0.78 }
  ]
}
```

### Heatmap Data Object

Expression matrix for visualization:

```json
{
  "genes": ["TP53", "BRCA1", "EGFR", "..."],
  "samples": ["GSM1523727", "GSM1523728", "..."],
  "matrix": [
    [1.2, -0.5, 0.8, "..."],
    [0.3, 1.1, -0.2, "..."]
  ],
  "sampleAnnotations": {
    "GSM1523727": "Subtype1",
    "GSM1523728": "Subtype2"
  }
}
```

### Field Name Flexibility

The JSON parser supports both snake_case and camelCase:

| Accepted Names | Description |
|----------------|-------------|
| `samples` or `sampleResults` | Sample-level results |
| `markerGenes` or `marker_genes` | Marker gene data |
| `pcaCoordinates` or `pca_coordinates` | PCA coordinates |
| `umapCoordinates` or `umap_coordinates` | UMAP coordinates |
| `nmfScores` or `nmf_scores` | NMF membership scores |

## Annotation File Format

Upload TSV or CSV files for custom annotations:

```tsv
sampleId	Stage	Grade	Treatment
GSM1523727	III	High	Chemo
GSM1523728	II	Low	Surgery
```

- First column must be `sampleId` matching your JSON sample IDs
- Additional columns become available for heatmap annotation bars and scatter plot coloring

## Project Structure

```
├── src/
│   ├── components/
│   │   ├── bioinformatics/     # Visualization components
│   │   │   ├── ClusterScatter.tsx
│   │   │   ├── Dendrogram.tsx
│   │   │   ├── ExpressionHeatmap.tsx
│   │   │   ├── JsonUploader.tsx
│   │   │   ├── MarkerGenesTable.tsx
│   │   │   ├── PCAScatter.tsx
│   │   │   ├── PCAScreePlot.tsx
│   │   │   ├── SummaryCards.tsx
│   │   │   ├── SurvivalCurve.tsx
│   │   │   └── ...
│   │   └── ui/                 # shadcn/ui components
│   ├── data/
│   │   └── mockNmfData.ts      # Sample data for testing
│   ├── lib/
│   │   ├── chartExport.ts      # PNG/SVG export utilities
│   │   └── utils.ts
│   ├── pages/
│   │   └── Index.tsx           # Main dashboard page
│   └── index.css               # Design tokens & theming
├── public/
└── package.json
```

## Technology Stack

- **React 18** — UI framework
- **TypeScript** — Type safety
- **Vite** — Build tool
- **Tailwind CSS** — Styling
- **shadcn/ui** — Component library
- **Recharts** — Charting library
- **html2canvas** — PNG export
- **JSZip** — Batch ZIP export

## Export Capabilities

### Individual Charts
- Click the download buttons on each visualization
- PNG exports at 4x resolution with white backgrounds
- SVG exports with proper font embedding

### Batch Export
- Use "Export All" button in header
- Downloads all visualizations as a ZIP file
- Progress indicator shows export status

## Customization

### Theming

Edit `src/index.css` to modify design tokens:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 221.2 83.2% 53.3%;
  /* ... */
}
```

### Clustering Options

The heatmap supports multiple linkage methods:
- Ward (default) — Minimizes variance
- Average — UPGMA method
- Complete — Maximum distance
- Single — Minimum distance

Distance metrics:
- Euclidean (default)
- Manhattan

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License — see [LICENSE](LICENSE) for details.

## Acknowledgments

Built with [Lovable](https://lovable.dev) — the AI-powered web development platform.
