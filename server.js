'use strict';
const express = require('express');
const app = express();
const http = require('http').Server(app);
const cors = require('cors');
const port = process.env.PORT || 8000;

app.use(cors());

app.use('/', express.static(__dirname + '/'));

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});

http.listen(port, function () {
  process.stdout.write('HTTP Server listening on port ' + port + '\n');
});
