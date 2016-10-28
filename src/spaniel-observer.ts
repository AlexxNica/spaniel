/*
Copyright 2016 LinkedIn Corp. Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.  You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 
Unless required by applicable law or agreed to in writing, software  distributed under the License is distributed on an "AS IS" BASIS,  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
*/

import {
  IntersectionObserver,
  IntersectionObserverEntry,
  IntersectionObserverInit,
  IntersectionObserverEntryInit,
  DOMString,
  DOMMargin,
  SpanielTrackedElement,
  uuid
} from './intersection-observer';

import w from './engine/window-proxy';

let emptyRect = { x: 0, y: 0, width: 0, height: 0 };

export interface SpanielThreshold {
  label: string;
  ratio: number;
  time?: number;
}

export interface SpanielObserverInit {
  root?: SpanielTrackedElement;
  rootMargin?: DOMString | DOMMargin; // default: 0px
  threshold?: SpanielThreshold[]; // default: 0
}

export interface SpanielRecord {
  target: SpanielTrackedElement;
  payload: any;
  thresholdStates: SpanielThresholdState[];
}

export interface SpanielThresholdState {
  lastRatio: number;
  threshold: SpanielThreshold;
  lastVisible: number;
  visible: boolean;
  timeoutId?: number;
}

export interface SpanielObserverEntry extends IntersectionObserverEntry {
  duration: number;
  intersectionRatio: number;
  entering: boolean;
  label?: string;
  payload?: any;
}

export function DOMMarginToRootMargin(d: DOMMargin): DOMString {
  return `${d.top}px ${d.right}px ${d.bottom}px ${d.left}px`;
}

export class SpanielObserver {
  callback: (entries: SpanielObserverEntry[]) => void;
  observer: IntersectionObserver;
  thresholds: SpanielThreshold[];
  recordStore: { [key: string]: SpanielRecord; };
  queuedEntries: SpanielObserverEntry[];
  private paused: boolean;
  constructor(callback: (entries: SpanielObserverEntry[]) => void, options: SpanielObserverInit = {}) {
    this.paused = false;
    this.queuedEntries = [];
    this.recordStore = {};
    this.callback = callback;
    let { root, rootMargin, threshold } = options;
    rootMargin = rootMargin || '0px';
    let convertedRootMargin: DOMString = typeof rootMargin !== 'string' ? DOMMarginToRootMargin(rootMargin) : rootMargin;
    this.thresholds = threshold.sort((t: SpanielThreshold) => t.ratio );

    let o: IntersectionObserverInit = {
      root,
      rootMargin: convertedRootMargin,
      threshold: this.thresholds.map((t: SpanielThreshold) => t.ratio)
    };
    this.observer = new IntersectionObserver((records: IntersectionObserverEntry[]) => this.internalCallback(records), o);

    if (w.hasDOM) {
      window.addEventListener('unload', (e: any) => {
        this.onWindowClosed.call(this);
      });
      document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible') {
          this.onTabShown.call(this);
        } else {
          this.onTabHidden.call(this);
        }
      });
    }
  }
  private onWindowClosed() {
    this.onTabHidden();
  }
  private setAllHidden() {
    let ids = Object.keys(this.recordStore);
    let time = Date.now();
    for (let i = 0; i < ids.length; i++) {
      let record = this.recordStore[ids[i]];
      record.thresholdStates.forEach((state: SpanielThresholdState) => {
        this.handleThresholdExiting({
          intersectionRatio: -1,
          time,
          payload: record.payload,
          label: state.threshold.label,
          entering: false,
          rootBounds: emptyRect,
          boundingClientRect: emptyRect,
          intersectionRect: emptyRect,
          duration: time - state.lastVisible,
          target: record.target
        }, state);

        state.visible = false;
        state.lastRatio = -1;
      });
    }
    this.flushQueuedEntries();
    this.observer.reset();
  }
  private onTabHidden() {
    this.paused = true;
    this.setAllHidden();
  }
  private onTabShown() {
    this.paused = false;
  }
  private internalCallback(records: IntersectionObserverEntry[]) {
    if (!this.paused) {
      records.forEach(this.handleObserverEntry.bind(this));
    }
  }
  private flushQueuedEntries() {
    this.callback(this.queuedEntries.slice());
    this.queuedEntries = [];
  }
  private generateSpanielEntry(entry: IntersectionObserverEntry, state: SpanielThresholdState): SpanielObserverEntry {
    let {
      intersectionRatio,
      time,
      rootBounds,
      boundingClientRect,
      intersectionRect,
      target
    } = entry;
    let record = this.recordStore[(<SpanielTrackedElement>target).__spanielId];

    return {
      intersectionRatio,
      time,
      rootBounds,
      boundingClientRect,
      intersectionRect,
      target,
      duration: 0,
      entering: null,
      payload: record.payload,
      label: state.threshold.label
    };
  }
  private handleThresholdExiting(spanielEntry: SpanielObserverEntry, state: SpanielThresholdState) {
    let { time, intersectionRatio } = spanielEntry;
    let hasTimeThreshold = !!state.threshold.time;
    if (state.threshold.ratio <= state.lastRatio && (!hasTimeThreshold || (hasTimeThreshold && state.visible))) {
      // Make into function
      spanielEntry.duration = time - state.lastVisible;
      spanielEntry.entering = false;
      state.visible = false;
      this.queuedEntries.push(spanielEntry);
    }

    clearTimeout(state.timeoutId);
  }
  private handleObserverEntry(entry: IntersectionObserverEntry) {
    let { time } = entry;
    let target = <SpanielTrackedElement>entry.target;
    let record = this.recordStore[target.__spanielId];
    let { intersectionRatio } = entry;
    record.thresholdStates.forEach((state: SpanielThresholdState) => {
      // Find the thresholds that were crossed. Since you can have multiple thresholds
      // for the same ratio, could be multiple thresholds
      let hasTimeThreshold = !!state.threshold.time;
      let spanielEntry: SpanielObserverEntry = this.generateSpanielEntry(entry, state);

      if (intersectionRatio > state.threshold.ratio && state.threshold.ratio > state.lastRatio) {
        spanielEntry.entering = true;
        if (hasTimeThreshold) {
          state.lastVisible = time;
          state.timeoutId = setTimeout(() => {
            state.visible = true;
            spanielEntry.duration = Date.now() - state.lastVisible;
            this.callback([spanielEntry]);
          }, state.threshold.time);
        } else {
          state.visible = true;
          this.queuedEntries.push(spanielEntry);
        }
      } else if (intersectionRatio <= state.threshold.ratio) {
        this.handleThresholdExiting(spanielEntry, state);
      }

      state.lastRatio = intersectionRatio;
    });
    this.flushQueuedEntries();
  }
  disconnect() {
    this.setAllHidden();
    this.observer.disconnect();
  }
  unobserve(element: SpanielTrackedElement) {
    this.observer.unobserve(element);
    delete this.recordStore[element.__spanielId];
  }
  observe(target: SpanielTrackedElement, payload: any = null) {
    let id = target.__spanielId = target.__spanielId || uuid();
    this.recordStore[id] = {
      target,
      payload,
      thresholdStates: this.thresholds.map((threshold: SpanielThreshold) => ({
        lastRatio: -1,
        threshold,
        visible: false,
        lastVisible: null
      }))
    };
    this.observer.observe(target);
    return id;
  }
}
