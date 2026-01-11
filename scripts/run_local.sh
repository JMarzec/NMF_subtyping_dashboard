#!/bin/bash

# Check if R is installed
if ! command -v Rscript &> /dev/null; then
    echo "ERROR: Rscript not found. Please install R first."
    exit 1
fi

echo "✓ R is installed"
echo ""

# Make the script executable (if not already)
if [ ! -x nmf_analysis_cli.R ]; then
    chmod +x nmf_analysis_cli.R
    echo "✓ Made nmf_analysis_cli.R executable"
fi

echo "================================================"
echo "NMF Analysis - GSE62254"
echo "================================================"
echo ""
echo "Analyzing local files with custom parameters..."
echo ""

Rscript nmf_analysis_cli.R \
    --dataset GSE62254 \
    --expr_file "/Users/jacek_marzec/Library/CloudStorage/OneDrive-SharedLibraries-AssociaçãoAccelbio/AccelBio Central Hub - Projects_gastric_cancer/data/GSE62254/GSE62254_normalised_annot.txt" \
    --samples_annot_file "/Users/jacek_marzec/Library/CloudStorage/OneDrive-SharedLibraries-AssociaçãoAccelbio/AccelBio Central Hub - Projects_gastric_cancer/data/GSE62254/target_GSE62254.txt" \
    --surv_time_col "DFS.m" \
    --surv_event_col "Recur" \
    --output_dir "/Users/jacek_marzec/Library/CloudStorage/OneDrive-SharedLibraries-AssociaçãoAccelbio/AccelBio Central Hub - Projects_gastric_cancer/results/datasets/GSE62254/NMF_analysis/" \
    --rank_min 2 \
    --rank_max 6 \
    --top_genes 3000 \
    --nrun 50 \
    --seed 123

echo ""
echo "================================================"
echo "Done!"
echo "================================================"