// Chart Configuration and Instances
Chart.defaults.color = '#9ca3af'; 
Chart.defaults.borderColor = '#374151';

export let staffChartInst = null;
export let adminOverallChartInst = null;
export let adminProfitChartInst = null;

export const destroyChart = (instance) => {
    if (instance) instance.destroy();
};

export const renderStaffChart = (ctx, transactions) => {
    const labels = transactions.slice(-10).map(t => new Date(t.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}));
    const data = transactions.slice(-10).map(t => t.money || 0);

    return new Chart(ctx, {
        type: 'line', 
        data: { labels, datasets: [{ label: '$ Collected', data, borderColor: '#3b82f6', tension: 0.4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
};