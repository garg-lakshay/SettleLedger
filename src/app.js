require('dotenv').config();

const express = require('express');
const { AppError } = require('./utils/errors');
const apiRoutes = require('./routes');

const app = express();

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'settleledger' });
});

app.use('/api', apiRoutes);

app.use((_req, _res, next) => {
  next(new AppError('Route not found', 404));
});

app.use((err, _req, res, _next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: err.message || 'Internal server error',
  });
});

module.exports = app;
