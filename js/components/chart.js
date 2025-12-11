// js/components/chart.js - Chart.jsによるグラフ描画関連

import { formatHoursMinutes } from "../utils.js"; 

export function createPieChart(ctx, data, colorMap, showLegend = true) {
    if (!ctx || !data || typeof data !== 'object') {
        console.error("Invalid arguments provided to createPieChart.");
        return null;
    }

    const sortedData = Object.entries(data)
        .filter(([, value]) => value > 0)
        .sort(([, a], [, b]) => b - a); 

    if (sortedData.length === 0) {
        console.log("No data > 0 to display in pie chart.");
        return null; 
    }

    const labels = sortedData.map(([key]) => key); 
    const values = sortedData.map(([, value]) => value); 
    const backgroundColors = labels.map(
        (label) => colorMap[label] || generateRandomColor() 
    );

    try {
        const chart = new Chart(ctx, {
            type: "pie",
            data: {
                labels: labels,
                datasets: [
                    {
                        data: values,
                        backgroundColor: backgroundColors,
                        borderColor: '#ffffff', 
                        borderWidth: 1 
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, 
                plugins: {
                    legend: {
                        display: showLegend, 
                        position: 'top', 
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                let label = context.label || "";
                                if (label) {
                                    label += ": ";
                                }
                                if (context.parsed !== null) {
                                    label += formatHoursMinutes(context.parsed);
                                }
                                return label;
                            },
                        },
                    },
                    datalabels: {
                        formatter: (value, ctx) => {
                            if (!showLegend) {
                                const total = ctx.chart.getDatasetMeta(0).total;
                                const percentage = total > 0 ? (value / total) * 100 : 0;
                                const displayThreshold = 10;
                                if (percentage < displayThreshold) {
                                    return null; 
                                }

                                const label = ctx.chart.data.labels[ctx.dataIndex];
                                const maxLength = 6; 
                                const lines = [];
                                if (label) {
                                    for (let i = 0; i < label.length; i += maxLength) {
                                        lines.push(label.substring(i, i + maxLength));
                                    }
                                }
                                return lines; 
                            }
                            return null; 
                        },
                        color: '#333', 
                        anchor: 'end', 
                        align: 'end', 
                        offset: -10, 
                        font: {
                            size: 10, 
                        },
                    },
                },
            },
            plugins: [ChartDataLabels],
        });
        return chart;
    } catch (error) {
        console.error("Error creating pie chart:", error);
        return null;
    }
}

export function createLineChart(ctx, labels, datasets, titleText = "グラフ", yAxisTitle = "値") {
    if (!ctx || !Array.isArray(labels) || !Array.isArray(datasets)) {
        console.error("Invalid arguments provided to createLineChart.");
        return null;
    }

    if (datasets.length === 0 || datasets.every(ds => ds.data.length === 0)) {
         console.log("No data to display in line chart.");
         ctx.font = "16px sans-serif";
         ctx.textAlign = "center";
         ctx.fillText("データがありません", ctx.canvas.width / 2, ctx.canvas.height / 2);
         return null;
    }


    try {
        const chart = new Chart(ctx, {
            type: "line",
            data: {
                labels: labels,
                datasets: datasets, 
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, 
                interaction: { 
                    mode: 'index', // Use 'index' mode for tooltip
                    intersect: false,
                },
                plugins: {
                    legend: {
                        position: 'top', 
                        labels: {
                             boxWidth: 12,
                             padding: 15
                        }
                    },
                    title: {
                        display: true, 
                        text: titleText, 
                        font: { size: 16 }
                    },
                    datalabels: {
                         display: false
                    }
                },
                scales: {
                    x: { 
                        display: true,
                        grid: {
                             display: false 
                        }
                    },
                    y: { 
                        display: true,
                        beginAtZero: true, 
                        title: {
                            display: true, 
                            text: yAxisTitle, 
                        },
                        grid: {
                             color: '#e2e8f0' 
                        }
                    },
                },
            },
        });
        return chart;
    } catch (error) {
        console.error("Error creating line chart:", error);
        return null;
    }
}

export function destroyCharts(chartInstances) {
    if (!Array.isArray(chartInstances)) return;
    chartInstances.forEach((chart) => {
        if (chart && typeof chart.destroy === 'function') {
            try {
                chart.destroy();
            } catch (error) {
                console.error("Error destroying chart instance:", error, chart);
            }
        }
    });
}

function generateRandomColor() {
    const hue = Math.floor(Math.random() * 360);
    const saturation = 70; 
    const lightness = 60; 
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// ★追加部分
export function renderChart(canvas, labels, dataPoints, title) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const backgroundColors = labels.map(() => generateRandomColor());

    return new Chart(ctx, {
        type: 'doughnut', 
        data: {
            labels: labels,
            datasets: [{
                data: dataPoints,
                backgroundColor: backgroundColors,
                borderColor: '#ffffff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false, // ★修正: ここを false にして凡例を消す
                },
                title: {
                    display: false, 
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed !== null) {
                                label += context.parsed + ' 時間';
                            }
                            return label;
                        }
                    }
                },
                datalabels: {
                    display: false
                }
            }
        }
    });
}
