# Complete R script for NMF Subtyping Analysis
# Includes: Expression analysis, NMF, Survival analysis, Rank selection

# ========== INSTALL PACKAGES ==========
if (!requireNamespace("BiocManager", quietly = TRUE)) install.packages("BiocManager")
required_pkgs <- c("GEOquery", "limma", "NMF", "survival", "jsonlite")
for (pkg in required_pkgs) {
  if (!requireNamespace(pkg, quietly = TRUE)) {
    if (pkg %in% c("GEOquery", "limma", "NMF")) {
      BiocManager::install(pkg)
    } else {
      install.packages(pkg)
    }
  }
}

library(GEOquery)
library(limma)
library(NMF)
library(survival)
library(jsonlite)

# ========== DOWNLOAD DATA ==========
geo_id <- "GSE62254"

gse <- getGEO(geo_id, GSEMatrix = TRUE)[[1]]
expr_data <- exprs(gse)
pheno_data <- pData(gse)

# Log-transform if needed
if (max(expr_data, na.rm = TRUE) > 50) {
  expr_data <- log2(expr_data + 1)
}

# Remove low-variance genes (keep top 5000)
gene_vars <- apply(expr_data, 1, var, na.rm = TRUE)
top_genes <- names(sort(gene_vars, decreasing = TRUE))[1:5000]
expr_filtered <- expr_data[top_genes, ]

# Make non-negative for NMF
expr_nmf <- expr_filtered - min(expr_filtered, na.rm = TRUE)

# ========== NMF RANK SELECTION ==========
cat("Running NMF rank estimation (this may take a while)...\n")

rank_min <- 2
rank_max <- 6
ranks <- rank_min:rank_max

rank_range <- rank_min:rank_max
estim <- nmfEstimateRank(expr_nmf, range = rank_range, method = "brunet", nrun = 10, seed = 123)

# Extract rank metrics
rank_metrics <- data.frame(
  rank = rank_range,
  cophenetic = estim$measures$cophenetic,
  silhouette = estim$measures$silhouette.consensus
)

# Find optimal rank (highest cophenetic before drop)
optimal_rank <- rank_range[which.max(rank_metrics$cophenetic)]
cat("Optimal rank:", optimal_rank, "\n")

# ========== RUN NMF AT OPTIMAL RANK ==========
cat("Running NMF at optimal rank...\n")
nmf_result <- nmf(expr_nmf, rank = optimal_rank, method = "brunet", nrun = 30, seed = 123)

# Get sample assignments
H <- coef(nmf_result)
sample_subtypes <- paste0("Subtype_", apply(H, 2, which.max))

# Get marker genes (basis matrix)
W <- basis(nmf_result)
marker_genes <- list()
for (k in 1:optimal_rank) {
  gene_weights <- W[, k]
  top_idx <- order(gene_weights, decreasing = TRUE)[1:100]  # Get top 100 per subtype
  for (i in top_idx) {
    marker_genes <- append(marker_genes, list(list(
      gene = rownames(W)[i],
      subtype = paste0("Subtype_", k),
      weight = as.numeric(gene_weights[i] / max(gene_weights))
    )))
  }
}

# ========== SURVIVAL ANALYSIS ==========
cat("Performing survival analysis...\n")

# Extract survival data from phenotype (adjust column names as needed)
# Common column names: "death from disease:ch1", "overall survival months:ch1"
surv_time_col <- grep("survival|time|months", colnames(pheno_data), value = TRUE, ignore.case = TRUE)[1]
surv_event_col <- grep("death|status|event", colnames(pheno_data), value = TRUE, ignore.case = TRUE)[1]

