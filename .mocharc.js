'use strict';

process.env.NODE_ENV = 'test';
global.expect = require('chai').expect;

module.exports = {
  reporter: 'spec',
  recursive: true,
  require: ['@babel/register'],
  timeout: 1000,
};
