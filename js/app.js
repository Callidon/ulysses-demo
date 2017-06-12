'use strict';

var QuartzClient = require('quartz-tpf');

var eventBus = new Vue()
var parser = document.createElement('a');
var sparqlIterator;

XMLHttpRequest.prototype.reallyOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function(method, url, flag) {
    parser.href = url;
    eventBus.$emit('proxy-url', parser.host);
    this.reallyOpen(method, url, flag);
};


var quartzDemo = new Vue({
  el: '#demoApp',
  data: {
    message: 'Hello Vue!',
    newServer: '',
    query: 'SELECT DISTINCT ?v0 ?v2 WHERE { ?v0 <http://ogp.me/ns#tag> <http://db.uwaterloo.ca/~galuc/wsdbm/Topic83> . ?v2 <http://db.uwaterloo.ca/~galuc/wsdbm/likes> ?v0 }',
    servers: [
      'http://localhost:8000/watDiv_100',
      'http://localhost:8001/watDiv_100'
    ],
    mode: 'tpf',
    vars: [],
    time: '???',
    results: [],
    calls: {},
    queryInProgress: false
  },
  created: function () {
    var self = this;
    eventBus.$on('proxy-url', function (url) {
      if (self.calls[url] === undefined) {
        self.calls[url] = 1;
        updateChartLabels(barChart, Object.keys(self.calls));
      } else {
        self.calls[url]++;
      }
      updateChartData(barChart, Object.values(self.calls));
    });
  },
  methods: {
    serverGreen: function (index) {
      return this.mode.includes('quartz') || (this.mode.includes('tpf') && index === 0);
    },
    serverRed: function (index) {
      return ! this.serverGreen(index);
    },
    addServer: function () {
      if (this.newServer !== '') {
        this.servers.push(this.newServer);
        this.newServer = '';
      }
    },
    removeServer: function(id) {
      var index = this.servers.indexOf(id);
      if (index > -1) {
        this.servers.splice(index, 1);
      }
    },
    stop: function () {
      sparqlIterator.close();
      this.queryInProgress = false;
    },
    run: function () {
      // reset UI variables
      this.time = 'in progress';
      this.results = [];
      this.calls = {};
      this.queryInProgress = true;
      clearBarChart(barChart);

      var options = {};
      // determine mode
      switch (this.mode) {
        case 'tpf':
          options.locLimit = 0;
          options.usePeneloop = false;
          break;
        case 'tpf+pen':
          options.locLimit = 0;
          options.usePeneloop = true;
          break;
        case 'quartz':
          options.locLimit = 1;
          options.usePeneloop = false;
          break;
        case 'quartz+pen':
          options.locLimit = 1;
          options.usePeneloop = true;
          break;
        default:
          break;
      }

      // setup a daemon to update the chart
      var interval = setInterval(function() {
        barChart.update();
      }, 2000);

      var client = new QuartzClient(this.servers[0]);
      client.setOption('locLimit', options.locLimit);
      client.setOption('usePeneloop', options.usePeneloop);
      client.buildPlan(this.query, this.servers)
      .then(plan => {
        this.vars = plan.variables;
        sparqlIterator = client.executePlan(plan, false);

        sparqlIterator.on('error', error => {
          console.error('ERROR: An error occurred during query execution.\n');
          console.error(error.stack);
        });

        sparqlIterator.on('end', () => {
          // cleanupo the daemon, redraw the plot and compute execution time
          window.clearInterval(interval);
          barChart.update();

          var endTime = Date.now();
          var time = endTime - startTime;
          this.time = (time / 1000) + 's';
          this.queryInProgress = false;
        });

        var startTime = Date.now();
        sparqlIterator.on('data', mappings => this.results.push(mappings));
      })
      .catch(error => console.error(error));
    }
  }
})
