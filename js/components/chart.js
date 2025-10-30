// js/components/chart.js - Chart.jsによるグラフ描画関連

// Chart.js本体とプラグインはindex.htmlで読み込む想定
// import Chart from 'chart.js/auto'; // モジュールとして使う場合
// import ChartDataLabels from 'chartjs-plugin-datalabels'; // モジュールとして使う場合
// Chart.register(ChartDataLabels); // モジュールとして使う場合

import { formatHoursMinutes } from "../utils.js"; // 時間フォーマット関数

/**
 * 円グラフ (Pie Chart) を生成して返します。
 * @param {CanvasRenderingContext2D} ctx - グラフを描画するCanvasのコンテキスト。
 * @param {object} data - グラフデータオブジェクト { label: value, ... }。
 * @param {object} colorMap - ラベルに対応する色のマップ { label: colorString, ... }。
 * @param {boolean} [showLegend=true] - 凡例を表示するかどうか。
 * @returns {Chart|null} 生成されたChart.jsインスタンス、またはエラー時にnull。
 */
export function createPieChart(ctx, data, colorMap, showLegend = true) {
    if (!ctx || !data || typeof data !== 'object') {
        console.error("Invalid arguments provided to createPieChart.");
        return null;
    }

    // データを値の降順でソートし、値が0より大きいもののみを対象とする
    const sortedData = Object.entries(data)
        .filter(([, value]) => value > 0)
        .sort(([, a], [, b]) => b - a); // 降順ソート

    if (sortedData.length === 0) {
        console.log("No data > 0 to display in pie chart.");
        // Optional: Display a message on the canvas
        // ctx.font = "16px sans-serif";
        // ctx.textAlign = "center";
        // ctx.fillText("データがありません", ctx.canvas.width / 2, ctx.canvas.height / 2);
        return null; // データがない場合はグラフを生成しない
    }

    const labels = sortedData.map(([key]) => key); // ラベル配列
    const values = sortedData.map(([, value]) => value); // 値配列
    const backgroundColors = labels.map(
        (label) => colorMap[label] || generateRandomColor() // カラーマップにない場合はランダム色
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
                        borderColor: '#ffffff', // Optional: Add white border between slices
                        borderWidth: 1 // Optional: Border width
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, // Allows height/width control via container
                plugins: {
                    legend: {
                        display: showLegend, // 凡例の表示/非表示
                        position: 'top', // 凡例の位置
                    },
                    tooltip: {
                        callbacks: {
                            // ツールチップに表示されるラベルをフォーマット
                            label: function (context) {
                                let label = context.label || "";
                                if (label) {
                                    label += ": ";
                                }
                                if (context.parsed !== null) {
                                    // 秒数を「X時間 Y分」にフォーマット
                                    label += formatHoursMinutes(context.parsed);
                                }
                                return label;
                            },
                        },
                    },
                    // データラベルプラグイン (chartjs-plugin-datalabels) の設定
                    datalabels: {
                        formatter: (value, ctx) => {
                            // 特定の条件下でのみラベルを表示する場合 (例: 個人別グラフで凡例非表示時)
                            if (!showLegend) {
                                const total = ctx.chart.getDatasetMeta(0).total;
                                const percentage = total > 0 ? (value / total) * 100 : 0;
                                // 一定割合以下のラベルは非表示にする (例: 10%)
                                const displayThreshold = 10;
                                if (percentage < displayThreshold) {
                                    return null; // しきい値未満は非表示
                                }

                                // ラベル文字列を取得し、必要なら改行する
                                const label = ctx.chart.data.labels[ctx.dataIndex];
                                const maxLength = 6; // 1行あたりの最大文字数 (調整可能)
                                const lines = [];
                                if (label) {
                                    for (let i = 0; i < label.length; i += maxLength) {
                                        lines.push(label.substring(i, i + maxLength));
                                    }
                                }
                                // return `${Math.round(percentage)}%`; // 割合を表示する場合
                                return lines; // ラベル文字列（改行含む）を返す
                            }
                            return null; // 凡例表示時はグラフ内ラベルを非表示
                        },
                        color: '#333', // ラベルの色
                        anchor: 'end', // ラベルの表示位置（'center', 'start', 'end'）
                        align: 'end', // ラベルの整列位置（'center', 'start', 'end', 'top', 'bottom' など）
                        offset: -10, // アンカーからのオフセット距離
                        // clamp: true, // グラフ領域内にラベルを収める
                        font: {
                            size: 10, // ラベルのフォントサイズ (調整可能)
                            // weight: 'bold'
                        },
                    },
                },
            },
            // datalabelsプラグインを登録 (index.htmlでグローバル登録している場合は不要な場合あり)
            plugins: [ChartDataLabels],
        });
        return chart;
    } catch (error) {
        console.error("Error creating pie chart:", error);
        return null;
    }
}

