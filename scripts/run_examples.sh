#!/bin/bash

# Example usage script for NMF Analysis CLI
# This demonstrates different ways to run the analysis

echo "================================================"
echo "NMF Analysis - Example Usage Scenarios"
echo "================================================"
echo ""

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
echo "Available Examples:"
echo "================================================"
echo ""
echo "1. Download and analyze GEO dataset (GSE62254)"
echo "2. Analyze local files (example paths)"
echo "3. Custom parameters (rank range, genes, runs)"
echo "4. Show help message"
echo ""
read -p "Select an example (1-4): " choice

case $choice in
    1)
        echo ""
        echo "================================================"
        echo "Example 1: Download from GEO"
        echo "================================================"
        echo ""
        echo "Command:"
        echo "Rscript nmf_analysis_cli.R \\"
        echo "  --geo_id GSE62254 \\"
        echo "  --dataset GSE62254 \\"
        echo "  --output_dir results/geo_example"
        echo ""
        read -p "Run this example? (y/n): " confirm
        if [ "$confirm" == "y" ]; then
            Rscript nmf_analysis_cli.R \
                --geo_id GSE62254 \
                --dataset GSE62254 \
                --output_dir results/geo_example
        fi
        ;;
    
    2)
        echo ""
        echo "================================================"
        echo "Example 2: Analyze local files"
        echo "================================================"
        echo ""
        echo "Command:"
        echo "Rscript nmf_analysis_cli.R \\"
        echo "  --dataset MyDataset \\"
        echo "  --expr_file /path/to/expression_matrix.txt \\"
        echo "  --samples_annot_file /path/to/sample_annotations.txt \\"
        echo "  --output_dir results/local_example"
        echo ""
        echo "NOTE: You need to provide actual file paths"
        echo ""
        read -p "Enter path to expression file: " expr_file
        read -p "Enter path to annotation file: " annot_file
        
        if [ -f "$expr_file" ] && [ -f "$annot_file" ]; then
            Rscript nmf_analysis_cli.R \
                --dataset MyDataset \
                --expr_file "$expr_file" \
                --samples_annot_file "$annot_file" \
                --output_dir results/local_example
        else
            echo "ERROR: One or both files not found!"
        fi
        ;;
    
    3)
        echo ""
        echo "================================================"
        echo "Example 3: Custom parameters"
        echo "================================================"
        echo ""
        echo "Command:"
        echo "Rscript nmf_analysis_cli.R \\"
        echo "  --dataset CustomAnalysis \\"
        echo "  --expr_file /path/to/expression_matrix.txt \\"
        echo "  --samples_annot_file /path/to/sample_annotations.txt \\"
        echo "  --output_dir results/custom_example \\"
        echo "  --rank_min 3 \\"
        echo "  --rank_max 8 \\"
        echo "  --top_genes 3000 \\"
        echo "  --nrun 50 \\"
        echo "  --seed 456"
        echo ""
        echo "NOTE: You need to provide actual file paths"
        echo ""
        read -p "Enter path to expression file: " expr_file
        read -p "Enter path to annotation file: " annot_file
        
        if [ -f "$expr_file" ] && [ -f "$annot_file" ]; then
            Rscript nmf_analysis_cli.R \
                --dataset CustomAnalysis \
                --expr_file "$expr_file" \
                --samples_annot_file "$annot_file" \
                --output_dir results/custom_example \
                --rank_min 3 \
                --rank_max 8 \
                --top_genes 3000 \
                --nrun 50 \
                --seed 456
        else
            echo "ERROR: One or both files not found!"
        fi
        ;;
    
    4)
        echo ""
        echo "================================================"
        echo "Help Message"
        echo "================================================"
        echo ""
        Rscript nmf_analysis_cli.R --help
        ;;
    
    *)
        echo "Invalid choice. Please run again and select 1-4."
        exit 1
        ;;
esac

echo ""
echo "================================================"
echo "Done!"
echo "================================================"
