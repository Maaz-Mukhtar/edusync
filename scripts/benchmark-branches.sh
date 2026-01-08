#!/bin/bash

# Performance Benchmark Script
# Runs performance tests on each fix branch and compares results

set -e

BRANCHES=("main" "fix/swr-caching" "fix/server-components" "fix/nextjs-caching")
RESULTS_DIR="tests/benchmark-results"
CURRENT_BRANCH=$(git branch --show-current)

echo "========================================"
echo "  Performance Benchmark Script"
echo "========================================"
echo ""

# Create results directory
mkdir -p "$RESULTS_DIR"

# Function to run test on a branch
run_test() {
    local branch=$1
    echo ""
    echo "----------------------------------------"
    echo "Testing branch: $branch"
    echo "----------------------------------------"

    # Checkout branch
    git checkout "$branch" --quiet

    # Install dependencies (in case they differ between branches)
    npm install --silent

    # Export branch name for the test
    export GIT_BRANCH="$branch"

    # Run the performance test
    npx playwright test tests/performance.spec.ts --reporter=list 2>&1 | tee "$RESULTS_DIR/$branch.log"

    # Copy results file
    if [ -f "tests/results-${branch//\//-}.json" ]; then
        cp "tests/results-${branch//\//-}.json" "$RESULTS_DIR/"
    fi
}

# Run tests on each branch
for branch in "${BRANCHES[@]}"; do
    run_test "$branch"
done

# Return to original branch
echo ""
echo "----------------------------------------"
echo "Returning to original branch: $CURRENT_BRANCH"
echo "----------------------------------------"
git checkout "$CURRENT_BRANCH" --quiet

# Generate comparison report
echo ""
echo "========================================"
echo "  COMPARISON REPORT"
echo "========================================"
echo ""

# Create comparison script
node -e "
const fs = require('fs');
const path = require('path');

const resultsDir = '$RESULTS_DIR';
const branches = ['main', 'fix/swr-caching', 'fix/server-components', 'fix/nextjs-caching'];
const results = {};

for (const branch of branches) {
    const filename = path.join(resultsDir, 'results-' + branch.replace(/\\//g, '-') + '.json');
    if (fs.existsSync(filename)) {
        results[branch] = JSON.parse(fs.readFileSync(filename, 'utf8'));
    }
}

if (Object.keys(results).length === 0) {
    console.log('No results found!');
    process.exit(1);
}

// Print comparison table
console.log('Branch                    | Total Avg (ms) | Dashboard | Attendance | Gradebook | Assessments');
console.log('--------------------------|----------------|-----------|------------|-----------|------------');

for (const branch of branches) {
    if (results[branch]) {
        const r = results[branch];
        const pageResults = {};
        for (const page of r.results) {
            pageResults[page.page] = page.average;
        }
        console.log(
            branch.padEnd(25) + ' | ' +
            String(r.totalAverage).padStart(14) + ' | ' +
            String(pageResults['Dashboard'] || '-').padStart(9) + ' | ' +
            String(pageResults['Attendance'] || '-').padStart(10) + ' | ' +
            String(pageResults['Gradebook'] || '-').padStart(9) + ' | ' +
            String(pageResults['Assessments'] || '-').padStart(11)
        );
    }
}

console.log('');

// Calculate improvements
if (results['main']) {
    const baseline = results['main'].totalAverage;
    console.log('Improvement vs main:');
    console.log('--------------------');
    for (const branch of branches) {
        if (branch !== 'main' && results[branch]) {
            const improvement = baseline - results[branch].totalAverage;
            const percentage = ((improvement / baseline) * 100).toFixed(1);
            console.log('  ' + branch + ': ' + (improvement > 0 ? '-' : '+') + Math.abs(improvement) + 'ms (' + (improvement > 0 ? '-' : '+') + Math.abs(percentage) + '%)');
        }
    }
}
"

echo ""
echo "========================================"
echo "  Benchmark complete!"
echo "  Results saved to: $RESULTS_DIR/"
echo "========================================"
