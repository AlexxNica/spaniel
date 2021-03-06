/*
Copyright 2017 LinkedIn Corp. Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.  You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
*/

var expect = chai.expect;

describe('SpanielObserver', function() {
  it('should fire impression event with correct info', function() {
    return runTest({
      label: 'impression',
      ratio: 0.5
    }).then(function(result) {
      var entries = result.entries;
      expect(entries.length).to.equal(1);
      var entry = entries[0];
      expect(entry.entering, true);
      expect(entry.label, 'impression');
      expect(entry.intersectionRatio, 1);
      return result;
    }).then(cleanUp);
  });

  it('should fire impression exiting event when tab is hidden', function() {
    return runTest({
      label: 'impression',
      ratio: 0.5
    }).then(function(result) {
      result.observer.onTabHidden();
      return new RSVP.Promise(function(resolve) {
        setTimeout(function() {
          expect(result.entries.length).to.equal(2, 'Two events have been fired');
          expect(result.entries[1].entering).to.equal(false, 'Second event is exiting');
          resolve(result);
        }, 50);
      })
    }).then(cleanUp);
  });

  it('should fire impression exiting event twice when tab is hidden, reshown, and then hidden again', function() {
    return runTest({
      label: 'impression',
      ratio: 0.5
    }).then(function(result) {
      result.observer.onTabHidden();
      return wait50ms(result);
    }).then(function(result) {
      expect(result.entries.length).to.equal(2, 'Two events have been fired');
      expect(result.entries[1].entering).to.equal(false, 'Second event is exiting');
      result.observer.onTabShown();
      return wait50ms(result);
    }).then(function(result) {
      result.observer.onTabHidden();
      return wait50ms(result);
    }).then(function(result) {
      expect(result.entries.length).to.equal(4, 'Three events have been fired');
      expect(result.entries[2].entering).to.equal(true, 'second to last event is entering');
      expect(result.entries[3].entering).to.equal(false, 'last event is exiting');
      return result;
    }).then(cleanUp);
  });

  it('should not fire impression exiting event when tab is hidden before threshold time', function() {
    return runTest({
      label: 'impression',
      ratio: 0.5,
      time: 1000
    }).then(function(result) {
      result.observer.onTabHidden();
      return new RSVP.Promise(function(resolve) {
        setTimeout(function() {
          expect(result.entries.length).to.equal(0, 'No events have been fired');
          resolve(result);
        }, 50);
      })
    }).then(cleanUp);
  });

  it('should not break when unobserving the same element twice', function() {
    return runTest({
      label: 'impression',
      ratio: 0.5,
      time: 1000
    }).then(function(result) {
      return RSVP.resolve().then(function() {
        result.observer.unobserve(result.target);
        result.observer.unobserve(result.target);
        return result;
      });
    }).then(cleanUp);
  });

  it('should support observing elements with zero height and width', function() {
    var target = document.createElement('div');
    target.style.height = '0px';
    target.style.width = '0px';
    target.style.height = '0px';
    target.style.marginTop = '10px';
    target.style.marginLeft = '10px';

    return runTest({
      label: 'exposed',
      ratio: 0
    }, {
      target: target
    }).then(function(result) {
      var entries = result.entries;
      expect(entries.length).to.equal(1);
      var entry = entries[0];
      expect(entry.entering, true);
      expect(entry.intersectionRatio, 0);
      return result;
    }).then(cleanUp);
  });

  it('should not execute callback on element of zero height and width when not in viewport', function() {
    var target = document.createElement('div');
    target.style.height = '0px';
    target.style.width = '0px';
    target.style.height = '0px';
    target.style.marginTop = '1000px';
    target.style.marginLeft = '10px';

    return runTest({
      label: 'exposed',
      ratio: 0
    }, {
      target: target
    }).then(function(result) {
      var entries = result.entries;
      expect(entries.length).to.equal(0);
      return result;
    }).then(cleanUp);
  });
});
