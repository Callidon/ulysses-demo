'use strict';

const QuartzClient = require('quartz-tpf');

const eventBus = new Vue();
const parser = document.createElement('a');
let sparqlIterator;

XMLHttpRequest.prototype.reallyOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function (method, url, flag) {
    parser.href = url;
    eventBus.$emit('proxy-url', parser.host);
    this.reallyOpen(method, url, flag);
};

const quartzDemo = new Vue({
  el: '#demoApp',
  data: {
    message: 'Hello Vue!',
    newServer: '',
    query: '',
    servers: [],
    mode: 'quartz+pen',
    vars: [],
    time: '???',
    results: [],
    calls: {},
    queryInProgress: false,
    presets: {
      servers: [
        {
          text: '2 equivalent Amazon instances',
          id: '2eq'
        },
        {
          text: '2 non equivalent Amazon instances',
          id: '2neq'
        },
        {
          text: '[DEBUG] localhost',
          id: 'debug'
        }
      ],
      queries: [
        {
          text: 'Query 73',
          value: 'SELECT DISTINCT ?v0 ?v2 WHERE { ?v0 <http://ogp.me/ns#tag> <http://db.uwaterloo.ca/~galuc/wsdbm/Topic83> . ?v2 <http://db.uwaterloo.ca/~galuc/wsdbm/likes> ?v0 }'
        }
      ]
    }
  },
  created: function () {
    const self = this;
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
    removeServer: function (id) {
      const index = this.servers.indexOf(id);
      if (index > -1) {
        this.servers.splice(index, 1);
      }
    },
    stop: function () {
      sparqlIterator.close();
      this.queryInProgress = false;
    },
    run: function () {
      if (this.servers.length > 0 && this.query !== '') {
        const self = this;
        // reset UI variables
        this.time = 'in progress';
        this.results = [];
        this.calls = {};
        this.queryInProgress = true;
        clearBarChart(barChart);

        const options = {};
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
        const interval = setInterval(function () {
          barChart.update();
        }, 2000);

        const client = new QuartzClient(this.servers[0]);
        client.setOption('locLimit', options.locLimit);
        client.setOption('usePeneloop', options.usePeneloop);
        client.buildPlan(this.query, this.servers)
        .then(function (plan) {
          self.vars = plan.variables;
          sparqlIterator = client.executePlan(plan, false);

          sparqlIterator.on('error', function (error) {
            console.error('ERROR: An error occurred during query execution.\n');
            console.error(error.stack);
          });

          sparqlIterator.on('end', function () {
            // cleanupo the daemon, redraw the plot and compute execution time
            window.clearInterval(interval);
            barChart.update();

            const endTime = Date.now();
            const time = endTime - startTime;
            self.time = (time / 1000) + 's';
            self.queryInProgress = false;
          });

          const startTime = Date.now();
          sparqlIterator.on('data', function (mappings) {
            self.results.push(mappings);
          });
        })
        .catch(function (error) {
          console.error(error);
        });
      }
    },
    loadServerPreset: function (id) {
      this.servers = [];
      switch (id) {
        case '2eq':
          this.servers.push('http://52.39.116.115/watDiv_100');
          this.servers.push('http://52.33.245.25/watDiv_100');
          break;
        case '2neq':
          this.servers.push('http://52.39.116.115/watDiv_100');
          this.servers.push('http://35.177.243.45/watDiv_100');
          break;
        case 'debug':
          this.servers.push('http://localhost:8000/watDiv_100');
          this.servers.push('http://localhost:8001/watDiv_100');
          break;
        default:
          break;
      }
    },
    loadQueryPreset: function (query) {
      this.query = query;
    }
  }
});