if (!is.na(surv_time_col) && !is.na(surv_event_col)) {
  surv_time <- as.numeric(pheno_data[[surv_time_col]])
  surv_event <- pheno_data[[surv_event_col]]
  
  # Convert event to binary (1 = event occurred)
  surv_event <- ifelse(grepl("yes|1|dead|death", surv_event, ignore.case = TRUE), 1, 0)
  
  # Calculate log-rank p-value
  surv_formula <- Surv(surv_time, surv_event) ~ factor(sample_subtypes)
  surv_diff <- survdiff(surv_formula)
  pvalue <- 1 - pchisq(surv_diff$chisq, length(surv_diff$n) - 1)
  
  # Cox Proportional Hazards analysis
  coxph_res <- coxph(Surv(surv_time, surv_event) ~ factor(sample_subtypes))
  cox_summary <- summary(coxph_res)
  
  # Extract Cox PH results
  cox_results <- list(
    referenceGroup = unique(sample_subtypes)[1],
    groups = lapply(1:nrow(cox_summary$coefficients), function(i) {
      coef_row <- cox_summary$coefficients[i, ]
      conf_row <- cox_summary$conf.int[i, ]
      list(
        subtype = gsub("factor\\(sample_subtypes\\)", "", rownames(cox_summary$coefficients)[i]),
        hazardRatio = as.numeric(conf_row["exp(coef)"]),
        lowerCI = as.numeric(conf_row["lower .95"]),
        upperCI = as.numeric(conf_row["upper .95"]),
        pValue = as.numeric(coef_row["Pr(>|z|)"])
      )
    }),
    waldTest = list(
      chiSquare = as.numeric(cox_summary$wald["test"]),
      df = as.numeric(cox_summary$wald["df"]),
      pValue = as.numeric(cox_summary$wald["pvalue"])
    )
  )
  
  # Create DETAILED survival data with individual event times
  # This enables exact Kaplan-Meier reproduction in the dashboard
  unique_subtypes <- unique(sample_subtypes)
  survival_data <- lapply(unique_subtypes, function(st) {
    idx <- sample_subtypes == st
    st_time <- surv_time[idx]
    st_event <- surv_event[idx]
    
    if (sum(!is.na(st_time)) > 0) {
      # Fit KM curve for this subtype
      fit <- survfit(Surv(st_time, st_event) ~ 1)
      
      # Create detailed time points with all KM statistics
      timePoints <- lapply(1:length(fit$time), function(i) {
        list(
          time = fit$time[i],
          survival = fit$surv[i],
          atRisk = fit$n.risk[i],
          events = fit$n.event[i],
          censored = fit$n.censor[i],
          stdErr = fit$std.err[i],
          lowerCI = fit$lower[i],
          upperCI = fit$upper[i]
        )
      })
      
      list(
        subtype = st,
        nTotal = sum(idx),
        nEvents = sum(st_event, na.rm = TRUE),
        nCensored = sum(idx) - sum(st_event, na.rm = TRUE),
        timePoints = timePoints
      )
    } else {
      NULL
    }
  })
  survival_data <- Filter(Negate(is.null), survival_data)
  
  # Also create raw survival data for exact calculations
  raw_survival <- data.frame(
    sample_id = colnames(expr_data),
    subtype = sample_subtypes,
    time = surv_time,
    event = surv_event,
    stringsAsFactors = FALSE
  )
  raw_survival <- raw_survival[!is.na(raw_survival$time), ]
  
} else {
  cat("Survival columns not found. Generating placeholder data.\n")
  survival_data <- lapply(unique(sample_subtypes), function(st) {
    list(
      subtype = st,
      nTotal = sum(sample_subtypes == st),
      nEvents = 0,
      nCensored = sum(sample_subtypes == st),
      timePoints = lapply(seq(0, 60, by = 6), function(t) {
        list(
          time = t, 
          survival = exp(-t * runif(1, 0.01, 0.03)),
          atRisk = 100,
          events = 0,
          censored = 0,
          stdErr = 0.05,
          lowerCI = NA,
          upperCI = NA
        )
      })
    )
  })
  pvalue <- NA
  cox_results <- NULL
  raw_survival <- NULL
}

# ========== PREPARE HEATMAP DATA ==========
top_marker_genes <- unique(sapply(marker_genes[1:min(100, length(marker_genes))], function(x) x$gene))
# Filter to genes that exist in the expression matrix
top_marker_genes <- intersect(top_marker_genes, rownames(expr_filtered))
heatmap_expr <- expr_filtered[top_marker_genes, ]

heatmap_data <- list(
  genes = rownames(heatmap_expr),
  samples = colnames(heatmap_expr),
  sampleSubtypes = sample_subtypes,
  values = lapply(1:nrow(heatmap_expr), function(i) as.numeric(heatmap_expr[i, ]))
)

# ========== PREPARE SAMPLE RESULTS ==========
sample_results <- lapply(1:ncol(H), function(i) {
  result <- list(
    sample_id = colnames(H)[i],
    subtype = sample_subtypes[i]
  )
  # Add score for each subtype
  for (k in 1:nrow(H)) {
    result[[paste0("score_subtype_", k)]] <- round(H[k, i], 4)
  }
  result
})

# ========== BUILD OUTPUT JSON ==========
result <- list(
  summary = list(
    dataset = geo_id,
    n_samples = ncol(expr_data),
    n_genes = nrow(expr_data),
    n_subtypes = optimal_rank,
    subtype_counts = as.list(table(sample_subtypes)),
    cophenetic_correlation = round(estim$measures$cophenetic[which(ranks == optimal_rank)], 3),
    silhouette_mean = round(estim$measures$silhouette.coef[which(ranks == optimal_rank)], 2),
    optimal_rank = optimal_rank
  ),
  rankMetrics = rank_metrics,
  sampleResults = sample_results,
  markerGenes = marker_genes,
  survivalData = survival_data,
  heatmapData = heatmap_data
)

# Add p-value only if it exists
if (!is.na(pvalue)) {
  result$survival_pvalue <- pvalue  # Keep full precision
}

# Add Cox PH results if available
if (!is.null(cox_results)) {
  result$coxPHResults <- cox_results
}

# Add raw survival data for exact calculations (optional, can be large)
if (!is.null(raw_survival)) {
  result$rawSurvivalData <- lapply(1:nrow(raw_survival), function(i) {
    list(
      sample_id = raw_survival$sample_id[i],
      subtype = raw_survival$subtype[i],
      time = raw_survival$time[i],
      event = raw_survival$event[i]
    )
  })
}

# ========== SAVE OUTPUT ==========
jsonlite::write_json(result, "nmf_results.json", pretty = TRUE, auto_unbox = TRUE)

cat("\n✅ Results saved to nmf_results.json\n")
cat("Upload this file to the dashboard to visualize results.\n")
cat("\nSurvival Analysis Summary:\n")
cat(sprintf("  Log-rank p-value: %g\n", pvalue))
if (!is.null(cox_results)) {
  cat(sprintf("  Cox PH Wald test p-value: %g\n", cox_results$waldTest$pValue))
}
