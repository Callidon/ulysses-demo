'use strict'

const colors = [
  'rgba(255, 99, 132, 0.75)',
  'rgba(54, 162, 235, 0.75)',
  'rgba(255, 206, 86, 0.75)',
  'rgba(75, 192, 192, 0.75)',
  'rgba(153, 102, 255, 0.75)',
  'rgba(255, 159, 64, 0.75)'
]

function buildCallsChart (canvasId, servers) {
  const ctx = document.getElementById(canvasId)
  const datasets = servers.map((url, index) => {
    return {
      label: url,
      backgroundColor: colors[index],
      borderColor: colors[index],
      data: [],
      fill: false
    }
  })
  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: [],
      datasets: datasets
    },
    options: {
      scales: {
        xAxes: [ {
          scaleLabel: {
            display: true,
            labelString: 'TPF servers',
            fontSize: 15
          }
        } ],
        yAxes: [ {
          ticks: {
            display: true,
            labelString: 'Number of HTTP calls per server',
            fontSize: 15,
            beginAtZero: true
          }
        } ]
      }
    }
  })
}

function updateChartLabels (chart, labels) {
  chart.data.labels = labels
}

function updateChartData (chart, values) {
  values.forEach((v, index) => {
    chart.data.datasets[index].data = [v]
  })
}

function clearBarChart (chart) {
  chart.data.labels = []
  chart.data.datasets[0].data = []
  chart.update()
}

// Real-time capacity factor
function buildLineChart (canvasId, servers, xLabel, yLabel) {
  const ctx = document.getElementById(canvasId)
  const datasets = servers.map((url, index) => {
    return {
      label: url,
      backgroundColor: colors[index],
      borderColor: colors[index],
      data: [],
      fill: false
    }
  })
  return new Chart(ctx, {
    type: 'line',
    data: {
      datasets: datasets
    },
    options: {
      responsive: true,
      title: {
        display: false,
        text: ''
      },
      tooltips: {
        mode: 'index',
        intersect: false
      },
      hover: {
        mode: 'nearest',
        intersect: true
      },
      scales: {
        xAxes: [{
          display: true,
          scaleLabel: {
            display: true,
            labelString: xLabel,
            fontSize: 15
          }
        }],
        yAxes: [{
          display: true,
          ticks: {
            beginAtZero: true,
            display: true,
            labelString: yLabel,
            fontSize: 15
          }
        }]
      }
    }
  })
}

function updateLineChart (chart, values, time = 0) {
  chart.data.labels.push(time)
  values.forEach((value, index) => {
    chart.data.datasets[index].data.push(value)
  })
}

function clearChart (chart) {
  if (chart) {
    chart.data.labels = []
    chart.data.datasets = []
  }
}
