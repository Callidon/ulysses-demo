'use strict';
var window = self;
importScripts('../node_modules/quartz-tpf/quartz-tpf.bundle.js');

var QuartzClient = require('quartz-tpf');

onmessage = function(msg) {
  var client = new QuartzClient(msg.data.servers[0]);
  client.setOption('locLimit', msg.data.options.locLimit);
  client.setOption('usePeneloop', msg.data.options.usePeneloop);
  client.buildPlan(msg.data.query, msg.data.servers)
  .then(plan => {
    postMessage({ type: 'vars', payload: plan.variables });
    var sparqlIterator = client.executePlan(plan, false);
    sparqlIterator.on('error', error => {
      console.error('ERROR: An error occurred during query execution.\n');
      console.error(error.stack);
      postMessage({ type: 'error', payload: error});
    });
    sparqlIterator.on('end', () => {
      var endTime = Date.now();
      var time = endTime - startTime;
      postMessage({ type: 'end', payload: time });
    });
    var startTime = Date.now();
    sparqlIterator.on('data', mappings => postMessage({ type: 'data', payload: mappings }));
  })
  .catch(error => postMessage({ type: 'error', payload: error}));
}
