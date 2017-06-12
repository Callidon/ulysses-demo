'use strict';
var ctx = document.getElementById("httpCalls");

var barChart = new Chart(ctx, {
  type: 'bar',
  data: {
    labels: [],
    datasets: [{
      label: '',
      data: [],
      backgroundColor: [
        'rgba(255, 99, 132, 0.2)',
        'rgba(54, 162, 235, 0.2)',
        'rgba(255, 206, 86, 0.2)',
        'rgba(75, 192, 192, 0.2)',
        'rgba(153, 102, 255, 0.2)',
        'rgba(255, 159, 64, 0.2)'
      ],
      borderColor: [
        'rgba(255,99,132,1)',
        'rgba(54, 162, 235, 1)',
        'rgba(255, 206, 86, 1)',
        'rgba(75, 192, 192, 1)',
        'rgba(153, 102, 255, 1)',
        'rgba(255, 159, 64, 1)'
      ],
      borderWidth: 1
    }]
  },
  options: {
    scales: {
      xAxes: [{
        scaleLabel: {
          display: true,
          labelString: 'TPF servers',
          fontSize: 15
        }
      }],
      yAxes: [{
        scaleLabel: {
          display: true,
          labelString: 'Number of HTTP calls per server',
          fontSize: 15
        },
        ticks: {
          beginAtZero:true
        }
      }]
    }
  }
});

function updateChartLabels (chart, labels) {
  chart.data.labels = labels;
}

function updateChartData (chart, values) {
  chart.data.datasets[0].data = values;
}

function clearBarChart (chart) {
  chart.data.labels = [];
  chart.data.datasets[0].data = [];
  chart.update();
}