/**
 * 折れ線グラフ (Line Chart) を生成して返します。
 * @param {CanvasRenderingContext2D} ctx - グラフを描画するCanvasのコンテキスト。
 * @param {string[]} labels - X軸のラベル配列。
 * @param {Array<object>} datasets - Chart.jsのデータセットオブジェクトの配列。各オブジェクトは { label, data, borderColor, backgroundColor, fill, tension, ... } 形式。
 * @param {string} titleText - グラフ上部に表示するタイトル。
 * @param {string} yAxisTitle - Y軸のタイトル。
 * @returns {Chart|null} 生成されたChart.jsインスタンス、またはエラー時にnull。
 */
export function createLineChart(ctx, labels, datasets, titleText = "グラフ", yAxisTitle = "値") {
    if (!ctx || !Array.isArray(labels) || !Array.isArray(datasets)) {
        console.error("Invalid arguments provided to createLineChart.");
        return null;
    }

    if (datasets.length === 0 || datasets.every(ds => ds.data.length === 0)) {
         console.log("No data to display in line chart.");
         // Optional: Display a message on the canvas
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
                datasets: datasets, // 渡されたデータセットをそのまま使用
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, // コンテナサイズに追従させる
                interaction: { // ツールチップの表示モード
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        position: 'top', // 凡例の位置
                        labels: {
                             boxWidth: 12,
                             padding: 15
                        }
                    },
                    title: {
                        display: true, // タイトルを表示
                        text: titleText, // グラフタイトル
                        font: { size: 16 }
                    },
                    tooltip: {
                        position: 'nearest',
                        callbacks: {
                             // ツールチップの各項目の値をフォーマット (必要に応じて)
                            // label: function (context) {
                            //    let label = context.dataset.label || '';
                            //    if (label) { label += ': '; }
                            //    if (context.parsed.y !== null) { label += context.parsed.y; }
                            //    return label;
                            // }
                        }
                    },
                    // データラベルは折れ線グラフでは通常非表示
                    datalabels: {
                         display: false
                    }
                },
                scales: {
                    x: { // X軸設定
                        display: true,
                        title: {
                            display: false, // X軸タイトルは通常不要
                            // text: '日付'
                        },
                        grid: {
                             display: false // X軸のグリッド線は非表示にすることが多い
                        }
                    },
                    y: { // Y軸設定
                        display: true,
                        beginAtZero: true, // Y軸を0から始める
                        title: {
                            display: true, // Y軸タイトルを表示
                            text: yAxisTitle, // Y軸タイトル
                        },
                        grid: {
                             color: '#e2e8f0' // Y軸グリッド線の色を薄くする (Tailwind gray-200)
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

/**
 * Chart.jsインスタンスの配列を受け取り、それぞれを破棄します。
 * @param {Array<Chart>} chartInstances - 破棄するChart.jsインスタンスの配列。
 */
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
    console.log(`Destroyed ${chartInstances.length} chart(s).`);
}


/**
 * ランダムなHSLカラー文字列を生成します（フォールバック用）。
 * @returns {string} HSLカラー文字列 (例: "hsl(120, 70%, 60%)")。
 */
function generateRandomColor() {
    const hue = Math.floor(Math.random() * 360);
    const saturation = 70; // 彩度を固定
    const lightness = 60; // 明度を固定
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}
