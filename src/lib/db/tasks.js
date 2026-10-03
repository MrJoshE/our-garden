import { gardenRecords } from './records.js';
import { date, ref, required, shortText } from './fields.js';

export const {
  list: listTasks,
  get: getTask,
  create: createTask,
  update: updateTask,
  remove: deleteTask,
  restore: restoreTask
} = gardenRecords('tasks', {
  plantId: ref,
  areaId: ref,
  issueId: ref,
  title: required(shortText),
  dueOn: date(),
  doneOn: date({ notFuture: true }),
  repeat: shortText
});
