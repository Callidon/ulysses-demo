'use strict'

const QuartzClient = require('quartz-tpf')
const UlyssesIterator = require('ulysses')

const eventBus = new Vue()
const parser = document.createElement('a')
let sparqlIterator

XMLHttpRequest.prototype.reallyOpen = XMLHttpRequest.prototype.open
XMLHttpRequest.prototype.open = function (method, url, flag) {
  parser.href = url
  // uniform amazon EC2 URLs
  const index = parser.host.indexOf('ec2-')
  if (index > -1) {
    const newUrl = parser.host.substring(index + 4, parser.host.indexOf('.'))
    eventBus.$emit('proxy-url', newUrl.replace(/-/gi, '.'))
  } else {
    eventBus.$emit('proxy-url', parser.host)
  }
  this.reallyOpen(method, url, flag)
}

function formatModel (model) {
  return model._servers.map(function (url) {
    return {
      url,
      latency: model._times[url],
      pageSize: model._triplesPerPage[url],
      throughput: model._weights[url].toString().slice(0, 5),
      coefficient: model.getCoefficient(url),
      load: Math.trunc((model.getCoefficient(url) / model._sumCoefs) * 100)
    }
  })
}

const quartzDemo = new Vue({
  el: '#demoApp',
  data: {
    message: 'Hello Vue!',
    newServer: '',
    query: '',
    servers: [],
    vars: [],
    model: null,
    time: '???',
    results: [],
    barChart: null,
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
          {
            text: '1 WatDiv Amazon instances twice',
            id: '1eq'
          },
          {
            text: '2 equivalent WatDiv Amazon instances',
            id: '2eq'
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
            value: 'PREFIX dbo: <http://dbpedia.org/ontology/> PREFIX dbpedia: <http://dbpedia.org/resource/> SELECT ?actor ?city WHERE { ?actor a dbo:Actor. ?actor dbo:birthPlace ?city. ?city dbo:country dbpedia:United_States. } LIMIT 300'
          },
          {
            text: 'Softwares developed by French compagnies',
            value: 'PREFIX dbo: <http://dbpedia.org/ontology/> PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> SELECT DISTINCT ?software ?company WHERE { ?software dbo:developer ?company. ?company dbo:locationCountry ?country. ?country rdfs:label "France"@en. }'
          },
          {
            text: 'Desserts made with plants',
            value: 'PREFIX dbpedia-owl:<http://dbpedia.org/ontology/> SELECT ?dessert ?fruit WHERE { ?dessert dbpedia-owl:type <http://dbpedia.org/resource/Dessert>; dbpedia-owl:ingredient ?fruit. ?fruit dbpedia-owl:kingdom <http://dbpedia.org/resource/Plant>. }'
          },
          {
            text: 'Directors of movies starring Brad Pitt',
            value: 'PREFIX dbpedia-owl:<http://dbpedia.org/ontology/> PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> SELECT ?movie ?title ?name WHERE { ?movie dbpedia-owl:starring [ rdfs:label "Brad Pitt"@en ]; rdfs:label ?title; dbpedia-owl:director [ rdfs:label ?name ]. }'
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
    const self = this
    eventBus.$on('proxy-url', function (url) {
      if (self.calls[url] === undefined) {
        self.calls[url] = 1
        updateChartLabels(self.httpCallsChart, Object.keys(self.calls))
      } else {
        self.calls[url]++
      }
      updateChartData(self.httpCallsChart, Object.values(self.calls))
    })
  },
  methods: {
    addServer: function () {
      if (this.newServer !== '') {
        this.servers.push(this.newServer)
        this.newServer = ''
      }
    },
    removeServer: function (id) {
      const index = this.servers.indexOf(id)
      if (index > -1) {
        this.servers.splice(index, 1)
      }
    },
    stop: function () {
      sparqlIterator.close()
      this.queryInProgress = false
    },
    run: function () {
      if (this.servers.length > 0 && this.query !== '') {
        const self = this
        // reset UI variables
        this.model = null
        this.time = 'in progress'
        this.results = []
        this.calls = {}
        this.queryInProgress = true
        // build charts
        const startTime = Date.now()
        this.httpCallsChart = buildCallsChart('httpCalls', this.servers)
        this.factorsChart = buildLineChart('capacityFactors', this.servers, 'Elapsed time (seconds)', 'Server capability factor')
        this.timesChart = buildLineChart('accessTimes', this.servers, 'Elapsed time (seconds)', 'Server access time (ms)')
        this.throughputChart = buildLineChart('throughputs', this.servers, 'Elapsed time (seconds)', 'Server throughput')

        const options = {}

        // setup a daemon to update the chart
        const interval = setInterval(function () {
          const time = Math.trunc((Date.now() - startTime) / 1000)
          // update charts data (expect the load chart)
          if (self.model !== null) {
            updateLineChart(self.factorsChart, self.model.map(m => m.coefficient), time)
            updateLineChart(self.timesChart, self.model.map(m => m.latency), time)
            updateLineChart(self.throughputChart, self.model.map(m => m.throughput), time)
          }
          // redraw all charts
          self.httpCallsChart.update()
          self.factorsChart.update()
          self.timesChart.update()
          self.throughputChart.update()
        }, 2000)

        const client = new QuartzClient(this.servers[0])
        client.setOption('locLimit', options.locLimit)
        client.setOption('usePeneloop', options.usePeneloop)
        client.buildPlan(this.query, this.servers)
        .then(function (plan) {
          self.vars = plan.variables

          // run query
          // sparqlIterator = client.executePlan(plan, false);
          sparqlIterator = UlyssesIterator(self.query, self.servers)

          sparqlIterator.on('error', function (error) {
            console.error('ERROR: An error occurred during query execution.\n')
            console.error(error.stack)
          })

          sparqlIterator.on('end', function () {
            // cleanupo the daemon, redraw the plot and compute execution time
            window.clearInterval(interval)
            self.httpCallsChart.update()
            self.factorsChart.update()
            self.timesChart.update()
            self.throughputChart.update()

            const endTime = Date.now()
            const time = endTime - startTime
            self.time = (time / 1000) + 's'
            self.queryInProgress = false
          })

          const startTime = Date.now()
          sparqlIterator.on('data', function (mappings) {
            if (self.model === null) {
              self.model = formatModel(sparqlIterator.model)
              sparqlIterator.model.on('updated_time', function () {
                self.model = formatModel(sparqlIterator.model)
              })
            }
            self.results.push(mappings)
          })
        })
        .catch(function (error) {
          console.error(error)
        })
      }
    },
    loadServerPreset: function (id) {
      this.servers = []
      switch (id) {
        case 'dbpedia2015':
          this.servers.push('http://fragments.dbpedia.org/2015-10/en')
          this.servers.push('http://fragments.mementodepot.org/dbpedia_201510')
          break
        case '1eq':
          this.servers.push('http://34.212.44.110/watDiv_100')
          break
        case '2eq':
          this.servers.push('http://34.212.44.110/watDiv_100')
          this.servers.push('http://34.216.147.78/watDiv_100')
          break
        case '3eq':
          this.servers.push('http://34.212.44.110/watDiv_100')
          this.servers.push('http://34.216.147.78/watDiv_100')
          this.servers.push('http://35.167.12.122/watDiv_100')
          break
        case '4eq':
          this.servers.push('http://34.212.44.110/watDiv_100')
          this.servers.push('http://34.216.147.78/watDiv_100')
          this.servers.push('http://35.167.12.122/watDiv_100')
          this.servers.push('http://35.160.176.165/watDiv_100')
          break
        default:
          break
      }
    },
    loadQueryPreset: function (query) {
      this.query = query
    }
  }
})
