import { gardenRecords } from './records.js';
import { longText, ref, timestamp } from './fields.js';

export const {
  list: listVisits,
  get: getVisit,
  create: createVisit,
  update: updateVisit,
  remove: deleteVisit,
  restore: restoreVisit
} = gardenRecords('visits', {
  startedAt: timestamp,
  endedAt: timestamp,
  personId: ref,
  summary: longText
});
