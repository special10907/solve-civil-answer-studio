import { getEl } from './dom-utils.js';

/**
 * UI Chart Module
 * Handles chart initialization and updates (e.g., vibration chart).
 */
const UIChart = {
  vibrationChart: null,

  initVibrationChart() {
    const vibCanvas = getEl("vibrationChart");
    if (!vibCanvas) return;

    const ctxVib = vibCanvas.getContext("2d");
    const dataPoints = [];
    const labels = [];

    // Initial calculation
    const zeta = 0.05;
    const Tn = 1.0;
    const wn = (2 * Math.PI) / Tn;
    const wd = wn * Math.sqrt(1 - zeta * zeta);

    for (let t = 0; t <= 5; t += 0.05) {
      const u = Math.exp(-zeta * wn * t) * Math.cos(wd * t);
      dataPoints.push(u);
      labels.push(t.toFixed(2));
    }

    this.vibrationChart = new Chart(ctxVib, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "변위 u(t)",
            data: dataPoints,
            borderColor: "rgb(147, 51, 234)",
            backgroundColor: "rgba(147, 51, 234, 0.1)",
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { title: { display: true, text: "Time (sec)" } },
          y: {
            title: { display: true, text: "Displacement (normalized)" },
            min: -1,
            max: 1,
          },
        },
        animation: { duration: 0 },
      },
    });

    this.bindVibrationControls();
  },

  bindVibrationControls() {
    const zetaInput = getEl("zetaInput");
    const tnInput = getEl("tnInput");
    const zetaValue = getEl("zetaValue");
    const tnValue = getEl("tnValue");

    if (!zetaInput || !tnInput) return;

    const updateFunc = () => {
      const zeta = parseFloat(zetaInput.value);
      const Tn = parseFloat(tnInput.value);

      if (zetaValue) zetaValue.innerText = zeta;
      if (tnValue) tnValue.innerText = Tn.toFixed(1);

      this.updateVibration(zeta, Tn);
    };

    zetaInput.addEventListener("input", updateFunc);
    tnInput.addEventListener("input", updateFunc);
  },

  updateVibration(zeta, Tn) {
    if (!this.vibrationChart) return;

    const wn = (2 * Math.PI) / Tn;
    const wd = wn * Math.sqrt(1 - zeta * zeta);

    const newData = [];
    for (let t = 0; t <= 5; t += 0.05) {
      const u = Math.exp(-zeta * wn * t) * Math.cos(wd * t);
      newData.push(u);
    }

    this.vibrationChart.data.datasets[0].data = newData;
    this.vibrationChart.update();
  },

  updateBuckling() {
    const kInput = getEl("kInput");
    if (!kInput) return;
    const K = parseFloat(kInput.value) || 1.0;
    const kValueEl = getEl("kValue");
    if (kValueEl) kValueEl.innerText = K.toFixed(1);

    const chart = window.bucklingChartInstance;
    if (!chart) return;

    const E = 205000;
    const Fy = 235;
    const newEuler = [];
    const newDesign = [];

    chart.data.labels.forEach((lam) => {
      const kLam = K * lam;
      let Fe = kLam === 0 ? Fy : (Math.PI * Math.PI * E) / (kLam * kLam);
      newEuler.push(Math.min(Fe, Fy * 1.5));
      let Fcr = Fe >= 0.44 * Fy ? Fy * Math.pow(0.658, Fy / Fe) : 0.877 * Fe;
      newDesign.push(Fcr);
    });

    chart.data.datasets[0].data = newEuler;
    chart.data.datasets[1].data = newDesign;
    chart.update();
  },

  exposeGlobal() {
    window.initVibrationChart = this.initVibrationChart.bind(this);
    window.updateVibration = this.updateVibration.bind(this);
    window.updateBuckling = this.updateBuckling.bind(this);
  }
};

export default UIChart;
