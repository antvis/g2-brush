const expect = require('chai').expect;
const isRenderer = require('is-electron-renderer');
const brush = require('../../build/g2-brush');

describe('sample', () => {
  it('test', () => {
    expect('test').to.be.a('string');
    expect(brush).to.be.an('function');
  });
});

after(() => {
  if (isRenderer && window.__coverage__) {
    const { remote } = require('electron');
    const fs = remote.require('fs');
    const path = remote.require('path');
    fs.writeFileSync(path.resolve(process.cwd(), './test/coverage/coverage.json'), JSON.stringify(window.__coverage__));
  }
});
