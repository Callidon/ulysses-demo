'use strict';

const QuartzClient = require('quartz-tpf');

const eventBus = new Vue();
const parser = document.createElement('a');
let sparqlIterator;

XMLHttpRequest.prototype.reallyOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function (method, url, flag) {
    parser.href = url;
    // uniform amazon EC2 URLs
    const index = parser.host.indexOf('ec2-');
    if (index > -1) {
      const newUrl = parser.host.substring(index + 4, parser.host.indexOf('.'));
      eventBus.$emit('proxy-url', newUrl.replace(/-/gi, '.'));
    } else {
      eventBus.$emit('proxy-url', parser.host);
    }
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
    model: null,
    time: '???',
    results: [],
    calls: {},
    currentServersPreset: 'none',
    currentQueryPreset: '',
    queryInProgress: false,
    presets: {
      servers: {
        dbpedia: [
          {
            text: '2 instances of DBpedia 2015-10',
            id: 'dbpedia2015'
          }
        ],
        watdiv: [
          // {
          //   text: '2 localhost WatDiv servers',
          //   id: 'debug2'
          // },
          {
            text: '1 WatDiv Amazon instances twice',
            id: '1eq'
          },
          {
            text: '2 equivalent WatDiv Amazon instances',
            id: '2eq'
          },
          {
            text: '2 non equivalent WatDiv Amazon instances',
            id: '2neq'
          },
          {
            text: '3 equivalent WatDiv Amazon instances',
            id: '3eq'
          },
          {
            text: '4 equivalent WatDiv Amazon instances',
            id: '4eq'
          }
        ]
      },
      queries: {
        dbpedia: [
          {
            text: 'Actors born in the U.S.A (DBpedia)',
            value: 'PREFIX dbo: <http://dbpedia.org/ontology/> PREFIX dbpedia: <http://dbpedia.org/resource/> SELECT ?actor ?city WHERE { ?actor a dbo:Actor. ?actor dbo:birthPlace ?city. ?city dbo:country dbpedia:United_States. } LIMIT 3000'
          }
        ],
        watdiv: [
          {
            text: 'Short query (Query 73 - WatDiv)',
            value: 'SELECT DISTINCT ?v0 ?v2 WHERE { ?v0 <http://ogp.me/ns#tag> <http://db.uwaterloo.ca/~galuc/wsdbm/Topic83> . ?v2 <http://db.uwaterloo.ca/~galuc/wsdbm/likes> ?v0 }'
          },
          {
            text: 'Heavy query (Query 23 - WatDiv)',
            value: 'SELECT DISTINCT ?v0 ?v1 ?v2 ?v4 WHERE { ?v0 <http://ogp.me/ns#title> ?v1 . ?v0 <http://ogp.me/ns#title> ?v2 . ?v0 <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://db.uwaterloo.ca/~galuc/wsdbm/ProductCategory6> . ?v0 <http://db.uwaterloo.ca/~galuc/wsdbm/hasGenre> ?v4 }'
          }
        ]
      }
    }
  },
  watch: {
    currentServersPreset: 'loadServerPreset',
    currentQueryPreset: 'loadQueryPreset'
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
        this.model = null;
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
          // get model to estimate the load before execution
          const model = client._modelRepo.getCachedModel(plan.modelID);
          self.model = self.servers.map(function (url) {
            return {
              url,
              latency: model._times[url],
              pageSize: model._triplesPerPage[url],
              throughput: model._weights[url].toString().slice(0, 5),
              coefficient: model.getCoefficient(url),
              load: (model.getCoefficient(url) / model._sumCoefs) * 100
            };
          });

          // run query
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
        case 'dbpedia2015':
          this.servers.push('http://fragments.dbpedia.org/2015-10/en');
          this.servers.push('http://fragments.mementodepot.org/dbpedia_201510');
          break;
        case '1eq':
          this.servers.push('http://34.208.134.212/watDiv_100');
          this.servers.push('http://34.208.134.212/watDiv_100');
          break;
        case '2eq':
          this.servers.push('http://34.208.134.212/watDiv_100');
          this.servers.push('http://52.10.10.208/watDiv_100');
          break;
        case '3eq':
          this.servers.push('http://34.208.134.212/watDiv_100');
          this.servers.push('http://52.10.10.208/watDiv_100');
          this.servers.push('http://54.70.48.92/watDiv_100');
          break;
        case '4eq':
          this.servers.push('http://34.208.134.212/watDiv_100');
          this.servers.push('http://52.10.10.208/watDiv_100');
          this.servers.push('http://54.70.48.92/watDiv_100');
          this.servers.push('http://35.160.40.16/watDiv_100');
          break;
        case '2neq':
          this.servers.push('http://34.208.134.212/watDiv_100');
          this.servers.push('http://35.177.243.45/watDiv_100');
          break;
        case 'debug2':
          this.servers.push('http://localhost:8000/watDiv_100');
          this.servers.push('http://localhost:8001/watDiv_100');
          break;
        case 'debug3':
          this.servers.push('http://localhost:8000/watDiv_100');
          this.servers.push('http://localhost:8001/watDiv_100');
          this.servers.push('http://localhost:8002/watDiv_100');
          break;
        case 'debug4':
          this.servers.push('http://localhost:8000/watDiv_100');
          this.servers.push('http://localhost:8001/watDiv_100');
          this.servers.push('http://localhost:8002/watDiv_100');
          this.servers.push('http://localhost:8003/watDiv_100');
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
